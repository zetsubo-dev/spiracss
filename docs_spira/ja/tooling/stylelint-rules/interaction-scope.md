# spiracss/interaction-scope

interaction セクション（`// --interaction` と `@at-root & { ... }`）の位置と構造を検証します。

## 目的

- 状態変化のスタイルを 1 箇所に集約する
- interaction セクションの位置と形を揃え、レビューしやすくする

## 検証内容

- `@at-root & { ... }` ブロックに集約されているか
- `// --interaction` コメントが `@at-root` ブロック直前にあるか
- interaction ブロックがルート Block 直下にあるか（ラッパー内は可）
- 擬似 / 状態セレクタを含むセレクタが `&` から始まるか
- `data-variant` は interaction に置いてよい（初期値用途）。`data-state` / `aria-*` と同一セレクタで混在させない

## OK

```scss
.sample-block {
  // --interaction
  @at-root & {
    &:hover {
      opacity: 0.8;
    }

    &[data-state="active"] {
      opacity: 1;
    }
  }
}
```

## NG

```scss
.sample-block {
  > .child {
    // --interaction
    @at-root & { // NG: ルート Block 直下ではない
      &:hover {
        opacity: 0.8;
      }
    }
  }
}
```

```scss
.sample-block {
  // --interaction
  @at-root & {
    > &:hover { // NG: `&` から始まらない
      opacity: 0.8;
    }
  }
}
```

## 理由

- 状態関連の変更点が一箇所に集まり、見通しが良くなる
- interaction の開始点を固定することで誤検知や見落としを減らす

## エラー一覧

### needAtRoot（interaction は `@at-root &` に集約）


**例:**
```scss
// NG
.sample-block {
  &:hover {
    opacity: 0.8;
  }
}

// OK
.sample-block {
  // --interaction
  @at-root & {
    &:hover {
      opacity: 0.8;
    }
  }
}
```

**理由:** 状態セレクタを同一ブロックに集約する

### needComment（interaction コメントが無い）


**例:**
```scss
// NG
.sample-block {
  @at-root & {
    &:hover {
      opacity: 0.8;
    }
  }
}

// OK
.sample-block {
  // --interaction
  @at-root & {
    &:hover {
      opacity: 0.8;
    }
  }
}
```

**理由:** セクション判定を安定させる

### needTail（interaction が末尾にない）


**例:**
```scss
// NG
.sample-block {
  // --interaction
  @at-root & {
    &:hover {
      opacity: 0.8;
    }
  }

  > .title {
    font-size: 16px;
  }
}

// OK
.sample-block {
  > .title {
    font-size: 16px;
  }

  // --interaction
  @at-root & {
    &:hover {
      opacity: 0.8;
    }
  }
}
```

**理由:** 変更点を末尾にまとめる

### needRootBlock（ルート Block 直下ではない）


**例:**
```scss
// NG
.sample-block {
  > .child {
    // --interaction
    @at-root & {
      &:hover {
        opacity: 0.8;
      }
    }
  }
}

// OK
.sample-block {
  // --interaction
  @at-root & {
    &:hover {
      opacity: 0.8;
    }
  }
}
```

**理由:** interaction のスコープを固定する

### mixedStateVariant（State と Variant を混在）


**例:**
```scss
// NG
.sample-block {
  // --interaction
  @at-root & {
    &[data-state="active"][data-variant="primary"] {
      opacity: 1;
    }
  }
}

// OK
.sample-block {
  // --interaction
  @at-root & {
    &[data-state="active"] {
      opacity: 1;
    }
    &[data-variant="primary"] {
      opacity: 1;
    }
  }
}
```

**理由:** 役割を分離して読みやすくする

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

- [spiracss.config.js / stylelint.interactionScope](../spiracss-config.md#stylelintinteractionscope)

## 関連

- [コンポーネント: interaction セクション](../../component.md#3-interaction-セクション)
