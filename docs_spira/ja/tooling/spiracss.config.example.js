// SpiraCSS 共通設定ファイル（サンプル）
// 実際のプロジェクトでは、このファイルをプロジェクトルートにコピーし、
// ディレクトリ構成に合わせて各パスやオプションを変更して使います。
// このサンプルは ESM 形式です。CommonJS の書き方は spiracss-config.md を参照してください。
//
// - aliasRoots:  @components / @assets / @styles などのエイリアス → 実ディレクトリの対応
// - stylelint:   @spiracss/stylelint-plugin の各ルールに渡すオプション
// - selectorPolicy: バリアント/状態の表現方針
// - htmlFormat: HTML プレースホルダ付与の出力属性
// - generator:   VS Code 拡張など HTML → SCSS 生成ツール用のオプション

/** @type {{ aliasRoots: Record<string, string[]>; stylelint: any; selectorPolicy: any; htmlFormat: any; generator: any }} */
const config = {
  // コメントリンクや stylelint の @rel 検証で使うエイリアス定義（プロジェクトルートからの相対パス推奨 / 絶対パスはプロジェクト内のみ）
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
    // 複数ルールに共通で使う設定（省略時は各ルールのデフォルト）
    base: {
      // キャッシュサイズ（LRU / デフォルト: 1000）
      cache: {
        selector: 1000,
        patterns: 1000,
        naming: 1000,
        path: 1000
      },
      // セクションコメントの共通設定（デフォルト: { shared: /--shared/i, interaction: /--interaction/i }）
      comments: {
        shared: /--shared/i,
        interaction: /--interaction/i
      },
      // 命名/構造チェックから除外するクラス名（完全一致 / デフォルト: []）
      external: {
        classes: [],
        // 命名/構造チェックから除外するクラス名の接頭辞（前方一致 / 例: u- / swiper- / デフォルト: []）
        prefixes: ['u-']
      },
      // 命名スタイルのカスタマイズ（省略時は SpiraCSS デフォルト）
      naming: {
        // Block の単語ケース（kebab / snake / camel / pascal / デフォルト: 'kebab'）
        blockCase: 'kebab',
        // Block の語数上限（2〜100 / デフォルト: 2）
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

    class: {
      // Element > Element の連鎖を何段まで許容するか（デフォルト: 4）
      elementDepth: 4,
      // Block 直下の子に対して `>` 子セレクタを必須にするか（デフォルト: true）
      childCombinator: true,
      // 子要素は Block 内でネスト必須にするか（デフォルト: true）
      childNesting: true,
      // 1 ファイル内のルート Block を 1 つに制限するか（デフォルト: true）
      rootSingle: true,
      // ルート Block 名と SCSS ファイル名の一致を必須にするか（デフォルト: true）
      rootFile: true,
      // ルート Block の SCSS ファイル名ケース（デフォルト: 'preserve'）
      rootCase: 'preserve', // generator.rootFileCase と合わせる
      // 子 Block SCSS を配置するディレクトリ名（デフォルト: 'scss'）
      // コンポーネント層のディレクトリ名（デフォルト: ['components']）
      childDir: 'scss',
      componentsDirs: ['components']
    },

    placement: {
      // Element 連鎖の段数上限（デフォルト: class.elementDepth / 未指定なら 4）
      elementDepth: 4,
      // 縦方向マージンの許可側（top / bottom / デフォルト: 'top'）
      marginSide: 'top',
      // child Block の position 制限を有効にするか（デフォルト: true）
      position: true,
      // width/height/min/max を内部プロパティとして扱うか（デフォルト: true）
      sizeInternal: true,
      // 透過扱いにする @include の Mixin 名（デフォルト: []）
      responsiveMixins: []
    },

    interactionScope: {
      // 検査対象の擬似クラス（デフォルト: [':hover', ':focus', ':focus-visible', ':active', ':visited']）
      pseudos: [':hover', ':focus', ':focus-visible', ':active', ':visited'],
      // @at-root & { ... } と & 起点の必須化（デフォルト: true）
      requireAtRoot: true,
      // --interaction コメントの必須化（デフォルト: true）
      requireComment: true,
      // interaction ブロックを末尾に置くか（デフォルト: true）
      requireTail: true,
      // コメントがあるブロックだけ検査するか（デフォルト: false）
      commentOnly: false
      // selectorPolicy は top-level を参照（明示的に上書きしたい場合のみ指定）
      // selectorPolicy: { ... }
    },
    interactionProps: {
      // transition/animation を interaction セクションに集約するルール
      // comments.shared / comments.interaction は必要なら上書き
      // comments: { shared: /--shared/i, interaction: /--interaction/i }
    },

    keyframes: {
      // このルールを有効にするか（デフォルト: true）
      enabled: true,
      // action の語数上限（1〜3 / デフォルト: 3）
      actionMaxWords: 3,
      // Block 名の取得元（selector / file / selector-or-file / デフォルト: selector）
      blockSource: 'selector',
      // Block 判定できない場合に警告（デフォルト: true）
      blockWarnMissing: true,
      // 共有 keyframes の prefix（デフォルト: ['kf-']）
      sharedPrefixes: ['kf-'],
      // 共有 keyframes を許可するファイル名（文字列は suffix 判定 / デフォルト: ['keyframes.scss']）
      sharedFiles: ['keyframes.scss'],
      // ルール対象外にするファイル名（文字列は suffix 判定 / デフォルト: []）
      ignoreFiles: [],
      // ルール対象外にする keyframes 名（文字列は RegExp として扱う / デフォルト: []）
      ignorePatterns: [],
      // ignorePatterns に一致した keyframes の配置チェックをスキップするか（デフォルト: false）
      ignoreSkipPlacement: false
    },

    // 擬似クラス/擬似要素は & の中でネストして書く
    pseudo: {},

    rel: {
      // scss ディレクトリ配下で @rel を必須にするか（デフォルト: true）
      requireScss: true,
      // meta.load-css がある場合に @rel を必須にするか（デフォルト: true）
      requireMeta: true,
      // 子→親の @rel を必須にするか（デフォルト: true）
      requireParent: true,
      // 親→子の @rel を必須にするか（デフォルト: true）
      requireChild: true,
      // shared セクション内でも子 @rel を必須にするか（デフォルト: true）
      requireChildShared: true,
      // interaction セクション内でも子 @rel を必須にするか（デフォルト: false）
      requireChildInteraction: false,
      // @rel のパス存在チェックを行うか（デフォルト: true）
      validatePath: true,
      // ルールがないファイルはスキップするか（デフォルト: true）
      skipNoRules: true,
      // 子 Block SCSS を配置するディレクトリ名（デフォルト: 'scss'）
      childDir: 'scss'
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
