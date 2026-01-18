# SpiraCSS HTML CLI

VS Code 拡張と同じロジックを使った CLI ツールです。CI/CD やスクリプトからの利用に適しています。
解析仕様やテンプレート対応の詳細は [SpiraCSS HTML to SCSS](html-to-scss.md) を参照してください。

## インストール

```bash
yarn add -D @spiracss/html-cli
# or
npm install -D @spiracss/html-cli
```

## コマンド一覧

| コマンド | 説明 |
|----------|------|
| `spiracss-html-to-scss` | HTML から SCSS を自動生成 |
| `spiracss-html-lint` | HTML 構造が SpiraCSS ルールに従っているか検証 |
| `spiracss-html-format` | プレースホルダクラス（既定 `block-box` / `element`）を付与 |

## spiracss-html-to-scss

HTML / テンプレートから SCSS ファイルを自動生成します。デフォルトで構造 lint を実行し、エラーがある場合は終了します（`--ignore-structure-errors` で無視）。

### 基本的な使い方

```bash
# ルートモード（コンポーネントのルートを 1 つの Block として扱う）
npx spiracss-html-to-scss --root path/to/file.html

# 選択モード（選択断片として扱う）
npx spiracss-html-to-scss --selection path/to/fragment.html

# 標準入力から
cat file.html | npx spiracss-html-to-scss --selection --stdin --base-dir src/components/sample
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--root` | コンポーネントのルートを 1 つの Block として扱う（デフォルト） |
| `--selection` | 選択断片として扱う |
| `--stdin` | 標準入力から HTML を読み取る |
| `--base-dir PATH` | SCSS 出力先ディレクトリ（入力ファイル指定時は上書き先、`--stdin` 使用時は省略でカレント） |
| `--dry-run` | ファイルを書き込まず、出力パスだけを表示 |
| `--json` | 生成結果を JSON で標準出力（ファイル作成なし、AI/スクリプト向け） |
| `--ignore-structure-errors` | 構造 lint のエラーを無視して生成を続行 |

**補足**: モードは `--selection` の有無で判定されるため、`--root` は互換維持のためのオプションです（両方指定時は `--selection` が優先）。

**注意**: `--root` モードは入力から 1 要素をルートとして解釈し、その要素を起点に配下を含めて生成します。該当要素に `class` が無い場合は生成できずエラーになります。コンポーネント単位の入力に合わせて使ってください。

**注意**: `--selection` モードで class 属性を持つ要素が 1 つも無い場合はエラーになります。

**注意**: `--ignore-structure-errors` を付けても、ルート要素が存在しない / 複数ある / `class` が無いなど、生成に必要な前提を満たさない場合はエラー終了します。

**補足**: エラーメッセージの文言は変更される可能性があるため、文字列一致に依存しないでください。

### 出力例

```text
your-component/
├─ hero-section.scss      ← ルート Block
├─ scss/
│   ├─ feature-card.scss  ← 子 Block
│   └─ index.scss         ← @use 自動マージ
└─ your-template.html
```

### 出力先のルール

- 入力ファイル指定: 入力ファイルと同じディレクトリ（`--base-dir` 指定時は上書き）
- `--stdin`: `--base-dir`（省略時はカレントディレクトリ）
- 子 Block は `childScssDir`（既定 `scss`）

### 生成仕様の補足

- 同一 base class が複数ある場合、modifier / variant / state / aria は重複排除して統合されます
- 予約キーは `selectorPolicy` で変更できます（例: `data-theme`, `data-status`, `aria-hidden`, `aria-expanded`）
- data モードでは `variant` は基本構造に出力されます（インタラクション初期値は手動で interaction に移してよい）

## spiracss-html-lint

HTML 構造が SpiraCSS の Block / Element / Modifier ルールに従っているかを検証します。

### 基本的な使い方

