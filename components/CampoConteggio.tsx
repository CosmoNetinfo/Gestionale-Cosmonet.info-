"use client";

import { useState } from "react";

/** Campo di testo con contatore dei caratteri (verde dentro il limite, giallo oltre). */
export function CampoConteggio({
  name,
  defaultValue,
  max,
  rows = 1,
}: {
  name: string;
  defaultValue: string;
  max?: number;
  rows?: number;
}) {
  const [v, setV] = useState(defaultValue);
  const over = max !== undefined && v.length > max;
  const cls = "w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm";
  return (
    <div>
      {rows > 1 ? (
        <textarea name={name} value={v} onChange={(e) => setV(e.target.value)} rows={rows} className={cls} />
      ) : (
        <input name={name} value={v} onChange={(e) => setV(e.target.value)} className={cls} />
      )}
      <div className={"mt-1 text-xs " + (over ? "text-warn" : "text-muted")}>
        {v.length}
        {max ? ` / ${max} caratteri` : " caratteri"}
      </div>
    </div>
  );
}
