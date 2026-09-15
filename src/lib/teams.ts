// ------------------------------------------------------------------
// チームデータのアクセス層
//
//   優先順位:
//     1. Turso の teams テーブル（ingest cron が実データで更新）
//     2. seed の既定値（DB未設定・空・エラー時のフォールバック）
//
//   これにより、リクエスト経路は外部APIに依存せず、
//   実データ接続の有無にかかわらずアプリが動作する。
// ------------------------------------------------------------------

import { loadModelParams, loadNewsFactors, loadTeamsFromDb } from "./db";
import type { DCParams } from "./dixon-coles";
import { getCurrentRound } from "./rounds";
import { NEWS, TEAMS } from "@/data/seed";
import type { NewsFactor, Round, Team } from "./types";

/** ニュース特徴量を取得（DB優先、seedフォールバック） */
export async function getNews(): Promise<{ news: NewsFactor[]; source: "database" | "seed" }> {
  try {
    const fromDb = await loadNewsFactors();
    if (fromDb && fromDb.length > 0) return { news: fromDb, source: "database" };
  } catch (err) {
    console.error("[news] DB読み込み失敗、seedにフォールバック:", err);
  }
  return { news: NEWS, source: "seed" };
}

export interface DataSourceInfo {
  source: "database" | "seed";
}

/**
 * 予想に使うチーム一覧を取得する。
 * DBに実データがあれば seed のロスターにマージして返す（該当チームは上書き、
 * DBに無いチームは seed の値を維持）。これにより、DBが一部チームしか
 * 持たない場合でも全ロスターが揃い、対象試合の描画が壊れない。
 */
export async function getTeams(): Promise<{ teams: Team[]; info: DataSourceInfo }> {
  try {
    const fromDb = await loadTeamsFromDb();
    if (fromDb && fromDb.length > 0) {
      const byId = new Map(fromDb.map((t) => [t.id, t]));
      const seedIds = new Set(TEAMS.map((t) => t.id));
      const merged = TEAMS.map((base) => {
        const d = byId.get(base.id);
        if (!d) return base;
        return {
          ...base,
          elo: d.elo,
          goalsForPerGame: d.goalsForPerGame,
          goalsAgainstPerGame: d.goalsAgainstPerGame,
          recentForm: d.recentForm.length ? d.recentForm : base.recentForm,
        };
      });
      // seed に無いDB専用チームも取り込む
      const dbOnly = fromDb.filter((t) => !seedIds.has(t.id));
      return { teams: [...merged, ...dbOnly], info: { source: "database" } };
    }
  } catch (err) {
    console.error("[teams] DB読み込み失敗、seedにフォールバック:", err);
  }
  return { teams: TEAMS, info: { source: "seed" } };
}

/**
 * 予想サービスに渡す依存（teamById / news / 現在の開催回）。
 * 開催回の未登録チーム(extraTeams)もチームマップに含める。
 */
export async function getDeps(): Promise<{
  teamById: (id: string) => Team | undefined;
  teamMap: Record<string, Team>;
  news: NewsFactor[];
  info: DataSourceInfo;
  round: Round;
  roundSource: "database" | "seed";
  dc: DCParams | null;
}> {
  const [{ teams, info }, { news }, roundInfo, dc] = await Promise.all([
    getTeams(),
    getNews(),
    getCurrentRound(),
    loadModelParams<DCParams>("dixon-coles").catch(() => null),
  ]);
  // 実チームを優先しつつ、開催回の仮チームを補完
  const teamMap = Object.fromEntries(
    [...roundInfo.extraTeams, ...teams].map((t) => [t.id, t]),
  );
  return {
    teamById: (id: string) => teamMap[id],
    teamMap,
    news,
    info,
    round: roundInfo.round,
    roundSource: roundInfo.source,
    dc,
  };
}
