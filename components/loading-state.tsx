export function LoadingState({ rows = 3 }: { rows?: number }) {
  return <div className="skeleton-stack" aria-label="Loading project">{Array.from({ length: rows }, (_, index) => <div className="skeleton-row" key={index} />)}</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="empty-state" role="alert"><span className="empty-mark">×</span><h2>Project unavailable</h2><p>{message}</p><button className="button button-primary" onClick={() => window.location.reload()}>Reload project</button></div>;
}
