import type { Metadata } from "next";
import "./globals.css";
import Shell from "@/components/Shell";

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
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
