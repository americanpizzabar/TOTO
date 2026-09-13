// ------------------------------------------------------------------
// RSS / Atom フィードの取得と最小パース（外部依存なし）
//
//   Jリーグ公式・クラブ公式・スポーツメディア等のフィードから
//   見出しと要約を取り出す。整形はニュース→特徴量の前段。
// ------------------------------------------------------------------

export interface NewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string | null; // ISO or null
}

const TIMEOUT_MS = 12_000;

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ") // 内包タグを除去
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string | null {
  // <name ...>value</name>（属性付きにも対応）
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]) : null;
}

function attrLink(block: string): string | null {
  // Atom: <link href="..."/>
  const m = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  return m ? m[1] : null;
}

function toIso(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** フィード本文（XML）をNewsItem[]にパース */
export function parseFeed(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  // RSS <item> と Atom <entry> の両方に対応
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/\1>/gi) ?? [];
  for (const block of blocks) {
    const title = tag(block, "title");
    if (!title) continue;
    const summary =
      tag(block, "description") ??
      tag(block, "summary") ??
      tag(block, "content") ??
      "";
    const url = tag(block, "link") ?? attrLink(block) ?? "";
    const published = toIso(tag(block, "pubDate") ?? tag(block, "updated") ?? tag(block, "published"));
    items.push({ title, summary, url, source, publishedAt: published });
  }
  return items;
}

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { "user-agent": "toto-predictor-news/1.0 (+https://example.com)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

/** フィードURLのホスト名（source表示用） */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** 1フィードを取得してパース（失敗時は空配列） */
export async function fetchFeed(url: string): Promise<NewsItem[]> {
  try {
    const xml = await fetchText(url);
    return parseFeed(xml, hostOf(url));
  } catch (err) {
    console.error("[news] フィード取得失敗:", url, err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * 複数フィードを並列取得し、URL/タイトルで重複排除、期間で絞り、件数上限を適用。
 */
export async function fetchAllFeeds(
  urls: string[],
  opts: { maxAgeDays?: number; limit?: number } = {},
): Promise<NewsItem[]> {
  const { maxAgeDays = 7, limit = 60 } = opts;
  const lists = await Promise.all(urls.map(fetchFeed));
  const all = lists.flat();

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const it of all) {
    const key = it.url || it.title;
    if (seen.has(key)) continue;
    seen.add(key);
    if (it.publishedAt && new Date(it.publishedAt).getTime() < cutoff) continue;
    out.push(it);
  }
  // 新しい順
  out.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return out.slice(0, limit);
}

/** 既定フィード（Google News のJリーグ検索）。環境変数 NEWS_FEEDS で上書き可能。 */
export function defaultFeeds(): string[] {
  const env = process.env.NEWS_FEEDS;
  if (env) return env.split(",").map((s) => s.trim()).filter(Boolean);
  return [
    "https://news.google.com/rss/search?q=Jリーグ&hl=ja&gl=JP&ceid=JP:ja",
    "https://news.google.com/rss/search?q=Jリーグ+(負傷+OR+出場停止+OR+監督)&hl=ja&gl=JP&ceid=JP:ja",
  ];
}
