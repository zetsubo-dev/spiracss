# ツール概要

SpiraCSS のツール群の概要ドキュメントです。

## 共通前提

- `spiracss.config.js` をプロジェクトルートに置く（[spiracss.config.js](spiracss-config.md)）
- [AI用のドキュメントファイル](../../ai/spiracss-ai-doc.md) をダウンロードし、AI と連動させる際の参照ドキュメントにする

いずれかが欠けている場合、判断が不確かになり誤りやすくなるため、作業前に必ず確認してください。

## ツール一覧

| ツール | 役割 | ドキュメント |
| ------ | ---- | ------------ |
| **spiracss.config.js** | 全ツール共通の設定ファイル | [spiracss.config.js](spiracss-config.md) |
| **SpiraCSS Stylelint プラグイン** | SCSS の構造・命名を自動検証 | [Stylelint](stylelint.md) |
| **SpiraCSS HTML CLI** | HTML から SCSS を生成、HTML 構造を検証（CLI コマンド群） | [HTML CLI](html-cli.md) |
| **SpiraCSS Comment Links** | リンクコメントをクリックで該当ファイルを開く | [Comment Links](comment-links.md) |
| **SpiraCSS HTML to SCSS** | HTML から SCSS テンプレートを生成（VS Code 拡張） | [HTML to SCSS](html-to-scss.md) |

補足: `spiracss-html-to-scss` は CLI のコマンド名でもあるため、VS Code 拡張と混同しないよう文脈で使い分けてください。

## 運用フロー

```
spiracss.config.js（共通設定）
         │
         ├── SpiraCSS HTML CLI / SpiraCSS HTML to SCSS ──→ SCSS テンプレート生成
         │
         └── SpiraCSS Stylelint プラグイン ──→ ルール違反を自動検出
```

1. `spiracss.config.js` でプロジェクトの命名規則・検証ルールを設定
2. SpiraCSS HTML CLI または SpiraCSS HTML to SCSS で SCSS テンプレートを生成
3. Stylelint でルール違反を自動検出

## 設定の共有

SpiraCSS ツール群は `spiracss.config.js` を共通の設定ファイルとして使用します。

詳細は [spiracss.config.js](spiracss-config.md) を参照してください。

## 関連ツール
### ツール
- [SpiraCSS Stylelint プラグイン](stylelint.md)
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
