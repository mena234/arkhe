import type { Attachment, ItemDraft, Project, ShareLink, SpecificationItem } from "../lib/types";
import { validateItem, validateUpload, MAX_UPLOAD_SIZE } from "../lib/validation";
import { bootstrap, changeLog, now, ownerProject, projectData, statement, unpackItem, type ItemRow, type StorageEnv } from "./database";

class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
export function identity(request: Request) {
  const id = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  if (id && email) {
    let name = email.split("@")[0];
    if (request.headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8") {
      try { name = decodeURIComponent(request.headers.get("oai-authenticated-user-full-name") || name); } catch { /* Optional display name. */ }
    }
    return { id, name, email };
  }
  // This branch is compiled out of the production Worker.
  if (import.meta.env.DEV && ["localhost", "127.0.0.1"].includes(new URL(request.url).hostname)) return { id: "local-preview", name: "Local preview", email: "preview@arkhe.local" };
  return null;
}

async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ApiError(415, "Send a JSON request.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Invalid request.");
  const decoder = new TextDecoder(); let text = ""; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 65536) { await reader.cancel(); throw new ApiError(413, "This specification is too large."); }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new ApiError(400, "Invalid request."); }
}

export async function handleApi(request: Request, env: StorageEnv): Promise<Response> {
  try { return await route(request, env); }
  catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    console.error("Arkhe request failed", { path: new URL(request.url).pathname, message: error instanceof Error ? error.message : "Unknown error" });
    return json({ error: "The workspace service is temporarily unavailable. Your draft has been kept; please try again." }, 503);
  }
}

