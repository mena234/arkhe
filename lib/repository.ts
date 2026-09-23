"use client";
import * as supabase from "./supabase-repository";
import { createClient, isSupabaseConfigured } from "./supabase/client";
import type { ArkheData, Attachment, Project, ShareLink, SpecificationItem } from "./types";
import { validateUpload } from "./validation";

export { isSupabaseConfigured };
async function api<T>(path: string, method = "GET", value?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { method, credentials: "same-origin", cache: "no-store", headers: value instanceof FormData ? undefined : { "Content-Type": "application/json" }, body: value === undefined ? undefined : value instanceof FormData ? value : JSON.stringify(value) });
  } catch { throw new Error("Connection lost. Your changes were not saved. Check your connection and retry."); }
  if (response.status === 401) {
    if (!window.location.pathname.startsWith("/share/")) window.location.assign("/login");
    throw new Error("Your session has ended. Sign in again to continue.");
  }
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}
export const loadData = () => isSupabaseConfigured ? supabase.loadData() : api<ArkheData>("/project");
export async function persistItem(item: SpecificationItem, create = false): Promise<SpecificationItem> {
  if (isSupabaseConfigured) { await supabase.persistItem(item); return item; }
  return api<SpecificationItem>(create ? "/items" : `/items/${item.id}`, create ? "POST" : "PATCH", item);
}
export const persistDelete = (id: string) => isSupabaseConfigured ? supabase.persistDelete(id) : api(`/items/${id}`, "DELETE");
export async function restoreItem(item: SpecificationItem) { if (isSupabaseConfigured) { await supabase.persistItem(item); return item; } return api<SpecificationItem>(`/items/${item.id}/restore`, "POST"); }
export const persistOrder = (items: SpecificationItem[]) => isSupabaseConfigured ? supabase.persistOrder(items) : api("/order", "POST", { ids: items.map((item) => item.id) });
export async function uploadFile(item: SpecificationItem, file: File) {
  validateUpload(file);
  if (isSupabaseConfigured) return supabase.uploadFile(item, file);
  const form = new FormData(); form.append("file", file);
  return api<Attachment>(`/items/${item.id}/attachments`, "POST", form);
}
export const createShare = (projectId: string) => isSupabaseConfigured ? supabase.createShare(projectId) : api<ShareLink>("/shares", "POST");
export const loadSharedData = (token: string) => isSupabaseConfigured ? supabase.loadSharedData(token) : api<ArkheData | null>(`/share/${encodeURIComponent(token)}`);
export async function persistProject(project: Project) {
  if (!isSupabaseConfigured) return api<Project>("/project", "PATCH", project);
  const { error } = await createClient()!.from("projects").update({ name: project.name, client: project.client, location: project.location, status: project.status, updated_at: new Date().toISOString() }).eq("id", project.id);
  if (error) throw error; return project;
}
export async function revokeShare(id: string) {
  if (!isSupabaseConfigured) return api(`/shares/${id}`, "DELETE");
  const { error } = await createClient()!.from("share_links").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}
export async function removeAttachment(attachment: Attachment) {
  if (!isSupabaseConfigured) return api(`/attachments/${attachment.id}`, "DELETE");
  const client = createClient()!;
  const { error } = await client.storage.from("project-assets").remove([attachment.path]);
  if (error) throw error;
  const result = await client.from("attachments").delete().eq("id", attachment.id);
  if (result.error) throw result.error;
}