```bash
# コンポーネントのルート要素として検証
npx spiracss-html-lint --root path/to/file.html

# 標準入力から断片を検証
cat fragment.html | npx spiracss-html-lint --selection --stdin

# JSON 形式で結果を取得
npx spiracss-html-lint --root path/to/file.html --json
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--root` | コンポーネントのルートを 1 つの Block として扱う（デフォルト） |
| `--selection` | 複数の選択断片として扱う |
| `--stdin` | 標準入力から HTML を読み取る |
| `--json` | `{ file, mode, ok, errors[] }` 形式で JSON 出力 |

**注意**: `--root` モードは入力から 1 要素をルートとして解釈し、その要素を起点に配下も検証対象とします。該当要素に `class` が無い場合は `INVALID_BASE_CLASS` になります。コンポーネント単位の入力に合わせて使ってください。複数のルート Block を検証する場合は `--selection` モードを使用してください。

**補足**: モードは `--selection` の有無で判定されるため、`--root` は互換維持のためのオプションです（両方指定時は `--selection` が優先）。

### エラーコード

| コード | 説明 |
|--------|------|
| `INVALID_BASE_CLASS` | Block/Element の命名規則に違反、またはルート要素に class が無い／検証対象要素が見つからない |
| `MODIFIER_WITHOUT_BASE` | Modifier クラスのみで基底クラスがない |
| `DISALLOWED_MODIFIER` | data モード（variant/state 両方 `data`）で Modifier クラスが使われている |
| `UTILITY_WITHOUT_BASE` | ユーティリティクラスのみで基底クラスがない |
| `MULTIPLE_BASE_CLASSES` | 複数の基底クラスが存在 |
| `ROOT_NOT_BLOCK` | ルート要素が Block ではない |
| `ELEMENT_WITHOUT_BLOCK_ANCESTOR` | Element が Block の子孫ではない |
| `ELEMENT_PARENT_OF_BLOCK` | Element が Block の親になっている |
| `DISALLOWED_VARIANT_ATTRIBUTE` | class モードで data-variant などのバリアント属性が使われている |
| `DISALLOWED_STATE_ATTRIBUTE` | class モードで data-state/aria-* などの状態属性が使われている |
| `INVALID_VARIANT_VALUE` | data モードのバリアント値が valueNaming に違反 |
| `INVALID_STATE_VALUE` | data モードの状態値が valueNaming に違反 |
| `UNBALANCED_HTML` | HTML の開始・終了タグが不整合 |
| `MULTIPLE_ROOT_ELEMENTS` | ルートモードで複数のルート要素が検出された |

**補足**:
- `--selection` モードでは `class` を持つ要素のみ検証（該当要素が無い場合は `INVALID_BASE_CLASS`）
- `data-*` / `aria-*` は予約キー（`variant.dataKeys` / `state.dataKey` / `state.ariaKeys`）のみ対象
- data 値の命名は `selectorPolicy.valueNaming` と `variant/state.valueNaming` で検証
- `stylelint.base.external.classes` / `stylelint.base.external.prefixes` に一致するクラスは外部扱い（base 判定から除外）
- 先頭トークンが外部クラスで、外部以外のクラスが後続にある場合は `INVALID_BASE_CLASS`（Block/Element を先頭に置く必要あり）。外部クラスのみの要素は許容
- `variant.mode=class` + `state.mode=class` は state 分離不可のため **全 modifier を variant 扱い**
- エラーメッセージの文言は変更される可能性があるため、文字列一致に依存しないでください

## spiracss-html-format

HTML にプレースホルダクラスを付与して SpiraCSS 構造を整形します。

### 基本的な使い方

```bash
# ファイルから読み取り、別ファイルに出力
npx spiracss-html-format path/to/file.html -o formatted.html

# ファイルから読み取り、標準出力
npx spiracss-html-format path/to/file.html

# 標準入力から読み取り、ファイルに出力
cat file.html | npx spiracss-html-format --stdin -o formatted.html
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--stdin` | 標準入力から HTML を読み取る |
| `-o, --output PATH` | 出力先ファイルパス（省略時は標準出力） |

