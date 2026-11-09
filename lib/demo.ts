import type { Article } from "./types";
import type { Repo } from "./github";

/** Dati di esempio, usati solo finché i collegamenti non sono configurati. */
function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  return d.toISOString().slice(0, 19);
}

function a(
  id: number,
  title: string,
  slug: string,
  status: Article["status"],
  category: string,
  age: number,
  modifiedAge = age,
): Article {
  return {
    id,
    title,
    slug,
    url: `https://www.cosmonet.info/${slug}/`,
    status,
    category,
    date: daysAgo(age),
    modified: daysAgo(modifiedAge),
  };
}

export const demoArticles: Article[] = [
  a(8764, "DSpine Tencent: drafter parallelo per Qwen3-8B (esempio)", "dspine-tencent", "publish", "Intelligenza Artificiale", 0),
  a(8767, "Pinky MCP: agenti AI su iPhone e Android (esempio)", "pinky-mcp", "publish", "Intelligenza Artificiale", 0),
  a(8762, "Academic Research Skills per Claude Code (esempio)", "academic-research-skills", "publish", "Intelligenza Artificiale", 1),
  a(8700, "Guida a Ollama: installazione e primi modelli (esempio)", "guida-ollama", "publish", "Intelligenza Artificiale", 140),
  a(8650, "Linux Mint: cosa cambia nell'ultima versione (esempio)", "linux-mint-novita", "publish", "Linux", 112, 40),
  a(8600, "ArtCraft: IDE open source per immagini e video (esempio)", "artcraft-esempio", "publish", "Open Source", 96),
  a(8590, "Windows 11: impostazioni nascoste utili (esempio)", "windows-11-impostazioni", "publish", "Windows", 60),
  a(8780, "Articolo programmato di esempio", "programmato-esempio", "future", "Software", -2),
  a(8781, "Bozza di esempio sui videogiochi", "bozza-videogiochi", "draft", "Videogiochi", 3),
  a(8500, "Articolo cestinato di esempio", "cestinato-esempio", "trash", "Software", 200),
];

/** Istantanea di alcune repository reali, solo per mostrare l'aspetto della pagina. */
export const demoRepos: Repo[] = [
  { name: "CosmoMemo", description: "", language: "TypeScript", isPrivate: false, archived: false, fork: false, pushedAt: "2026-11-09T18:38:09Z", openIssues: 0, url: "https://github.com/CosmoNetinfo/CosmoMemo", homepage: "https://cosmo-memo.vercel.app" },
  { name: "SpesaFacile-landing-page", description: "", language: "JavaScript", isPrivate: false, archived: false, fork: false, pushedAt: "2026-11-09T16:32:03Z", openIssues: 0, url: "https://github.com/CosmoNetinfo/SpesaFacile-landing-page", homepage: "" },
  { name: "ai-background-generator-app", description: "Free AI Background Generator for Windows 10/11", language: "Python", isPrivate: false, archived: false, fork: false, pushedAt: "2026-11-08T22:57:30Z", openIssues: 0, url: "https://github.com/CosmoNetinfo/ai-background-generator-app", homepage: "" },
  { name: "fantalaurea", description: "", language: "TypeScript", isPrivate: false, archived: false, fork: false, pushedAt: "2026-11-06T09:30:51Z", openIssues: 0, url: "https://github.com/CosmoNetinfo/fantalaurea", homepage: "https://fantalaurea.vercel.app" },
  { name: "CosmoKaraoke", description: "", language: "TypeScript", isPrivate: false, archived: false, fork: false, pushedAt: "2026-11-03T04:31:10Z", openIssues: 0, url: "https://github.com/CosmoNetinfo/CosmoKaraoke", homepage: "" },
  { name: "CosmOrganizer", description: "Organizzatore automatico di file per Window", language: "C#", isPrivate: false, archived: false, fork: false, pushedAt: "2026-11-01T13:12:34Z", openIssues: 0, url: "https://github.com/CosmoNetinfo/CosmOrganizer", homepage: "" },
  { name: "MenuGo", description: "", language: "TypeScript", isPrivate: false, archived: false, fork: false, pushedAt: "2026-10-30T00:27:20Z", openIssues: 0, url: "https://github.com/CosmoNetinfo/MenuGo", homepage: "https://menu-go-jet.vercel.app" },
  { name: "Solfege", description: "Gestionale per scuola di musica", language: "TypeScript", isPrivate: false, archived: false, fork: false, pushedAt: "2026-11-03T04:30:31Z", openIssues: 0, url: "https://github.com/CosmoNetinfo/Solfege", homepage: "https://solfege-five.vercel.app" },
];
