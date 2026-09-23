"use client";
import { useState } from "react";
import { Copy, ExternalLink, Link2, LoaderCircle, ShieldCheck } from "lucide-react";
import { Modal } from "./modal";
import { useArkhe } from "./arkhe-provider";
export function ShareManager({ onClose }: { onClose(): void }) {
  const { data, generateShare, revokeShare, savingIds } = useArkhe();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const busy = savingIds.has("share");
  const create = async () => { setError(""); try { await generateShare(); setMessage("Client link created. Copy it or open the preview below."); } catch (error) { setError((error as Error).message); } };
  const revoke = async (id: string) => { if (!window.confirm("Revoke this link? Anyone with it will lose access immediately.")) return; try { await revokeShare(id); setMessage("Link revoked."); } catch (error) { setError((error as Error).message); } };
  const copy = async (token: string) => { try { await navigator.clipboard.writeText(`${window.location.origin}/share/${token}`); setMessage("Link copied to clipboard."); } catch { setMessage("Select the link below and copy it manually."); } };
  return <Modal title="Share with your client" onClose={onClose}><div className="modal-body"><div className="privacy-note"><ShieldCheck size={24} /><p>Only approved and ordered selections, images, and pricing are shared. Draft items, internal notes, attachments, and your account remain private.</p></div><p className="muted">Anyone with a link can view the latest approved schedule without signing in. Revoke a link at any time.</p><button className="button button-primary" onClick={create} disabled={busy || !data}>{busy ? <LoaderCircle className="spinner" size={16} /> : <Link2 size={16} />} Create client link</button><div className="share-links">{data?.shareLinks.length === 0 && <p className="muted">No active client links yet.</p>}{data?.shareLinks.map((link) => <article key={link.id}><div><strong>Client preview</strong><small>Created {new Date(link.createdAt).toLocaleDateString()}</small></div><input readOnly aria-label="Client preview URL" value={`${typeof window === "undefined" ? "" : window.location.origin}/share/${link.token}`} onFocus={(event) => event.target.select()} /><div className="link-actions"><button className="button button-secondary" onClick={() => void copy(link.token)}><Copy size={14} /> Copy</button><a className="button button-secondary" href={`/share/${link.token}`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Preview</a><button className="text-button danger-text" onClick={() => void revoke(link.id)} disabled={busy}>Revoke</button></div></article>)}</div>{message && <p role="status" className="form-message">{message}</p>}{error && <p role="alert" className="form-error">{error}</p>}</div></Modal>;
}
