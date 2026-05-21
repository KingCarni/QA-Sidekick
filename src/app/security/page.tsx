import Link from "next/link";
import styles from "./security.module.css";

const trustPrinciples = [
  {
    title: "Account-scoped project memory",
    body: "Project Brain, Source Vault, saved reports, bug collection items, and integration settings are tied to the signed-in account that created them.",
  },
  {
    title: "Server-side context rebuilding",
    body: "The browser can request a project, but QAtalyst rebuilds AI context on the server from data that user is authorized to access.",
  },
  {
    title: "Masked integration secrets",
    body: "Jira and TestRail tokens are encrypted at rest and shown back only as masked values. Plaintext secrets are not returned after save.",
  },
  {
    title: "Review-first AI workflows",
    body: "Generated QA output is meant to be inspected before it is saved, copied, exported, synced, or created in Jira.",
  },
];

const storedData = [
  "Project profile, product notes, QA rules, terminology, risks, and Source Vault entries",
  "Generated QA reports, bug collection items, and saved test coverage you choose to keep",
  "Jira and TestRail connection settings needed for integrations",
  "Account, session, credit ledger, and checkout records needed to operate the app",
];

const doItems = [
  "Validate ownership before reading saved project context.",
  "Mask saved Jira and TestRail tokens in the UI.",
  "Use review-first creation for Jira/TestRail handoff.",
  "Block cross-user raw-ID access to private QA data.",
];

const dontItems = [
  "Do not show saved API tokens back in plaintext.",
  "Do not trust browser-supplied context as source of truth.",
  "Do not treat AI output as an automatic release decision.",
  "Do not recommend pasting passwords or live credentials into notes.",
];

const userControls = [
  { title: "Open Setup", body: "Manage Project Brain, Source Vault, rules, risks, and integrations.", href: "/brain" },
  { title: "Launch App", body: "Return to the QA workflow surface and generate reviewable outputs.", href: "/app" },
  { title: "Buy Credits", body: "Manage credit purchases for generation and refinement workflows.", href: "/buy-credits" },
  { title: "Account", body: "Review account state, credits, and signed-in access details.", href: "/account" },
];

const betaGuidance = [
  "Do not paste production passwords, API keys, signing secrets, or live credentials into tickets or source notes.",
  "Avoid uploading sensitive customer PII during beta unless you have approval from your organization.",
  "Use sanitized examples when testing confidential workflows.",
  "Treat AI output as drafting and QA planning support, not a replacement for human judgment.",
];

const securityChecks = [
  "Cross-user project context access is covered by regression checks.",
  "Saved reports, sources, bug items, and TestRail sync paths are ownership-scoped.",
  "AI routes rebuild Project Brain context from authorized server-side data.",
  "Saved Jira and TestRail secrets are masked and protected from plaintext redisplay.",
];

