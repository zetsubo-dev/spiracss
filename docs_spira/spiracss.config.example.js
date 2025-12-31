// SpiraCSS 共通設定ファイル（サンプル）
// 実際のプロジェクトでは、このファイルをプロジェクトルートにコピーし、
// ディレクトリ構成に合わせて各パスやオプションを変更して使います。
//
// - aliasRoots:  @components / @assets / @styles などのエイリアス → 実ディレクトリの対応
// - stylelint:   @spiracss/stylelint-plugin の各ルールに渡すオプション
// - selectorPolicy: バリアント/状態の表現方針
// - htmlFormat: HTML プレースホルダ付与の出力属性
// - generator:   VS Code 拡張など HTML → SCSS 生成ツール用のオプション

/** @type {{ aliasRoots: Record<string, string[]>; stylelint: any; selectorPolicy: any; htmlFormat: any; generator: any }} */
const config = {
  // コメントリンクや stylelint の @rel 検証で使うエイリアス定義（プロジェクトルートからの相対パス / 絶対パスで変更）
  aliasRoots: {
    src: ['src'],
    components: ['src/components'],
    styles: ['src/styles'],
    common: ['src/components/common'],
    pages: ['src/components/pages'],
    parts: ['src/components/parts'],
    assets: ['src/assets']
  },

  // stylelint 用 SpiraCSS ルールの推奨設定（プロジェクトに合わせて変更）
  stylelint: {
    // セクションコメントの共通設定（デフォルト: { shared: /--shared/i, interaction: /--interaction/i }）
    sectionCommentPatterns: {
      shared: /--shared/i,
      interaction: /--interaction/i
    },

    classStructure: {
      // Element > Element の連鎖を何段まで許容するか（デフォルト: 4）
      allowElementChainDepth: 4,
      // 命名/構造チェックから除外するクラス名（完全一致 / デフォルト: []）
      allowExternalClasses: [],
      // 命名/構造チェックから除外するクラス名の接頭辞（前方一致 / 例: u- / swiper- / デフォルト: []）
      allowExternalPrefixes: ['u-'],
      // Block 直下の子に対して `>` 子セレクタを必須にするか（デフォルト: true）
      enforceChildCombinator: true,
      // 1ファイル内のルート Block を1つに制限するか（デフォルト: true）
      enforceSingleRootBlock: true,
      // ルート Block 名と SCSS ファイル名の一致を必須にするか（デフォルト: true）
      enforceRootFileName: true,
      // ルート Block の SCSS ファイル名ケース（デフォルト: 'preserve'）
      rootFileCase: 'preserve', // generator.rootFileCase と合わせる
      // 子 Block SCSS を配置するディレクトリ名（デフォルト: 'scss'）
      childScssDir: 'scss',
      // コンポーネント層のディレクトリ名（デフォルト: ['components']）
      componentsDirs: ['components'],
      // 命名スタイルのカスタマイズ（省略時は SpiraCSS デフォルト）
      naming: {
        // Block の単語ケース（kebab / snake / camel / pascal / デフォルト: 'kebab'）
        blockCase: 'kebab',
        // Block の語数上限（最小値は 2 固定 / デフォルト: 2）
        blockMaxWords: 2,
        // Element の単語ケース（kebab / snake / camel / pascal / デフォルト: 'kebab'）
        elementCase: 'kebab',
        // Modifier（class モード）の単語ケース（kebab / snake / camel / pascal / デフォルト: 'kebab'）
        modifierCase: 'kebab',
        // Modifier（class モード）の接頭辞（デフォルト: '-'）
        modifierPrefix: '-',
        // 命名ルールを正規表現で完全上書きしたい場合に使用（デフォルト: なし）
        customPatterns: {
          // block: /^custom-block-.+$/, // 例
          // element: /^icon-.+$/, // 例
          // modifier: /^--[a-z]+(-[a-z]+)?$/ // 例
        }
      }
    },

    interactionScope: {
      // 検査対象の擬似クラス（デフォルト: [':hover', ':focus', ':focus-visible', ':active', ':visited']）
      allowedPseudos: [':hover', ':focus', ':focus-visible', ':active', ':visited'],
      // @at-root & { ... } と & 起点の必須化（デフォルト: true）
      requireAtRoot: true,
      // --interaction コメントの必須化（デフォルト: true）
      requireComment: true,
      // interaction ブロックを末尾に置くか（デフォルト: true）
      requireTail: true,
      // コメントがあるブロックだけ検査するか（デフォルト: false）
      enforceWithCommentOnly: false,
      // selectorPolicy は top-level を参照（明示的に上書きしたい場合のみ指定）
      // selectorPolicy: { ... }
    },

    relComments: {
      // scss ディレクトリ配下で @rel を必須にするか（デフォルト: true）
      requireInScssDirectories: true,
      // meta.load-css がある場合に @rel を必須にするか（デフォルト: true）
      requireWhenMetaLoadCss: true,
      // @rel のパス存在チェックを行うか（デフォルト: true）
      validatePath: true,
      // ルールがないファイルはスキップするか（デフォルト: true）
      skipFilesWithoutRules: true,
      // 親→子の @rel を必須にするか（デフォルト: true）
      requireChildRelComments: true,
      // shared セクション内でも子 @rel を必須にするか（デフォルト: true）
      requireChildRelCommentsInShared: true,
      // interaction セクション内でも子 @rel を必須にするか（デフォルト: true）
      requireChildRelCommentsInInteraction: true,
      // 子→親の @rel を必須にするか（デフォルト: true）
      requireParentRelComment: true,
      // 子 Block SCSS を配置するディレクトリ名（デフォルト: 'scss'）
      childScssDir: 'scss'
    }
  },

  // バリアント/状態の表現方針（デフォルトは data 属性）
  selectorPolicy: {
    // data 値の命名ルール（共通デフォルト）
    valueNaming: {
      case: 'kebab', // 'kebab' | 'snake' | 'camel' | 'pascal'
      maxWords: 2    // 最大語数（デフォルト: 2）
    },
    variant: {
      // 'data' | 'class'
      mode: 'data',
      // バリアントに使う data 属性の allowlist（デフォルト: ['data-variant']）
      dataKeys: ['data-variant']
    },
    state: {
      // 'data' | 'class'
      mode: 'data',
      // 状態表現に使う data 属性のキー（デフォルト: 'data-state'）
      dataKey: 'data-state',
      // 状態に使ってよい aria 属性の allowlist
      ariaKeys: ['aria-expanded', 'aria-selected', 'aria-disabled'],
      // valueNaming: { maxWords: 1 } // state 側だけ上書きしたい場合
    }
  },

  // HTML プレースホルダ付与時の出力属性（デフォルト: 'class'）
  htmlFormat: {
    // 'class' | 'className'
    classAttribute: 'class'
  },

  // HTML → SCSS 生成ツール（VS Code 拡張 / CLI）用の設定
  generator: {
    // 生成 SCSS に共通で挿入する `@use "<path>" as *;` のパス（デフォルト: '@styles/partials/global'）
    globalScssModule: '@styles/partials/global',
    // ページエントリコメントのエイリアス（デフォルト: 'assets'）
    pageEntryAlias: 'assets',
    // ページエントリコメントのサブディレクトリ名（デフォルト: 'css'）
    pageEntrySubdir: 'css',
    // ルート SCSS のファイル名ケース（preserve / kebab / snake / camel / pascal / デフォルト: 'preserve'）
    rootFileCase: 'preserve',
    // 子 Block SCSS を出力するディレクトリ名（デフォルト: 'scss'）
    childScssDir: 'scss',
    // レイアウト用 Mixin の配列（デフォルト: ['@include breakpoint-up(md)']）
    layoutMixins: ['@include breakpoint-up(md)']
  }
}

export default config
