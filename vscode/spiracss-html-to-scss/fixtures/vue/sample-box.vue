<template>
  <section class="sample-box">
    <header class="hero-header">
      <h1 class="title">{{ title }}</h1>
      <p class="lede">{{ description }}</p>
    </header>

    <div class="feature-list">
      <article
        v-for="feature in features"
        :key="feature.id"
        class="feature-card"
        :class="{
          '-primary': feature.primary,
          '-wide': feature.wide,
          '-secondary': feature.secondary
        }"
        @click="onClick(feature)"
      >
        <h2 class="title">{{ feature.title }}</h2>
        <p class="body">{{ feature.body }}</p>
        <button
          v-if="feature.primary"
          class="button"
        >
          Primary action
        </button>
      </article>
    </div>

    <section
      v-if="showCta"
      class="cta-section"
    >
      <p class="body">Call to action text.</p>
      <a
        class="button"
        :href="ctaHref"
      >
        Go somewhere
      </a>
    </section>
  </section>
</template>
