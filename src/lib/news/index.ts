// ------------------------------------------------------------------
// ニュース収集オーケストレーション
//
//   フィード取得 → 特徴量化（LLM優先・ルールベースにフォールバック）。
//   結果は /api/cron/news がDBへ保存し、予想エンジンが参照する。
// ------------------------------------------------------------------

import type { NewsFactor, Team } from "../types";
import { defaultFeeds, fetchAllFeeds, type NewsItem } from "./rss";
import { extractByRules } from "./extract";
import { extractByLLM } from "./extract-llm";

export interface CollectResult {
  factors: NewsFactor[];
  meta: {
    feeds: number;
    itemsCollected: number;
    method: "llm" | "rules";
    llmError?: string;
  };
}

function useLlm(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.NEWS_USE_LLM !== "0";
}

/** ニュースを収集し特徴量化する */
export async function collectNewsFactors(teams: Team[]): Promise<CollectResult> {
  const feeds = defaultFeeds();
  const maxAgeDays = Number(process.env.NEWS_MAX_AGE_DAYS) || 7;
  const items: NewsItem[] = await fetchAllFeeds(feeds, { maxAgeDays, limit: 60 });

  let method: "llm" | "rules" = "rules";
  let llmError: string | undefined;
  let factors: NewsFactor[] = [];

  if (useLlm()) {
    try {
      factors = await extractByLLM(items, teams);
      method = "llm";
    } catch (err) {
      llmError = err instanceof Error ? err.message : String(err);
      factors = extractByRules(items, teams);
      method = "rules";
    }
  } else {
    factors = extractByRules(items, teams);
  }

  return {
    factors,
    meta: { feeds: feeds.length, itemsCollected: items.length, method, llmError },
  };
}
