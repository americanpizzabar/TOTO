// ------------------------------------------------------------------
// シードデータ（デモ用）
//
//   外部データソース（Jリーグデータサイト / toto公式）に接続するまで、
//   このデータでアプリの全サイクルが動くようにする。
//   ※レーティング・数値はデモ用の近似値であり公式記録ではありません。
//
//   実データ接続時は、この層を差し替えるだけで上位のエンジン/UIは不変。
// ------------------------------------------------------------------

import type { NewsFactor, Round, Team } from "@/lib/types";
import type { TotoRoundInput } from "@/lib/provider/toto";

export const TEAMS: Team[] = [
  { id: "kobe", name: "ヴィッセル神戸", shortName: "神戸", elo: 1618, goalsForPerGame: 1.6, goalsAgainstPerGame: 0.9, recentForm: ["W", "W", "D", "W", "L"], sourceNames: ["Vissel Kobe"] },
  { id: "hiroshima", name: "サンフレッチェ広島", shortName: "広島", elo: 1602, goalsForPerGame: 1.55, goalsAgainstPerGame: 0.85, recentForm: ["W", "D", "W", "W", "D"], sourceNames: ["Sanfrecce Hiroshima"] },
  { id: "machida", name: "FC町田ゼルビア", shortName: "町田", elo: 1575, goalsForPerGame: 1.4, goalsAgainstPerGame: 0.95, recentForm: ["W", "L", "W", "D", "W"], sourceNames: ["Machida Zelvia", "FC Machida Zelvia"] },
  { id: "gamba", name: "ガンバ大阪", shortName: "G大阪", elo: 1560, goalsForPerGame: 1.5, goalsAgainstPerGame: 1.1, recentForm: ["D", "W", "W", "L", "W"], sourceNames: ["Gamba Osaka"] },
  { id: "kashima", name: "鹿島アントラーズ", shortName: "鹿島", elo: 1558, goalsForPerGame: 1.45, goalsAgainstPerGame: 1.05, recentForm: ["W", "D", "L", "W", "D"], sourceNames: ["Kashima Antlers"] },
  { id: "cosaka", name: "セレッソ大阪", shortName: "C大阪", elo: 1540, goalsForPerGame: 1.35, goalsAgainstPerGame: 1.1, recentForm: ["D", "D", "W", "L", "W"], sourceNames: ["Cerezo Osaka"] },
  { id: "tokyov", name: "東京ヴェルディ", shortName: "東京V", elo: 1520, goalsForPerGame: 1.1, goalsAgainstPerGame: 1.0, recentForm: ["D", "L", "D", "W", "D"], sourceNames: ["Tokyo Verdy"] },
  { id: "fctokyo", name: "FC東京", shortName: "FC東京", elo: 1515, goalsForPerGame: 1.3, goalsAgainstPerGame: 1.2, recentForm: ["L", "W", "D", "D", "L"], sourceNames: ["FC Tokyo"] },
  { id: "nagoya", name: "名古屋グランパス", shortName: "名古屋", elo: 1512, goalsForPerGame: 1.2, goalsAgainstPerGame: 1.1, recentForm: ["W", "L", "D", "L", "W"], sourceNames: ["Nagoya Grampus"] },
  { id: "urawa", name: "浦和レッズ", shortName: "浦和", elo: 1508, goalsForPerGame: 1.25, goalsAgainstPerGame: 1.15, recentForm: ["L", "D", "L", "W", "D"], sourceNames: ["Urawa Red Diamonds", "Urawa Reds"] },
  { id: "marinos", name: "横浜F・マリノス", shortName: "横浜FM", elo: 1552, goalsForPerGame: 1.5, goalsAgainstPerGame: 1.15, recentForm: ["W", "W", "L", "D", "W"], sourceNames: ["Yokohama F. Marinos", "Yokohama F Marinos", "Yokohama Marinos"] },
  { id: "fukuoka", name: "アビスパ福岡", shortName: "福岡", elo: 1495, goalsForPerGame: 1.05, goalsAgainstPerGame: 1.05, recentForm: ["D", "L", "W", "D", "L"], sourceNames: ["Avispa Fukuoka"] },
  { id: "kyoto", name: "京都サンガF.C.", shortName: "京都", elo: 1490, goalsForPerGame: 1.25, goalsAgainstPerGame: 1.25, recentForm: ["W", "L", "L", "D", "W"], sourceNames: ["Kyoto Sanga", "Kyoto Sanga FC"] },
  { id: "niigata", name: "アルビレックス新潟", shortName: "新潟", elo: 1485, goalsForPerGame: 1.15, goalsAgainstPerGame: 1.2, recentForm: ["D", "D", "L", "D", "L"], sourceNames: ["Albirex Niigata"] },
  { id: "iwata", name: "ジュビロ磐田", shortName: "磐田", elo: 1460, goalsForPerGame: 1.1, goalsAgainstPerGame: 1.4, recentForm: ["L", "L", "D", "L", "D"], sourceNames: ["Jubilo Iwata"] },
  { id: "kashiwa", name: "柏レイソル", shortName: "柏", elo: 1500, goalsForPerGame: 1.3, goalsAgainstPerGame: 1.2, recentForm: ["W", "D", "W", "L", "D"], sourceNames: ["Kashiwa Reysol"] },
  { id: "sapporo", name: "北海道コンサドーレ札幌", shortName: "札幌", elo: 1455, goalsForPerGame: 1.2, goalsAgainstPerGame: 1.5, recentForm: ["L", "L", "W", "L", "D"], sourceNames: ["Consadole Sapporo", "Hokkaido Consadole Sapporo"] },
  { id: "tosu", name: "サガン鳥栖", shortName: "鳥栖", elo: 1470, goalsForPerGame: 1.1, goalsAgainstPerGame: 1.3, recentForm: ["L", "D", "L", "D", "W"], sourceNames: ["Sagan Tosu"] },
  { id: "kawasaki", name: "川崎フロンターレ", shortName: "川崎F", elo: 1548, goalsForPerGame: 1.55, goalsAgainstPerGame: 1.1, recentForm: ["W", "L", "W", "W", "D"], sourceNames: ["Kawasaki Frontale"] },
  { id: "shonan", name: "湘南ベルマーレ", shortName: "湘南", elo: 1462, goalsForPerGame: 1.15, goalsAgainstPerGame: 1.35, recentForm: ["D", "L", "D", "L", "W"], sourceNames: ["Shonan Bellmare"] },
];

