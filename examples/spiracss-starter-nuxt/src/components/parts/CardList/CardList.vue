<script setup lang="ts">
type Card = {
  title: string;
  description: string;
  variant?: string;
  state?: string;
  ariaSelected?: string;
};

const cards: Card[] = [
  {
    title: "Data Variants",
    description: "Express design intent with data-variant in data mode.",
    variant: "primary"
  },
  {
    title: "State Separation",
    description: "Keep data-state and aria states inside interaction sections.",
    state: "active"
  },
  {
    title: "Page Layer",
    description: "Wire blocks in page SCSS with explicit @rel comments.",
    ariaSelected: "true"
  }
];
</script>

<template>
  <section class="card-list" data-variant="highlight">
    <h2 class="title">Features</h2>
    <ul class="list-items">
      <li
        v-for="card in cards"
        :key="card.title"
        class="card-item"
        :data-variant="card.variant"
        :data-state="card.state"
        :aria-selected="card.ariaSelected"
      >
        <h3 class="title">{{ card.title }}</h3>
        <p class="description">{{ card.description }}</p>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss" src="./CardList.scss"></style>
