export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-logo">
        <a href="/">SpiraCSS</a>
      </div>
      <nav className="site-nav">
        <ul className="list">
          <li className="item">
            <a href="/">Home</a>
          </li>
          <li className="item">
            <a href="/about">About</a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
