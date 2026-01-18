# spiracss/interaction-properties

interaction セクション内の transition / animation を検証します。

## 目的

- インタラクション関連の宣言を 1 箇所に集約する
- 何が動くかを明示して保守性を上げる

## 検証内容

- `transition` / `transition-*` / `animation` / `animation-*` は interaction セクション内のみ
- `transition` は対象プロパティを明示する
- `transition: none` / `transition-property: none` は不可
- `transition` で指定したプロパティは interaction 以外で宣言しない

## OK

```scss
.sample-block {
  // --interaction
  @at-root & {
    opacity: 0;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 1;
    }
  }
}
```

## NG

```scss
.sample-block {
  transition: all 0.2s ease; // NG: interaction 外 + all
}
```

```scss
.sample-block {
  // --interaction
  @at-root & {
    transition: none; // NG
  }
}
```

## 理由

- 動くプロパティを明示すると副作用を抑えやすい
- interaction 外に分散すると初期値と状態の整合が崩れやすい

## エラー一覧

### needInteraction（interaction 以外での宣言）


**例:**
```scss
// NG
.sample-block {
  transition: opacity 0.2s ease;
}

// OK
.sample-block {
  // --interaction
  @at-root & {
    transition: opacity 0.2s ease;
  }
}
```

**理由:** 状態関連の宣言を 1 箇所に集約する

### missingTransitionProperty（対象プロパティが無い）


**例:**
```scss
// NG
.sample-block {
  // --interaction
  @at-root & {
    transition: 0.2s ease;
  }
}

// OK
.sample-block {
  // --interaction
  @at-root & {
    transition: opacity 0.2s ease;
  }
}
```

**理由:** 何が変化するかを明示する

### transitionAll（`all` の禁止）


**例:**
```scss
// NG
.sample-block {
  // --interaction
  @at-root & {
    transition: all 0.2s ease;
  }
}

// OK
.sample-block {
  // --interaction
  @at-root & {
    transition: opacity 0.2s ease;
  }
}
```

**理由:** 意図しない副作用を避ける

### transitionNone（`none` の禁止）


**例:**
```scss
// NG
.sample-block {
  // --interaction
  @at-root & {
    transition: none;
  }
}

// OK
.sample-block {
  // --interaction
  @at-root & {
    transition-duration: 0.001s;
  }
}
```

**理由:** interaction の統一的な扱いを保つ

### invalidTransitionProperty（無効な対象指定）


**例:**
```scss
// NG
.sample-block {
  // --interaction
  @at-root & {
    transition: var(--prop) 0.2s;
  }
}

// OK
.sample-block {
  // --interaction
  @at-root & {
    transition: opacity 0.2s;
  }
}
```

**理由:** 解析可能な対象のみを許可する

### initialOutsideInteraction（初期値が interaction 外）


**例:**
```scss
// NG
.sample-block {
  opacity: 0;
  // --interaction
  @at-root & {
    transition: opacity 0.2s;
  }
}

// OK
.sample-block {
  // --interaction
  @at-root & {
    opacity: 0;
    transition: opacity 0.2s;
  }
}
```

**理由:** 状態変化の起点を一元管理する

### selectorParseFailed（セレクタ解析失敗）


**例:**
```scss
// NG
.sample-block {
  > : {
    color: #111;
  }
}

// OK
.sample-block {
  > .title {
    color: #111;
  }
}
```

**理由:** 解析できないセレクタは検証できない


## 設定

- [spiracss.config.js / stylelint.interactionProps](../spiracss-config.md#stylelintinteractionprops)

## 関連

- [コンポーネント: interaction セクション](../../component.md#3-interaction-セクション)
