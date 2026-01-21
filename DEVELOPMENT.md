# SpiraCSS Monorepo - 開発ガイド

このドキュメントは SpiraCSS プロジェクトの開発者・メンテナー向けです。

## 開発環境セットアップ

### 必要な環境

- Node.js 25.2.1（各パッケージの `.node-version` を参照）
- Yarn 4.10.3（Corepack で管理）

### 初回セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/zetsubo-dev/spiracss.git
cd spiracss

# Corepack を有効化（初回のみ）
corepack enable

# ワークスペース全体の依存をインストール
yarn install
```

## ワークスペース構成

このリポジトリは Yarn 4 Workspaces で管理されています。

```json
{
  "workspaces": [
    "packages/*",
    "vscode/*"
  ]
}
```

各パッケージは個別に開発できます。詳細は各パッケージの README を参照してください。

## ビルド

### SpiraCSS Stylelint プラグイン

```bash
cd packages/stylelint-plugin
yarn build
```

### SpiraCSS HTML CLI (@spiracss/html-cli)

```bash
cd packages/html-cli
yarn build
```

### VS Code 拡張

```bash
cd vscode/spiracss-comment-links
yarn compile

cd ../spiracss-html-to-scss
yarn compile
```

## テスト

### SpiraCSS Stylelint プラグイン

```bash
cd packages/stylelint-plugin
yarn test
```

### SpiraCSS HTML CLI (@spiracss/html-cli)

```bash
cd packages/html-cli
yarn test
```

### VS Code 拡張

```bash
cd vscode/spiracss-comment-links
yarn test

cd ../spiracss-html-to-scss
yarn test
```

## リリース手順

### 1. バージョンアップ

全パッケージのバージョンを統一して更新します。

```bash
# 以下のファイルの "version" を同じ番号に変更
# - package.json
# - packages/stylelint-plugin/package.json
# - packages/html-cli/package.json
# - vscode/spiracss-comment-links/package.json
# - vscode/spiracss-html-to-scss/package.json
```

### 2. VS Code 拡張の .vsix を再生成

```bash
VERSION=$(node -p "require('./package.json').version")

# comment-links
cd vscode/spiracss-comment-links
yarn run check-types && yarn run lint && node esbuild.js --production
npx vsce package --no-yarn --out ./build/spiracss-comment-links-${VERSION}.vsix

# html-to-scss
cd ../spiracss-html-to-scss
yarn run check-types && yarn run lint && node esbuild.js --production
npx vsce package --no-yarn --out ./build/spiracss-html-to-scss-${VERSION}.vsix
```

### 3. Git コミット & タグ

```bash
git add .
git commit -m "release: v${VERSION}

