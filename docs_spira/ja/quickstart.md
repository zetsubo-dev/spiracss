# クイックスタート

SpiraCSS のツールを導入する手順です。

## 必須ファイル

SpiraCSS の運用には次の 2 つを用意します。

- [spiracss.config.js](tooling/spiracss-config.md)（プロジェクトルート）
- [AIエージェント用ドキュメント](../ai/spiracss-ai-agent-doc.md)（ダウンロードし、AIエージェントワークフローの参照ドキュメントにする）

いずれかが欠けている場合、判断が不確かになり誤りやすくなるため、作業前に必ず確認してください（デフォルト適用は行いません）。

## SpiraCSS Stylelint プラグイン

SCSS の構造・命名を自動検証します。

### インストール

```bash
npm install -D @spiracss/stylelint-plugin stylelint stylelint-scss postcss-scss
```

### 設定

Stylelint の設定は **[SpiraCSS Stylelint プラグインガイド](tooling/stylelint.md)** を正とします。  
`createRules()` を使う場合は `aliasRoots` が必須です。`stylelint` の各サブセクションは未指定でもデフォルトが適用されます。

### 実行

```bash
npx stylelint "src/**/*.scss"
```

---

## SpiraCSS HTML CLI

HTML から SCSS を生成、HTML 構造を検証します。

```bash
npm install -D @spiracss/html-cli
```

```bash
# SCSS 生成
echo "$HTML" | npx spiracss-html-to-scss --stdin

# HTML 検証
echo "$HTML" | npx spiracss-html-lint --stdin

# HTML プレースホルダ付与
echo "$HTML" | npx spiracss-html-format --stdin
```

※ 断片 HTML を扱う場合は `spiracss-html-to-scss` / `spiracss-html-lint` に `--selection` を併用してください。`spiracss-html-format` は `--selection` / `--root` 非対応です。

---

## VS Code 拡張

### Comment Links

リンクコメント（`@rel` など）は関連ファイルへの移動を一発で行うための仕組みです。ない場合は参照先を手作業で辿る必要があり、運用負担が大きくなります。

→ [Marketplace からインストール](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-comment-links)

### HTML to SCSS

HTML から SCSS テンプレートを生成します。

→ [Marketplace からインストール](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-html-to-scss)

---

## 共通設定

すべてのツールは `spiracss.config.js` を参照します。プロジェクトルートに作成してください。
Stylelint の `createRules()` を使う場合は、`aliasRoots` が必須です。`stylelint` の各サブセクションは未指定でもデフォルトが適用されます。

### 最小構成（Stylelint 使用時）

stylelint の各サブセクションは省略可（デフォルト適用）です。
※ サンプルは ESM 形式です。CommonJS の場合は [spiracss.config.js](tooling/spiracss-config.md) を参照してください。

```js
export default {
  aliasRoots: {
    src: ['src'],
    components: ['src/components'],
    common: ['src/components/common'],
    pages: ['src/components/pages'],
    parts: ['src/components/parts'],
    styles: ['src/styles'],
    assets: ['src/assets']
  }
}
```

### PascalCase のファイル名に合わせる場合

```js
export default {
  aliasRoots: { /* ... */ },
  generator: {
    // 生成する SCSS ルートファイル名: 'preserve'（既定） or 'pascal'
    rootFileCase: 'pascal'
  }
}
```

### className 属性を使う場合

```js
export default {
  aliasRoots: { /* ... */ },
  htmlFormat: {
    // HTML のクラス属性: 'class'（既定） or 'className'
    classAttribute: 'className'
  },
  generator: {
    // 生成する SCSS ルートファイル名: 'preserve'（既定） or 'pascal'
    rootFileCase: 'pascal'
  }
}
```

その他の設定項目は、プロジェクトやチームのガイドラインに合わせてカスタマイズしてください。  
詳細は [spiracss.config.js](tooling/spiracss-config.md) を参照してください。

---

## 次のステップ

- [コンポーネント](component.md): SCSS の書き方ルール
- [ツール概要](tooling/index.md): ツールの役割と運用フロー

## SpiraCSS ドキュメント
- [設計原則](principles.md)
- クイックスタート
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
