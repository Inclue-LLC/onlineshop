# キャラクター公式サイト兼オンラインショップ（Shopify テーマ）

スタジオハヌル／ふにゅ／Lovely MongMong の 3 ストアで共有する Shopify テーマです。
Shopify 公式の無料テーマ **Dawn 16.2.0** をベースに、キャラクターサイト用のセクションを追加しています。

```
theme/      Shopify テーマ本体（3ストア共通）
scripts/    メタオブジェクト定義の作成スクリプト、テーマ反映スクリプト
.env        各ストアの URL・API トークン（Git にはコミットしない。.env.example をコピーして作成）
```

## 必要なもの

- Node.js 20 以上
- 各ストアの管理者権限（またはスタッフ権限 + テーマ編集権限）

```bash
npm install
```

```bash
cp .env.example .env
```

`.env` にストアの URL（`xxxx.myshopify.com`）とトークンを記入します（詳細は `.env.example` のコメント）。

## ローカルで確認する（shopify theme dev）

```bash
npm run dev
```

`.env` の `STORES` の先頭（既定は hanul）のストアに開発用テーマが作られ、`http://127.0.0.1:9292` でプレビューできます。
初回はブラウザで Shopify へのログインを求められます（`HANUL_THEME_PASSWORD` に Theme Access のパスワードを入れるとログイン不要）。
別のストアで確認する場合は `npm run dev -- funyu` のようにストアキーを付けます。

## ストア側の初期設定（ストアごとに 1 回）

1. **メタオブジェクト定義を作成**（POP UP／店舗／キャラクター）

   ```bash
   npm run metaobjects -- --dry-run
   ```

   ```bash
   npm run metaobjects
   ```

   特定のストアだけなら `node scripts/setup-metaobjects.mjs hanul`。
   既に定義がある場合は、足りないフィールドだけを追加します（既存のデータは変更しません）。
   トークンには `read/write_metaobject_definitions`、`read/write_metaobjects` の権限が必要です（記事メタフィールドの作成で権限エラーになる場合は `read/write_content` も追加）。
   同じコマンドで、お知らせのサムネイル調整用の記事メタフィールド定義も作成します。

2. **テーマをアップロード**（初回のみ。非公開テーマとして全ファイルを送ります）

   ```bash
   npm run push:initial -- hanul
   ```

3. **ページ・ブログ・メニューを作成**（管理画面）

   | 種類 | ハンドル | テンプレート |
   | --- | --- | --- |
   | ページ「キャラクター」 | `characters` | `page.characters` |
   | ページ「店舗情報」 | `stores` | `page.stores` |
   | ページ「POP UP情報」 | `popup` | `page.popup` |
   | ブログ「お知らせ」 | `news` | 既定（blog / article） |

   - メニュー `main-menu`（ヘッダー）：POP UP（/pages/popup）／お知らせ／キャラクター／店舗情報
     ※「ショップ」ボタンとカートはヘッダー右側に自動で表示されます
   - メニュー `footer`：トップ／お知らせ／キャラクター／店舗情報／ショッピングガイド／特定商取引法に基づく表記／プライバシーポリシー／お問い合わせ など

4. **テーマエディタで設定**
   - テーマ設定 > 色：配色 1 = 背景 / テキスト / ボタン（＝アクセント）
   - テーマ設定 > ロゴ：ロゴ画像
   - テーマ設定 > **ブランド設定**：フォント（Google Fonts 名）、淡色・パステル色、角丸、POP UP リンク判定、お知らせのカテゴリ、運営者表記
   - トップページの各セクション（ヘッダー画像・ブランド紹介・SNS リンクなど）

### ブランドの配色・ロゴ（brands/）

```
brands/hanul/settings.json   スタジオハヌルの配色などのテーマ設定
brands/hanul/logo/           ロゴ画像（2509_Logo.ai から書き出した透過 PNG）
```

