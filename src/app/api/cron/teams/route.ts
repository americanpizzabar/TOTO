// 定期実行: 実データ(J1の確定結果)からチームのレーティングと
// Dixon-Coles パラメータ(最尤推定)を再構築し、Turso へ保存する。
// 以降のリクエストはDBから読むため、外部APIへの依存をリクエスト経路から切り離せる。
//
// DATA_SOURCE=thesportsdb のときのみ外部取得を行う（既定は取得せずseed維持）。

import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { saveModelParams, saveTeams } from "@/lib/db";
import { fetchJ1Data, mergeRatings } from "@/lib/provider/thesportsdb";
import { fitDixonColes } from "@/lib/dixon-coles";

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
    const { matches, teams } = await fetchJ1Data();
    const merged = mergeRatings(teams);
    await saveTeams(merged, "thesportsdb");

    // Dixon-Coles を最尤推定してパラメータを保存
    const dc = fitDixonColes(matches);
    await saveModelParams("dixon-coles", dc);

    return NextResponse.json({
      ok: true,
      source,
      persisted: process.env.TURSO_DATABASE_URL ? true : false,
      matchesUsed: matches.length,
      teamsSaved: merged.length,
      dixonColes: {
        mu: Number(dc.mu.toFixed(3)),
        home: Number(dc.home.toFixed(3)),
        rho: dc.rho,
        teams: Object.keys(dc.att).length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, source, error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
