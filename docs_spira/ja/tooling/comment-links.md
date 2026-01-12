# SpiraCSS Comment Links

SCSS ファイル内の `// @rel/...`、`// @components/...` などの形式のコメントを **Cmd/Ctrl+Click** でファイルジャンプできるようにする VS Code 拡張です。リンクコメントは関連ファイルへの移動を一発で行うための仕組みで、ない場合は参照先を手作業で辿る必要があり運用負担が大きくなります。

[SpiraCSS](../principles.md) の CSS 設計規約と組み合わせて使うことを想定しています。

```scss
// @rel/child.scss
// @components/button.scss
```

## インストール

VS Code 拡張マーケットプレイスから `SpiraCSS Comment Links` を検索してインストールします。

→ [Marketplace からインストール](https://marketplace.visualstudio.com/items?itemName=spiracss.spiracss-comment-links)

## 使い方

### 相対リンク `@rel`

現在のファイルからの相対パスで解決します。
先頭の `/` は無視されます。

```scss
// @rel/sibling.scss     → 同じディレクトリの sibling.scss
// @rel/../parent.scss   → 親ディレクトリの parent.scss
// @rel//sibling.scss    → 先頭の / を無視して sibling.scss
```

### エイリアスリンク

ワークスペース内のパスを、`@components` のようなショートカットで指定できます。解決は `aliasRoots` の基準パスにコメント側の文字列を連結し、先頭の `/` は無視されます。`aliasRoots` に定義したキー、または下記の既定エイリアスのみが対象です。解決結果がプロジェクトルート外になる場合は無視されます。

| エイリアス | 解決先（`aliasRoots` 未定義時のフォールバック） |
|-----------|---------------------|
| `@src` | `src/` |
| `@components` | `src/components/` |
| `@styles` | `src/styles/` |
| `@assets` | `src/assets/` |
| `@pages` | `src/components/pages/` |
| `@parts` | `src/components/parts/` |
| `@common` | `src/components/common/` |

```scss
// @components/button.scss → src/components/button.scss
// @styles/variables.scss  → src/styles/variables.scss
```

## 設定

この拡張は、プロジェクトルートの `spiracss.config.js` にある `aliasRoots` を使ってエイリアスの解決先を決めます。
`aliasRoots` にキーを定義すると、そのエイリアスが認識されます。未定義の場合は既定エイリアスのみフォールバックで認識され、未知キーはリンク化されません。以下は最小例です。

```js
// spiracss.config.js
module.exports = {
  aliasRoots: {
    components: ['src/components'],
    // 独自エイリアスも追加可能
    // layouts: ['src/layouts'],
  },
}
```

キー名は `@` を付けずに定義します（`components` → コメント側で `@components/...`）。

`package.json` に `"type": "module"` がある場合は、`module.exports` の代わりに `export default` を使用してください。

設定の全体像は [spiracss.config.js](spiracss-config.md) を参照してください。

## 制限事項

- SCSS の行コメント（`// ...`）のみ対応（ブロックコメント `/* ... */` は対象外）
- コメントの先頭から `@` で始まる書き方のみ対象（例: `// TODO @components/...` は対象外）
- エイリアスリンクは `@alias/...` の形式のみ対象（`@alias` 単体や `@aliasFoo` は対象外）
- エイリアスの基点がワークスペース外の場合は警告して無視されます
- ワークスペース（フォルダ）を開いている必要あり

## 使用例

```scss
@use "sass:meta";

// hero-section.scss

// @assets/css/home.scss

.hero-section {
  @include meta.load-css("scss");

  > .feature-card {
    // @rel/scss/feature-card.scss
  }
}
```

## 関連ツール
### ツール
- [SpiraCSS Stylelint プラグイン](stylelint.md)
- [SpiraCSS HTML CLI](html-cli.md)
- SpiraCSS Comment Links
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
