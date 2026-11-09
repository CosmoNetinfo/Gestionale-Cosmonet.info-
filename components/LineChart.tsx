/** Grafico a linea semplice in SVG (nessuna dipendenza). */
export function LineChart({
  data,
  labels,
  height = 190,
}: {
  data: number[];
  labels: string[];
  height?: number;
}) {
  const W = 640;
  const H = height;
  const pad = { l: 44, r: 12, t: 12, b: 26 };
  const max = Math.max(1, ...data);
  // massimo "tondo" per le righe della griglia
  const mag = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / mag) * mag;
  const x = (i: number) => pad.l + (data.length <= 1 ? 0 : (i / (data.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const line = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * top);
  const fmt = (n: number) => n.toLocaleString("it-IT");
  const idx = [0, Math.floor((data.length - 1) / 2), data.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">
            {fmt(Math.round(t))}
          </text>
        </g>
      ))}
      {data.length > 0 && (
        <>
          <path d={area} fill="var(--primary-soft)" />
          <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" />
        </>
      )}
      {data.length > 0 &&
        idx.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
            fontSize="10"
            fill="var(--muted)"
          >
            {labels[i]}
          </text>
        ))}
    </svg>
  );
}
