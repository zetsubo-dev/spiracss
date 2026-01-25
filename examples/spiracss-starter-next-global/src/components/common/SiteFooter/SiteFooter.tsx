export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <span className="title">SpiraCSS</span>
        <p className="copy">CSS architecture for scalable teams.</p>
      </div>
      <div className="footer-links">
        <ul className="list">
          <li className="item">
            <a href="/">Home</a>
          </li>
          <li className="item">
            <a href="/about">About</a>
          </li>
          <li className="item">
            <a href="https://spiracss.jp" target="_blank" rel="noreferrer">
              Docs
            </a>
          </li>
        </ul>
      </div>
      <div className="footer-meta">
        <p className="note">Structure over guesswork.</p>
        <p className="copy">Copyright 2026 SpiraCSS</p>
      </div>
    </footer>
  );
}
