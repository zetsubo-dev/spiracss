import styles from "./SiteFooter.module.scss";

type Props = {
  className?: string;
};

export default function SiteFooter({ className }: Props) {
  const classes = [styles.siteFooter, className].filter(Boolean).join(" ");

  return (
    <footer className={classes}>
      <div className={styles.footerBrand}>
        <span className={styles.title}>SpiraCSS</span>
        <p className={styles.copy}>CSS architecture for scalable teams.</p>
      </div>
      <div className={styles.footerLinks}>
        <ul className={styles.list}>
          <li className={styles.item}>
            <a href="/">Home</a>
          </li>
          <li className={styles.item}>
            <a href="/about">About</a>
          </li>
          <li className={styles.item}>
            <a href="https://spiracss.jp" target="_blank" rel="noreferrer">
              Docs
            </a>
          </li>
        </ul>
      </div>
      <div className={styles.footerMeta}>
        <p className={styles.note}>Structure over guesswork.</p>
        <p className={styles.copy}>Copyright 2026 SpiraCSS</p>
      </div>
    </footer>
  );
}
