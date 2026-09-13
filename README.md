# toto予想AI

AIがJリーグ **toto全13試合** を「根拠・自信度・波乱度」つきで予想し、**買い目生成** と **過去成績の検証** まで行うアプリのMVPです。

> 「的中だけ狙う」のではなく、**なぜその予想になったか根拠が見え、過去の成績も検証できる** ことを重視しています。

## MVPのワンサイクル

**対象試合一覧 → 確率予想 → 根拠表示 → 買い目生成 → 結果検証**

| 画面 | 内容 |
| --- | --- |
| `/` 予想 | 現在受付中の回の全13試合。1X2確率・自信度・波乱度・期待スコア・根拠の内訳。モデル切替。 |
| `/betting` 買い目 | 堅め/バランス/高配当の3モード。予算内で全13試合的中確率が最大になるよう○を自動最適化。 |
| `/results` 成績検証 | 過去回に対する各モデルの的中率・完全的中数・（試算）回収率を比較。 |
| `/about` 仕組み | 予想ロジックとニュースの使い方の説明。 |

## 予想エンジン

特徴量 → 期待得点(λ) → **Poisson / Dixon-Coles** → 1X2確率、の流れ。

- **Eloレーティング**（`src/lib/elo.ts`）… 実力。ホームに+65点相当のアドバンテージ。
- **攻撃力・守備力**… 平均得失点をリーグ平均で正規化。
- **直近5試合のフォーム**… 勝点から調子指数(-1〜+1)を作り微調整。
- **Dixon-Coles補正**（`src/lib/poisson.ts`）… 低スコア・引き分けの多さを補正（ρ=-0.13）。
- **自信度** = 最有力結果の確率、**波乱度** = 1X2分布の正規化エントロピー。

### ニュース → 特徴量

ニュースで勝敗を直接予想せず、**チーム別の影響度スコア**（`NewsFactor`）に変換して安定させます。

- 主力の怪我・出場停止 → 攻撃/守備の乗数を下げる
- 監督交代直後 → 不確実性（波乱度）を上げ、確率を一様側へ寄せる
- ACL・連戦後の中2〜3日 → 疲労ペナルティ

`統計モデル`（ニュース非使用）と `ニュース重視モデル` を並べてバックテスト比較できます。

#### ニュース収集パイプライン

```
RSS/Atom フィード → fetchAllFeeds() → 特徴量化 → news_factors(Turso)
                                       ├ extract-llm.ts（Claude, キーがあれば優先）
                                       └ extract.ts   （ルールベース, キー不要のフォールバック）
                                                              ↓ 読み出し
                                    予想 ← getNews()（DB優先・seedフォールバック）
```

- **取得** `src/lib/news/rss.ts`: RSS 2.0 / Atom を外部依存なしでパース。既定は Google News の
  Jリーグ検索フィード（`NEWS_FEEDS` で上書き可）。期間・件数で絞り重複排除。
- **LLM抽出** `src/lib/news/extract-llm.ts`: Claude（既定 `claude-opus-5`）が記事を読み、
  チーム別の `{attack/defense/variance}Multiplier` に変換。`ANTHROPIC_API_KEY` がある時のみ使用。
- **ルール抽出** `src/lib/news/extract.ts`: キーワード（負傷/出停/監督交代/連戦…）で分類する
  フォールバック。**APIキー不要で常に動作**。出力乗数は安全域にクランプ。
- **取り込み** `/api/cron/news`（`NEWS_SOURCE=feeds` の時のみ）が収集→ `news_factors` を差し替え。
  リクエスト経路はDBから読むため外部フィード/LLMに依存しません。

有効化:

```bash
# .env
NEWS_SOURCE=feeds
ANTHROPIC_API_KEY=...   # あればLLM抽出。無ければルールベースで動作
TURSO_DATABASE_URL=...  # 保存先
```

## toto開催回（対象13試合）の取り込み

「どの開催回で、どの13試合が対象か」は toto公式が決めるもので公開APIが無いため、
専用の取り込み経路を用意しています（他のデータ源と同じ DB優先・seedフォールバック）。

```
toto公式(HTML) / JSON(単体 or 配列) → parseRounds() → rounds(Turso) → getCurrentRound() → ページ
   ├ 全角→半角の正規化で名寄せ（Ｇ大阪→G大阪 等）
   └ J1以外(J2/J3)など未登録チームは中立レーティングの仮チームで表示を維持
```

