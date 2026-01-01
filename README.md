# SpiraCSS

**SpiraCSS** = **S**implified **P**ractical **I**ntegrated **R**elational **A**rchitecture for **CSS**

Status: In development

Official site: https://spiracss.jp/

SpiraCSS is a CSS architecture that reduces intuition-driven, implementer-dependent judgments to a minimal set of principles—designed to be automatically validated by tools—so humans and AI can maintain consistent design using a shared standard.

SpiraCSS は、実装者の感覚でブレがちな判断を最小限の原則に落とし込み、ツール検証で人間と AI が同じ基準で一貫設計できる CSS アーキテクチャです。

Key points:
- Structure decisions are derived from class names and HTML structure.
- Shared/interaction/rel comments are stable, tool-verifiable contracts.
- SpiraCSS is designed for AI + tool integration, so implementations stay consistent. (See [Documentation](#documentation) and [Tools](#tools).)

Tool roles:
- Generation: HTML CLI + VS Code HTML to SCSS
- HTML validation: HTML CLI
- SCSS rule validation: Stylelint
- Navigation: Comment Links

## Documentation

- [Style Guide (スタイルガイド, Japanese only)](docs_spira/styleguide.md)
- [Quickstart (クイックスタート, Japanese only)](docs_spira/quickstart.md)
- [CSS Layers (CSS レイヤー, Japanese only)](docs_spira/layers.md)
- [Components (コンポーネント, Japanese only)](docs_spira/component.md)
- [Guidelines (ガイドライン, Japanese only)](docs_spira/guidelines.md)
- [AI Documentation File (AI用のドキュメントファイル, Japanese only)](docs_spira/ai-guide.md)

## Tools

- [Tooling Overview (ツール連携, Japanese only)](docs_spira/tooling/index.md)
- [spiracss.config.js (共通設定, Japanese only)](docs_spira/tooling/spiracss-config.md)
- [SpiraCSS Stylelint Plugin (SpiraCSS Stylelint プラグイン, Japanese only)](docs_spira/tooling/stylelint.md)
- [SpiraCSS HTML CLI (HTML 生成/検証 CLI, Japanese only)](docs_spira/tooling/html-cli.md)
- [SpiraCSS Comment Links (コメントリンク拡張, Japanese only)](docs_spira/tooling/comment-links.md)
- [SpiraCSS HTML to SCSS (HTML から SCSS 生成, Japanese only)](docs_spira/tooling/html-to-scss.md)
