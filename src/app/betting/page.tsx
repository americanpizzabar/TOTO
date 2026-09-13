import Link from "next/link";
import { CURRENT_ROUND, NEWS, TEAM_BY_ID } from "@/data/seed";
import { buildTicket } from "@/lib/betting";
import { BET_MODES, MODELS, predictRound } from "@/lib/service";
import type { BetMode, ModelId, Outcome } from "@/lib/types";
import { OUTCOME_MARK, pct, yen } from "@/lib/format";

export const dynamic = "force-dynamic";

const deps = { teamById: (id: string) => TEAM_BY_ID[id], news: NEWS };
const ORDER: Outcome[] = ["HOME", "DRAW", "AWAY"];

function parseModel(v: string | undefined): ModelId {
  return v === "statistical" ? "statistical" : "news-weighted";
}
function parseMode(v: string | undefined): BetMode {
  if (v === "safe" || v === "high-payout") return v;
  return "balanced";
}

export default async function Betting({
  searchParams,
}: {
  searchParams: Promise<{ model?: string; mode?: string; budget?: string }>;
}) {
  const sp = await searchParams;
  const model = parseModel(sp.model);
  const mode = parseMode(sp.mode);
  const budget = Math.max(0, Number(sp.budget) || 5000);

  const preds = predictRound(CURRENT_ROUND, model, deps);
  const ticket = buildTicket(preds, mode, budget);
  const predByNo = new Map(preds.map((p) => [p.fixtureNo, p]));

  return (
    <>
      <h1>買い目生成</h1>
      <p className="lead">
        {CURRENT_ROUND.name}・確率にもとづき ○ の付け方を自動最適化します（1口=¥100）。
      </p>

      <div className="disclaimer">
        <strong>ご注意:</strong> 予想・買い目は参考情報です。的中や利益を保証しません。購入代行は行いません。
      </div>

      <div className="toolbar">
        <div className="field">
          <label>予想モデル</label>
          <div className="segmented">
            {MODELS.map((m) => (
              <Link
                key={m.id}
                href={`/betting?model=${m.id}&mode=${mode}&budget=${budget}`}
                className={m.id === model ? "active" : ""}
              >
                {m.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="field">
          <label>モード</label>
          <div className="segmented">
            {BET_MODES.map((m) => (
              <Link
                key={m.id}
                href={`/betting?model=${model}&mode=${m.id}&budget=${budget}`}
                className={m.id === mode ? "active" : ""}
              >
                {m.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="field">
          <label>予算（円）</label>
          <form className="budget-form" action="/betting" method="get">
            <input type="hidden" name="model" value={model} />
            <input type="hidden" name="mode" value={mode} />
            <input type="number" name="budget" min={100} step={100} defaultValue={budget} />
            <button type="submit">再計算</button>
          </form>
        </div>
      </div>

      <p className="small muted">{BET_MODES.find((m) => m.id === mode)?.description}</p>

      <div className="tiles">
        <div className="tile">
          <div className="tval">{ticket.combinations.toLocaleString("ja-JP")}</div>
          <div className="tlabel">総口数</div>
        </div>
        <div className="tile">
          <div className="tval">{yen(ticket.cost)}</div>
          <div className="tlabel">想定購入額</div>
          <div className="tsub">予算 {yen(budget)}</div>
        </div>
        <div className="tile">
          <div className="tval">{pct(ticket.hitProbability, 2)}</div>
          <div className="tlabel">全13試合的中の確率（推定）</div>
        </div>
        <div className="tile">
          <div className="tval">
            {ticket.selections.filter((s) => s.outcomes.length === 1).length}/
            {ticket.selections.filter((s) => s.outcomes.length === 2).length}/
            {ticket.selections.filter((s) => s.outcomes.length === 3).length}
          </div>
          <div className="tlabel">シングル/ダブル/トリプル</div>
        </div>
      </div>

      <h2>マークシート</h2>
      <div className="sel-grid">
        {ticket.selections.map((s) => {
          const pr = predByNo.get(s.fixtureNo)!;
          const home = TEAM_BY_ID[pr.homeTeamId];
          const away = TEAM_BY_ID[pr.awayTeamId];
          return (
            <div className="sel" key={s.fixtureNo}>
              <div className="sel-no">
                No.{s.fixtureNo}・カバー{pct(s.coverage)}
              </div>
              <div className="sel-team">
                {home.shortName} - {away.shortName}
              </div>
              <div className="marks">
                {ORDER.map((o) => {
                  const on = s.outcomes.includes(o);
                  return (
                    <span key={o} className={`mark ${on ? `on ${o}` : ""}`}>
                      {OUTCOME_MARK[o]}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="small muted" style={{ marginTop: 20 }}>
        ○の数（1=シングル/2=ダブル/3=トリプル）は各試合の確率と予算から自動決定しています。
        予算を増やすと的中確率の高い試合から順に○が追加されます。
      </p>
    </>
  );
}
