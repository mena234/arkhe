"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { FileText, LoaderCircle, Paperclip, Trash2, Upload, X } from "lucide-react";
import { useArkhe } from "@/components/arkhe-provider";
import { ProductImage } from "@/components/product-image";
import { formatCurrency } from "@/lib/calculations";
import { ITEM_STATUSES, type ItemDraft, type SpecificationItem } from "@/lib/types";
import { validateItem, validateUpload } from "@/lib/validation";

const blankDraft = (spaceId: string): ItemDraft => ({
  name: "",
  spaceId,
  category: "Furniture",
  supplier: "",
  description: "",
  quantity: 1,
  unitPrice: 0,
  leadTimeWeeks: 6,
  status: "Draft",
  notes: "",
  imageUrl: "",
});

function itemToDraft(item: SpecificationItem): ItemDraft {
  return {
    name: item.name,
    spaceId: item.spaceId,
    category: item.category,
    supplier: item.supplier,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    leadTimeWeeks: item.leadTimeWeeks,
    status: item.status,
    notes: item.notes,
    imageUrl: item.imageUrl,
  };
}

type ItemDrawerProps = { item: SpecificationItem | null; open: boolean; onClose: () => void };

export function ItemDrawer(props: ItemDrawerProps) {
  const instanceKey = `${props.item?.id ?? "new"}-${props.open ? "open" : "closed"}`;
  return <ItemDrawerContent key={instanceKey} {...props} />;
}

function ItemDrawerContent({ item, open, onClose }: ItemDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { data, updateItem, addItem, deleteItem, addAttachment, removeAttachment } = useArkhe();
  const [draft, setDraft] = useState<ItemDraft>(() => item ? itemToDraft(item) : blankDraft(data?.spaces[0]?.id ?? ""));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const initial = useRef(JSON.stringify(draft));
  const requestClose = () => {
    if (saving || uploading) return;
    if (initial.current !== JSON.stringify(draft) && !window.confirm("Discard your unsaved item changes?")) return;
    onClose();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const attachments = useMemo(() => data?.attachments.filter((attachment) => attachment.itemId === item?.id) ?? [], [data?.attachments, item?.id]);
  const update = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    try { validateItem(draft); } catch (error) { setFormError((error as Error).message); return; }
    setSaving(true);
    setFormError(null);
    try {
      if (item) await updateItem(item.id, draft);
      else await addItem(draft);
      onClose();
    } catch (error) {
      setFormError((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file?: File) => {
    if (!file || !item) return;
    try { validateUpload(file); } catch (error) { setFormError((error as Error).message); return; }
    setFormError(null);
    setUploading(true);
    try {
      const attachment = await addAttachment(item, file);
      if (file.type.startsWith("image/")) {
        setDraft((current) => ({ ...current, imageUrl: attachment.url }));
      }
    } catch (error) {
      setFormError((error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <dialog ref={dialogRef} className="item-drawer" aria-label={item ? "Edit specification" : "Add specification"} onCancel={(event) => { event.preventDefault(); requestClose(); }} onClose={onClose} onClick={(event) => { if (event.target === dialogRef.current) requestClose(); }}>
      <form className="drawer-panel" onSubmit={save}>
        <header className="drawer-header"><div><span>{item ? "Item details" : "New specification"}</span><h2>{item ? item.name : "Add a material"}</h2></div><button type="button" className="icon-button" onClick={requestClose} aria-label="Close item details"><X size={19} /></button></header>
        <div className="drawer-scroll">
          <div className="drawer-image-wrap"><ProductImage src={draft.imageUrl} alt={draft.name || "New material"} className="drawer-image" /><label className={`image-upload ${!item ? "is-disabled" : ""}`}><Upload size={15} /><span>{uploading ? "Uploading" : "Upload image or PDF"}</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={!item || uploading || saving} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} /></label></div>
          {item && <p className="drawer-hint">JPG, PNG, WebP, or PDF · Up to 10 MB. Files stay private; only the cover image is visible in a client preview.</p>}
          {!item && <p className="drawer-hint">Save the item once, then reopen it to upload project files.</p>}
          <div className="form-grid">
            <label className="field field-wide"><span>Product or material name</span><input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. Honed limestone paver" required /></label>
            <label className="field"><span>Supplier</span><input value={draft.supplier} onChange={(event) => update("supplier", event.target.value)} placeholder="Supplier name" required /></label>
            <label className="field"><span>Space</span><select value={draft.spaceId} onChange={(event) => update("spaceId", event.target.value)}>{data?.spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
            <label className="field"><span>Category</span><input value={draft.category} onChange={(event) => update("category", event.target.value)} placeholder="Furniture" /></label>
            <label className="field"><span>Status</span><select value={draft.status} onChange={(event) => update("status", event.target.value as ItemDraft["status"])}>{ITEM_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label className="field field-wide"><span>Description</span><textarea value={draft.description} onChange={(event) => update("description", event.target.value)} placeholder="Material, finish, dimensions, and key specification details." /></label>
            <label className="field"><span>Quantity</span><input type="number" min="0" step="0.01" value={draft.quantity} onChange={(event) => update("quantity", Number(event.target.value))} /></label>
            <label className="field"><span>Unit price (USD)</span><input type="number" min="0" step="0.01" value={draft.unitPrice} onChange={(event) => update("unitPrice", Number(event.target.value))} /></label>
            <label className="field"><span>Lead time (weeks)</span><input type="number" min="0" step="1" value={draft.leadTimeWeeks} onChange={(event) => update("leadTimeWeeks", Number(event.target.value))} /></label>
            <div className="calculated-total"><span>Calculated total</span><strong>{formatCurrency(draft.quantity * draft.unitPrice)}</strong></div>
            <label className="field field-wide"><span>Cover image URL</span><input value={draft.imageUrl} onChange={(event) => update("imageUrl", event.target.value)} placeholder="https://" maxLength={2048} /></label>
            <label className="field field-wide"><span>Notes</span><textarea value={draft.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Coordination notes, samples, finishes, or approvals." /></label>
          </div>
          {attachments.length > 0 && <section className="attachment-list"><h3><Paperclip size={15} /> Private attachments</h3>{attachments.map((attachment) => <div className="attachment-row" key={attachment.id}><a href={attachment.url} target="_blank" rel="noreferrer"><FileText size={17} /><span><strong>{attachment.name}</strong><small>{Math.max(1, Math.round(attachment.size / 1024))} KB</small></span></a><button type="button" className="icon-button" aria-label={`Remove ${attachment.name}`} disabled={uploading || saving} onClick={async () => { if (!window.confirm("Permanently remove this attachment?")) return; try { await removeAttachment(attachment); } catch (error) { setFormError((error as Error).message); } }}><Trash2 size={15} /></button></div>)}</section>}
          {formError && <p className="form-error" role="alert">{formError}</p>}
        </div>
        <footer className="drawer-footer">
          {item ? <button type="button" className="button button-danger" disabled={saving || uploading} onClick={async () => { if (!window.confirm(`Remove ${item.name} from the schedule? You can undo immediately afterward.`)) return; setSaving(true); try { await deleteItem(item.id); onClose(); } catch (error) { setFormError((error as Error).message); } finally { setSaving(false); } }}><Trash2 size={16} /> Remove item</button> : <span />}
          <div><button type="button" className="button button-secondary" onClick={requestClose}>Cancel</button><button type="submit" className="button button-primary" disabled={saving || uploading}>{saving && <LoaderCircle className="spinner" size={16} />}{saving ? "Saving" : item ? "Save changes" : "Add item"}</button></div>
        </footer>
      </form>
    </dialog>
  );
}
