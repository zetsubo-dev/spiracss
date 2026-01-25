<script setup lang="ts">
import HeroSection from "@pages/home/HeroSection/HeroSection.vue";
import CardList from "@parts/CardList/CardList.vue";
import "~/assets/css/home.scss";

useHead({
  title: "Nuxt Simple - SpiraCSS Example"
});
</script>

<template>
  <HeroSection />
  <CardList id="features" />
</template>
