"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BarChart3, ChevronDown, CircleHelp, FileDown, Grid2X2, Menu, PanelLeftClose, Share2, TableProperties, X } from "lucide-react";
import { useArkhe } from "@/components/arkhe-provider";
import { ShareManager } from "./share-manager";
import { ProjectDialog } from "./project-dialog";
import { ProductTour } from "./product-tour";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/workspace", label: "Workspace", icon: Grid2X2 },
  { href: "/specifications", label: "Specifications", icon: TableProperties },
  { href: "/exports", label: "Exports", icon: FileDown },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data, savingIds, notice, undoDelete, clearNotice } = useArkhe();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [tourRequest, setTourRequest] = useState(0);
  const name = data?.account?.name || "Your workspace";

  return (
    <div className="app-shell">
      <aside className={`side-rail ${menuOpen ? "is-open" : ""}`} aria-label="Project navigation">
        <div className="rail-brand-row">
          <a href="/dashboard" className="wordmark" aria-label="Arkhe dashboard" onClick={() => setMenuOpen(false)}>Arkhe</a>
          <button className="icon-button rail-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><PanelLeftClose size={18} /></button>
        </div>
        <button className="project-switcher" type="button" aria-label="Open project details" onClick={() => setProjectOpen(true)} disabled={!data}>
          <span className="project-monogram">SR</span>
          <span className="project-switcher-copy"><strong>{data?.project.name ?? "Soho Residence"}</strong><small>{data?.project.status ?? "Residential"} · Project details</small></span>
          <ChevronDown size={16} />
        </button>
        <nav className="rail-nav">
          {navItems.map(({ href, label, icon: Icon }) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)} className={pathname === href ? "is-active" : ""} aria-current={pathname === href ? "page" : undefined}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="rail-foot">
          <button className="tour-launch" onClick={() => { setMenuOpen(false); setTourRequest((value) => value + 1); }} disabled={!data || savingIds.size > 0}><CircleHelp size={17} /><span>Take a tour</span><small>2 min</small></button>
          <span className="demo-chip">Private cloud workspace</span>
          <div className="profile-row">
            <span className="profile-avatar">{name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
            <span><strong>{name}</strong><small>Project owner</small></span>
          </div>
          <a className="signout-link" href="/signout-with-chatgpt?return_to=%2Flogin" target="_top">Sign out</a>
        </div>
      </aside>
      {menuOpen && <button className="rail-backdrop" onClick={() => setMenuOpen(false)} aria-label="Close navigation backdrop" />}
      <div className="app-stage">
        <header className="topbar">
          <button className="icon-button menu-trigger" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
          <div className="topbar-context"><span>{data?.project.name ?? "Soho Residence"}</span><span className="context-separator">/</span><strong>{navItems.find((item) => item.href === pathname)?.label ?? "Project"}</strong></div>
          <span className="save-indicator" role="status">{savingIds.size ? "Saving changes…" : data ? "All changes saved" : "Connecting…"}</span>
          <button className="button button-secondary share-button" data-tour="share-project" onClick={() => setSharing(true)} disabled={!data}>
            <Share2 size={16} /><span>Share project</span>
          </button>
        </header>
        <main className="page-stage">{children}</main>
      </div>
      {notice && (
        <div className={`toast toast-${notice.tone}`} role="status">
          <span>{notice.message}</span>
          {notice.undo && <button onClick={() => void undoDelete().catch(() => {})}>Undo</button>}
          <button className="toast-close" onClick={clearNotice} aria-label="Dismiss message"><X size={15} /></button>
        </div>
      )}
      {sharing && <ShareManager onClose={() => setSharing(false)} />}
      {projectOpen && data && <ProjectDialog onClose={() => setProjectOpen(false)} />}
      {data && <ProductTour key={data.project.id} projectId={data.project.id} pathname={pathname} request={tourRequest} />}
    </div>
  );
}
