// 毎朝: ニュースを収集し、LLM（またはルールベース）で
// 「チーム別の影響度スコア(NewsFactor)」に変換して保存する。
//
// NEWS_SOURCE=feeds のときのみ収集を実行（既定は収集せずseedのNewsFactorを使用）。
// LLMは ANTHROPIC_API_KEY があるときのみ使用し、無ければルールベースで抽出。

import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { replaceNewsFactors } from "@/lib/db";
import { collectNewsFactors } from "@/lib/news";
import { getTeams } from "@/lib/teams";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const source = process.env.NEWS_SOURCE || "seed";
  if (source !== "feeds") {
    return NextResponse.json({
      ok: true,
      source,
      note: "NEWS_SOURCE=feeds を設定するとニュースを収集します。現在はseedのNewsFactorを使用。",
    });
  }

  try {
    const { teams } = await getTeams();
    const { factors, meta } = await collectNewsFactors(teams);
    await replaceNewsFactors(factors);
    return NextResponse.json({
      ok: true,
      source,
      persisted: process.env.TURSO_DATABASE_URL ? true : false,
      factors: factors.length,
      byTeam: factors.reduce<Record<string, number>>((acc, f) => {
        acc[f.teamId] = (acc[f.teamId] ?? 0) + 1;
        return acc;
      }, {}),
      meta,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, source, error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
