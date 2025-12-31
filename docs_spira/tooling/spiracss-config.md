# spiracss.config.js 設定ガイド

`spiracss.config.js` は SpiraCSS 関連ツールで共有される設定ファイルです。
主な参照先は以下です。

- **aliasRoots**: Comment Links / stylelint のパス解決
- **stylelint**: ルール設定（classStructure / interactionScope / relComments など）
- **selectorPolicy**: バリアント/状態の表現方針（lint / generator / HTML lint）
- **htmlFormat**: HTML プレースホルダ付与の出力属性
- **generator**: HTML→SCSS 生成と HTML lint

## セットアップ

`spiracss.config.js` はプロジェクトルートに配置します。
`package.json` に `"type": "module"` がある場合は ESM、その他は CommonJS で記述してください。

```js
// ESM
export default {
  // ...
}
```

```js
// CommonJS
module.exports = {
  // ...
}
```

## 目次
- [aliasRoots](#aliasroots)
- [stylelint](#stylelint)
  - [sectionCommentPatterns](#stylelintsectioncommentpatterns)
  - [classStructure](#stylelintclassstructure)
  - [interactionScope](#stylelintinteractionscope)
  - [relComments](#stylelintrelcomments)
- [selectorPolicy](#selectorpolicy)
  - [variant](#selectorpolicyvariant)
  - [state](#selectorpolicystate)
- [htmlFormat](#htmlformat)
  - [classAttribute](#htmlformatclassattribute)
- [generator](#generator)
  - [globalScssModule](#generatorglobalscssmodule)
  - [pageEntryAlias / pageEntrySubdir](#generatorpageentryalias--generatorpageentrysubdir)
  - [rootFileCase](#generatorrootfilecase)
  - [childScssDir](#generatorchildscssdir)
  - [layoutMixins](#generatorlayoutmixins)
- [プロジェクトごとのカスタマイズ例](#プロジェクトごとのカスタマイズ例)
- [トラブルシューティング](#トラブルシューティング)

## 設定項目

### `aliasRoots`

エイリアスパスの解決ルートを定義します。

```javascript
aliasRoots: {
  components: ['src/components'],
  styles: ['src/styles']
}
```

- キーに `@` プレフィックスは不要です（`components` → `@components/...`）
- 値は配列で指定します（相対パス推奨 / 絶対パスも可）
- `aliasRoots` に無いエイリアスは stylelint 側では解決できません
- Comment Links は未定義のエイリアスでも拡張内フォールバックで解決します
- CLI ツールは `aliasRoots` を参照しません
- stylelint プラグインの `createRules()` を使う場合、`aliasRoots` は必須です（未設定だとエラー）

### `stylelint`

stylelint プラグインのルール設定です。
`createRules()` を使う場合は `classStructure` / `interactionScope` / `relComments` を必ず定義してください。

#### `stylelint.sectionCommentPatterns`

shared / interaction セクションのコメント判定を一元化します。
`createRules()` を使う場合は、ここに書いた値が各ルールに展開されます（個別指定がある場合はそちらが優先）。

```javascript
stylelint: {
  sectionCommentPatterns: {
    shared: /--shared/i,
    interaction: /--interaction/i
  }
}
```

#### `stylelint.classStructure`

クラス命名規則とセレクタ構造のルールを定義します。

```javascript
stylelint: {
  classStructure: {
    allowElementChainDepth: 4,
    allowExternalClasses: [],
    allowExternalPrefixes: ['u-'],
    enforceChildCombinator: true,
    enforceSingleRootBlock: true,
    enforceRootFileName: true,
    rootFileCase: 'preserve',
    childScssDir: 'scss',
    componentsDirs: ['components'],
    naming: {
      blockCase: 'kebab',
      blockMaxWords: 2,
      elementCase: 'kebab',
      modifierCase: 'kebab',
      modifierPrefix: '-',
      customPatterns: {
        block: /^custom-block-.+$/,
        element: /^icon-.+$/,
        modifier: /^--[a-z]+(-[a-z]+)?$/
      }
    }
  }
}
```

- **`allowElementChainDepth`**: Element 連鎖の段数上限（デフォルト: 4）
- **`allowExternalClasses` / `allowExternalPrefixes`**: 外部クラスの除外設定（デフォルト: `[]`）。ユーティリティを除外したい場合は `allowExternalPrefixes: ['u-']` を指定
- **`enforceChildCombinator`**: Block 直下に `>` を強制するか
- **`enforceSingleRootBlock`**: 1ファイル内のルート Block を 1 つに制限するか（有効時はトップレベルセレクタが root Block を含む必要あり）
- **`enforceRootFileName`**: ルート Block のクラス名と SCSS ファイル名を一致させるか
- **`rootFileCase`**: ルート Block の SCSS ファイル名ケース
- **`childScssDir`**: 子 Block SCSS の配置ディレクトリ名
- **`componentsDirs`**: コンポーネント層として扱うディレクトリ名
- **`naming`**: 命名規則のカスタマイズ（`customPatterns` は上書き動作）
- **`sharedCommentPattern` / `interactionCommentPattern`**: セクションコメントの個別指定（`sectionCommentPatterns` より優先）
- **`selectorPolicy`**: ルール単体での指定。`createRules()` を使う場合は top-level の `selectorPolicy` が優先されます

> 注意: `customPatterns` を使う場合、HTML プレースホルダ（`block-box` / `element`）と一致しない可能性があるため整合性を確認してください。
> 補足: `enforceRootFileName` は `componentsDirs` 配下のみを対象とし、`assets/css`、`index.scss`、`_*.scss` は除外されます。
> 補足: `createRules()` を使う場合、`generator.rootFileCase` / `generator.childScssDir` が未指定項目のフォールバックに使われます。

#### `stylelint.interactionScope`

interaction セクション（`// --interaction` と `@at-root & { ... }`）の配置ルールを定義します。

```javascript
interactionScope: {
  allowedPseudos: [':hover', ':focus', ':focus-visible', ':active', ':visited'],
  requireAtRoot: true,
  requireComment: true,
  requireTail: true,
  enforceWithCommentOnly: false,
  selectorPolicy: { ... } // 任意（未指定時は top-level selectorPolicy を使用）
}
```

interaction セクションは**常にルート Block 直下**に配置します（設定で無効化できません）。

- **`allowedPseudos`**: 検証対象とする擬似クラス
- **`requireAtRoot`**: `@at-root & { ... }` と `&` 起点のセレクタを必須にするか
- **`requireComment`**: `// --interaction` コメントを必須にするか
- **`requireTail`**: interaction ブロックを末尾に置くか
- **`enforceWithCommentOnly`**: コメント付きブロックのみ検査するか
- **`interactionCommentPattern`**: セクションコメントの個別指定（`sectionCommentPatterns` より優先）
- **`selectorPolicy`**: このルール内での上書き（未指定時は top-level を使用）

#### `stylelint.relComments`

`@rel` リンクコメントのルールを定義します。

```javascript
relComments: {
  requireInScssDirectories: true,
  requireWhenMetaLoadCss: true,
  validatePath: true,
  skipFilesWithoutRules: true,
  requireChildRelComments: true,
  requireChildRelCommentsInShared: true,
  requireChildRelCommentsInInteraction: true,
  requireParentRelComment: true,
  childScssDir: 'scss'
}
```

- **`validatePath`**: パスの実在検証を行うか
- **`requireInScssDirectories`**: `childScssDir` 配下の SCSS で @rel を必須にするか
- **`requireWhenMetaLoadCss`**: `@include meta.load-css("scss")` を含む親 Block で先頭コメントを必須にするか
- **`skipFilesWithoutRules`**: セレクタルールが無い SCSS をスキップするか
- **`requireChildRelComments*` / `requireParentRelComment`**: 親子のリンクコメントを必須にするか
- **`childScssDir`**: 子 Block の SCSS を置くディレクトリ名（`createRules()` では `generator.childScssDir` が未指定時のフォールバック）
- **`sharedCommentPattern` / `interactionCommentPattern`**: セクションコメントの個別指定（`sectionCommentPatterns` より優先）
- **`naming` / `allowExternalClasses` / `allowExternalPrefixes`**: 命名・外部クラス設定（`createRules()` では `classStructure` から自動継承）
- エイリアスの解決は `aliasRoots` を参照します（`validatePath: true` の場合）

詳細は [comment-links.md](comment-links.md) を参照してください。

### `selectorPolicy`

バリアント/状態の表現方法を切り替える共通設定です。
デフォルトは **バリアント=`data-variant` / 状態=`data-state`** を使用します。

```javascript
selectorPolicy: {
  valueNaming: {
    case: 'kebab',
    maxWords: 2
  },
  variant: {
    mode: 'data',
    dataKeys: ['data-variant']
  },
  state: {
    mode: 'data',
    dataKey: 'data-state',
    ariaKeys: ['aria-expanded', 'aria-selected', 'aria-disabled']
  }
}
```

- `mode` は `data` / `class` のみ有効です
- data 値の命名は `valueNaming` を基準に `variant/state.valueNaming` で上書きできます
- HTML lint もここで指定した予約キーのみを検証します
- `variant.mode=class` と `state.mode=class` を同時に使う場合、生成側では modifier を variant 扱いに統一します
- `aria-*` の値は検証対象外です

#### `selectorPolicy.variant`

- **`mode`**: `data` / `class`
- **`dataKeys`**: バリアントに使う data 属性の allowlist
- **`valueNaming`**: data 値の命名ルール

#### `selectorPolicy.state`

- **`mode`**: `data` / `class`
- **`dataKey`**: 状態表現に使う data 属性（1 つに固定）
- **`ariaKeys`**: 状態に使う aria 属性の allowlist
- **`valueNaming`**: data 値の命名ルール

### `htmlFormat`

HTML にプレースホルダを付与する際の出力属性を制御します。

#### `htmlFormat.classAttribute`

```javascript
htmlFormat: {
  classAttribute: 'class' // 'class' | 'className'
}
```

- **`class`**: 標準 HTML 向け（デフォルト）
- **`className`**: JSX で `className` を使う場合に `className` で出力
- 入力の `class` / `className` はこの設定に合わせて統一されます
- 内部では `class` / `className` を一時的に `data-spiracss-classname` に変換して処理し、出力時に設定値へ戻します
- ファイル拡張子などの自動判定は行いません

### `generator`

HTML→SCSS 変換機能の設定です。

#### `generator.globalScssModule`

```javascript
generator: {
  globalScssModule: '@styles/partials/global'
}
```

生成される SCSS の先頭に `@use "<value>" as *;` が挿入されます。

#### `generator.pageEntryAlias` / `generator.pageEntrySubdir`

```javascript
generator: {
  pageEntryAlias: 'assets',
  pageEntrySubdir: 'css'
}
```

ルート Block の先頭に `// @assets/css/page-name.scss` のようなヒントコメントを出力します。

#### `generator.rootFileCase`

ルート Block の SCSS ファイル名ケースを指定します（子 Block には適用しません）。

- `preserve`（デフォルト） / `kebab` / `snake` / `camel` / `pascal`

#### `generator.childScssDir`

```javascript
generator: {
  childScssDir: 'scss'
}
```

#### `generator.layoutMixins`

```javascript
generator: {
  layoutMixins: ['@include breakpoint-up(md)']
}
```

配列の要素数だけ `@include` ブロックを生成します。空配列で無効化できます。

## プロジェクトごとのカスタマイズ例

```javascript
module.exports = {
  aliasRoots: {
    components: ['components'],
    styles: ['styles']
  },
  stylelint: {
    classStructure: {
      allowElementChainDepth: 4,
      enforceChildCombinator: true,
      enforceSingleRootBlock: true
    },
    interactionScope: {
      allowedPseudos: [':hover', ':focus'],
      requireComment: true
    },
    relComments: {
      requireInScssDirectories: true
    }
  },
  generator: {
    globalScssModule: '@styles/global',
    childScssDir: 'scss',
    layoutMixins: ['@include breakpoint-up(md)']
  }
}
```

## トラブルシューティング

### Comment Links のパス解決がうまくいかない

- `aliasRoots` のキー名に `@` が付いていないか確認
- パスがプロジェクトルートからの相対パスになっているか確認
- `spiracss.config.js` を保存し、ワークスペースの再読込を試す

### stylelint ルールが適用されない

- stylelint の設定ファイルでプラグインが読み込まれているか確認
- `spiracss.config.js` がプロジェクトルートにあるか確認

### 生成される SCSS の構造がおかしい

- `generator.globalScssModule` のパスが正しいか確認
- HTML の class が命名規則に合っているか確認

## 関連ツール
### ツール
- [stylelint プラグイン](stylelint.md)
- [HTML CLI](html-cli.md)
- [VSCode Comment Links](comment-links.md)
- [VSCode HTML to SCSS](html-to-scss.md)

### 設定
- spiracss.config.js

## SpiraCSS ドキュメント
- [スタイルガイド](../styleguide.md)
- [クイックスタート](../quickstart.md)
- [CSS レイヤー](../layers.md)
- [コンポーネント](../component.md)
- [ガイドライン](../guidelines.md)
