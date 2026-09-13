// 定期実行: toto公式（またはTOTO_ROUND_JSON）から現在の開催回・対象13試合を
// 取得し、Turso の rounds テーブルへ保存する。以降のページはDBの開催回を表示。
//
// TOTO_SOURCE=toto のときのみ取得（既定は取得せずseedの開催回を使用）。

import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { saveRound } from "@/lib/db";
import { fetchCurrentRound } from "@/lib/provider/toto";
import { getTeams } from "@/lib/teams";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const source = process.env.TOTO_SOURCE || "seed";
  if (source !== "toto") {
    return NextResponse.json({
      ok: true,
      source,
      note: "TOTO_SOURCE=toto を設定し、TOTO_HOLDINGS_URL か TOTO_ROUND_JSON を指定すると開催回を取得します。現在はseedの開催回を使用。",
    });
  }

  try {
    const { teams } = await getTeams();
    const { round, extraTeams } = await fetchCurrentRound(teams);
    if (round.fixtures.length === 0) {
      throw new Error("対象試合を取得できませんでした");
    }
    await saveRound(round, extraTeams, "toto");
    return NextResponse.json({
      ok: true,
      source,
      persisted: process.env.TURSO_DATABASE_URL ? true : false,
      round: { id: round.id, no: round.no, name: round.name, deadlineAt: round.deadlineAt },
      matches: round.fixtures.length,
      unmatchedTeams: extraTeams.map((t) => t.name),
      fixtures: round.fixtures.map((f) => ({ no: f.no, home: f.homeTeamId, away: f.awayTeamId })),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, source, error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
