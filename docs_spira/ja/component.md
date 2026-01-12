# コンポーネント

コンポーネント層は、SpiraCSS の 3 層アーキテクチャの中で最も詳細なルールを持つ層です。Block / Element による構造設計、Variant / State による見た目と状態の分離、SCSS のセクション構成、ファイル管理までを一貫したルールで整理します。

- [ファイル構成](#ファイル構成)
- [命名規則](#命名規則)
- [親子関係（構造ルール）](#親子関係構造ルール)
- [Variant / State](#variant--state)
- [SCSS セクション構成](#scss-セクション構成)
- [@keyframes](#keyframes)
- [@rel コメント](#rel-コメント)

## ファイル構成

**1 Block = 1 SCSS ファイル** が基本です。全体のディレクトリ構造は [CSS レイヤー](layers.md) を参照してください。

```text
article-card/
├── article-card.webc      # テンプレート
├── article-card.scss      # ルート Block
└── scss/                  # 子 Block を格納
    ├── card-header.scss
    ├── card-body.scss
    └── index.scss         # 子 Block をまとめて @use
```

- **テンプレート**: フレームワークの命名規則に従う（WebC/Nunjucks: ケバブケース、Astro/Next.js/Nuxt: PascalCase など）
- **SCSS**: Block 名と同名のファイル（命名形式は設定で変更可）
- **scss/**: 子 Block をフラット配置し、`index.scss` で集約
- **トップレベル**: ルート Block を起点にし、他のクラスは内側にネストする

### 子 Block のスコープ化

ルート Block で `@include meta.load-css("scss")` を呼ぶと、子 Block が親セレクタにネストして展開され、親 Block 外へスタイルが漏れません。

例: ルート Block の SCSS（`article-card.scss`）

```scss
@use "sass:meta";

.article-card {
  @include meta.load-css("scss"); // 子 Block を展開
}
```

基本は、子 Block を親 Block の `scss/` に置き、`meta.load-css` のスコープ内に閉じます。

### 共通化したいものが出てきたら

対象範囲に応じてどこに置くか決めます：

- **同じ親 Block 配下で使う共通クラス** → shared セクションにまとめる
- **同じページ内の複数コンポーネントで共通化したい** → ページ内専用の共通コンポーネント（新しい親 Block）を作る（`components/pages/...`）
- **複数ページで共通化したい** → `components/parts/`（全ページなら `components/common/`）へ独立

## 命名規則

SpiraCSS では、**構造（Block / Element）** と **Variant / State（バリエーション・状態）** を明確に分離します。

### Block / Element / Utility

| 種別        | 命名ルール           | 例                                     |
| ----------- | -------------------- | -------------------------------------- |
| **Block**   | ケバブケース 2 語（デフォルト） | `.hero-container`, `.feature-list`    |
| **Element** | 1 語のみ             | `.title`, `.body`                     |
| **Utility** | `u-` 接頭辞          | `.u-hidden`, `.u-sr-only`             |

用語: 本ドキュメントでは「語」は命名セグメントを指します。ケバブケース（既定）の場合はハイフン区切りです（例: `hero-container` は 2 語）。

- Block は 1 つの UI コンポーネントやセクション（=意味のある塊）そのものの名前を表します
- Element は Block 内だけで意味を持つ要素の名前です（他の Block から単体では使わない）
- Utility は構造（Block / Element）ではなく、単機能の補助クラスです

**注意**: Element は **常に 1 語**です。`elementCase=camel/pascal` でも内部大文字で語分割しません（`bodyText` / `BodyText` は不許可）。

> 命名は **意味が明確であること** を最優先し、短さよりも可読性を優先します。
> 補足: `customPatterns` を使う場合、HTML プレースホルダ（`block-box` / `element`）と一致しない可能性があるため整合性を確認してください。

## 親子関係（構造ルール）

コンポーネントのクラスセレクタ（Block / Element）の関係は、命名規則を前提に次のルールに従います。

### 許可される構造

- `Block > Block`
- `Block > Element`

### 禁止される構造（原則）

- `Element > Block`
- `Element > Element`
- 親 Block の SCSS 内で、`> .child-block > .element` のように子 Block 配下の Element まで直接指定する構造

### 例外（Element > Element が許可されるケース）

レイアウト目的ではない装飾・意味付けに限り、`Element > Element` を使うことを推奨します（例: `.content > .paragraph > .emphasis > .strong`）。

### ネストの深さ

**Block のネスト:**

- `Block > Block` までは許可しますが、`Block > Block > Block` のような 3 段以上の Block 連鎖は原則避けます
- 孫以降の階層に「意味のある塊」が現れた場合は、その塊を親 Block 直下の別 Block に格上げし、`親 Block > 子 Block` の関係に整理できないかを検討します
- SCSS ファイル単位では、親 Block の SCSS には自分自身と直下の `> .child` だけを書き、`> .child-block > .element` のような孫セレクタは子 Block 側の SCSS に任せます

**Element のネスト:**

- Element 連鎖（`Element > Element > ...`）は、上記の例外（レイアウト目的ではない装飾・意味付け）に限り許可します
- 深さのデフォルト上限は最大 4 段（`Block > Element > Element > Element > Element`）を目安とします
- この上限をどこまで厳しく見るかはチームごとに基準を決め、4 段を超える場合は Block への格上げやマークアップの見直しを優先的に検討します

### 階層構造の例

例: 親 Block 側の正しい構造（`search-form.scss`）

```scss
.search-form {
  // Block (2 単語)
  > .field {
    // Element (1 単語)
  }
  > .actions-container {
    // 子 Block (2 単語)
    // この Block における子 Block の配置だけを指定（内部レイアウトは actions-container 側の SCSS に任せる）
  }
}
```

例: 親 Block 側の間違った構造（`search-form.scss`）

```scss
.search-form {
  > .actions-container {
    > .button {
      // NG: 親 Block（.search-form）から子 Block（.actions-container）配下の Element（.button）まで指定している
    }
  }
}
```

例: 子 Block 側の正しい構造（`actions-container.scss`）

```scss
.actions-container {
  // `.actions-container` 自体を 1 つのコンポーネント（Block）として扱い、内部レイアウトやスキンはこちらに集約する

  > .button {
    // Element (1 単語)
  }
}
```

コンポーネントは、本質的には「Block の直下に Block/Element がぶら下がる」という単純な組み合わせの繰り返しだけで表現されます。どれだけ複雑な画面でも、このパターンから外れないように制約することで、構造が肥大化・破綻しにくくなります。

## Variant / State

### 役割の整理

- **構造（Block / Element）**: クラスで表現（従来どおり）
- **Variant（バリアント）**: 見た目の静的な差分（サイズ/トーン/レイアウトなど）
- **State（状態）**: 動的に切り替わるもの（open/closed/loading/selected など）

**重要**: JS で切り替えるかどうかは分類基準にしない（意味で決める）。

### 表現モード

Variant / State の表現は **data モード**（デフォルト・推奨）と **class モード** があります。  
プロジェクトやチームの方針に応じて `spiracss.config.js` で選択できます。

#### data モード（デフォルト）

| 種別 | 用途 | HTML | SCSS | 配置セクション |
| ---- | ---- | ---- | ---- | -------------- |
| **Variant** | 見た目のバリエーション | `data-variant="primary"` | `&[data-variant="primary"]` | 基本構造（原則） |
| **State** | インタラクション状態 | `data-state="active"` | `&[data-state="active"]` | `--interaction` |
| **ARIA 状態** | アクセシビリティ状態 | `aria-expanded="true"` | `&[aria-expanded="true"]` | `--interaction` |

> この分離により、「これは見た目のバリエーション？インタラクション状態？」という迷いがなくなり、SCSS の基本配置指針が明確になります。

**配置ルール:**
- 原則、`data-variant` は基本構造セクションに書く。インタラクション初期値は `--interaction` に置いてよい
- `data-state` / `aria-*` は interaction セクションに書く
- 状態で見た目を変えたい場合は Variant ではなく State 側に書く

#### class モード

| 種別 | 命名ルール | 例 |
| ---- | ---------- | --- |
| **Modifier** | 先頭に `-`（ケバブケース 1〜2 語） | `.-primary`, `.-active` |

> class モードでは Variant と State が同じ Modifier として扱われるため、クラス名だけでは区別できません。SCSS の配置セクションは実装者が判断する必要があります。
> 判断基準は data モードと同じで、「状態で見た目を変えるものは interaction」、「静的な見た目の差分は基本構造」です。

### データ属性の命名・値ルール

| 種別 | デフォルト属性名 | 値の形式 | 例 |
| ---- | ---------------- | -------- | --- |
| **Variant** | `data-variant` | kebab 1〜2 語 | `data-variant="primary-dark"` |
| **State** | `data-state` | kebab 1〜2 語 | `data-state="loading"` |

- Variant を複数の属性に分けることもできます（例: `data-variant="primary"` と `data-size="large"` を併用）
- Variant と State でモードを別々に設定することもできます（例: Variant は data、State は class）

設定ファイルで指定すると、Stylelint での検証や CLI での生成に反映されます。

### 設定例

```js
// spiracss.config.js
module.exports = {
  selectorPolicy: {
    valueNaming: { case: 'kebab', maxWords: 2 },
    variant: {
      mode: 'class', // Variant は class モード
    },
    state: {
      mode: 'data', // State は data モード
      dataKey: 'data-state',
      ariaKeys: ['aria-expanded', 'aria-selected', 'aria-disabled'],
    }
  }
}
```

## SCSS セクション構成

各 Block の SCSS ファイルは、基本的に次の順番でセクションを並べます：

1. **基本構造セクション**: `Block` 本体と `Block > Block` / `Block > Element` のレイアウト・スキン + Variant
2. **shared セクション**: その Block 配下ツリーだけで使うローカル共通クラス（必要なときだけ）
3. **interaction セクション**: 状態変化や hover / focus などのインタラクション関連スタイル（必要なときだけ）

shared / interaction はルート Block 直下に配置します（@layer/@supports/@media/@container/@scope のラッパー内でも可）。

> Stylelint のセクション判定コメント（`// --shared` / `// --interaction`）は `spiracss.config.js` で変更できます。

### SCSS ファイル全体の構造例

```scss
.sample-block {
  // 基本構造 -----------------------------------
  display: block;

  &[data-variant="primary"] { ... }  // Variant は原則基本構造（インタラクション初期値は interaction も可）

  > .sample-header {
    // 子 Block / Element のレイアウト・スキン
  }

  > .sample-body {
    // 子 Block / Element のレイアウト・スキン
  }

  // --shared ----------------------------------------
  .btn {
    // この Block 配下だけで使う共通ボタン風スタイル
  }

  // --interaction -----------------------------------
  @at-root & {
    &:hover { ... }
    &[data-state="active"] { ... }   // State は interaction セクションに配置
    &[aria-expanded="true"] { ... }  // ARIA 状態も interaction に配置
  }
}
```

### 1. 基本構造セクション

「基本構造セクション」に何を書くかを整理します。

#### プロパティ配置の早見表

| カテゴリ                         | 代表的なプロパティ例                                                                                      | 書く場所                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| コンテナ側のレイアウト           | `display:flex/grid`, `gap`, `justify-*`, `align-*`, `grid-template-*`              | Block 本体（例: `.sample-block { ... }`）             |
| 親から見たアイテム側のレイアウト | `margin-top`（縦方向の余白）, 親基準の `width/height/max-*`, `flex`, `order`, `align-self` | 親 Block の直下（例: `.sample-block > .child { ... }`）          |
| 子 Block 内部のレイアウト        | `text-align`, `line-height`, `padding`, 子内部の `gap` など                                               | 子 Block / Element 自身   |

#### 判断基準

どこに書くか迷ったときは、「そのプロパティは誰の責務か」を基準にします。

- **コンテナ側**: 直下の子をどう並べるか（flex/grid、`gap` など）→ Block 本体に書く
- **アイテム側**: 親の都合で子のサイズ・位置・余白を変える → 親 Block の `> .child` に書く
- **子が複雑になった**: 子要素が「自分の子を並べる役割」を持つ → 新しい Block として切り出す

### 2. shared セクション

shared セクションは、その Block 配下（子〜孫以降を含む）のツリー内だけで使い回す共通クラスをまとめる場所です。

```scss
// --shared ----------------------------------------
```

**対象:**
- その Block 配下ツリーの中でだけ意味を持ち、同じ Block 配下の複数箇所で共通して使いたいクラス

**記述ルール:**
- shared セクション内では、「Block 直下」に限定せず任意の子孫要素を対象にしてよく、`>` の強制は行いません
- 構造ルールそのもの（Block / Element の関係）は基本構造ルールと同じ
- shared セクションはルート Block 直下に置く（子ルール内に置かない。@layer/@supports/@media/@container/@scope のラッパー内でも可）

### 3. interaction セクション

interaction セクションは、Block の状態変化や `:hover` / `:focus-visible` などのインタラクション関連スタイルをまとめる場所です。

```scss
// --interaction -----------------------------------
@at-root & {
  // ...
}
```

**対象:**
- 動的に ON/OFF される状態（`data-state` / `aria-*`、または class モードの Modifier）
- ユーザー操作に応じたスタイル変化（例: `:hover`, `:focus-visible`, `:active` など）
- アニメーション・トランジション関連の指定（初期値を含む）

**記述ルール:**
- 原則、`data-variant` は基本構造セクションに書く。インタラクション初期値は `--interaction` に置いてよい
- `data-state` / `aria-*` は interaction セクションに書く
- `transition` / `transition-*` / `animation` / `animation-*` は interaction セクション内に集約する（`transition-*` には `transition-property` / `transition-duration` / `transition-delay` / `transition-timing-function` / `transition-behavior` を含む）
- `transition` は対象プロパティを明示する（`transition: all` / `transition-property: all` / プロパティ省略 / `var(...)` のみ / `inherit` / `initial` / `unset` / `revert` / `revert-layer` は不可）
- `transition: none` / `transition-property: none` は不可（無効化が必要なら `transition-duration` を極小にする）
- `transition` で指定したプロパティは同一 Block / Element（疑似要素は別扱い）では interaction 以外に書かない（初期値を含めて interaction に集約）
- interaction セクションはルート Block 直下に置く（子ルール内に置かない。@layer/@supports/@media/@container/@scope のラッパー内でも可）
- 疑似クラス / 疑似要素は対象セレクタにネストして書く（`> .child:hover` のように疑似を直書きしない）
- interaction セクションでは、状態に応じて深い階層の要素まで影響を及ぼすことがあるため、セレクタの深さ自体には固定の上限を設けません
- interaction セクションでは Block / Element の親子関係の制約は適用しない（親から孫以降の Block/Element を直接指定してよい）

**記述例:**

```scss
.button-container {
  // 基本的なレイアウト・スタイル（静的）
  display: inline-block;
  padding: 10px 20px;
  background: #fff;

  // --interaction -----------------------------------
  @at-root & {
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.3s ease, transform 0.3s ease;

    > .icon {
      &:hover {
        opacity: 0.8;
      }
    }

    &[data-state="visible"] {
      opacity: 1;
      transform: translateY(0);
    }

    &:hover {
      transform: translateY(-2px);
    }

    &[aria-disabled="true"] {
      opacity: 0.5;
      pointer-events: none;
    }
  }
}
```

## @keyframes

`@keyframes` は **CSS 仕様上グローバル**です。衝突を避けるため、Block 名を prefix に含めて命名し、配置ルールも固定します。

**配置ルール:**
- `@keyframes` は **ルート直下**に置く（@media/@layer などの内側は不可）
- `@keyframes` は **ファイル末尾**にまとめて配置する（コメント／空行を除いて末尾）

**命名ルール:**
- `{block}-{action}` または `{block}-{element}-{action}`
- block / element のケースは `classStructure.naming` に従う
- element は **そのファイル内に実在する element 名のみ許可**
- action は `blockCase` のケースで **1〜3語**（`actionMaxWords` で変更可）
- block と action の区切りは **常に `-` で固定**（例: `cardList-fadeIn` / `CardList-fadeIn`）

**共有アニメーション:**
- 再利用を意図したものは `kf-` などの prefix を付け、`keyframes.scss` に集約する
- 配置は [CSS レイヤー](layers.md) を参照
- import は `@styles/partials/keyframes` のように alias 経由に寄せると運用しやすい

例:

```scss
.sample-block {}

@keyframes sample-block-fade-in {
  to {
    opacity: 1;
  }
}
```

## @rel コメント

Block 間の親子関係をコメントで明示し、ファイル間をたどれるようにします。  
リンクコメント（`@rel` など）は関連ファイルへの移動を一発で行うための仕組みです。ない場合は参照先を手作業で辿る必要があり、運用負担が大きくなります。  
SCSS を生成する際は HTML 構造から VS Code 拡張 / CLI が適切なコメントパスを自動挿入します。

例: 親 Block の SCSS（`components/home-section/home-section.scss`）

```scss
@use "sass:meta";

// @assets/css/home.scss          ← このファイルを使っているページエントリ

.home-section {
  @include meta.load-css("scss");

  > .home-hero {
    // @rel/scss/home-hero.scss   ← 子 Block へのリンク
  }
}
```

例: 子 Block の SCSS（`components/home-section/scss/home-hero.scss`）

```scss
// @rel/../home-section.scss      ← 親 Block へのリンク

.home-hero {
  // ...
}
```

例: ページエントリ SCSS（`assets/css/home.scss`）

```scss
.main-container {
  > .home-section {
    // @components/home-section/home-section.scss  ← Block へのリンク
  }
}
```

**ルール:**

- **親 → 子**: 親 Block の `> .child` ルール内の先頭コメントに、子 Block へのリンクを書く
- **子 → 親**: 子 Block のファイル先頭付近に、親 Block へのリンクを書く
- **親 → ページ**: 親 Block のファイル先頭付近に、ページエントリへのリンクを書く
  - ページエントリ側は `> .block` ルール内に `@components/...` を書くと往復でたどれる

> `@components` などのエイリアス解決は `spiracss.config.js` の `aliasRoots` で行います。リンクコメントの必須/任意や存在チェックは `stylelint.relComments`（= `spiracss/rel-comments` ルール）で設定できます。

## 次のステップ

→ [ガイドライン](guidelines.md): Stylelint では強制しない推奨ルール

## SpiraCSS ドキュメント
- [設計原則](principles.md)
- [クイックスタート](quickstart.md)
- [CSS レイヤー](layers.md)
- コンポーネント
- [ガイドライン](guidelines.md)
- [設計思想](philosophy.md)

## ツール
- [ツール概要](tooling/index.md)
- [spiracss.config.js](tooling/spiracss-config.md)
- [SpiraCSS Stylelint プラグイン](tooling/stylelint.md)
- [SpiraCSS HTML CLI](tooling/html-cli.md)
- [SpiraCSS Comment Links](tooling/comment-links.md)
- [SpiraCSS HTML to SCSS](tooling/html-to-scss.md)
