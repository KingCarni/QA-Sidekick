import Link from "next/link";

const differentiators = [
  {
    eyebrow: "Context-first QA",
    title: "Reusable project memory, not one-off prompt soup",
    body: "Save notes, specs, edge cases, release decisions, and ticket history in Project Context / Source Vault so every QA workflow starts from what the team already knows.",
    tone: "green",
  },
  {
    eyebrow: "Ticket triage",
    title: "Follow-up questions that sound like a real QA review",
    body: "Surface unclear scope, missing acceptance criteria, blocked decisions, platform assumptions, and release risks before vague work becomes expensive rework.",
    tone: "gold",
  },
  {
    eyebrow: "Workflow output",
    title: "Jira-ready, TestRail-ready, and automation-aware",
    body: "Move from scratch notes or Jira tickets into parent/child work, QA tasks, test coverage, and starter automation skeletons with review steps before creation.",
    tone: "blue",
  },
];

const vaultItems = [
  "Product notes",
  "Known risks",
  "Jira tickets",
  "QA decisions",
  "Edge cases",
  "Release context",
];

const triageItems = [
  "What acceptance criteria are missing?",
  "Which user roles or permissions change?",
  "What data or migration risk exists?",
  "What needs product clarification before QA signs off?",
];

const workflowSteps = [
  {
    step: "01",
    title: "Bring context",
    body: "Paste scratch notes, fetch a Jira ticket, or pull from saved project context.",
  },
  {
    step: "02",
    title: "Choose workflow",
    body: "Generate test cases, review risk, improve a bug, shape a feature, or prep Jira/TestRail output.",
  },
  {
    step: "03",
    title: "Triage gaps",
    body: "Review follow-up questions, missing info, unclear assumptions, and edge cases.",
  },
  {
    step: "04",
    title: "Create or export",
    body: "Copy markdown, save context, create Jira-ready work, or prepare TestRail-ready coverage.",
  },
];

const integrations = [
  {
    name: "Jira",
    detail: "Fetch tickets and preview Jira-ready parent, child, and QA work before creating anything.",
    tone: "blue",
  },
  {
    name: "TestRail",
    detail: "Shape generated coverage into a cleaner TestRail-ready structure for review and handoff.",
    tone: "green",
  },
  {
    name: "Playwright",
    detail: "Use coverage as a starting point for automation setup and starter skeleton direction.",
    tone: "purple",
  },
  {
    name: "More to come",
    detail: "The workflow is designed to grow without turning QA planning into scattered AI output.",
    tone: "muted",
  },
];

const tools = [
  {
    name: "Test Cases",
    body: "Turn product notes into practical happy path, negative, edge, and regression coverage.",
    tone: "green",
  },
  {
    name: "Risk Review",
    body: "Call out release risk, unclear requirements, bottlenecks, data risk, and testing blind spots.",
    tone: "red",
  },
  {
    name: "Bug Writer",
    body: "Clean up rough bug notes into readable, reproducible, team-friendly reports.",
    tone: "gold",
  },
  {
    name: "Test Improver",
    body: "Strengthen existing test cases with clearer expectations, missing coverage, and better structure.",
    tone: "blue",
  },
  {
    name: "Feature Builder",
    body: "Shape a rough idea into a sharper feature brief with prompts, gaps, and QA-ready questions.",
    tone: "purple",
  },
  {
    name: "Automation Setup",
    body: "Draft starter automation skeletons and setup direction from reviewed coverage.",
    tone: "cyan",
  },
];

const guardrails = [
  "Preview Jira work before anything is created.",
  "Review and edit outputs before handing them to a team.",
  "Use saved context deliberately instead of hidden magic.",
  "Expose missing information instead of pretending every ticket is complete.",
  "Treat automation as starter skeletons and setup direction, not guaranteed finished tests.",
  "Keep AI output structured, inspectable, and grounded in the source material you provide.",
  "Project memory is authorized server-side before it is used in AI workflows.",
  "Jira and TestRail tokens are encrypted, masked, and never shown back in plaintext.",
];

