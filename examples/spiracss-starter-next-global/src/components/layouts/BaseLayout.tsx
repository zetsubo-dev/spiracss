import type { ReactNode } from "react";
import SiteFooter from "@common/SiteFooter/SiteFooter";
import SiteHeader from "@common/SiteHeader/SiteHeader";

type Props = {
  children: ReactNode;
};

export default function BaseLayout({ children }: Props) {
  return (
    <div className="main-container">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
