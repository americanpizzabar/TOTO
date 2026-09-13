// 毎朝: ニュースを収集し、LLMで「チーム別の影響度スコア」に変換して保存する。
// ここはパイプラインの枠のみ。実運用ではRSS/クラブ公式/スポーツメディアを収集し、
// ANTHROPIC_API_KEY を使って要約→特徴量化する。

import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { NEWS } from "@/data/seed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  // TODO(next): ニュース収集 → LLM要約 → NewsFactor化 → news_factors テーブルへ保存
  return NextResponse.json({
    ok: true,
    note: "ニュース収集パイプラインの枠。現状はseedのNewsFactorを使用。",
    sampleFactors: NEWS.length,
  });
}
