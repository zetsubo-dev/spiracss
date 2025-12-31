# VSCode HTML to SCSS

HTML / テンプレートから [SpiraCSS](../styleguide.md) のルールに沿った SCSS ファイルを自動生成する VSCode 拡張です。

## 変換例

```html
<!-- 選択した HTML -->
<section class="hero-section">
  <h1 class="title">Welcome</h1>
  <p class="body">Introduction text...</p>
  <div class="feature-card">
    <h2 class="heading">Feature</h2>
  </div>
  <div class="cta-box">
    <a class="link" href="#">Learn more</a>
  </div>
</section>
```

↓ SpiraCSS 形式の SCSS を自動生成

**hero-section.scss**（ルート Block）:
```scss
@use "@styles/partials/global" as *;
@use "sass:meta";

// @assets/css/index.scss

.hero-section {
  @include meta.load-css("scss");

  @include breakpoint-up(md) {
    // layout mixin
  }

  > .title {}
  > .body {}

  > .feature-card {
    // @rel/scss/feature-card.scss
  }

  > .cta-box {
    // @rel/scss/cta-box.scss
  }

  // --shared ----------------------------------------

  // --interaction -----------------------------------
  // @at-root & {
  // }
}
```

**scss/feature-card.scss**（子 Block）:
```scss
@use "@styles/partials/global" as *;

// @rel/../hero-section.scss

.feature-card {
  // ...
}
```

**scss/index.scss**（子 Block 集約）:
```scss
@use "feature-card";
@use "cta-box";
```

```text
your-component/
├─ hero-section.scss      ← ルート Block
├─ scss/
│   ├─ feature-card.scss  ← 子 Block
│   └─ index.scss         ← @use 自動マージ
└─ your-template.html
```

## インストール

VSCode 拡張マーケットプレイスから `SpiraCSS HTML to SCSS (Beta)` を検索してインストールします。

→ [Marketplace からインストール](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-html-to-scss)

## コマンド

| コマンド | キーバインド | 説明 |
|-----------------------------------|-------------|------|
| Generate SpiraCSS SCSS from Root | `Cmd+Alt+R` | ルート要素から SCSS ファイル群を一括生成 |
| Generate SpiraCSS SCSS from Selection | `Cmd+Alt+S` | 選択要素から SCSS ファイル群を個別生成 |
| Insert SpiraCSS placeholders (block-box / element) | `Cmd+Alt+E` | HTML にプレースホルダクラスを付与（SCSS 生成なし） |

## 使い方

### ルートモード

1. ルート Block 要素を含む範囲を選択
2. `Cmd+Alt+R` または右クリックメニューから実行
3. 編集中ファイルと同じフォルダにルート SCSS、`childScssDir/`（既定: `scss/`）に子 SCSS が生成される

補足: ルートモードは選択範囲内の最初の `class` 属性付き要素をルートとして扱います。先頭クラスが Block 判定に一致しない場合は生成されません。

### 選択モード

1. 個別に SCSS 化したい Block 要素を選択
2. `Cmd+Alt+S` または右クリックメニューから実行
3. `childScssDir/`（既定: `scss/`）に各 Block の SCSS が生成される

補足: 選択範囲内に複数の Block がある場合はそれぞれ生成されます。

### プレースホルダ付与

SCSS を生成せず、HTML に SpiraCSS 用の目印クラスだけを付与します。
クラス名が未定の段階で構造を先に整えたい場合に便利です。

1. ルートにしたい要素を含む範囲を選択
2. `Cmd+Alt+E` または右クリックメニューから実行
3. 全ての子孫要素を再帰的に走査し、SpiraCSS 構造に整形
   - 子要素を持つ要素 → Block プレースホルダを付与
   - 子要素を持たない要素（葉ノード） → Element プレースホルダを付与
   - 既に Block 名があればスキップ
   - Element 名で子を持てば Block 形式に変換（例: `title` → `title-box`）

プレースホルダ名は `blockCase` / `elementCase` 設定に応じて変わります（両者は独立して設定可能）：

