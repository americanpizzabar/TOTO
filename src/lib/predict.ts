// ------------------------------------------------------------------
// 予想エンジン
//
//   特徴量 → 期待得点(λ) → Poisson/Dixon-Coles → 1X2確率
//   の流れで各試合を予想し、根拠・自信度・波乱度を付与する。
//
//   特徴量:
//     - Eloレーティング（実力）
//     - 攻撃力 / 守備力（平均得失点ベース）
//     - ホームアドバンテージ
//     - 直近5試合のフォーム
//     - ニュース要因（怪我・出場停止・監督交代・疲労）※news-weightedモデルのみ
// ------------------------------------------------------------------

import { HOME_ADVANTAGE_ELO } from "./elo";
import { scoreMatrix } from "./poisson";
import type {
  Fixture,
  MatchPrediction,
  ModelId,
  NewsFactor,
  Outcome,
  ReasonFactor,
  Team,
} from "./types";

/** リーグ平均の1チーム1試合あたり得点（Jリーグ想定） */
export const LEAGUE_AVG_GOALS = 1.35;

/** ホームは攻撃が伸び、アウェイは抑えられる係数 */
const HOME_ATTACK_BOOST = 1.12;
const AWAY_ATTACK_DAMP = 0.9;

/** Eloの実力差を期待得点にどれだけ反映するか */
const ELO_TILT_K = 0.35;

/** 直近フォームの反映度 */
const FORM_WEIGHT = 0.12;

/** λの下限・上限（非現実的な値を防ぐ） */
const LAMBDA_MIN = 0.15;
const LAMBDA_MAX = 4.5;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** 直近5試合の勝点（W=3,D=1,L=0）を -1〜+1 の調子指数に変換 */
export function formIndex(form: Team["recentForm"]): number {
  if (form.length === 0) return 0;
  const pts = form.reduce((s, r) => s + (r === "W" ? 3 : r === "D" ? 1 : 0), 0);
  const max = form.length * 3;
  // 中央値(平均的な勝点)を0に合わせる
  const mid = max / 2;
  return clamp((pts - mid) / mid, -1, 1);
}

/** チームのニュース要因を1つに集約（乗数は積、要約は配列で保持） */
function aggregateNews(factors: NewsFactor[]) {
  return factors.reduce(
    (acc, f) => ({
      attack: acc.attack * f.attackMultiplier,
      defense: acc.defense * f.defenseMultiplier,
      variance: acc.variance * f.varianceMultiplier,
    }),
    { attack: 1, defense: 1, variance: 1 },
  );
}

/** 1X2分布を不確実性(mix)に応じて一様分布へ近づける（波乱度の反映） */
function widen(probs: Record<Outcome, number>, mix: number): Record<Outcome, number> {
  const m = clamp(mix, 0, 0.6);
  return {
    HOME: probs.HOME * (1 - m) + (1 / 3) * m,
    DRAW: probs.DRAW * (1 - m) + (1 / 3) * m,
    AWAY: probs.AWAY * (1 - m) + (1 / 3) * m,
  };
}

/** 正規化エントロピー（0=確実, 1=完全に五分）→ 波乱度 */
function normalizedEntropy(probs: Record<Outcome, number>): number {
  const ps = [probs.HOME, probs.DRAW, probs.AWAY].filter((p) => p > 0);
  const h = -ps.reduce((s, p) => s + p * Math.log(p), 0);
  return clamp(h / Math.log(3), 0, 1);
}

export interface PredictInput {
  fixture: Fixture;
  home: Team;
  away: Team;
  news: NewsFactor[]; // この試合の両チームに関するニュース
  model: ModelId;
}