export default function SecurityPage() {
  return (
    <main className={styles.securityPage}>
      <header className={styles.siteHeader} aria-label="QAtalyst security navigation">
        <Link className={styles.siteBrand} href="/" aria-label="QAtalyst home">
          <img src="/qatalyst-header.png" alt="" aria-hidden="true" />
          <span>QAtalyst</span>
        </Link>
        <nav className={styles.siteNav} aria-label="Security page sections">
          <a href="#overview">Overview</a>
          <a href="#controls">Controls</a>
          <a href="#checks">Checks</a>
          <Link href="/buy-credits">Buy Credits</Link>
        </nav>
        <div className={styles.siteActions}>
          <Link className={styles.headerButtonSecondary} href="/brain">Open Setup</Link>
          <Link className={styles.headerButtonPrimary} href="/app">Launch App <span aria-hidden="true">→</span></Link>
        </div>
      </header>

      <section className={styles.hero} id="overview" aria-labelledby="security-title">
        <div>
          <p className={styles.eyebrow}>Security & Privacy</p>
          <h1 id="security-title">Built so teams can trust project memory.</h1>
          <p className={styles.heroCopy}>
            QAtalyst works with sensitive QA context: tickets, product notes, generated reports,
            bug handoffs, and integration settings. The beta security model is simple: validate
            access server-side, keep secrets masked, and make AI output reviewable before handoff.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/app">Launch QAtalyst</Link>
            <Link className={styles.secondaryButton} href="/">Back to home</Link>
          </div>
        </div>
        <div className={styles.securityBadge} aria-label="Beta security status">
          <span>Beta security posture</span>
          <strong>Project isolation checks active</strong>
          <p>Core Project Brain, saved report, bug collection, AI context, and TestRail sync paths are built around account-scoped access.</p>
        </div>
      </section>

      <section className={styles.comparisonSection} aria-labelledby="security-summary-title">
        <div className={styles.sectionHeaderCenter}>
          <p className={styles.eyebrow}>Plain-English summary</p>
          <h2 id="security-summary-title">Security is part of the workflow, not a separate promise.</h2>
          <p>
            QAtalyst should help teams move faster without turning project memory, tokens, or AI handoff into a blind spot.
          </p>
        </div>
        <div className={styles.comparisonGrid}>
          <article className={styles.warningPanel}>
            <h3>Be careful with</h3>
            <ul>{dontItems.map((item) => <li key={item}><span aria-hidden="true">×</span>{item}</li>)}</ul>
          </article>
          <article className={styles.safePanel}>
            <h3>QAtalyst is designed to</h3>
            <ul>{doItems.map((item) => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul>
          </article>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="security-stores-title">
        <div className={styles.sectionHeader}>
          <p className={styles.eyebrow}>What QAtalyst stores</p>
          <h2 id="security-stores-title">Only the context needed to support your QA workflow.</h2>
          <p>Project-aware QA is useful because the product history follows the ticket. That context is scoped to the account that owns it.</p>
        </div>
        <div className={styles.checkGrid}>{storedData.map((item) => <article className={styles.checkCard} key={item}><span aria-hidden="true">✓</span><p>{item}</p></article>)}</div>
      </section>

      <section className={styles.section} aria-labelledby="security-principles-title">
        <div className={styles.sectionHeader}>
          <p className={styles.eyebrow}>How project memory is protected</p>
          <h2 id="security-principles-title">The browser is not the security boundary.</h2>
          <p>Saved context is read, injected, synced, and used from server-authorized data instead of trusting client-supplied text.</p>
        </div>
        <div className={styles.principleGrid}>{trustPrinciples.map((principle) => <article className={styles.principleCard} key={principle.title}><h3>{principle.title}</h3><p>{principle.body}</p></article>)}</div>
      </section>

      <section className={styles.section} id="controls" aria-labelledby="security-controls-title">
        <div className={styles.sectionHeader}>
          <p className={styles.eyebrow}>User controls</p>
          <h2 id="security-controls-title">Manage the places where private QA data is created.</h2>
          <p>Use these controls to clean up beta test data, remove old context, or disconnect external tools.</p>
        </div>
        <div className={styles.controlGrid}>{userControls.map((item) => <Link className={styles.controlCard} href={item.href} key={item.title}><span>{item.title}</span><p>{item.body}</p></Link>)}</div>
      </section>

      <section className={styles.section} aria-labelledby="security-beta-title">
        <div className={styles.sectionHeader}>
          <p className={styles.eyebrow}>Beta safety guidance</p>
          <h2 id="security-beta-title">Use sanitized context when the stakes are high.</h2>
          <p>QAtalyst is built for QA planning context, not for storing live credentials or unnecessary sensitive customer data.</p>
        </div>
        <ul className={styles.betaGrid}>{betaGuidance.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>

      <section className={styles.section} id="checks" aria-labelledby="security-checks-title">
        <div className={styles.sectionHeader}>
          <p className={styles.eyebrow}>Current verification</p>
          <h2 id="security-checks-title">Security regression checks are part of beta hardening.</h2>
          <p>The current checks focus on the highest-risk beta surfaces: saved project memory, report ownership, AI context injection, and integration handoff.</p>
        </div>
        <div className={styles.checkGrid}>{securityChecks.map((item) => <article className={styles.checkCard} key={item}><span aria-hidden="true">✓</span><p>{item}</p></article>)}</div>
      </section>

      <footer className={styles.footer} aria-label="QAtalyst footer">
        <div className={styles.footerMain}>
          <Link className={styles.siteBrand} href="/" aria-label="QAtalyst home">
            <img src="/qatalyst-header.png" alt="" aria-hidden="true" />
            <span>QAtalyst</span>
          </Link>
          <p>Reviewable QA workflow support with project-aware context and guarded integrations.</p>
        </div>
        <nav className={styles.footerLinks} aria-label="Footer links">
          <Link href="/app">Launch App</Link>
          <Link href="/brain">Open Setup</Link>
          <Link href="/buy-credits">Buy Credits</Link>
          <Link href="/donate">Donate</Link>
        </nav>
      </footer>
    </main>
  );
}
