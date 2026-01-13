# SpiraCSS 設計原則

SpiraCSS は、HTML/CSS の構造的特徴を最小の原則に整理した CSS アーキテクチャです。CSS 設計で起きがちな構造判断のブレを、個人の感覚ではなく原則に基づいて抑えます。AIエージェントとの協働による実装とツール検証を前提に、作業時間の短縮と品質の一定化を目指しています。

このページは SpiraCSS の入口として、**デフォルト運用**の要点だけをまとめたクイックリファレンスです。例外・設定・コード例の詳細は各ドキュメントを正とします。

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
2. **Variant / State は分離して表現（デフォルトは data 属性。設定で変更可）** — `data-variant` / `data-state`（ARIA 状態も State として扱う。既定の対象は設定の allowlist に従う）
3. **構造は常に `Block > 子（Block / Element）` を 1 つのセットで考える** — すべての構造はその繰り返し
4. **1 Block = 1 ファイル** — その Block の入口を一箇所に揃える

#### 1. 命名（Block / Element / Utility）

構造を表すクラスは Block / Element、補助は Utility（`u-`）として分けます。

| 種別 | ルール | 例 |
| ---- | ------ | --- |
| **Block** | 2 語（デフォルト / 区切り形式は設定可） | `.hero-container`, `.card-list` |
| **Element** | 1 語のみ | `.title`, `.body` |
| **Utility** | `u-` 接頭辞 | `.u-hidden`, `.u-sr-only` |

補足: 本ドキュメントでは「語」は命名セグメントを指します。ケバブケース（既定）の場合はハイフン区切りです（例: `hero-container` は 2 語）。

補足: Element は **常に 1 語**です（詳細は [コンポーネント](component.md) を参照）。

#### 2. Variant / State

Variant / State は **data モード**（デフォルト）では Variant を `data-variant`、State を `data-state` で表現し、見た目と状態の責務を分離します。ARIA 状態も State として扱います（対象の ARIA 状態は設定の allowlist に従う）。表現モードや命名ルールは [spiracss.config.js](tooling/spiracss-config.md) で変更できます。

| 種別 | HTML | SCSS |
| ---- | ---- | ---- |
| **Variant** | `data-variant="primary"` | `&[data-variant="primary"]` |
| **State** | `data-state="active"` | `&[data-state="active"]` |
| **ARIA 状態** | `aria-expanded="true"` | `&[aria-expanded="true"]` |

**デフォルトの命名**: 値は小文字 + ハイフン（kebab）で 1〜2 語（例: `data-variant="primary-dark"`）。ARIA 属性の値は検証対象外です。

**配置ルール:**
- 原則、`data-variant` は基本構造セクションに書く。インタラクション初期値は `--interaction` に置いてよい
- `data-state` と ARIA 状態は interaction セクションに書く
- 状態で見た目を変える場合は State 側に書く

※ デフォルトは data モードですが、プロジェクト方針により class モード/ハイブリッドにもできます（詳細: [コンポーネント](component.md) / [spiracss.config.js](tooling/spiracss-config.md)）。

#### 3. 構造ルール（親子関係）

SpiraCSS は、構造（階層）を **Block が持つ** 前提で組み立てます。Element は Block の部品で、構造の親にはしません（入れ子が必要なら子 Block に切り出します）。

- **許可**: `Block > Block`, `Block > Element`
- **禁止**: `Element > Block`, `Element > Element`（例外: レイアウト目的ではない装飾・意味付けの場合のみ可）
- 基本構造セクションで「構造」を表すセレクタは原則 `>` 子セレクタで 1 段ずつ指定（shared / interaction は目的により緩和されます）

#### 4. ファイル（1 Block = 1 ファイル）

- 各 Block は 1 つの SCSS ファイルに対応
- 各 SCSS ファイルには、ファイル名と同名の Block を 1 つだけ定義する
- Stylelint を導入している場合、デフォルトで「1 ファイル 1 ルート Block」を検証する（導入・設定は [Stylelint](tooling/stylelint.md) を正とする）
- 子 Block は `scss/` ディレクトリに配置し、ルート Block で `meta.load-css()` を使って取り込む（デフォルト）
- リンクコメント（`@assets` / `@rel`）で関連ファイルを辿れるようにする（デフォルト。詳細は [コンポーネント](component.md) を参照）

### SCSS セクション構成

SCSS は基本的に次の 3 セクションで整理します（`--shared` / `--interaction` は必要なときだけ）：

- **基本構造**: Block の構造 + Variant
- **`--shared`**: Block 配下専用の共通クラス（必要なときだけ）
- **`--interaction`**: State / hover / ARIA 状態＋transition/animation 関連（必要なときだけ）

書き方やコード例の詳細は [コンポーネント](component.md) を参照してください。

### 設定とツール連携

運用は `spiracss.config.js` とツールで統一します。導入・設定の詳細は [spiracss.config.js](tooling/spiracss-config.md) / [ツール概要](tooling/index.md) を参照してください。

- **自動生成**: `@rel` コメントや構造の SCSS など面倒な部分は CLI / VS Code 拡張で自動生成
- **自動検証**: ルール違反は Stylelint が人間にも AI にも同じ基準で検出
- **設定でカスタマイズ**: 命名・コメント形式・検証の強さなどは [spiracss.config.js](tooling/spiracss-config.md) でプロジェクト / チームの方針に合わせて調整できる

生成・検証のすべてが同じ設定ファイルを参照するため、方針に合わせて設定を変えてもツールが同じ基準で追従します。「書く」こともできますが、「生成して検証する」運用と特に相性が良い設計です。

## 次のステップ

→ [クイックスタート](quickstart.md): 導入して動かすまでの最短手順

## SpiraCSS ドキュメント
- 設計原則
- [クイックスタート](quickstart.md)
- [CSS レイヤー](layers.md)
- [コンポーネント](component.md)
- [ガイドライン](guidelines.md)
- [設計思想](philosophy.md)

## ツール
- [ツール概要](tooling/index.md)
- [spiracss.config.js](tooling/spiracss-config.md)
- [SpiraCSS Stylelint プラグイン](tooling/stylelint.md)
- [SpiraCSS HTML CLI](tooling/html-cli.md)
- [SpiraCSS Comment Links](tooling/comment-links.md)
- [SpiraCSS HTML to SCSS](tooling/html-to-scss.md)
