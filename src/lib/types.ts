// ------------------------------------------------------------------
// ドメイン型定義
// ------------------------------------------------------------------

/** 1X2（ホーム勝ち / 引き分け / アウェイ勝ち） */
export type Outcome = "HOME" | "DRAW" | "AWAY";

/** チームの基礎データ（Eloレーティングと得失点の傾向） */
export interface Team {
  id: string;
  name: string;
  shortName: string;
  /** Eloレーティング（1500基準） */
  elo: number;
  /** 1試合あたり平均得点（攻撃力の素） */
  goalsForPerGame: number;
  /** 1試合あたり平均失点（守備力の素） */
  goalsAgainstPerGame: number;
  /** 直近5試合の結果（新しい順）。W=勝ち D=分け L=負け */
  recentForm: ("W" | "D" | "L")[];
  /** 外部データソース上の表記ゆれ（英語名など）。実データとの名寄せに使う。 */
  sourceNames?: string[];
}

/** ニュースを特徴量に変換したもの（チーム単位の影響度スコア） */
export interface NewsFactor {
  teamId: string;
  /** 記事の要約 / 根拠として表示するテキスト */
  summary: string;
  /** 攻撃力への乗数（1.0=影響なし, <1でマイナス） */
  attackMultiplier: number;
  /** 守備力への乗数（1.0=影響なし, >1で失点増方向） */
  defenseMultiplier: number;
  /**
   * 不確実性（波乱度）への乗数（1.0=影響なし, >1で波乱度を上げる）。
   * 監督交代直後などに使用。
   */
  varianceMultiplier: number;
  /** カテゴリ（表示・集計用） */
  kind: "injury" | "suspension" | "manager" | "fatigue" | "morale" | "other";
}

/** toto対象の1試合 */
export interface Fixture {
  /** toto上の試合番号（1〜13） */
  no: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: string; // ISO8601
  /** 確定した結果（検証用、未確定はnull） */
  result: Outcome | null;
  /** 確定スコア（任意） */
  score?: { home: number; away: number } | null;
}

/** totoの1開催回 */
export interface Round {
  id: string;
  /** 第◯回 */
  no: number;
  name: string;
  deadlineAt: string; // 投票締切 ISO8601
  fixtures: Fixture[];
}

/** 予想の根拠1項目（試合カードに表示） */
export interface ReasonFactor {
  label: string;
  /** ホーム有利(+) / アウェイ有利(-) に寄与した度合い（-1〜+1程度） */
  impact: number;
  detail: string;
}

/** 1試合の予想結果 */
export interface MatchPrediction {
  fixtureNo: number;
  homeTeamId: string;
  awayTeamId: string;
  probabilities: Record<Outcome, number>;
  /** 最有力の結果 */
  pick: Outcome;
  /** 自信度（0〜1）: 最有力の確率の高さ */
  confidence: number;
  /** 波乱度（0〜1）: 1X2分布のエントロピー。高いほど荒れやすい */
  upset: number;
  /** 期待スコア（Poissonのλ） */
  expectedGoals: { home: number; away: number };
  /** 根拠の内訳 */
  reasons: ReasonFactor[];
  /** 適用されたニュース要因 */
  news: NewsFactor[];
}

/** 予想モデルの識別子（成績比較・バックテスト用） */
export type ModelId = "statistical" | "news-weighted";

/** 1試合の買い目（○の付け方） */
export interface MatchSelection {
  fixtureNo: number;
  outcomes: Outcome[]; // 1個=シングル, 2個=ダブル, 3個=トリプル
  /** この試合で選んだ○がカバーする確率の合計 */
  coverage: number;
}

export type BetMode = "safe" | "balanced" | "high-payout";

/** 買い目全体 */
export interface Ticket {
  mode: BetMode;
  selections: MatchSelection[];
  /** 総口数（組み合わせ数） */
  combinations: number;
  /** 想定購入額（円） */
  cost: number;
  /** 全13試合的中する確率（各試合カバー確率の積） */
  hitProbability: number;
}
