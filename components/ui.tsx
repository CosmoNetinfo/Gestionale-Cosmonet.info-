import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-8 flex items-end justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-card border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(31,45,58,0.04)] " +
        className
      }
    >
      {children}
    </div>
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warn" | "ok";
}) {
  const color =
    tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "text-ink";
  return (
    <Card>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className={"mt-2 text-3xl font-semibold " + color}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

const badgeTones = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-primary-soft text-primary-dark",
  neutral: "bg-canvas text-muted",
} as const;

export function Badge({
  tone,
  children,
}: {
  tone: keyof typeof badgeTones;
  children: ReactNode;
}) {
  return (
    <span
      className={
        "inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium " +
        badgeTones[tone]
      }
    >
      {children}
    </span>
  );
}

export function DemoBanner({ reason, title = "Dati dimostrativi." }: { reason: string; title?: string }) {
  return (
    <div className="mb-6 rounded-card border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
      <strong>{title}</strong> {reason}
    </div>
  );
}

export function ComingSoon({ phase, text }: { phase: string; text: string }) {
  return (
    <Card className="py-16 text-center">
      <div className="text-sm font-medium text-primary">{phase}</div>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{text}</p>
    </Card>
  );
}
