// ------------------------------------------------------------------
// 買い目生成
//
//   各試合の確率から ○ の付け方（シングル/ダブル/トリプル）を決め、
//   予算内で「全13試合的中の確率」を最大化する。
//
//   モード:
//     safe        堅め   … カバー率を高くとり的中確率を優先
//     balanced    バランス
//     high-payout 高配当狙い … ○を絞り、当たれば高配当
//
//   totoは全13試合的中で1等。1枚(1組)=100円。
// ------------------------------------------------------------------

import type { BetMode, MatchPrediction, MatchSelection, Outcome, Ticket } from "./types";

const UNIT_PRICE = 100;

interface ModeConfig {
  /** 各試合で最低限確保したいカバー率 */
  coverageFloor: number;
  /** 余った予算で○を増やして的中率を高めるか */
  spendSurplus: boolean;
  /** モード独自の口数上限（予算より優先して締める） */
  maxCombosCap: number;
}

const MODE_CONFIG: Record<BetMode, ModeConfig> = {
  safe: { coverageFloor: 0.85, spendSurplus: true, maxCombosCap: 20000 },
  balanced: { coverageFloor: 0.72, spendSurplus: true, maxCombosCap: 2000 },
  "high-payout": { coverageFloor: 0.5, spendSurplus: false, maxCombosCap: 64 },
};

/** 確率降順に並べた結果配列 */
function rankedOutcomes(p: Record<Outcome, number>): { outcome: Outcome; p: number }[] {
  return (Object.entries(p) as [Outcome, number][])
    .map(([outcome, prob]) => ({ outcome, p: prob }))
    .sort((a, b) => b.p - a.p);
}

/** 上位k個のカバー率 */
function coverageOf(ranked: { p: number }[], k: number): number {
  let s = 0;
  for (let i = 0; i < k; i++) s += ranked[i].p;
  return s;
}

function productOf(marks: number[]): number {
  return marks.reduce((a, b) => a * b, 1);
}

/**
 * 買い目を生成する。
 * @param predictions 13試合の予想
 * @param mode モード
 * @param budgetYen 予算（円）。0以下なら予算制約なし。
 */
export function buildTicket(
  predictions: MatchPrediction[],
  mode: BetMode,
  budgetYen: number,
): Ticket {
  const cfg = MODE_CONFIG[mode];
  const rankedAll = predictions.map((p) => rankedOutcomes(p.probabilities));

  // 予算とモード上限の小さい方を口数上限に
  const budgetCombos = budgetYen > 0 ? Math.floor(budgetYen / UNIT_PRICE) : Infinity;
  const maxCombos = Math.max(1, Math.min(budgetCombos, cfg.maxCombosCap));

  // 1) カバー率フロアを満たすまで○を付ける
  const marks = rankedAll.map((r) => {
    let k = 1;
    while (k < 3 && coverageOf(r, k) < cfg.coverageFloor) k++;
    return k;
  });

  // 2) 口数が上限超過なら、外しても的中率低下が最小の○から外す
  while (productOf(marks) > maxCombos) {
    let bestIdx = -1;
    let smallestLoss = Infinity;
    for (let i = 0; i < marks.length; i++) {
      if (marks[i] <= 1) continue;
      const covNow = coverageOf(rankedAll[i], marks[i]);
      const covLess = coverageOf(rankedAll[i], marks[i] - 1);
      // 外したときのカバー率低下（比の減少）。小さいものを優先して外す。
      const loss = 1 - covLess / covNow;
      if (loss < smallestLoss) {
        smallestLoss = loss;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break; // これ以上外せない
    marks[bestIdx]--;
  }

  // 3) 予算に余りがあり、モードが許すなら、的中率の伸びが大きい○を追加
  if (cfg.spendSurplus) {
    let combos = productOf(marks);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let bestIdx = -1;
      let bestGain = 0;
      for (let i = 0; i < marks.length; i++) {
        if (marks[i] >= 3) continue;
        const newCombos = (combos / marks[i]) * (marks[i] + 1);
        if (newCombos > maxCombos) continue;
        const covNow = coverageOf(rankedAll[i], marks[i]);
        const covMore = coverageOf(rankedAll[i], marks[i] + 1);
        // 追加コスト(口数倍率)あたりのカバー率上昇
        const gain = (covMore / covNow - 1) / (marks[i] + 1) / marks[i];
        if (gain > bestGain) {
          bestGain = gain;
          bestIdx = i;
        }
      }
      if (bestIdx === -1) break;
      marks[bestIdx]++;
      combos = productOf(marks);
    }
  }

  // 4) 仕上げ
  const selections: MatchSelection[] = predictions.map((p, i) => {
    const r = rankedAll[i];
    const k = marks[i];
    return {
      fixtureNo: p.fixtureNo,
      outcomes: r.slice(0, k).map((o) => o.outcome),
      coverage: coverageOf(r, k),
    };
  });

  const combinations = productOf(marks);
  const hitProbability = selections.reduce((acc, s) => acc * s.coverage, 1);

  return {
    mode,
    selections,
    combinations,
    cost: combinations * UNIT_PRICE,
    hitProbability,
  };
}