export default function LandingPage() {
  return (
    <main className="qatalyst-landing qatalyst-landing-qas155">
      <section className="qatalyst-hero" aria-labelledby="qatalyst-hero-title">
        <div className="qatalyst-hero-copy">
          <p className="qatalyst-eyebrow">QAtalyst QA Workflow SaaS</p>
          <h1 id="qatalyst-hero-title">Turn rough product work into release-ready QA plans.</h1>
          <p className="qatalyst-hero-subcopy">
            QAtalyst helps QA analysts and small product teams turn messy tickets, scratch notes,
            Jira work, and feature ideas into test cases, risk reviews, bug reports, follow-up
            questions, Jira-ready work, TestRail-ready coverage, and starter automation skeletons.
          </p>

          <div className="qatalyst-hero-actions" aria-label="Primary actions">
            <Link className="qatalyst-button qatalyst-button-primary" href="/app">
              Launch QAtalyst
              <span aria-hidden="true">→</span>
            </Link>
            <Link className="qatalyst-button qatalyst-button-secondary" href="/buy-credits">
              Buy Credits
            </Link>
            <Link className="qatalyst-button qatalyst-button-secondary" href="/security">
              Security & Privacy
            </Link>
          </div>
        </div>

        <div className="qatalyst-hero-logo-stage" aria-label="QAtalyst brand mark">
          <div className="qatalyst-hero-logo-glow" aria-hidden="true" />
          <img src="/qatalyst-header.png" alt="QAtalyst" className="qatalyst-hero-large-logo" />
          <p className="qatalyst-hero-logo-caption">Reviewable QA workflow support for practical teams.</p>
        </div>
      </section>

      <section className="qatalyst-section" id="workflow" aria-labelledby="qatalyst-workflow-title">
        <div className="qatalyst-section-heading qatalyst-section-heading-center">
          <p className="qatalyst-eyebrow">Workflow</p>
          <h2 id="qatalyst-workflow-title">Bring context → choose workflow → triage gaps → create/export.</h2>
        </div>

        <div className="qatalyst-workflow-lane">
          {workflowSteps.map((item) => (
            <article className="qatalyst-step-card" key={item.step}>
              <span>{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="qatalyst-section" aria-labelledby="qatalyst-tools-title">
        <div className="qatalyst-section-heading qatalyst-section-heading-center">
          <p className="qatalyst-eyebrow">Tools</p>
          <h2 id="qatalyst-tools-title">Six focused workflows. One cleaner QA operating surface.</h2>
        </div>

        <div className="qatalyst-card-grid qatalyst-card-grid-3">
          {tools.map((tool) => (
            <article className={`qatalyst-tool-card qatalyst-tool-card-${tool.tone}`} key={tool.name}>
              <h3>{tool.name}</h3>
              <p>{tool.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="qatalyst-section qatalyst-vault-section" aria-labelledby="qatalyst-vault-title">
        <div className="qatalyst-vault-panel">
          <div className="qatalyst-vault-copy">
            <p className="qatalyst-eyebrow">Project Context / Source Vault</p>
            <h2 id="qatalyst-vault-title">Keep reusable QA context close to every workflow.</h2>
            <p>
              QA work gets better when the product history follows the ticket. Store source notes,
              decisions, risks, and examples once, then reuse them while generating tests, reviewing
              risks, shaping features, or preparing Jira and TestRail output.
            </p>
          </div>

          <div className="qatalyst-vault-stack" aria-label="Source Vault examples">
            {vaultItems.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="qatalyst-section qatalyst-integrations-section" aria-labelledby="qatalyst-integrations-title">
        <div className="qatalyst-section-heading">
          <p className="qatalyst-eyebrow">Integrations</p>
          <h2 id="qatalyst-integrations-title">Designed to meet the tools QA teams already use.</h2>
          <p>
            Keep the planning layer polished and reviewable, then move useful output toward Jira,
            TestRail, and automation setup without pretending AI should blindly own the release.
          </p>
        </div>

        <div className="qatalyst-card-grid qatalyst-card-grid-4">
          {integrations.map((item) => (
            <article className={`qatalyst-mini-card qatalyst-mini-card-${item.tone}`} key={item.name}>
              <h3>{item.name}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="qatalyst-section" aria-labelledby="qatalyst-differentiators-title">
        <div className="qatalyst-section-heading">
          <p className="qatalyst-eyebrow">Not just generated test cases</p>
          <h2 id="qatalyst-differentiators-title">A QA planning system for messy real-world product work.</h2>
          <p>
            The value is not only writing tests faster. It is carrying context across workflows,
            exposing gaps early, and keeping every AI-assisted step reviewable.
          </p>
        </div>

        <div className="qatalyst-card-grid qatalyst-card-grid-3">
          {differentiators.map((item) => (
            <article className={`qatalyst-card qatalyst-card-${item.tone}`} key={item.title}>
              <p className="qatalyst-card-eyebrow">{item.eyebrow}</p>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="qatalyst-section qatalyst-builder-section" aria-labelledby="qatalyst-builder-title">
        <div className="qatalyst-builder-card">
          <div>
            <p className="qatalyst-eyebrow">Feature Builder + QA triage</p>
            <h2 id="qatalyst-builder-title">Shape rough ideas before they turn into vague tickets.</h2>
            <p>
              Feature Builder treats early product work like a QA teammate would: brainstorm useful
              directions, identify missing information, then ask direct follow-up questions that make
              the scope testable.
            </p>
          </div>

          <div className="qatalyst-triage-box" aria-label="Example follow-up questions">
            <div className="qatalyst-triage-header">
              <span>Follow-up triage</span>
              <strong>Needs clarification</strong>
            </div>
            <ul>
              {triageItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="qatalyst-section qatalyst-guardrails-section" aria-labelledby="qatalyst-guardrails-title">
        <div className="qatalyst-section-heading">
          <p className="qatalyst-eyebrow">Guardrails and trust</p>
          <h2 id="qatalyst-guardrails-title">Built for reviewable AI-assisted QA, not AI chaos.</h2>
          <p>
            QAtalyst should make QA judgment faster to apply, not replace it. The landing page should
            reflect that same product philosophy: clear, inspectable, grounded, and team-safe.
          </p>
        </div>

        <div className="qatalyst-guardrail-list">
          {guardrails.map((item) => (
            <div className="qatalyst-guardrail-item" key={item}>
              <span aria-hidden="true">✓</span>
              <p>{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="qatalyst-final-cta" aria-labelledby="qatalyst-final-title">
        <div>
          <p className="qatalyst-eyebrow">Ready when the ticket is not</p>
          <h2 id="qatalyst-final-title">Start with messy notes. Leave with a QA plan your team can review.</h2>
          <p>
            Launch QAtalyst to turn unclear product work into structured coverage, risks, questions,
            Jira-ready work, TestRail-ready cases, and automation starter direction.
          </p>
        </div>

        <div className="qatalyst-final-actions">
          <Link className="qatalyst-button qatalyst-button-primary" href="/app">
            Launch QAtalyst
            <span aria-hidden="true">→</span>
          </Link>
          <Link className="qatalyst-button qatalyst-button-secondary" href="/security">
            Security & Privacy
          </Link>
          <Link className="qatalyst-button qatalyst-button-ghost" href="https://git-a-job.com/donate">
            Donate
          </Link>
        </div>
      </section>
    </main>
  );
}
