// ------------------------------------------------------------------
// 開催回のアクセス層
//   DBの開催回（発売中を締切ベースで自動選択）を優先し、無ければ
//   seed の既定開催回（SEED_ROUND_INPUTS）から同じロジックで選ぶ。
//   （toto公式の取り込みは /api/cron/rounds が担当）
// ------------------------------------------------------------------

import { loadCurrentRound } from "./db";
import { parseRounds } from "./provider/toto";
import { SEED_ROUND_INPUTS, TEAMS } from "@/data/seed";
import type { Round, Team } from "./types";

/** 発売中の回を選ぶ: 締切が未来のうち最も早く締め切る回。無ければ締切が最新の回。 */
function selectOnSale(rounds: Round[]): Round | null {
  if (rounds.length === 0) return null;
  const now = Date.now();
  const future = rounds
    .filter((r) => new Date(r.deadlineAt).getTime() >= now)
    .sort((a, b) => a.deadlineAt.localeCompare(b.deadlineAt));
  if (future.length > 0) return future[0];
  return [...rounds].sort((a, b) => b.deadlineAt.localeCompare(a.deadlineAt))[0];
}

export async function getCurrentRound(teams: Team[] = TEAMS): Promise<{
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
  // seed 既定（実回。J1以外は仮チームに変換）を締切ベースで選択
  const { rounds, extraTeams } = parseRounds(SEED_ROUND_INPUTS, teams);
  const round = selectOnSale(rounds) ?? rounds[0];
  return { round, extraTeams, source: "seed" };
}
