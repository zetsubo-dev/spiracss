# SpiraCSS の設計思想

SpiraCSS は、HTML/CSS の構造的特徴を最小の原則に整理した CSS アーキテクチャです。CSS 設計で起きがちな構造判断のブレを、個人の感覚ではなく原則に基づいて抑えます。AIエージェントとの協働による実装とツール検証を前提に、作業時間の短縮と品質の一定化を目指しています。

Tailwind CSS に代表されるユーティリティファーストとは異なり、BEM / SMACSS / RSCSS の系譜に連なる思想として、クラス名で構造を表現し、コンポーネント単位でファイルを分割するアプローチを取ります。

> 具体的なルールやコード例は [設計原則](principles.md) と [コンポーネント](component.md) を正とし、このページでは「なぜそうするのか」を中心に説明します。

## SpiraCSS が解決する課題

CSS 設計の歴史において、BEM / SMACSS / OOCSS / RSCSS / ITCSS / CUBE CSS など、数多くの設計手法が提案されてきました。これらはすべて「CSS をどう構造化し、保守可能にするか」という共通の課題に取り組んできました。

しかし、これらの設計手法に共通する課題があります：

**「コンポーネント分割の判断が、人の感覚や解釈に依存する」**

- どこまでを 1 つの Block（コンポーネント）とするか？
- この要素は Element か、独立した Block か？
- 親と子のレイアウト責務をどちらが持つか？
- コンポーネント間の関係性をどう管理するか？

これらの判断は、従来の設計手法では「ガイドライン」として示されるものの、最終的には実装者の経験や感覚に委ねられてきました。その結果：

- 同じ設計手法でもプロジェクトごとに解釈がバラつき、分割の粒度が揃いにくい
- コードレビューで「これは Block か Element か」といった議論に時間を費やす
- Modifier や状態クラスなど、見た目のバリエーションと状態の区別が実務では徹底しにくい
- AI に既存の設計手法で書くよう指示しても判断が揃わず、一貫性が保てないことがある

また、BEM や RSCSS の設計理論で推奨されてきた「1 Block = 1 ファイル」は本来の思想として存在していました。しかし、ファイル分割に伴う行き来の煩雑さを補う運用支援が十分でなかったこともあり、命名規則だけが取り入れられ実務では定着しにくい状態が続いていました。

## SpiraCSS の解決策

構造判断を「解釈」ではなく「不変条件」に落とし込むことです。そのうえで、不変条件を日々の実装で崩さないための検証範囲と運用支援を整えます。

### 構造判断を「不変条件」にする

- **命名で構造を判定できるようにする**: Block は 2 語、Element は 1 語（デフォルト）
- **構造は繰り返しとして捉える**: すべての構造を `Block > 子（Block / Element）` の反復として考える
- **入口を揃える**: 1 Block = 1 ファイル（コンポーネントの起点を一箇所に揃える）

詳細は [設計原則](principles.md) を参照してください。

### 命名だけでなく、プロパティ配置に意味を持たせる

従来の CSS 設計は「命名で構造を示す」ことに寄りがちでしたが、SpiraCSS では **プロパティの書き場所そのものに構造的な意味** を与えます。
コンテナ / アイテム / 内部という責務の切り分けは Stylelint が検証するため、細かな規則を暗記する必要はありません。
判断基準が機械的に扱えるため、AI による生成・自動修正とも相性が良い設計です。
この原則は [設計原則](principles.md) の一文に集約されます。

### Variant / State を分離する

SpiraCSS では、従来の Modifier を **Variant（見た目のバリエーション）** と **State（インタラクション状態）** に分け、責務と配置を明確にします。デフォルトでは data 属性で表現します。

- Variant: `data-variant="primary"`（基本構造側）
- State: `data-state="active"` / `aria-*`（`--interaction` 側）

詳細は [設計原則](principles.md) / [コンポーネント](component.md) を参照してください。

### ツールで検証できる範囲を決める

SpiraCSS は、判断が揺れやすい部分を「局所的な不変条件」として定義し、Stylelint / HTML lint で検証できる形にします。

- 命名（Block / Element / Utility）
- 親子構造（`Block > Block` / `Block > Element`）
- 1 ファイル 1 ルート Block とファイル名の対応
- Variant / State の分離と配置（data モード）
- プロパティ配置（コンテナ / アイテム / 内部）
- `@rel` コメントによる関係性の明示

詳細は [Stylelint](tooling/stylelint.md) / [HTML CLI](tooling/html-cli.md) / [ツール概要](tooling/index.md) を参照してください。

### 1 Block = 1 ファイルを支える運用支援

Dart Sass のモジュールシステム（`@use` / `@forward`）により、スタイルをモジュールとして分割しやすくなっています。SpiraCSS は「1 Block = 1 ファイル = 1 モジュール」を前提に、分割による行き来のコストをツールで下げます。

- **`@rel` コメント + Comment Links**（[Comment Links](tooling/comment-links.md)）: 親子 Block 間を Cmd/Ctrl+クリックで直接ジャンプ
- **HTML → SCSS 生成**（[HTML CLI](tooling/html-cli.md) / [HTML to SCSS](tooling/html-to-scss.md)）: HTML から Block / Element 構造を解析して SCSS テンプレートを自動生成
- **Dart Sass `meta.load-css()` による子 Block の集約**: 親 Block 側は 1 行書くだけで `scss/` 配下の子 Block をまとめて読み込み

