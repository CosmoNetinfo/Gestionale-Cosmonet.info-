"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import CommandPalette from "@/components/CommandPalette";
import TopBar from "@/components/TopBar";

/** Cornice dell'app (menu, barra in alto, ricerca). Sulla pagina di accesso non c'è: solo il modulo.
 *  Da computer il menu sta a sinistra; da cellulare diventa un pannello che si apre dal pulsante ☰. */
export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);

  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menu]);

  if (pathname === "/login") return <>{children}</>;
  return (
    <div className="flex min-h-screen">
      <Sidebar aperto={menu} onChiudi={() => setMenu(false)} />
      {menu && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMenu(false)}
          aria-hidden="true"
        />
      )}
      <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 lg:px-10 lg:py-8">
        <div className="sticky top-0 z-20 -mx-4 mb-3 flex items-center gap-3 border-b border-line bg-surface px-4 py-2 sm:-mx-6 sm:px-6 lg:hidden">
          <button
            type="button"
            onClick={() => setMenu(true)}
            aria-label="Apri il menu"
            aria-expanded={menu}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-2xl text-ink"
          >
            ☰
          </button>
          <span className="text-lg font-bold text-ink">Cosmo Control</span>
        </div>
        <TopBar />
        {children}
      </main>
      <CommandPalette />
    </div>
  );
}
