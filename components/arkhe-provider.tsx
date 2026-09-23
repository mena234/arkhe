"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { calculateRollups } from "@/lib/calculations";
import * as repository from "@/lib/repository";
import { validateItem } from "@/lib/validation";
import type { ArkheData, Attachment, ItemDraft, Project, ShareLink, SpecificationItem } from "@/lib/types";

interface Context {
  data: ArkheData | null; loading: boolean; error: string | null; savingIds: Set<string>;
  rollups: ReturnType<typeof calculateRollups>; demoMode: boolean;
  updateItem(id: string, patch: Partial<SpecificationItem>): Promise<void>;
  addItem(draft: ItemDraft): Promise<SpecificationItem>; deleteItem(id: string): Promise<void>; undoDelete(): Promise<void>;
  reorderItem(source: string, target: string): Promise<void>;
  addAttachment(item: SpecificationItem, file: File): Promise<Attachment>; removeAttachment(attachment: Attachment): Promise<void>;
  generateShare(): Promise<ShareLink>; revokeShare(id: string): Promise<void>; updateProject(patch: Partial<Project>): Promise<void>;
  notice: { tone: "error" | "info"; message: string; undo?: boolean } | null;
  clearNotice(): void;
}
const ArkheContext = createContext<Context | null>(null);
type Transform = (data: ArkheData) => ArkheData;
type Pending = { key: string; transform: Transform };
const replaceItem = (data: ArkheData, item: SpecificationItem): ArkheData => ({ ...data, items: data.items.map((old) => old.id === item.id ? item : old) });
const timestamp = () => new Date().toISOString();
function log(data: ArkheData, message: string): ArkheData { return { ...data, project: { ...data.project, updatedAt: timestamp() }, activity: [{ id: crypto.randomUUID(), message, createdAt: timestamp() }, ...(data.activity ?? [])].slice(0, 30) }; }

