// ------------------------------------------------------------------
// Turso (libSQL) データ層
//
//   予想・結果・成績を永続化する。TURSO_DATABASE_URL が未設定の場合は
//   null を返し、呼び出し側はseedデータで動作する（ローカル開発が容易）。
//
//   スキーマは初回アクセス時に自動作成（CREATE TABLE IF NOT EXISTS）。
// ------------------------------------------------------------------

import { createClient, type Client } from "@libsql/client";
import type { MatchPrediction, NewsFactor, Outcome, Round, Team } from "./types";

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
      `CREATE TABLE IF NOT EXISTS rounds (
        id TEXT PRIMARY KEY,
        no INTEGER NOT NULL,
        name TEXT NOT NULL,
        deadline_at TEXT NOT NULL,
        fixtures_json TEXT NOT NULL,
        extra_teams_json TEXT NOT NULL,
        source TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        short_name TEXT NOT NULL,
        elo REAL NOT NULL,
        gf_per_game REAL NOT NULL,
        ga_per_game REAL NOT NULL,
        recent_form TEXT NOT NULL,
        source TEXT NOT NULL,
        updated_at TEXT NOT NULL
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

/** 開催回を保存（upsert）。extraTeams（未登録チーム）も同梱で保持。 */
export async function saveRound(
  round: Round,
  extraTeams: Team[],
  source: string,
): Promise<void> {
  const client = getClient();
  if (!client) return;
  await ensureSchema(client);
  await client.execute({
    sql: `INSERT INTO rounds
      (id, no, name, deadline_at, fixtures_json, extra_teams_json, source, updated_at)
      VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        no=excluded.no, name=excluded.name, deadline_at=excluded.deadline_at,
        fixtures_json=excluded.fixtures_json, extra_teams_json=excluded.extra_teams_json,
        source=excluded.source, updated_at=excluded.updated_at`,
    args: [
      round.id,
      round.no,
      round.name,
      round.deadlineAt,
      JSON.stringify(round.fixtures),
      JSON.stringify(extraTeams),
      source,
      new Date().toISOString(),
    ],
  });
}

/** 最新（no最大）の開催回を読む。未設定/空なら null。 */
export async function loadCurrentRound(): Promise<{ round: Round; extraTeams: Team[] } | null> {
  const client = getClient();
  if (!client) return null;
  await ensureSchema(client);
  const rs = await client.execute("SELECT * FROM rounds ORDER BY no DESC LIMIT 1");
  if (rs.rows.length === 0) return null;
  const r = rs.rows[0];
  return {
    round: {
      id: String(r.id),
      no: Number(r.no),
      name: String(r.name),
      deadlineAt: String(r.deadline_at),
      fixtures: JSON.parse(String(r.fixtures_json)),
    },
    extraTeams: JSON.parse(String(r.extra_teams_json)),
  };
}

/** チームのレーティングを保存（upsert） */
export async function saveTeams(teams: Team[], source: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  await ensureSchema(client);
  const now = new Date().toISOString();
  await client.batch(
    teams.map((t) => ({
      sql: `INSERT INTO teams
        (id, name, short_name, elo, gf_per_game, ga_per_game, recent_form, source, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name, short_name=excluded.short_name, elo=excluded.elo,
          gf_per_game=excluded.gf_per_game, ga_per_game=excluded.ga_per_game,
          recent_form=excluded.recent_form, source=excluded.source, updated_at=excluded.updated_at`,
      args: [
        t.id,
        t.name,
        t.shortName,
        t.elo,
        t.goalsForPerGame,
        t.goalsAgainstPerGame,
        JSON.stringify(t.recentForm),
        source,
        now,
      ],
    })),
    "write",
  );
}

/** DBからチームのレーティングを読む。未設定/空なら null。 */
export async function loadTeamsFromDb(): Promise<Team[] | null> {
  const client = getClient();
  if (!client) return null;
  await ensureSchema(client);
  const rs = await client.execute("SELECT * FROM teams");
  if (rs.rows.length === 0) return null;
  return rs.rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    shortName: String(r.short_name),
    elo: Number(r.elo),
    goalsForPerGame: Number(r.gf_per_game),
    goalsAgainstPerGame: Number(r.ga_per_game),
    recentForm: JSON.parse(String(r.recent_form)),
  }));
}

/** ニュース特徴量を丸ごと差し替え（収集はスナップショットのため全消し→挿入） */
export async function replaceNewsFactors(factors: NewsFactor[]): Promise<void> {
  const client = getClient();
  if (!client) return;
  await ensureSchema(client);
  const now = new Date().toISOString();
  const stmts = [
    "DELETE FROM news_factors",
    ...factors.map((f) => ({
      sql: `INSERT INTO news_factors
        (id, team_id, summary, attack_mult, defense_mult, variance_mult, kind, collected_at)
        VALUES (?,?,?,?,?,?,?,?)`,
      args: [
        `${f.teamId}-${f.kind}-${Math.random().toString(36).slice(2, 8)}`,
        f.teamId,
        f.summary,
        f.attackMultiplier,
        f.defenseMultiplier,
        f.varianceMultiplier,
        f.kind,
        now,
      ],
    })),
  ];
  await client.batch(stmts, "write");
}

/** ニュース特徴量を読む。未設定/空なら null。 */
export async function loadNewsFactors(): Promise<NewsFactor[] | null> {
  const client = getClient();
  if (!client) return null;
  await ensureSchema(client);
  const rs = await client.execute("SELECT * FROM news_factors");
  if (rs.rows.length === 0) return null;
  return rs.rows.map((r) => ({
    teamId: String(r.team_id),
    summary: String(r.summary),
    attackMultiplier: Number(r.attack_mult),
    defenseMultiplier: Number(r.defense_mult),
    varianceMultiplier: Number(r.variance_mult),
    kind: String(r.kind) as NewsFactor["kind"],
  }));
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