/** 1試合を予想する */
export function predictMatch(input: PredictInput): MatchPrediction {
  const { fixture, home, away, news, model } = input;
  const useNews = model === "news-weighted";

  const homeNews = useNews ? news.filter((n) => n.teamId === home.id) : [];
  const awayNews = useNews ? news.filter((n) => n.teamId === away.id) : [];
  const homeAgg = aggregateNews(homeNews);
  const awayAgg = aggregateNews(awayNews);

  // --- 攻撃力 / 守備力（平均得失点ベース） ---
  const homeAttack = home.goalsForPerGame / LEAGUE_AVG_GOALS;
  const homeDefense = home.goalsAgainstPerGame / LEAGUE_AVG_GOALS;
  const awayAttack = away.goalsForPerGame / LEAGUE_AVG_GOALS;
  const awayDefense = away.goalsAgainstPerGame / LEAGUE_AVG_GOALS;

  // --- Eloの実力差を期待得点に反映（ホーム有利分を加味） ---
  const eloTilt = Math.exp(
    (ELO_TILT_K * (home.elo + HOME_ADVANTAGE_ELO - away.elo)) / 400,
  );

  // --- フォーム ---
  const homeForm = 1 + FORM_WEIGHT * formIndex(home.recentForm);
  const awayForm = 1 + FORM_WEIGHT * formIndex(away.recentForm);

  // --- 期待得点 λ の合成 ---
  // ホーム攻撃 × アウェイ守備 × ホーム補正 × Elo × フォーム × ニュース
  let lambdaHome =
    LEAGUE_AVG_GOALS *
    homeAttack *
    awayDefense *
    HOME_ATTACK_BOOST *
    eloTilt *
    homeForm *
    homeAgg.attack *
    awayAgg.defense; // 相手守備が乱れると自分の得点が増える

  let lambdaAway =
    LEAGUE_AVG_GOALS *
    awayAttack *
    homeDefense *
    AWAY_ATTACK_DAMP *
    (1 / eloTilt) *
    awayForm *
    awayAgg.attack *
    homeAgg.defense;

  lambdaHome = clamp(lambdaHome, LAMBDA_MIN, LAMBDA_MAX);
  lambdaAway = clamp(lambdaAway, LAMBDA_MIN, LAMBDA_MAX);

  // --- 1X2確率 ---
  const sm = scoreMatrix(lambdaHome, lambdaAway);
  let probabilities = sm.probabilities;

  // --- 監督交代などの不確実性で分布を広げる（波乱度） ---
  const varianceMix = (homeAgg.variance - 1) * 0.5 + (awayAgg.variance - 1) * 0.5;
  if (varianceMix > 0) probabilities = widen(probabilities, varianceMix);

  // --- pick / 自信度 / 波乱度 ---
  const entries = Object.entries(probabilities) as [Outcome, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const pick = entries[0][0];
  const confidence = entries[0][1];
  const upset = normalizedEntropy(probabilities);

  // --- 根拠の内訳（ホーム有利を + とする impact） ---
  const reasons: ReasonFactor[] = [];
  const eloDiff = Math.round(home.elo - away.elo);
  reasons.push({
    label: "Eloレーティング差",
    impact: clamp(eloDiff / 300, -1, 1),
    detail: `${home.shortName} ${Math.round(home.elo)} vs ${away.shortName} ${Math.round(
      away.elo,
    )}（差${eloDiff >= 0 ? "+" : ""}${eloDiff}）`,
  });
  reasons.push({
    label: "ホームアドバンテージ",
    impact: 0.2,
    detail: `ホーム${home.shortName}に+${HOME_ADVANTAGE_ELO}点相当を加味`,
  });
  reasons.push({
    label: "攻撃力・守備力",
    impact: clamp((homeAttack - awayAttack) * 0.5 + (awayDefense - homeDefense) * 0.5, -1, 1),
    detail: `得点力 ${home.goalsForPerGame.toFixed(2)}/${away.goalsForPerGame.toFixed(
      2,
    )}、失点 ${home.goalsAgainstPerGame.toFixed(2)}/${away.goalsAgainstPerGame.toFixed(2)}（試合平均）`,
  });
  const formImpact = clamp(formIndex(home.recentForm) * 0.5 - formIndex(away.recentForm) * 0.5, -1, 1);
  reasons.push({
    label: "直近5試合の調子",
    impact: formImpact,
    detail: `${home.shortName}: ${home.recentForm.join("") || "-"} / ${away.shortName}: ${
      away.recentForm.join("") || "-"
    }`,
  });
  for (const n of [...homeNews, ...awayNews]) {
    const forHome = n.teamId === home.id;
    // 攻撃減 or 守備悪化 or 波乱増 を影響度に変換
    const strength =
      (1 - n.attackMultiplier) + (n.defenseMultiplier - 1) + (n.varianceMultiplier - 1) * 0.5;
    reasons.push({
      label: `ニュース: ${newsKindLabel(n.kind)}（${forHome ? home.shortName : away.shortName}）`,
      // そのチームにマイナス材料ならホーム/アウェイどちらに不利か符号付け
      impact: clamp((forHome ? -strength : strength), -1, 1),
      detail: n.summary,
    });
  }

  return {
    fixtureNo: fixture.no,
    homeTeamId: home.id,
    awayTeamId: away.id,
    probabilities,
    pick,
    confidence,
    upset,
    expectedGoals: { home: lambdaHome, away: lambdaAway },
    reasons,
    news: [...homeNews, ...awayNews],
  };
}

export function newsKindLabel(kind: NewsFactor["kind"]): string {
  switch (kind) {
    case "injury":
      return "主力の怪我";
    case "suspension":
      return "出場停止";
    case "manager":
      return "監督交代";
    case "fatigue":
      return "連戦の疲労";
    case "morale":
      return "チーム状態";
    default:
      return "その他";
  }
}
