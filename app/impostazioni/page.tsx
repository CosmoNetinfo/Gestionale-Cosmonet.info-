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
  const gsc = Boolean(process.env.GSC_SERVICE_ACCOUNT_JSON && process.env.GSC_SITE);
  const sb = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
  const memo = Boolean(process.env.COSMOMEMO_URL && process.env.COSMOMEMO_READ_TOKEN);
  const dc = Boolean(process.env.DISCORD_INVITE);
  const tg = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  const mcp = Boolean(process.env.MCP_TOKEN);
  const storico = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY && process.env.CRON_SECRET);
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
            <Row label="Search Console" ok={gsc} hint="GSC_SERVICE_ACCOUNT_JSON, GSC_SITE" />
            <Row label="Supabase (revisioni)" ok={sb} hint="SUPABASE_URL, SUPABASE_SECRET_KEY" />
            <Row label="Storico Search Console" ok={storico} hint="tabella gsc_page_daily su Supabase + CRON_SECRET" />
            <Row label="Cosmo Memo" ok={memo} hint="COSMOMEMO_URL, COSMOMEMO_READ_TOKEN" />
            <Row label="Discord" ok={dc} hint="DISCORD_INVITE" />
            <Row label="Telegram" ok={tg} hint="TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID" />
            <Row label="Server MCP per Claude" ok={mcp} hint="MCP_TOKEN" />
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
