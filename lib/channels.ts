/**
 * Canali della community. Si mostra solo ciò che si può misurare in modo ufficiale.
 *  - Discord: invito pubblico (DISCORD_INVITE, solo il codice) → iscritti e online, senza token.
 *  - Telegram: bot nel canale/gruppo (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID) → numero di iscritti.
 *  - WhatsApp, social: non hanno un'API gratuita per questi dati, quindi non vengono simulati.
 */
export interface ChannelInfo {
  key: string;
  nome: string;
  stato: "ok" | "non-collegato" | "errore" | "non-misurabile";
  iscritti?: number;
  online?: number;
  dettaglio: string;
  link?: string;
}

async function discord(): Promise<ChannelInfo> {
  const code = process.env.DISCORD_INVITE?.replace(/^.*\//, "").trim();
  if (!code) {
    return { key: "discord", nome: "Discord", stato: "non-collegato", dettaglio: "Manca DISCORD_INVITE (il codice del link d'invito, per esempio abc123)." };
  }
  try {
    const res = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true`, {
      next: { revalidate: 600 },
    });
    if (!res.ok) return { key: "discord", nome: "Discord", stato: "errore", dettaglio: `Discord ha risposto con errore ${res.status}: l'invito è scaduto o non valido?` };
    const d = (await res.json()) as {
      approximate_member_count?: number;
      approximate_presence_count?: number;
      guild?: { name?: string };
    };
    return {
      key: "discord",
      nome: "Discord",
      stato: "ok",
      iscritti: d.approximate_member_count,
      online: d.approximate_presence_count,
      dettaglio: d.guild?.name ?? "Server Discord",
      link: `https://discord.gg/${code}`,
    };
  } catch (e) {
    return { key: "discord", nome: "Discord", stato: "errore", dettaglio: (e as Error).message };
  }
}

async function telegram(): Promise<ChannelInfo> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) {
    return {
      key: "telegram",
      nome: "Telegram",
      stato: "non-collegato",
      dettaglio: "Mancano TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID (il bot deve essere dentro il gruppo o canale).",
    };
  }
  try {
    const base = `https://api.telegram.org/bot${token}`;
    const [count, info] = await Promise.all([
      fetch(`${base}/getChatMemberCount?chat_id=${encodeURIComponent(chat)}`, { next: { revalidate: 600 } }),
      fetch(`${base}/getChat?chat_id=${encodeURIComponent(chat)}`, { next: { revalidate: 600 } }),
    ]);
    const c = (await count.json()) as { ok: boolean; result?: number; description?: string };
    if (!c.ok) return { key: "telegram", nome: "Telegram", stato: "errore", dettaglio: c.description ?? "Errore Telegram" };
    const i = (await info.json()) as { ok: boolean; result?: { title?: string; username?: string } };
    return {
      key: "telegram",
      nome: "Telegram",
      stato: "ok",
      iscritti: c.result,
      dettaglio: i.result?.title ?? "Gruppo Telegram",
      link: i.result?.username ? `https://t.me/${i.result.username}` : undefined,
    };
  } catch (e) {
    return { key: "telegram", nome: "Telegram", stato: "errore", dettaglio: (e as Error).message };
  }
}

export async function getChannels(): Promise<ChannelInfo[]> {
  const [d, t] = await Promise.all([discord(), telegram()]);
  return [
    d,
    t,
    {
      key: "whatsapp",
      nome: "WhatsApp",
      stato: "non-misurabile",
      dettaglio: "WhatsApp non offre un'API gratuita per contare i membri di una community.",
    },
    {
      key: "social",
      nome: "Instagram, Facebook, TikTok",
      stato: "non-misurabile",
      dettaglio: "Servono app e permessi dei rispettivi sviluppatori: da valutare più avanti, se ti servono.",
    },
  ];
}
