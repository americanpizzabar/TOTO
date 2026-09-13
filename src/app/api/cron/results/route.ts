// 試合翌日: 確定した結果を取り込み保存する（→ 成績検証に反映）。
// 実運用ではJリーグ/toto公式から結果を取得する部分。ここではseedの確定分を保存する。

import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { saveResult } from "@/lib/db";
import { PAST_ROUNDS } from "@/data/seed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  let imported = 0;
  for (const round of PAST_ROUNDS) {
    for (const fx of round.fixtures) {
      if (fx.result) {
        await saveResult(round.id, fx.no, fx.result, fx.score ?? undefined);
        imported++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    persisted: process.env.TURSO_DATABASE_URL ? true : false,
    imported,
  });
}
