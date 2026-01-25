import styles from "./CardList.module.scss";

type Props = {
  className?: string;
  id?: string;
};

type Card = {
  title: string;
  description: string;
  variant?: string;
  state?: string;
  ariaSelected?: boolean;
};

const cards: Card[] = [
  {
    title: "Data Variants",
    description: "Express design intent with data-variant in data mode.",
    variant: "primary"
  },
  {
    title: "State Separation",
    description: "Keep data-state and aria states inside interaction sections.",
    state: "active"
  },
  {
    title: "Page Layer",
    description: "Wire blocks in page SCSS with explicit @rel comments.",
    ariaSelected: true
  }
];

export default function CardList({ className, id }: Props) {
  const classes = [styles.cardList, className].filter(Boolean).join(" ");

  return (
    <section id={id} className={classes} data-variant="highlight">
      <h2 className={styles.title}>Features</h2>
      <ul className={styles.listItems}>
        {cards.map((card) => (
          <li
            key={card.title}
            className={styles.cardItem}
            data-variant={card.variant}
            data-state={card.state}
            aria-selected={card.ariaSelected}
          >
            <h3 className={styles.title}>{card.title}</h3>
            <p className={styles.description}>{card.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
