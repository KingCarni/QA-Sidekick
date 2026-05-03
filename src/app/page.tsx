import Link from "next/link";

const featureCards = [
  {
    title: "Generate test cases",
    body: "Paste a Jira ticket, user story, or acceptance criteria and get practical test coverage fast.",
  },
  {
    title: "Expose delivery risk",
    body: "Catch vague requirements, missing acceptance criteria, bottlenecks, and QA blind spots before dev work goes sideways.",
  },
  {
    title: "Improve bug reports",
    body: "Turn rough repro notes, screenshots, logs, and tester context into a clean report your team can act on.",
  },
  {
    title: "Refine test cases",
    body: "Strengthen existing tests with clearer steps, better coverage, missing info, and follow-up questions.",
  },
];

const audienceCards = ["QA analysts", "solo devs", "indie game teams", "small product teams"];

export default function LandingPage() {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <img src="/qatalyst-header.png" alt="QAtalyst" className="landing-logo" />
          <p className="report-kicker">QAtalyst</p>
          <h1>Turn rough tickets into release-ready QA plans.</h1>
          <p>
            Generate test cases, expose risks, improve bug reports, and tighten QA coverage from
            one clean workspace.
          </p>

          <div className="landing-cta-row">
            <Link className="landing-primary-cta" href="/app">
              Launch App
            </Link>
            <Link className="landing-secondary-cta" href="/buy-credits">
              Buy Credits
            </Link>
          </div>
        </div>

        <div className="landing-preview-card">
          <div className="landing-preview-top">
            <span>QA Output</span>
            <strong>Structured Review</strong>
          </div>

          <div className="landing-preview-block">
            <small>Risk</small>
            <p>Missing acceptance criteria could cause inconsistent test coverage.</p>
          </div>

          <div className="landing-preview-block">
            <small>Test focus</small>
            <p>Validate happy path, edge cases, data handling, permissions, and regression impact.</p>
          </div>

          <div className="landing-preview-block landing-preview-block-red">
            <small>Bug quality</small>
            <p>Attach screenshots/logs, clarify repro rate, and define expected vs actual results.</p>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-heading">
          <p className="report-kicker">What it does</p>
          <h2>Four QA tools in one workspace.</h2>
        </div>

        <div className="landing-feature-grid">
          {featureCards.map((feature) => (
            <article className="landing-feature-card" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-split-section">
        <div className="landing-panel">
          <p className="report-kicker">Built for</p>
          <h2>QA-minded teams that need clarity fast.</h2>
          <div className="landing-audience-grid">
            {audienceCards.map((audience) => (
              <span key={audience}>{audience}</span>
            ))}
          </div>
        </div>

        <div className="landing-panel">
          <p className="report-kicker">Credits</p>
          <h2>Start free, top up when needed.</h2>
          <p>
            New accounts get signup credits and a daily login bonus. Buy credits when you want more
            AI passes across test cases, risk reviews, bug reports, and test improvement.
          </p>
          <Link className="landing-secondary-cta landing-panel-link" href="/buy-credits">
            View Credits
          </Link>
        </div>
      </section>

      <section className="landing-final-cta">
        <p className="report-kicker">Ready</p>
        <h2>Paste a ticket. Get a QA plan.</h2>
        <Link className="landing-primary-cta" href="/app">
          Launch QAtalyst
        </Link>
      </section>
    </main>
  );
}
