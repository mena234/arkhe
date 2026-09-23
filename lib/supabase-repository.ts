"use client";

import { demoData } from "@/lib/demo-data";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { ArkheData, Attachment, ShareLink, SpecificationItem } from "@/lib/types";

function toProject(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    name: String(row.name),
    client: String(row.client),
    status: String(row.status) as ArkheData["project"]["status"],
    location: String(row.location),
    updatedAt: String(row.updated_at),
    createdAt: String(row.created_at),
  };
}

function toSpace(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    name: String(row.name),
    sortOrder: Number(row.sort_order),
  };
}

function toItem(row: Record<string, unknown>): SpecificationItem {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    spaceId: String(row.space_id),
    name: String(row.name),
    category: String(row.category),
    supplier: String(row.supplier),
    description: String(row.description ?? ""),
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    leadTimeWeeks: Number(row.lead_time_weeks),
    status: String(row.status) as SpecificationItem["status"],
    notes: String(row.notes ?? ""),
    imageUrl: String(row.image_url ?? ""),
    sortOrder: Number(row.sort_order),
    updatedAt: String(row.updated_at),
    createdAt: String(row.created_at),
  };
}

function toAttachment(row: Record<string, unknown>): Attachment {
  return {
    id: String(row.id),
    itemId: String(row.item_id),
    projectId: String(row.project_id),
    name: String(row.name),
    path: String(row.path),
    url: String(row.url),
    type: String(row.type),
    size: Number(row.size),
    createdAt: String(row.created_at),
  };
}

function toShare(row: Record<string, unknown>): ShareLink {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    token: String(row.token),
    createdAt: String(row.created_at),
  };
}

function itemRow(item: SpecificationItem) {
  return {
    id: item.id,
    project_id: item.projectId,
    space_id: item.spaceId,
    name: item.name,
    category: item.category,
    supplier: item.supplier,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    lead_time_weeks: item.leadTimeWeeks,
    status: item.status,
    notes: item.notes,
    image_url: item.imageUrl,
    sort_order: item.sortOrder,
    updated_at: item.updatedAt,
  };
}

async function bootstrap(userId: string) {
  const supabase = createClient();
  if (!supabase) return;
  const projectId = crypto.randomUUID();
  const spaceIds = new Map(demoData.spaces.map((space) => [space.id, crypto.randomUUID()]));
  const { error: projectError } = await supabase.from("projects").insert({
    id: projectId,
    owner_id: userId,
    name: demoData.project.name,
    client: demoData.project.client,
    status: demoData.project.status,
    location: demoData.project.location,
  });
  if (projectError) throw projectError;

  const { error: spacesError } = await supabase.from("spaces").insert(
    demoData.spaces.map((space) => ({
      id: spaceIds.get(space.id),
      project_id: projectId,
      name: space.name,
      sort_order: space.sortOrder,
    })),
  );
  if (spacesError) throw spacesError;

  const { error: itemsError } = await supabase.from("specification_items").insert(
    demoData.items.map((item) => ({
      project_id: projectId,
      space_id: spaceIds.get(item.spaceId),
      name: item.name,
      category: item.category,
      supplier: item.supplier,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      lead_time_weeks: item.leadTimeWeeks,
      status: item.status,
      notes: item.notes,
      image_url: item.imageUrl,
      sort_order: item.sortOrder,
    })),
  );
  if (itemsError) throw itemsError;
}

export async function loadData(): Promise<ArkheData> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");
  const supabase = createClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in to open the project workspace.");

  let { data: projects, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1);
  if (projectError) throw projectError;
  if (!projects?.length) {
    await bootstrap(auth.user.id);
    const response = await supabase.from("projects").select("*").order("created_at", { ascending: true }).limit(1);
    projects = response.data;
    projectError = response.error;
  }
  if (projectError || !projects?.[0]) throw projectError ?? new Error("Project setup failed.");
  const project = toProject(projects[0] as Record<string, unknown>);
  const [spaceResult, itemResult, attachmentResult, shareResult] = await Promise.all([
    supabase.from("spaces").select("*").eq("project_id", project.id).order("sort_order"),
    supabase.from("specification_items").select("*").eq("project_id", project.id).order("sort_order"),
    supabase.from("attachments").select("*").eq("project_id", project.id).order("created_at", { ascending: false }),
    supabase.from("share_links").select("*").eq("project_id", project.id).eq("is_active", true).order("created_at", { ascending: false }),
  ]);
  const error = spaceResult.error ?? itemResult.error ?? attachmentResult.error ?? shareResult.error;
  if (error) throw error;
  return {
    project,
    spaces: (spaceResult.data ?? []).map((row) => toSpace(row as Record<string, unknown>)),
    items: (itemResult.data ?? []).map((row) => toItem(row as Record<string, unknown>)),
    attachments: (attachmentResult.data ?? []).map((row) => toAttachment(row as Record<string, unknown>)),
    shareLinks: (shareResult.data ?? []).map((row) => toShare(row as Record<string, unknown>)),
  };
}

export async function persistItem(item: SpecificationItem) {
  if (!isSupabaseConfigured) return;
  const supabase = createClient();
  const { error } = await supabase!.from("specification_items").upsert(itemRow(item));
  if (error) throw error;
}

export async function persistDelete(itemId: string) {
  if (!isSupabaseConfigured) return;
  const { error } = await createClient()!.from("specification_items").delete().eq("id", itemId);
  if (error) throw error;
}

export async function persistOrder(items: SpecificationItem[]) {
  if (!isSupabaseConfigured) return;
  const supabase = createClient()!;
  const responses = await Promise.all(items.map((item) => supabase.from("specification_items").update({ sort_order: item.sortOrder }).eq("id", item.id)));
  const failed = responses.find((response) => response.error);
  if (failed?.error) throw failed.error;
}

export async function uploadFile(item: SpecificationItem, file: File): Promise<Attachment> {
  const createdAt = new Date().toISOString();
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");
  const supabase = createClient()!;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${item.projectId}/${item.id}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from("project-assets").upload(path, file, { contentType: file.type });
  if (uploadError) throw uploadError;
  const { data: urlData } = supabase.storage.from("project-assets").getPublicUrl(path);
  const row = {
    project_id: item.projectId,
    item_id: item.id,
    name: file.name,
    path,
    url: urlData.publicUrl,
    type: file.type,
    size: file.size,
  };
  const { data, error } = await supabase.from("attachments").insert(row).select("*").single();
  if (error) throw error;
  return toAttachment(data as Record<string, unknown>);
}

export async function createShare(projectId: string): Promise<ShareLink> {
  const createdAt = new Date().toISOString();
  const token = crypto.randomUUID().replaceAll("-", "");
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");
  const { data, error } = await createClient()!
    .from("share_links")
    .insert({ project_id: projectId, token })
    .select("*")
    .single();
  if (error) throw error;
  return toShare(data as Record<string, unknown>);
}

export async function loadSharedData(token: string): Promise<ArkheData | null> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");
  const { data, error } = await createClient()!.rpc("get_shared_project", { p_token: token });
  if (error || !data || typeof data !== "object") return null;
  return data as unknown as ArkheData;
}

export { isSupabaseConfigured };
