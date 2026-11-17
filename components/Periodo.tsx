import Link from "next/link";
import { PERIODI } from "@/lib/gsc";

/** Selettore del periodo: giorno, settimana, mese, 3 mesi, anno (link, nessun JavaScript). */
export function Periodo({ attivo, base = "/" }: { attivo: string; base?: string }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-white p-1 text-sm">
      {PERIODI.map((p) => (
        <Link
          key={p.id}
          href={`${base}?p=${p.id}`}
          scroll={false}
          className={
            "rounded-md px-3 py-1.5 font-medium " +
            (p.id === attivo ? "bg-primary text-white" : "text-muted hover:text-ink")
          }
        >
          {p.label}
        </Link>
      ))}
    </div>
  );
}
