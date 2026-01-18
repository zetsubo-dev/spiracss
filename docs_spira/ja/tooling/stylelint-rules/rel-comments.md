# spiracss/rel-comments

`@rel` コメントによる親子リンクを検証します。

## 目的

- ページエントリ SCSS と Block / 子 Block の関係を明示する
- コメントリンクの自動ナビゲーションを安定させる

## 検証内容

- 親 Block の `@rel` はルートスコープ先頭に配置（`@use` / `@forward` / `@import` は前置可、root Block 内は不可）
- 親 Block は同一スコープ内で最初の rule に置く（親リンク必須設定時）
- `> .child-block` 直下ルールの最初のノードが `@rel` コメント
- shared セクションは対象、interaction セクションはデフォルトで対象外
- コメント内パスの実在チェック（有効時）

## OK

```scss
// @rel ../components/card-list

.page-home {
  > .card-list {
    // @rel ./scss/card-list
    margin-top: 8px;
  }
}
```

## NG

```scss
.page-home {
  // @rel ../components/card-list // NG: ルートスコープ先頭ではない
  > .card-list {
    margin-top: 8px;
  }
}
```

```scss
.page-home {
  > .card-list {
    margin-top: 8px; // NG: @rel が先頭にない
  }
}
```

## 理由

- 親子関係の起点を固定することでリンク解決が安定する

## エラー一覧

### missingParentRel（親 `@rel` が無い）


**例:**
```scss
// NG
.page-home {
  color: #111;
}

// OK
// @rel ../components/page-home
.page-home {
  color: #111;
}
```

**理由:** 親リンクの入口を固定する

### misplacedParentRel（親 `@rel` の位置が不正）


**例:**
```scss
// NG
.page-home {
  // @rel ../components/page-home
  color: #111;
}

// OK
// @rel ../components/page-home
.page-home {
  color: #111;
}
```

**理由:** 解析の起点を一意にする

### rootBlockNotFirst（ルート Block が最初ではない）


**例:**
```scss
// NG
.util-reset {
  box-sizing: border-box;
}
.page-home {
  color: #111;
}

// OK
.page-home {
  color: #111;
}
.util-reset {
  box-sizing: border-box;
}
```

**理由:** 親リンクの先頭配置と整合を取る

### missingChildRel（子 `@rel` が無い）


**例:**
```scss
// NG
.page-home {
  > .card-list {
    margin-top: 8px;
  }
}

// OK
.page-home {
  > .card-list {
    // @rel ./scss/card-list
    margin-top: 8px;
  }
}
```

**理由:** 子 Block へのリンクを明示する

### notFound（リンク先が存在しない）


**例:**
```scss
// NG
// @rel ../components/missing-block
.page-home {
  color: #111;
}

// OK
// @rel ../components/card-list
.page-home {
  color: #111;
}
```

**理由:** ナビゲーションの整合性を保つ

### childMismatch（子 Block 名と `@rel` が不一致）


**例:**
```scss
// NG
.page-home {
  > .card-list {
    // @rel ./scss/hero-banner
    margin-top: 8px;
  }
}

// OK
.page-home {
  > .card-list {
    // @rel ./scss/card-list
    margin-top: 8px;
  }
}
```

**理由:** ファイル対応を固定する

### selectorParseFailed（セレクタ解析失敗）


**例:**
```scss
// NG
.page-home {
  > : {
    margin-top: 8px;
  }
}

// OK
.page-home {
  > .card-list {
    margin-top: 8px;
  }
}
```

**理由:** 解析できないセレクタは検証できない


## 設定

- [spiracss.config.js / stylelint.rel](../spiracss-config.md#stylelintrel)

## 関連

- [コンポーネント: @rel コメント](../../component.md#rel-コメント)
- [Comment Links](../comment-links.md)
