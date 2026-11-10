/** Catalogo fonti RSS (le stesse 42 dell'app keyword-researcher, verificate il 3 novembre 2026). */
export interface Feed { url: string; name: string; cat: string; lang: "it" | "en" }

export const CATEGORIE: Record<string, string> = {
  "tech-it": "Tech italiano",
  linux: "Linux",
  ai: "Intelligenza artificiale",
  gaming: "Gaming",
  selfhosted: "Self-hosting",
  "tech-en": "Tech internazionale",
};

export const FEEDS: Feed[] = [
  { cat: "tech-it", name: "HDBlog", url: "https://www.hdblog.it/rss/", lang: "it" },
  { cat: "tech-it", name: "Tom's HW Italia", url: "https://www.tomshw.it/feed/", lang: "it" },
  { cat: "tech-it", name: "Punto Informatico", url: "https://www.punto-informatico.it/feed/", lang: "it" },
  { cat: "tech-it", name: "HTML.it", url: "https://www.html.it/feed/", lang: "it" },
  { cat: "tech-it", name: "IlSoftware", url: "https://www.ilsoftware.it/feed/", lang: "it" },
  { cat: "tech-it", name: "Navigaweb", url: "https://www.navigaweb.net/feeds/posts/default", lang: "it" },
  { cat: "tech-it", name: "SmartWorld", url: "https://www.smartworld.it/feed/", lang: "it" },
  { cat: "tech-it", name: "Wired Italy", url: "https://www.wired.it/feed/", lang: "it" },
  { cat: "linux", name: "MiaMammaUsaLinux", url: "https://www.miamammausalinux.org/feed/", lang: "it" },
  { cat: "linux", name: "It's FOSS", url: "https://feed.itsfoss.com/", lang: "en" },
  { cat: "linux", name: "9to5Linux", url: "https://9to5linux.com/feed/", lang: "en" },
  { cat: "linux", name: "OMG! Ubuntu", url: "https://www.omgubuntu.co.uk/feed", lang: "en" },
  { cat: "linux", name: "Phoronix", url: "https://www.phoronix.com/rss.php", lang: "en" },
  { cat: "linux", name: "Linuxiac", url: "https://linuxiac.com/feed/", lang: "en" },
  { cat: "linux", name: "Linux Today", url: "https://www.linuxtoday.com/feed/", lang: "en" },
  { cat: "linux", name: "Linux Mint Blog", url: "https://blog.linuxmint.com/?feed=rss2", lang: "en" },
  { cat: "linux", name: "KDE Blogs", url: "https://blogs.kde.org/index.xml", lang: "en" },
  { cat: "linux", name: "Ubuntu Blog", url: "https://ubuntu.com/blog/feed", lang: "en" },
  { cat: "linux", name: "Fedora Magazine", url: "https://fedoramagazine.org/feed/", lang: "en" },
  { cat: "ai", name: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml", lang: "en" },
  { cat: "ai", name: "OpenAI News", url: "https://openai.com/news/rss.xml", lang: "en" },
  { cat: "ai", name: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml", lang: "en" },
  { cat: "ai", name: "Google AI Blog", url: "https://blog.google/technology/ai/rss/", lang: "en" },
  { cat: "ai", name: "Microsoft Research", url: "https://www.microsoft.com/en-us/research/feed/", lang: "en" },
  { cat: "ai", name: "NVIDIA Blog", url: "https://blogs.nvidia.com/feed/", lang: "en" },
  { cat: "ai", name: "Simon Willison", url: "https://simonwillison.net/atom/everything/", lang: "en" },
  { cat: "ai", name: "MarkTechPost", url: "https://www.marktechpost.com/feed/", lang: "en" },
  { cat: "ai", name: "IA Italia", url: "https://www.intelligenzaartificialeitalia.net/?feed=rss2", lang: "it" },
  { cat: "gaming", name: "GamingOnLinux", url: "https://www.gamingonlinux.com/article_rss.php", lang: "en" },
  { cat: "gaming", name: "Steam Deck HQ", url: "https://steamdeckhq.com/feed/", lang: "en" },
  { cat: "selfhosted", name: "Docker Blog", url: "https://www.docker.com/blog/feed/", lang: "en" },
  { cat: "selfhosted", name: "n8n Blog", url: "https://blog.n8n.io/rss/", lang: "en" },
  { cat: "selfhosted", name: "Home Assistant", url: "https://www.home-assistant.io/atom.xml", lang: "en" },
  { cat: "selfhosted", name: "selfh.st", url: "https://selfh.st/rss/", lang: "en" },
  { cat: "selfhosted", name: "Jellyfin", url: "https://jellyfin.org/posts/rss.xml", lang: "en" },
  { cat: "tech-en", name: "Hacker News", url: "https://news.ycombinator.com/rss", lang: "en" },
  { cat: "tech-en", name: "GitHub Blog", url: "https://github.blog/feed/", lang: "en" },
  { cat: "tech-en", name: "BleepingComputer", url: "https://www.bleepingcomputer.com/feed/", lang: "en" },
  { cat: "tech-en", name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews", lang: "en" },
  { cat: "tech-en", name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/", lang: "en" },
  { cat: "tech-en", name: "Windows Latest", url: "https://www.windowslatest.com/feed/", lang: "en" },
  { cat: "tech-en", name: "PowerToys (release)", url: "https://github.com/microsoft/PowerToys/releases.atom", lang: "en" },
  { cat: "tech-en", name: "Ollama (release)", url: "https://github.com/ollama/ollama/releases.atom", lang: "en" },
  { cat: "tech-en", name: "ComfyUI (release)", url: "https://github.com/Comfy-Org/ComfyUI/releases.atom", lang: "en" },
];

/** Nome leggibile di una categoria (quelle importate da OPML possono essere nuove). */
export function catLabel(cat: string): string {
  return CATEGORIE[cat] ?? cat.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());
}
