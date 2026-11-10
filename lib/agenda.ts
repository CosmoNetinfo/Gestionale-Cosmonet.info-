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
