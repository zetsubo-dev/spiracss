# SpiraCSS AI用のドキュメントファイル

このドキュメントは、AI が SpiraCSS の設計原則を正しく理解し、ツールを適切に運用するための要点をまとめたものです。公開ドキュメントの**補助資料**であり、最終的な判断は `spiracss.config.js` と各設計ドキュメントを優先してください。人間向けのツール説明は含めません。

## 必須の参照順序（AI 向け）

1. `spiracss.config.js`（プロジェクトごとの唯一の正解）
2. `docs_spira/styleguide.md`（全体像）
3. `docs_spira/component.md`（コンポーネント規約）
4. `docs_spira/layers.md`（レイヤー責務）
5. `docs_spira/tooling/*.md`（ツール仕様）

設定ファイルが存在する場合は **必ず** 先に読み、デフォルト値を前提にしないでください。

---

## 設計の前提（コア原則）

- **構造の最小原則**: すべての構造は `Block > 子（Block / Element）` の繰り返し。
- **判断のブレを減らす**: 命名と構造で機械的に判定できる規則に絞る。
- **Variant / State の分離**: 見た目の差分（Variant）と状態（State）を区別する。
- **1 Block = 1 ファイル**: SCSS ファイルは Block 単位で分割する。
- **ツールで検証できる範囲を重視**: Stylelint / HTML lint に載るルールを優先。

---

## 構造ルール早見表

### 命名（デフォルト）

> 実際の命名・モードは `spiracss.config.js` を優先。

- **Block**: 2 語（例: `.hero-banner`）
- **Element**: 1 語（例: `.title`）
- **Utility**: `u-` 接頭辞（例: `.u-hidden`）

補足:
- `customPatterns` を使う場合、HTML プレースホルダ（`block-box` / `element`）と一致するか確認。
- **base class 判定は先頭トークン**。Block/Element として扱いたいクラスは先頭に置く。
- `-` / `_` / `u-` で始まるクラスは base class にならない。

### 親子関係（構造）

許可:
- `Block > Block`
- `Block > Element`

原則禁止（基本構造 / shared）:
- `Element > Block`
- `Element > Element`（例外: レイアウト目的ではない装飾・意味付けのみ）
- 親 Block から子 Block 配下の Element まで直接指定

深さ（基本構造 / shared）:
- `Block > Block > Block` の 3 段以上は原則避ける
- Element 連鎖の上限はデフォルト 4（設定で変更）

セレクタ:
- 基本構造セクションでは `>` を使い 1 段ずつ
- shared セクションのみ `>` の強制を緩和
- interaction セクションは構造制約対象外（親から孫以降の Block/Element を直接指定可）

### Variant / State

デフォルト（data モード）:
- Variant: `data-variant="primary"`
- State: `data-state="active"`
- ARIA 状態: `aria-expanded="true"` など

配置:
- Variant → 原則は基本構造（インタラクション初期値は interaction も可）
- State / ARIA → `--interaction` セクション

命名:
- 属性名 / 値ともに小文字 + ハイフン（例: `data-variant="primary-dark"`）
- 値の命名は `valueNaming` に従う（デフォルト: kebab + 最大 2 語）

デフォルトの予約キー（`selectorPolicy`）:
- Variant: `mode=data`, `dataKeys=["data-variant"]`
- State: `mode=data`, `dataKey="data-state"`
- ARIA: `["aria-expanded", "aria-selected", "aria-disabled"]`

補足:
- Variant は複数属性に分割可能（例: `data-variant` + `data-size`）
- Variant / State でモードを分けられる（例: Variant は data、State は class）
- `variant.mode=class` と `state.mode=class` を併用する場合、生成側では **全 modifier を variant 扱い**に統一
- `aria-*` の値は検証対象外（存在チェックのみ）
- data モードでは modifier クラスは HTML lint で禁止
- 同一 base class が複数ある場合、modifier / variant / state / aria は重複排除して統合される
- 予約キーをカスタム（例: `data-theme`, `data-status`, `aria-hidden`）しても同じルールで統合される

