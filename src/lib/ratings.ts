// ------------------------------------------------------------------
// レーティング構築（データソース非依存の純関数）
//
//   確定した試合結果の列から、予想エンジンが必要とする
//   チーム特徴量（Elo・平均得失点・直近フォーム）を計算する。
//   どのデータソース（TheSportsDB等）でも、この形式に整えれば使える。
// ------------------------------------------------------------------

import { eloDelta } from "./elo";
import type { Team } from "./types";

/** 確定した1試合（データソースから正規化した中間形式） */
export interface FinishedMatch {
  date: string; // ISO or YYYY-MM-DD（時系列ソート用）
  homeSlug: string;
  awaySlug: string;
  homeGoals: number;
  awayGoals: number;
}

/** slug→チームの表示情報 */
export interface TeamMeta {
  slug: string;
  name: string;
  shortName: string;
}

const START_ELO = 1500;
const FORM_WINDOW = 5;

interface Acc {
  elo: number;
  goalsFor: number;
  goalsAgainst: number;
  games: number;
  form: ("W" | "D" | "L")[]; // 新しい順に unshift
}

/**
 * 確定試合列からチームのレーティングを構築する。
 * @param matches 確定試合（順不同で可。内部で日付昇順に処理）
 * @param metas   チームの表示情報（slugをキーに）
 * @returns Team[]（試合数0のチームは含めない）
 */
export function buildTeamRatings(matches: FinishedMatch[], metas: TeamMeta[]): Team[] {
  const metaBySlug = new Map(metas.map((m) => [m.slug, m]));
  const acc = new Map<string, Acc>();
  const ensure = (slug: string): Acc => {
    let a = acc.get(slug);
    if (!a) {
      a = { elo: START_ELO, goalsFor: 0, goalsAgainst: 0, games: 0, form: [] };
      acc.set(slug, a);
    }
    return a;
  };

  const ordered = [...matches].sort((x, y) => x.date.localeCompare(y.date));

  for (const m of ordered) {
    if (!metaBySlug.has(m.homeSlug) || !metaBySlug.has(m.awaySlug)) continue;
    if (!Number.isFinite(m.homeGoals) || !Number.isFinite(m.awayGoals)) continue;

    const h = ensure(m.homeSlug);
    const a = ensure(m.awaySlug);

    // ホーム視点の実スコア
    const actual = m.homeGoals > m.awayGoals ? 1 : m.homeGoals === m.awayGoals ? 0.5 : 0;
    const delta = eloDelta(h.elo, a.elo, actual);
    h.elo += delta;
    a.elo -= delta;

    h.goalsFor += m.homeGoals;
    h.goalsAgainst += m.awayGoals;
    a.goalsFor += m.awayGoals;
    a.goalsAgainst += m.homeGoals;
    h.games++;
    a.games++;

    h.form.unshift(actual === 1 ? "W" : actual === 0.5 ? "D" : "L");
    a.form.unshift(actual === 0 ? "W" : actual === 0.5 ? "D" : "L");
    if (h.form.length > FORM_WINDOW) h.form.length = FORM_WINDOW;
    if (a.form.length > FORM_WINDOW) a.form.length = FORM_WINDOW;
  }

  const teams: Team[] = [];
  for (const [slug, a] of acc) {
    if (a.games === 0) continue;
    const meta = metaBySlug.get(slug)!;
    teams.push({
      id: slug,
      name: meta.name,
      shortName: meta.shortName,
      elo: Math.round(a.elo),
      goalsForPerGame: a.goalsFor / a.games,
      goalsAgainstPerGame: a.goalsAgainst / a.games,
      recentForm: a.form,
    });
  }
  return teams;
}
