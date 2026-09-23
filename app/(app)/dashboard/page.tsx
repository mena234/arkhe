"use client";

import { ArrowUpRight, Clock3, Layers3, Map, ReceiptText } from "lucide-react";
import { useArkhe } from "@/components/arkhe-provider";
import { ErrorState, LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { formatCurrency } from "@/lib/calculations";

export default function DashboardPage() {
  const { data, rollups, loading, error } = useArkhe();
  if (loading) return <div className="page-wrap"><LoadingState rows={5} /></div>;
  if (error || !data) return <div className="page-wrap"><ErrorState message={error ?? "No project data was found."} /></div>;

  const statusCounts = ["Draft", "Reviewing", "Approved", "Ordered"].map((status) => ({ status, count: data.items.filter((item) => item.status === status).length }));

  return (
    <div className="page-wrap dashboard-page">
      <PageHeader
        title={data.project.name}
        description={`${data.project.client} · ${data.project.location}`}
        aside={<div className="project-meta"><span className="status-dot" /> <strong>{data.project.status}</strong><span>Updated {new Date(data.project.updatedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}</span></div>}
      />

      <section className="summary-ledger" data-tour="project-summary" aria-label="Project summary">
        <div className="summary-primary"><span>Specification value</span><strong>{formatCurrency(rollups.totalValue, true)}</strong><small>{formatCurrency(rollups.approvedValue)} approved or ordered</small></div>
        <div className="summary-cell"><ReceiptText size={19} /><span>Items</span><strong>{rollups.itemCount}</strong><small>across the schedule</small></div>
        <div className="summary-cell"><Map size={19} /><span>Spaces</span><strong>{data.spaces.length}</strong><small>active project areas</small></div>
        <div className="summary-cell warning"><Clock3 size={19} /><span>Long lead</span><strong>{rollups.longLeadCount}</strong><small>16 weeks or longer</small></div>
      </section>

      <div className="dashboard-grid">
        <section className="dashboard-section status-overview">
          <div className="section-heading"><div><h2>Schedule progress</h2><p>Status across the full material specification.</p></div><a href="/specifications">Open schedule <ArrowUpRight size={15} /></a></div>
          <div className="status-bars">
            {statusCounts.map(({ status, count }) => {
              const percentage = data.items.length ? Math.round((count / data.items.length) * 100) : 0;
              return <div className="status-bar-row" key={status}><span>{status}</span><div className="status-bar-track"><span className={`status-bar-fill tone-${status.toLowerCase()}`} style={{ transform: `scaleX(${percentage / 100})` }} /></div><strong>{count}</strong></div>;
            })}
          </div>
          <div className="dashboard-callout"><Layers3 size={18} /><p><strong>{statusCounts.find((item) => item.status === "Reviewing")?.count ?? 0} selections need review.</strong> Finish material sign-off before the next client presentation.</p><a href="/workspace">Review materials</a></div>
        </section>

        <section className="dashboard-section activity-section">
          <div className="section-heading"><div><h2>Recent activity</h2><p>The latest changes in {data.project.name}.</p></div></div>
          <ol className="activity-list">
            {(data.activity ?? []).slice(0, 5).map((activity) => <li key={activity.id}><span className="activity-mark" /><div><strong>{activity.message}</strong><small>Project workspace</small></div><time dateTime={activity.createdAt}>{new Date(activity.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></li>)}
            {!data.activity?.length && <li><p>Your next project change will appear here.</p></li>}
          </ol>
        </section>
      </div>
    </div>
  );
}
