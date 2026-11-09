"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const pages = [
  { href: "/", label: "Panoramica", icon: "◧" },
  { href: "/sito", label: "Sito", icon: "▤" },
  { href: "/repository", label: "Repository", icon: "⌥" },
  { href: "/grafici", label: "Grafici", icon: "▥" },
  { href: "/avvisi", label: "Avvisi", icon: "⚑" },
  { href: "/indicizzazione", label: "Indicizzazione", icon: "◎" },
  { href: "/coda", label: "Coda", icon: "☷" },
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
      <div className="flex items-center gap-3 px-6 py-6">
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
          <div className="text-[15px] font-semibold text-ink">Cosmo Control</div>
          <div className="text-xs text-muted">cosmonet.info</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {pages.map((p) => {
          const active =
            p.href === "/" ? pathname === "/" : pathname.startsWith(p.href);
          return (
            <Link
              key={p.href}
              href={p.href}
              className={
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors " +
                (active
                  ? "bg-primary-soft text-primary-dark"
                  : "text-muted hover:bg-canvas hover:text-ink")
              }
            >
              <span className="w-4 text-center text-base">{p.icon}</span>
              {p.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line px-6 py-4 text-xs text-muted">
        Uso personale
      </div>
    </aside>
  );
}