export const TEAM_BY_ID: Record<string, Team> = Object.fromEntries(
  TEAMS.map((t) => [t.id, t]),
);

// ------------------------------------------------------------------
// ニュース → 特徴量（チーム別の影響度スコア）
//   実運用ではLLMで記事を要約し自動生成する部分。ここは手動サンプル。
// ------------------------------------------------------------------
export const NEWS: NewsFactor[] = [
  {
    teamId: "kobe",
    summary: "主力FWが軽度の負傷で先発が微妙。攻撃力をやや割り引く。",
    attackMultiplier: 0.9,
    defenseMultiplier: 1.0,
    varianceMultiplier: 1.0,
    kind: "injury",
  },
  {
    teamId: "urawa",
    summary: "監督交代直後。戦術がまだ固まらず結果が読みにくい（波乱度↑）。",
    attackMultiplier: 1.0,
    defenseMultiplier: 1.0,
    varianceMultiplier: 1.3,
    kind: "manager",
  },
  {
    teamId: "kawasaki",
    summary: "ACL遠征帰りで中2日。疲労を考慮しやや割り引き、波乱度も上げる。",
    attackMultiplier: 0.94,
    defenseMultiplier: 1.05,
    varianceMultiplier: 1.1,
    kind: "fatigue",
  },
  {
    teamId: "hiroshima",
    summary: "CBが累積警告で出場停止。守備の安定度を割り引く。",
    attackMultiplier: 1.0,
    defenseMultiplier: 1.12,
    varianceMultiplier: 1.0,
    kind: "suspension",
  },
  {
    teamId: "machida",
    summary: "連勝でチーム状態は良好。攻撃をわずかに上方修正。",
    attackMultiplier: 1.05,
    defenseMultiplier: 0.98,
    varianceMultiplier: 1.0,
    kind: "morale",
  },
];

