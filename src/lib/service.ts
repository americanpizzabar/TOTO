// ------------------------------------------------------------------
// サービス層
//   シードデータ（将来はDB/外部API）とエンジンをつなぎ、
//   ページが必要とする形に整形する。
// ------------------------------------------------------------------

import { buildTicket } from "./betting";
import type { DCParams } from "./dixon-coles";
import { scoreAll, type ScoreSet } from "./metrics";
import { predictMatch } from "./predict";
import type {
  BetMode,
  MatchPrediction,
  ModelId,
  NewsFactor,
  Outcome,
  Round,
  Team,
} from "./types";

export interface Deps {
  teamById: (id: string) => Team | undefined;
  news: NewsFactor[];
  /** Dixon-Coles 推定パラメータ（あればアンサンブル） */
  dc?: DCParams | null;
}

/** 1開催回の全試合を予想する */
export function predictRound(round: Round, model: ModelId, deps: Deps): MatchPrediction[] {
  return round.fixtures.map((fixture) => {
    const home = deps.teamById(fixture.homeTeamId);
    const away = deps.teamById(fixture.awayTeamId);
    if (!home || !away) {
      throw new Error(`未知のチーム: ${fixture.homeTeamId} / ${fixture.awayTeamId}`);
    }
    const relevant = deps.news.filter(
      (n) => n.teamId === home.id || n.teamId === away.id,
    );
    return predictMatch({ fixture, home, away, news: relevant, model, dc: deps.dc });
  });
}

export interface RoundBacktest {
  roundId: string;
  roundNo: number;
  model: ModelId;
  /** 試合単位の的中数 / 総数 */
  correct: number;
  total: number;
  matchAccuracy: number;
  /** 13試合完全的中したか */
  perfect: boolean;
  /** 各試合: 予想pick・実際の結果・的中可否 */
  details: {
    fixtureNo: number;
    pick: Outcome;
    actual: Outcome;
    hit: boolean;
    confidence: number;
    probs: Record<Outcome, number>;
  }[];
}

/** 過去回に対してモデルの的中率を検証 */
export function backtestRound(round: Round, model: ModelId, deps: Deps): RoundBacktest {
  const preds = predictRound(round, model, deps);
  const details = preds
    .map((p) => {
      const fx = round.fixtures.find((f) => f.no === p.fixtureNo)!;
      if (!fx.result) return null;
      return {
        fixtureNo: p.fixtureNo,
        pick: p.pick,
        actual: fx.result,
        hit: p.pick === fx.result,
        confidence: p.confidence,
        probs: p.probabilities,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  const correct = details.filter((d) => d.hit).length;
  const total = details.length;
  return {
    roundId: round.id,
    roundNo: round.no,
    model,
    correct,
    total,
    matchAccuracy: total > 0 ? correct / total : 0,
    perfect: total > 0 && correct === total,
    details,
  };
}

export interface ModelSummary {
  model: ModelId;
  rounds: RoundBacktest[];
  totalCorrect: number;
  totalMatches: number;
  matchAccuracy: number;
  perfectCount: number;
  /** 確率予測の精密さ（RPS/Brier/対数損失/情報利得） */
  scores: ScoreSet;
  /**
   * 参考回収率（サンプル配当による試算）。
   * 実配当データがないため、balancedの買い目が完全的中したら
   * 想定1等配当を得たものとして概算する（あくまで目安）。
   */
  sampleRoi: {
    budgetPerRound: number;
    assumedJackpot: number;
    spent: number;
    returned: number;
    roi: number;
  };
}

const ASSUMED_JACKPOT = 1_000_000; // 想定1等配当（試算用の固定値）
const BUDGET_PER_ROUND = 10_000;

/** 複数の過去回を集計してモデル成績を出す */
export function summarizeModel(pastRounds: Round[], model: ModelId, deps: Deps): ModelSummary {
  const rounds = pastRounds.map((r) => backtestRound(r, model, deps));
  const totalCorrect = rounds.reduce((s, r) => s + r.correct, 0);
  const totalMatches = rounds.reduce((s, r) => s + r.total, 0);
  const perfectCount = rounds.filter((r) => r.perfect).length;
  const scores = scoreAll(
    rounds.flatMap((r) => r.details.map((d) => ({ probs: d.probs, actual: d.actual }))),
  );

  let spent = 0;
  let returned = 0;
  for (const round of pastRounds) {
    const preds = predictRound(round, model, deps);
    const ticket = buildTicket(preds, "balanced", BUDGET_PER_ROUND);
    spent += ticket.cost;
    // 買い目が全試合の実結果をカバーしていれば的中とみなす
    const covered = round.fixtures.every((fx) => {
      if (!fx.result) return false;
      const sel = ticket.selections.find((s) => s.fixtureNo === fx.no);
      return sel?.outcomes.includes(fx.result);
    });
    if (covered) returned += ASSUMED_JACKPOT;
  }

  return {
    model,
    rounds,
    totalCorrect,
    totalMatches,
    matchAccuracy: totalMatches > 0 ? totalCorrect / totalMatches : 0,
    perfectCount,
    scores,
    sampleRoi: {
      budgetPerRound: BUDGET_PER_ROUND,
      assumedJackpot: ASSUMED_JACKPOT,
      spent,
      returned,
      roi: spent > 0 ? (returned - spent) / spent : 0,
    },
  };
}

export const MODELS: { id: ModelId; label: string; description: string }[] = [
  {
    id: "statistical",
    label: "統計モデル",
    description: "Elo・得失点・フォーム・ホーム有利のみ。ニュースは使わない基準モデル。",
  },
  {
    id: "news-weighted",
    label: "ニュース重視モデル",
    description: "統計モデルに怪我・出停・監督交代・疲労などのニュース要因を加味。",
  },
];

export const BET_MODES: { id: BetMode; label: string; description: string }[] = [
  { id: "safe", label: "堅め", description: "カバー率を高くとり的中確率を優先（口数は増える）" },
  { id: "balanced", label: "バランス", description: "的中確率と口数のバランスをとる" },
  { id: "high-payout", label: "高配当狙い", description: "○を絞り当たれば高配当（的中確率は下がる）" },
];
