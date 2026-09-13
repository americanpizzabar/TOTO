// ------------------------------------------------------------------
// 実データプロバイダ: toto開催回（対象13試合）
//
//   「どの開催回で、どの13試合が対象か」は toto公式が決めるもので公開APIが
//   ないため、以下のいずれかから取り込む:
//     1. TOTO_ROUND_JSON     … 開催回JSONを直接指定（最も確実な上書き手段）
//     2. TOTO_HOLDINGS_URL   … 取得先URL。JSONならそのまま、HTMLならベストエフォート解析
//
//   J1以外(J2/J3/海外)など未登録チームは、中立レーティングの仮チームを生成して
//   表示・予想が壊れないようにする（extraTeams として返す）。
//
//   ※このサンドボックスは外部ホストへの接続が遮断されるため、実際の取得は
//     Vercel等の本番環境を想定。ローカル/失敗時は seed 開催回にフォールバック。
// ------------------------------------------------------------------

import { LEAGUE_AVG_GOALS } from "../predict";
import type { Fixture, Round, Team } from "../types";
import { buildNameIndex, normalizeName } from "./names";

const TIMEOUT_MS = 12_000;

/** 取り込み用の開催回の入力形式（JSON） */
export interface TotoRoundInput {
  no: number;
  name?: string;
  deadlineAt?: string;
  matches: { no?: number; home: string; away: string; kickoffAt?: string }[];
}

export interface RoundResult {
  round: Round;
  /** 未登録チーム（中立レーティングの仮チーム） */
  extraTeams: Team[];
}

function daysFromNow(d: number, hour = 5): string {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() + d);
  t.setUTCHours(hour, 0, 0, 0);
  return t.toISOString();
}

/** 未登録チーム名から中立の仮チームを作る */
function syntheticTeam(rawName: string): Team {
  const name = rawName.trim();
  return {
    id: `ext-${normalizeName(name)}`,
    name,
    shortName: name.length <= 4 ? name : name.slice(0, 4),
    elo: 1500,
    goalsForPerGame: LEAGUE_AVG_GOALS,
    goalsAgainstPerGame: LEAGUE_AVG_GOALS,
    recentForm: [],
    sourceNames: [name],
  };
}

/** 入力JSONを Round + extraTeams に変換（チーム名→slug名寄せ） */
export function parseRoundInput(input: TotoRoundInput, teams: Team[]): RoundResult {
  const idx = buildNameIndex(teams);
  const extra = new Map<string, Team>();

  const resolve = (rawName: string): string => {
    const key = normalizeName(rawName);
    const hit = idx.get(key);
    if (hit) return hit;
    const syn = syntheticTeam(rawName);
    extra.set(syn.id, syn);
    // 生成した仮チームも索引に足し、同名の再解決で重複生成しない
    idx.set(key, syn.id);
    return syn.id;
  };

  const fixtures: Fixture[] = input.matches.map((m, i) => ({
    no: m.no ?? i + 1,
    homeTeamId: resolve(m.home),
    awayTeamId: resolve(m.away),
    kickoffAt: m.kickoffAt ?? daysFromNow(2, 5),
    result: null,
  }));

  const round: Round = {
    id: `round-${input.no}`,
    no: input.no,
    name: input.name ?? `第${input.no}回 toto`,
    deadlineAt: input.deadlineAt ?? daysFromNow(2, 5),
    fixtures,
  };

  return { round, extraTeams: [...extra.values()] };
}

