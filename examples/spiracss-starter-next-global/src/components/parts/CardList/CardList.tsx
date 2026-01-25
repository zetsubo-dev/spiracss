type Props = {
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

export default function CardList({ id }: Props) {
  return (
    <section id={id} className="card-list" data-variant="highlight">
      <h2 className="title">Features</h2>
      <ul className="list-items">
        {cards.map((card) => (
          <li
            key={card.title}
            className="card-item"
            data-variant={card.variant}
            data-state={card.state}
            aria-selected={card.ariaSelected}
          >
            <h3 className="title">{card.title}</h3>
            <p className="description">{card.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
