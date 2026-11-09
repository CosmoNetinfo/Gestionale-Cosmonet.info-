export function Loading({ text }: { text: string }) {
  return (
    <div className="mx-auto mt-24 w-[420px] text-center">
      <div className="mb-3 text-sm font-medium text-ink">{text}</div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-primary-soft">
        <div
          className="h-full w-1/3 rounded-full bg-primary"
          style={{ animation: "cc-progress 1.3s ease-in-out infinite" }}
        />
      </div>
      <div className="mt-3 text-xs text-muted">
        Sto leggendo gli articoli da WordPress. Con molti articoli può richiedere qualche secondo.
      </div>
    </div>
  );
}