### 人が判断する領域

ツールだけでは決めきれない部分（例外の許容判断、レイアウト規約、命名のケース選択など）は、チームでルールを決めて運用します。詳細は [ガイドライン](guidelines.md) を参照してください。

## コア原則（SPIRA）

**SpiraCSS** = **S**implified **P**ractical **I**ntegrated **R**elational **A**rchitecture for **CSS**

この頭字語（SPIRA）は、採用する設計の軸を表しています。

### Simplified（簡素化）

SMACSS / RSCSS から**実践的に運用できる最小限の原則**に絞り込み：

- HTML/CSS のごく基本的な構造原則（親子関係・責務分割）だけにルールを絞る
- 特定のライブラリや命名プリフィックスに強く依存せず、時間が経っても読み替えやすいシンプルな構造
- SPA / SSR / SSG などの方式やフレームワークを問わず適用できる
- CSS Modules / `<style scoped>` / グローバル CSS でも同じ原則を適用できる

### Practical（実用的）

**実用的な関連ツール**で開発体験を向上：

- SpiraCSS Stylelint プラグインによる自動検証
- VS Code 拡張による自動生成・リンクナビゲーション
- CLI ツールによる AI エージェント連携
- 1 Block = 1 ファイル = 1 モジュール構造（Dart Sass 前提）

### Integrated（統合的）

HTML/CSS/ツールが**密接に統合**：

- 構造クラスを「[CSS レイヤー](layers.md)（グローバル / ページ / コンポーネント） × Block / Element + Variant / State」という統一された基準で読める
- CSS レイヤー 3 層すべてに同じ構造原則を適用
- コンポーネントスコープの有無や実装方法によらず適用可能な最小構造原則
- コードを書く過程で構造設計の考え方を自然に習得できる設計

### Relational（関係性重視）

コンポーネント間の**依存関係を明示**：

- `@rel` コメントによる親子 Block 間のリンク表現
- ファイル間の関係性を明確化
- リファクタリング時の影響範囲を把握しやすい
- 保守性・可読性の向上

### Architecture（構造化）

**全体構造を一貫したルールで整理**：

- CSS レイヤー（グローバル層・ページ層・コンポーネント層）による責務分割
- 1 Block = 1 ファイル = 1 モジュールの対応
- `spiracss.config.js` による設定の一元管理
- Stylelint / CLI / VS Code 拡張の連携

## 開発の背景

SpiraCSS の原型は、長年社内で運用してきた HTML/CSS 設計ガイドラインと運用支援ツール（VS Code 拡張など）です。新入社員、外部パートナー、経験豊富なエンジニアなど、さまざまなスキルレベルのメンバーが関わるプロジェクトでも一定の品質を保ち、誰が書いても同じ構造に収束するよう原則を整理し続けてきました。

出発点は、ガイドラインがあっても「判断の個人差」が残る問題でした。「既存の設計手法を形式化する」だけでは解決しないと考え、**「HTML/CSS の本質的な構造とは何か？」という問い**に立ち返りました。当時の CSS 設計手法（[BEM](https://en.bem.info/methodology/) / [SMACSS](https://smacss.com/) など）を検討した結果、共通して見えてきたのは **「すべての構造は `Block > 子（Block / Element）` の繰り返しである」** という単純な原則です。

人による判断をできるだけなくしつつも設計として破綻しない限界はどこか——この問いを突き詰めていく中で、[RSCSS](https://rstacruz.github.io/rscss/) や [CUBE CSS](https://cube.fyi/) など思想の近い設計手法からも影響を受けながらガイドラインを進化させてきました。このシンプルな構造のルールであれば Stylelint でも検証でき、AI が自律的にコードを書く際の制約としても有効なのではないかと考え、Stylelint プラグインと AI 連携部分の一部を公開し、開発を進めています。

## おわりに

SpiraCSS は、CSS の構造を「人のセンス」ではなく「同じ物差し」で読める状態に近づけるための設計です。ルールを共有し、生成・検証のフローに乗せることで、議論やレビューのコストを下げながら、誰が書いても一定の品質を保てる状態を目指しています。また、新人や初学者がルールに沿って書くことで HTML/CSS の責務分割を自然に身につけられるため、人材育成の側面も持っています。

SpiraCSS が、あなたのプロジェクトとチームにとって、少しでも書きやすく・読みやすい CSS と開発体験につながれば幸いです。

## SpiraCSS ドキュメント
- [設計原則](principles.md)
- [クイックスタート](quickstart.md)
- [CSS レイヤー](layers.md)
- [コンポーネント](component.md)
- [ガイドライン](guidelines.md)
- 設計思想

## ツール
- [ツール概要](tooling/index.md)
- [spiracss.config.js](tooling/spiracss-config.md)
- [SpiraCSS Stylelint プラグイン](tooling/stylelint.md)
- [SpiraCSS HTML CLI](tooling/html-cli.md)
- [SpiraCSS Comment Links](tooling/comment-links.md)
- [SpiraCSS HTML to SCSS](tooling/html-to-scss.md)
