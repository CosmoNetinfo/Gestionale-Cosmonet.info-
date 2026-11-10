import tls from "node:tls";
import { Badge, Card, DemoBanner, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

type Check = { nome: string; url?: string; ok: boolean; dettaglio: string };

async function http(nome: string, url: string, soloStato = false): Promise<Check> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(10000) });
    const ms = Date.now() - t0;
    return {
      nome,
      url,
      ok: res.ok,
      dettaglio: `HTTP ${res.status} in ${ms} ms${soloStato ? "" : ms > 3000 ? " (lento)" : ""}`,
    };
  } catch (e) {
    return { nome, url, ok: false, dettaglio: e instanceof Error ? e.message : "non raggiungibile" };
  }
}

function certificato(host: string): Promise<{ giorni: number; scade: string } | null> {
  return new Promise((resolve) => {
    const s = tls.connect({ host, port: 443, servername: host, timeout: 8000 }, () => {
      const c = s.getPeerCertificate();
      s.end();
      if (!c?.valid_to) return resolve(null);
      const fine = new Date(c.valid_to);
      resolve({ giorni: Math.round((fine.getTime() - Date.now()) / 86400000), scade: fine.toLocaleDateString("it-IT") });
    });
    s.on("error", () => resolve(null));
    s.on("timeout", () => {
      s.destroy();
      resolve(null);
    });
  });
}

export default async function Stato() {
  const base = process.env.WP_BASE_URL?.replace(/\/$/, "");
  if (!base) {
    return (
      <>
        <PageHeader title="Stato dei servizi" subtitle="Il sito è online? Certificato, sitemap, API" />
        <DemoBanner title="Manca WP_BASE_URL." reason="Imposta WP_BASE_URL su Vercel per controllare il sito." />
      </>
    );
  }
  const host = new URL(base).hostname;
  const [home, api, robots, sm1, sm2, cert] = await Promise.all([
    http("Home del sito", base + "/"),
    http("API WordPress", base + "/wp-json/"),
    http("robots.txt", base + "/robots.txt", true),
    http("Sitemap (Yoast)", base + "/sitemap_index.xml", true),
    http("Sitemap (WordPress)", base + "/wp-sitemap.xml", true),
    certificato(host),
  ]);
  const sitemapOk = sm1.ok || sm2.ok;
  const checks: Check[] = [
    home,
    api,
    robots,
    { ...(sm1.ok ? sm1 : sm2), nome: "Sitemap", ok: sitemapOk, dettaglio: sitemapOk ? (sm1.ok ? sm1 : sm2).dettaglio : "nessuna sitemap trovata" },
    cert
      ? { nome: "Certificato HTTPS", ok: cert.giorni > 14, dettaglio: `scade il ${cert.scade} (tra ${cert.giorni} giorni)` }
      : { nome: "Certificato HTTPS", ok: false, dettaglio: "non leggibile" },
  ];
  const tutti = checks.every((c) => c.ok);

  return (
    <>
      <PageHeader
        title="Stato dei servizi"
        subtitle={`Controllo in tempo reale di ${host}`}
        right={<Badge tone={tutti ? "ok" : "danger"}>{tutti ? "Tutto funziona" : "C'è qualcosa da controllare"}</Badge>}
      />
      <Card>
        <ul className="divide-y divide-line text-sm">
          {checks.map((c) => (
            <li key={c.nome} className="flex items-center justify-between gap-4 py-3">
              <span className="font-medium">{c.nome}</span>
              <span className="flex items-center gap-3 text-xs text-muted">
                {c.dettaglio}
                <Badge tone={c.ok ? "ok" : "danger"}>{c.ok ? "ok" : "problema"}</Badge>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">Il controllo viene rifatto a ogni apertura della pagina.</p>
      </Card>
    </>
  );
}