async function route(request: Request, env: StorageEnv): Promise<Response> {
  if (!env.DB) throw new ApiError(503, "The workspace database is not available yet.");
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const db = env.DB;
  if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) throw new ApiError(405, "Method not allowed.");
  if (method !== "GET" && request.headers.get("origin") !== url.origin) throw new ApiError(403, "Open Arkhe directly to make changes.");

  // Public access is restricted to an active, unguessable share token and an explicit field projection.
  if (path.startsWith("/api/share/") && method === "GET") {
    const token = path.slice("/api/share/".length);
    const link = await activeShare(token);
    const projectRow = await statement(db, "SELECT data FROM projects WHERE id = ?", link.project_id).first<{ data: string }>();
    if (!projectRow) throw new ApiError(404, "This project link is unavailable.");
    const data = await projectData(db, JSON.parse(projectRow.data));
    const items = data.items.filter((item) => ["Approved", "Ordered"].includes(item.status)).map((item) => ({
      id: item.id, name: item.name, category: item.category, supplier: item.supplier, spaceId: item.spaceId,
      description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, leadTimeWeeks: item.leadTimeWeeks,
      status: item.status, sortOrder: item.sortOrder,
      imageUrl: item.imageUrl.startsWith("/api/assets/") ? `${item.imageUrl}?share=${token}` : item.imageUrl,
    }));
    const { name, client, location, status, updatedAt } = data.project;
    return json({ project: { name, client, location, status, updatedAt }, spaces: data.spaces.map(({ id, name, sortOrder }) => ({ id, name, sortOrder })), items, attachments: [], shareLinks: [] });
  }

  if (path.startsWith("/api/assets/") && method === "GET") {
    const id = path.slice("/api/assets/".length);
    const row = await statement(db, "SELECT a.data, a.project_id, i.deleted_at, i.data AS item_data FROM attachments a JOIN specification_items i ON i.id = a.item_id WHERE a.id = ?", id).first<{ data: string; project_id: string; deleted_at: string | null; item_data: string }>();
    if (!row || row.deleted_at) throw new ApiError(404, "File unavailable.");
    const attachment: Attachment = JSON.parse(row.data);
    const token = url.searchParams.get("share");
    if (token) {
      const link = await activeShare(token);
      const item: SpecificationItem = JSON.parse(row.item_data);
      if (link.project_id !== row.project_id || !["Approved", "Ordered"].includes(item.status) || !attachment.type.startsWith("image/") || item.imageUrl !== `/api/assets/${id}`) throw new ApiError(404, "File unavailable.");
    } else {
      const user = identity(request);
      if (!user || (await ownerProject(db, user.id))?.id !== row.project_id) throw new ApiError(404, "File unavailable.");
    }
    const object = await env.BUCKET.get(attachment.path);
    if (!object) throw new ApiError(404, "File unavailable.");
    const headers = new Headers({ "Content-Type": attachment.type, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store", "Content-Security-Policy": "default-src 'none'; sandbox", "Content-Disposition": `${attachment.type === "application/pdf" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(attachment.name)}` });
    return new Response(object.body as unknown as ReadableStream, { headers });
  }

  const user = identity(request);
  if (!user) throw new ApiError(401, "Sign in to open your private workspace.");
  if (path === "/api/project" && method === "GET") {
    const project = await bootstrap(db, user.id);
    return json({ ...await projectData(db, project), account: { name: user.name, email: user.email } });
  }
  const project = await ownerProject(db, user.id);
  if (!project) throw new ApiError(404, "Open the workspace before making changes.");

  if (path === "/api/project" && method === "PATCH") {
    const input = await body(request);
    const field = (key: string, max: number) => {
      if (typeof input[key] !== "string" || !(input[key] as string).trim() || (input[key] as string).length > max) throw new ApiError(400, `Enter a valid ${key}.`);
      return (input[key] as string).trim();
    };
    const status = field("status", 30);
    if (!["In progress", "On hold", "Complete"].includes(status)) throw new ApiError(400, "Invalid project status.");
    const updated: Project = { ...project, name: field("name", 120), client: field("client", 160), location: field("location", 160), status: status as Project["status"], updatedAt: now() };
    await db.batch([statement(db, "UPDATE projects SET data = ? WHERE id = ?", JSON.stringify(updated), project.id), ...changeLog(db, updated, "Project information updated")]);
    return json(updated);
  }

  if (path === "/api/items" && method === "POST") {
    const input = await body(request);
    const draft = await validDraft(input, project.id);
    const count = await statement(db, "SELECT COUNT(*) AS count FROM specification_items WHERE project_id = ? AND deleted_at IS NULL", project.id).first<{ count: number }>();
    if ((count?.count ?? 0) >= 500) throw new ApiError(400, "This workspace supports up to 500 specifications.");
    const id = typeof input.id === "string" && /^[a-f0-9-]{36}$/.test(input.id) ? input.id : crypto.randomUUID();
    const item: SpecificationItem = { ...draft, id, projectId: project.id, sortOrder: count?.count ?? 0, createdAt: now(), updatedAt: now(), version: 1 };
    await db.batch([statement(db, "INSERT INTO specification_items (id, project_id, space_id, data, sort_order) VALUES (?, ?, ?, ?, ?)", id, project.id, item.spaceId, JSON.stringify(item), item.sortOrder), ...changeLog(db, project, `${item.name} added`)]);
    return json(item, 201);
  }

  if (path === "/api/order" && method === "POST") {
    const input = await body(request);
    if (!Array.isArray(input.ids) || input.ids.length > 500 || input.ids.some((id) => typeof id !== "string") || new Set(input.ids).size !== input.ids.length) throw new ApiError(400, "Invalid material order.");
    const rows = await statement(db, "SELECT id FROM specification_items WHERE project_id = ? AND deleted_at IS NULL", project.id).all<{ id: string }>();
    if (rows.results.length !== input.ids.length || rows.results.some((row) => !(input.ids as string[]).includes(row.id))) throw new ApiError(409, "The material list changed in another window. Reload to arrange it.");
    await db.batch([...input.ids.map((id, index) => statement(db, "UPDATE specification_items SET sort_order = ? WHERE id = ? AND project_id = ?", index, id, project.id)), ...changeLog(db, project, "Material board rearranged")]);
    return json({ ok: true });
  }

  const itemMatch = path.match(/^\/api\/items\/([^/]+)(?:\/(restore|attachments))?$/);
  if (itemMatch) {
    const row = await statement(db, "SELECT * FROM specification_items WHERE id = ? AND project_id = ?", itemMatch[1], project.id).first<ItemRow>();
    if (!row || (row.deleted_at && itemMatch[2] !== "restore")) throw new ApiError(404, "Specification not found.");
    const item = unpackItem(row);
    if (itemMatch[2] === "restore" && method === "POST") {
      await db.batch([statement(db, "UPDATE specification_items SET deleted_at = NULL WHERE id = ? AND project_id = ?", item.id, project.id), ...changeLog(db, project, `${item.name} restored`)]);
      return json(item);
    }
    if (itemMatch[2] === "attachments" && method === "POST") {
      const size = Number(request.headers.get("content-length") || 0);
      if (size > MAX_UPLOAD_SIZE + 10000) throw new ApiError(413, "Files must be smaller than 10 MB.");
      // Bound reads before multipart parsing, including chunked requests.
      const reader = request.body?.getReader();
      if (!reader) throw new ApiError(400, "Choose a file.");
      const chunks: Uint8Array[] = []; let total = 0;
      while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > MAX_UPLOAD_SIZE + 10000) { await reader.cancel(); throw new ApiError(413, "Files must be smaller than 10 MB."); } chunks.push(value); }
      const bytes = new Uint8Array(total); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const form = await new Request(request.url, { method: "POST", headers: { "content-type": request.headers.get("content-type") || "" }, body: bytes }).formData();
      const file = form.get("file");
      if (!file || typeof file === "string") throw new ApiError(400, "Choose a file.");
      try { validateUpload(file); } catch (error) { throw new ApiError(400, (error as Error).message); }
      const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const signature = new TextDecoder().decode(head);
      const valid = file.type === "application/pdf" ? signature.startsWith("%PDF-") : file.type === "image/png" ? head[0] === 137 && signature.slice(1, 4) === "PNG" : file.type === "image/jpeg" ? head[0] === 255 && head[1] === 216 && head[2] === 255 : signature.startsWith("RIFF") && signature.slice(8, 12) === "WEBP";
      if (!valid) throw new ApiError(400, "The file contents do not match its image or PDF type.");
      const count = await statement(db, "SELECT COUNT(*) AS count FROM attachments WHERE project_id = ?", project.id).first<{ count: number }>();
      if ((count?.count ?? 0) >= 100) throw new ApiError(400, "This project supports up to 100 attachments. Remove an unused file first.");
      const id = crypto.randomUUID(); const path = `${project.id}/${id}`;
      const attachment: Attachment = { id, itemId: item.id, projectId: project.id, path, url: `/api/assets/${id}`, name: file.name.replace(/[\r\n]/g, ""), size: file.size, type: file.type, createdAt: now() };
      await env.BUCKET.put(path, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
      try { await db.batch([statement(db, "INSERT INTO attachments (id, project_id, item_id, data) VALUES (?, ?, ?, ?)", id, project.id, item.id, JSON.stringify(attachment)), ...changeLog(db, project, `File attached to ${item.name}`)]); }
      catch (error) { await env.BUCKET.delete(path); throw error; }
      return json(attachment, 201);
    }
    if (!itemMatch[2] && method === "PATCH") {
      const input = await body(request);
      const draft = await validDraft(input, project.id);
      if (input.version !== row.version) throw new ApiError(409, "This item changed in another window. Reload the project before saving your draft.");
      const updated = { ...item, ...draft, updatedAt: now(), version: row.version + 1 };
      const results = await db.batch([statement(db, "UPDATE specification_items SET data = ?, space_id = ?, version = version + 1 WHERE id = ? AND project_id = ? AND version = ? AND deleted_at IS NULL", JSON.stringify(updated), draft.spaceId, item.id, project.id, row.version), ...changeLog(db, project, `${item.name} ${item.status !== updated.status ? `marked ${updated.status.toLowerCase()}` : "updated"}`, true)]);
      if (!results[0].meta.changes) throw new ApiError(409, "This item was just changed. Reload and try again.");
      return json(updated);
    }
    if (!itemMatch[2] && method === "DELETE") {
      await db.batch([statement(db, "UPDATE specification_items SET deleted_at = ? WHERE id = ? AND project_id = ?", now(), item.id, project.id), ...changeLog(db, project, `${item.name} removed`)]);
      return json({ ok: true });
    }
  }

  if (path === "/api/shares" && method === "POST") {
    const count = await statement(db, "SELECT COUNT(*) AS count FROM share_links WHERE project_id = ? AND revoked_at IS NULL", project.id).first<{ count: number }>();
    if ((count?.count ?? 0) >= 10) throw new ApiError(400, "Revoke an older link before creating another. Up to 10 links can be active.");
    const link: ShareLink = { id: crypto.randomUUID(), projectId: project.id, token: crypto.randomUUID().replaceAll("-", ""), createdAt: now() };
    await db.batch([statement(db, "INSERT INTO share_links (id, project_id, token, created_at) VALUES (?, ?, ?, ?)", link.id, project.id, link.token, link.createdAt), ...changeLog(db, project, "Client preview link created")]);
    return json(link, 201);
  }
  if (path.startsWith("/api/shares/") && method === "DELETE") {
    await db.batch([statement(db, "UPDATE share_links SET revoked_at = ? WHERE id = ? AND project_id = ?", now(), path.slice(12), project.id), ...changeLog(db, project, "Client preview link revoked")]);
    return json({ ok: true });
  }
  if (path.startsWith("/api/attachments/") && method === "DELETE") {
    const row = await statement(db, "SELECT data FROM attachments WHERE id = ? AND project_id = ?", path.slice(17), project.id).first<{ data: string }>();
    if (!row) throw new ApiError(404, "Attachment not found.");
    const attachment: Attachment = JSON.parse(row.data);
    const item = await statement(db, "SELECT * FROM specification_items WHERE id = ? AND project_id = ?", attachment.itemId, project.id).first<ItemRow>();
    if (item && unpackItem(item).imageUrl === attachment.url) throw new ApiError(409, "Choose another cover image and save the item before removing this file.");
    await env.BUCKET.delete(attachment.path);
    await db.batch([statement(db, "DELETE FROM attachments WHERE id = ? AND project_id = ?", attachment.id, project.id), ...changeLog(db, project, "Attachment removed")]);
    return json({ ok: true });
  }
  throw new ApiError(404, "Not found.");

  async function activeShare(token: string) {
    if (!/^[a-f0-9]{32}$/.test(token)) throw new ApiError(404, "This project link is unavailable.");
    const link = await statement(db, "SELECT project_id FROM share_links WHERE token = ? AND revoked_at IS NULL", token).first<{ project_id: string }>();
    if (!link) throw new ApiError(404, "This project link is unavailable.");
    return link;
  }
  async function validDraft(input: unknown, projectId: string): Promise<ItemDraft> {
    let draft: ItemDraft;
    try { draft = validateItem(input); } catch (error) { throw new ApiError(400, (error as Error).message); }
    const space = await statement(db, "SELECT id FROM spaces WHERE id = ? AND project_id = ?", draft.spaceId, projectId).first();
    if (!space) throw new ApiError(400, "Choose a space in this project.");
    if (draft.imageUrl.startsWith("/api/assets/")) {
      const attachment = await statement(db, "SELECT data FROM attachments WHERE id = ? AND project_id = ?", draft.imageUrl.slice(12), projectId).first<{ data: string }>();
      if (!attachment || !JSON.parse(attachment.data).type.startsWith("image/")) throw new ApiError(400, "Choose an image uploaded to your project.");
    }
    return draft;
  }
}
