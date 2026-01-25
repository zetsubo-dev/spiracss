import styles from "./SiteHeader.module.scss";

type Props = {
  className?: string;
};

export default function SiteHeader({ className }: Props) {
  const classes = [styles.siteHeader, className].filter(Boolean).join(" ");

  return (
    <header className={classes}>
      <div className={styles.siteLogo}>
        <a href="/">SpiraCSS</a>
      </div>
      <nav className={styles.siteNav}>
        <ul className={styles.list}>
          <li className={styles.item}>
            <a href="/">Home</a>
          </li>
          <li className={styles.item}>
            <a href="/about">About</a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
