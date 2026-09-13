import type { Outcome } from "./types";

export const pct = (x: number, digits = 0): string => `${(x * 100).toFixed(digits)}%`;

export const yen = (x: number): string => `¥${x.toLocaleString("ja-JP")}`;

export const OUTCOME_LABEL: Record<Outcome, string> = {
  HOME: "ホーム",
  DRAW: "引分",
  AWAY: "アウェイ",
};

/** totoのマーク表記（ホーム=1, 引分=0, アウェイ=2） */
export const OUTCOME_MARK: Record<Outcome, string> = {
  HOME: "1",
  DRAW: "0",
  AWAY: "2",
};

export function confidenceLabel(c: number): string {
  if (c >= 0.6) return "高い";
  if (c >= 0.45) return "中";
  return "低い";
}

export function upsetLabel(u: number): string {
  if (u >= 0.92) return "大";
  if (u >= 0.8) return "中";
  return "小";
}