class モード（互換）:
- Modifier: `.-primary`, `.-active`
- 命名は `stylelint.classStructure.naming`（`modifierPrefix` / `modifierCase` / `customPatterns.modifier`）に従う
- `selectorPolicy.variant.mode=class` の場合、Variant は modifier で表現し、`data-variant` は HTML lint で禁止
- `selectorPolicy.state.mode=class` の場合、State は modifier で表現し、`data-state` / `aria-*` は HTML lint で禁止
- class モードでは modifier クラスが HTML lint で許可される
- Variant と State はクラスだけでは区別できないため、**意味で判断してセクションに配置**

### SCSS セクション構成

順序:
1. **基本構造**（Block / 子の構造 + Variant）
2. **`--shared`**（Block 配下でのみ共有する共通クラス）
3. **`--interaction`**（状態・hover など）

要点:
- `--shared` / `--interaction` のコメントが無いと Stylelint エラーになる（設定に従う）
- interaction は `@at-root & { ... }` にまとめ、セレクタは `&` 起点で書く。基本構造より後、原則ファイル末尾
- `--shared` / `--interaction` はルート Block 直下に置く（子ルール内に置かない）
- interaction セクションは構造ルール対象外（Block / Element の親子・深さ制約を適用しない）

#### 最小テンプレート（3 セクション）

```scss
@use "@styles/partials/global" as *; // `generator.globalScssModule` に合わせて変更
@use "sass:meta";

// @assets/css/page.scss

.sample-block {
  @include meta.load-css("scss");

  // 基本構造 -----------------------------------
  display: flex;

  &[data-variant="primary"] {
    background: blue;
  }

  > .header {
    // Element
  }

  > .content-box {
    // @rel/scss/content-box.scss
  }

  // --shared -----------------------------------
  .icon {
    width: 24px;
  }

  // --interaction ------------------------------
  @at-root & {
    &:hover {
      opacity: 0.8;
    }

    &[data-state="active"] {
      border: 2px solid;
    }
  }
}
```

#### Variant / State 記述例

data モード（既定）:

```html
<div class="sample-block" data-variant="primary" data-state="active" aria-expanded="true"></div>
```

```scss
.sample-block {
  &[data-variant="primary"] {
    background: blue;
  }

  // --interaction ------------------------------
  @at-root & {
    &[data-state="active"] {
      border: 2px solid;
    }

    &[aria-expanded="true"] {
      outline: 1px solid;
    }
  }
}
```

class モード（`modifierPrefix="-"` の場合）:

```html
<div class="sample-block -primary -active"></div>
```

```scss
.sample-block {
  &.-primary {
    background: blue;
  }

  // --interaction ------------------------------
  @at-root & {
    &.-active {
      border: 2px solid;
    }
  }
}
```

#### プロパティ配置の早見表（簡易版）

| プロパティ例 | 書く場所 |
| --- | --- |
| `display`, `gap`, `grid-template-*`, `justify-*`, `align-*` | Block 本体 |
| `margin-top`, 親基準の `width/height/max-*`, `flex`, `order`, `align-self` | 親 Block の `> .child` |
| `padding`, `text-align`, `line-height`, 子内部の `gap` | 子 Block / Element 自身 |

#### 親 / 子の責務の具体例

親 Block（配置と余白）:

```scss
.parent-block {
  > .child-block {
    // @rel/scss/child-block.scss
    margin-top: 24px;
    width: min(100%, 720px);
  }
}
```

子 Block（内部レイアウト）:

```scss
.child-block {
  display: grid;
  gap: 8px;
  padding: 16px;

  > .title {
    text-align: left;
  }
}
```

#### shared セクションの例（構造ルールは維持）

