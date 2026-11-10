// Collegamento a Cosmo Agenda (Orbita Agent) via il suo endpoint MCP/REST.
// Serve la variabile AGENDA_URL = https://<dominio-agenda>.vercel.app/api/mcp/<MCP_AUTH_TOKEN>

export const agendaAttiva = () => !!process.env.AGENDA_URL;

export async function agendaAddTask(t: { title: string; date: string; notes?: string; kind?: string; priority?: "bassa" | "normale" | "alta" }) {
  const url = process.env.AGENDA_URL;
  if (!url) throw new Error("AGENDA_URL non configurata");
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "add_task", parameters: { project: "Cosmonet", kind: "articolo", ...t } }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Agenda ha risposto ${r.status}`);
  return r.json();
}

export type AgendaTask = {
  id: string; title: string; date: string; time: string | null; kind: string;
  project: string | null; priority: string; status: string; notes: string | null; postponed_count?: number;
};

export async function agendaCall(action: string, parameters: Record<string, unknown>) {
  const url = process.env.AGENDA_URL;
  if (!url) throw new Error("AGENDA_URL non configurata");
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, parameters }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Agenda ha risposto ${r.status}`);
  return (await r.json()).result;
}

export async function agendaTasks(start: string, end: string): Promise<AgendaTask[]> {
  const r = await agendaCall("list_tasks", { start_date: start, end_date: end, status: "todo" });
  return r.tasks ?? [];
}

export const agendaComplete = (task_id: string) => agendaCall("complete_task", { task_id });

export const AGENDA_SITO = "https://cosmo-agenda.vercel.app/";
