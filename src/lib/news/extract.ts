// ------------------------------------------------------------------
// ニュース → 特徴量（NewsFactor）変換
//
//   ルールベース抽出（キーワードマッチ・APIキー不要）。
//   LLM抽出（extract-llm.ts）が使えない場合の既定手段でもある。
// ------------------------------------------------------------------

import type { NewsFactor, Team } from "../types";
import type { NewsItem } from "./rss";

// 乗数の安全域（LLM/ルールいずれの出力もここに丸める）
const RANGES = {
  attack: { min: 0.7, max: 1.15 },
  defense: { min: 0.9, max: 1.3 },
  variance: { min: 1.0, max: 1.6 },
} as const;

export function clampFactor(f: NewsFactor): NewsFactor {
  const c = (x: number, r: { min: number; max: number }) =>
    Math.max(r.min, Math.min(r.max, Number.isFinite(x) ? x : 1));
  return {
    ...f,
    attackMultiplier: c(f.attackMultiplier, RANGES.attack),
    defenseMultiplier: c(f.defenseMultiplier, RANGES.defense),
    varianceMultiplier: c(f.varianceMultiplier, RANGES.variance),
  };
}

/** 記事本文にチームが登場するか判定し、該当チームのslugを返す */
function matchTeams(text: string, teams: Team[]): Team[] {
  const hit: Team[] = [];
  for (const t of teams) {
    const names = [t.name, t.shortName, ...(t.sourceNames ?? [])];
    if (names.some((n) => n && text.includes(n))) hit.push(t);
  }
  return hit;
}

interface Rule {
  kind: NewsFactor["kind"];
  test: RegExp;
  attack: number;
  defense: number;
  variance: number;
  label: string;
}

// キーワード → 影響度のルール（サッカーの一般的な文脈に基づく近似）
const RULES: Rule[] = [
  { kind: "injury", test: /(負傷|けが|ケガ|怪我|離脱|欠場)/, attack: 0.92, defense: 1.03, variance: 1.05, label: "主力の負傷・離脱" },
  { kind: "suspension", test: /(出場停止|累積警告|一発退場|退場処分|サスペンド)/, attack: 0.97, defense: 1.1, variance: 1.05, label: "出場停止" },
  { kind: "manager", test: /(監督(交代|解任|辞任|退任|就任)|新監督|新指揮官|指揮官交代)/, attack: 1.0, defense: 1.0, variance: 1.35, label: "監督交代" },
  { kind: "fatigue", test: /(連戦|中2日|中3日|過密日程|ACL|ルヴァン|天皇杯).{0,12}(遠征|疲労|中2日|中3日)?/, attack: 0.95, defense: 1.05, variance: 1.1, label: "連戦・疲労" },
  { kind: "morale", test: /(連勝|好調|復帰|完全復活|勢い)/, attack: 1.06, defense: 0.98, variance: 1.0, label: "好調・復帰" },
];

/** 安定した重複排除用のID */
function factorId(teamId: string, kind: string, url: string): string {
  const base = `${teamId}:${kind}:${url}`;
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) | 0;
  return `${teamId}-${kind}-${(h >>> 0).toString(36)}`;
}

/** ルールベースでニュースを特徴量化する */
export function extractByRules(items: NewsItem[], teams: Team[]): NewsFactor[] {
  const byId = new Map<string, NewsFactor>();
  for (const item of items) {
    const text = `${item.title} ${item.summary}`;
    const matched = matchTeams(text, teams);
    if (matched.length === 0) continue;
    for (const rule of RULES) {
      if (!rule.test.test(text)) continue;
      for (const team of matched) {
        const id = factorId(team.id, rule.kind, item.url);
        if (byId.has(id)) continue;
        byId.set(
          id,
          clampFactor({
            teamId: team.id,
            summary: `${rule.label}: ${item.title}（${item.source}）`,
            attackMultiplier: rule.attack,
            defenseMultiplier: rule.defense,
            varianceMultiplier: rule.variance,
            kind: rule.kind,
          }),
        );
      }
    }
  }
  return [...byId.values()];
}