```scss
.sample-block {
  // --shared -----------------------------------
  .media-box {
    display: grid;
    gap: 8px;
  }

  .media-box .caption {
    // Block > Element（`>` 強制は緩和されるが構造は維持）
    text-align: left;
  }

  .title .child-block {
    // NG: Element > Block
  }
}
```

### Utility の扱い

- Utility は Block/Element とは別カテゴリ
- `u-` プレフィックスは `allowExternalPrefixes` に追加して検証除外する運用が基本
- Utility は構造の命名ルール（2 語 / 1 語）の対象外
- 外部ライブラリ由来のクラスは `allowExternalClasses` / `allowExternalPrefixes` で除外する（例: `swiper-`）

---

## 設定によるルール変更の早見表

| 設定 | 既定（推奨） | 変更時の影響 |
|------|-------------|-------------|
| `selectorPolicy.variant.mode` | `data` | `class` にすると Variant は `.-xxx` 形式。`data-variant` は HTML lint で禁止。 |
| `selectorPolicy.state.mode` | `data` | `class` にすると State も `.-xxx` 形式。`data-state` / `aria-*` は HTML lint で禁止。 |
| `variant.mode=class` + `state.mode=class` | - | Variant / State が区別できず、**全 modifier を variant 扱い**に統一。 |
| `stylelint.classStructure.naming.modifierPrefix` | `-` | Modifier の接頭辞が変わる（例: クラス名は `--active` / セレクタは `.--active`）。 |
| `stylelint.classStructure.enforceChildCombinator` | `true` | `false` で `>` 強制を緩和（構造が曖昧になりやすい）。 |
| `stylelint.classStructure.enforceSingleRootBlock` | `true` | `false` で同一ファイル内の複数 root Block を許可。 |
| `stylelint.classStructure.enforceRootFileName` | `true` | `false` で Block 名とファイル名の一致チェックをスキップ。 |
| `stylelint.classStructure.allowExternalPrefixes` | `[]` | `['u-', 'swiper-']` などで該当クラスを検証除外。 |
| `stylelint.classStructure.allowExternalClasses` | `[]` | `['swiper', 'swiper-slide']` などを個別に検証除外。 |
| `stylelint.interactionScope.requireAtRoot` | `true` | `false` で `@at-root & {}` と `&` 起点の必須を外す。 |
| `stylelint.interactionScope.requireComment` | `true` | `false` で `// --interaction` コメント必須を解除。 |
| `stylelint.interactionScope.requireTail` | `true` | `false` で interaction ブロックの末尾配置を必須にしない。 |
| `stylelint.relComments.requireChildRelComments` | `true` | `false` で子 Block 側の `@rel` コメントを任意化。 |
| `stylelint.relComments.requireParentRelComment` | `true` | `false` で親 Block 側の `@rel` コメントを任意化。 |
| `stylelint.relComments.requireWhenMetaLoadCss` | `true` | `false` で `meta.load-css` 使用時の先頭コメント必須を解除。 |
| `stylelint.relComments.validatePath` | `true` | `false` で `@rel` パス実在チェックを無効化。 |

---

## 禁止事項 / アンチパターン

- 基本構造 / shared で、親 Block から子 Block 配下の Element まで直接指定する
- 基本構造 / shared で、`Element > Block` や `Element > Element` を構造目的で使う
- `data-state` / `aria-*` を interaction 以外で使う
- Variant / State の意味を混同する（状態なのに Variant 扱いする等）
- data モードで modifier を使う / class モードで `data-variant` / `data-state` を使う
- ページ層でコンポーネント内部構造を定義する
- ページ固有の `scss/` ディレクトリを作る

---

## レイヤーとディレクトリ（典型例）

3 層の責務:

1. **グローバル層**: 変数・関数・Mixin・ユーティリティ
2. **ページ層**: ページ単位のエントリ SCSS（配置・余白）
3. **コンポーネント層**: Block / Element + Variant / State