配色を非公開テーマに反映する（`.env` の `<KEY>_THEME_ID` のテーマに送る。ロゴなどほかの設定は変わりません）:

```bash
npm run brand -- hanul --dry-run
```

```bash
npm run brand -- hanul
```

ロゴはテーマエディタでアップロードします。

| 画像 | 設定場所 |
| --- | --- |
| `hanul-icon-bear.png`（くまの顔） | テーマ設定 > ロゴ > ロゴ画像 |
| `hanul-wordmark.png`（Studio Haneul の文字） | サイトヘッダー > ストア名のロゴ画像 |
| `hanul-logo-square.png`（正方形） | テーマ設定 > ロゴ > ファビコン |

ふにゅ・MongMong も `brands/funyu/`・`brands/mongmong/` を同じ形で作れば、同じ手順で反映できます。

### スタジオハヌルの初期値

テーマの初期値はスタジオハヌル用です（ロゴの色に合わせた配色：背景 `#FCF8F3`／文字 `#4E4238`／アクセント `#6E604F`／フォント M PLUS Rounded 1c）。
ふにゅ・MongMong では、上記 4 のテーマ設定で色・ロゴ・フォント・文章・画像を変更します。コードの変更は不要です。

## 反映（コードの更新をストアに送る）

```bash
npm run push
```

`.env` の `STORES` の全ストアに順に反映します（1 ストアだけなら `npm run push -- hanul`）。
反映先テーマは `<KEY>_THEME_ID` で固定できます（未設定なら CLI が選択を求めます）。

管理画面で設定した内容を上書きしないよう、次のファイルは**送信しません**。

- `config/settings_data.json`（テーマ設定）
- `templates/*.json`（各ページのセクション構成）
- `sections/*-group.json`（ヘッダー・フッターのセクション構成）

新しいページテンプレートを追加したときだけ、そのファイルを個別に送ってください。

```bash
npx shopify theme push --path theme --store xxxx.myshopify.com --only templates/page.new.json
```

管理画面側の設定を取り込みたいときは `npm run pull -- hanul`（上記 JSON のみ取得）。

## 管理画面での運用

| 内容 | 場所 |
| --- | --- |
| POP UP | コンテンツ > メタオブジェクト > POP UP |
| 店舗 | コンテンツ > メタオブジェクト > 店舗 |
| キャラクター | コンテンツ > メタオブジェクト > キャラクター |
| お知らせ | コンテンツ > ブログ記事（ブログ「お知らせ」）。タグ `POP UP`／`新商品`／`コラボ` でカテゴリ分け |
| ヘッダー画像・ブランド紹介・SNS リンク | オンラインストア > テーマ > カスタマイズ（トップページ） |

メタオブジェクトは「公開」状態のものだけがサイトに表示されます（下書きは非表示）。

### お知らせのサムネイル（正方形）

お知らせ一覧・トップのお知らせのサムネイルは正方形です。縦長・横長の画像は、記事の編集画面の下部「メタフィールド」で記事ごとに調整できます
（`npm run metaobjects` で定義が作成されます）。

| メタフィールド | 内容 |
| --- | --- |
| サムネイルの表示方法 | 「切り取って表示」／「全体を表示」。未設定はテーマ設定（ブランド設定 > お知らせ）に従う |
| サムネイルの背景色 | 「全体を表示」のとき周りを埋める色。未設定はテーマ設定、それも無ければページの背景色 |
| サムネイルの横位置（%） | 切り取る位置。0＝左端、50＝中央、100＝右端（未設定は 50） |
| サムネイルの縦位置（%） | 切り取る位置。0＝上端、50＝中央、100＝下端（未設定は 50） |
| サムネイルの拡大率（%） | 100〜300。横位置・縦位置の点を中心に拡大して切り取る（未設定は 100） |
| サムネイル画像（任意） | 一覧用に別の画像を使う場合。未設定は記事の画像 |

### POP UP の表示ルール