全パッケージを ${VERSION} に統一
- README.md を利用者向けに整理
- DEVELOPMENT.md を追加

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git tag v${VERSION}
git push origin master --tags
```

### 4. GitHub Release を作成（オプション）

1. GitHub の Releases ページで新しいリリースを作成
2. タグ `v${VERSION}` を選択
3. Release ノートを記載

## トラブルシューティング

### Yarn のバージョンが合わない

```bash
corepack enable
corepack prepare yarn@4.10.3 --activate
```

### ビルドが失敗する

```bash
# node_modules をクリーンアップ
rm -rf node_modules
rm -rf **/node_modules
yarn install
```

### .vsix のパッケージングでエラーが出る

Yarn Workspaces を使ったモノレポ構成では、`vsce` がワークスペースルートまで辿ってしまい、  
`extension/../../.claude/settings.local.json` のような **親ディレクトリを指すパス** を VSIX に含めようとしてエラーになることがあります。

典型的なケース：

- ルート: `spiracss/`（`package.json` に `"workspaces": [...]` を定義）
- 拡張: `vscode/spiracss-*/`（各パッケージに独自の `package.json`）
- `vsce package` 実行時に、`extension/../../.claude/...` のような相対パスが生成されて失敗

技術的な背景（簡略版）：

- `vsce`（`--no-yarn` 指定時）は内部で `npm-packlist` を使い、`package.json` からワークスペースルートまで辿ってファイル候補を集める
- Yarn Workspaces ではルートに `node_modules` や補助ディレクトリ（`.claude/` など）がぶら下がる
- その結果、「拡張のディレクトリから見て `../../something` を指すパス」が VSIX に入ろうとして、VS Code 側の制約（`extension/` 配下から親ディレクトリを指せない）に引っかかる

対策として、各拡張の `.vscodeignore` に **親へのパスを明示的に落とすルール** を追加します：

```gitignore
# Workspace ルート側にあるファイル・ディレクトリを VSIX から除外
../**
../../**

# ローカル開発用メタデータを除外
**/.claude/**
**/.serena/**
AGENTS.md
test/**
```

ポイント：

- `*` や `**/*` は「カレントディレクトリ以下」しかマッチせず、`../` には効かない（`minimatch` の仕様）
- そのため、`../**` / `../../**` のように「親へのパターン」を明示的に書く必要があります
- これにより、`vsce` がワークスペースルートまで辿っても、VSIX には拡張配下の必要なファイルだけが入ります

## ディレクトリ構成

```
.
├── README.md                      # 利用者向けドキュメント
├── DEVELOPMENT.md                 # 開発者向けドキュメント（このファイル）
├── package.json                   # ワークスペース設定
├── docs_spira/
│   ├── ai/                        # AI 用ドキュメント
│   │   └── spiracss-ai-agent-doc.md  # AI エージェント用コア仕様
│   ├── ja/                        # 日本語ドキュメント
│   │   ├── index.md               # 入口・リンク集
│   │   ├── philosophy.md          # 設計思想
│   │   ├── principles.md          # 設計原則（入口）
│   │   ├── quickstart.md          # クイックスタート
│   │   ├── layers.md              # 3 層アーキテクチャ
│   │   ├── component.md           # コンポーネント層の詳細
│   │   ├── guidelines.md          # 推奨ルール
│   │   └── tooling/               # ツール詳細
│   │       ├── index.md
│   │       ├── spiracss-config.md
│   │       ├── spiracss.config.example.js
│   │       ├── stylelint.md
│   │       ├── html-cli.md
│   │       ├── html-to-scss.md
│   │       └── comment-links.md
│   └── en/                        # 英語ドキュメント（未翻訳は日本語へリンク）
│       ├── index.md
│       ├── quickstart.md
│       ├── guidelines.md
│       ├── principles.md
│       ├── layers.md
│       ├── component.md
│       └── tooling/
│           ├── index.md
│           ├── spiracss-config.md
│           ├── spiracss.config.example.js
│           ├── stylelint.md
│           ├── html-cli.md
│           ├── html-to-scss.md
│           └── comment-links.md
├── packages/
│   ├── html-cli/                    # SpiraCSS HTML CLI（@spiracss/html-cli）
│   └── stylelint-plugin/            # SpiraCSS Stylelint プラグイン
├── vscode/spiracss-comment-links/   # VS Code 拡張（コメントリンク）
└── vscode/spiracss-html-to-scss/    # VS Code 拡張（HTML→SCSS）
```

## コーディング規約

- TypeScript を使用
- ESLint + Prettier でフォーマット
- コミットメッセージは Conventional Commits 形式を推奨

## packages/html-cli 開発メモ

- 依存インストール: `cd packages/html-cli && yarn install`
- ビルド: `yarn build`
- テスト: `yarn test`
- npm publish 時は `prepublishOnly` で `yarn build` が自動実行される

## vscode/spiracss-html-to-scss 開発メモ

- 依存インストール: `cd vscode/spiracss-html-to-scss && yarn install`
- ビルド: `yarn run compile`
- 生成ロジック: `@spiracss/html-cli` を利用（詳細な生成仕様のテストは `packages/html-cli/test` を参照）。
- テスト: `yarn test:extension`（ビルド込み）。`vscode/spiracss-html-to-scss/fixtures` をワークスペースとして統合テストを実行。
- VSIX パッケージング: `npx vsce package -o build/`。モノレポ経由で親ディレクトリが入らないよう、`.vscodeignore` に `../**` / `../../**` などを必ず入れる（背景は「.vsix のパッケージングでエラーが出る」節を参照）。
- 既知の課題: 統合テストは主要フロー中心（詳細な生成パターンは html-cli 側で担保）。

## vscode/spiracss-comment-links 開発メモ

- 依存インストール: `cd vscode/spiracss-comment-links && yarn install`
- ビルド: `yarn compile`
- テスト: `yarn test`（`@vscode/test-cli` + Mocha。`vscode/spiracss-comment-links/src/test/extension.test.ts` で 8 ケース、`fixtures/` に SCSS サンプルあり）
- VSIX パッケージング: `npx vsce package -o build/`。モノレポで親ディレクトリが含まれないよう `.vscodeignore` に `../**` / `../../**` などを入れる（詳細は「.vsix のパッケージングでエラーが出る」節）。
- 既知の課題: とくになし（拡張の統合テストは用意済み）。

## 参考リンク

- [SpiraCSS 設計原則](https://spiracss.jp/ja/architecture/principles/)
- [SpiraCSS Stylelint プラグイン README](packages/stylelint-plugin/README.md)
- [VS Code 拡張開発ガイド](https://code.visualstudio.com/api)
