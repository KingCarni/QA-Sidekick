import Link from "next/link";

const workflowCards = [
  {
    kicker: "Project Context",
    title: "Project context that actually helps",
    body: "Save notes, specs, tickets, edge cases, and prior QA decisions into reusable context. QAtalyst can use that context when generating tests, risks, bugs, and feature plans.",
    accent: "green",
  },
  {
    kicker: "Feature Builder",
    title: "Shape rough ideas before they become bad tickets",
    body: "Turn scratch notes into a structured feature brief with brainstorming prompts, missing-info checks, and follow-up questions.",
    accent: "blue",
  },
  {
    kicker: "Follow-up Questions",
    title: "Follow-up questions that feel like QA triage",
    body: "Surface the same questions a QA team would ask in triage: what is missing, what is risky, and what needs a decision before release?",
    accent: "gold",
  },
  {
    kicker: "Jira Integration",
    title: "From scratch notes to Jira-ready work",
    body: "Start from rough notes or fetch a Jira ticket, then preview parent tickets, child work, and QA tasks before creating anything.",
    accent: "red",
  },
  {
    kicker: "TestRail Integration",
    title: "Move from generated tests to TestRail faster",
    body: "Prepare useful coverage faster and shape it into a TestRail-ready structure for the workflow your team already uses.",
    accent: "cyan",
  },
  {
    kicker: "Automation Setup",
    title: "Start automation from a usable skeleton",
    body: "Use generated coverage as a starting point for automation setup and starter skeletons instead of beginning from a blank page.",
    accent: "purple",
  },
];

const flowCards = [
  {
    title: "Bring the context",
    body: "Paste notes, fetch a Jira ticket, or use saved project context.",
    accent: "green",
  },
  {
    title: "Choose the QA workflow",
    body: "Generate test cases, review risks, improve a bug, shape a feature, or prepare TestRail/Jira output.",
    accent: "blue",
  },
  {
    title: "Triage the gaps",
    body: "Review follow-up questions, missing acceptance criteria, unclear scope, edge cases, and release risks.",
    accent: "gold",
  },
  {
    title: "Create or export",
    body: "Create Jira work, prepare TestRail cases, copy markdown, save context, or carry the brief into Test Cases/Risk Review.",
    accent: "red",
  },
];

const guardrailCards = [
  { body: "Preview Jira work before anything is created.", accent: "green" },
  { body: "Project context is user-controlled.", accent: "blue" },
  { body: "Follow-up questions expose missing info.", accent: "gold" },
  { body: "Credit costs are visible before paid actions.", accent: "red" },
  { body: "Failed actions do not charge.", accent: "cyan" },
  { body: "Outputs are editable before use.", accent: "purple" },
];

const toolPills = [
  { label: "Test Cases", accent: "green" },
  { label: "Risk Review", accent: "red" },
  { label: "Bug Writer", accent: "gold" },
  { label: "Test Improver", accent: "blue" },
  { label: "Feature Builder", accent: "purple" },
  { label: "Automation Setup", accent: "cyan" },
];

const integrationPills = [
  { label: "Jira", className: "is-blue" },
  { label: "TestRail", className: "is-green" },
  { label: "Playwright", className: "is-purple" },
  { label: "More to come", className: "is-muted" },
];

function accentClass(accent: string) {
  return `landing-card-accent landing-accent-${accent}`;
}

function titleAccentClass(accent: string) {
  return `landing-title-accent-${accent}`;
}

