# SpiraCSS HTML to SCSS

HTML / テンプレートから [SpiraCSS](../principles.md) のルールに沿った SCSS ファイルを自動生成する VS Code 拡張です。
このページは VS Code 拡張の操作説明に加え、CLI と共通の変換仕様もまとめています。

## VS Code 拡張の使い方

### インストール

VS Code 拡張マーケットプレイスから `SpiraCSS HTML to SCSS` を検索してインストールします。

→ [Marketplace からインストール](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-html-to-scss)

### コマンド

| コマンド | キーバインド | 説明 |
|-----------------------------------|-------------|------|
| Generate SpiraCSS SCSS from Root | `Cmd+Ctrl+A` | ルート要素から SCSS ファイル群を一括生成 |
| Generate SpiraCSS SCSS from Selection | `Cmd+Ctrl+S` | 選択要素から SCSS ファイル群を個別生成 |
| Insert SpiraCSS placeholders (block-box / element) | `Cmd+Ctrl+D` | HTML にプレースホルダクラスを付与（SCSS 生成なし） |

### ルートモード

1. ルート Block 要素を含む範囲を選択
2. `Cmd+Ctrl+A` または右クリックメニューから実行
3. 編集中ファイルと同じフォルダにルート SCSS、`childScssDir/`（既定: `scss/`）に子 SCSS が生成される

補足: ルートモードは選択範囲内の 1 要素をルートとして扱い、配下を含めて生成します。該当要素に `class` が無い場合はエラーになります。

### 選択モード

1. 個別に SCSS 化したい Block 要素を選択
2. `Cmd+Ctrl+S` または右クリックメニューから実行
3. `childScssDir/`（既定: `scss/`）に各 Block の SCSS が生成される

補足: 選択範囲内に複数の Block がある場合はそれぞれ生成されます。トップレベルに `class` を持つ要素が 1 つも無い場合はエラーになります。トップレベルに Block 判定の要素が無い場合は生成されません（エラーなし）。

### プレースホルダ付与

SCSS を生成せず、HTML に SpiraCSS 用の目印クラスだけを付与します。
クラス名が未定の段階で構造を先に整えたい場合に便利です。

1. ルートにしたい要素を含む範囲を選択
2. `Cmd+Ctrl+D` または右クリックメニューから実行
3. すべての子孫要素を再帰的に走査し、SpiraCSS 構造に整形
   - 子要素を持つ要素 → Block プレースホルダを付与
   - 子要素を持たない要素（葉ノード） → Element プレースホルダを付与
   - 既に Block 名がある要素 → そのまま維持し、内部を再帰処理
   - Element 名で子を持てば Block 形式に変換（例: `title` → `title-box`）

※ ルート要素が Element の場合は Element → Block 変換を行わず、`block-box title` のように Block プレースホルダを先頭に付与します（Block/Element 以外でも同様）。

プレースホルダ名は `blockCase` / `elementCase` 設定に応じて変わります（両者は独立して設定可能）：

| case | Block プレースホルダ | Element プレースホルダ |
|------|----------------------|------------------------|
| `kebab`（既定） | `block-box` | `element` |
| `camel` | `blockBox` | `element` |
| `pascal` | `BlockBox` | `Element` |
| `snake` | `block_box` | `element` |

プレースホルダ付与時の出力属性は `spiracss.config.js` の `htmlFormat.classAttribute` に従います（既定は `class`）。`className` を使う場合は `className` を指定してください。

### 設定

プロジェクトルートの `spiracss.config.js` で動作をカスタマイズできます。`generator` / `htmlFormat` / `stylelint` などの詳細は [spiracss.config.js](spiracss-config.md) と [spiracss.config.example.js](spiracss.config.example.js) を参照してください。`package.json` に `"type": "module"` がある場合は `export default` を使用してください。

## 変換仕様（CLI と共通）

### 変換例

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

  > .title {
    @include breakpoint-up(md) {
      // layout mixin
    }
  }

  > .body {
    @include breakpoint-up(md) {
      // layout mixin
    }
  }

  > .feature-card {
    // @rel/scss/feature-card.scss
    @include breakpoint-up(md) {
      // child component layout
    }
  }

  > .cta-box {
    // @rel/scss/cta-box.scss
    @include breakpoint-up(md) {
      // child component layout
    }
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
  @include breakpoint-up(md) {
    // layout mixin
  }

  > .heading {
    @include breakpoint-up(md) {
      // layout mixin
    }
  }


  // --shared ----------------------------------------

  // --interaction -----------------------------------
  // @at-root & {
  // }
}
```

**scss/cta-box.scss**（子 Block）:
```scss
@use "@styles/partials/global" as *;

// @rel/../hero-section.scss

