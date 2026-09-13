// ------------------------------------------------------------------
// Turso (libSQL) データ層
//
//   予想・結果・成績を永続化する。TURSO_DATABASE_URL が未設定の場合は
//   null を返し、呼び出し側はseedデータで動作する（ローカル開発が容易）。
//
//   スキーマは初回アクセス時に自動作成（CREATE TABLE IF NOT EXISTS）。
// ------------------------------------------------------------------

import { createClient, type Client } from "@libsql/client";
import type { MatchPrediction, Outcome } from "./types";

let _client: Client | null | undefined;

/** 設定があればlibSQLクライアントを返す。無ければnull。 */
export function getClient(): Client | null {
  if (_client !== undefined) return _client;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    _client = null;
    return null;
  }
  _client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return _client;
}

let _initialized = false;

export async function ensureSchema(client: Client): Promise<void> {
  if (_initialized) return;
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS predictions (
        round_id TEXT NOT NULL,
        model TEXT NOT NULL,
        fixture_no INTEGER NOT NULL,
        home_team TEXT NOT NULL,
        away_team TEXT NOT NULL,
        p_home REAL NOT NULL,
        p_draw REAL NOT NULL,
        p_away REAL NOT NULL,
        pick TEXT NOT NULL,
        confidence REAL NOT NULL,
        upset REAL NOT NULL,
        lambda_home REAL NOT NULL,
        lambda_away REAL NOT NULL,
        reasons TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (round_id, model, fixture_no)
      )`,
      `CREATE TABLE IF NOT EXISTS results (
        round_id TEXT NOT NULL,
        fixture_no INTEGER NOT NULL,
        result TEXT NOT NULL,
        home_score INTEGER,
        away_score INTEGER,
        imported_at TEXT NOT NULL,
        PRIMARY KEY (round_id, fixture_no)
      )`,
      `CREATE TABLE IF NOT EXISTS news_factors (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        attack_mult REAL NOT NULL,
        defense_mult REAL NOT NULL,
        variance_mult REAL NOT NULL,
        kind TEXT NOT NULL,
        collected_at TEXT NOT NULL
      )`,
    ],
    "write",
  );
  _initialized = true;
}

/** 予想を保存（upsert） */
export async function savePredictions(
  roundId: string,
  model: string,
  predictions: MatchPrediction[],
): Promise<void> {
  const client = getClient();
  if (!client) return;
  await ensureSchema(client);
  const now = new Date().toISOString();
  await client.batch(
    predictions.map((p) => ({
      sql: `INSERT INTO predictions
        (round_id, model, fixture_no, home_team, away_team, p_home, p_draw, p_away, pick, confidence, upset, lambda_home, lambda_away, reasons, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(round_id, model, fixture_no) DO UPDATE SET
          p_home=excluded.p_home, p_draw=excluded.p_draw, p_away=excluded.p_away,
          pick=excluded.pick, confidence=excluded.confidence, upset=excluded.upset,
          lambda_home=excluded.lambda_home, lambda_away=excluded.lambda_away,
          reasons=excluded.reasons, created_at=excluded.created_at`,
      args: [
        roundId,
        model,
        p.fixtureNo,
        p.homeTeamId,
        p.awayTeamId,
        p.probabilities.HOME,
        p.probabilities.DRAW,
        p.probabilities.AWAY,
        p.pick,
        p.confidence,
        p.upset,
        p.expectedGoals.home,
        p.expectedGoals.away,
        JSON.stringify(p.reasons),
        now,
      ],
    })),
    "write",
  );
}

/** 結果を保存（upsert） */
export async function saveResult(
  roundId: string,
  fixtureNo: number,
  result: Outcome,
  score?: { home: number; away: number },
): Promise<void> {
  const client = getClient();
  if (!client) return;
  await ensureSchema(client);
  await client.execute({
    sql: `INSERT INTO results (round_id, fixture_no, result, home_score, away_score, imported_at)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT(round_id, fixture_no) DO UPDATE SET
        result=excluded.result, home_score=excluded.home_score,
        away_score=excluded.away_score, imported_at=excluded.imported_at`,
    args: [
      roundId,
      fixtureNo,
      result,
      score?.home ?? null,
      score?.away ?? null,
      new Date().toISOString(),
    ],
  });
}
