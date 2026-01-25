import type { Metadata } from "next";
import BaseLayout from "@layouts/BaseLayout";
import HeroSection from "@pages/home/HeroSection/HeroSection";
import CardList from "@parts/CardList/CardList";
import styles from "@styles/pages/home.module.scss";

export const metadata: Metadata = {
  title: "Next Simple - SpiraCSS Example"
};

export default function HomePage() {
  return (
    <BaseLayout>
      <div className={styles.homePage}>
        <HeroSection />
        <CardList id="features" />
      </div>
    </BaseLayout>
  );
}
