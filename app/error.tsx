"use client";
export default function ErrorPage({ reset }: { reset(): void }) {
  return <main className="share-loading"><span className="wordmark wordmark-large">Arkhe</span><h1>Something interrupted your workspace.</h1><p>Your saved project is safe. Try opening this view again.</p><button className="button button-primary" onClick={reset}>Try again</button><a className="text-button" href="/dashboard">Return to dashboard</a></main>;
}
