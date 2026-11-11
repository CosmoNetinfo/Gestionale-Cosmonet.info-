import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import CommandPalette from "@/components/CommandPalette";
import TopBar from "@/components/TopBar";

export const metadata: Metadata = {
  title: "Cosmo Control",
  description: "Gestionale personale di Cosmonet.info",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body className="antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1 px-10 py-8">
            <TopBar />
            {children}
          </main>
          <CommandPalette />
        </div>
      </body>
    </html>
  );
}
