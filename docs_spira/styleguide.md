# SpiraCSS スタイルガイド

**SpiraCSS** = **S**implified **P**ractical **I**ntegrated **R**elational **A**rchitecture for **CSS**

SpiraCSS は、実装者の感覚でブレがちな判断を最小限の原則に落とし込み、ツール検証で人間と AI が同じ基準で一貫設計できる CSS アーキテクチャです。

## 概要

### CSS レイヤー

プロジェクト全体の CSS を 3 つのレイヤーに分けます。

| レイヤ | 役割 | 例 |
| ------ | ---- | --- |
| **グローバル層** | サイト全体の設定値・関数・Mixin・ユーティリティ | `variables.scss`, `utilities.scss` |
| **ページ層** | ページごとのエントリ CSS（コンポーネントの配置） | `home.scss`, `about.scss` |
| **コンポーネント層** | Block / Element + Variant / State による部品設計 | `hero-container.scss` |

### コンポーネント

1. **Block は 2 語、Element は 1 語** — クラス名だけで構造が判定できる
2. **Variant / State は data 属性で分離** — 見た目と状態の責務が明確
3. **構造は常に `Block > 子（Block / Element）` を 1 つのセットで考える** — すべての構造はその繰り返し
4. **1 Block = 1 ファイル** — ファイルを開けばその Block の全貌がわかる

#### 1. 命名（Block / Element / Utility）

構造を表すクラスは Block / Element、補助は Utility（`u-`）として分けます。

| 種別 | ルール | 例 |
| ---- | ------ | --- |
| **Block** | 2 語（デフォルト / 区切り形式は設定可） | `.hero-container`, `.card-list` |
| **Element** | 1 語のみ | `.title`, `.body` |
| **Utility** | `u-` 接頭辞 | `.u-hidden`, `.u-sr-only` |

#### 2. Variant / State（data 属性）

Variant は `data-variant`、State は `data-state` / `aria-*` で表現し、見た目と状態の責務を分離します。

| 種別 | HTML | SCSS |
| ---- | ---- | ---- |
| **Variant** | `data-variant="primary"` | `&[data-variant="primary"]` |
| **State** | `data-state="active"` | `&[data-state="active"]` |
| **ARIA 状態** | `aria-expanded="true"` | `&[aria-expanded="true"]` |

**命名ルール**: 属性名・値ともに小文字 + ハイフンのみ（例: `data-variant="primary"`, `data-state="loading"`）

**配置ルール:**
- `data-variant` は基本構造セクションに書く
- `data-state` / `aria-*` は interaction セクションに書く
- 状態で見た目を変える場合は State 側に書く

#### 3. 構造ルール（親子関係）

SpiraCSS は、構造（階層）を **Block が持つ** 前提で組み立てます。Element は Block の部品で、構造の親にはしません（入れ子が必要なら子 Block に切り出します）。

- **許可**: `Block > Block`, `Block > Element`
- **禁止**: `Element > Block`, `Element > Element`（例外: レイアウト目的ではない装飾・意味付けの場合のみ可）
- 構造を表すセレクタは原則 `>` 子セレクタで 1 段ずつ指定

#### 4. ファイル（1 Block = 1 ファイル）

- 各 Block は 1 つの SCSS ファイルに対応
- 各 SCSS ファイルには、ファイル名と同名の Block を 1 つだけ定義する
- `stylelint.classStructure.enforceSingleRootBlock` はデフォルトで有効（無効化すると同一ファイル内のルート Block 重複チェックをスキップ）
- 子 Block は `scss/` ディレクトリに配置し、`meta.load-css()` で集約
- リンクコメント（`@assets` / `@rel`）で親子関係を明示

例: `parent-block.scss`

```scss
@use "sass:meta";

// @assets/css/page.scss

.parent-block {
  @include meta.load-css("scss");

  > .child-block {
    // @rel/scss/child-block.scss
  }
}
```

### SCSS セクション構成

SCSS は 3 セクションに分けて記述します：

- **基本構造**: Block の構造 + Variant
- **`--shared`**: Block 配下専用の共通クラス
- **`--interaction`**: State / hover / ARIA 状態
- **配置**: `--shared` / `--interaction` はルート Block 直下に置く（子ルール内に置かない）
- **書き方**: interaction セクション内のセレクタは `&` 起点で書く

```scss
.sample-block {
  // 基本構造 + Variant ---
  display: flex;

  &[data-variant="primary"] { ... }  // Variant は基本構造セクションに配置

  > .header { ... }
  > .body { ... }

  // --shared ---
  .btn { ... }  // Block 配下専用の共通クラス

  // --interaction ---
  @at-root & {
    &:hover { ... }
    &[data-state="active"] { ... }   // State は interaction セクションに配置
    &[aria-expanded="true"] { ... }  // ARIA 状態も interaction に配置
  }
}
```

### 設定とツール連携

運用は共通設定（`spiracss.config.js`）とツールで統一します。

- **自動生成**: `@rel` コメントや構造の SCSS など面倒な部分は CLI / VS Code 拡張で自動生成
- **自動検証**: ルール違反は Stylelint が人間にも AI にも同じ基準で検出
- **設定でカスタマイズ**: 命名・コメント形式・検証の強さなどは `spiracss.config.js` でプロジェクト / チームの方針に合わせて調整できる

生成・検証のすべてが同じ設定ファイルを参照するため、方針に合わせて設定を変えてもツールが同じ基準で追従します。「書く」こともできますが、「生成して検証する」運用と特に相性が良い設計です。

## クイックスタート

→ [クイックスタート](quickstart.md): 導入して動かすまでの最短手順

## ドキュメント

詳細なルールと解説は、以下のドキュメントに分かれています。

| ドキュメント | 内容 |
| ------------ | ---- |
| [CSS レイヤー](layers.md) | グローバル層・ページ層・コンポーネント層の責務と境界 |
| [コンポーネント](component.md) | 命名・親子関係・Variant/State・SCSS・ファイル構成 |
| [ガイドライン](guidelines.md) | SpiraCSS が推奨するルール |
| [AI用のドキュメントファイル](ai-guide.md) | AI用のドキュメントファイル |

## ツール・設定

| ドキュメント | 内容 |
| ------------ | ---- |
| [ツール連携](tooling/index.md) | Stylelint / VS Code 拡張 / CLI の使い方 |
| [spiracss.config.js](tooling/spiracss-config.md) | 共通設定ファイルの詳細（selectorPolicy など） |
