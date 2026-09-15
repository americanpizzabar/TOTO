// ------------------------------------------------------------------
// 開催回の的中数分布（ポアソン二項分布の厳密計算）
//
//   各試合の「当たる確率」が異なる独立試行の合計（当たり数）の分布は
//   ポアソン二項分布になる。動的計画法で厳密に畳み込むため、モンテカルロ
//   より正確。予想pickの的中数分布や、買い目のカバー数分布に使う。
// ------------------------------------------------------------------

/** 各試行の成功確率から、成功数 k=0..n の確率質量 P(k) を厳密計算 */
export function poissonBinomialPmf(probs: number[]): number[] {
  let pmf = [1]; // 0件成功=1
  for (const p of probs) {
    const next = new Array(pmf.length + 1).fill(0);
    for (let k = 0; k < pmf.length; k++) {
      next[k] += pmf[k] * (1 - p);
      next[k + 1] += pmf[k] * p;
    }
    pmf = next;
  }
  return pmf;
}

export interface CountDistribution {
  n: number;
  pmf: number[]; // P(k) for k=0..n
  expected: number; // 期待成功数 = Σp
  /** atLeast[k] = P(成功数 >= k) */
  atLeast: number[];
  mostLikely: number; // 最頻の成功数
}

export function countDistribution(probs: number[]): CountDistribution {
  const n = probs.length;
  const pmf = poissonBinomialPmf(probs);
  const expected = probs.reduce((s, p) => s + p, 0);
  const atLeast = new Array(n + 1).fill(0);
  let acc = 0;
  for (let k = n; k >= 0; k--) {
    acc += pmf[k];
    atLeast[k] = acc;
  }
  let mostLikely = 0;
  for (let k = 1; k <= n; k++) if (pmf[k] > pmf[mostLikely]) mostLikely = k;
  return { n, pmf, expected, atLeast, mostLikely };
}
