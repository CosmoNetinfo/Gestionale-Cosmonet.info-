"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import CommandPalette from "@/components/CommandPalette";
import TopBar from "@/components/TopBar";

/** Cornice dell'app (menu, barra in alto, ricerca). Sulla pagina di accesso non c'è: solo il modulo. */
export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 px-10 py-8">
        <TopBar />
        {children}
      </main>
      <CommandPalette />
    </div>
  );
}
