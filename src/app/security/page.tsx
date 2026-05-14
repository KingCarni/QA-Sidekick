import Link from "next/link";
import styles from "./security.module.css";

const trustPrinciples = [
  {
    title: "Your project memory is scoped to your account",
    body: "Project Brain and Source Vault content are designed to stay attached to the signed-in user who created them. QAtalyst should not expose your projects, sources, saved reports, bug collection items, or integration settings to another user.",
  },
  {
    title: "AI context is rebuilt server-side",
    body: "The browser can request which project or source to use, but QAtalyst rebuilds the final project context on the server from data the signed-in user is authorized to access. Client-supplied project context text is not trusted as the source of truth.",
  },
  {
    title: "Integration tokens are masked and protected",
    body: "Jira and TestRail API tokens are saved as encrypted secrets and shown back only as masked values. QAtalyst should never return the plaintext token to the browser after it has been saved.",
  },
  {
    title: "You stay in control of what gets saved",
    body: "Generated QA output is review-first. Reports, bug collection items, Project Brain sources, and integration settings can be removed when they are no longer needed.",
  },
];

const storedData = [
  "Project names, descriptions, and product context",
  "Project Brain / Source Vault notes and source documents you add",
  "Generated QA reports you choose to save",
  "Bug Collection items you choose to track",
  "Jira and TestRail configuration needed for integrations",
  "Basic account and credit ledger records needed to run the app",
];

const userControls = [
  "Delete Project Brain / Source Vault entries that are no longer useful.",
  "Delete saved QA reports and Bug Collection items.",
  "Remove Jira and TestRail integration configuration.",
  "Keep generated outputs as drafts until you explicitly copy, export, save, or sync them.",
];

const betaGuidance = [
  "Do not paste production passwords, API keys, private signing secrets, or live credentials into tickets or source notes.",
  "Avoid uploading highly sensitive customer PII during beta unless you have approval from your organization.",
  "Use sanitized examples when testing risky or confidential flows.",
  "Treat AI output as reviewable drafting support, not as an automatic release decision.",
];

const securityChecks = [
  "Cross-user project context access is covered by regression tests.",
  "Raw-ID access to another user’s reports, sources, and bug collection items is blocked.",
  "AI generation routes rebuild project context from authorized server-side data.",
  "TestRail sync cannot attach another user’s saved report ID.",
];

export default function SecurityPage() {
  return (
    <main className={styles.securityPage}>
      <section className={styles.hero} aria-labelledby="security-title">
        <div>
          <p className={styles.eyebrow}>Security & Privacy</p>
          <h1 id="security-title">Built so teams can trust project memory.</h1>
          <p className={styles.heroCopy}>
            QAtalyst works with sensitive QA context: tickets, project notes, generated reports,
            bug handoffs, and integration settings. This page explains how the beta protects that
            data and where users should still be careful.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/app">
              Launch QAtalyst
            </Link>
            <Link className={styles.secondaryButton} href="/">
              Back to home
            </Link>
          </div>
        </div>
        <div className={styles.securityBadge} aria-label="Beta security status">
          <span>Beta security posture</span>
          <strong>Project isolation checks passing</strong>
          <p>Server-side authorization and cross-user abuse regression coverage are active for core project-memory paths.</p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="security-stores-title">
        <div className={styles.sectionHeader}>
          <p className={styles.eyebrow}>What QAtalyst stores</p>
          <h2 id="security-stores-title">Only the context needed to support your QA workflow.</h2>
          <p>
            QAtalyst is most useful when it can reuse project rules, terminology, risks, and saved
            QA work. That also means project memory needs to be handled carefully.
          </p>
        </div>
        <div className={styles.checkGrid}>
          {storedData.map((item) => (
            <article className={styles.checkCard} key={item}>
              <span aria-hidden="true">✓</span>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="security-principles-title">
        <div className={styles.sectionHeader}>
          <p className={styles.eyebrow}>How project memory is protected</p>
          <h2 id="security-principles-title">The important rule: browser requests are not the security boundary.</h2>
          <p>
            QAtalyst validates ownership on the server before private project memory is read, used,
            saved, synced, or injected into an AI prompt.
          </p>
        </div>
        <div className={styles.principleGrid}>
          {trustPrinciples.map((principle) => (
            <article className={styles.principleCard} key={principle.title}>
              <h3>{principle.title}</h3>
              <p>{principle.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.splitSection} aria-labelledby="security-controls-title">
        <div className={styles.panel}>
          <p className={styles.eyebrow}>User controls</p>
          <h2 id="security-controls-title">You can remove project memory and integration settings.</h2>
          <ul className={styles.cleanList}>
            {userControls.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className={styles.panel}>
          <p className={styles.eyebrow}>Beta safety guidance</p>
          <h2>Be deliberate with secrets and customer data.</h2>
          <ul className={styles.warningList}>
            {betaGuidance.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="security-checks-title">
        <div className={styles.sectionHeader}>
          <p className={styles.eyebrow}>Current verification</p>
          <h2 id="security-checks-title">Security regression checks are part of the beta hardening path.</h2>
          <p>
            The current cross-user abuse suite focuses on the highest-risk beta surfaces: Project
            Brain / Source Vault context, saved reports, bug collection items, AI context injection,
            and TestRail sync handoff.
          </p>
        </div>
        <div className={styles.checkGrid}>
          {securityChecks.map((item) => (
            <article className={styles.checkCard} key={item}>
              <span aria-hidden="true">✓</span>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.callout} aria-labelledby="security-contact-title">
        <div>
          <p className={styles.eyebrow}>Report a concern</p>
          <h2 id="security-contact-title">If something looks wrong, treat it seriously.</h2>
          <p>
            During beta, report any suspected data leak, unexpected project access, exposed token,
            or unsafe AI behavior immediately so it can be investigated before the product opens wider.
          </p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.primaryButton} href="/account">
            Go to account
          </Link>
          <Link className={styles.secondaryButton} href="/app">
            Launch app
          </Link>
        </div>
      </section>
    </main>
  );
}