export function ArkheProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ArkheData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState(new Set<string>());
  const [notice, setNotice] = useState<Context["notice"]>(null);
  const confirmed = useRef<ArkheData | null>(null);
  const pending = useRef<Pending[]>([]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const deleted = useRef<SpecificationItem | null>(null);
  useEffect(() => {
    let active = true;
    repository.loadData().then((value) => { if (active) { confirmed.current = value; setData(value); } }).catch((reason) => { if (active) setError(reason.message ?? "The workspace could not be opened."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => { if (pending.current.length) event.preventDefault(); };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, []);
  useEffect(() => { if (notice?.tone === "info") { const timer = setTimeout(() => setNotice(null), 10000); return () => clearTimeout(timer); } }, [notice]);
  const renderPending = useCallback(() => {
    if (!confirmed.current) return;
    setData(pending.current.reduce((state, operation) => operation.transform(state), confirmed.current));
    setSavingIds(new Set(pending.current.map((operation) => operation.key)));
  }, []);
  // Rebase queued optimistic edits over acknowledged data; failed operations roll
  // back independently and cannot overwrite a newer pending edit.
  const enqueue = useCallback((key: string, transform: Transform, save: (current: ArkheData) => Promise<ArkheData>) => {
    if (!confirmed.current) return Promise.reject(new Error("The project is still loading."));
    const operation = { key, transform };
    pending.current.push(operation); renderPending();
    const task = queue.current.catch(() => {}).then(async () => {
      try { confirmed.current = await save(confirmed.current!); }
      catch (reason) { const error = reason instanceof Error ? reason : new Error("The change could not be saved."); setNotice({ tone: "error", message: error.message }); throw error; }
      finally { pending.current = pending.current.filter((entry) => entry !== operation); renderPending(); }
    });
    queue.current = task;
    return task;
  }, [renderPending]);
  const updateItem: Context["updateItem"] = (id, patch) => enqueue(id, (state) => {
    const item = state.items.find((item) => item.id === id);
    return item ? replaceItem(state, { ...item, ...patch }) : state;
  }, async (state) => {
    const previous = state.items.find((item) => item.id === id);
    if (!previous) throw new Error("This item is no longer available.");
    const item = { ...previous, ...validateItem({ ...previous, ...patch }), updatedAt: timestamp() };
    return log(replaceItem(state, await repository.persistItem(item)), `${item.name} updated`);
  });
  const addItem: Context["addItem"] = async (draft) => {
    const state = confirmed.current!;
    const item: SpecificationItem = { ...validateItem(draft), id: crypto.randomUUID(), projectId: state.project.id, sortOrder: state.items.length, createdAt: timestamp(), updatedAt: timestamp() };
    let saved = item;
    await enqueue(item.id, (state) => ({ ...state, items: [...state.items, item] }), async (state) => {
      saved = await repository.persistItem(item, true);
      return log({ ...state, items: [...state.items, saved] }, `${item.name} added`);
    });
    return saved;
  };
  const deleteItem: Context["deleteItem"] = async (id) => {
    await enqueue(id, (state) => ({ ...state, items: state.items.filter((item) => item.id !== id) }), async (state) => {
      const item = state.items.find((item) => item.id === id)!;
      await repository.persistDelete(id); deleted.current = item;
      setNotice({ tone: "info", message: `${item.name} removed.`, undo: true });
      return log({ ...state, items: state.items.filter((item) => item.id !== id) }, `${item.name} removed`);
    });
  };
  const undoDelete = async () => {
    const item = deleted.current; if (!item) return;
    const restore: Transform = (state) => ({ ...state, items: [...state.items.filter((candidate) => candidate.id !== item.id), item].sort((a, b) => a.sortOrder - b.sortOrder) });
    await enqueue(item.id, restore, async (state) => { await repository.restoreItem(item); deleted.current = null; setNotice(null); return log(restore(state), `${item.name} restored`); });
  };
  const reorderItem: Context["reorderItem"] = (source, target) => {
    const arrange: Transform = (state) => {
      const items = [...state.items]; const from = items.findIndex((item) => item.id === source); const to = items.findIndex((item) => item.id === target);
      if (from < 0 || to < 0 || from === to) return state;
      const [moved] = items.splice(from, 1); items.splice(to, 0, moved);
      return { ...state, items: items.map((item, sortOrder) => ({ ...item, sortOrder })) };
    };
    return enqueue("order", arrange, async (state) => { const next = arrange(state); await repository.persistOrder(next.items); return log(next, "Material board rearranged"); });
  };
  const addAttachment: Context["addAttachment"] = async (item, file) => {
    let attachment!: Attachment;
    await enqueue("attachment", (state) => state, async (state) => { attachment = await repository.uploadFile(item, file); return log({ ...state, attachments: [...state.attachments, attachment] }, `File attached to ${item.name}`); });
    return attachment;
  };
  const removeAttachment: Context["removeAttachment"] = (attachment) => enqueue("attachment", (state) => state, async (state) => { await repository.removeAttachment(attachment); return log({ ...state, attachments: state.attachments.filter((file) => file.id !== attachment.id) }, "Attachment removed"); });
  const generateShare = async () => {
    let link!: ShareLink;
    await enqueue("share", (state) => state, async (state) => { link = await repository.createShare(state.project.id); return log({ ...state, shareLinks: [link, ...state.shareLinks] }, "Client preview link created"); });
    return link;
  };
  const revokeShare = (id: string) => enqueue("share", (state) => state, async (state) => { await repository.revokeShare(id); return log({ ...state, shareLinks: state.shareLinks.filter((link) => link.id !== id) }, "Client preview link revoked"); });
  const updateProject: Context["updateProject"] = (patch) => enqueue("project", (state) => ({ ...state, project: { ...state.project, ...patch } }), async (state) => log({ ...state, project: await repository.persistProject({ ...state.project, ...patch }) }, "Project information updated"));
  return <ArkheContext.Provider value={{ data, loading, error, savingIds, rollups: calculateRollups(data?.items ?? []), demoMode: false, notice, clearNotice: () => setNotice(null), updateItem, addItem, deleteItem, undoDelete, reorderItem, addAttachment, removeAttachment, generateShare, revokeShare, updateProject }}>{children}</ArkheContext.Provider>;
}
export function useArkhe() { const value = useContext(ArkheContext); if (!value) throw new Error("useArkhe requires ArkheProvider"); return value; }
