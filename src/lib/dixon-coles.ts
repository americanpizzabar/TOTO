// ------------------------------------------------------------------
// Dixon-Coles モデル（最尤推定によるフィッティング）
//
//   サッカー1X2予測の定番・最高峰の統計手法。過去の全結果から、
//   チームごとの攻撃力(att)・守備力(def)、ホームアドバンテージ(home)、
//   低スコア補正(rho)、リーグ得点水準(mu) を最尤推定する。
//   直近試合を重視する指数時間減衰つき。
//
//     log λ_home = mu + home + att[h] - def[a]
//     log λ_away = mu +        att[a] - def[h]
//
//   実装方針:
//     - att/def/mu/home は Poisson 重み付き対数尤度の解析勾配で勾配上昇
//       （L2正則化＝少数サンプルの縮約＆識別可能性の確保）
//     - rho は att/def 固定のもとで完全尤度(τ補正込み)を1次元探索
//
//   データ源に依存しない純関数。TheSportsDB等の実結果(FinishedMatch)を入れれば
//   本格的な推定になり、データが無ければ att=def=0（リーグ平均）に縮約される。
// ------------------------------------------------------------------

import { dixonColesTau, poissonPmf, scoreMatrix } from "./poisson";
import type { FinishedMatch } from "./ratings";
import type { Outcome } from "./types";

export interface DCParams {
  mu: number;
  home: number;
  rho: number;
  att: Record<string, number>;
  def: Record<string, number>;
  /** フィットに使った試合数と実効重み */
  n: number;
}

export interface FitOptions {
  /** 時間減衰率（1日あたり）。0で減衰なし。既定 ~ 半減期230日 */
  xi?: number;
  /** L2正則化係数（縮約の強さ）。大きいほど平均へ寄せる */
  reg?: number;
  /** 勾配上昇の反復回数 */
  iters?: number;
  /** 学習率 */
  lr?: number;
}

const DEFAULTS: Required<FitOptions> = {
  xi: 0.003,
  reg: 0.05,
  iters: 600,
  lr: 0.6,
};

function ageDaysFrom(latest: number, date: string): number {
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (latest - t) / (1000 * 60 * 60 * 24));
}

/** 過去結果から Dixon-Coles パラメータを最尤推定 */
export function fitDixonColes(matches: FinishedMatch[], opts: FitOptions = {}): DCParams {
  const o = { ...DEFAULTS, ...opts };
  const valid = matches.filter(
    (m) => Number.isFinite(m.homeGoals) && Number.isFinite(m.awayGoals) && m.homeSlug && m.awaySlug,
  );

  const teams = Array.from(new Set(valid.flatMap((m) => [m.homeSlug, m.awaySlug])));
  const att: Record<string, number> = {};
  const def: Record<string, number> = {};
  for (const t of teams) {
    att[t] = 0;
    def[t] = 0;
  }

  if (valid.length === 0) {
    return { mu: Math.log(1.3), home: 0.2, rho: -0.1, att, def, n: 0 };
  }

  const latest = Math.max(...valid.map((m) => new Date(m.date).getTime() || 0));
  const weights = valid.map((m) => Math.exp(-o.xi * ageDaysFrom(latest, m.date)));
  const W = weights.reduce((s, w) => s + w, 0);

  // 初期値
  const totalGoals = valid.reduce((s, m) => s + m.homeGoals + m.awayGoals, 0);
  let mu = Math.log(Math.max(0.2, totalGoals / (2 * valid.length)));
  let home = 0.2;

  // --- 勾配上昇（Poisson重み付き対数尤度 + L2） ---
  for (let iter = 0; iter < o.iters; iter++) {
    let gmu = 0;
    let ghome = 0;
    const gatt: Record<string, number> = {};
    const gdef: Record<string, number> = {};
    for (const t of teams) {
      gatt[t] = 0;
      gdef[t] = 0;
    }
    for (let i = 0; i < valid.length; i++) {
      const m = valid[i];
      const w = weights[i];
      const lh = Math.exp(mu + home + att[m.homeSlug] - def[m.awaySlug]);
      const la = Math.exp(mu + att[m.awaySlug] - def[m.homeSlug]);
      const rh = w * (m.homeGoals - lh);
      const ra = w * (m.awayGoals - la);
      gmu += rh + ra;
      ghome += rh;
      gatt[m.homeSlug] += rh;
      gatt[m.awaySlug] += ra;
      gdef[m.awaySlug] -= rh;
      gdef[m.homeSlug] -= ra;
    }
    // L2 正則化（att/def のみ）
    for (const t of teams) {
      gatt[t] -= 2 * o.reg * att[t] * W;
      gdef[t] -= 2 * o.reg * def[t] * W;
    }
    const step = o.lr / W;
    mu += step * gmu;
    home += step * ghome;
    for (const t of teams) {
      att[t] += step * gatt[t];
      def[t] += step * gdef[t];
    }
  }

  // 識別可能性のため att/def を平均0に中心化（水準は mu/home で吸収）
  centerZero(att);
  centerZero(def);

  // att/def を固定し、mu と home を厳密に再推定（総得点の一致で閉形式）
  //   Σ hg = e^{mu+home} Σ e^{att_h - def_a},  Σ ag = e^{mu} Σ e^{att_a - def_h}
  let Sh = 0, Sa = 0, Ghome = 0, Gaway = 0;
  for (let i = 0; i < valid.length; i++) {
    const m = valid[i];
    const w = weights[i];
    Sh += w * Math.exp(att[m.homeSlug] - def[m.awaySlug]);
    Sa += w * Math.exp(att[m.awaySlug] - def[m.homeSlug]);
    Ghome += w * m.homeGoals;
    Gaway += w * m.awayGoals;
  }
  if (Sa > 0 && Gaway > 0) mu = Math.log(Gaway / Sa);
  if (Sh > 0 && Ghome > 0) home = Math.log(Ghome / Sh) - mu;

  // --- rho を完全尤度で1次元探索（att/def/mu/home 固定） ---
  const rho = fitRho(valid, weights, att, def, mu, home);

  return { mu, home, rho, att, def, n: valid.length };
}

