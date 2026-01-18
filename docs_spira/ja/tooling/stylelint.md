# SpiraCSS Stylelint プラグイン

SpiraCSS の設計ルールを検証する SpiraCSS Stylelint プラグインです。

SpiraCSS 自体の設計原則は [設計原則](../principles.md) を参照してください。
このドキュメントでは「lint で守れる範囲」と「導入手順」を整理します。

> **注意:** Stylelint の導入・設定はこのドキュメントを正とします。  
> ルールの詳細は [Stylelint ルール詳細](stylelint-rules/index.md) を参照してください。

## 概要

- パッケージ名: `@spiracss/stylelint-plugin`
- 提供ルール:
  - `spiracss/class-structure`
  - `spiracss/property-placement`
  - `spiracss/interaction-scope`
  - `spiracss/interaction-properties`
  - `spiracss/keyframes-naming`
  - `spiracss/pseudo-nesting`
  - `spiracss/rel-comments`

## インストール

Stylelint v16 以上が必要です。

```bash
npm install -D @spiracss/stylelint-plugin stylelint stylelint-scss postcss-scss
# or
yarn add -D @spiracss/stylelint-plugin stylelint stylelint-scss postcss-scss
```

## 設定

### 共通設定ファイル（spiracss.config.js）の準備

SpiraCSS 関連ツール（SpiraCSS Stylelint プラグイン、VS Code 拡張、CLI）は同じ設定を参照します。
プロジェクトルートに `spiracss.config.js` を配置し、設定内容は [spiracss.config.js](spiracss-config.md) を参照して調整してください。
必須ファイルの配置は [クイックスタート](../quickstart.md) を参照してください。

### Stylelint への組み込み

`spiracss.config.js` を用意したら、`stylelint.config.js` で `createRules()` を使用します：

> `createRules()` / `createRulesAsync()` を使う場合は **`aliasRoots` が必須** です（未設定だとエラーになります）。`stylelint` の各サブセクション（`base` / `class` / `placement` / `interactionScope` / `interactionProps` / `keyframes` / `pseudo` / `rel`）は未指定でもデフォルトが適用されます。
> `stylelint` を指定する場合は **オブジェクト必須** です（`stylelint: []` などはエラー）。

```js
// stylelint.config.js
const spiracss = require('@spiracss/stylelint-plugin')
const plugin = spiracss.default ?? spiracss
// plugin と createRules は同じパッケージから取得
const { createRules } = spiracss

module.exports = {
  plugins: [plugin, 'stylelint-scss'],
  customSyntax: 'postcss-scss',
  rules: {
    ...createRules('./spiracss.config.js'),
    'scss/at-rule-no-unknown': true
  }
}
```

#### ESM（`package.json` に `"type": "module"` がある場合）

Node が `.js` を ES Modules として扱うプロジェクトでは、`spiracss.config.js` も ESM（`export default`）になります。
この場合は以下のいずれかで設定を渡してください。

```js
// stylelint.config.js
import spiracssPlugin, { createRules } from '@spiracss/stylelint-plugin'
import spiracssConfig from './spiracss.config.js'

export default {
  plugins: [spiracssPlugin, 'stylelint-scss'],
  customSyntax: 'postcss-scss',
  rules: {
    ...createRules(spiracssConfig),
    'scss/at-rule-no-unknown': true
  }
}
```

設定パスを渡したい場合は `createRulesAsync()` を使います（ESM のため `require()` が使えないため）。

```js
// stylelint.config.js
import spiracssPlugin, { createRulesAsync } from '@spiracss/stylelint-plugin'

const rules = await createRulesAsync('./spiracss.config.js')

export default {
  plugins: [spiracssPlugin, 'stylelint-scss'],
  customSyntax: 'postcss-scss',
  rules: {
    ...rules,
    'scss/at-rule-no-unknown': true
  }
}
```

> 注意: `createRulesAsync(path)` は **CJS 実行環境で ESM 設定を読み込む場合**に dynamic import を `new Function()` で生成します。Node の `--disallow-code-generation-from-strings` が有効だとこの経路が失敗するため、その場合は `createRules(spiracssConfig)` にオブジェクトを渡すか、フラグを外してください（ESM 実行環境では `import()` 直呼びのため影響しません）。

