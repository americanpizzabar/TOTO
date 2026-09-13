import type { MatchPrediction, Outcome, Team } from "@/lib/types";
import { OUTCOME_LABEL, OUTCOME_MARK, confidenceLabel, pct, upsetLabel } from "@/lib/format";

const ORDER: Outcome[] = ["HOME", "DRAW", "AWAY"];

export function MatchCard({
  prediction,
  home,
  away,
}: {
  prediction: MatchPrediction;
  home: Team;
  away: Team;
}) {
  const p = prediction;
  return (
    <div className="card">
      <div className="match-head">
        <span className="match-no">No.{p.fixtureNo}</span>
        <span className="teams">
          {home.name}
          <span className="vs">vs</span>
          {away.name}
        </span>
        <span className={`pick-badge pick-${p.pick}`}>
          予想 {OUTCOME_MARK[p.pick]}・{OUTCOME_LABEL[p.pick]}
        </span>
      </div>

      <div className="probbar" role="img" aria-label={`ホーム${pct(p.probabilities.HOME)} 引分${pct(
        p.probabilities.DRAW,
      )} アウェイ${pct(p.probabilities.AWAY)}`}>
        {ORDER.map((o) => (
          <div key={o} className={`seg ${o}`} style={{ width: pct(p.probabilities[o], 2) }}>
            {p.probabilities[o] >= 0.14 ? pct(p.probabilities[o]) : ""}
          </div>
        ))}
      </div>
      <div className="problabels">
        <span>1 {home.shortName} {pct(p.probabilities.HOME)}</span>
        <span>0 引分 {pct(p.probabilities.DRAW)}</span>
        <span>2 {away.shortName} {pct(p.probabilities.AWAY)}</span>
      </div>

      <div className="meters">
        <div className="meter">
          <div className="meter-label">
            <span>自信度: {confidenceLabel(p.confidence)}</span>
            <span>{pct(p.confidence)}</span>
          </div>
          <div className="track">
            <div className="fill conf" style={{ width: pct(p.confidence) }} />
          </div>
        </div>
        <div className="meter">
          <div className="meter-label">
            <span>波乱度: {upsetLabel(p.upset)}</span>
            <span>{pct(p.upset)}</span>
          </div>
          <div className="track">
            <div className="fill upset" style={{ width: pct(p.upset) }} />
          </div>
        </div>
        <div className="meter">
          <div className="meter-label">
            <span>期待スコア</span>
            <span>
              {p.expectedGoals.home.toFixed(1)} - {p.expectedGoals.away.toFixed(1)}
            </span>
          </div>
          <div className="track">
            <div className="fill conf" style={{ width: "0%" }} />
          </div>
        </div>
      </div>

      <details className="reasons">
        <summary>予想の根拠を見る（{p.reasons.length}項目）</summary>
        <div style={{ marginTop: 8 }}>
          {p.reasons.map((r, i) => (
            <div className="reason" key={i}>
              <span className="rlabel">{r.label}</span>
              <span className="impact" aria-hidden>
                <span
                  className={`ib ${r.impact >= 0 ? "pos" : "neg"}`}
                  style={
                    r.impact >= 0
                      ? { width: `${Math.min(Math.abs(r.impact), 1) * 50}%` }
                      : {
                          width: `${Math.min(Math.abs(r.impact), 1) * 50}%`,
                          left: `${50 - Math.min(Math.abs(r.impact), 1) * 50}%`,
                        }
                  }
                />
              </span>
              <span className="rdetail">{r.detail}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
