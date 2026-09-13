// ------------------------------------------------------------------
// ニュース → 特徴量（NewsFactor）変換：LLM版（Claude）
//
//   記事の見出し・要約を読み、チーム別の「影響度スコア」に変換する。
//   ANTHROPIC_API_KEY がある場合のみ使用。失敗時は呼び出し側がルール版へ。
// ------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";
import type { NewsFactor, Team } from "../types";
import type { NewsItem } from "./rss";
import { clampFactor } from "./extract";

const KINDS: NewsFactor["kind"][] = [
  "injury",
  "suspension",
  "manager",
  "fatigue",
  "morale",
  "other",
];

function model(): string {
  return process.env.NEWS_LLM_MODEL || "claude-opus-5";
}

function buildPrompt(items: NewsItem[], teams: Team[]): string {
  const roster = teams.map((t) => `- ${t.id}: ${t.name}（${t.shortName}）`).join("\n");
  const articles = items
    .map((it, i) => `[${i + 1}] ${it.title}\n    ${it.summary}\n    出典:${it.source}`)
    .join("\n");
  return `あなたはサッカーのアナリストです。以下のニュース見出しを読み、Jリーグ各チームの「次節への影響度」を数値化してください。勝敗を直接予想するのではなく、特徴量（乗数）に変換します。

# 対象チーム（teamId: 名称）
${roster}

# 乗数の意味とレンジ
- attackMultiplier（攻撃力, 0.70〜1.15, 既定1.0）: 主力FW/攻撃の中心の負傷・出停で下げる。復調・復帰で上げる。
- defenseMultiplier（失点しやすさ, 0.90〜1.30, 既定1.0）: DF/GKの離脱・出停で上げる（失点増方向）。
- varianceMultiplier（波乱度, 1.00〜1.60, 既定1.0）: 監督交代直後や連戦の疲労など、結果が読みにくくなる要因で上げる。
- kind は次のいずれか: ${KINDS.join(", ")}

# ルール
- 対象チームに明確な影響がある記事のみ採用。無関係・影響不明な記事は無視。
- 1チームに複数の要因があれば複数エントリを出してよい。
- teamId は必ず上記リストのものを使う。summary は日本語で簡潔に（根拠として表示）。

# 出力
JSON配列のみを出力（前後に説明文やコードフェンスを付けない）。各要素:
{"teamId": string, "kind": string, "summary": string, "attackMultiplier": number, "defenseMultiplier": number, "varianceMultiplier": number}

# ニュース
${articles}`;
}

/** テキストからJSON配列を頑健に取り出す */
function parseJsonArray(text: string): unknown[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toFactor(raw: any, validIds: Set<string>): NewsFactor | null {
  if (!raw || typeof raw !== "object") return null;
  const teamId = String(raw.teamId ?? "");
  if (!validIds.has(teamId)) return null;
  const kind: NewsFactor["kind"] = KINDS.includes(raw.kind) ? raw.kind : "other";
  return clampFactor({
    teamId,
    summary: String(raw.summary ?? "").slice(0, 200),
    attackMultiplier: Number(raw.attackMultiplier ?? 1),
    defenseMultiplier: Number(raw.defenseMultiplier ?? 1),
    varianceMultiplier: Number(raw.varianceMultiplier ?? 1),
    kind,
  });
}

/** LLMでニュースを特徴量化する（キー未設定なら例外） */
export async function extractByLLM(items: NewsItem[], teams: Team[]): Promise<NewsFactor[]> {
  if (items.length === 0) return [];
  const client = new Anthropic(); // ANTHROPIC_API_KEY をSDKが解決
  const response = await client.messages.create({
    model: model(),
    max_tokens: 4000,
    output_config: { effort: "low" }, // 単純な抽出タスクなので低effortで十分
    messages: [{ role: "user", content: buildPrompt(items, teams) }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const validIds = new Set(teams.map((t) => t.id));
  const factors: NewsFactor[] = [];
  for (const raw of parseJsonArray(text)) {
    const f = toFactor(raw, validIds);
    if (f) factors.push(f);
  }
  return factors;
}
