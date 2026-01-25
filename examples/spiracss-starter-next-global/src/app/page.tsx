import type { Metadata } from "next";
import BaseLayout from "@layouts/BaseLayout";
import HeroSection from "@pages/home/HeroSection/HeroSection";
import CardList from "@parts/CardList/CardList";

export const metadata: Metadata = {
  title: "Next Global - SpiraCSS Example"
};

export default function HomePage() {
  return (
    <BaseLayout>
      <HeroSection />
      <CardList id="features" />
    </BaseLayout>
  );
}
