import type { ReactNode } from "react";

export function PageHeader({ title, description, aside }: { title: string; description: string; aside?: ReactNode }) {
  return (
    <header className="page-header">
      <div><h1>{title}</h1><p>{description}</p></div>
      {aside && <div className="page-header-aside">{aside}</div>}
    </header>
  );
}
