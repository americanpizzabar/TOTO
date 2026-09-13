// ------------------------------------------------------------------
// 実データプロバイダ: TheSportsDB（無料・キー任意）
//
//   Jリーグ(J1)の確定結果を取得し、ratings.ts でチーム特徴量を構築する。
//   ※このセッションのサンドボックスは外部ホストへの接続がネットワーク
//     ポリシーで遮断されるため、実行はVercel等の本番環境を想定。
//     ローカル/サンドボックスでは seed にフォールバックする。
//
//   環境変数:
//     THESPORTSDB_KEY      APIキー（既定 "3"。無料テストキー）
//     THESPORTSDB_LEAGUE   リーグ名（既定 "Japanese J1 League"）
//     THESPORTSDB_SEASONS  シーズン（カンマ区切り。既定は直近2年）
// ------------------------------------------------------------------

import { buildTeamRatings, type FinishedMatch, type TeamMeta } from "../ratings";
import { TEAMS } from "@/data/seed";
import type { Team } from "../types";

const BASE = "https://www.thesportsdb.com/api/v1/json";
const TIMEOUT_MS = 12_000;

function key(): string {
  return process.env.THESPORTSDB_KEY || "3";
}

function leagueName(): string {
  return process.env.THESPORTSDB_LEAGUE || "Japanese J1 League";
}

function seasons(): string[] {
  const env = process.env.THESPORTSDB_SEASONS;
  if (env) return env.split(",").map((s) => s.trim()).filter(Boolean);
  const y = new Date().getFullYear();
  return [String(y), String(y - 1)];
}

async function fetchJson(url: string): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/** 名寄せ用の正規化（記号・空白除去、小文字化） */
function norm(s: string): string {
  return s.toLowerCase().replace(/[.\-_'’]/g, "").replace(/\s+/g, " ").trim();
}

/** seed から「ソース表記 → slug」の対応表を作る */
function buildNameIndex(): Map<string, string> {
  const idx = new Map<string, string>();
  for (const t of TEAMS) {
    idx.set(norm(t.name), t.id);
    for (const alias of t.sourceNames ?? []) idx.set(norm(alias), t.id);
  }
  return idx;
}

/** リーグ名から idLeague を解決（ハードコードを避ける） */
async function resolveLeagueId(): Promise<string | null> {
  const data = await fetchJson(
    `${BASE}/${key()}/search_all_leagues.php?c=Japan&s=Soccer`,
  );
  const list: any[] = data?.countries ?? data?.leagues ?? [];
  const want = norm(leagueName());
  const hit =
    list.find((l) => norm(l.strLeague ?? "") === want) ??
    list.find((l) => norm(l.strLeague ?? "").includes("j1"));
  return hit?.idLeague ?? null;
}

/** 1シーズン分の確定試合を取得 */
async function fetchSeasonMatches(
  leagueId: string,
  season: string,
  nameIdx: Map<string, string>,
): Promise<FinishedMatch[]> {
  const data = await fetchJson(
    `${BASE}/${key()}/eventsseason.php?id=${leagueId}&s=${encodeURIComponent(season)}`,
  );
  const events: any[] = data?.events ?? [];
  const out: FinishedMatch[] = [];
  for (const e of events) {
    const hs = e.intHomeScore;
    const as = e.intAwayScore;
    if (hs == null || as == null) continue; // 未消化
    const homeSlug = nameIdx.get(norm(e.strHomeTeam ?? ""));
    const awaySlug = nameIdx.get(norm(e.strAwayTeam ?? ""));
    if (!homeSlug || !awaySlug) continue; // 未マッチ（対象外チーム）
    out.push({
      date: e.dateEvent ?? e.strTimestamp ?? season,
      homeSlug,
      awaySlug,
      homeGoals: Number(hs),
      awayGoals: Number(as),
    });
  }
  return out;
}

/**
 * TheSportsDB から J1 のチーム特徴量を構築する。
 * @returns 確定結果から算出した Team[]（seed の表示情報にマージ済み）
 */
export async function fetchJ1Ratings(): Promise<Team[]> {
  const nameIdx = buildNameIndex();
  const leagueId = await resolveLeagueId();
  if (!leagueId) throw new Error("リーグIDを解決できませんでした");

  const all: FinishedMatch[] = [];
  for (const s of seasons()) {
    try {
      all.push(...(await fetchSeasonMatches(leagueId, s, nameIdx)));
    } catch {
      // 一部シーズンの取得失敗は無視して続行
    }
  }
  if (all.length === 0) throw new Error("確定試合を取得できませんでした");

  const metas: TeamMeta[] = TEAMS.map((t) => ({
    slug: t.id,
    name: t.name,
    shortName: t.shortName,
  }));
  return buildTeamRatings(all, metas);
}

/**
 * 実データのレーティングを seed 既定値にマージする。
 * 取得できたチームは上書き、取得できなかったチームは seed のまま。
 */
export function mergeRatings(fetched: Team[]): Team[] {
  const byId = new Map(fetched.map((t) => [t.id, t]));
  return TEAMS.map((base) => {
    const f = byId.get(base.id);
    if (!f) return base;
    return {
      ...base,
      elo: f.elo,
      goalsForPerGame: f.goalsForPerGame,
      goalsAgainstPerGame: f.goalsAgainstPerGame,
      recentForm: f.recentForm.length ? f.recentForm : base.recentForm,
    };
  });
}
