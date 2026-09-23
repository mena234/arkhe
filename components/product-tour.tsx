"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Grid2X2, Share2, TableProperties, X } from "lucide-react";
import { parseTourStep, positionTourCard, tourKeys, TOUR_LAST_STEP, TOUR_QUERY, TOUR_STEPS, type TourRect } from "@/lib/product-tour";

function readPreference(key: string, temporary = false) {
  try { return (temporary ? sessionStorage : localStorage).getItem(key); } catch { return null; }
}
function writePreference(key: string, value: string | null, temporary = false) {
  try {
    const storage = temporary ? sessionStorage : localStorage;
    if (value === null) storage.removeItem(key); else storage.setItem(key, value);
  } catch { /* Tours remain usable when browser storage is disabled. */ }
}

export function ProductTour({ projectId, pathname, request }: { projectId: string; pathname: string; request: number }) {
  const [step, setStep] = useState<number | null>(null);
  const [switching, setSwitching] = useState(false);
  const initialized = useRef(false);
  const keys = tourKeys(projectId);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const url = new URL(window.location.href);
    const requestedStep = parseTourStep(url.searchParams.get(TOUR_QUERY));
    if (url.searchParams.has(TOUR_QUERY)) {
      url.searchParams.delete(TOUR_QUERY);
      window.history.replaceState(window.history.state, "", url);
    }
    const active = requestedStep ?? parseTourStep(readPreference(keys.active, true));
    setStep(active ?? (readPreference(keys.seen) ? null : 0));
  }, [keys.active, keys.seen]);

  useEffect(() => { if (request > 0) { setSwitching(false); setStep(0); } }, [request]);

  useEffect(() => {
    if (step === null) return;
    writePreference(keys.active, String(step), true);
    const route = step > 0 && step < TOUR_LAST_STEP ? TOUR_STEPS[step - 1].route : null;
    if (route && pathname !== route) {
      setSwitching(true);
      // Regular page navigation is intentional for the hosted app. The URL also
      // carries progress when sessionStorage is unavailable; it is removed on arrival.
      window.location.assign(`${route}?${TOUR_QUERY}=${step}`);
    }
  }, [step, pathname, keys.active]);

  function dismiss() {
    writePreference(keys.seen, "1");
    writePreference(keys.active, null, true);
    setStep(null);
  }

  if (step === null) return null;
  return <TourOverlay step={step} switching={switching} onStep={setStep} onDismiss={dismiss} />;
}

function TourOverlay({ step, switching, onStep, onDismiss }: { step: number; switching: boolean; onStep(step: number): void; onDismiss(): void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [targetRect, setTargetRect] = useState<TourRect | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const welcome = step === 0;
  const complete = step === TOUR_LAST_STEP;
  const current = !welcome && !complete ? TOUR_STEPS[step - 1] : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.documentElement.style.overflow;
    dialog?.showModal();
    document.documentElement.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.documentElement.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    setTargetRect(null);
    setPosition(null);
    let target: HTMLElement | null = null;
    const measure = () => {
      const card = cardRef.current;
      if (!card) return;
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const bounds = target?.getBoundingClientRect();
      let rect: TourRect | null = null;
      if (bounds && bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < viewport.height) {
        const top = Math.max(8, bounds.top - 6);
        const left = Math.max(8, bounds.left - 6);
        rect = { top, left, width: Math.max(0, Math.min(viewport.width - 8, bounds.right + 6) - left), height: Math.max(0, Math.min(viewport.height - 8, bounds.bottom + 6) - top) };
      }
      setTargetRect(rect);
      setPosition(positionTourCard(rect, viewport, { width: card.offsetWidth, height: card.offsetHeight }));
    };
    const frame = requestAnimationFrame(() => {
      if (current && !switching) {
        target = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
        if (!target && "fallback" in current) target = document.querySelector<HTMLElement>(`[data-tour="${current.fallback}"]`);
        target?.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      }
      measure();
      if (target) observer.observe(target);
    });
    const observer = new ResizeObserver(measure);
    if (cardRef.current) observer.observe(cardRef.current);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [current, step, switching]);

  return <dialog ref={dialogRef} className="tour-dialog" aria-labelledby="tour-title" aria-describedby="tour-description" onCancel={(event) => { event.preventDefault(); onDismiss(); }}>
    {targetRect ? <div className="tour-spotlight" style={targetRect} aria-hidden="true" /> : <div className="tour-shade" aria-hidden="true" />}
    <div ref={cardRef} className={`tour-card ${welcome || complete ? "tour-card-intro" : ""}`} style={position ?? { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
      <div className="tour-topline"><span>{welcome ? "WELCOME TO ARKHE" : complete ? "YOUR WORKSPACE, EXPLAINED" : `${current?.section} · ${step} of ${TOUR_STEPS.length}`}</span><button className="icon-button" onClick={onDismiss} aria-label="Close tour"><X size={18} /></button></div>
      {complete && <span className="tour-complete-mark" aria-hidden="true"><Check size={24} /></span>}
      <h2 id="tour-title" ref={titleRef} tabIndex={-1}>{welcome ? "Good spaces start with considered details." : complete ? "You’re ready to make it yours." : current?.title}</h2>
      <p id="tour-description" className="tour-description">{welcome ? "Arkhe is your workspace for choosing materials, organizing room-by-room specifications, tracking costs, and sharing decisions with clients. Let’s show you how it fits together." : complete ? "Start with a material, check its room and price, then use the schedule to refine quantities and approvals. When you’re ready, export a schedule or share a client preview." : current?.description}</p>
      {welcome && <ol className="tour-workflow">
        <li><Grid2X2 size={19} /><div><strong>Collect</strong><span>Materials & product details</span></div></li>
        <li><TableProperties size={19} /><div><strong>Specify</strong><span>Quantities, costs & approvals</span></div></li>
        <li><Share2 size={19} /><div><strong>Share</strong><span>Client-ready schedules & links</span></div></li>
      </ol>}
      <div className="tour-note">{welcome ? "About 2 minutes. We’ll visit the real screens without changing any project data." : complete ? "Replay whenever you like with Take a tour in the sidebar. On smaller screens, open the navigation menu to find it." : current?.tip}</div>
      {!welcome && <div className="tour-progress" role="progressbar" aria-label="Tour progress" aria-valuemin={0} aria-valuemax={TOUR_STEPS.length} aria-valuenow={Math.min(step, TOUR_STEPS.length)}>{TOUR_STEPS.map((item, index) => <span key={item.target} className={index < step ? "is-complete" : ""} />)}</div>}
      <div className="tour-actions">
        {welcome ? <button className="tour-text-button" onClick={onDismiss}>Explore on my own</button> : complete ? <button className="tour-text-button" onClick={onDismiss}>Stay here</button> : <button className="tour-text-button" onClick={() => onStep(step - 1)} disabled={switching}><ArrowLeft size={15} /> Back</button>}
        {complete ? <a className="button button-primary" href="/workspace" onClick={onDismiss}>Explore materials <ArrowRight size={16} /></a> : <button className="button button-primary" onClick={() => onStep(step + 1)} disabled={switching}>{switching ? "Opening screen…" : welcome ? "Show me around" : step === TOUR_STEPS.length ? "Finish tour" : "Next"}<ArrowRight size={16} /></button>}
      </div>
      {!welcome && !complete && <button className="tour-skip" onClick={onDismiss}>Skip tour</button>}
    </div>
  </dialog>;
}
