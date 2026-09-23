"use client";
import { useState } from "react";
import { Check, Download, FileSpreadsheet, FileText, LoaderCircle } from "lucide-react";
import { useArkhe } from "@/components/arkhe-provider";
import { ErrorState, LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { buildCsv, calculateRollups, formatCurrency, itemTotal } from "@/lib/calculations";

export default function ExportsPage() {
  const { data, loading, error, savingIds } = useArkhe();
  const [scope, setScope] = useState("all");
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [message, setMessage] = useState("");
  const [exportError, setExportError] = useState("");
  if (loading) return <div className="page-wrap"><LoadingState rows={4} /></div>;
  if (error || !data) return <div className="page-wrap"><ErrorState message={error ?? "No project data was found."} /></div>;
  const items = scope === "approved" ? data.items.filter((item) => ["Approved", "Ordered"].includes(item.status)) : data.items;
  const rollups = calculateRollups(items);
  const names = new Map(data.spaces.map((space) => [space.id, space.name]));
  const exportingDisabled = exporting !== null || savingIds.size > 0 || !items.length;
  const exportFile = async (format: "csv" | "pdf") => {
    setExporting(format); setExportError(""); setMessage("");
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `${data.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${scope}-${stamp}`;
      if (format === "csv") {
        const url = URL.createObjectURL(new Blob(["\ufeff", buildCsv(items, data.spaces)], { type: "text/csv;charset=utf-8" }));
        const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${filename}.csv`;
        document.body.append(anchor); anchor.click(); anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      } else {
        const { buildPdf } = await import("@/lib/export-pdf");
        buildPdf(data, items).save(`${filename}.pdf`);
      }
      setMessage(`${format.toUpperCase()} prepared. Check your browser downloads.`);
    } catch { setExportError("The export could not be created. Please retry; your project data is safe."); }
    finally { setExporting(null); }
  };
  return <div className="page-wrap exports-page"><PageHeader title="Client exports" description="Create a dated snapshot of your current specification schedule." />
    <section className="export-intro"><div><span>Current schedule</span><h2>{data.project.name}</h2><p>{items.length} items · {formatCurrency(rollups.totalValue)} · Updated {new Date(data.project.updatedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}</p></div><label className="field"><span>Include in export</span><select value={scope} onChange={(event) => setScope(event.target.value)}><option value="all">Full project schedule</option><option value="approved">Approved + ordered only</option></select></label></section>
    <div className="export-grid" data-tour="schedule-exports">{([{ format: "csv", title: "Specification data", description: "Editable schedule data for cost planning or procurement handoff.", details: ["All schedule fields, including internal notes", "Formula-safe, UTF-8 spreadsheet format", "Quantities, unit prices, and line totals"], Icon: FileSpreadsheet }, { format: "pdf", title: "Client schedule", description: "A clean, client-facing schedule with pricing and project information.", details: ["Internal notes and attachments excluded", "Dated A4 landscape with page numbers", "Project information and schedule total"], Icon: FileText }] as const).map(({ format, title, description, details, Icon }) => <article key={format} className={`export-card ${format === "pdf" ? "featured" : ""}`}><div className="export-icon"><Icon size={24} /></div><div><h2>{title}</h2><p>{description}</p></div><ul>{details.map((detail) => <li key={detail}><Check size={14} />{detail}</li>)}</ul><button className="button button-primary" onClick={() => void exportFile(format)} disabled={exportingDisabled}>{exporting === format ? <LoaderCircle className="spinner" size={16} /> : <Download size={16} />}{exporting === format ? "Preparing…" : `Download ${format.toUpperCase()}`}</button></article>)}</div>
    {savingIds.size > 0 && <p role="status" className="form-message">Finishing your changes before exporting…</p>}{!items.length && <p className="form-message">No items in this selection. Approve an item or choose the full schedule.</p>}{message && <p role="status" className="form-message">{message}</p>}{exportError && <p role="alert" className="form-error">{exportError}</p>}
    <section className="export-preview"><header><div><span>ARKHE</span><small>SPATIAL SPECIFICATION SCHEDULE</small></div><div><strong>{data.project.name}</strong><small>{data.project.client}</small></div></header><div className="preview-lines">{items.slice(0, 5).map((item) => <div key={item.id}><span>{item.name}</span><span>{names.get(item.spaceId)}</span><span>{item.status}</span><strong>{formatCurrency(itemTotal(item))}</strong></div>)}</div><footer><span>Preview · First {Math.min(5, items.length)} of {items.length} items</span><strong>{formatCurrency(rollups.totalValue)}</strong></footer></section>
  </div>;
}
