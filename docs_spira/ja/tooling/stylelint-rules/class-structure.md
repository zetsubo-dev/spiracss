# spiracss/class-structure

SpiraCSS の命名規則とセレクタ構造を検証します。

## 目的

- Block / Element の構造を機械的に判定できる状態に保つ
- 親子構造の揺れを抑え、責務の分離を安定させる

## 検証内容

- 命名（Block / Element / Modifier）
- Block / Element の親子関係（`Element > Block` などを禁止）
- Block 直下の `>` を強制（shared は緩和、interaction は構造検査の対象外）
- Block の子セレクタは Block 内にネストして書く（トップレベルの `.block > .child` は不可）
- shared / interaction セクションの配置位置
- 1 ファイル 1 ルート Block（`rootSingle`）
- ルート Block とファイル名の一致（`rootFile`）
- `selectorPolicy` に応じた data/state の扱い

## OK

```scss
.sample-block {
  > .title {
    font-size: 16px;
  }

  // --shared
  .helper {
    color: #999;
  }

  // --interaction
  @at-root & {
    &:hover {
      opacity: 0.8;
    }
  }
}
```

## NG

```scss
.sample-block {
  .title { // NG: 基本構造では直下セレクタに `>` を付ける
    font-size: 16px;
  }
}
```

```scss
.sample-block {
  > .title {
    > .detail {
      > .label {
        > .meta {
          > .text { // NG: Element 連鎖が深すぎる（elementDepth 超過）
            color: #333;
          }
        }
      }
    }
  }
}
```

## 理由

- `>` を強制することで、親が子の並びを決める構造が明確になる
- Element 連鎖は深さを制限し、責務の境界がブレにくくなる

## 例外 / 注意

- shared セクションでは `>` の強制のみ緩和される
- interaction セクションでは構造検証を行わない（命名検証は継続）

## エラー一覧

### invalidName（命名規則違反）


**例:**
```scss
// NG
.HeroBanner {
  color: #222;
}

.titleText {
  font-weight: 600;
}

// OK
.hero-banner {
  color: #222;
}

.title {
  font-weight: 600;
}
```

**理由:** 命名で構造を判定するため

**補足:** `stylelint.base.naming` / `naming.customPatterns` の設定に従う

### elementChainTooDeep（Element 連鎖が深すぎる）


**例:**
```scss
// NG
.card-list {
  > .item {
    > .content {
      > .title {
        font-size: 16px;
      }
    }
  }
}

// OK
.card-list {
  > .item {
    > .title {
      font-size: 16px;
    }
  }
}
```

**理由:** Element 連鎖が深いと責務が曖昧になりやすい

**補足:** 深さ上限は `elementDepth`

### elementCannotOwnBlock（Element の下に Block がある）


**例:**
```scss
// NG
.card-list {
  > .item {
    > .price-tag {
      color: #333;
    }
  }
}

// OK
.card-list {
  > .price-tag {
    color: #333;
  }
}
```

**理由:** Element は Block の部品であり親にならない

### blockDescendantSelector（Block 直下の孫セレクタ）


**例:**
```scss
// NG
.card-list .title {
  margin-top: 8px;
}

// OK
.card-list > .title {
  margin-top: 8px;
}
```

**理由:** 親が子の並びを決める構造を明確にする

### blockTargetsGrandchildElement（孫 Element の直接指定）


**例:**
```scss
// NG
.card-list > .price-tag > .amount {
  font-weight: 700;
}

// OK
.price-tag {
  > .amount {
    font-weight: 700;
  }
}
```

**理由:** 親 Block が孫 Element を直接触らない

### tooDeepBlockNesting（Block の多段ネスト）


**例:**
```scss
// NG
.card-list {
  > .price-tag {
    > .icon-badge {
      color: #fff;
    }
  }
}

// OK
.card-list {
  > .price-tag {
    color: #fff;
  }
}
```

**理由:** Block > Block > Block の連鎖は責務が不明瞭になる

### multipleRootBlocks（ルート Block が複数）


**例:**
```scss
// NG
.hero-banner {
  color: #222;
}

.card-list {
  color: #333;
}

// OK
.hero-banner {
  color: #222;
}
```

**理由:** ファイルの入口を一つに揃える

