<script setup lang="ts">
import SiteHeader from "@common/SiteHeader/SiteHeader.vue";
import SiteFooter from "@common/SiteFooter/SiteFooter.vue";
</script>

<template>
  <div class="main-container">
    <SiteHeader />
    <slot />
    <SiteFooter />
  </div>
</template>
