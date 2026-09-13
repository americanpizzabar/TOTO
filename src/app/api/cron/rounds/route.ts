// 定期実行: toto公式（またはTOTO_ROUND_JSON）から発売中の開催回・対象試合を
// 取得し、Turso の rounds テーブルへ保存する。同時発売の複数回にも対応。
// 「その日に発売中の回」の自動選択は getCurrentRound()（締切ベース）が担当。
//
// TOTO_SOURCE=toto のときのみ取得（既定は取得せずseedの開催回を使用）。

import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { saveRounds } from "@/lib/db";
import { fetchRounds } from "@/lib/provider/toto";
import { getCurrentRound } from "@/lib/rounds";
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
    const { rounds, extraTeams } = await fetchRounds(teams);
    if (rounds.length === 0) throw new Error("開催回を取得できませんでした");
    await saveRounds(rounds, extraTeams, "toto");

    // 保存後、締切ベースで自動選択される「発売中の回」を確認
    const current = await getCurrentRound();

    return NextResponse.json({
      ok: true,
      source,
      persisted: process.env.TURSO_DATABASE_URL ? true : false,
      savedRounds: rounds.map((r) => ({ no: r.no, name: r.name, deadlineAt: r.deadlineAt })),
      unmatchedTeams: extraTeams.map((t) => t.name),
      selectedNow: { no: current.round.no, name: current.round.name, source: current.source },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, source, error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
