"use client";

import { useState } from "react";
import { GripVertical, MoreHorizontal, Plus } from "lucide-react";
import { useArkhe } from "@/components/arkhe-provider";
import { ErrorState, LoadingState } from "@/components/loading-state";
import { ItemDrawer } from "@/components/item-drawer";
import { PageHeader } from "@/components/page-header";
import { ProductImage } from "@/components/product-image";
import { formatCurrency } from "@/lib/calculations";
import { ITEM_STATUSES, type SpecificationItem } from "@/lib/types";

export default function WorkspacePage() {
  const { data, loading, error, savingIds, updateItem, reorderItem } = useArkhe();
  const [selected, setSelected] = useState<SpecificationItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  if (loading) return <div className="page-wrap"><LoadingState rows={4} /></div>;
  if (error || !data) return <div className="page-wrap"><ErrorState message={error ?? "No project data was found."} /></div>;

  const openItem = (item: SpecificationItem) => { setSelected(item); setDrawerOpen(true); };
  const openNew = () => { setSelected(null); setDrawerOpen(true); };

  return (
    <div className="page-wrap workspace-page">
      <PageHeader title="Material workspace" description={`Finishes, fixtures, and objects shaping ${data.project.name}.`} aside={<button className="button button-primary" data-tour="add-material" onClick={openNew}><Plus size={17} /> Add item</button>} />
      <div className="workspace-legend"><span>{data.items.length} materials</span><span><GripVertical size={14} /> Drag to arrange · Alt + arrow keys</span><span>{savingIds.size ? "Saving changes…" : "Saved to your workspace"}</span></div>
      <section className="material-grid" aria-label="Project materials">
        {data.items.map((item, index) => {
          const space = data.spaces.find((candidate) => candidate.id === item.spaceId);
          return (
            <article
              className={`material-card ${draggedId === item.id ? "is-dragging" : ""}`}
              key={item.id}
              data-tour={index === 0 ? "material-details" : undefined}
              draggable
              tabIndex={0}
              onDragStart={() => setDraggedId(item.id)}
              onDragEnd={() => setDraggedId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => { if (draggedId) void reorderItem(draggedId, item.id).catch(() => {}); }}
              onKeyDown={(event) => {
                if (!event.altKey) return;
                const target = event.key === "ArrowLeft" ? data.items[index - 1] : event.key === "ArrowRight" ? data.items[index + 1] : null;
                if (target) { event.preventDefault(); void reorderItem(item.id, target.id).catch(() => {}); }
              }}
            >
              <button className="material-image-button" onClick={() => openItem(item)} aria-label={`Open ${item.name} details`}><ProductImage src={item.imageUrl} alt={item.name} className="material-image" /><span className="card-drag-handle" aria-hidden="true"><GripVertical size={17} /></span><span className="card-order">{String(index + 1).padStart(2, "0")}</span></button>
              <div className="material-card-body">
                <div className="material-card-meta"><span>{item.category}</span><span>{space?.name}</span></div>
                <button className="material-name" onClick={() => openItem(item)}><h2>{item.name}</h2><MoreHorizontal size={17} /></button>
                <p>{item.supplier}</p>
                <div className="material-card-foot"><strong>{formatCurrency(item.unitPrice)}</strong><select className={`status-select status-${item.status.toLowerCase()}`} value={item.status} onChange={(event) => void updateItem(item.id, { status: event.target.value as SpecificationItem["status"] }).catch(() => {})} aria-label={`${item.name} status`} disabled={savingIds.has(item.id)}>{ITEM_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></div>
              </div>
            </article>
          );
        })}
        <button className="material-add-card" onClick={openNew}><span><Plus size={19} /></span><strong>Add a material</strong><small>Furniture, finish, fixture, or equipment</small></button>
      </section>
      <ItemDrawer item={selected ? data.items.find((item) => item.id === selected.id) ?? selected : null} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
