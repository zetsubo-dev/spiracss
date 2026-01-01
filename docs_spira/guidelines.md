# ガイドライン

このドキュメントは、SpiraCSS Stylelint プラグインでは強制しないが SpiraCSS として推奨するルールをまとめています。

## 設定

SpiraCSS のルールはデフォルト設定を推奨しますが、使用するフレームワークやプロジェクトの規約に合わせて `spiracss.config.js` で変更できます。

例:
- Block の命名形式をケバブケースからキャメルケースに変更（React / Vue など）
- Variant / State の表現を data 属性から class モードに切り替え
- 区切り文字やパターンのカスタマイズ
- 外部ライブラリのクラスを検証対象から除外（Swiper など）
- `@rel` コメントの必須/任意の切り替え

詳細は [spiracss.config.js](tooling/spiracss-config.md) を参照してください。

## レイアウト

| ルール | 補足 |
| --- | --- |
| **縦方向マージンは上側** (`margin-top`) に統一し、下側は使わない。 | 余白計算の単純化と重複防止。 |

> デザイン視点で要素は「自分の上に余白を含んでいる」と捉えると縦マージンは上側に置く方が自然という考え方です。

## クラス命名

| ルール | 補足 |
| --- | --- |
| **Block 内のレイアウト用クラス名** は `*-box` を推奨し、`wrapper` / `inner` / `outer` などの相対的な名前は原則禁止。 | 例: `.content-box`, `.media-box` |

> `wrapper` / `inner` は相対構造を含意し構造変更時にズレやすいが、`*-box` は意味を限定しないので差し替えや分割がしやすい。

### 命名アイディア

- ルート Block（コンポーネントと同名のルート SCSS のクラス）を `<名前>-container` 型に寄せるなど、チーム内でルールを決めておくと、コンポーネントのルートが分かりやすくなり、境界を追いやすくなると思います。

## SpiraCSS ドキュメント
- [スタイルガイド](styleguide.md)
- [クイックスタート](quickstart.md)
- [CSS レイヤー](layers.md)
- [コンポーネント](component.md)
- ガイドライン

## ツール
- [ツール連携](tooling/index.md)
- [spiracss.config.js](tooling/spiracss-config.md)
