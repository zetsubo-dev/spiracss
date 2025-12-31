# CSS レイヤー

プロジェクト全体の CSS を以下の 3 層に分けます。

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
│   │   └── site-header/
│   │       └── site-header.scss
│   ├── parts/                      # 複数ページで共有
│   │   └── hero-banner/
│   │       └── hero-banner.scss
│   └── pages/                      # ページ固有
│       ├── home/
│       │   └── home-hero/
│       │       └── home-hero.scss
│       └── about/
│           └── about-intro/
│               └── about-intro.scss
└── assets/
    └── css/                        # ページ層
        ├── home.scss
        └── about.scss
```

## グローバル層（Base / Layout / Utilities）

サイト全体のタイポグラフィ・色・リセット・ユーティリティクラスを担当します。

### config.scss / variables.scss

**config.scss**: ブレークポイントや共通のベース値など、サイト全体で共有する「設定値」を管理します。

**variables.scss**: カラーパレット・タイポグラフィ・スペーシングなど、デザイン設計上の値を集中管理します。

> **運用ルール**: 新しい設計値が必要になったら `config` または `variables` に追加したうえで使用し、直接ハードコードはしません。

### function.scss / mixin.scss

**function.scss**: 複数のコンポーネントから利用される数値変換ユーティリティ関数をまとめます。

例:

- ビューポート幅に応じてサイズをスケールさせる関数
- fluid タイポグラフィ用の関数
- トラッキング／行間をデザイン値から算出する関数

**mixin.scss**: ブレークポイントやレイアウトに関する汎用 Mixin を定義します。

- ブレークポイント名や数値を渡してメディアクエリを生成する Mixin
- よく使うタイポグラフィ設定をまとめたショートハンド Mixin

### utilities.scss

**構造やスキンに依存しない単機能ユーティリティクラス** を限定的に定義します。
追加はサイト全体で再利用される最小限の機能にとどめ、コンポーネント内でのみ使うスタイルはユーティリティ化しません。

フォントやテキスト系も、特定の Block に依存しない単機能の補助クラス（例: フォントファミリ切り替えや視覚的非表示用クラス）だけを `utilities.scss` に置きます。

#### 命名ルール（utilities 専用）

- ユーティリティクラスは必ず `u-` プレフィックスから始めます（例: `.u-hidden`, `.u-sr-only`）。
- このプレフィックスにより、「構造を表すクラス（Block / Element）や class モード時の Modifier」と「補助的なユーティリティクラス」をはっきり区別します。
- `.u-*` で始まるユーティリティクラスは Block / Element（class モード時の Modifier）とは別カテゴリとして扱います。命名/構造チェックから除外したい場合は `stylelint.classStructure.allowExternalPrefixes` に `u-` を追加して運用します（例: `.u-sr-only`）。2 語 / 1 語といった厳密な制約は構造用クラスだけに課し、ユーティリティは補助レイヤとして扱います。

例:

- `.u-hidden` とその派生（ブレークポイント付き非表示など）
- `.u-sr-only` などのテキスト系ユーティリティ
- プロジェクト全体で必要な最小限の補助クラス

---

## ページ層（ページエントリ CSS）

各ページごとのエントリ SCSS で構成される薄いレイヤです（例: `assets/css/home.scss`, `assets/css/about.scss` など）。
各ファイルでは、そのページを表すルートクラス（例: `.main-container`）の中に、読み込んだコンポーネントの配置とページ固有の見た目だけを書きます。

### 記述パターンとコード例

ページエントリでは、典型的に次のような内容を記述します。

1. **そのページで使うコンポーネントの読み込み**（`@use` でまとめて読み込む）
2. **ページ全体のスタイル**（背景色、フォント、コンテナの最大幅など、ページ固有の見た目）
3. **子 Block の配置とレイアウト調整**（`> .hero-container { margin-top: ... }` のように、そのページで使う Block 間の余白や配置）
4. **子 Block の参照宣言**（`// @components/...` コメントで、どの Block を使っているかを明示）

**記述例:**

```scss
// assets/css/home.scss
@use "@styles/partials/global" as *;

// このページで使うコンポーネントを読み込む
@use "@components/hero/hero-container";
@use "@components/feature/feature-container";
@use "@components/cta/cta-container";

.main-container {
  background: linear-gradient(to bottom, #f0f0f0, #ffffff);

  > .hero-container {
    // @components/hero/hero-container.scss
    margin-top: 0; // ページトップなので余白なし
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

#### ページエントリが担当すること / しないこと

- 担当すること: そのページで使うコンポーネントを `@use` で読み込み、ページのルートクラス（例: `.main-container`）の中で子コンポーネントの並びやページ固有の余白を決める。
- 担当しないこと: 各コンポーネントの内部構造・スキン・内部レイアウト。これはコンポーネント層の SCSS の責務であり、ページ側は「どのコンポーネントをどの順番・余白で配置するか」までにとどめる。

#### ページ構造の共通化

- 繰り返し現れるページ構造や調整は、その構造自体をコンポーネント層の共通コンポーネント（例: `components/parts/**` 配下の `.standard-layout`, `.two-column` など）として切り出し、必要なページのエントリ CSS から `@use` して再利用する。
- ページ層は「このページでどのコンポーネントをどう並べるか」を宣言するエントリポイントにとどめ、自前のレイアウト用コンポーネントを増やして構造を肥大化させない。

> **補足（1 Block = 1 ファイル）**
> この原則は共通コンポーネント向けのルールであり、ページ層のルートクラス（`.main-container` など）は各ページのエントリ SCSS 内で完結させ、ページごとに専用の `scss/` ディレクトリは作らない前提です。

---

## コンポーネント層

Block / Element による構造設計、Variant / State による見た目と状態の分離、SCSS のセクション構成、ファイル管理を一貫したルールで整理します。

- **Block（2 語）**: 部品そのもの（例: `.hero-container`）
- **Element（1 語）**: Block 内の要素（例: `.title`）
- **Variant / State**: data 属性（デフォルト）または class モードで表現
- **1 Block = 1 ファイル**: 各 Block は 1 つの SCSS ファイルと対応

詳細は [コンポーネント](component.md) を参照してください。

---

## 次のステップ

→ [コンポーネント](component.md): 命名・親子関係・Variant/State・SCSS・ファイル構成

## SpiraCSS ドキュメント
- [スタイルガイド](styleguide.md)
- [クイックスタート](quickstart.md)
- CSS レイヤー
- [コンポーネント](component.md)
- [ガイドライン](guidelines.md)

## ツール
- [ツール連携](tooling/index.md)
- [spiracss.config.js](tooling/spiracss-config.md)
