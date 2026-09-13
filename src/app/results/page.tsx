import { PAST_ROUNDS } from "@/data/seed";
import { MODELS, summarizeModel } from "@/lib/service";
import { getDeps } from "@/lib/teams";
import type { ModelId } from "@/lib/types";
import { OUTCOME_MARK, pct, yen } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Results() {
  const deps = await getDeps();
  const summaries = MODELS.map((m) => ({
    meta: m,
    summary: summarizeModel(PAST_ROUNDS, m.id as ModelId, deps),
  }));

  return (
    <>
      <h1>成績検証・バックテスト</h1>
      <p className="lead">
        過去{PAST_ROUNDS.length}回のtotoに対し、各モデルの予想と実際の結果を照合しています。
      </p>

      <div className="disclaimer">
        <strong>回収率について:</strong> 実際の配当データが未接続のため、
        「バランス買い目が完全的中したら想定1等配当を得た」とする<strong>試算値</strong>です（目安）。
        的中率（試合単位）は実結果との照合による実測です。
      </div>

      <h2>モデル比較</h2>
      <table>
        <thead>
          <tr>
            <th>モデル</th>
            <th className="num">試合的中率</th>
            <th className="num">的中/試合</th>
            <th className="num">完全的中</th>
            <th className="num">参考回収率</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map(({ meta, summary }) => (
            <tr key={meta.id}>
              <td>{meta.label}</td>
              <td className="num">{pct(summary.matchAccuracy, 1)}</td>
              <td className="num">
                {summary.totalCorrect}/{summary.totalMatches}
              </td>
              <td className="num">
                {summary.perfectCount}/{summary.rounds.length}回
              </td>
              <td className="num">
                <span className={summary.sampleRoi.roi >= 0 ? "hit" : "miss"}>
                  {summary.sampleRoi.roi >= 0 ? "+" : ""}
                  {pct(summary.sampleRoi.roi, 0)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted" style={{ marginTop: 8 }}>
        参考回収率: 1回あたり予算{yen(summaries[0].summary.sampleRoi.budgetPerRound)}・想定1等
        {yen(summaries[0].summary.sampleRoi.assumedJackpot)}での試算。
      </p>

      {summaries.map(({ meta, summary }) => (
        <section key={meta.id}>
          <h2>
            {meta.label} — 回別の的中
          </h2>
          {summary.rounds.map((r) => (
            <div className="card" key={r.roundId} style={{ marginBottom: 12 }}>
              <div className="match-head" style={{ marginBottom: 10 }}>
                <span className="teams">第{r.roundNo}回</span>
                <span className="pill">
                  {r.correct}/{r.total} 的中{r.perfect ? "・完全的中" : ""}
                </span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>No</th>
                    <th>対戦</th>
                    <th>予想</th>
                    <th>結果</th>
                    <th className="num">自信度</th>
                    <th>判定</th>
                  </tr>
                </thead>
                <tbody>
                  {r.details.map((d) => {
                    const fx = PAST_ROUNDS.find((pr) => pr.id === r.roundId)!.fixtures.find(
                      (f) => f.no === d.fixtureNo,
                    )!;
                    return (
                      <tr key={d.fixtureNo}>
                        <td>{d.fixtureNo}</td>
                        <td>
                          {deps.teamMap[fx.homeTeamId]?.shortName} -{" "}
                          {deps.teamMap[fx.awayTeamId]?.shortName}
                        </td>
                        <td>{OUTCOME_MARK[d.pick]}</td>
                        <td>{OUTCOME_MARK[d.actual]}</td>
                        <td className="num">{pct(d.confidence)}</td>
                        <td className={d.hit ? "hit" : "miss"}>{d.hit ? "的中" : "×"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
