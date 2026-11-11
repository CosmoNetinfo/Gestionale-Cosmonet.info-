"use client";

export default function RispostaForm({ action, commento }: { action: (fd: FormData) => void | Promise<void>; commento: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Pubblicare questa risposta sulla pagina Facebook?")) e.preventDefault();
      }}
      className="mt-2 flex gap-2"
    >
      <input type="hidden" name="commento" value={commento} />
      <input name="testo" required maxLength={1500} placeholder="Scrivi una risposta…" className="min-w-0 flex-1 rounded-md border border-line bg-surface p-2 text-sm" />
      <button className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark">Rispondi</button>
    </form>
  );
}
