// 試合前日: 現在受付中の回を予想し直してDBへ保存する。
// Vercel Cron から呼ばれる想定（vercel.json 参照）。

import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { savePredictions } from "@/lib/db";
import { predictRound } from "@/lib/service";
import { getDeps } from "@/lib/teams";
import type { ModelId } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const deps = await getDeps();
  const round = deps.round;
  const models: ModelId[] = ["statistical", "news-weighted"];
  const summary: Record<string, number> = {};

  for (const model of models) {
    const preds = predictRound(round, model, deps);
    await savePredictions(round.id, model, preds);
    summary[model] = preds.length;
  }

  return NextResponse.json({
    ok: true,
    round: round.id,
    roundSource: deps.roundSource,
    persisted: process.env.TURSO_DATABASE_URL ? true : false,
    predicted: summary,
  });
}