| case | Block プレースホルダ | Element プレースホルダ |
|------|----------------------|------------------------|
| `kebab`（既定） | `block-box` | `element` |
| `camel` | `blockBox` | `element` |
| `pascal` | `BlockBox` | `Element` |
| `snake` | `block_box` | `element` |

プレースホルダ付与時の出力属性は `spiracss.config.js` の `htmlFormat.classAttribute` に従います（既定は `class`）。`className` を使う場合は `className` を指定してください。

## 設定

プロジェクトルートの `spiracss.config.js` で動作をカスタマイズできます。以下は最小例です。

```js
// spiracss.config.js
module.exports = {
  stylelint: {
    classStructure: {
      naming: {
        blockCase: 'kebab',
        elementCase: 'kebab',
      },
    },
  },
  htmlFormat: {
    classAttribute: 'class',
  },
  generator: {
    globalScssModule: '@styles/partials/global',
    layoutMixins: ['@include breakpoint-up(md)'],
    childScssDir: 'scss',
  },
}
```

`package.json` に `"type": "module"` がある場合は、`module.exports` の代わりに `export default` を使用してください。

設定の全体像は [spiracss-config.md](spiracss-config.md) を参照してください。

## 対応テンプレート

| テンプレート | 対応状況 |
|--------------|----------|
| プレーン HTML | 完全対応 |
| Astro | Front-matter を自動削除 |
| EJS | `<% ... %>` を自動削除 |
| Nunjucks | `{{ }}` / `{% %}` / `{# #}` を自動削除 |
| JSX | `class` / `className` から静的クラスを抽出 |
| Vue / Svelte | `v-*` / `:prop` などの属性を自動削除 |

テンプレート構文（`<%...%>`、`{{...}}`、`{...}` など）は正規表現で除去し、`class` / `className` 属性の静的クラス名を抽出します。

## Block/Element 判定

class 属性の**先頭トークン**を base class として判定します。先頭トークンが `blockCase`（または `customPatterns.block`）に一致する場合のみ Block として扱います。Block/Element として扱いたいクラスは先頭に置いてください。

| `blockCase` | Block の例 | `elementCase` | Element の例 |
|-------------|-----------|---------------|--------------|
| `kebab`（既定） | `hero-section`, `feature-card` | `kebab`（既定） | `title`, `body` |
| `camel` | `heroSection`, `featureCard` | `camel` | `title`, `body` |
| `pascal` | `HeroSection`, `FeatureCard` | `pascal` | `Title`, `Body` |
| `snake` | `hero_section`, `feature_card` | `snake` | `title`, `body` |

**注意**: `elementCase` が `pascal` の場合のみ、Element は大文字始まり 1 語（例: `Title`）になります。それ以外は小文字 1 語です。`customPatterns` を指定した場合は該当パターンが優先されます。`-`、`_`、`u-` で始まるクラスは Modifier/Utility 扱いで base class にはなりません。

## 制限事項

### プレースホルダ付与

**プレースホルダ付与コマンド**（`Insert SpiraCSS placeholders`）はテンプレート構文（EJS `<% %>`、Nunjucks `{{ }}` `{% %}`、Astro frontmatter 等）を含む HTML には適用されません。これらの構文は HTML パース時に破壊される恐れがあるため、静的な HTML 断片に対してのみ使用してください。

### 動的クラス

- Vue/Svelte の `:class` バインド内の静的クラスは抽出しない（`class="..."` 側に書くことを推奨）
- 動的に出現するクラス名は追跡しない
- JSX の `class` / `className` は **文字列 / テンプレートリテラル** なら処理対象です。`class={styles.foo}` / `className={styles.foo}` のような動的バインディングはスキップされます

## 関連ツール
### ツール
- [stylelint プラグイン](stylelint.md)
- [HTML CLI](html-cli.md)
- [VSCode Comment Links](comment-links.md)
- VSCode HTML to SCSS

### 設定
- [spiracss.config.js](spiracss-config.md)

## SpiraCSS ドキュメント
- [スタイルガイド](../styleguide.md)
- [クイックスタート](../quickstart.md)
- [CSS レイヤー](../layers.md)
- [コンポーネント](../component.md)
- [ガイドライン](../guidelines.md)