- **取得** `src/lib/provider/toto.ts`:
  - `TOTO_ROUND_JSON`（開催回JSON。**単体でも配列でも可**）が最優先の確実な上書き手段。
  - `TOTO_HOLDINGS_URL`（JSON配列/単体ならそのまま、HTMLならベストエフォート解析）。
- **取り込み** `/api/cron/rounds`（`TOTO_SOURCE=toto` の時のみ）が同時発売の複数回も `rounds` に保存。
- **その日に発売中の回を自動選択**: `getCurrentRound()` が締切ベースで
  「締切が未来のうち最も早く締め切る回（＝現在発売中で次に締切）」を選ぶ。締切が過ぎれば
  次の回へ自動的に切り替わる（再取得不要）。全て過去なら直近の回にフォールバック。
- ページの「開催回」バッジで出所（toto公式(DB) / サンプル(seed)）を表示。

> 公式サイトのHTML構造は変わりうるため、HTML解析はベストエフォートです。確実に
> 正しい開催回を出すには `TOTO_ROUND_JSON` の利用を推奨します。

## 買い目生成（`src/lib/betting.ts`）

各試合の確率と予算から、○の数（シングル/ダブル/トリプル）を決定。
「全13試合的中の確率（=各試合カバー率の積）」を最大化するよう、口数上限内で貪欲に○を増減します（1口=¥100）。

## アーキテクチャ（Vercel）

- **フロント+API**: Next.js 16（App Router）
- **DB**: Turso (libSQL) — `src/lib/db.ts`。未設定でもseedデータで全機能が動作。
- **定期処理**: Vercel Cron（`vercel.json`, スケジュールはUTC）
  - 開催回取込 `/api/cron/rounds`
  - チーム実データ取込 `/api/cron/teams`
  - ニュース収集 `/api/cron/news`
  - 予想再計算 `/api/cron/predict`
  - 結果取込・検証 `/api/cron/results`
  - cronは `Authorization: Bearer $CRON_SECRET` で保護。

## セットアップ

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 本番ビルド
npm run typecheck
```

環境変数は `.env.example` を参照（すべて任意。未設定でもseedデータで動作）。

## 実データ接続

チームのレーティング（Elo・平均得失点・直近フォーム）を実データから構築できます。

```
確定試合の結果 → 正規化(FinishedMatch) → buildTeamRatings() → teamsテーブル(Turso)
                                                                    ↓ 読み出し
                              ページ/予想 ← getTeams()（DB優先・seedフォールバック）
```

- **プロバイダ**: `src/lib/provider/thesportsdb.ts` … TheSportsDB（無料）から J1 の確定結果を取得。
  リーグIDは名前から動的解決、チーム名は seed の `sourceNames` で内部slugに名寄せ。
- **変換（データソース非依存の純関数）**: `src/lib/ratings.ts` … 結果列から Elo を逐次更新し、
  平均得失点・直近5試合フォームを算出。
- **取り込み**: `/api/cron/teams`（`DATA_SOURCE=thesportsdb` のときのみ実行）が
  取得→ `teams` テーブルへ保存。**リクエスト経路は外部APIに依存しません**（DBから読む）。
- **フォールバック**: DBに該当が無いチームは seed の値を維持。取得失敗時は seed 全体で動作。
- 画面には「データ: 実データ(DB) / サンプル(seed)」の出所バッジを表示。

有効化:

```bash
# .env
DATA_SOURCE=thesportsdb
THESPORTSDB_KEY=<自分のキー>   # 既定 "3" は無料テストキー
TURSO_DATABASE_URL=...          # 保存先（未設定なら取得結果は保存されずseed動作）
```

> **注**: 別プロバイダ（API-Football等）へ差し替える場合も、`FinishedMatch[]` を返すよう
> プロバイダを実装すれば `ratings.ts` 以降は不変です。

### toto対象試合（販売回の13試合）

「どの13試合か」は toto公式に依存し公開APIが無いため、現状は `src/data/seed.ts` の
`CURRENT_ROUND` で定義します（チームは実データと同じ内部slugで参照）。将来 toto公式の
取り込み（スクレイピング等）に差し替え予定。

### 想定データソース

- Jリーグデータサイト（日程・結果・順位）
- toto公式（対象試合・販売回・結果）
- 各クラブ公式 / スポーツメディア（ニュース）
- TheSportsDB / API-Football など（レーティング用の結果データ）

> 現状の seed 数値はデモ用の近似値であり、公式記録ではありません。

## 免責

本アプリの予想は統計的確率であり、**的中を保証するものではありません**。表示はあくまで参考情報で、
**購入代行は行いません**。ギャンブルは適度に。20歳未満は購入できません。
