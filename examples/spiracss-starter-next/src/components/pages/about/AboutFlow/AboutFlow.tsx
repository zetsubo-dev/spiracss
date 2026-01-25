export default function AboutFlow() {
  return (
    <main className="aboutFlow">
      <header className="flowHeader">
        <p className="label">Workflow</p>
        <h1 className="title">From HTML to SCSS</h1>
        <p className="lead">
          This page is intentionally HTML-first so SCSS can be generated from it.
        </p>
      </header>
      <ol className="flowSteps">
        <li className="flowStep">
          <span className="number">01</span>
          <h2 className="title">Draft structure</h2>
          <p className="body">
            Write Block and Element class names before styling anything.
          </p>
        </li>
        <li className="flowStep">
          <span className="number">02</span>
          <h2 className="title">Generate SCSS</h2>
          <p className="body">
            Use the VS Code extension or HTML CLI to scaffold files.
          </p>
        </li>
        <li className="flowStep">
          <span className="number">03</span>
          <h2 className="title">Refine with lint</h2>
          <p className="body">
            Move placement rules and states based on Stylelint guidance.
          </p>
        </li>
      </ol>
      <div className="flowActions">
        <div className="actionCard">
          <h2 className="title">VS Code</h2>
          <p className="body">Run the SCSS generation command on this content.</p>
          <p className="meta">Command: Generate SpiraCSS SCSS from Selection</p>
        </div>
        <div className="actionCard">
          <h2 className="title">HTML CLI</h2>
          <p className="body">Generate SCSS from the CLI using the copied HTML fragment.</p>
          <p className="meta">
            npx spiracss-html-to-scss --selection --stdin --base-dir
            src/components/pages/about/AboutFlow
          </p>
        </div>
      </div>
    </main>
  );
}
