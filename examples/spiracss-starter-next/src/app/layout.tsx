import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../styles/globals.scss";

export const metadata: Metadata = {
  title: "Next Simple - SpiraCSS Sample",
  description: "A minimal Next.js sample for SpiraCSS."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