代表的な構成例:

```text
src/
├── styles/                         # グローバル層
│   └── partials/
│       ├── variables.scss
│       ├── utilities.scss
│       └── global/
│           ├── config.scss
│           ├── function.scss
│           └── mixin.scss
├── components/                     # コンポーネント層
│   ├── common/                     # サイト全体で共通
│   ├── parts/                      # 複数ページで共有
│   └── pages/                      # ページ固有
└── assets/
    └── css/                        # ページ層
```

---

## 共通化の判断基準

- **同じ親 Block 配下だけで共通化** → shared セクション
- **同ページの複数コンポーネントで共通化** → ページ専用共通コンポーネント（`components/pages/`）
- **複数ページで共通化** → `components/parts/`（全ページなら `components/common/`）

---

## ページ層の責務（やること / やらないこと）

やること:
- そのページで使うコンポーネントの `@use`
- ページ全体の見た目（背景・ルートコンテナなど）
- 子 Block の配置と余白（`> .block { margin-top: ... }`）

やらないこと:
- コンポーネント内部構造の定義
- ページ固有の `scss/` ディレクトリ作成

ページ層 SCSS 例:

```scss
// assets/css/home.scss
@use "@styles/partials/global" as *;
@use "@components/hero/hero-container";
@use "@components/feature/feature-container";
@use "@components/cta/cta-container";

.main-container {
  background: linear-gradient(to bottom, #f0f0f0, #ffffff);

  > .hero-container {
    // @components/hero/hero-container.scss
    margin-top: 0;
  }

  > .feature-container {
    // @components/feature/feature-container.scss
    margin-top: 80px;
  }

  > .cta-container {
    // @components/cta/cta-container.scss
    margin-top: 120px;
  }
}
```

---

## ファイル / ディレクトリ運用

- **1 Block = 1 SCSS ファイル**
- ルート Block 名とファイル名を一致させる（デフォルト）
- 子 Block は `scss/` にフラット配置し、親で `meta.load-css("scss")` を呼ぶ
- 子 Block の集約には `scss/index.scss` を使用（自動生成）
- Sass は **`@use` 前提**（`@import` は非推奨）
- ルートファイル名ケース / 子 Block ディレクトリ名は設定で変更可（`rootFileCase`, `childScssDir`）

例:

```scss
@use "sass:meta";

.parent-block {
  @include meta.load-css("scss");

  > .child-block {
    // @rel/scss/child-block.scss
  }
}
```

`scss/index.scss` の例（手動で書く場合）:

```scss
@use "child-block-a";
@use "child-block-b";
```

補足:
- 生成は `@use` を前提。`@forward` は API を再公開したい場合に限って使用する
- `@forward` を採用する場合は、ツール出力と合わせて統一する（混在させない）

子 Block SCSS の例:

```scss
@use "@styles/partials/global" as *;

// @rel/../parent-block.scss

.child-block {
  display: grid;
  gap: 8px;

  > .title {
    // Element
  }
}
```

---

## @rel コメント（関係性の明示）

目的: Block 間の依存関係とファイル間リンクを明示する。

基本ルール:
- 親 Block の `> .child` 直下に `@rel` コメントを置く
- 子 Block のファイル先頭に親への `@rel` を置く
- 親 Block のファイル先頭にページエントリへのコメントを置く

代表例:

- 親 → 子: `// @rel/scss/child-block.scss`
- 子 → 親: `// @rel/../parent-block.scss`
- 親 → ページ: `// @assets/css/page.scss`
- ページ → Block: `// @components/...`（ページ側の `> .block` 内）

パス解決は `aliasRoots` を使用（Stylelint 側）。CLI は `aliasRoots` を参照しない。

---

## ツール運用

### 共通

- **`spiracss.config.js` が唯一の正解**
- すべてのツールはこの設定を参照（Stylelint / SpiraCSS HTML CLI / 生成）
- `package.json` に `"type": "module"` がある場合は ESM（`export default`）

