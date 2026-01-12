import assert from 'assert'

import type { NamingOptions } from '../src/generator-core'
import { insertPlaceholders, insertPlaceholdersWithInfo } from '../src/html-format'

const defaultNaming: NamingOptions = { blockCase: 'kebab' }

describe('html-format: insertPlaceholders', () => {
  describe('Basic behavior', () => {
    it('does not modify empty HTML', () => {
      const result = insertPlaceholders('', defaultNaming)
      assert.strictEqual(result, '')
    })

    it('assigns block-box to a single element with no class', () => {
      const html = '<div></div>'
      const result = insertPlaceholders(html, defaultNaming)
      assert.ok(result.includes('class="block-box"'))
    })

    it('keeps elements that already have a Block name', () => {
      const html = '<div class="hero-section"></div>'
      const result = insertPlaceholders(html, defaultNaming)
      assert.ok(result.includes('class="hero-section"'))
      assert.ok(!result.includes('block-box'))
    })

    it('preserves and updates className attributes', () => {
      const html = '<div className="hero-section"><p></p></div>'
      const result = insertPlaceholdersWithInfo(html, defaultNaming, 'className')
      assert.strictEqual(result.hasTemplateSyntax, false)
      assert.ok(result.html.includes('className="hero-section"'))
      assert.ok(result.html.includes('className="element"'))
    })
  })

  describe('Recursive descendant processing', () => {
    it('assigns element to elements without children', () => {
      const html = '<div class="hero-section"><p></p></div>'
      const result = insertPlaceholders(html, defaultNaming)
      assert.ok(result.includes('class="element"'), `Expected 'element' class, got: ${result}`)
    })

    it('assigns block-box to elements with children', () => {
      const html = '<div class="hero-section"><div><span></span></div></div>'
      const result = insertPlaceholders(html, defaultNaming)
      // Middle div has a child (span), so block-box
      // span has no children, so element
      assert.ok(result.includes('class="block-box"'), `Expected block-box, got: ${result}`)
      assert.ok(result.includes('class="element"'), `Expected element, got: ${result}`)
    })

    it('handles 3+ levels correctly', () => {
      const html = `
        <section class="page-wrapper">
          <div>
            <article>
              <div>
                <p></p>
              </div>
            </article>
          </div>
        </section>
      `
      const result = insertPlaceholders(html, defaultNaming)
      // page-wrapper is already a Block
      // Intermediate div/article/div have children, so block-box
      // Deepest p has no children, so element
      const blockBoxCount = (result.match(/block-box/g) || []).length
      assert.ok(blockBoxCount >= 3, `Expected at least 3 block-box, got ${blockBoxCount}: ${result}`)
      assert.ok(result.includes('class="element"'), `Expected element, got: ${result}`)
    })
  })

  describe('Convert Element to Block (-box suffix)', () => {
    it('converts Element names with children to title-box (e.g., title)', () => {
      const html = `
        <div class="hero-section">
          <div class="title">
            <span></span>
          </div>
        </div>
      `
      const result = insertPlaceholders(html, defaultNaming)
      // title is an Element with a child (span), so convert to title-box
      assert.ok(result.includes('class="title-box"'), `Expected title-box, got: ${result}`)
    })

    it('keeps Element names with no children', () => {
      const html = `
        <div class="hero-section">
          <h1 class="title"></h1>
        </div>
      `
      const result = insertPlaceholders(html, defaultNaming)
      // title is an Element with no children, keep as is
      assert.ok(result.includes('class="title"'), `Expected title to remain, got: ${result}`)
      assert.ok(!result.includes('title-box'), `Should not have title-box, got: ${result}`)
    })

    it('converts multiple Elements with children to -box', () => {
      const html = `
        <div class="card-wrapper">
          <div class="header">
            <span></span>
          </div>
          <div class="body">
            <p></p>
          </div>
          <div class="footer">
            <a></a>
          </div>
        </div>
      `
      const result = insertPlaceholders(html, defaultNaming)
      assert.ok(result.includes('class="header-box"'), `Expected header-box, got: ${result}`)
      assert.ok(result.includes('class="body-box"'), `Expected body-box, got: ${result}`)
      assert.ok(result.includes('class="footer-box"'), `Expected footer-box, got: ${result}`)
    })
  })

  describe('Recursive processing for existing Blocks', () => {
    it('recursively processes nested Blocks', () => {
      const html = `
        <div class="outer-block">
          <div class="inner-block">
            <p></p>
          </div>
        </div>
      `
      const result = insertPlaceholders(html, defaultNaming)
      // outer-block and inner-block are already Blocks, keep as is
      // p has no children, so element
      assert.ok(result.includes('class="outer-block"'))
      assert.ok(result.includes('class="inner-block"'))
      assert.ok(result.includes('class="element"'), `Expected element for p, got: ${result}`)
    })
  })

  describe('Preserves modifiers and other classes', () => {
    it('preserves modifier classes', () => {
      const html = `
        <div class="hero-section -dark">
          <h1 class="title -large"></h1>
        </div>
      `
      const result = insertPlaceholders(html, defaultNaming)
      assert.ok(result.includes('-dark'), `Modifier -dark should be preserved, got: ${result}`)
      assert.ok(result.includes('-large'), `Modifier -large should be preserved, got: ${result}`)
    })

    it('prepends block-box to classes that are neither Block nor Element', () => {
      const html = `
        <div class="hero-section">
          <div class="u-hidden">
            <span></span>
          </div>
        </div>
      `
      const result = insertPlaceholders(html, defaultNaming)
      // u-hidden is neither Block nor Element (u- prefix is invalid); it has children, so prepend block-box
      assert.ok(
        result.includes('class="block-box u-hidden"'),
        `Expected 'block-box u-hidden', got: ${result}`
      )
    })
  })

  describe('Multiple root elements', () => {
    it('processes multiple root elements', () => {
      const html = `
        <div class="section-a">
          <p></p>
        </div>
        <div class="section-b">
          <span></span>
        </div>
      `
      const result = insertPlaceholders(html, defaultNaming)
      assert.ok(result.includes('class="section-a"'))
      assert.ok(result.includes('class="section-b"'))
      // element is applied to both child elements
      const elementCount = (result.match(/class="element"/g) || []).length
      assert.strictEqual(elementCount, 2, `Expected 2 element classes, got ${elementCount}`)
    })
  })

  describe('Respects blockCase settings', () => {
    it('recognizes camelCase Blocks', () => {
      const html = '<div class="heroSection"><p></p></div>'
      const result = insertPlaceholders(html, { blockCase: 'camel' })
      // heroSection is a camelCase Block, keep as is
      assert.ok(result.includes('class="heroSection"'))
      assert.ok(!result.includes('block-box heroSection'))
    })

    it('recognizes PascalCase Blocks', () => {
      const html = '<div class="HeroSection"><p></p></div>'
      const result = insertPlaceholders(html, { blockCase: 'pascal' })
      // HeroSection is a PascalCase Block, keep as is
      assert.ok(result.includes('class="HeroSection"'))
      assert.ok(!result.includes('block-box HeroSection'))
    })

    it('camelCase: Element -> Block converts to titleBox', () => {
      const html = `
        <div class="heroSection">
          <div class="title">
            <span></span>
          </div>
        </div>
      `
      const result = insertPlaceholders(html, { blockCase: 'camel' })
      // title is an Element with children, so convert to titleBox
      assert.ok(result.includes('class="titleBox"'), `Expected titleBox, got: ${result}`)
      assert.ok(!result.includes('title-box'), `Should not have title-box, got: ${result}`)
    })

    it('pascalCase: Element -> Block converts to TitleBox', () => {
      const html = `
        <div class="HeroSection">
          <div class="title">
            <span></span>
          </div>
        </div>
      `
      const result = insertPlaceholders(html, { blockCase: 'pascal' })
      // title is an Element with children, so convert to TitleBox
      assert.ok(result.includes('class="TitleBox"'), `Expected TitleBox, got: ${result}`)
      assert.ok(!result.includes('title-box'), `Should not have title-box, got: ${result}`)
    })

    it('snake_case: Element -> Block converts to title_box', () => {
      const html = `
        <div class="hero_section">
          <div class="title">
            <span></span>
          </div>
        </div>
      `
      const result = insertPlaceholders(html, { blockCase: 'snake' })
      // title is an Element with children, so convert to title_box
      assert.ok(result.includes('class="title_box"'), `Expected title_box, got: ${result}`)
      assert.ok(!result.includes('title-box'), `Should not have title-box, got: ${result}`)
    })

    it('kebab-case: Element -> Block converts to title-box (default)', () => {
      const html = `
        <div class="hero-section">
          <div class="title">
            <span></span>
          </div>
        </div>
      `
      const result = insertPlaceholders(html, { blockCase: 'kebab' })
      // title is an Element with children, so convert to title-box
      assert.ok(result.includes('class="title-box"'), `Expected title-box, got: ${result}`)
    })
  })

  describe('Edge cases', () => {
    it('treats elements with only text nodes as having no children', () => {
      const html = '<div class="hero-section"><p>Text content</p></div>'
      const result = insertPlaceholders(html, defaultNaming)
      // p has only a text node (no child tags), so element
      assert.ok(result.includes('class="element"'), `Expected element for p, got: ${result}`)
    })

    it('treats whitespace-only elements as having no children', () => {
      const html = '<div class="hero-section"><p>   </p></div>'
      const result = insertPlaceholders(html, defaultNaming)
      assert.ok(result.includes('class="element"'), `Expected element for p, got: ${result}`)
    })

    it('ignores comment nodes', () => {
      const html = '<div class="hero-section"><!-- comment --><p></p></div>'
      const result = insertPlaceholders(html, defaultNaming)
      // Comments are not counted as child elements
      assert.ok(result.includes('class="element"'), `Expected element for p, got: ${result}`)
    })
  })

  describe('Complex structures (mixed depths at same level)', () => {
    it('mixes leaf nodes and deep structures under the same parent', () => {
      // At the same level:
      // - Leaf node (icon)
      // - One level deep (title > span)
      // - Two levels deep (content > div > p)
      const html = `
        <div class="card-block">
          <span class="icon"></span>
          <div class="title">
            <span></span>
          </div>
          <div class="content">
            <div>
              <p></p>
            </div>
          </div>
        </div>
      `
      const result = insertPlaceholders(html, defaultNaming)

      // icon is a leaf node, keep as Element
      assert.ok(result.includes('class="icon"'), `icon should remain as element, got: ${result}`)
      assert.ok(!result.includes('icon-box'), `icon should not become icon-box, got: ${result}`)

      // title has children, so convert to title-box
      assert.ok(result.includes('class="title-box"'), `title should become title-box, got: ${result}`)

      // span inside title-box is a leaf node, so element
      // content has children, so convert to content-box
      assert.ok(result.includes('class="content-box"'), `content should become content-box, got: ${result}`)

      // div inside content-box has children, so block-box
      assert.ok(result.includes('class="block-box"'), `inner div should get block-box, got: ${result}`)

      // Deepest p is a leaf node, so element
      const elementCount = (result.match(/class="element"/g) || []).length
      assert.ok(elementCount >= 2, `Expected at least 2 element classes (for span and p), got ${elementCount}`)
    })

    it('mixes Block and Element among siblings', () => {
      // Block and Element are mixed at the same level
      const html = `
        <section class="page-section">
          <h1 class="heading"></h1>
          <div class="feature-card">
            <p class="text"></p>
          </div>
          <span class="note"></span>
          <div class="another-card">
            <div class="inner">
              <a></a>
            </div>
          </div>
        </section>
      `
      const result = insertPlaceholders(html, defaultNaming)

      // heading is a leaf node, keep as Element
      assert.ok(result.includes('class="heading"'), `heading should remain, got: ${result}`)

      // feature-card is already a Block, keep as is
      assert.ok(result.includes('class="feature-card"'), `feature-card should remain, got: ${result}`)

      // text inside feature-card is a leaf node, keep as Element
      assert.ok(result.includes('class="text"'), `text should remain, got: ${result}`)

      // note is a leaf node, keep as Element
      assert.ok(result.includes('class="note"'), `note should remain, got: ${result}`)

      // another-card is already a Block, keep as is
      assert.ok(result.includes('class="another-card"'), `another-card should remain, got: ${result}`)

      // inner is an Element with children, so convert to inner-box
      assert.ok(result.includes('class="inner-box"'), `inner should become inner-box, got: ${result}`)

      // Deepest a is a leaf node, so element
      assert.ok(result.includes('class="element"'), `a should get element class, got: ${result}`)
    })

    it('Realistic card component structure', () => {
      // Complex structure close to a real component
      const html = `
        <article class="product-card">
          <figure class="media">
            <img class="image">
            <figcaption class="caption">
              <span></span>
            </figcaption>
          </figure>
          <div class="info">
            <header class="header">
              <h2 class="name"></h2>
              <span class="price"></span>
            </header>
            <p class="description"></p>
            <footer class="actions">
              <button class="btn"></button>
              <button class="btn"></button>
            </footer>
          </div>
        </article>
      `
      const result = insertPlaceholders(html, defaultNaming)

      // product-card is a Block, keep as is
      assert.ok(result.includes('class="product-card"'))

      // media is an Element with children, so media-box
      assert.ok(result.includes('class="media-box"'), `media should become media-box, got: ${result}`)

      // image is a leaf node, keep as Element
      assert.ok(result.includes('class="image"'), `image should remain, got: ${result}`)

      // caption is an Element with children, so caption-box
      assert.ok(result.includes('class="caption-box"'), `caption should become caption-box, got: ${result}`)

      // info is an Element with children, so info-box
      assert.ok(result.includes('class="info-box"'), `info should become info-box, got: ${result}`)

      // header is an Element with children, so header-box
      assert.ok(result.includes('class="header-box"'), `header should become header-box, got: ${result}`)

      // name, price are leaf nodes, keep as Element
      assert.ok(result.includes('class="name"'), `name should remain, got: ${result}`)
      assert.ok(result.includes('class="price"'), `price should remain, got: ${result}`)

      // description is a leaf node, keep as Element
      assert.ok(result.includes('class="description"'), `description should remain, got: ${result}`)

      // actions is an Element with children, so actions-box
      assert.ok(result.includes('class="actions-box"'), `actions should become actions-box, got: ${result}`)

      // btn is a leaf node, keep as Element
      const btnCount = (result.match(/class="btn"/g) || []).length
      assert.strictEqual(btnCount, 2, `Expected 2 btn classes, got ${btnCount}`)
    })

    it('Uneven depth tree structure', () => {
      // Asymmetric structure: shallow on the left, deep on the right
      const html = `
        <div class="layout-block">
          <aside class="sidebar">
            <nav class="nav"></nav>
          </aside>
          <main class="main">
            <section class="content">
              <article class="article">
                <div class="body">
                  <div class="text">
                    <p></p>
                  </div>
                </div>
              </article>
            </section>
          </main>
        </div>
      `
      const result = insertPlaceholders(html, defaultNaming)

      // sidebar is an Element with children, so sidebar-box
      assert.ok(result.includes('class="sidebar-box"'), `sidebar should become sidebar-box, got: ${result}`)

      // nav is a leaf node, keep as Element
      assert.ok(result.includes('class="nav"'), `nav should remain, got: ${result}`)

      // main is an Element with children, so main-box
      assert.ok(result.includes('class="main-box"'), `main should become main-box, got: ${result}`)

      // content is an Element with children, so content-box
      assert.ok(result.includes('class="content-box"'), `content should become content-box, got: ${result}`)

      // article is an Element with children, so article-box
      assert.ok(result.includes('class="article-box"'), `article should become article-box, got: ${result}`)

      // body is an Element with children, so body-box
      assert.ok(result.includes('class="body-box"'), `body should become body-box, got: ${result}`)

      // text is an Element with children, so text-box
      assert.ok(result.includes('class="text-box"'), `text should become text-box, got: ${result}`)

      // Deepest p is a leaf node, so element
      assert.ok(result.includes('class="element"'), `p should get element class, got: ${result}`)
    })

    it('Block inside Block with an Element sibling', () => {
      const html = `
        <div class="outer-wrapper">
          <div class="inner-wrapper">
            <span class="label"></span>
          </div>
          <p class="text"></p>
          <div class="nested-block">
            <div class="deep">
              <span></span>
            </div>
            <a class="link"></a>
          </div>
        </div>
      `
      const result = insertPlaceholders(html, defaultNaming)

      // outer-wrapper, inner-wrapper, nested-block are Blocks, keep as is
      assert.ok(result.includes('class="outer-wrapper"'))
      assert.ok(result.includes('class="inner-wrapper"'))
      assert.ok(result.includes('class="nested-block"'))

      // label is a leaf node, keep as Element
      assert.ok(result.includes('class="label"'), `label should remain, got: ${result}`)

      // text is a leaf node, keep as Element
      assert.ok(result.includes('class="text"'), `text should remain, got: ${result}`)

      // deep is an Element with children, so deep-box
      assert.ok(result.includes('class="deep-box"'), `deep should become deep-box, got: ${result}`)

      // link is a leaf node, keep as Element
      assert.ok(result.includes('class="link"'), `link should remain, got: ${result}`)
    })

    it('Complex structure with classless and classed elements mixed', () => {
      const html = `
        <div class="card-list">
          <div>
            <span class="icon"></span>
            <div>
              <p></p>
            </div>
          </div>
          <div class="item">
            <span></span>
          </div>
          <div>
            <a class="link"></a>
          </div>
        </div>
      `
      const result = insertPlaceholders(html, defaultNaming)

      // card-list is a Block, keep as is
      assert.ok(result.includes('class="card-list"'))

      // First div (no class) has children, so block-box
      // icon is a leaf node, keep as Element
      assert.ok(result.includes('class="icon"'), `icon should remain, got: ${result}`)

      // item is an Element with children, so item-box
      assert.ok(result.includes('class="item-box"'), `item should become item-box, got: ${result}`)

      // Third div (no class) has children, so block-box
      // link is a leaf node, keep as Element
      assert.ok(result.includes('class="link"'), `link should remain, got: ${result}`)

      // Ensure there are multiple block-boxes
      const blockBoxCount = (result.match(/class="block-box/g) || []).length
      assert.ok(blockBoxCount >= 3, `Expected at least 3 block-box, got ${blockBoxCount}: ${result}`)
    })
  })

  describe('Respects elementCase settings', () => {
    it('elementCase: pascal recognizes uppercase-start Elements', () => {
      const html = `
        <div class="HeroSection">
          <h1 class="Title"></h1>
          <p class="Body"></p>
        </div>
      `
      const result = insertPlaceholders(html, { blockCase: 'pascal', elementCase: 'pascal' })
      // Title, Body are Pascal Elements, keep as is
      assert.ok(result.includes('class="Title"'), `Title should remain, got: ${result}`)
      assert.ok(result.includes('class="Body"'), `Body should remain, got: ${result}`)
      // Do not convert to a Block
      assert.ok(!result.includes('TitleBox'), `Title should not become TitleBox, got: ${result}`)
    })

    it('elementCase: pascal does not recognize lowercase Elements', () => {
      const html = `
        <div class="HeroSection">
          <h1 class="title"></h1>
        </div>
      `
      const result = insertPlaceholders(html, { blockCase: 'pascal', elementCase: 'pascal' })
      // title is not a Pascal Element, so it is not recognized as an Element
      // Leaf node gets an Element placeholder
      assert.ok(result.includes('class="Element title"'), `Expected 'Element title', got: ${result}`)
    })

    it('elementCase: pascal uses Element placeholder', () => {
      const html = `
        <div class="HeroSection">
          <p></p>
        </div>
      `
      const result = insertPlaceholders(html, { blockCase: 'pascal', elementCase: 'pascal' })
      // Leaf node without a class gets Element
      assert.ok(result.includes('class="Element"'), `Expected 'Element' placeholder, got: ${result}`)
      assert.ok(!result.includes('class="element"'), `Should not have lowercase element, got: ${result}`)
    })

    it('elementCase: pascal uses BlockBox placeholder', () => {
      const html = `
        <div class="HeroSection">
          <div>
            <span></span>
          </div>
        </div>
      `
      const result = insertPlaceholders(html, { blockCase: 'pascal', elementCase: 'pascal' })
      // Element without a class and with children gets BlockBox
      assert.ok(result.includes('class="BlockBox"'), `Expected 'BlockBox' placeholder, got: ${result}`)
      assert.ok(!result.includes('class="block-box"'), `Should not have kebab block-box, got: ${result}`)
    })

    it('elementCase: pascal Element -> Block conversion', () => {
      const html = `
        <div class="HeroSection">
          <div class="Title">
            <span></span>
          </div>
        </div>
      `
      const result = insertPlaceholders(html, { blockCase: 'pascal', elementCase: 'pascal' })
      // Title is a Pascal Element with children, so convert to TitleBox
      assert.ok(result.includes('class="TitleBox"'), `Expected TitleBox, got: ${result}`)
    })

    it('configures blockCase and elementCase independently', () => {
      const html = `
        <div class="hero-section">
          <h1 class="Title"></h1>
          <p class="Body"></p>
        </div>
      `
      // blockCase is kebab, elementCase is pascal
      const result = insertPlaceholders(html, { blockCase: 'kebab', elementCase: 'pascal' })
      // hero-section is a kebab Block, keep as is
      assert.ok(result.includes('class="hero-section"'), `hero-section should remain, got: ${result}`)
      // Title, Body are Pascal Elements, keep as is
      assert.ok(result.includes('class="Title"'), `Title should remain, got: ${result}`)
      assert.ok(result.includes('class="Body"'), `Body should remain, got: ${result}`)
    })

    it('combination of camelCase Block + pascalCase Element', () => {
      const html = `
        <div class="heroSection">
          <h1 class="Title"></h1>
          <div class="Content">
            <span></span>
          </div>
        </div>
      `
      const result = insertPlaceholders(html, { blockCase: 'camel', elementCase: 'pascal' })
      // heroSection is a camel Block, keep as is
      assert.ok(result.includes('class="heroSection"'), `heroSection should remain, got: ${result}`)
      // Title is a leaf node, keep as Pascal Element
      assert.ok(result.includes('class="Title"'), `Title should remain, got: ${result}`)
      // Content has children, so convert to contentBox (blockCase: camel -> normalize to lower camel)
      assert.ok(result.includes('class="contentBox"'), `Content should become contentBox, got: ${result}`)
    })

    it('combination of snake_case Block + pascalCase Element', () => {
      const html = `
        <div class="hero_section">
          <h1 class="Title"></h1>
          <div class="Content">
            <span></span>
          </div>
        </div>
      `
      const result = insertPlaceholders(html, { blockCase: 'snake', elementCase: 'pascal' })
      // hero_section is a snake Block, keep as is
      assert.ok(result.includes('class="hero_section"'), `hero_section should remain, got: ${result}`)
      // Title is a leaf node, keep as Pascal Element
      assert.ok(result.includes('class="Title"'), `Title should remain, got: ${result}`)
      // Content has children, so convert to content_box (blockCase: snake -> normalize to lowercase)
      assert.ok(result.includes('class="content_box"'), `Content should become content_box, got: ${result}`)
    })

    it('combination of kebab-case Block + pascalCase Element', () => {
      const html = `
        <div class="hero-section">
          <h1 class="Title"></h1>
          <div class="Content">
            <span></span>
          </div>
        </div>
      `
      const result = insertPlaceholders(html, { blockCase: 'kebab', elementCase: 'pascal' })
      // hero-section is a kebab Block, keep as is
      assert.ok(result.includes('class="hero-section"'), `hero-section should remain, got: ${result}`)
      // Title is a leaf node, keep as Pascal Element
      assert.ok(result.includes('class="Title"'), `Title should remain, got: ${result}`)
      // Content has children, so convert to content-box (blockCase: kebab -> normalize to lowercase)
      assert.ok(result.includes('class="content-box"'), `Content should become content-box, got: ${result}`)
    })

    it('uses customPatterns.element', () => {
      const html = `
        <div class="hero-section">
          <h1 class="TITLE"></h1>
          <p class="BODY"></p>
        </div>
      `
      // customPatterns.element recognizes all-caps as Element
      const result = insertPlaceholders(html, {
        blockCase: 'kebab',
        customPatterns: {
          element: /^[A-Z]+$/
        }
      })
      // TITLE, BODY match the custom pattern, so they are recognized as Elements
      assert.ok(result.includes('class="TITLE"'), `TITLE should remain, got: ${result}`)
      assert.ok(result.includes('class="BODY"'), `BODY should remain, got: ${result}`)
      assert.ok(!result.includes('element TITLE'), `TITLE should not have element prefix, got: ${result}`)
    })
  })

  describe('Move placeholder to front', () => {
    it('moves placeholder to front when not first', () => {
      const html = `
        <div class="hero-section">
          <div class="u-hidden block-box">
            <span></span>
          </div>
        </div>
      `
      const result = insertPlaceholders(html, defaultNaming)
      // Reorder: u-hidden block-box -> block-box u-hidden
      assert.ok(
        result.includes('class="block-box u-hidden"'),
        `Expected block-box to be first, got: ${result}`
      )
    })

    it('moves placeholder to front at root when not first', () => {
      const html = '<div class="u-container block-box"></div>'
      const result = insertPlaceholders(html, defaultNaming)
      // Reorder: u-container block-box -> block-box u-container
      assert.ok(
        result.includes('class="block-box u-container"'),
        `Expected block-box to be first at root, got: ${result}`
      )
    })

    it('moves Element placeholder to front', () => {
      const html = `
        <div class="hero-section">
          <span class="-large element"></span>
        </div>
      `
      const result = insertPlaceholders(html, defaultNaming)
      // Reorder: -large element -> element -large
      assert.ok(
        result.includes('class="element -large"'),
        `Expected element to be first, got: ${result}`
      )
    })
  })

  describe('Template syntax detection and skipping', () => {
    it('HTML with EJS syntax is skipped', () => {
      const html = `
        <div class="hero-section">
          <% if (show) { %>
          <h1></h1>
          <% } %>
        </div>
      `
      const result = insertPlaceholdersWithInfo(html, defaultNaming)
      assert.strictEqual(result.hasTemplateSyntax, true, 'Should detect EJS syntax')
      assert.strictEqual(result.changeCount, 0, 'Should not make any changes')
      assert.strictEqual(result.html, html, 'Should return original HTML unchanged')
    })

    it('HTML with Nunjucks variable syntax is skipped', () => {
      const html = `
        <div>
          {{ variable }}
          <p></p>
        </div>
      `
      const result = insertPlaceholdersWithInfo(html, defaultNaming)
      assert.strictEqual(result.hasTemplateSyntax, true, 'Should detect Nunjucks {{ }} syntax')
      assert.strictEqual(result.html, html, 'Should return original HTML unchanged')
    })

    it('HTML with Nunjucks tag syntax is skipped', () => {
      const html = `
        <div>
          {% for item in items %}
          <p></p>
          {% endfor %}
        </div>
      `
      const result = insertPlaceholdersWithInfo(html, defaultNaming)
      assert.strictEqual(result.hasTemplateSyntax, true, 'Should detect Nunjucks {% %} syntax')
      assert.strictEqual(result.html, html, 'Should return original HTML unchanged')
    })

    it('HTML with Nunjucks comment syntax is skipped', () => {
      const html = `
        <div>
          {# comment #}
          <p></p>
        </div>
      `
      const result = insertPlaceholdersWithInfo(html, defaultNaming)
      assert.strictEqual(result.hasTemplateSyntax, true, 'Should detect Nunjucks {# #} syntax')
      assert.strictEqual(result.html, html, 'Should return original HTML unchanged')
    })

    it('HTML with JSX template literals is processed', () => {
      const html = `
        <div className={\`hero-section \${dynamic}\`}>
          <span></span>
        </div>
      `
      const result = insertPlaceholdersWithInfo(html, defaultNaming, 'className')
      assert.strictEqual(result.hasTemplateSyntax, false, 'Should allow JSX template literal')
      assert.ok(result.html.includes('className="hero-section"'), 'className should be preserved')
      assert.ok(result.html.includes('className="element"'), 'Should add element placeholder')
    })

    it('HTML with JSX variable bindings is skipped', () => {
      const html = `
        <div className={styles.container}>
          <span></span>
        </div>
      `
      const result = insertPlaceholdersWithInfo(html, defaultNaming)
      assert.strictEqual(result.hasTemplateSyntax, true, 'Should detect JSX variable binding')
      assert.strictEqual(result.html, html, 'Should return original HTML unchanged')
    })

    it('HTML with JSX bindings containing spaces is skipped', () => {
      const html = `
        <div className = { foo }>
          <span></span>
        </div>
      `
      const result = insertPlaceholdersWithInfo(html, defaultNaming)
      assert.strictEqual(result.hasTemplateSyntax, true, 'Should detect JSX with spaces')
      assert.strictEqual(result.html, html, 'Should return original HTML unchanged')
    })

    it('HTML with Astro frontmatter is skipped', () => {
      const html = `---
import Component from './Component.astro'
---
<div>
  <p></p>
</div>
`
      const result = insertPlaceholdersWithInfo(html, defaultNaming)
      assert.strictEqual(result.hasTemplateSyntax, true, 'Should detect Astro frontmatter')
      assert.strictEqual(result.html, html, 'Should return original HTML unchanged')
    })

    it('Astro frontmatter with leading whitespace is detected', () => {
      const html = `  ---
const foo = 'bar'
---
<div>
  <p></p>
</div>
`
      const result = insertPlaceholdersWithInfo(html, defaultNaming)
      assert.strictEqual(result.hasTemplateSyntax, true, 'Should detect Astro frontmatter with leading whitespace')
      assert.strictEqual(result.html, html, 'Should return original HTML unchanged')
    })

    it('HTML without template syntax is processed normally', () => {
      const html = '<div><p></p></div>'
      const result = insertPlaceholdersWithInfo(html, defaultNaming)
      assert.strictEqual(result.hasTemplateSyntax, false, 'Should not detect template syntax')
      assert.ok(result.changeCount > 0, 'Should make changes')
      assert.ok(result.html.includes('block-box'), 'Should add block-box placeholder')
    })

    it('insertPlaceholders() returns original HTML when hasTemplateSyntax is true', () => {
      const html = `<div><% foo %><p></p></div>`
      const result = insertPlaceholders(html, defaultNaming)
      assert.strictEqual(result, html, 'Should return original HTML when template syntax detected')
    })
  })
})
