"use client";
import { useState } from "react";
export function NumberCell({ value, label, max, className = "cell-input", onChange }: { value: number; label: string; max: number; className?: string; onChange(value: number): Promise<void> }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  return <input className={className} aria-label={label} type="number" min={0} max={max} step="0.01" value={draft ?? value} aria-invalid={invalid} onFocus={() => setDraft(String(value))} onChange={(event) => {
    const text = event.target.value; setDraft(text);
    const number = Number(text); const valid = text !== "" && Number.isFinite(number) && number >= 0 && number <= max;
    setInvalid(text !== "" && !valid);
    if (valid) void onChange(number).catch(() => { setDraft(null); });
  }} onBlur={() => { setDraft(null); setInvalid(false); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur(); }} />;
}
