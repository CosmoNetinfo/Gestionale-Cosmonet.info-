import { demoRepos } from "./demo";

export interface Repo {
  name: string;
  description: string;
  language: string;
  isPrivate: boolean;
  archived: boolean;
  fork: boolean;
  pushedAt: string;
  openIssues: number;
  url: string;
  homepage: string;
}

export interface ReposResult {
  repos: Repo[];
  demo: boolean;
  note?: string;
}

interface GhRepo {
  name: string;
  description: string | null;
  language: string | null;
  private: boolean;
  archived: boolean;
  fork: boolean;
  pushed_at: string | null;
  open_issues_count: number;
  html_url: string;
  homepage: string | null;
}

/**
 * Legge le repository da GitHub.
 * Con GITHUB_TOKEN (token personale, permesso di sola lettura sui repository) vede anche le private.
 * Senza token, ma con GITHUB_USER, vede solo le pubbliche.
 */
export async function getRepos(): Promise<ReposResult> {
  const token = process.env.GITHUB_TOKEN;
  const user = process.env.GITHUB_USER;

  if (!token && !user) {
    return {
      repos: demoRepos,
      demo: true,
      note: "GitHub non è ancora collegato: manca GITHUB_TOKEN (oppure GITHUB_USER per le sole pubbliche).",
    };
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const endpoint = token
    ? "https://api.github.com/user/repos?affiliation=owner&sort=pushed&per_page=100"
    : `https://api.github.com/users/${encodeURIComponent(user!)}/repos?sort=pushed&per_page=100`;

  try {
    const repos: Repo[] = [];
    for (let page = 1; page <= 10; page++) {
      const res = await fetch(`${endpoint}&page=${page}`, {
        headers,
        next: { revalidate: 300 },
      });
      if (!res.ok) {
        return {
          repos: demoRepos,
          demo: true,
          note: `GitHub ha risposto con errore ${res.status}. Controlla il token.`,
        };
      }
      const batch = (await res.json()) as GhRepo[];
      for (const r of batch) {
        repos.push({
          name: r.name,
          description: r.description ?? "",
          language: r.language ?? "—",
          isPrivate: r.private,
          archived: r.archived,
          fork: r.fork,
          pushedAt: r.pushed_at ?? "",
          openIssues: r.open_issues_count,
          url: r.html_url,
          homepage: r.homepage ?? "",
        });
      }
      if (batch.length < 100) break;
    }
    return { repos, demo: false };
  } catch (e) {
    return {
      repos: demoRepos,
      demo: true,
      note: "Non riesco a raggiungere GitHub: " + (e as Error).message,
    };
  }
}