.cta-box {
  @include breakpoint-up(md) {
    // layout mixin
  }

  > .link {
    @include breakpoint-up(md) {
      // layout mixin
    }
  }


  // --shared ----------------------------------------

  // --interaction -----------------------------------
  // @at-root & {
  // }
}
```

**scss/index.scss**（子 Block 集約）:
```scss
@use "cta-box";
@use "feature-card";
```

```text
your-component/
├─ hero-section.scss      ← ルート Block
├─ scss/
│   ├─ cta-box.scss       ← 子 Block
│   ├─ feature-card.scss  ← 子 Block
│   └─ index.scss         ← @use 自動マージ
└─ your-template.html
```

### 対応テンプレート

※ このセクションは **SCSS 生成** の対応範囲です。プレースホルダ付与の制限は「制限事項」を参照してください。

| テンプレート | 対応状況 |
|--------------|----------|
| プレーン HTML | 完全対応 |
| Astro | Front-matter を自動削除 |
| EJS | `<% ... %>` を自動削除 |
| Nunjucks | `{{ }}` / `{% %}` / `{# #}` を自動削除 |
| JSX | `class` / `className` から静的クラスを抽出 |
| Vue / Svelte | `v-*` / `:prop` などの属性を削除（`v-bind:class` などは残留する場合あり） |

テンプレート構文は正規表現で除去します。

- `<%...%>`（EJS）
- `{{...}}` / `{%...%}` / `{#...#}`（Nunjucks）
- JSX コメント `{/*...*/}`
- JSX フラグメント `<>...</>`
- `<script>...</script>` / `<style>...</style>` ブロック
- `dangerouslySetInnerHTML` 属性
- 属性スプレッド `{...foo}`
- テンプレートリテラル `${...}`

一般的な `{...}` は除去対象ではありません。`class` / `className` 属性の静的クラス名を抽出します。

### Block/Element 判定

class 属性の**先頭トークン**を base class として判定します。先頭トークンが `blockCase`（または `customPatterns.block`）に一致する場合のみ Block として扱います。Block/Element として扱いたいクラスは先頭に置いてください。

| `blockCase` | Block の例 | `elementCase` | Element の例 |
|-------------|-----------|---------------|--------------|
| `kebab`（既定） | `hero-section`, `feature-card` | `kebab`（既定） | `title`, `body` |
| `camel` | `heroSection`, `featureCard` | `camel` | `title`, `body` |
| `pascal` | `HeroSection`, `FeatureCard` | `pascal` | `Title`, `Body` |
| `snake` | `hero_section`, `feature_card` | `snake` | `title`, `body` |

**注意**: Element は **常に 1 語**です。`elementCase=camel` は小文字 1 語（例: `title`）、`elementCase=pascal` は大文字始まり 1 語（例: `Title`）のみ許可され、`bodyText` / `BodyText` のような内部大文字は使えません。`customPatterns` を指定した場合は該当パターンが優先されます。`customPatterns` を指定している場合、プレースホルダ（`block-box` / `element`）が命名規則に合わない可能性があるため整合性を確認してください。`modifierPrefix`（デフォルトは `-`）で始まるクラスは Modifier 扱い、`u-` で始まるクラスは Utility 扱いになり、base class にはなりません（`-` / `_` / `u-` 始まりのクラスは `customPatterns` でも base 判定できません）。

### 制限事項

#### プレースホルダ付与

**プレースホルダ付与コマンド**（`Insert SpiraCSS placeholders`）はテンプレート構文（EJS `<% %>`、Nunjucks `{{ }}` `{% %}`、Astro frontmatter 等）を含む HTML には適用されません。これらの構文は HTML パース時に破壊される恐れがあるため、静的な HTML 断片に対してのみ使用してください。

#### 動的クラス

- Vue/Svelte の `:class` バインド内の静的クラスは抽出しない（`class="..."` 側に書くことを推奨）。`v-bind:class` は `:class` が残る場合があるため注意
- 動的に出現するクラス名は追跡しない
- JSX の `class` / `className` は **文字列 / テンプレートリテラル** なら処理対象です。`className={styles.foo}` のような動的バインディングは SCSS 生成では除去され、プレースホルダ付与では HTML 全体の処理をスキップします
- JSX の `class={styles.foo}` のような**非リテラル**のバインディングは未対応のため無効扱い（Block/Element 判定不可）で生成されません。プレースホルダ付与では HTML 全体をスキップします

## 関連ツール
### ツール
- [SpiraCSS Stylelint プラグイン](stylelint.md)
- [SpiraCSS HTML CLI](html-cli.md)
- [SpiraCSS Comment Links](comment-links.md)
- SpiraCSS HTML to SCSS

### 設定
- [spiracss.config.js](spiracss-config.md)

## SpiraCSS ドキュメント
- [設計原則](../principles.md)
- [クイックスタート](../quickstart.md)
- [CSS レイヤー](../layers.md)
- [コンポーネント](../component.md)
- [ガイドライン](../guidelines.md)
- [設計思想](../philosophy.md)
