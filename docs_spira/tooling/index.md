# ツール詳細

SpiraCSS のツール群の詳細ドキュメントです。

## ツール一覧

| ツール | 役割 | ドキュメント |
| ------ | ---- | ------------ |
| **spiracss.config.js** | 全ツール共通の設定ファイル | [spiracss-config.md](spiracss-config.md) |
| **SpiraCSS Stylelint プラグイン** | SCSS の構造・命名を自動検証 | [stylelint.md](stylelint.md) |
| **SpiraCSS HTML CLI** | HTML から SCSS を生成、HTML 構造を検証 | [html-cli.md](html-cli.md) |
| **SpiraCSS Comment Links** | リンクコメントをクリックで該当ファイルを開く | [comment-links.md](comment-links.md) |
| **SpiraCSS HTML to SCSS** | HTML から SCSS テンプレートを生成 | [html-to-scss.md](html-to-scss.md) |

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

詳細は [spiracss-config.md](spiracss-config.md) を参照してください。

## 関連ツール
### ツール
- [ツール連携](index.md)
- [SpiraCSS Stylelint プラグイン](stylelint.md)
- [SpiraCSS HTML CLI](html-cli.md)
- [SpiraCSS Comment Links](comment-links.md)
- [SpiraCSS HTML to SCSS](html-to-scss.md)

### 設定
- [spiracss.config.js](spiracss-config.md)

## SpiraCSS ドキュメント
- [スタイルガイド](../styleguide.md)
- [クイックスタート](../quickstart.md)
- [CSS レイヤー](../layers.md)
- [コンポーネント](../component.md)
- [ガイドライン](../guidelines.md)
- [AI用のドキュメントファイル](../ai-guide.md)