// ------------------------------------------------------------------
// HTML ベストエフォート解析
//   toto公式のHTML構造は変わりうるため、代表的なパターンを試みる。
//   確実性が必要な場合は TOTO_ROUND_JSON を使う。
// ------------------------------------------------------------------

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** HTMLから開催回番号を抽出 */
function extractRoundNo(html: string): number | null {
  const m = html.match(/第\s*([0-9０-９,，]+)\s*回/);
  if (!m) return null;
  const digits = m[1].normalize("NFKC").replace(/[,，]/g, "");
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/**
 * HTMLから対戦カードを抽出（ベストエフォート）。
 * "ホーム vs アウェイ" / "ホーム 対 アウェイ" / テーブル行の2チーム名を拾う。
 */
function extractMatches(html: string, teams: Team[]): TotoRoundInput["matches"] {
  const idx = buildNameIndex(teams);
  const text = stripTags(html);
  const matches: TotoRoundInput["matches"] = [];

  // "A vs B" / "A 対 B" パターン
  const re = /([一-龥ぁ-んァ-ヶA-Za-z0-9Ａ-Ｚａ-ｚ０-９・\.]{2,12})\s*(?:vs|VS|ｖｓ|対|-)\s*([一-龥ぁ-んァ-ヶA-Za-z0-9Ａ-Ｚａ-ｚ０-９・\.]{2,12})/g;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(text)) !== null) {
    const home = m[1].trim();
    const away = m[2].trim();
    // 少なくとも一方が既知チームに当たる組だけ採用（誤検出を抑制）
    const known = idx.has(normalizeName(home)) || idx.has(normalizeName(away));
    if (!known) continue;
    const key = `${home}|${away}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({ no: matches.length + 1, home, away });
    if (matches.length >= 13) break;
  }
  return matches;
}

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { "user-agent": "toto-predictor/1.0 (+https://example.com)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export interface RoundsResult {
  rounds: Round[];
  extraTeams: Team[];
}

/** JSON（開催回オブジェクト or その配列）を TotoRoundInput[] に整える */
function coerceInputs(data: unknown): TotoRoundInput[] {
  const arr = Array.isArray(data) ? data : [data];
  return arr.filter(
    (d): d is TotoRoundInput =>
      !!d &&
      typeof (d as TotoRoundInput).no === "number" &&
      Array.isArray((d as TotoRoundInput).matches),
  );
}

function parseMaybeJsonInputs(text: string): TotoRoundInput[] | null {
  try {
    const inputs = coerceInputs(JSON.parse(text));
    return inputs.length ? inputs : null;
  } catch {
    return null;
  }
}

/** 複数の開催回入力をまとめて Round[] + extraTeams に変換 */
export function parseRounds(inputs: TotoRoundInput[], teams: Team[]): RoundsResult {
  const extra = new Map<string, Team>();
  const rounds: Round[] = [];
  for (const input of inputs) {
    const { round, extraTeams } = parseRoundInput(input, teams);
    rounds.push(round);
    for (const t of extraTeams) extra.set(t.id, t);
  }
  return { rounds, extraTeams: [...extra.values()] };
}

/**
 * その日に発売している開催回を取得する（複数同時発売にも対応）。
 * JSON上書き優先 → URL取得（JSON配列/単体） → HTML解析（ベストエフォート・単体）。
 * 「どれが発売中か」は締切日時にもとづき getCurrentRound() が自動選択する。
 */
export async function fetchRounds(teams: Team[]): Promise<RoundsResult> {
  const override = process.env.TOTO_ROUND_JSON;
  if (override) {
    const inputs = parseMaybeJsonInputs(override);
    if (!inputs) throw new Error("TOTO_ROUND_JSON の形式が不正です");
    return parseRounds(inputs, teams);
  }

  const url = process.env.TOTO_HOLDINGS_URL;
  if (!url) throw new Error("TOTO_HOLDINGS_URL も TOTO_ROUND_JSON も未設定です");

  const body = await fetchText(url);
  const asJson = parseMaybeJsonInputs(body);
  if (asJson) return parseRounds(asJson, teams);

  // HTML ベストエフォート（単体）
  const no = extractRoundNo(body);
  const matches = extractMatches(body, teams);
  if (!no || matches.length === 0) {
    throw new Error(
      `HTMLから開催回/対戦を十分に抽出できませんでした（no=${no}, matches=${matches.length}）。TOTO_ROUND_JSONの利用を推奨。`,
    );
  }
  return parseRounds([{ no, matches }], teams);
}