// ------------------------------------------------------------------
// 開催回データ
// ------------------------------------------------------------------

const daysFromNow = (d: number, hour = 14) => {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() + d);
  t.setUTCHours(hour, 0, 0, 0);
  return t.toISOString();
};

/**
 * 現在の開催回（既定/フォールバック）。
 *   toto公式ページはJS描画(SPA)で自動取得が難しいため、既定値として実回を保持する。
 *   チーム名で表現し（J1以外は仮チームに自動変換）、getCurrentRound() が
 *   parseRounds() を通して Round に変換・締切で自動選択する。
 *   ライブ取得(TOTO_SOURCE=toto)やTOTO_ROUND_JSONを設定すればそちらが優先。
 *
 *   ※更新方法: 新しい回になったら下記の no / deadlineAt / matches を差し替える。
 */
export const SEED_ROUND_INPUTS: TotoRoundInput[] = [
  {
    no: 1654,
    name: "第1654回 toto",
    deadlineAt: "2026-09-19T08:50:00Z", // 2026/09/19 17:50 JST
    matches: [
      { no: 1, home: "福岡", away: "広島", kickoffAt: "2026-09-19T05:00:00Z" },
      { no: 2, home: "浦和", away: "東京V", kickoffAt: "2026-09-19T05:00:00Z" },
      { no: 3, home: "清水", away: "千葉", kickoffAt: "2026-09-19T05:00:00Z" },
      { no: 4, home: "岡山", away: "京都", kickoffAt: "2026-09-19T05:00:00Z" },
      { no: 5, home: "FC東京", away: "名古屋", kickoffAt: "2026-09-19T05:00:00Z" },
      { no: 6, home: "長崎", away: "C大阪", kickoffAt: "2026-09-19T05:00:00Z" },
      { no: 7, home: "横浜FM", away: "水戸", kickoffAt: "2026-09-19T05:00:00Z" },
      { no: 8, home: "町田", away: "柏", kickoffAt: "2026-09-20T05:00:00Z" },
      { no: 9, home: "G大阪", away: "神戸", kickoffAt: "2026-09-20T05:00:00Z" },
      { no: 10, home: "山形", away: "富山", kickoffAt: "2026-09-19T05:00:00Z" },
      { no: 11, home: "藤枝", away: "大宮", kickoffAt: "2026-09-19T05:00:00Z" },
      { no: 12, home: "新潟", away: "磐田", kickoffAt: "2026-09-19T05:00:00Z" },
      { no: 13, home: "甲府", away: "徳島", kickoffAt: "2026-09-19T05:00:00Z" },
    ],
  },
];