### SpiraCSS Stylelint プラグイン

- パッケージ: `@spiracss/stylelint-plugin`
- ルール:
  - `spiracss/class-structure`
  - `spiracss/interaction-scope`
  - `spiracss/rel-comments`

要点:
- `createRules()` を使って設定を展開
- `stylelint-scss` と `postcss-scss` が必要
- `aliasRoots` と `stylelint` 設定が必須（`createRules()` 使用時）
- Stylelint v16 以上が必要
- ESM の場合は `createRules(設定オブジェクト)`、CJS の場合は `createRules('./spiracss.config.js')`
- `customSyntax: 'postcss-scss'` と `scss/at-rule-no-unknown: true` を設定

### SpiraCSS HTML CLI

- パッケージ: `@spiracss/html-cli`
- コマンド:
  - `spiracss-html-to-scss`（SCSS 生成）
  - `spiracss-html-lint`（HTML 構造検証）
  - `spiracss-html-format`（プレースホルダ付与）

#### 生成（`spiracss-html-to-scss`）

- `--root`: ルート Block から一括生成（デフォルト）
- `--selection`: 選択断片として生成
- `--stdin`: 標準入力
- `--base-dir`: 出力先
- `--dry-run`: 書き込みなし
- `--json`: JSON 出力（ファイル作成なし）
- `--ignore-structure-errors`: 構造エラーを無視

判定の注意:
- base class は **先頭トークン**（Block/Element 判定対象）
- `-` / `_` / `u-` で始まるクラスは base class にならない
- `--root` は最初の `class` 要素のみを対象にする
- base class が Block 判定に一致しない場合は生成されない

#### 検証（`spiracss-html-lint`）

- `--root`: 最初の要素のみ検証
- `--selection`: 複数断片を検証
- `--json`: `{ file, mode, ok, errors[] }`

検証の注意:
- `class` を持つ要素のみ対象
- `data-*` / `aria-*` は `selectorPolicy` の予約キーのみ対象
- data 値は `valueNaming`（`selectorPolicy` / `variant` / `state`）に従う
- `allowExternalClasses` / `allowExternalPrefixes` は検証除外
- `variant.mode=class` + `state.mode=class` は **state 分離不可**（全 modifier を variant 扱い）

主なエラーコード:
- `INVALID_BASE_CLASS`
- `MODIFIER_WITHOUT_BASE`
- `DISALLOWED_MODIFIER`
- `UTILITY_WITHOUT_BASE`
- `MULTIPLE_BASE_CLASSES`
- `ROOT_NOT_BLOCK`
- `ELEMENT_WITHOUT_BLOCK_ANCESTOR`
- `ELEMENT_PARENT_OF_BLOCK`
- `DISALLOWED_VARIANT_ATTRIBUTE`
- `DISALLOWED_STATE_ATTRIBUTE`
- `INVALID_VARIANT_VALUE`
- `INVALID_STATE_VALUE`

#### プレースホルダ付与（`spiracss-html-format`）

- 子要素あり → Block プレースホルダ付与
- 子要素なし → Element プレースホルダ付与
- Element 名で子を持つ場合は `*-box` へ変換

プレースホルダの形式:
- `blockCase` / `elementCase` に従う（`kebab` / `camel` / `pascal` / `snake`）
- `elementCase=pascal` の場合のみ Element は大文字 1 語になる

制限:
- テンプレート構文を含む HTML は処理対象外
- JSX の `class` / `className` は文字列 / テンプレートリテラルのみ対象
- テンプレート構文検出時は、標準出力なら元の HTML を返し、ファイル出力なら書き込みをスキップ

---

## `spiracss.config.js` の重要項目一覧

AI が変更・生成を行う前に、必ず現在の設定を確認する。

### `aliasRoots`

