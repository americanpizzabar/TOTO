// ------------------------------------------------------------------
// チーム名の名寄せユーティリティ
//   toto公式・各データソースの表記ゆれ（全角/半角・記号・空白）を吸収し、
//   内部slugへ対応づける。
// ------------------------------------------------------------------

import type { Team } from "../types";

/** 正規化: NFKC(全角→半角等) → 小文字 → 記号・空白除去 */
export function normalizeName(s: string): string {
  return (s || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[.\-_'’·・､、,\s]/g, "")
    .trim();
}

/** teams から「正規化名 → slug」の対応表を作る（名称・略称・別名を登録） */
export function buildNameIndex(teams: Team[]): Map<string, string> {
  const idx = new Map<string, string>();
  for (const t of teams) {
    for (const n of [t.name, t.shortName, ...(t.sourceNames ?? [])]) {
      const key = normalizeName(n);
      if (key) idx.set(key, t.id);
    }
  }
  return idx;
}
