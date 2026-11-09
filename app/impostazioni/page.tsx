import { Badge, Card, PageHeader } from "@/components/ui";
import { reviewDays } from "@/lib/review";

export const dynamic = "force-dynamic";

function Row({ label, ok, hint }: { label: string; ok: boolean; hint: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted">{hint}</div>
      </div>
      <Badge tone={ok ? "ok" : "warn"}>{ok ? "Collegato" : "Da collegare"}</Badge>
    </div>
  );
}

export default function Impostazioni() {
  const wp = Boolean(
    process.env.WP_BASE_URL && process.env.WP_USER && process.env.WP_APP_PASSWORD,
  );
  const gh = Boolean(process.env.GITHUB_TOKEN || process.env.GITHUB_USER);

  return (
    <>
      <PageHeader title="Impostazioni" subtitle="Collegamenti e regole" />

      <div className="grid grid-cols-2 gap-5">
        <Card>
          <h2 className="mb-1 text-base font-semibold">Collegamenti</h2>
          <div className="divide-y divide-line">
            <Row label="WordPress" ok={wp} hint="WP_BASE_URL, WP_USER, WP_APP_PASSWORD" />
            <Row label="GitHub" ok={gh} hint="GITHUB_TOKEN (o GITHUB_USER per le sole pubbliche)" />
            <Row label="Search Console" ok={false} hint="Fase 2" />
            <Row label="Cosmo Memo" ok={false} hint="Fase 4" />
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 text-base font-semibold">Regole</h2>
          <div className="py-3">
            <div className="text-sm font-medium">Soglia di revisione</div>
            <div className="text-xs text-muted">
              Variabile REVIEW_DAYS. Oggi: {reviewDays()} giorni.
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
