import styles from "./HeroSection.module.scss";

type Props = {
  className?: string;
};

export default function HeroSection({ className }: Props) {
  const classes = [styles.heroSection, className].filter(Boolean).join(" ");

  return (
    <section className={classes}>
      <h1 className={styles.heroTitle}>Welcome to SpiraCSS</h1>
      <p className={styles.heroDescription}>
        A modern CSS architecture for scalable web projects.
      </p>
      <a href="#features" className={styles.ctaButton}>
        Learn More
      </a>
    </section>
  );
}
