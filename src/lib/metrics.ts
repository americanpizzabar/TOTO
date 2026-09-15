// ------------------------------------------------------------------
// 予測評価の指標（確率予測の「精密さ」を数値化）
//
//   1X2 予測は順序（ホーム勝ち → 引分 → アウェイ勝ち）を持つため、
//   サッカー予測の標準である RPS（Ranked Probability Score）を中心に、
//   Brier / 対数損失 / キャリブレーションを算出する。いずれも小さいほど良い。
// ------------------------------------------------------------------

import type { Outcome } from "./types";

const ORDER: Outcome[] = ["HOME", "DRAW", "AWAY"];

function vec(p: Record<Outcome, number>): number[] {
  return ORDER.map((o) => p[o]);
}
function onehot(actual: Outcome): number[] {
  return ORDER.map((o) => (o === actual ? 1 : 0));
}

/** Brier スコア（多クラス）: Σ(p_i - y_i)^2。0〜2、小さいほど良い。 */
export function brier(p: Record<Outcome, number>, actual: Outcome): number {
  const pv = vec(p);
  const yv = onehot(actual);
  return pv.reduce((s, pi, i) => s + (pi - yv[i]) ** 2, 0);
}

/** 対数損失: -log(p[actual])。小さいほど良い。0確率対策にクリップ。 */
export function logLoss(p: Record<Outcome, number>, actual: Outcome): number {
  const pa = Math.min(1, Math.max(1e-12, p[actual]));
  return -Math.log(pa);
}

/**
 * RPS（Ranked Probability Score）: 順序性を考慮した確率スコア。
 * r=3 のとき RPS = (1/(r-1)) Σ_{i=1}^{r-1} (CumPred_i - CumObs_i)^2。0〜1、小さいほど良い。
 */
export function rps(p: Record<Outcome, number>, actual: Outcome): number {
  const pv = vec(p);
  const yv = onehot(actual);
  let cumP = 0;
  let cumY = 0;
  let sum = 0;
  for (let i = 0; i < ORDER.length - 1; i++) {
    cumP += pv[i];
    cumY += yv[i];
    sum += (cumP - cumY) ** 2;
  }
  return sum / (ORDER.length - 1);
}

export interface ScoreSet {
  n: number;
  rps: number;
  brier: number;
  logLoss: number;
  /** 常にホーム本命(0.46/0.27/0.27)で予測した場合のRPS（基準線） */
  baselineRps: number;
  /** 情報利得: 1 - rps/baselineRps（大きいほど基準より良い） */
  skill: number;
}

// Jリーグの概ねの1X2基準率（ホーム勝ち/引分/アウェイ勝ち）
const BASE_RATE: Record<Outcome, number> = { HOME: 0.46, DRAW: 0.27, AWAY: 0.27 };

/** 予測と実結果の配列から各指標の平均を出す */
export function scoreAll(
  items: { probs: Record<Outcome, number>; actual: Outcome }[],
): ScoreSet {
  const n = items.length;
  if (n === 0) {
    return { n: 0, rps: 0, brier: 0, logLoss: 0, baselineRps: 0, skill: 0 };
  }
  let r = 0;
  let b = 0;
  let l = 0;
  let base = 0;
  for (const it of items) {
    r += rps(it.probs, it.actual);
    b += brier(it.probs, it.actual);
    l += logLoss(it.probs, it.actual);
    base += rps(BASE_RATE, it.actual);
  }
  const meanRps = r / n;
  const baselineRps = base / n;
  return {
    n,
    rps: meanRps,
    brier: b / n,
    logLoss: l / n,
    baselineRps,
    skill: baselineRps > 0 ? 1 - meanRps / baselineRps : 0,
  };
}

export interface CalibrationBin {
  lo: number;
  hi: number;
  count: number;
  meanPred: number;
  meanObs: number;
}

/**
 * キャリブレーション: 各予測確率（全outcomeを1点ずつ）を10ビンに分け、
 * 予測確率の平均 vs 実現率を返す。理想は meanPred≈meanObs。
 */
export function calibration(
  items: { probs: Record<Outcome, number>; actual: Outcome }[],
  bins = 10,
): CalibrationBin[] {
  const acc = Array.from({ length: bins }, (_, i) => ({
    lo: i / bins,
    hi: (i + 1) / bins,
    sumPred: 0,
    sumObs: 0,
    count: 0,
  }));
  for (const it of items) {
    for (const o of ORDER) {
      const ppred = it.probs[o];
      const obs = it.actual === o ? 1 : 0;
      let idx = Math.floor(ppred * bins);
      if (idx >= bins) idx = bins - 1;
      if (idx < 0) idx = 0;
      acc[idx].sumPred += ppred;
      acc[idx].sumObs += obs;
      acc[idx].count += 1;
    }
  }
  return acc.map((a) => ({
    lo: a.lo,
    hi: a.hi,
    count: a.count,
    meanPred: a.count ? a.sumPred / a.count : 0,
    meanObs: a.count ? a.sumObs / a.count : 0,
  }));
}