- 会期終了日を過ぎた POP UP は自動で非表示
- 開催中・開催予定が 1 件もないときは、トップの POP UP セクション・告知バー・ヘッダー／フッターの「POP UP」リンクをすべて非表示
  （メニュー項目の名前が「POP UP」、または URL に `/pages/popup` を含むものが対象。判定の文字はブランド設定で変更可）
- 告知バーは開催中を優先して 1 件表示（開催中がないときは開催予定を表示。ブランド設定で切替可）
- POP UP の「詳細記事」にお知らせ記事を設定すると、記事ページに開催情報の表・販売アイテム・注意事項が表示されます
- 判定は日本時間の日付で行います。ページがキャッシュされていても、ブラウザ側（`assets/brand.js`）で終了済みのものを隠します
- 終了した POP UP は、溜まりすぎないよう適宜「下書き」に戻すか削除してください

## テーマの構成（追加・変更したもの）

| ファイル | 内容 |
| --- | --- |
| `sections/site-header.liquid` / `site-footer.liquid` | ヘッダー・フッター（Dawn 標準のものから差し替え） |
| `sections/popup-announcement-bar.liquid` | POP UP 告知バー |
| `sections/hero-slider.liquid` | ヘッダー画像（スライド） |
| `sections/popup-list.liquid` | POP UP STORE（トップ・POP UP 情報ページ） |
| `sections/news-list.liquid` | お知らせ（最新） |
| `sections/product-showcase.liquid` | オンラインショップ（新着・おすすめ） |
| `sections/character-showcase.liquid` | キャラクター紹介（トップ用） |
| `sections/brand-about.liquid` | ブランド紹介 |
| `sections/store-list.liquid` | 店舗情報（トップ用の簡易表示／一覧ページのエリア絞り込み） |
| `sections/sns-links.liquid` | 各種リンク（LINE スタンプ・SNS など） |
| `sections/page-heading.liquid` | 下層ページの見出し・パンくず |
| `sections/character-profiles.liquid` | キャラクター紹介ページ |
| `sections/main-news-blog.liquid` / `main-news-article.liquid` | お知らせ一覧・詳細 |
| `snippets/brand-head.liquid` | ブランド設定を CSS 変数として出力・フォント読み込み |
| `snippets/popup-active-keys.liquid` | 開催中・開催予定の POP UP の判定 |
| `assets/brand.css` / `brand.js` | 共通スタイル・スクリプト |
| `config/settings_schema.json` | 「ブランド設定」グループを追加 |

各ブロックは独立したセクションなので、テーマエディタで並べ替え・追加・非表示ができます。
特定のキャラクターだけに必要な要素は、共通テーマにセクションを追加し、使うストアのテーマエディタでだけ配置してください。

商品一覧・商品詳細・カート・決済は Dawn（Shopify 標準）の機能をそのまま使い、配色と角丸をブランドに合わせています。

## メタオブジェクトの項目

定義は `scripts/metaobject-definitions.json`。依頼にあった項目に加え、デザイン案の表示に必要な項目を任意項目として追加しています。

- **POP UP**（`popup`）：会場名、会期開始日、会期終了日、都道府県、住所、営業時間、告知画像、詳細記事
  ＋（追加）購入特典、販売アイテム、注意事項、地図URL
- **店舗**（`retail_store`）：店舗名、エリア、種別、住所、営業時間、取扱商品、地図URL、店舗サイトURL、トップに表示する
  ＋（追加）表示順
- **キャラクター**（`character`）：名前、区分、イラスト、紹介文、誕生日、すきなもの、表示順
  ＋（追加）英語表記／韓国語表記、ひとこと紹介、にがてなもの、くちぐせ、イメージカラー、グッズのコレクション

「詳細記事」は記事参照型（`article_reference`）で作成し、ストアの API で使えない場合は URL 型で作成します（テーマはどちらにも対応）。

## チェック

```bash
npm run check
```

（Theme Check。Dawn 由来の警告のみで、エラーはありません）
