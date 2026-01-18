# spiracss/property-placement

プロパティ配置（コンテナ / アイテム / 内部）を検証します。

## 目的

- レイアウト責務を親子で分離し、構造の意味を明確にする
- レイアウトの決定が子側に漏れることを防ぐ

## 検証内容

- page-root セレクタ（単独の `body` または単独の `#id`）ではレイアウト系プロパティを禁止
- コンテナプロパティはルート Block / Element で許可、子 Block では禁止
- アイテムプロパティは親の直下セレクタでのみ許可（基本は `> .child`。`+` / `~` は構造ルールを緩めた場合のみ対象）
- 内部プロパティはルート Block / Element で許可、子 Block では禁止（padding / overflow / `sizeInternal` が有効な場合は width/height/min/max など）
- 縦方向マージンの片側統一（`marginSide`）
- `position` の制限（`position: true`）
- `@extend` は常にエラー、`@at-root` は interaction セクション専用

## OK

```scss
.parent-block {
  display: flex; // コンテナ
  gap: 16px;

  > .child-block {
    margin-top: 16px; // アイテム
  }

  > .title {
    padding: 8px; // 内部
  }
}
```

## NG

```scss
.parent-block {
  > .child-block {
    padding: 16px; // NG: 子 Block の内部プロパティ
  }
}
```

```scss
body {
  display: flex; // NG: page-root でレイアウト系は不可
}
```

```scss
.parent-block {
  > .child-block {
    margin-bottom: 16px; // NG: marginSide が top の場合
  }
}
```

## 理由

- 親が並びを決め、親直下で子を調整し、子は内部だけを書くという責務分離を保つため
- 縦方向マージンを片側に統一すると余白計算が単純になり、重複を防げる
- `@extend` / 不適切な `@at-root` は配置追跡ができず、構造が崩れる

## 例外 / 注意

- `min-*` の値が `0` の場合は子 Block でも許可（`sizeInternal` が有効な場合）
- 禁止側の値が `0` / `auto` / `initial` は許可
- 値全体が `inherit` / `unset` / `revert` / `revert-layer` 単体ならスキップ
- 禁止側が `var(...)` / 関数値 / `$...` / `#{...}` の場合はエラー
- `@scope` は文脈境界、`responsiveMixins` に含まれる `@include` は透過扱い
- `:global-only` セレクタは out-of-scope のため配置チェックを行わない
- `u-` は固定で外部扱い（`external` に追加指定したクラスも対象外）

## エラー一覧

### containerInChildBlock（子 Block にコンテナプロパティ）


**例:**
```scss
// NG
.parent-block {
  > .child-block {
    display: flex;
    gap: 8px;
  }
}

// OK
.parent-block {
  display: flex;
  gap: 8px;
}
```

**理由:** コンテナ側のレイアウトは親または子自身が持つ

### itemInRoot（ルート Block にアイテムプロパティ）


**例:**
```scss
// NG
.child-block {
  margin-top: 16px;
}

// OK
.parent-block {
  > .child-block {
    margin-top: 16px;
  }
}
```

**理由:** ルート Block は自分の配置を決めず、親が決める

### selectorKindMismatch（セレクタ種別の混在）


**例:**
```scss
// NG
.parent-block {
  > .title,
  > .child-block {
    margin-top: 16px;
  }
}

// OK
.parent-block {
  > .title {
    margin-top: 16px;
  }

  > .child-block {
    margin-top: 16px;
  }
}
```

**理由:** ルート / Element / child Block を混ぜると配置判定ができない

### marginSideViolation（縦方向マージンの禁止側使用）


**例:**
```scss
// NG
.parent-block {
  > .title {
    margin-bottom: 16px;
  }
}

// OK
.parent-block {
  > .title {
    margin-top: 16px;
  }
}
```

**理由:** 片側統一で余白計算を単純化する

### internalInChildBlock（子 Block に内部プロパティ）


**例:**
```scss
// NG
.parent-block {
  > .child-block {
    padding: 16px;
  }
}

// OK
.child-block {
  padding: 16px;
}
```

**理由:** 内部プロパティは子自身が持つ

### positionInChildBlock（子 Block の position 制限）




**例:**
```scss
// NG
.parent-block {
  > .child-block {
    position: fixed;
    top: 0;
  }
}

// NG
.parent-block {
  > .child-block {
    position: relative;
  }
}

// NG
.parent-block {
  > .child-block {
    position: var(--pos);
    top: 0;
  }
}

// OK
.parent-block {
  > .child-block {
    position: relative;
    top: 0;
  }
}
```

**理由:** 親子のレイアウト文脈を保ち、offset 判定を可能にする

### pageRootContainer（page-root にコンテナプロパティ）


**例:**
```scss
// NG
body {
  display: flex;
  gap: 12px;
}

// OK
.page-root {
  display: flex;
  gap: 12px;
}
```

**理由:** page-root は装飾専用で、レイアウトは Block に委譲する

### pageRootItem（page-root にアイテムプロパティ）


**例:**
```scss
// NG
body {
  margin-top: 16px;
}

// OK
.page-root {
  > .child {
    margin-top: 16px;
  }
}
```

**理由:** page-root 自身の配置は持たない

### pageRootInternal（page-root に内部プロパティ）


**例:**
```scss
// NG
body {
  padding: 16px;
}

// OK
.page-root {
  padding: 16px;
}
```

**理由:** 内部プロパティは Block 側で持つ

### pageRootNoChildren（page-root の複合セレクタ）


**例:**
```scss
// NG
body > .main {
  color: #222;
}

// OK
body {
  color: #222;
}
```

**理由:** page-root は単独セレクタとして扱う

### forbiddenAtRoot（interaction 以外での `@at-root`）


**例:**
```scss
// NG
.parent-block {
  @at-root & {
    color: red;
  }
}

// OK
.parent-block {
  // --interaction
  @at-root & {
    color: red;
  }
}
```

**理由:** `@at-root` は構造を壊すため interaction 専用

### forbiddenExtend（`@extend` の禁止）


**例:**
```scss
// NG
.parent-block {
  @extend %placeholder;
}

// OK
.parent-block {
  @include placeholder();
}
```

**理由:** `@extend` は暗黙依存を生み配置追跡ができない

### selectorResolutionSkipped（セレクタ解決のスキップ）

**内容:**
```scss
.parent-block {
  &.-a, &.-b, &.-c, &.-d, &.-e, &.-f, &.-g, &.-h {
    > .child {
      padding: 1px;
    }
  }
}
```

**理由:** 解析が爆発するほど複雑なセレクタはスキップされる

### selectorParseFailed（セレクタ解析失敗）


**例:**
```scss
// NG
.parent-block {
  > : {
    padding: 4px;
  }
}

// OK
.parent-block {
  > .title {
    padding: 4px;
  }
}
```

**理由:** 解析できないセレクタは検証できない


## 設定

- [spiracss.config.js / stylelint.placement](../spiracss-config.md#stylelintplacement)

## 関連

- [コンポーネント: プロパティ配置の早見表](../../component.md#プロパティ配置の早見表)
- [コンポーネント: 基本構造セクション](../../component.md#1-基本構造セクション)
