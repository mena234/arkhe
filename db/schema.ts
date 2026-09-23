import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(), data: text("data").notNull(),
}, (t) => [uniqueIndex("projects_owner_idx").on(t.ownerId)]);
export const spaces = sqliteTable("spaces", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), data: text("data").notNull(),
}, (t) => [index("spaces_project_idx").on(t.projectId)]);
export const items = sqliteTable("specification_items", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  spaceId: text("space_id").notNull().references(() => spaces.id),
  data: text("data").notNull(), version: integer("version").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0), deletedAt: text("deleted_at"),
}, (t) => [index("items_project_idx").on(t.projectId, t.deletedAt, t.sortOrder)]);
export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }), data: text("data").notNull(),
}, (t) => [index("attachments_project_idx").on(t.projectId), index("attachments_item_idx").on(t.itemId)]);
export const shares = sqliteTable("share_links", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  token: text("token").notNull(), createdAt: text("created_at").notNull(), revokedAt: text("revoked_at"),
}, (t) => [uniqueIndex("shares_token_idx").on(t.token), index("shares_project_idx").on(t.projectId)]);
export const activity = sqliteTable("activity", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  message: text("message").notNull(), createdAt: text("created_at").notNull(),
}, (t) => [index("activity_project_time_idx").on(t.projectId, t.createdAt)]);
