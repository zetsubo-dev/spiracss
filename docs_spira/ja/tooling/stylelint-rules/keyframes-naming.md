# spiracss/keyframes-naming

`@keyframes` の配置と命名を検証します。

## 目的

- アニメーションの責務と配置を明確にする
- 命名衝突を避け、探索性を上げる

## 検証内容

- `@keyframes` はルート直下のみ（`@media` / `@layer` 内は不可）
- `@keyframes` はファイル末尾に集約
- 命名は `{block}-{action}` または `{block}-{element}-{action}`
- block / element のケースは `stylelint.base.naming` に従う
- element はファイル内に実在する element 名のみ許可
- action は `blockCase` のケースで 1〜3語（`actionMaxWords` で変更可）

## OK

```scss
.sample-block {
  opacity: 0;
}

@keyframes sample-block-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

## NG

```scss
@media (min-width: 768px) {
  @keyframes sample-block-fade-in { // NG: ルート直下以外
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
}
```

```scss
@keyframes sample-block-unknown-fade { // NG: element が存在しない
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

## 理由

- ルート直下・末尾に集約すると、探索と管理がしやすい
- 命名を Block / Element に紐づけることで衝突を避ける

## 例外 / 注意

 - 共有アニメーションは `kf-` などの prefix を使い、`keyframes.scss` に集約する
 - ルート Block が取得できない場合は警告して命名のみスキップされる（`blockSource` / `blockWarnMissing` で変更可）

## エラー一覧

### needRoot（`@keyframes` はルート直下）


**例:**
```scss
// NG
@media (min-width: 768px) {
  @keyframes sample-block-fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
}

// OK
@keyframes sample-block-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

**理由:** アニメーション定義を集約して探索しやすくする

### needTail（ファイル末尾に配置）


**例:**
```scss
// NG
@keyframes sample-block-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.sample-block {
  opacity: 0;
}

// OK
.sample-block {
  opacity: 0;
}

@keyframes sample-block-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

**理由:** アニメーション定義を見つけやすくする

### invalidName（命名規則違反）


**例:**
```scss
// NG
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

// OK
@keyframes sample-block-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

**理由:** Block / Element に紐づけて衝突を避ける

### invalidSharedName（共有アニメーションの命名違反）


**例:**
```scss
// NG
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

// OK
@keyframes kf-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

**理由:** 共有アニメーションを明示する

### sharedFileOnly（共有アニメーションの配置違反）


**例:**
```scss
// NG
// in card-list.scss
@keyframes kf-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

// OK
// in keyframes.scss
@keyframes kf-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

**理由:** 共有定義の場所を固定する

### missingBlock（ルート Block が判定できない）


**例:**
```scss
// NG
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

// OK
.sample-block {
  opacity: 0;
}
@keyframes sample-block-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

**理由:** Block 名に紐づく命名ができない

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

- [spiracss.config.js / stylelint.keyframes](../spiracss-config.md#stylelintkeyframes)

## 関連

- [コンポーネント: @keyframes](../../component.md#keyframes)
