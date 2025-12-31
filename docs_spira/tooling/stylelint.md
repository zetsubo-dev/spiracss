# stylelint プラグイン

SpiraCSS の設計ルールを検証する stylelint プラグインです。

SpiraCSS 自体の設計原則は [styleguide.md](../styleguide.md) を参照してください。
このドキュメントでは「lint で守れる範囲」と「導入手順」を整理します。

## 概要

- パッケージ名: `@spiracss/stylelint-plugin`
- 提供ルール:
  - `spiracss/class-structure`
  - `spiracss/interaction-scope`
  - `spiracss/rel-comments`

## インストール

stylelint v16 以上が必要です。

```bash
npm install -D @spiracss/stylelint-plugin stylelint stylelint-scss postcss-scss
# or
yarn add -D @spiracss/stylelint-plugin stylelint stylelint-scss postcss-scss
```

## 設定

### 共通設定ファイル（spiracss.config.js）の準備

SpiraCSS 関連ツール（stylelint プラグイン、VSCode 拡張、CLI）は同じ設定を参照します。
プロジェクトルートに `spiracss.config.js` を配置し、設定内容は [spiracss-config.md](spiracss-config.md) を参照して調整してください。

### stylelint への組み込み

`spiracss.config.js` を用意したら、`stylelint.config.js` で `createRules()` を使用します：

```js
// stylelint.config.js
const spiracss = require('@spiracss/stylelint-plugin')
const plugin = spiracss.default ?? spiracss
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
この場合は `createRules()` に設定オブジェクトを渡してください。

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

`createRules()` は SpiraCSS の 3 つのルールをまとめた `rules` オブジェクトを返します。
shared / interaction コメントの判定は `stylelint.sectionCommentPatterns` で一元化でき、詳細は [spiracss-config.md](spiracss-config.md) を参照してください。

## ルール

### `spiracss/class-structure`

SpiraCSS のクラス構造（Block / Element / Modifier）と基本のセレクタ構造を検証します。

- 命名（Block / Element / Modifier）
- Block / Element の親子関係（`Element > Block` などを禁止）
- Block 直下の `>` を強制（shared セクションでは緩和）
- shared セクションはルート Block 直下に配置
- `enforceSingleRootBlock` によるルート Block 制限
- トップレベルセレクタは root Block を含む（`enforceSingleRootBlock` 有効時）
- `selectorPolicy` に応じた data/state の扱い

#### shared セクションの挙動

shared セクションでは、子セレクタの強制だけを緩和し、命名や構造ルールは維持します。
shared セクションはルート Block 直下に配置します（子ルール内に置かない）。

```scss
.block {
  > .element {}
  // --shared
  .utility {}
  .helper { .nested {} }
}
```

### `spiracss/interaction-scope`

interaction セクション（`// --interaction` と `@at-root & { ... }`）の配置ルールを検証します。

- `@at-root & { ... }` ブロックに集約され、セレクタが `&` 起点か
- `// --interaction` コメントが直前に付いているか
- interaction ブロックがファイル末尾に配置されているか
- interaction ブロックがルート Block 直下に配置されているか

### `spiracss/rel-comments`

ページエントリ SCSS ⇔ Block ⇔ 子 Block の対応関係を `@rel` / エイリアスコメントで明示するルールです。
[@rel コメント](../component.md#rel-コメント) に対応します。

- `@include meta.load-css("scss")` を含む親 Block SCSS の先頭コメント
- `> .child-block` 内の `@rel` コメント
- 子 Block SCSS の先頭にある親へのリンクコメント
- コメント内パスの実在チェック（有効時）

詳細は [comment-links.md](comment-links.md) / [spiracss-config.md](spiracss-config.md) を参照してください。

### 3つのルールの役割分担

SpiraCSS の 3 つの stylelint ルールは、対応セクションごとに分担しています。

| ルール | 対応セクション |
|--------|--------------|
| **`class-structure`** | [命名規則](../component.md#命名規則)、[親子関係（構造ルール）](../component.md#親子関係構造ルール)、[SCSS セクション構成](../component.md#scss-セクション構成) |
| **`interaction-scope`** | [SCSS セクション構成](../component.md#scss-セクション構成) |
| **`rel-comments`** | [@rel コメント](../component.md#rel-コメント) |

> **重要:**
> このプラグインで検証できるのは、クラス名・セレクタ構造・`@rel` コメントなどの構造的な要素です。
> Element 連鎖の意図や data/state の妥当性などの設計判断は自動では判定できないため、設計レビューやコードレビューで補完してください。

## カスタマイズ

`spiracss.config.js` でルールをプロジェクトに合わせて調整できます。
仕様から外れる設定を使う場合は、設計レビューで合意し、stylelint / VSCode 拡張 / CLI が同じ設定を参照するように統一してください。

詳細は [spiracss-config.md](spiracss-config.md) を参照してください。

## 関連ツール
### ツール
- stylelint プラグイン
- [HTML CLI](html-cli.md)
- [VSCode Comment Links](comment-links.md)
- [VSCode HTML to SCSS](html-to-scss.md)

### 設定
- [spiracss.config.js](spiracss-config.md)

## SpiraCSS ドキュメント
- [スタイルガイド](../styleguide.md)
- [クイックスタート](../quickstart.md)
- [CSS レイヤー](../layers.md)
- [コンポーネント](../component.md)
- [ガイドライン](../guidelines.md)
