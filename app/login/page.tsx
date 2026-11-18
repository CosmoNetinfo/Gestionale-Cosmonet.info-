import { destinazione } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accedi · Cosmo Control" };

export default function Login({ searchParams }: { searchParams?: { errore?: string; next?: string } }) {
  const next = destinazione(searchParams?.next);
  const errore = searchParams?.errore === "1";
  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <svg viewBox="0 0 512 512" className="h-16 w-16" role="img" aria-label="Cosmo Control">
            <defs>
              <linearGradient id="login-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#2b86d1" />
                <stop offset="1" stopColor="#174f80" />
              </linearGradient>
            </defs>
            <rect width="512" height="512" rx="116" fill="url(#login-g)" />
            <path d="M 348 179 A 120 120 0 1 0 348 333" fill="none" stroke="#fff" strokeWidth="64" strokeLinecap="round" />
            <circle cx="392" cy="256" r="26" fill="#fff" />
          </svg>
          <h1 className="mt-4 text-2xl font-bold text-ink">Cosmo Control</h1>
          <p className="mt-1 text-sm text-muted">Gestionale di Cosmonet.info</p>
          <p className="text-sm text-muted">Daniele Spalletti</p>
        </div>

        <form method="post" action="/api/login" className="mt-8 space-y-4">
          <input type="hidden" name="next" value={next} />
          <label className="block text-sm font-medium text-ink" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base"
          />
          {errore && (
            <p role="alert" className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
              Password non corretta.
            </p>
          )}
          <button type="submit" className="w-full rounded-lg bg-primary px-4 py-2.5 text-base font-semibold text-white hover:opacity-90">
            Accedi
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-muted">Area privata · uso personale</p>
      </div>
    </div>
  );
}