出力属性は `spiracss.config.js` の `htmlFormat.classAttribute` に従います（既定は `class`）。`className` を使う場合は `className` を指定してください。内部では `class` / `className` を一時的に `data-spiracss-classname` に変換して処理し、出力時に設定値へ戻します。

### 付与されるクラス

すべての子孫要素を再帰的に走査し、SpiraCSS の Block > Element 構造に整形します。

- **子要素を持つ要素** → Block プレースホルダを先頭に付与
- **子要素を持たない要素（葉ノード）** → Element プレースホルダを先頭に付与
- **既に Block 名がある要素** → そのまま維持し、内部を再帰処理
- **Element 名があるが子を持つ要素** → Block 形式に変換（例: `title` → `title-box`）

※ ルート要素が Element の場合は Element → Block 変換を行わず、`block-box title` のように Block プレースホルダを先頭に付与します（Block/Element 以外でも同様）。

プレースホルダ名は `blockCase` / `elementCase` 設定に応じて変わります（両者は独立して設定可能）：

| case | Block プレースホルダ | Element プレースホルダ |
|------|----------------------|------------------------|
| `kebab`（既定） | `block-box` | `element` |
| `camel` | `blockBox` | `element` |
| `pascal` | `BlockBox` | `Element` |
| `snake` | `block_box` | `element` |

**注意**: Element は **常に 1 語**です。`elementCase=camel` は小文字 1 語（例: `element`）、`elementCase=pascal` は大文字始まり 1 語（例: `Element`）のみ許可され、`bodyText` / `BodyText` のような内部大文字は使えません。`customPatterns` を指定している場合、プレースホルダ（`block-box` / `element`）が命名規則に合わない可能性があるため整合性を確認してください。

### 制限事項

テンプレート構文（EJS `<% %>`, Nunjucks `{{ }}` `{% %}` `{# #}`, Astro frontmatter 等）を含む HTML は処理をスキップします。これらの構文は HTML パース時に破壊される恐れがあるため、静的な HTML 断片に対してのみ使用してください。

JSX の `class` / `className` は **文字列 / テンプレートリテラル** の場合のみ対応し、`class={styles.foo}` / `className={styles.foo}` のような動的バインディングがある場合は HTML 全体の処理をスキップします。

テンプレート構文が検出された場合：
- **標準出力モード**（`-o` 未指定）: 元の HTML をそのまま出力し、標準エラーに警告を表示
- **ファイル出力モード**（`-o` 指定）: ファイルへの書き込みをスキップし、標準エラーに警告のみ表示（mtime 更新を防止）
- 断片 HTML で `<template>` / `<textarea>` の閉じタグが欠けている場合は挙動保証なし（明示検知は行いません）

## 設定

すべての CLI は `spiracss.config.js` の設定を参照します。`generator` / `htmlFormat` / `stylelint` などの詳細は [spiracss.config.js](spiracss-config.md) と [spiracss.config.example.js](spiracss.config.example.js) を参照してください。`package.json` に `"type": "module"` がある場合は `export default` を使用してください。

HTML CLI は CJS バンドルのため、Node を `--disallow-code-generation-from-strings` で起動している場合は ESM 設定を読み込めません。CJS 運用へ切り替え可能な場合は `module.exports` に切り替えるか、フラグを外してください。`"type": "module"` のプロジェクトでは `spiracss.config.js` を CJS にできないため、実質フラグを外す必要があります（`.cjs` / `.mjs` の自動探索はありません）。

`spiracss.config.js` が存在するのに読み込みできない場合は、CLI がエラー終了します（設定の記法や `type: "module"` を確認してください）。

設定の全体像は [spiracss.config.js](spiracss-config.md) を参照してください。

## 関連ツール
### ツール
- [SpiraCSS Stylelint プラグイン](stylelint.md)
- SpiraCSS HTML CLI
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
