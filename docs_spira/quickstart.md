# クイックスタート

SpiraCSS のツールを導入する手順です。

## SpiraCSS Stylelint プラグイン

SCSS の構造・命名を自動検証します。

### インストール

```bash
npm install -D @spiracss/stylelint-plugin stylelint stylelint-scss postcss-scss
```

### 設定

Stylelint の設定ファイルに SpiraCSS プラグインを追加します。`createRules()` に `spiracss.config.js` を渡すと、設定に応じたルールが生成されます。

**ESM（stylelint.config.js）**

```js
import spiracssPlugin, { createRules } from '@spiracss/stylelint-plugin'
import spiracssConfig from './spiracss.config.js'

export default {
  plugins: [spiracssPlugin, 'stylelint-scss'],
  customSyntax: 'postcss-scss',
  rules: {
    ...createRules(spiracssConfig),
    'scss/at-rule-no-unknown': true
  }
}
```

**CommonJS（stylelint.config.js）**

```js
const spiracss = require('@spiracss/stylelint-plugin')
const plugin = spiracss.default ?? spiracss
const { createRules } = spiracss
const spiracssConfig = require('./spiracss.config.js')

module.exports = {
  plugins: [plugin, 'stylelint-scss'],
  customSyntax: 'postcss-scss',
  rules: {
    ...createRules(spiracssConfig),
    'scss/at-rule-no-unknown': true
  }
}
```

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

---

## VS Code 拡張

### Comment Links

リンクコメント（`@rel` など）をクリックすると該当ファイルを開けます。

→ [Marketplace からインストール](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-comment-links)

### HTML to SCSS

HTML から SCSS テンプレートを生成します。

→ [Marketplace からインストール](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-html-to-scss)

---

## 共通設定

すべてのツールは `spiracss.config.js` を参照します。プロジェクトルートに作成してください。
Stylelint の `createRules()` を使う場合は、`aliasRoots` と `stylelint` セクションが必須です。

### 最小構成（Stylelint 使用時）

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
  },
  stylelint: {
    classStructure: {},
    interactionScope: {},
    relComments: {}
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
- [ツール連携](tooling/index.md): ツールの役割と運用フロー
- [AI用のドキュメントファイル](ai-guide.md): AI用のドキュメントファイル

## SpiraCSS ドキュメント
- [スタイルガイド](styleguide.md)
- クイックスタート
- [CSS レイヤー](layers.md)
- [コンポーネント](component.md)
- [ガイドライン](guidelines.md)
- [AI用のドキュメントファイル](ai-guide.md)

## ツール
- [ツール連携](tooling/index.md)
- [spiracss.config.js](tooling/spiracss-config.md)
