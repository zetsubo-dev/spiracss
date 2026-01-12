# spiracss.config.js 設定ガイド

`spiracss.config.js` は SpiraCSS 関連ツールで共有される設定ファイルです。
主な参照先は以下です。

- **aliasRoots**: Comment Links / Stylelint のパス解決
- **stylelint**: ルール設定（classStructure / interactionScope / interactionProperties / keyframesNaming / pseudoNesting / relComments など）
- **selectorPolicy**: バリアント/状態の表現方針（lint / generator / HTML lint）
- **htmlFormat**: HTML プレースホルダ付与の出力属性
- **generator**: HTML→SCSS 生成

## セットアップ

`spiracss.config.js` はプロジェクトルートに配置します。
`package.json` に `"type": "module"` がある場合は ESM、その他は CommonJS で記述してください。

必須ファイルの配置は [クイックスタート](../quickstart.md) を参照してください。

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

## 読み込み仕様（共通）

- 対象ファイルは `spiracss.config.js` のみ（`.cjs` / `.mjs` の自動探索なし）
- 読み込み位置:
  - **HTML CLI**: `process.cwd()` 配下
  - **VS Code 拡張**: ワークスペースルート
  - **Stylelint**: `createRules()` / `createRulesAsync()` の引数
- 読み込み失敗時の挙動:
  - **HTML CLI**: ファイル未存在ならデフォルトで続行（設置推奨）。存在するのに読み込めない場合はエラー終了
  - **VS Code 拡張**: 警告を出してデフォルト設定で続行
  - **Stylelint**: 例外を投げて終了

