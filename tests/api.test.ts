import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { handleApi } from "../worker/api";
import type { StorageEnv } from "../worker/database";
import type { ArkheData } from "../lib/types";

let sqlite: DatabaseSync;
let env: StorageEnv;
beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../drizzle/0000_nosy_vance_astro.sql", import.meta.url), "utf8"));
  const prepare = (sql: string) => {
    let values: (string | number | null)[] = [];
    return {
      bind(...args: (string | number | null)[]) { values = args; return this; },
      async first() { return sqlite.prepare(sql).get(...values) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; },
      async run() { const result = sqlite.prepare(sql).run(...values); return { meta: { changes: Number(result.changes) }, results: [] }; },
      async execute() { return /^SELECT/i.test(sql) ? this.all() : this.run(); },
    };
  };
  const objects = new Map<string, ArrayBuffer>();
  env = { DB: { prepare, batch: async (jobs: ReturnType<typeof prepare>[]) => {
    sqlite.exec("BEGIN");
    try { const results = []; for (const job of jobs) results.push(await job.execute()); sqlite.exec("COMMIT"); return results; } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  } }, BUCKET: {
    put: async (path: string, bytes: ArrayBuffer) => { objects.set(path, bytes); },
    get: async (path: string) => objects.has(path) ? { body: new Blob([objects.get(path)!]).stream() } : null,
    delete: async (path: string) => { objects.delete(path); },
  } } as unknown as StorageEnv;
});
afterEach(() => sqlite.close());
async function request(path: string, method = "GET", payload?: unknown, owner: string | null = "alice", origin = "https://arkhe.test") {
  const headers: Record<string, string> = { origin };
  if (owner) { headers["oai-authenticated-user-id"] = owner; headers["oai-authenticated-user-email"] = `${owner}@example.com`; }
  if (!(payload instanceof FormData)) headers["content-type"] = "application/json";
  return handleApi(new Request(`https://arkhe.test/api${path}`, { method, headers, body: payload === undefined ? undefined : payload instanceof FormData ? payload : JSON.stringify(payload) }), env);
}
const project = async (owner = "alice") => (await request("/project", "GET", undefined, owner)).json() as Promise<ArkheData>;

describe("hosted workspace", () => {
  it("requires identity and prevents cross-origin writes", async () => {
    expect((await request("/project", "GET", undefined, null)).status).toBe(401);
    expect((await request("/shares", "POST", {}, "alice", "https://other.test")).status).toBe(403);
  });
  it("seeds only once and isolates owners", async () => {
    const a = await project(); const second = await project(); const b = await project("bob");
    expect(a.items).toHaveLength(12); expect(second.project.id).toBe(a.project.id); expect(b.project.id).not.toBe(a.project.id);
    expect((await request(`/items/${a.items[0].id}`, "DELETE", undefined, "bob")).status).toBe(404);
    expect((await request(`/items/${a.items[0].id}`, "PATCH", a.items[0], "bob")).status).toBe(404);
  });
  it("persists edits, rejects stale versions and invalid values", async () => {
    const a = await project(); const item = a.items[0];
    expect((await request(`/items/${item.id}`, "PATCH", { ...item, quantity: 40 })).status).toBe(200);
    expect((await project()).items[0].quantity).toBe(40);
    expect((await request(`/items/${item.id}`, "PATCH", { ...item, quantity: 99 })).status).toBe(409);
    expect((await project()).items[0].quantity).toBe(40);
    expect((await request(`/items/${item.id}`, "PATCH", { ...item, version: 2, unitPrice: -1 })).status).toBe(400);
    const b = await project("bob");
    expect((await request(`/items/${item.id}`, "PATCH", { ...item, version: 2, spaceId: b.spaces[0].id })).status).toBe(400);
  });
  it("creates, reorders, deletes and restores a specification", async () => {
    const a = await project();
    const created = await (await request("/items", "POST", { ...a.items[0], id: crypto.randomUUID(), name: "Test material" })).json();
    expect((await project()).items).toHaveLength(13);
    const ids = (await project()).items.map((item) => item.id).reverse();
    expect((await request("/order", "POST", { ids })).status).toBe(200);
    expect((await project()).items[0].id).toBe(created.id);
    expect((await request(`/items/${created.id}`, "DELETE")).status).toBe(200);
    expect((await project()).items).toHaveLength(12);
    expect((await request(`/items/${created.id}/restore`, "POST")).status).toBe(200);
    expect((await project()).items).toHaveLength(13);
  });
  it("serves only public fields and revokes client access", async () => {
    const a = await project(); const link = await (await request("/shares", "POST")).json();
    const shared = await (await request(`/share/${link.token}`, "GET", undefined, null)).json();
    expect(shared.items.length).toBeGreaterThan(0);
    expect(shared.items.every((item: { status: string }) => ["Approved", "Ordered"].includes(item.status))).toBe(true);
    expect(shared.items[0]).not.toHaveProperty("notes"); expect(shared.project).not.toHaveProperty("ownerId");
    expect(shared).not.toHaveProperty("account"); expect(shared.attachments).toEqual([]);
    await request(`/shares/${link.id}`, "DELETE", undefined, "bob");
    expect((await request(`/share/${link.token}`, "GET", undefined, null)).status).toBe(200);
    expect(a.project.ownerId).toBe("alice");
    expect((await request(`/shares/${link.id}`, "DELETE")).status).toBe(200);
    expect((await request(`/share/${link.token}`, "GET", undefined, null)).status).toBe(404);
  });
  it("keeps PDF bytes private and available after reloading", async () => {
    const a = await project(); const form = new FormData();
    form.set("file", new File(["%PDF-1.4\n%%EOF"], "sample.pdf", { type: "application/pdf" }));
    const response = await request(`/items/${a.items[0].id}/attachments`, "POST", form);
    expect(response.status).toBe(201);
    const attachment = await response.json();
    expect((await project()).attachments[0].url).toBe(attachment.url);
    expect((await request(attachment.url.slice(4))).status).toBe(200);
    expect((await request(attachment.url.slice(4), "GET", undefined, null)).status).toBe(404);
    expect((await request(attachment.url.slice(4), "GET", undefined, "bob")).status).toBe(404);
    expect((await request(`/attachments/${attachment.id}`, "DELETE")).status).toBe(200);
  });
});
