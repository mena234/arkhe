"use client";
import { useState, type FormEvent } from "react";
import { Modal } from "./modal";
import { useArkhe } from "./arkhe-provider";
import type { Project } from "@/lib/types";
export function ProjectDialog({ onClose }: { onClose(): void }) {
  const { data, updateProject } = useArkhe();
  const [draft, setDraft] = useState(data!.project);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { await updateProject(draft); onClose(); } catch (error) { setError((error as Error).message); } finally { setBusy(false); } };
  return <Modal title="Project details" onClose={onClose}><form onSubmit={save}><div className="modal-body form-grid"><label className="field field-wide"><span>Project name</span><input required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label className="field field-wide"><span>Client</span><input required maxLength={160} value={draft.client} onChange={(event) => setDraft({ ...draft, client: event.target.value })} /></label><label className="field field-wide"><span>Location</span><input required maxLength={160} value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></label><label className="field field-wide"><span>Project status</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Project["status"] })}>{["In progress", "On hold", "Complete"].map((status) => <option key={status}>{status}</option>)}</select></label>{error && <p className="form-error field-wide" role="alert">{error}</p>}</div><footer className="modal-footer"><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save project"}</button></footer></form></Modal>;
}
