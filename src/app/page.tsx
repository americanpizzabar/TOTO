import Link from "next/link";
import { MatchCard } from "@/components/MatchCard";
import { CURRENT_ROUND } from "@/data/seed";
import { MODELS, predictRound } from "@/lib/service";
import { getDeps } from "@/lib/teams";
import type { ModelId } from "@/lib/types";
import { pct } from "@/lib/format";

export const dynamic = "force-dynamic";

function parseModel(v: string | undefined): ModelId {
  return v === "statistical" ? "statistical" : "news-weighted";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ model?: string }>;
}) {
  const { model: modelParam } = await searchParams;
  const model = parseModel(modelParam);
  const deps = await getDeps();
  const preds = predictRound(CURRENT_ROUND, model, deps);
  const deadline = new Date(CURRENT_ROUND.deadlineAt);

  const avgConfidence = preds.reduce((s, p) => s + p.confidence, 0) / preds.length;
  const upsetMatches = preds.filter((p) => p.upset >= 0.9).length;

  return (
    <>
      <h1>{CURRENT_ROUND.name} 予想</h1>
      <p className="lead">
        投票締切: {deadline.toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" })}
        ・全{preds.length}試合
      </p>

      <div className="disclaimer">
        <strong>ご注意:</strong> 本アプリの予想は統計的な確率であり、的中を保証するものではありません。
        表示はあくまで参考情報で、購入代行は行いません。20歳未満の方は購入できません。
      </div>

      <div className="toolbar">
        <div className="field">
          <label>予想モデル</label>
          <div className="segmented">
            {MODELS.map((m) => (
              <Link
                key={m.id}
                href={`/?model=${m.id}`}
                className={m.id === model ? "active" : ""}
              >
                {m.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="field">
          <label>この買い目を作る</label>
          <div className="segmented">
            <Link href={`/betting?model=${model}&mode=safe`}>堅め</Link>
            <Link href={`/betting?model=${model}&mode=balanced`}>バランス</Link>
            <Link href={`/betting?model=${model}&mode=high-payout`}>高配当</Link>
          </div>
        </div>
      </div>

      <p className="small muted">
        {MODELS.find((m) => m.id === model)?.description} ／ 平均自信度 {pct(avgConfidence)}・
        波乱度が高い試合 {upsetMatches}件
        <span className="pill" style={{ marginLeft: 8 }}>
          データ: {deps.info.source === "database" ? "実データ(DB)" : "サンプル(seed)"}
        </span>
      </p>

      <div className="grid" style={{ marginTop: 16 }}>
        {preds.map((p) => (
          <MatchCard
            key={p.fixtureNo}
            prediction={p}
            home={deps.teamMap[p.homeTeamId]}
            away={deps.teamMap[p.awayTeamId]}
          />
        ))}
      </div>
    </>
  );
}