/** 過去回（結果確定済み）— 成績検証・バックテスト用 */
export const PAST_ROUNDS: Round[] = [
  {
    id: "round-1499",
    no: 1499,
    name: "第1499回 toto",
    deadlineAt: daysFromNow(-7, 3),
    fixtures: [
      { no: 1, homeTeamId: "kobe", awayTeamId: "sapporo", kickoffAt: daysFromNow(-7), result: "HOME", score: { home: 2, away: 0 } },
      { no: 2, homeTeamId: "hiroshima", awayTeamId: "iwata", kickoffAt: daysFromNow(-7), result: "HOME", score: { home: 3, away: 1 } },
      { no: 3, homeTeamId: "machida", awayTeamId: "tosu", kickoffAt: daysFromNow(-7), result: "DRAW", score: { home: 1, away: 1 } },
      { no: 4, homeTeamId: "gamba", awayTeamId: "fukuoka", kickoffAt: daysFromNow(-7), result: "HOME", score: { home: 2, away: 1 } },
      { no: 5, homeTeamId: "kashima", awayTeamId: "shonan", kickoffAt: daysFromNow(-7), result: "AWAY", score: { home: 0, away: 1 } },
      { no: 6, homeTeamId: "cosaka", awayTeamId: "nagoya", kickoffAt: daysFromNow(-7), result: "DRAW", score: { home: 1, away: 1 } },
      { no: 7, homeTeamId: "marinos", awayTeamId: "fctokyo", kickoffAt: daysFromNow(-7), result: "HOME", score: { home: 2, away: 1 } },
      { no: 8, homeTeamId: "tokyov", awayTeamId: "kyoto", kickoffAt: daysFromNow(-7), result: "DRAW", score: { home: 0, away: 0 } },
      { no: 9, homeTeamId: "kashiwa", awayTeamId: "niigata", kickoffAt: daysFromNow(-7), result: "HOME", score: { home: 2, away: 0 } },
      { no: 10, homeTeamId: "urawa", awayTeamId: "kawasaki", kickoffAt: daysFromNow(-7), result: "AWAY", score: { home: 1, away: 2 } },
      { no: 11, homeTeamId: "nagoya", awayTeamId: "kobe", kickoffAt: daysFromNow(-7), result: "AWAY", score: { home: 0, away: 2 } },
      { no: 12, homeTeamId: "kyoto", awayTeamId: "gamba", kickoffAt: daysFromNow(-7), result: "DRAW", score: { home: 1, away: 1 } },
      { no: 13, homeTeamId: "sapporo", awayTeamId: "hiroshima", kickoffAt: daysFromNow(-7), result: "AWAY", score: { home: 1, away: 3 } },
    ],
  },
  {
    id: "round-1498",
    no: 1498,
    name: "第1498回 toto",
    deadlineAt: daysFromNow(-14, 3),
    fixtures: [
      { no: 1, homeTeamId: "kawasaki", awayTeamId: "iwata", kickoffAt: daysFromNow(-14), result: "HOME", score: { home: 3, away: 0 } },
      { no: 2, homeTeamId: "kobe", awayTeamId: "fukuoka", kickoffAt: daysFromNow(-14), result: "HOME", score: { home: 2, away: 0 } },
      { no: 3, homeTeamId: "hiroshima", awayTeamId: "tosu", kickoffAt: daysFromNow(-14), result: "DRAW", score: { home: 1, away: 1 } },
      { no: 4, homeTeamId: "machida", awayTeamId: "shonan", kickoffAt: daysFromNow(-14), result: "HOME", score: { home: 1, away: 0 } },
      { no: 5, homeTeamId: "gamba", awayTeamId: "sapporo", kickoffAt: daysFromNow(-14), result: "HOME", score: { home: 3, away: 1 } },
      { no: 6, homeTeamId: "kashima", awayTeamId: "niigata", kickoffAt: daysFromNow(-14), result: "HOME", score: { home: 2, away: 1 } },
      { no: 7, homeTeamId: "cosaka", awayTeamId: "kyoto", kickoffAt: daysFromNow(-14), result: "AWAY", score: { home: 1, away: 2 } },
      { no: 8, homeTeamId: "marinos", awayTeamId: "tokyov", kickoffAt: daysFromNow(-14), result: "DRAW", score: { home: 2, away: 2 } },
      { no: 9, homeTeamId: "fctokyo", awayTeamId: "nagoya", kickoffAt: daysFromNow(-14), result: "HOME", score: { home: 1, away: 0 } },
      { no: 10, homeTeamId: "urawa", awayTeamId: "kashiwa", kickoffAt: daysFromNow(-14), result: "DRAW", score: { home: 1, away: 1 } },
      { no: 11, homeTeamId: "kyoto", awayTeamId: "hiroshima", kickoffAt: daysFromNow(-14), result: "AWAY", score: { home: 0, away: 2 } },
      { no: 12, homeTeamId: "nagoya", awayTeamId: "kawasaki", kickoffAt: daysFromNow(-14), result: "AWAY", score: { home: 1, away: 2 } },
      { no: 13, homeTeamId: "sapporo", awayTeamId: "kobe", kickoffAt: daysFromNow(-14), result: "AWAY", score: { home: 0, away: 1 } },
    ],
  },
];

export const ALL_ROUNDS: Round[] = [...PAST_ROUNDS];

export function getRound(id: string): Round | undefined {
  return ALL_ROUNDS.find((r) => r.id === id);
}
