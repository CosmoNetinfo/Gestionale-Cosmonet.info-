import Link from "next/link";
import { headers } from "next/headers";
import { Badge, Card, Kpi, PageHeader } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { reportText, runDiagnostics, type Check, type Esito } from "@/lib/diagnostics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TONE: Record<Esito, "ok" | "warn" | "danger" | "neutral"> = { ok: "ok", warn: "warn", fail: "danger", info: "neutral" };
const LABEL: Record<Esito, string> = { ok: "ok", warn: "attenzione", fail: "problema", info: "info" };

function Row({ c, showFix = false }: { c: Check; showFix?: boolean }) {
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium">{c.nome}</div>
          <div className="mt-0.5 text-xs text-muted">{c.dettaglio}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {c.ms !== undefined && c.esito !== "info" && <span className="text-[11px] text-muted">{c.ms} ms</span>}
          <Badge tone={TONE[c.esito]}>{LABEL[c.esito]}</Badge>
        </div>
      </div>
      {showFix && c.fix && c.esito !== "ok" && c.esito !== "info" && (
        <div className="mt-2 rounded-md bg-canvas px-3 py-2 text-xs text-ink">
          <strong>Come sistemare:</strong> {c.fix}
        </div>
      )}
    </li>
  );
}

export default async function Debug({ searchParams }: { searchParams: { full?: string } }) {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : null;
  const full = searchParams.full === "1";

  const result = await runDiagnostics({ origin, full });
  const { checks } = result;
  const fail = checks.filter((c) => c.esito === "fail");
  const warn = checks.filter((c) => c.esito === "warn");
  const ok = checks.filter((c) => c.esito === "ok").length;
  const groups = Array.from(new Set(checks.map((c) => c.gruppo)));

  return (
    <>
      <PageHeader
        title="Debug"
        subtitle={`Controllo di tutto il gestionale · ${new Date(result.generato).toLocaleString("it-IT")} · ${(result.durataMs / 1000).toFixed(1)} s`}
        right={
          <Badge tone={fail.length ? "danger" : warn.length ? "warn" : "ok"}>
            {fail.length ? `${fail.length} problemi` : warn.length ? `${warn.length} avvisi` : "Tutto funziona"}
          </Badge>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link href="/debug" className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-primary hover:text-primary">
          Ricontrolla (rapido)
        </Link>
        <Link href="/debug?full=1" className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-primary hover:text-primary">
          Controllo completo (pagine + velocità)
        </Link>
        <CopyButton text={reportText(result)} label="Copia report per Claude" />
        <span className="text-xs text-muted">
          {full ? "Controllo completo: ha aperto ogni pagina." : "Il controllo completo apre ogni pagina e misura PageSpeed: richiede 30-60 secondi."}
        </span>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-5">
        <Kpi label="Funzionano" value={ok} tone="ok" />
        <Kpi label="Avvisi" value={warn.length} tone={warn.length ? "warn" : "default"} />
        <Kpi label="Problemi" value={fail.length} tone={fail.length ? "danger" : "default"} />
      </div>

      {fail.length + warn.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-1 text-base font-semibold">Da sistemare</h2>
          <ul className="divide-y divide-line">
            {[...fail, ...warn].map((c) => (
              <Row key={c.gruppo + c.nome} showFix c={{ ...c, nome: `${c.gruppo} · ${c.nome}` }} />
            ))}
          </ul>
        </Card>
      )}

      <div className="space-y-6">
        {groups.map((g) => (
          <Card key={g}>
            <h2 className="mb-1 text-base font-semibold">{g}</h2>
            <ul className="divide-y divide-line">
              {checks.filter((c) => c.gruppo === g).map((c) => (
                <Row key={c.nome} c={c} />
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