- エイリアスの解決ルート（Stylelint のパス検証に必須）
- CLI は参照しない
- キーは `@` なし（例: `components` → `@components/...`）
- 値は配列で指定（相対パス推奨 / 絶対パス可）
- `createRules()` 利用時に未設定だとエラー
- 未定義のエイリアスは Stylelint 側では解決できない

### `stylelint`

- `sectionCommentPatterns`（shared / interaction コメント）
  - `createRules()` ではこの設定が各ルールへ展開され、個別指定があればそちらが優先
- `classStructure`
  - 命名: `blockCase`, `blockMaxWords`, `elementCase`, `modifierCase`, `modifierPrefix`, `customPatterns`
  - 構造: `enforceChildCombinator`, `enforceSingleRootBlock`, `enforceRootFileName`
  - 例外: `allowExternalClasses`, `allowExternalPrefixes`
  - 深さ: `allowElementChainDepth`
  - ディレクトリ: `componentsDirs`, `childScssDir`, `rootFileCase`
  - セクションコメント: `sharedCommentPattern`, `interactionCommentPattern`
  - ルール内上書き: `selectorPolicy`
  - `enforceRootFileName` は `componentsDirs` 配下のみ対象（`assets/css`, `index.scss`, `_*.scss` は除外）
- `interactionScope`
  - `allowedPseudos`, `requireAtRoot`, `requireComment`, `requireTail`, `enforceWithCommentOnly`
  - セクションコメント: `interactionCommentPattern`
  - ルール内上書き: `selectorPolicy`
- `relComments`
  - `validatePath`, `requireInScssDirectories`, `requireWhenMetaLoadCss`
  - `requireChildRelComments`, `requireChildRelCommentsInShared`, `requireChildRelCommentsInInteraction`
  - `requireParentRelComment`, `skipFilesWithoutRules`, `childScssDir`
  - セクションコメント: `sharedCommentPattern`, `interactionCommentPattern`
  - 命名 / 除外: `naming`, `allowExternalClasses`, `allowExternalPrefixes`
  - `validatePath` は `aliasRoots` を参照

### `selectorPolicy`

- `variant.mode` / `state.mode`（`data` or `class`）
- `variant.dataKeys` / `state.dataKey` / `state.ariaKeys`
- `valueNaming`（値の命名）
- `variant.valueNaming` / `state.valueNaming` で個別上書き可能
- `aria-*` の値は検証対象外
- 既定値: `valueNaming` は `kebab` + `maxWords=2`、`data-variant` / `data-state`、`aria-expanded` / `aria-selected` / `aria-disabled`

### `htmlFormat`

- `classAttribute`: `class` / `className`

### `generator`

- `globalScssModule`（生成 SCSS の先頭 `@use`）
- `pageEntryAlias` / `pageEntrySubdir`
- `rootFileCase`
- `childScssDir`
- `layoutMixins`

---

## AI 作業チェックリスト

- `spiracss.config.js` を最初に確認する
- Block / Element を命名規則で判定する
- `Block > Block / Element` 以外の構造を作らない
- Variant / State の区別を守り、原則は基本構造。インタラクション初期値は Variant を interaction に置いてよい
- `--shared` / `--interaction` のコメントを省略しない
- `--shared` / `--interaction` はルート Block 直下に置く
- 1 Block = 1 SCSS ファイルを維持する
- `@rel` コメントを欠かさない（設定に従う）
- 迷ったら「構造の責務は親 / 内部レイアウトは子」の原則で判断する

---

## 関連ドキュメント

- `docs_spira/styleguide.md`
- `docs_spira/component.md`
- `docs_spira/layers.md`
- `docs_spira/guidelines.md`
- `docs_spira/tooling/index.md`
- `docs_spira/tooling/stylelint.md`
- `docs_spira/tooling/html-cli.md`
- `docs_spira/tooling/spiracss-config.md`
