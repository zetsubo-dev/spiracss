// JSX ライクなテンプレートリテラル + フラグメントのフィクスチャ

<>
  {/* JSX fragment + コメント */}
  <section class={`sample-box ${isDark ? '-dark' : ''}`}>
    <header className="hero-header">
      <h1 className="title">{title}</h1>
      <p className="lede">{description}</p>
    </header>

    <div className="feature-list">
      {features.map((feature) => (
        <article
          key={feature.id}
          className={`feature-card ${feature.primary ? '-primary' : ''} ${feature.wide ? '-wide' : ''} ${feature.secondary ? '-secondary' : ''}`}
        >
          <h2 className="title">{feature.title}</h2>
          <p className="body">{feature.body}</p>
          {feature.primary && <button className="button">Primary action</button>}
        </article>
      ))}
    </div>

    {showCta && (
      <section className="cta-section">
        <p className="body">Call to action text.</p>
        <a className="button" href={ctaHref}>
          Go somewhere
        </a>
      </section>
    )}
  </section>
</>
