import { NextResponse } from "next/server";

/** Vercel Cron / 手動実行の認可チェック（Authorization: Bearer $CRON_SECRET） */
export function authorizeCron(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  // シークレット未設定（ローカル）の場合は通す
  if (!secret) return null;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return null;
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
