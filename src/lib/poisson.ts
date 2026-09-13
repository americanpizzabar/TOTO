// ------------------------------------------------------------------
// Poisson / Dixon-Coles による得点確率と 1X2 確率の推定
//
//   両チームの期待得点(λ)から、各スコアの同時確率行列を作る。
//   サッカーは低スコア・引き分けが多いため、Dixon-Coles(1997)の
//   低スコア補正 τ を掛けて 0-0/1-0/0-1/1-1 の確率を調整する。
// ------------------------------------------------------------------

import type { Outcome } from "./types";

/** Poisson確率 P(X = k | λ) */
export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

/**
 * Dixon-Coles の低スコア補正項 τ。
 * rho < 0 で引き分け(1-1,0-0)を増やし、1-0/0-1を減らす方向に働く。
 */
export function dixonColesTau(
  homeGoals: number,
  awayGoals: number,
  lambdaHome: number,
  lambdaAway: number,
  rho: number,
): number {
  if (homeGoals === 0 && awayGoals === 0) return 1 - lambdaHome * lambdaAway * rho;
  if (homeGoals === 0 && awayGoals === 1) return 1 + lambdaHome * rho;
  if (homeGoals === 1 && awayGoals === 0) return 1 + lambdaAway * rho;
  if (homeGoals === 1 && awayGoals === 1) return 1 - rho;
  return 1;
}

/** Jリーグ実測に近い引き分け補正パラメータ */
export const DIXON_COLES_RHO = -0.13;

export interface ScoreMatrixResult {
  /** matrix[h][a] = そのスコアになる確率 */
  matrix: number[][];
  probabilities: Record<Outcome, number>;
  /** 最も起きやすいスコア */
  mostLikelyScore: { home: number; away: number; p: number };
}

/**
 * 期待得点から 1X2 確率とスコア行列を計算する。
 * @param maxGoals 打ち切る最大得点（両チーム）。既定6で十分な精度。
 */
export function scoreMatrix(
  lambdaHome: number,
  lambdaAway: number,
  rho: number = DIXON_COLES_RHO,
  maxGoals = 8,
): ScoreMatrixResult {
  const matrix: number[][] = [];
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  let best = { home: 0, away: 0, p: -1 };
  let total = 0;

  for (let h = 0; h <= maxGoals; h++) {
    matrix[h] = [];
    for (let a = 0; a <= maxGoals; a++) {
      const base = poissonPmf(h, lambdaHome) * poissonPmf(a, lambdaAway);
      const p = base * dixonColesTau(h, a, lambdaHome, lambdaAway, rho);
      matrix[h][a] = p;
      total += p;
      if (h > a) pHome += p;
      else if (h === a) pDraw += p;
      else pAway += p;
      if (p > best.p) best = { home: h, away: a, p };
    }
  }

  // τ補正で確率の総和が厳密に1でなくなるため正規化する
  const norm = total > 0 ? total : 1;
  return {
    matrix,
    probabilities: {
      HOME: pHome / norm,
      DRAW: pDraw / norm,
      AWAY: pAway / norm,
    },
    mostLikelyScore: { home: best.home, away: best.away, p: best.p / norm },
  };
}
