# spiracss/pseudo-nesting

疑似クラス / 疑似要素を `&` にネストして書くルールです。

## 目的

- 構造と状態の境界を明確にする
- セレクタの意図を読みやすくする

## OK

```scss
.button {
  &:hover {
    opacity: 0.8;
  }
  &::before {
    content: "";
  }
}
```

## NG

```scss
.button:hover { // NG: ネストなし
  opacity: 0.8;
}
```

```scss
& > .button:hover { // NG: 疑似は対象セレクタにネストする
  opacity: 0.8;
}
```

## 理由

- 疑似は対象セレクタの責務として読める形にするため

## エラー一覧

### needNesting（疑似は `&` にネスト）



**例:**
```scss
// NG
.button:hover {
  opacity: 0.8;
}

// NG
& > .button:hover {
  opacity: 0.8;
}

// OK
.button {
  &:hover {
    opacity: 0.8;
  }
}
```

**理由:** 疑似は対象セレクタの責務として読める形にする

### selectorParseFailed（セレクタ解析失敗）


**例:**
```scss
// NG
.button {
  > : {
    color: #111;
  }
}

// OK
.button {
  > .item {
    color: #111;
  }
}
```

**理由:** 解析できないセレクタは検証できない


## 設定

- [spiracss.config.js / stylelint.pseudo](../spiracss-config.md#stylelintpseudo)

## 関連

- [コンポーネント: SCSS セクション構成](../../component.md#scss-セクション構成)
