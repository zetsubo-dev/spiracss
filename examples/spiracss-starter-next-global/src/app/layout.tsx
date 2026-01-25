import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../styles/globals.scss";

export const metadata: Metadata = {
  title: "Next Global - SpiraCSS Sample",
  description: "A minimal Next.js sample for SpiraCSS (global SCSS, no CSS Modules)."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