export default function LandingPage() {
  return (
    <main className="landing-page landing-page-v2">
      <section className="landing-hero landing-hero-refined">
        <div className="landing-hero-copy">
          <p className="report-kicker">QAtalyst</p>
          <h1>Turn rough product work into release-ready QA plans.</h1>
          <p className="landing-hero-subtitle">
            Paste scratch notes, fetch a Jira ticket, or shape a new feature idea. QAtalyst helps
            you turn messy inputs into test cases, risk reviews, bug reports, follow-up questions,
            Jira-ready tickets, TestRail cases, and automation-ready test skeletons.
          </p>

          <p className="landing-hero-note">
            Built around real QA workflow: unclear tickets, missing context, release risk, and the
            follow-up questions that turn vague work into something testable.
          </p>

          <div className="landing-cta-row">
            <Link className="landing-primary-cta" href="/app">
              Launch QAtalyst
            </Link>
            <Link className="landing-secondary-cta" href="/buy-credits">
              Buy Credits
            </Link>
          </div>
        </div>

        <div className="landing-hero-side">
          <img src="/qatalyst-header.png" alt="QAtalyst" className="landing-logo landing-logo-side" />

          <div className="landing-preview-card">
            <div className="landing-preview-top">
              <span>QA Output</span>
              <strong>Structured Review</strong>
            </div>

            <div className="landing-preview-block">
              <small>Context</small>
              <p>Use saved project notes, Jira tickets, specs, and prior QA decisions.</p>
            </div>

            <div className="landing-preview-block">
              <small>Follow-up</small>
              <p>What is missing, risky, unclear, or blocked before this can ship?</p>
            </div>

            <div className="landing-preview-block landing-preview-block-red">
              <small>Creation</small>
              <p>Preview Jira work, TestRail-ready coverage, and automation skeletons before use.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-workflow-system-section">
        <div className="landing-section-heading landing-section-heading-left">
          <p className="report-kicker">QA Workflow System</p>
          <h2>More than an AI test case generator.</h2>
        </div>

        <div className="landing-grid-3 landing-workflow-system-grid">
          {workflowCards.map((card) => (
            <article className={accentClass(card.accent)} key={card.kicker}>
              <p className="report-kicker">{card.kicker}</p>
              <h3 className={titleAccentClass(card.accent)}>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-flow-section">
        <div className="landing-section-heading landing-section-heading-left">
          <p className="report-kicker">Workflow</p>
          <h2 className="landing-section-heading-narrow">
            Bring context, choose the flow, triage the gaps, then create or export.
          </h2>
        </div>

        <div className="landing-grid-2 landing-flow-grid">
          {flowCards.map((card) => (
            <article className={accentClass(card.accent)} key={card.title}>
              <h3 className={titleAccentClass(card.accent)}>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-split-section landing-integrations-tools-row">
        <div className="landing-panel landing-integrations-panel">
          <p className="report-kicker">Integrations</p>
          <h2>Connect QA planning to the tools your team already uses.</h2>

          <div className="landing-integration-pill-row" aria-label="Supported and planned integrations">
            {integrationPills.map((pill) => (
              <span className={`landing-integration-pill ${pill.className}`} key={pill.label}>
                {pill.label}
              </span>
            ))}
          </div>

          <p className="landing-panel-support-copy">
            Fetch tickets, prepare TestRail-ready cases, and move generated coverage toward
            automation planning.
          </p>
        </div>

        <div className="landing-panel landing-tools-panel">
          <p className="report-kicker">Tools</p>
          <h2>Built around the QA work you already do.</h2>

          <div className="landing-tool-pill-grid" aria-label="QAtalyst tools">
            {toolPills.map((tool) => (
              <span
                className={`landing-tool-pill landing-tool-pill-${tool.accent}`}
                key={tool.label}
              >
                {tool.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-guardrails-section">
        <div className="landing-section-heading landing-section-heading-left">
          <p className="report-kicker">Guardrails</p>
          <h2>Built for reviewable QA work, not AI chaos.</h2>
        </div>

        <div className="landing-grid-3 landing-guardrail-grid">
          {guardrailCards.map((card) => (
            <article
              className={`${accentClass(card.accent)} landing-guardrail-card`}
              key={card.body}
            >
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-final-cta landing-final-cta-v2">
        <div>
          <p className="report-kicker">Ready</p>
          <h2>Start with a messy ticket. Leave with a QA plan.</h2>
          <p className="landing-ready-copy">
            Turn rough product work into structured test cases, risks, Jira tickets,
            TestRail-ready cases, and automation starting points.
          </p>
        </div>

        <div className="landing-ready-actions">
          <Link className="landing-primary-cta" href="/app">
            Launch QAtalyst
          </Link>
          <Link className="landing-donate-button" href="https://git-a-job.com/donate">
            Donate
          </Link>
        </div>
      </section>
    </main>
  );
}