function centerZero(m: Record<string, number>): void {
  const keys = Object.keys(m);
  if (keys.length === 0) return;
  const mean = keys.reduce((s, k) => s + m[k], 0) / keys.length;
  for (const k of keys) m[k] -= mean;
}

function fitRho(
  matches: FinishedMatch[],
  weights: number[],
  att: Record<string, number>,
  def: Record<string, number>,
  mu: number,
  home: number,
): number {
  let best = -0.1;
  let bestLL = -Infinity;
  for (let rho = -0.25; rho <= 0.051; rho += 0.01) {
    let ll = 0;
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const w = weights[i];
      const lh = Math.exp(mu + home + (att[m.homeSlug] ?? 0) - (def[m.awaySlug] ?? 0));
      const la = Math.exp(mu + (att[m.awaySlug] ?? 0) - (def[m.homeSlug] ?? 0));
      const tau = dixonColesTau(m.homeGoals, m.awayGoals, lh, la, rho);
      if (tau <= 0) {
        ll += w * -20; // 無効領域を強くペナルティ
        continue;
      }
      ll += w * Math.log(tau);
    }
    if (ll > bestLL) {
      bestLL = ll;
      best = rho;
    }
  }
  return Math.round(best * 100) / 100;
}

/** フィット済みパラメータで1試合の1X2確率と期待得点を出す（未知チームはリーグ平均） */
export function predictDC(
  params: DCParams,
  homeId: string,
  awayId: string,
): { probabilities: Record<Outcome, number>; lambda: { home: number; away: number } } {
  const ah = params.att[homeId] ?? 0;
  const aa = params.att[awayId] ?? 0;
  const dh = params.def[homeId] ?? 0;
  const da = params.def[awayId] ?? 0;
  const lh = Math.exp(params.mu + params.home + ah - da);
  const la = Math.exp(params.mu + aa - dh);
  const sm = scoreMatrix(lh, la, params.rho);
  return { probabilities: sm.probabilities, lambda: { home: lh, away: la } };
}

/** 参考: 単一試合の対数尤度（デバッグ/評価用） */
export function matchLogLik(params: DCParams, m: FinishedMatch): number {
  const lh = Math.exp(params.mu + params.home + (params.att[m.homeSlug] ?? 0) - (params.def[m.awaySlug] ?? 0));
  const la = Math.exp(params.mu + (params.att[m.awaySlug] ?? 0) - (params.def[m.homeSlug] ?? 0));
  const tau = Math.max(1e-9, dixonColesTau(m.homeGoals, m.awayGoals, lh, la, params.rho));
  return (
    Math.log(Math.max(1e-12, poissonPmf(m.homeGoals, lh))) +
    Math.log(Math.max(1e-12, poissonPmf(m.awayGoals, la))) +
    Math.log(tau)
  );
}
