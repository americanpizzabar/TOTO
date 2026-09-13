// ------------------------------------------------------------------
// Eloレーティング
//   試合結果からレーティングを更新し、勝敗確率の基礎を与える。
// ------------------------------------------------------------------

import type { Outcome } from "./types";

/** ホームアドバンテージ（Elo点換算）。ホーム側に加点して期待勝率を計算する。 */
export const HOME_ADVANTAGE_ELO = 65;

/** レーティング更新係数。大きいほど直近結果を強く反映。 */
export const ELO_K = 24;

/**
 * ホームチームから見た期待勝率（引き分けを0.5として扱うロジスティック期待値）。
 * @param eloHome ホームのElo
 * @param eloAway アウェイのElo
 */
export function expectedScore(eloHome: number, eloAway: number): number {
  const diff = eloAway - (eloHome + HOME_ADVANTAGE_ELO);
  return 1 / (1 + Math.pow(10, diff / 400));
}

/**
 * 試合結果に基づくEloの更新量（ホーム側の増減）。アウェイは符号反転。
 * @param actual ホーム視点の実際のスコア（勝ち=1, 分け=0.5, 負け=0）
 */
export function eloDelta(eloHome: number, eloAway: number, actual: number): number {
  return ELO_K * (actual - expectedScore(eloHome, eloAway));
}

/** 結果(Outcome)をホーム視点スコアに変換 */
export function outcomeToScore(outcome: Outcome): number {
  if (outcome === "HOME") return 1;
  if (outcome === "DRAW") return 0.5;
  return 0;
}
