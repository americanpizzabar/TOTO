import Link from "next/link";

export const dynamic = "force-static";

export default function About() {
  return (
    <>
      <h1>仕組み</h1>
      <p className="lead">「なぜその予想になったか」が見えることを重視しています。</p>

      <h2>1. 予想エンジン</h2>
      <p className="small muted">
        各試合の特徴量から期待得点（λ）を求め、Poisson / Dixon-Coles で 1X2 の確率を算出します。
      </p>
      <ul className="small">
        <li>
          <strong>Eloレーティング</strong> … チームの実力。ホームには +65 点相当のアドバンテージを加味。
        </li>
        <li>
          <strong>攻撃力・守備力</strong> … 平均得点/失点をリーグ平均で正規化。
        </li>
        <li>
          <strong>直近5試合のフォーム</strong> … 勝点から調子指数（-1〜+1）を作り微調整。
        </li>
        <li>
          <strong>Dixon-Coles 補正</strong> … サッカー特有の低スコア・引き分けの多さを補正（ρ=-0.13）。
        </li>
      </ul>

      <h2>2. ニュースの使い方</h2>
      <p className="small muted">
        ニュースで勝敗を直接決めず、<strong>特徴量に変換</strong>します。
      </p>
      <ul className="small">
        <li>主力の怪我・出場停止 → 攻撃力/守備力の乗数を下げる</li>
        <li>監督交代直後 → 不確実性（波乱度）を上げ、確率を一様分布側へ寄せる</li>
        <li>ACL・連戦後の中2〜3日 → 疲労ペナルティ</li>
      </ul>
      <p className="small muted">
        「統計モデル」はニュース非使用、「ニュース重視モデル」はこれらを加味。
        <Link href="/results">成績検証</Link>で両者を比較できます。
      </p>

      <h2>3. 買い目生成</h2>
      <p className="small muted">
        「堅め / バランス / 高配当狙い」の3モード。各試合の確率と予算から、
        全13試合的中の確率が最大になるよう ○ の数（シングル/ダブル/トリプル）を自動最適化します。
      </p>

      <h2>4. データと定期処理</h2>
      <ul className="small">
        <li>DB: Turso (libSQL)。未設定でもseedデータで動作。</li>
        <li>Vercel Cron: 毎朝ニュース収集 / 試合前日に予想再計算 / 翌日に結果取込・検証。</li>
        <li>データソース（予定）: Jリーグデータサイト、toto公式、各クラブ/スポーツメディアのニュース。</li>
      </ul>

      <div className="disclaimer" style={{ marginTop: 24 }}>
        <strong>免責:</strong> 本アプリの予想は統計的確率であり的中を保証しません。
        表示は参考情報で、購入代行は行いません。gamblingは適度に、20歳未満は購入できません。
      </div>
    </>
  );
}
