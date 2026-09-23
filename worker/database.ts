import type { D1Database, D1PreparedStatement, R2Bucket } from "@cloudflare/workers-types";
import { demoData } from "../lib/demo-data";
import type { ArkheData, Project, Space, SpecificationItem } from "../lib/types";

export interface StorageEnv { DB: D1Database; BUCKET: R2Bucket }
export interface ItemRow { id: string; project_id: string; space_id: string; data: string; version: number; sort_order: number; deleted_at: string | null }
export const unpackItem = (row: ItemRow): SpecificationItem => ({ ...JSON.parse(row.data), version: row.version, sortOrder: row.sort_order });
export const now = () => new Date().toISOString();
export const statement = (db: D1Database, sql: string, ...values: unknown[]) => db.prepare(sql).bind(...values);

export async function ownerProject(db: D1Database, owner: string): Promise<Project | null> {
  const row = await statement(db, "SELECT data FROM projects WHERE owner_id = ?", owner).first<{ data: string }>();
  return row ? JSON.parse(row.data) : null;
}

export async function bootstrap(db: D1Database, owner: string): Promise<Project> {
  const existing = await ownerProject(db, owner);
  if (existing) return existing;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(owner));
  const prefix = Array.from(new Uint8Array(digest)).map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 32);
  const id = `project-${prefix}`;
  const timestamp = now();
  const project: Project = { ...demoData.project, id, ownerId: owner, updatedAt: timestamp, createdAt: timestamp };
  // Stable per-owner IDs and one atomic batch make first-load seeding race-safe.
  const jobs: D1PreparedStatement[] = [statement(db, "INSERT OR IGNORE INTO projects (id, owner_id, data) VALUES (?, ?, ?)", id, owner, JSON.stringify(project))];
  for (const source of demoData.spaces) {
    const space: Space = { ...source, id: `${prefix}-${source.id}`, projectId: id };
    jobs.push(statement(db, "INSERT OR IGNORE INTO spaces (id, project_id, data) VALUES (?, ?, ?)", space.id, id, JSON.stringify(space)));
  }
  for (const source of demoData.items) {
    const item: SpecificationItem = { ...source, id: `${prefix}-${source.id}`, projectId: id, spaceId: `${prefix}-${source.spaceId}`, createdAt: timestamp, updatedAt: timestamp, version: 1 };
    jobs.push(statement(db, "INSERT OR IGNORE INTO specification_items (id, project_id, space_id, data, sort_order) VALUES (?, ?, ?, ?, ?)", item.id, id, item.spaceId, JSON.stringify(item), item.sortOrder));
  }
  jobs.push(statement(db, "INSERT OR IGNORE INTO activity (id, project_id, message, created_at) VALUES (?, ?, ?, ?)", `${prefix}-created`, id, "Soho Residence created with 12 sample specifications", timestamp));
  await db.batch(jobs);
  return (await ownerProject(db, owner))!;
}

export async function projectData(db: D1Database, project: Project): Promise<ArkheData> {
  const [spaces, items, attachments, links, activity] = await db.batch([
    statement(db, "SELECT data FROM spaces WHERE project_id = ?", project.id),
    statement(db, "SELECT * FROM specification_items WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order", project.id),
    statement(db, "SELECT a.data FROM attachments a JOIN specification_items i ON i.id = a.item_id WHERE a.project_id = ? AND i.deleted_at IS NULL", project.id),
    statement(db, "SELECT id, project_id AS projectId, token, created_at AS createdAt FROM share_links WHERE project_id = ? AND revoked_at IS NULL ORDER BY created_at DESC", project.id),
    statement(db, "SELECT id, message, created_at AS createdAt FROM activity WHERE project_id = ? ORDER BY created_at DESC LIMIT 30", project.id),
  ]);
  return {
    project, spaces: (spaces.results as { data: string }[]).map((row) => JSON.parse(row.data)).sort((a, b) => a.sortOrder - b.sortOrder),
    items: (items.results as unknown as ItemRow[]).map(unpackItem),
    attachments: (attachments.results as { data: string }[]).map((row) => JSON.parse(row.data)),
    shareLinks: links.results as unknown as ArkheData["shareLinks"], activity: activity.results as unknown as ArkheData["activity"],
  };
}

export function changeLog(db: D1Database, project: Project, message: string, onlyIfChanged = false) {
  const timestamp = now();
  return [
    statement(db, `UPDATE projects SET data = json_set(data, '$.updatedAt', ?) WHERE id = ?${onlyIfChanged ? " AND changes() > 0" : ""}`, timestamp, project.id),
    statement(db, `INSERT INTO activity (id, project_id, message, created_at) SELECT ?, ?, ?, ?${onlyIfChanged ? " WHERE changes() > 0" : ""}`, crypto.randomUUID(), project.id, message, timestamp),
  ];
}
