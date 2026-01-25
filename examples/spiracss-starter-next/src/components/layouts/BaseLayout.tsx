import type { ReactNode } from "react";
import SiteFooter from "@common/SiteFooter/SiteFooter";
import SiteHeader from "@common/SiteHeader/SiteHeader";
import styles from "./BaseLayout.module.scss";

type Props = {
  children: ReactNode;
  className?: string;
};

export default function BaseLayout({ children, className }: Props) {
  const classes = [styles.mainContainer, className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
