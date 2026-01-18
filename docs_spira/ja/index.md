# SpiraCSS

SpiraCSS は、HTML/CSS から導かれる最小限の構造原則に基づいた CSS アーキテクチャです。CSS 設計で生じやすい構造判断のばらつきを、個人の直感ではなく明確な原則で置き換えることで軽減します。AIエージェントとの協働による実装とツールベースの検証を前提に設計されており、開発時間の短縮と一貫した品質の確保を目指しています。

主なポイント：
- 構造の意思決定は、クラス名と HTML 構造から導ける
- プロパティ配置（コンテナ/アイテム/内部）に構造的な意味があり、細則は Stylelint が教えるため暗記が不要
- `shared`/`interaction`/`rel` のコメント規約は、ツールで検証できる契約として扱える
- [`spiracss.config.js`](tooling/spiracss-config.md) をプロジェクトルートに置き、共通ポリシーに従うようにする
- [`spiracss-ai-agent-doc.md`](../ai/spiracss-ai-agent-doc.md) をダウンロードし、AIエージェントワークフローの参照ドキュメントにする

ツールの役割：
- 生成: HTML CLI + VS Code HTML to SCSS
- HTML 検証: HTML CLI
- SCSS ルール検証: Stylelint
- ナビゲーション: Comment Links

ステータス: ベータ版

## ドキュメント

- [設計原則](principles.md)
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

## リンク

公式サイト: https://spiracss.jp
