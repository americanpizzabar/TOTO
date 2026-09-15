import Link from "next/link";

export const dynamic = "force-static";

export default function About() {
  return (
    <>
      <h1>仕組み</h1>
      <p className="lead">「なぜその予想になったか」が見えることを重視しています。</p>

      <h2>1. 予想エンジン（アンサンブル）</h2>
      <p className="small muted">
        複数の無料手法を統合し、期待得点（λ）から Poisson / Dixon-Coles で 1X2 の確率を算出します。
      </p>
      <ul className="small">
        <li>
          <strong>Dixon-Coles（最尤推定）</strong> … 過去全結果からチームの攻撃力・守備力・
          ホーム優位・低スコア補正(ρ)・得点水準を時間減衰つきで最尤推定。サッカー予測の最高峰手法。
          実データ(TheSportsDB)取込時に有効化。
        </li>
        <li>
          <strong>Eloレーティング</strong> … チームの実力。ホームに +65 点相当を加味。
        </li>
        <li>
          <strong>攻撃力・守備力・直近5試合のフォーム</strong> … 平均得失点と調子で微調整。
        </li>
        <li>
          <strong>群衆の投票率（支持率）</strong> … toto公式の支持率をベイズ的な事前分布として統合。
          データの無いJ2/J3対戦では群衆を重視し、実データのある対戦ではモデルを重視。
        </li>
        <li>
          <strong>ニュース特徴量</strong> … 怪我・出停・監督交代・連戦を乗数化（下記2）。
        </li>
      </ul>

      <h2>1b. 妙味(value)分析</h2>
      <p className="small muted">
        モデル確率と群衆の支持率の差（エッジ）を各試合に表示。モデルが群衆より高く見る結果は
        「過小評価＝狙い目」。特に引き分けは群衆が軽視しがちで、統計モデルとの乖離が出やすい。
      </p>

      <h2>1c. 精密な評価（バックテスト）</h2>
      <p className="small muted">
        的中率だけでなく、確率予測の標準指標で精度を数値化: <strong>RPS</strong>（順序を考慮した
        確率スコア）・<strong>Brier</strong>・<strong>対数損失</strong>・<strong>情報利得</strong>・
        キャリブレーション。<a href="/betting">買い目</a>では的中数の分布（ポアソン二項分布の厳密計算）も表示。
      </p>

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
