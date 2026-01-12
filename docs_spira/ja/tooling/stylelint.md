# SpiraCSS Stylelint プラグイン

SpiraCSS の設計ルールを検証する SpiraCSS Stylelint プラグインです。

SpiraCSS 自体の設計原則は [設計原則](../principles.md) を参照してください。
このドキュメントでは「lint で守れる範囲」と「導入手順」を整理します。

> **注意:** Stylelint の導入・設定はこのドキュメントを正とします。  
> ほかのドキュメントには概要のみ記載し、詳細は本ページへリンクさせます。

## 概要

- パッケージ名: `@spiracss/stylelint-plugin`
- 提供ルール:
  - `spiracss/class-structure`
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

> `createRules()` / `createRulesAsync()` を使う場合は **`aliasRoots` が必須** です（未設定だとエラーになります）。`stylelint` の各サブセクション（`classStructure` / `interactionScope` / `interactionProperties` / `keyframesNaming` / `pseudoNesting` / `relComments`）は未指定でもデフォルトが適用されます。
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

`createRules()` は SpiraCSS の 6 つのルールをまとめた `rules` オブジェクトを返します。
shared / interaction コメントの判定は `stylelint.sectionCommentPatterns` で一元化でき、詳細は [spiracss.config.js](spiracss-config.md) を参照してください。

## ルール

### `spiracss/class-structure`

SpiraCSS のクラス構造（Block / Element / Modifier）と基本のセレクタ構造を検証します。

- 命名（Block / Element / Modifier）
- Block / Element の親子関係（`Element > Block` などを禁止）
- Block 直下の `>` を強制（shared セクションは緩和。interaction セクションは構造検査の対象外。`enforceChildCombinator` で制御）
- interaction セクションでは命名検証は維持し、構造ルール（親子関係 / 深さ / コンビネータ）を検査しない
- shared セクションはルート Block 直下に配置（@layer/@supports/@media/@container/@scope のラッパー内でも可）
- `enforceSingleRootBlock` によるルート Block 制限
- トップレベルセレクタは root Block を含む（`enforceSingleRootBlock` 有効時）
- `enforceRootFileName` によるルート Block とファイル名の一致
- `selectorPolicy` に応じた data/state の扱い

#### shared セクションの挙動

shared セクションでは、子セレクタの強制だけを緩和し、命名や構造ルールは維持します。
shared セクションはルート Block 直下に配置します（子ルール内に置かない。@layer/@supports/@media/@container/@scope のラッパー内でも可）。

```scss
.sample-block {
  > .title {}
  // --shared
  .utility {}
  .helper { .nested {} }
}
```

### `spiracss/interaction-scope`

interaction セクション（`// --interaction` と `@at-root & { ... }`）の配置ルールを検証します。

- `@at-root & { ... }` ブロックに集約され、インタラクションセレクタ（擬似/状態。例: `[data-state]`, `[aria-expanded]`, `[aria-expanded="true"]`）を含むセレクタが `&` から始まるか（`> &:hover` のような先頭コンビネータも不可）
- `// --interaction` コメントが `@at-root` ブロック（または @layer / @supports / @media / @container / @scope などのラッパー）の直前に付いているか
- デフォルト（`enforceWithCommentOnly: false`）ではコメントが無い擬似/状態セレクタも検出し、interaction への移動を促す
- interaction ブロックがルート Block の末尾に配置されているか
- interaction ブロックがルート Block 直下に配置されているか（@layer/@supports/@media/@container/@scope のラッパー内でも可）
- `data-variant` は interaction に置いてよい（インタラクション初期値用途。`data-state` / `aria-*` と同一セレクタで混在させない）

例:

```scss
.sample-block {
  // --interaction
  @at-root & {
    > .icon {
      &:hover {}
    }
  }
}
```

### `spiracss/interaction-properties`

interaction セクション内に transition / animation 関連の宣言を集約し、transition 対象のプロパティを明示させます。

- `transition` / `transition-*` / `animation` / `animation-*` は `// --interaction` セクション内のみ（`transition-*` には `transition-property` / `transition-duration` / `transition-delay` / `transition-timing-function` / `transition-behavior` を含む）
- `transition` は **対象プロパティを明示**する（`transition: all` / `transition-property: all` / プロパティ省略 / `var(...)` のみ / `inherit` / `initial` / `unset` / `revert` / `revert-layer` は不可）
- `transition: none` / `transition-property: none` は不可（無効化が必要なら `transition-duration` を極小にする）
- `transition` で指定したプロパティは同一 Block / Element（疑似要素は別扱い）では interaction 以外で宣言しない（初期値を含めて interaction に集約）

例:

```scss
.sample-block {
  // --interaction
  @at-root & {
    opacity: 0;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 1;
    }
  }
}
```

### `spiracss/keyframes-naming`

`@keyframes` の配置と命名ルールを検証します。

- `@keyframes` は **ルート直下のみ**に置く（@media/@layer などの内側は不可）
- `@keyframes` は **ファイル末尾**にまとめて配置する（コメント／空行を除いて末尾）
- 命名は `{block}-{action}` または `{block}-{element}-{action}`
- block / element のケースは `classStructure.naming` に従う
- element は **そのファイル内に実在する element 名のみ許可**
- action は `blockCase` のケースで **1〜3語**（`actionMaxWords` で変更可。例: `fade-in` / `fadeIn` / `fade_in`）
- block と action の区切りは **常に `-` 固定**（例: `cardList-fadeIn` / `CardList-fadeIn`）
- 共有アニメーションは `kf-` などの prefix を使い、`keyframes.scss` に集約する
- ルート Block が取得できない場合は **警告して命名のみスキップ**（配置チェックは継続。`blockNameSource` で挙動変更可）

例:

```scss
.sample-block {}

@keyframes sample-block-fade-in {
  to {
    opacity: 1;
  }
}
```

### `spiracss/pseudo-nesting`

疑似クラス / 疑似要素を `&` にネストして書くルールです。

- OK: `.btn { &:hover { ... } }`, `.btn { &::before { ... } }`
- NG: `.btn:hover { ... }`, `& > .btn:hover { ... }`

### `spiracss/rel-comments`

ページエントリ SCSS と Block / 子 Block の対応関係を `@rel` / エイリアスコメントで明示するルールです。
[@rel コメント](../component.md#rel-コメント) に対応します。

- 親 Block / 子 Block SCSS の親リンクはルートスコープ先頭コメント（@layer/@supports/@media/@container/@scope のラッパー内でも可。root Block 内に置くとエラー）
- 親 Block は同一スコープ内で最初の rule に配置（親 @rel を必須にする場合）
- `> .child-block` の直下ルールの最初のノードが `@rel` コメント（shared は対象、interaction はデフォルトで対象外）
- コメント内パスの実在チェック（有効時）

詳細は [SpiraCSS Comment Links](comment-links.md) / [spiracss.config.js](spiracss-config.md) を参照してください。

### 6つのルールの役割分担

SpiraCSS の 6 つの Stylelint ルールは、対応セクションごとに分担しています。

| ルール | 対応セクション |
|--------|--------------|
| **`class-structure`** | [命名規則](../component.md#命名規則)、[親子関係（構造ルール）](../component.md#親子関係構造ルール)、[SCSS セクション構成](../component.md#scss-セクション構成) |
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