`createRules()` は SpiraCSS の 7 つのルールをまとめた `rules` オブジェクトを返します。
shared / interaction コメントの判定は `stylelint.base.comments` で一元化でき、詳細は [spiracss.config.js](spiracss-config.md) を参照してください。

## ルール

ルールごとの OK / NG / 理由は [Stylelint ルール詳細](stylelint-rules/index.md) に集約しています。

### `spiracss/class-structure`

命名・親子構造・セクション構成を検証します。詳細は [class-structure](stylelint-rules/class-structure.md) を参照してください。

### `spiracss/property-placement`

プロパティ配置（コンテナ / アイテム / 内部）を検証します。詳細は [property-placement](stylelint-rules/property-placement.md) を参照してください。

### `spiracss/interaction-scope`

interaction セクションの位置と構造を検証します。詳細は [interaction-scope](stylelint-rules/interaction-scope.md) を参照してください。

### `spiracss/interaction-properties`

interaction 内の transition / animation を検証します。詳細は [interaction-properties](stylelint-rules/interaction-properties.md) を参照してください。

### `spiracss/keyframes-naming`

`@keyframes` の配置と命名を検証します。詳細は [keyframes-naming](stylelint-rules/keyframes-naming.md) を参照してください。

### `spiracss/pseudo-nesting`

疑似クラス / 疑似要素のネストを検証します。詳細は [pseudo-nesting](stylelint-rules/pseudo-nesting.md) を参照してください。

### `spiracss/rel-comments`

`@rel` コメントによる親子リンクを検証します。詳細は [rel-comments](stylelint-rules/rel-comments.md) を参照してください。

### 7つのルールの役割分担

SpiraCSS の 7 つの Stylelint ルールは、対応セクションごとに分担しています。

| ルール | 対応セクション |
|--------|--------------|
| **`class-structure`** | [命名規則](../component.md#命名規則)、[親子関係（構造ルール）](../component.md#親子関係構造ルール)、[SCSS セクション構成](../component.md#scss-セクション構成) |
| **`property-placement`** | [プロパティ配置の早見表](../component.md#プロパティ配置の早見表)、縦方向マージンの片側統一 |
| **`interaction-scope`** | [SCSS セクション構成](../component.md#scss-セクション構成) |
| **`interaction-properties`** | [interaction セクション](../component.md#3-interaction-セクション) |
| **`keyframes-naming`** | [@keyframes](../component.md#keyframes) |
| **`pseudo-nesting`** | [SCSS セクション構成](../component.md#scss-セクション構成) |
| **`rel-comments`** | [@rel コメント](../component.md#rel-コメント) |

> **重要:**
> このプラグインで検証できるのは、クラス名・セレクタ構造・`@rel` コメントなどの構造的な要素です。
> Element 連鎖の意図や data/state の妥当性などの設計判断は自動では判定できないため、設計レビューやコードレビューで補完してください。

## カスタマイズ

`spiracss.config.js` でルールをプロジェクトに合わせて調整できます。
仕様から外れる設定を使う場合は、設計レビューで合意し、Stylelint / VS Code 拡張 / CLI が同じ設定を参照するように統一してください。

特定のルールだけ無効化したい場合は、`stylelint.config.(c)js` の `rules` 側で上書きします。

```js
// stylelint.config.cjs
module.exports = {
  // ...
  rules: {
    ...createRules('./spiracss.config.js'),
    'spiracss/rel-comments': null
  }
}
```

詳細は [spiracss.config.js](spiracss-config.md) を参照してください。

## 関連ツール
### ツール
- SpiraCSS Stylelint プラグイン
- [SpiraCSS HTML CLI](html-cli.md)
- [SpiraCSS Comment Links](comment-links.md)
- [SpiraCSS HTML to SCSS](html-to-scss.md)

### 設定
- [spiracss.config.js](spiracss-config.md)

## SpiraCSS ドキュメント
- [設計原則](../principles.md)
- [クイックスタート](../quickstart.md)
- [CSS レイヤー](../layers.md)
- [コンポーネント](../component.md)
- [ガイドライン](../guidelines.md)
- [設計思想](../philosophy.md)
