"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { ProductImage } from "@/components/product-image";
import { calculateRollups, formatCurrency, itemTotal } from "@/lib/calculations";
import { loadSharedData } from "@/lib/repository";
import type { ArkheData } from "@/lib/types";

export function ClientPreview({ token }: { token: string }) {
  const [data, setData] = useState<ArkheData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadSharedData(token).then((data) => { if (active) setData(data); }).catch((error) => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const approved = useMemo(() => data?.items.filter((item) => item.status === "Approved" || item.status === "Ordered") ?? [], [data]);
  const rollups = calculateRollups(approved);

  if (loading) return <main className="share-loading"><span className="wordmark wordmark-large">Arkhe</span><p>Preparing client view…</p></main>;
  if (!data) return <main className="share-loading"><span className="wordmark wordmark-large">Arkhe</span><h1>This project link is unavailable.</h1><p>{error.includes("Connection") ? error : "It may have been revoked. Ask the design team for a new client preview link."}</p></main>;

  return (
    <main className="client-preview">
      <header className="client-preview-nav"><span className="wordmark wordmark-large">Arkhe</span><span>Shared project preview</span></header>
      <section className="client-hero"><div><p className="overline">Spatial specification · Client preview</p><h1>{data.project.name}</h1><p>{data.project.client}</p></div><div className="client-hero-meta"><span><MapPin size={15} /> {data.project.location}</span><span>Updated {new Date(data.project.updatedAt).toLocaleDateString("en-US", { dateStyle: "long" })}</span><strong>{formatCurrency(rollups.totalValue)}</strong><small>Approved specification total</small></div></section>
      <section className="client-summary"><p>This live preview contains approved and ordered selections. Prices are in USD and may exclude freight, tax, and installation unless noted. Final pricing and availability must be confirmed with suppliers.</p><div><span>{approved.length}<small>Approved items</small></span><span>{data.spaces.length}<small>Project spaces</small></span><span>{rollups.averageLeadTime.toFixed(1)} wks<small>Average lead time</small></span></div></section>
      <section className="client-spec-grid">
        {!approved.length && <div className="empty-state"><h2>Selections are being reviewed</h2><p>Approved materials will appear here when the design team completes its review.</p></div>}
        {approved.map((item, index) => {
          const space = data.spaces.find((candidate) => candidate.id === item.spaceId)?.name;
          return <article key={item.id}><ProductImage src={item.imageUrl} alt={item.name} className="client-spec-image" /><div className="client-spec-copy"><span>{String(index + 1).padStart(2, "0")} · {space}</span><h2>{item.name}</h2><p>{item.description}</p><dl><div><dt>Supplier</dt><dd>{item.supplier}</dd></div><div><dt>Category</dt><dd>{item.category}</dd></div><div><dt>Quantity</dt><dd>{item.quantity}</dd></div><div><dt>Lead time</dt><dd>{item.leadTimeWeeks} weeks</dd></div></dl><div className="client-price"><span>{formatCurrency(item.unitPrice)} each</span><strong>{formatCurrency(itemTotal(item))}</strong></div></div></article>;
        })}
      </section>
      <footer className="client-preview-footer"><div><span className="wordmark">Arkhe</span><p>Prepared for {data.project.client}</p></div><div><span>Approved schedule total</span><strong>{formatCurrency(rollups.totalValue)}</strong></div></footer>
    </main>
  );
}
