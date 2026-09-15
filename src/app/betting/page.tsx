import Link from "next/link";
import { buildTicket } from "@/lib/betting";
import { BET_MODES, MODELS, predictRound } from "@/lib/service";
import { countDistribution } from "@/lib/simulate";
import { getDeps } from "@/lib/teams";
import type { BetMode, ModelId, Outcome } from "@/lib/types";
import { OUTCOME_MARK, pct, yen } from "@/lib/format";

export const dynamic = "force-dynamic";

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

  const deps = await getDeps();
  const round = deps.round;
  const preds = predictRound(round, model, deps);
  const ticket = buildTicket(preds, mode, budget);
  const predByNo = new Map(preds.map((p) => [p.fixtureNo, p]));

  // 的中数の厳密分布（ポアソン二項分布）
  const pickDist = countDistribution(preds.map((p) => p.probabilities[p.pick]));
  const coverDist = countDistribution(ticket.selections.map((s) => s.coverage));
  const n = preds.length;

  return (
    <>
      <h1>買い目生成</h1>
      <p className="lead">
        {round.name}・確率にもとづき ○ の付け方を自動最適化します（1口=¥100）。
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

      <h2>精密シミュレーション（的中数の分布）</h2>
      <p className="small muted">
        各試合の的中確率が異なる独立試行の合計＝ポアソン二項分布を厳密計算しています（モンテカルロより正確）。
      </p>
      <div className="tiles">
        <div className="tile">
          <div className="tval">{pickDist.expected.toFixed(1)}<span style={{ fontSize: 14 }}>/{n}</span></div>
          <div className="tlabel">本命の期待的中数</div>
          <div className="tsub">最頻 {pickDist.mostLikely}試合的中</div>
        </div>
        <div className="tile">
          <div className="tval">{pct(coverDist.atLeast[n] ?? 0, 2)}</div>
          <div className="tlabel">買い目で全{n}試合的中</div>
        </div>
        <div className="tile">
          <div className="tval">{pct(coverDist.atLeast[Math.max(0, n - 1)] ?? 0, 1)}</div>
          <div className="tlabel">買い目で{n - 1}試合以上</div>
        </div>
        <div className="tile">
          <div className="tval">{pct(coverDist.atLeast[Math.max(0, n - 2)] ?? 0, 1)}</div>
          <div className="tlabel">買い目で{n - 2}試合以上</div>
        </div>
      </div>
      <table style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th>的中数</th>
            {Array.from({ length: 5 }, (_, i) => n - 4 + i).map((k) => (
              <th key={k} className="num">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>本命の的中確率</td>
            {Array.from({ length: 5 }, (_, i) => n - 4 + i).map((k) => (
              <td key={k} className="num">
                {pct(pickDist.pmf[k] ?? 0, 1)}
              </td>
            ))}
          </tr>
          <tr>
            <td>買い目の的中確率</td>
            {Array.from({ length: 5 }, (_, i) => n - 4 + i).map((k) => (
              <td key={k} className="num">
                {pct(coverDist.pmf[k] ?? 0, 1)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <h2>マークシート</h2>
      <div className="sel-grid">
        {ticket.selections.map((s) => {
          const pr = predByNo.get(s.fixtureNo)!;
          const home = deps.teamMap[pr.homeTeamId];
          const away = deps.teamMap[pr.awayTeamId];
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
