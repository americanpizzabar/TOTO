// 定期実行: 実データ(J1の確定結果)からチームのレーティングを再構築し、
// Turso の teams テーブルへ保存する。以降のリクエストはDBから読むため、
// 外部APIへの依存をリクエスト経路から切り離せる。
//
// DATA_SOURCE=thesportsdb のときのみ外部取得を行う（既定は取得せずseed維持）。

import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { saveTeams } from "@/lib/db";
import { fetchJ1Ratings, mergeRatings } from "@/lib/provider/thesportsdb";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const source = process.env.DATA_SOURCE || "seed";
  if (source !== "thesportsdb") {
    return NextResponse.json({
      ok: true,
      source,
      note: "DATA_SOURCE=thesportsdb を設定すると実データを取得します。現在はseedを使用。",
    });
  }

  try {
    const fetched = await fetchJ1Ratings();
    const merged = mergeRatings(fetched);
    await saveTeams(merged, "thesportsdb");
    return NextResponse.json({
      ok: true,
      source,
      persisted: process.env.TURSO_DATABASE_URL ? true : false,
      teamsFetched: fetched.length,
      teamsSaved: merged.length,
      sample: fetched.slice(0, 3).map((t) => ({
        id: t.id,
        elo: t.elo,
        gf: Number(t.goalsForPerGame.toFixed(2)),
        ga: Number(t.goalsAgainstPerGame.toFixed(2)),
        form: t.recentForm.join(""),
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, source, error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
