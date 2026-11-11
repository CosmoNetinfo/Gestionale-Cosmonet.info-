"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const pages = [
  { href: "/", label: "Panoramica", icon: "◧" },
  { href: "/sito", label: "Sito", icon: "▤" },
  { href: "/repository", label: "Repository", icon: "⌥" },
  { href: "/grafici", label: "Grafici", icon: "▥" },
  { href: "/avvisi", label: "Avvisi", icon: "⚑" },
  { href: "/da-scrivere", label: "Da scrivere", icon: "✐" },
  { href: "/agenda", label: "Agenda", icon: "☑" },
  { href: "/pubblica", label: "Pubblica", icon: "➤" },
  { href: "/facebook", label: "Facebook", icon: "f" },
  { href: "/facebook/attivita", label: "Commenti FB", icon: "💬" },
  { href: "/discord", label: "Discord", icon: "d" },
  { href: "/opportunita", label: "Opportunità", icon: "◆" },
  { href: "/report", label: "Report", icon: "☑" },
  { href: "/ricerche", label: "Ricerche", icon: "⌕" },
  { href: "/segmenti", label: "Segmenti", icon: "◐" },
  { href: "/impatto", label: "Impatto revisioni", icon: "↗" },
  { href: "/salute", label: "Salute del sito", icon: "✚" },
  { href: "/link", label: "Link e immagini", icon: "⛓" },
  { href: "/archivio", label: "Archivio", icon: "▣" },
  { href: "/stato", label: "Stato servizi", icon: "●" },
  { href: "/debug", label: "Debug", icon: "✱" },
  { href: "/indicizzazione", label: "Indicizzazione", icon: "◎" },
  { href: "/coda", label: "Coda", icon: "☷" },
  { href: "/velocita", label: "Velocità", icon: "⚡" },
  { href: "/memo", label: "Cosmo Memo", icon: "✎" },
  { href: "/canali", label: "Canali", icon: "☰" },
  { href: "/impostazioni", label: "Impostazioni", icon: "⚙" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="sticky top-0 flex h-screen shrink-0 flex-col border-r border-line bg-surface"
      style={{ width: "var(--sidebar-width)" }}
    >
      <div className="flex items-center gap-3 px-6 py-4">
        <svg viewBox="0 0 512 512" className="h-9 w-9 shrink-0" role="img" aria-label="Cosmo Control">
          <defs>
            <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#2b86d1" />
              <stop offset="1" stopColor="#174f80" />
            </linearGradient>
          </defs>
          <rect width="512" height="512" rx="116" fill="url(#logo-g)" />
          <path
            d="M 348 179 A 120 120 0 1 0 348 333"
            fill="none"
            stroke="#fff"
            strokeWidth="64"
            strokeLinecap="round"
          />
          <circle cx="392" cy="256" r="26" fill="#fff" />
        </svg>
        <div className="leading-tight">
          <div className="text-lg font-bold text-ink">Cosmo Control</div>
          <div className="text-sm text-muted">cosmonet.info</div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("cc-open-search"))}
        className="mx-3 mb-2 flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[15px] font-medium text-muted hover:border-primary hover:text-primary"
      >
        <span>Cerca…</span>
        <span className="text-xs">⌘K</span>
      </button>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-2">
        {pages.map((p) => {
          const active =
            p.href === "/" ? pathname === "/" : pathname.startsWith(p.href);
          return (
            <Link
              key={p.href}
              href={p.href}
              className={
                "flex items-center gap-3 rounded-lg px-3 py-2 text-[16px] font-semibold transition-colors " +
                (active
                  ? "bg-primary text-white"
                  : "text-ink hover:bg-primary-soft hover:text-primary-dark")
              }
            >
              <span className="w-7 text-center text-xl">{p.icon}</span>
              {p.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line px-6 py-3 text-sm text-muted">
        Uso personale
      </div>
    </aside>
  );
}
