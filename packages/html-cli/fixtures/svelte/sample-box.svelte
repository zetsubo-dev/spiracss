<section class="sample-box">
  <header class="hero-header">
    <h1 class="title">{title}</h1>
    <p class="lede">{description}</p>
  </header>

  <div class="feature-list">
    {#each features as feature (feature.id)}
      <article
        class="feature-card"
        class:-primary={feature.primary}
        class:-wide={feature.wide}
        class:-secondary={feature.secondary}
        on:click={() => handleClick(feature)}
      >
        <h2 class="title">{feature.title}</h2>
        <p class="body">{feature.body}</p>
        {#if feature.primary}
          <button class="button">Primary action</button>
        {/if}
      </article>
    {/each}
  </div>

  {#if showCta}
    <section class="cta-section">
      <p class="body">Call to action text.</p>
      <a class="button" href={ctaHref}>Go somewhere</a>
    </section>
  {/if}
</section>