## 目次
- [読み込み仕様（共通）](#読み込み仕様共通)
- [aliasRoots](#aliasroots)
- [stylelint](#stylelint)
- [selectorPolicy](#selectorpolicy)
- [htmlFormat](#htmlformat)
- [generator](#generator)
- [プロジェクトごとのカスタマイズ例](#プロジェクトごとのカスタマイズ例)
- [トラブルシューティング](#トラブルシューティング)

## 設定項目

### `aliasRoots`

エイリアスパスの解決ルートを定義します。

```js
aliasRoots: {
  components: ['src/components'],
  styles: ['src/styles']
}
```

- キーに `@` プレフィックスは不要です（`components` → `@components/...`）
- キーは `[a-z][a-z0-9-]*` を推奨します（Stylelint はこの形式のみ解決可能 / Comment Links は `aliasRoots` に定義すれば任意キーでも認識）
- 値は配列で指定します（相対パス推奨 / 絶対パスはプロジェクト内のみ）
  - **Stylelint**: 解決結果がプロジェクトルート外になる候補を採用しません（ベース自体は検証しません）
  - **Comment Links**: ベースがプロジェクトルート外のものを無視し、解決結果がプロジェクトルート外のものも無視します
- プロジェクトルートの基準:
  - **Stylelint**: `cwd`（サブディレクトリから実行すると基準も変わります。`createRulesAsync(path)` は設定ファイルの読み込みパス指定で、プロジェクトルート自体は変わりません。必要ならプロジェクトルートで実行するか、タスクランナーの working directory／Node API の `cwd` を設定）
  - **Comment Links**: VS Code のワークスペースフォルダ
- `aliasRoots` に無いエイリアスは Stylelint 側では解決できません
- Comment Links は `aliasRoots` のキー、または既定エイリアス（`@src` / `@components` / `@styles` / `@assets` / `@pages` / `@parts` / `@common`）のみをリンク化します
- CLI ツールは `aliasRoots` を参照しません
- SpiraCSS Stylelint プラグインの `createRules()` / `createRulesAsync()` を使う場合、`aliasRoots` は必須です（未設定だとエラー）

### `stylelint`

SpiraCSS Stylelint プラグインのルール設定です。
`createRules()` / `createRulesAsync()` を使う場合、`classStructure` / `interactionScope` / `interactionProperties` / `keyframesNaming` / `pseudoNesting` / `relComments` は未指定でもデフォルトが適用されます（`aliasRoots` は必須）。
ESM で設定パスを渡したい場合は `createRulesAsync()` を使用します。
`stylelint` を指定する場合は **プレーンオブジェクト必須** です（`stylelint: []` や `new Map()` などはエラー）。

#### `stylelint.sectionCommentPatterns`

shared / interaction セクションのコメント判定を一元化します。
`createRules()` / `createRulesAsync()` を使う場合は、ここに書いた値が各ルールに展開されます（個別指定がある場合はそちらが優先）。

```js
stylelint: {
  sectionCommentPatterns: {
    shared: /--shared/i,
    interaction: /--interaction/i
  }
}
```

> 注意: `shared` / `interaction` は **RegExp または文字列**を指定できます。文字列は `new RegExp(pattern, 'i')` として扱われ、無効/危険なパターンはデフォルトにフォールバックします。柔軟性が必要な場合は RegExp の指定を推奨します。

#### `stylelint.cacheSizes`

Stylelint ルール内の LRU キャッシュサイズをまとめて指定します。
未指定時は各キャッシュとも **1000** です。

```js
stylelint: {
  cacheSizes: {
    selector: 1000,
    patterns: 1000,
    naming: 1000,
    path: 1000
  }
}
```

- **`selector`**: セレクタ解析キャッシュ（postcss-selector-parser）
- **`patterns`**: 命名パターン生成キャッシュ
- **`naming`**: Block 命名パターンキャッシュ
- **`path`**: @rel パス存在チェックキャッシュ

> すべて正の整数で指定してください。各ルール（classStructure / interactionScope / interactionProperties / keyframesNaming / pseudoNesting / relComments）で `cacheSizes` を指定した場合はそちらが優先されます。

#### `stylelint.classStructure`

クラス命名規則とセレクタ構造のルールを定義します。

**設定一覧:**

| 項目 | 型 | デフォルト | 説明 |
| --- | --- | --- | --- |
| `allowElementChainDepth` | number | `4` | Element 連鎖の段数上限 |
| `allowExternalClasses` | string[] | `[]` | 外部クラスを除外（完全一致） |
| `allowExternalPrefixes` | string[] | `[]` | 外部クラスを除外（前方一致） |
| `enforceChildCombinator` | boolean | `true` | Block 直下に `>` を必須化 |
| `enforceSingleRootBlock` | boolean | `true` | 1 ファイル 1 ルート Block |
| `enforceRootFileName` | boolean | `true` | ルート Block 名とファイル名一致 |
| `rootFileCase` | `'preserve' \| 'kebab' \| 'snake' \| 'camel' \| 'pascal'` | `'preserve'` | ルート Block のファイル名ケース |
| `childScssDir` | string | `'scss'` | 子 Block SCSS の配置ディレクトリ |
| `componentsDirs` | string[] | `['components']` | コンポーネント層として扱うディレクトリ |
| `naming` | object | 下表参照 | 命名規則のカスタマイズ |
| `sharedCommentPattern` | RegExp / string | `/--shared/i` | shared コメントの個別指定（`sectionCommentPatterns` より優先） |
| `interactionCommentPattern` | RegExp / string | `/--interaction/i` | interaction コメントの個別指定（`sectionCommentPatterns` より優先） |
| `selectorPolicy` | object | `data-variant` / `data-state` / `aria-*` | ルール単体指定（`createRules()` / `createRulesAsync()` では top-level を優先） |
| `cacheSizes` | object | `stylelint.cacheSizes` | ルール単体指定（未指定時は `stylelint.cacheSizes`、未指定なら各 1000） |

**`naming` サブ項目:**

| 項目 | 型 | デフォルト | 説明 |
| --- | --- | --- | --- |
| `blockCase` | `'kebab' \| 'camel' \| 'pascal' \| 'snake'` | `'kebab'` | Block のケース |
| `blockMaxWords` | number | `2` | Block の最大語数（2〜100。下限 2 は固定、100 超は 100 にクランプ） |
| `elementCase` | `'kebab' \| 'camel' \| 'pascal' \| 'snake'` | `'kebab'` | Element のケース |
| `modifierCase` | `'kebab' \| 'camel' \| 'pascal' \| 'snake'` | `'kebab'` | Modifier のケース |
| `modifierPrefix` | string | `'-'` | Modifier のプレフィックス |
| `customPatterns` | object | `undefined` | カスタム正規表現（下表参照） |

**`customPatterns` サブキー:**

| サブキー | 対象 | 例 |
| --- | --- | --- |
| `block` | Block の base class | `/^custom-block-.+$/` |
| `element` | Element の base class | `/^icon-.+$/` |
| `modifier` | Modifier | `/^--[a-z]+(-[a-z]+)?$/` |

例:

```js
stylelint: {
  classStructure: {
    allowElementChainDepth: 4,
    allowExternalClasses: [],
    allowExternalPrefixes: ['swiper-'],
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

**注意事項:**

- `customPatterns` を使う場合、HTML プレースホルダ（`block-box` / `element`）と一致しない可能性があるため整合性を確認してください。
- `customPatterns` は **RegExp のみ有効** です。`g` / `y` フラグ付きは無効になります。
- Element は **常に 1 語**です。`elementCase=camel/pascal` でも内部大文字で語分割しません（例: `bodyText` / `BodyText` は 1 語で 2 語以上に見えるため不許可）。
- HTML lint / HTML 生成でも `classStructure.naming` / `allowExternalClasses` / `allowExternalPrefixes` を参照します。
- `enforceRootFileName` は `componentsDirs` 配下のみを対象とし、`assets/css`、`index.scss`、`_*.scss` は除外されます。
- `enforceRootFileName` の期待値は `childScssDir` 配下なら root Block 名のまま、配下外なら `rootFileCase` で整形したファイル名です。
- `createRules()` / `createRulesAsync()` を使う場合、`generator.rootFileCase` / `generator.childScssDir` が未指定項目のフォールバックに使われます。

#### `stylelint.interactionScope`

interaction セクション（`// --interaction` と `@at-root & { ... }`）の配置ルールを検証します。

```js
stylelint: {
  interactionScope: {
    allowedPseudos: [':hover', ':focus', ':focus-visible', ':active', ':visited'],
    requireAtRoot: true,
    requireComment: true,
    requireTail: true,
    enforceWithCommentOnly: false,
    selectorPolicy: { ... } // 任意（未指定時は top-level selectorPolicy を使用）
  }
}
```

interaction セクションは**常にルート Block 直下**に配置します（設定で無効化できません。@layer/@supports/@media/@container/@scope のラッパー内でも可）。

**設定一覧:**

| 項目 | 型 | デフォルト | 説明 |
| --- | --- | --- | --- |
| `allowedPseudos` | string[] | `[':hover', ':focus', ':focus-visible', ':active', ':visited']` | 検証対象とする擬似クラス |
| `requireAtRoot` | boolean | `true` | `@at-root & { ... }` と `&` 起点のセレクタを必須化 |
| `requireComment` | boolean | `true` | `// --interaction` コメントを必須にするか |
| `requireTail` | boolean | `true` | interaction ブロックを末尾に置くか |
| `enforceWithCommentOnly` | boolean | `false` | コメント付きブロックのみ検査するか |
| `interactionCommentPattern` | RegExp / string | `/--interaction/i` | セクションコメントの個別指定（`sectionCommentPatterns` より優先） |
| `selectorPolicy` | object | `data-variant` / `data-state` / `aria-*` | このルール内での上書き（未指定時は top-level を使用） |
| `cacheSizes` | object | `stylelint.cacheSizes` | ルール単体指定（未指定時は `stylelint.cacheSizes`、未指定なら各 1000） |

#### `stylelint.interactionProperties`

interaction セクション内の transition / animation 宣言と、transition 対象プロパティの整合を検証します。

```js
stylelint: {
  interactionProperties: {
    // shared / interaction コメントの個別指定が必要ならここで上書き
    // sharedCommentPattern: /--shared/i,
    // interactionCommentPattern: /--interaction/i
  }
}
```

**設定一覧:**

| 項目 | 型 | デフォルト | 説明 |
| --- | --- | --- | --- |
| `sharedCommentPattern` | RegExp / string | `/--shared/i` | セクションコメントの個別指定（`sectionCommentPatterns` より優先） |
| `interactionCommentPattern` | RegExp / string | `/--interaction/i` | セクションコメントの個別指定（`sectionCommentPatterns` より優先） |
| `naming` | object | `classStructure.naming` | 命名設定（`createRules()` / `createRulesAsync()` 使用時のみ `classStructure` から自動継承） |
| `allowExternalClasses` | string[] | `classStructure.allowExternalClasses` | 外部クラスの除外（完全一致。`createRules()` / `createRulesAsync()` 使用時のみ `classStructure` から自動継承） |
| `allowExternalPrefixes` | string[] | `classStructure.allowExternalPrefixes` | 外部クラスの除外（前方一致。`createRules()` / `createRulesAsync()` 使用時のみ `classStructure` から自動継承） |
| `cacheSizes` | object | `stylelint.cacheSizes` | ルール単体指定（未指定時は `stylelint.cacheSizes`、未指定なら各 1000） |

#### `stylelint.keyframesNaming`

`@keyframes` の命名と配置ルールを検証します。

```js
stylelint: {
  keyframesNaming: {
    actionMaxWords: 3,
    blockNameSource: 'selector',
    warnOnMissingBlock: true,
    sharedPrefixes: ['kf-'],
    sharedFiles: ['keyframes.scss'],
    ignoreFiles: [],
    ignorePatterns: [],
    // ignorePatterns に一致した keyframes の配置チェックをスキップするか（デフォルト: false）
    ignorePlacementForIgnored: false
  }
}
```

**設定一覧:**

| 項目 | 型 | デフォルト | 説明 |
| --- | --- | --- | --- |
| `actionMaxWords` | number | `3` | action の語数上限（1〜3） |
| `blockNameSource` | `'selector' \| 'file' \| 'selector-or-file'` | `'selector'` | Block 名の取得元（`selector` は最初の root Block、`file` はファイル名、`selector-or-file` はフォールバック） |
| `warnOnMissingBlock` | boolean | `true` | Block を判定できない場合に警告するか |
| `sharedPrefixes` | string[] | `['kf-']` | 共有 keyframes の prefix |
| `sharedFiles` | (string \| RegExp)[] | `['keyframes.scss']` | shared keyframes を許可するファイルパターン（文字列は suffix 判定） |
| `ignoreFiles` | (string \| RegExp)[] | `[]` | keyframes ルールを無視するファイルパターン（文字列は suffix 判定） |
| `ignorePatterns` | (string \| RegExp)[] | `[]` | keyframes 名を無視するパターン（文字列は RegExp として解釈） |
| `ignorePlacementForIgnored` | boolean | `false` | `ignorePatterns` に一致した keyframes の配置チェック（root/末尾）をスキップする |
| `naming` | object | `classStructure.naming` | 命名設定（`createRules()` / `createRulesAsync()` 使用時のみ `classStructure` から自動継承） |
| `allowExternalClasses` | string[] | `classStructure.allowExternalClasses` | 外部クラスの除外（完全一致。`createRules()` / `createRulesAsync()` 使用時のみ `classStructure` から自動継承） |
| `allowExternalPrefixes` | string[] | `classStructure.allowExternalPrefixes` | 外部クラスの除外（前方一致。`createRules()` / `createRulesAsync()` 使用時のみ `classStructure` から自動継承） |
| `cacheSizes` | object | `stylelint.cacheSizes` | ルール単体指定（未指定時は `stylelint.cacheSizes`、未指定なら各 1000） |

#### `stylelint.pseudoNesting`

疑似クラス / 疑似要素を `&` にネストして書くルールです。

```js
stylelint: {
  pseudoNesting: {}
}
```

**設定一覧:**

| 項目 | 型 | デフォルト | 説明 |
| --- | --- | --- | --- |
| `cacheSizes` | object | `stylelint.cacheSizes` | ルール単体指定（未指定時は `stylelint.cacheSizes`、未指定なら各 1000） |

- 例: `.btn { &:hover { ... } }`, `.btn { &::before { ... } }`
- 不可: `.btn:hover { ... }`, `& > .btn:hover { ... }`

#### `stylelint.relComments`

`@rel` リンクコメントのルールを定義します。

```js
stylelint: {
  relComments: {
    requireInScssDirectories: true,
    requireWhenMetaLoadCss: true,
    validatePath: true,
    skipFilesWithoutRules: true,
    requireChildRelComments: true,
    requireChildRelCommentsInShared: true,
    requireChildRelCommentsInInteraction: false,
    requireParentRelComment: true,
    childScssDir: 'scss'
  }
}
```

**設定一覧:**

| 項目 | 型 | デフォルト | 説明 |
| --- | --- | --- | --- |
| `requireInScssDirectories` | boolean | `true` | `childScssDir` 配下の SCSS で @rel を必須にするか |
| `requireWhenMetaLoadCss` | boolean | `true` | `@include meta.load-css("<childScssDir>")` を含む親 Block で先頭コメントを必須にするか |
| `validatePath` | boolean | `true` | パスの実在検証を行うか |
| `skipFilesWithoutRules` | boolean | `true` | セレクタルールが無い SCSS をスキップするか |
| `requireChildRelComments` | boolean | `true` | 親→子の @rel を必須にするか |
| `requireChildRelCommentsInShared` | boolean | `true` | shared セクション内でも子 @rel を必須にするか |
| `requireChildRelCommentsInInteraction` | boolean | `false` | interaction セクション内でも子 @rel を必須にするか |
| `requireParentRelComment` | boolean | `true` | 子→親の @rel を必須にするか（`requireWhenMetaLoadCss` / `requireInScssDirectories` が有効な場合のみ） |
| `childScssDir` | string | `'scss'` | 子 Block の SCSS を置くディレクトリ名（`createRules()` / `createRulesAsync()` 使用時のみ `generator.childScssDir` が未指定時のフォールバック） |
| `sharedCommentPattern` | RegExp / string | `/--shared/i` | セクションコメントの個別指定（`sectionCommentPatterns` より優先） |
| `interactionCommentPattern` | RegExp / string | `/--interaction/i` | セクションコメントの個別指定（`sectionCommentPatterns` より優先） |
| `naming` | object | `classStructure.naming` | 命名設定（`createRules()` / `createRulesAsync()` 使用時のみ `classStructure` から自動継承） |
| `allowExternalClasses` | string[] | `classStructure.allowExternalClasses` | 外部クラスの除外（完全一致。`createRules()` / `createRulesAsync()` 使用時のみ `classStructure` から自動継承） |
| `allowExternalPrefixes` | string[] | `classStructure.allowExternalPrefixes` | 外部クラスの除外（前方一致。`createRules()` / `createRulesAsync()` 使用時のみ `classStructure` から自動継承） |
| `cacheSizes` | object | `stylelint.cacheSizes` | ルール単体指定（未指定時は `stylelint.cacheSizes`、未指定なら各 1000） |

補足:
- エイリアスの解決は `aliasRoots` を参照します（`validatePath: true` の場合）
- `requireParentRelComment` は `requireWhenMetaLoadCss` が有効で `@include meta.load-css(...)` を含む親 Block、または `requireInScssDirectories` が有効で `childScssDir` 配下にある SCSS の場合にのみ発火します

詳細は [SpiraCSS Comment Links](comment-links.md) を参照してください。

### `selectorPolicy`

バリアント/状態の表現方法を切り替える共通設定です。
デフォルトは **バリアント=`data-variant` / 状態=`data-state`** を使用し、`aria-expanded` / `aria-selected` / `aria-disabled` も状態扱いします。

```js
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

**設定一覧:**

| 項目 | 型 | デフォルト | 説明 |
| --- | --- | --- | --- |
| `valueNaming` | object | `{ case: 'kebab', maxWords: 2 }` | data 値の命名ルール（共通） |
| `variant` | object | `{ mode: 'data', dataKeys: ['data-variant'] }` | バリアントの表現方針 |
| `state` | object | `{ mode: 'data', dataKey: 'data-state', ariaKeys: [...] }` | 状態の表現方針 |

補足:
- `mode` は `data` / `class` のみ有効です
- data 値の命名は `valueNaming` を基準に `variant/state.valueNaming` で上書きできます
- HTML lint もここで指定した予約キーのみを検証します
- `variant.mode=class` と `state.mode=class` を同時に使う場合、生成側では modifier を variant 扱いに統一します
- `aria-*` の値は仕様や許容値が広いため検証対象外です

#### `selectorPolicy.variant`

| 項目 | 型 | デフォルト | 説明 |
| --- | --- | --- | --- |
| `mode` | `'data' \| 'class'` | `'data'` | バリアントの表現モード |
| `dataKeys` | string[] | `['data-variant']` | data 属性の allowlist（空配列はデフォルトにフォールバック。無効化不可） |
| `valueNaming` | object | `selectorPolicy.valueNaming` | data 値の命名ルール |

#### `selectorPolicy.state`

| 項目 | 型 | デフォルト | 説明 |
| --- | --- | --- | --- |
| `mode` | `'data' \| 'class'` | `'data'` | 状態の表現モード |
| `dataKey` | string | `'data-state'` | 状態表現に使う data 属性（1 つに固定） |
| `ariaKeys` | string[] | `['aria-expanded', 'aria-selected', 'aria-disabled']` | aria 属性の allowlist（空配列はデフォルトにフォールバック。無効化不可） |
| `valueNaming` | object | `selectorPolicy.valueNaming` | data 値の命名ルール |

### `htmlFormat`

HTML にプレースホルダを付与する際の出力属性を制御します。

#### `htmlFormat.classAttribute`

**設定一覧:**

| 項目 | 型 | デフォルト | 説明 |
| --- | --- | --- | --- |
| `classAttribute` | `'class' \| 'className'` | `'class'` | 出力するクラス属性 |

補足:
- 入力の `class` / `className` はこの設定に合わせて統一されます
- 内部では `class` / `className` を一時的に `data-spiracss-classname` に変換して処理し、出力時に設定値へ戻します
- ファイル拡張子などの自動判定は行いません

### `generator`

HTML→SCSS 変換機能の設定です。

**設定一覧:**

| 項目 | 型 | デフォルト | 説明 |
| --- | --- | --- | --- |
| `globalScssModule` | string | `'@styles/partials/global'` | 各生成 SCSS の先頭に `@use "<value>" as *;` を挿入（root mode のルート Block SCSS では直後に `@use "sass:meta";` が続きます） |
| `pageEntryAlias` | string | `'assets'` | ページエントリコメントのエイリアス |
| `pageEntrySubdir` | string | `'css'` | ページエントリコメントのサブディレクトリ |
| `rootFileCase` | `'preserve' \| 'kebab' \| 'snake' \| 'camel' \| 'pascal'` | `'preserve'` | ルート Block のファイル名ケース |
| `childScssDir` | string | `'scss'` | 子 Block SCSS の出力ディレクトリ |
| `layoutMixins` | string[] | `['@include breakpoint-up(md)']` | レイアウト用 Mixin の配列 |

例:

```js
generator: {
  globalScssModule: '@styles/global',
  pageEntryAlias: 'assets',
  pageEntrySubdir: 'css',
  rootFileCase: 'kebab',
  childScssDir: 'scss',
  layoutMixins: ['@include breakpoint-up(md)', '@include breakpoint-up(lg)']
}
```

補足:
- `pageEntryAlias` / `pageEntrySubdir`: root mode のルート Block SCSS ファイル先頭（ヘッダ）に `// @assets/css/index.scss` 形式のコメントを出力（selection mode では `// @rel/(parent-block).scss` が出力されます）
- `pageEntrySubdir`: 空文字の場合は `// @assets/index.scss` のようにサブディレクトリを省略
- `rootFileCase`: 子 Block には適用しない
- `layoutMixins`: 配列の要素数だけ `@include` ブロックを生成（空配列で無効化）

## プロジェクトごとのカスタマイズ例

```js
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
    pseudoNesting: {},
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

### Stylelint ルールが適用されない

- Stylelint の設定ファイルでプラグインが読み込まれているか確認
- `spiracss.config.js` が Stylelint 実行時の `cwd` に存在するか確認（サブディレクトリから実行している場合は `createRulesAsync(path)` で設定パスを明示）

### 生成される SCSS の構造がおかしい

- `generator.globalScssModule` のパスが正しいか確認
- HTML の class が命名規則に合っているか確認

## 関連ツール
### ツール
- [SpiraCSS Stylelint プラグイン](stylelint.md)
- [SpiraCSS HTML CLI](html-cli.md)
- [SpiraCSS Comment Links](comment-links.md)
- [SpiraCSS HTML to SCSS](html-to-scss.md)

### 設定例
- [spiracss.config.example.js](spiracss.config.example.js)

## SpiraCSS ドキュメント
- [設計原則](../principles.md)
- [クイックスタート](../quickstart.md)
- [CSS レイヤー](../layers.md)
- [コンポーネント](../component.md)
- [ガイドライン](../guidelines.md)
- [設計思想](../philosophy.md)
