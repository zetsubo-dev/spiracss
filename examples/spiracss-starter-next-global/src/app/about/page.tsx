import type { Metadata } from "next";
import BaseLayout from "@layouts/BaseLayout";
import AboutFlow from "@pages/about/AboutFlow/AboutFlow";

export const metadata: Metadata = {
  title: "About - Next Global - SpiraCSS Example"
};

export default function AboutPage() {
  return (
    <BaseLayout>
      <AboutFlow />
    </BaseLayout>
  );
}
