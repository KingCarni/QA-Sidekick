import Link from "next/link";

const comparisonItems = {
  without: [
    "Tickets land with missing context and unclear acceptance criteria.",
    "QA chases scope, owners, and edge cases days before release.",
    "Generated test cases sound generic and miss the real risk.",
    "Risks are discovered after code is already merged.",
    "Bug reports lack repro steps, environment, and severity context.",
  ],
  with: [
    "Detect missing information before it becomes rework.",
    "Ask focused, triage-style follow-up questions like a senior QA.",
    "Reuse saved project context across every workflow.",
    "Generate structured, reviewable QA artifacts — not prompt soup.",
    "Keep human QA judgment in control of every output.",
  ],
};

const vaultItems = ["Product notes", "Known risks", "Jira tickets", "QA decisions", "Edge cases", "Release context"];
const triageItems = ["What acceptance criteria are missing?", "Which user roles or permissions change?", "What data or migration risk exists?", "What needs product clarification before QA signs off?"];
const workflowSteps = [
  { step: "01", title: "Bring context", body: "Paste scratch notes, fetch a Jira ticket, or pull from saved project context." },
  { step: "02", title: "Choose workflow", body: "Generate test cases, review risk, improve a bug, shape a feature, or prep Jira/TestRail output." },
  { step: "03", title: "Triage gaps", body: "Review follow-up questions, missing info, unclear assumptions, and edge cases." },
  { step: "04", title: "Create or export", body: "Copy markdown, save context, create Jira-ready work, or prepare TestRail-ready coverage." },
];
const integrations = [
  { name: "Jira", detail: "Fetch tickets and preview Jira-ready parent, child, and QA work before creating anything.", tone: "blue" },
  { name: "TestRail", detail: "Shape generated coverage into a cleaner TestRail-ready structure for review and handoff.", tone: "green" },
  { name: "Playwright", detail: "Use coverage as a starting point for automation setup and starter skeleton direction.", tone: "purple" },
  { name: "More to come", detail: "The workflow is designed to grow without turning QA planning into scattered AI output.", tone: "muted" },
];
const tools = [
  { initials: "TC", name: "Test Cases", body: "Generate release-ready QA coverage from Jira tickets, stories, and acceptance criteria.", tone: "green" },
  { initials: "BW", name: "Bug Writer", body: "Turn rough bug notes into structured, Jira-ready defect reports with repro and severity.", tone: "gold" },
  { initials: "RR", name: "Risk Review", body: "Expose unclear requirements, bottlenecks, fragile areas, and release risks early.", tone: "red" },
  { initials: "TI", name: "Test Improver", body: "Upgrade weak test cases and checklists into clearer executable coverage.", tone: "blue" },
  { initials: "FB", name: "Feature Builder", body: "Shape rough ideas into QA-ready feature briefs with follow-up questions and gap checks.", tone: "purple" },
  { initials: "QA", name: "QAt Companion", body: "Get project-aware QA guidance across risks, bugs, coverage, Jira handoff, and TestRail readiness.", tone: "cyan" },
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
    <main className="qatalyst-landing qatalyst-landing-qas155 qatalyst-landing-qas197">
      <header className="qatalyst-site-header" aria-label="QAtalyst site navigation">
        <Link className="qatalyst-site-brand" href="/" aria-label="QAtalyst home"><img src="/qatalyst-header.png" alt="" aria-hidden="true" /><span>QAtalyst</span></Link>
        <nav className="qatalyst-site-nav" aria-label="Landing page sections"><a href="#product">Product</a><a href="#workflows">Workflows</a><a href="#pricing">Pricing</a><Link href="/buy-credits">Buy Credits</Link><Link href="/security">Security & Privacy</Link></nav>
        <div className="qatalyst-site-actions"><Link className="qatalyst-header-button qatalyst-header-button-secondary" href="/brain">Open Setup</Link><Link className="qatalyst-header-button qatalyst-header-button-primary" href="/app">Launch App <span aria-hidden="true">→</span></Link></div>
      </header>

      <section className="qatalyst-hero" id="product" aria-labelledby="qatalyst-hero-title">
        <div className="qatalyst-hero-copy"><h1 id="qatalyst-hero-title">Turn rough tickets into release-ready QA plans.</h1><p className="qatalyst-hero-subcopy">QAtalyst helps QA teams turn Jira tickets, feature notes, bug reports, and product context into test cases, risk reviews, bug reports, follow-up questions, Jira-ready work, TestRail-ready coverage, and automation starter direction.</p><div className="qatalyst-hero-actions" aria-label="Primary actions"><Link className="qatalyst-button qatalyst-button-primary" href="/app">Launch QAtalyst <span aria-hidden="true">→</span></Link><a className="qatalyst-button qatalyst-button-secondary" href="#workflows">See how it works</a></div></div>
        <div className="qatalyst-hero-logo-stage" aria-label="QAtalyst brand mark"><div className="qatalyst-hero-logo-glow" aria-hidden="true" /><img src="/qatalyst-header.png" alt="QAtalyst" className="qatalyst-hero-large-logo" /></div>
      </section>

      <section className="qatalyst-section qatalyst-comparison-section" aria-labelledby="qatalyst-comparison-title"><div className="qatalyst-section-heading qatalyst-section-heading-center"><p className="qatalyst-eyebrow">Before / After</p><h2 id="qatalyst-comparison-title">QA shouldn&apos;t start from a blank prompt.</h2><p>Most AI test case generators stop at output. QAtalyst sits between messy tickets and release-ready execution — surfacing gaps, asking better questions, and keeping project memory close.</p></div><div className="qatalyst-comparison-grid"><article className="qatalyst-comparison-card qatalyst-comparison-card-without"><h3>Without QAtalyst</h3><ul>{comparisonItems.without.map((item) => <li key={item}><span aria-hidden="true">×</span>{item}</li>)}</ul></article><article className="qatalyst-comparison-card qatalyst-comparison-card-with"><h3>With QAtalyst</h3><ul>{comparisonItems.with.map((item) => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul></article></div></section>
      <section className="qatalyst-section" id="workflow" aria-labelledby="qatalyst-workflow-title"><div className="qatalyst-section-heading qatalyst-section-heading-center"><p className="qatalyst-eyebrow">Workflow</p><h2 id="qatalyst-workflow-title">Bring context → choose workflow → triage gaps → create/export.</h2></div><div className="qatalyst-workflow-lane">{workflowSteps.map((item) => <article className="qatalyst-step-card" key={item.step}><span>{item.step}</span><h3>{item.title}</h3><p>{item.body}</p></article>)}</div></section>
      <section className="qatalyst-section qatalyst-workflows-section" id="workflows" aria-labelledby="qatalyst-tools-title"><div className="qatalyst-section-heading qatalyst-section-heading-center"><p className="qatalyst-eyebrow">Workflows</p><h2 id="qatalyst-tools-title">Six focused workflows. One cleaner QA surface.</h2><p>Each workflow is shaped around real QA work — not generic prompt boxes.</p></div><div className="qatalyst-card-grid qatalyst-card-grid-3 qatalyst-workflow-card-grid">{tools.map((tool) => <article className={`qatalyst-tool-card qatalyst-tool-card-${tool.tone}`} key={tool.name}><span className="qatalyst-tool-initials" aria-hidden="true">{tool.initials}</span><h3>{tool.name}</h3><p>{tool.body}</p></article>)}</div></section>
      <section className="qatalyst-section qatalyst-vault-section" id="project-brain" aria-labelledby="qatalyst-vault-title"><div className="qatalyst-vault-panel"><div className="qatalyst-vault-copy"><p className="qatalyst-eyebrow">Project Brain / Source Vault</p><h2 id="qatalyst-vault-title">Keep reusable QA context close to every workflow.</h2><p>QA work gets better when the product history follows the ticket. Store source notes, decisions, risks, and examples once, then reuse them while generating tests, reviewing risks, shaping features, or preparing Jira and TestRail output.</p></div><div className="qatalyst-vault-stack" aria-label="Source Vault examples">{vaultItems.map((item) => <span key={item}>{item}</span>)}</div></div></section>
      <section className="qatalyst-section qatalyst-integrations-section" aria-labelledby="qatalyst-integrations-title"><div className="qatalyst-section-heading"><p className="qatalyst-eyebrow">Integrations</p><h2 id="qatalyst-integrations-title">Designed to meet the tools QA teams already use.</h2><p>Keep the planning layer polished and reviewable, then move useful output toward Jira, TestRail, and automation setup without pretending AI should blindly own the release.</p></div><div className="qatalyst-card-grid qatalyst-card-grid-4">{integrations.map((item) => <article className={`qatalyst-mini-card qatalyst-mini-card-${item.tone}`} key={item.name}><h3>{item.name}</h3><p>{item.detail}</p></article>)}</div></section>
      <section className="qatalyst-section qatalyst-builder-section" aria-labelledby="qatalyst-builder-title"><div className="qatalyst-builder-card"><div><p className="qatalyst-eyebrow">Feature Builder + QA triage</p><h2 id="qatalyst-builder-title">Shape rough ideas before they turn into vague tickets.</h2><p>Feature Builder treats early product work like a QA teammate would: brainstorm useful directions, identify missing information, then ask direct follow-up questions that make the scope testable.</p></div><div className="qatalyst-triage-box" aria-label="Example follow-up questions"><div className="qatalyst-triage-header"><span>Follow-up triage</span><strong>Needs clarification</strong></div><ul>{triageItems.map((item) => <li key={item}>{item}</li>)}</ul></div></div></section>
      <section className="qatalyst-section qatalyst-guardrails-section" aria-labelledby="qatalyst-guardrails-title"><div className="qatalyst-section-heading"><p className="qatalyst-eyebrow">Guardrails and trust</p><h2 id="qatalyst-guardrails-title">Built for reviewable AI-assisted QA, not AI chaos.</h2><p>QAtalyst should make QA judgment faster to apply, not replace it. The landing page should reflect that same product philosophy: clear, inspectable, grounded, and team-safe.</p></div><div className="qatalyst-guardrail-list">{guardrails.map((item) => <div className="qatalyst-guardrail-item" key={item}><span aria-hidden="true">✓</span><p>{item}</p></div>)}</div></section>
      <footer className="qatalyst-footer" id="pricing" aria-label="QAtalyst footer"><div className="qatalyst-footer-main"><Link className="qatalyst-site-brand qatalyst-footer-brand" href="/" aria-label="QAtalyst home"><img src="/qatalyst-header.png" alt="" aria-hidden="true" /><span>QAtalyst</span></Link><p>Reviewable QA workflow support for practical teams.</p></div><nav className="qatalyst-footer-links" aria-label="Footer links"><Link href="/app">Launch App</Link><Link href="/brain">Open Setup</Link><Link href="/buy-credits">Buy Credits</Link><Link href="/security">Security & Privacy</Link><Link href="/donate">Donate</Link></nav></footer>
    </main>
  );
}