### needChild（`>` 直下指定がない）


**例:**
```scss
// NG
.card-list .title {
  margin-top: 8px;
}

// OK
.card-list > .title {
  margin-top: 8px;
}
```

**理由:** 直下関係を明示して責務を固定する

### needChildNesting（トップレベルの子セレクタ禁止）

**例:**
```scss
// NG
.hero-banner > .title {
  font-size: 16px;
}

// OK
.hero-banner {
  > .title {
    font-size: 16px;
  }
}
```

**理由:** Block 内に構造を集約し、読み順を統一する

### sharedNeedRootBlock（shared コメントの位置）


**例:**
```scss
// NG
.card-list {
  > .title {
    // --shared
    .helper {
      color: #999;
    }
  }
}

// OK
.card-list {
  // --shared
  .helper {
    color: #999;
  }
}
```

**理由:** shared セクションの範囲を一意にする

### needAmpForMod（Modifier は `&.<modifier>`）


**例:**
```scss
// NG
.card-list.-primary {
  color: #111;
}

// OK
.card-list {
  &.-primary {
    color: #111;
  }
}
```

**理由:** Modifier は Block 内の状態として扱う

### needModifierPrefix（`&` への付与が Modifier ではない）


**例:**
```scss
// NG
.card-list {
  &.title {
    color: #111;
  }
}

// OK
.card-list {
  &.-primary {
    color: #111;
  }
}
```

**理由:** `&` に付与できるのは Modifier のみ

### disallowedModifier（data モード時の Modifier 禁止）


**例:**
```scss
// NG
.card-list {
  &.-primary {
    color: #111;
  }
}

// OK
.card-list {
  &[data-variant="primary"] {
    color: #111;
  }
}
```

**理由:** Variant/State は data 属性で表現する設計

### invalidVariantAttribute（variant が class モード）


**例:**
```scss
// NG
.card-list {
  &[data-variant="primary"] {
    color: #111;
  }
}

// OK
.card-list {
  &.-primary {
    color: #111;
  }
}
```

**理由:** class モードでは Modifier を使う

### invalidStateAttribute（state が class モード）


**例:**
```scss
// NG
.card-list {
  &[data-state="active"] {
    opacity: 1;
  }
}

// OK
.card-list {
  &.-active {
    opacity: 1;
  }
}
```

**理由:** class モードでは Modifier を使う

### invalidDataValue（data 値の命名違反）


**例:**
```scss
// NG
.card-list {
  &[data-variant="primary-dark-large"] {
    color: #111;
  }
}

// OK
.card-list {
  &[data-variant="primary-dark"] {
    color: #111;
  }
}
```

**理由:** data 値も命名ルールに従わせる

### rootSelectorMissingBlock（ルート Block を含まないセレクタ）


**例:**
```scss
// NG
.swiper {
  margin-top: 8px;
}

// OK
.tab-panels {
  > .swiper {
    margin-top: 8px;
  }
}
```

**理由:** ルート Block を起点に構造を読むため

### missingRootBlock（ルート Block が無い）


**例:**
```scss
// NG
.title {
  font-size: 16px;
}

// OK
.card-list {
  font-size: 16px;
}
```

**理由:** 1 ファイル 1 ルート Block が前提

### selectorParseFailed（セレクタ解析失敗）


**例:**
```scss
// NG
.card-list {
  > : {
    color: #111;
  }
}

// OK
.card-list {
  > .item {
    color: #111;
  }
}
```

**理由:** 解析できないセレクタは検証をスキップせざるを得ない

### fileNameMismatch（ファイル名と Block 名の不一致）


**例:**
```scss
// NG
// file: list.scss
.card-list {
  color: #111;
}

// OK
// file: card-list.scss
.card-list {
  color: #111;
}
```

**理由:** ファイルと Block の対応を固定する


## 設定

- [spiracss.config.js / stylelint.class](../spiracss-config.md#stylelintclass)
- セクションコメントは `stylelint.base.comments` でも変更可能

## 関連

- [コンポーネント: 命名規則](../../component.md#命名規則)
- [コンポーネント: 親子関係（構造ルール）](../../component.md#親子関係構造ルール)
- [コンポーネント: SCSS セクション構成](../../component.md#scss-セクション構成)
