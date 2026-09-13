// ------------------------------------------------------------------
// 開催回のアクセス層
//   DBの最新開催回を優先し、無ければ seed の開催回にフォールバックする。
//   （toto公式の取り込みは /api/cron/rounds が担当）
// ------------------------------------------------------------------

import { loadCurrentRound } from "./db";
import { CURRENT_ROUND } from "@/data/seed";
import type { Round, Team } from "./types";

export async function getCurrentRound(): Promise<{
  round: Round;
  extraTeams: Team[];
  source: "database" | "seed";
}> {
  try {
    const db = await loadCurrentRound();
    if (db) return { round: db.round, extraTeams: db.extraTeams, source: "database" };
  } catch (err) {
    console.error("[rounds] DB読み込み失敗、seedにフォールバック:", err);
  }
  return { round: CURRENT_ROUND, extraTeams: [], source: "seed" };
}
