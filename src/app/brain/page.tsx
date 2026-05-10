"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import CreditsPill from "@/components/CreditsPill";
import QAtGuideCard from "@/components/QAtGuideCard";

type BrainTabId =
  | "overview"
  | "sources"
  | "rules"
  | "terminology"
  | "risks"
  | "features"
  | "integrations";

type BrainTab = {
  id: BrainTabId;
  label: string;
  eyebrow: string;
  title: string;
  body: string;
};

const BRAIN_TABS: BrainTab[] = [
  {
    id: "overview",
    label: "Overview",
    eyebrow: "Brain overview",
    title: "Give QAtalyst a reusable memory of your product.",
    body:
      "Project Brain is where project context, reusable sources, team QA rules, terminology, risks, features, and integrations live.",
  },
  {
    id: "sources",
    label: "Source Vault",
    eyebrow: "Reusable context",
    title: "Store the source material QAtalyst should reuse.",
    body:
      "Use Source Vault for specs, product notes, saved outputs, imported context, important links, and release notes that should ground future QA work.",
  },
  {
    id: "rules",
    label: "QA Rules",
    eyebrow: "Team standards",
    title: "Capture how your team expects QA work to be written.",
    body:
      "Document release gates, severity rules, coverage expectations, automation preferences, edge-case standards, and team-specific instructions.",
  },
  {
    id: "terminology",
    label: "Terminology",
    eyebrow: "Product language",
    title: "Teach QAtalyst your product vocabulary.",
    body:
      "Define acronyms, user roles, domain terms, feature names, naming conventions, and language that should appear consistently in generated QA artifacts.",
  },
  {
    id: "risks",
    label: "Risks / Hotspots",
    eyebrow: "Known fragile areas",
    title: "Track the areas that deserve extra QA attention.",
    body:
      "Record regression hotspots, historical bug patterns, risky systems, known integration traps, and release blockers that should influence future test planning.",
  },
  {
    id: "features",
    label: "Feature Registry",
    eyebrow: "Product map",
    title: "Build a lightweight map of what exists and what is coming.",
    body:
      "Track shipped features, planned work, active product areas, and in-progress changes so QAtalyst can reason with better product awareness.",
  },
  {
    id: "integrations",
    label: "Integrations",
    eyebrow: "Connected workflow",
    title: "Connect the tools that feed and receive QA work.",
    body:
      "Jira and TestRail belong here as workflow integrations inside Project Brain, not as the main project setup mental model.",
  },
];

const BRAIN_STATUS_CARDS = [
  { label: "Source Vault", value: "Ready", text: "Reusable context and saved project sources." },
  { label: "QA Rules", value: "Planned", text: "Team standards and release expectations." },
  { label: "Terminology", value: "Planned", text: "Product vocabulary, acronyms, and roles." },
  { label: "Risks", value: "Planned", text: "Regression hotspots and known fragile areas." },
  { label: "Integrations", value: "Available", text: "Jira and TestRail setup lives here." },
];

const SECTION_EMPTY_STATES: Record<Exclude<BrainTabId, "overview" | "integrations">, string[]> = {
  sources: [
    "Add product notes, docs, release goals, or saved generated outputs.",
    "Keep context concise and reusable so future QA runs stay grounded.",
    "This will become the main Source Vault management area.",
  ],
  rules: [
    "Add severity/priority rules, release gates, and coverage expectations.",
    "Capture how your team wants QA output structured.",
    "Use this to reduce generic AI output.",
  ],
  terminology: [
    "Define acronyms, user roles, feature names, and product vocabulary.",
    "Keep domain language consistent across generated artifacts.",
    "This helps QAtalyst ask better follow-up questions.",
  ],
  risks: [
    "Track fragile areas, historical bug patterns, and regression hotspots.",
    "Use this for systems that need extra test focus before release.",
    "Future risk reviews should pull from this memory.",
  ],
  features: [
    "Track shipped, planned, and in-progress product areas.",
    "Use this as a lightweight feature map, not a heavy wiki.",
    "Future Feature Builder work can feed this registry.",
  ],
};

function BrainHeroAccount() {
  const { data: session, status } = useSession();
  const displayName = session?.user?.email ?? session?.user?.name ?? "Not signed in";

  return (
    <aside className="brain-native-account" aria-label="Brain account controls">
      <img className="brain-native-logo" src="/qatalyst-header.png" alt="QAtalyst" />

      <div className="brain-native-user">
        <span>{session?.user ? "Signed in" : "Account"}</span>
        <strong>{status === "loading" ? "Loading account…" : displayName}</strong>
      </div>

      <div className="brain-native-actions">
        <Link className="brain-native-menu" href="/app">
          Menu
        </Link>

        {session?.user ? (
          <>
            <div className="brain-native-credits">
              <CreditsPill />
            </div>
            <Link className="brain-native-account-link" href="/account">
              Account
            </Link>
            <button className="brain-native-ghost" type="button" onClick={() => signOut()}>
              Sign out
            </button>
          </>
        ) : (
          <button className="brain-native-primary" type="button" onClick={() => signIn("google")}>
            Sign in
          </button>
        )}
      </div>
    </aside>
  );
}

export default function BrainPage() {
  const [activeTab, setActiveTab] = useState<BrainTabId>("overview");

  const active = useMemo(
    () => BRAIN_TABS.find((tab) => tab.id === activeTab) ?? BRAIN_TABS[0],
    [activeTab]
  );

  return (
    <main className="qatalyst-brain-shell">
      <section className="brain-hero-shell" aria-label="Project Brain command center">
        <div className="brain-hero-copy">
          <div className="brain-breadcrumb-row">
            <Link href="/app">QAtalyst app</Link>
            <span>/</span>
            <strong>Project Brain</strong>
          </div>

          <p className="brain-eyebrow">Project Brain · Reusable context · Workflow intelligence</p>
          <h1>Project Brain gives QAtalyst product memory.</h1>
          <p>
            Configure the context, sources, rules, terms, risks, features, and integrations that keep generated QA work grounded in your actual product.
          </p>

          <div className="brain-hero-actions">
            <Link className="brain-primary-link" href="/app">
              Back to toolbelt
            </Link>
            <button className="brain-secondary-link" type="button" onClick={() => setActiveTab("integrations")}>
              Open integrations
            </button>
          </div>
        </div>

        <BrainHeroAccount />
      </section>

      <QAtGuideCard
        className="qat-ftue-card brain-qat-guide"
        eyebrow="QAt setup guide"
        title="Start with context, then connect workflow tools."
        body="Brain is the home for the product knowledge QAtalyst should reuse. Jira and TestRail are integrations inside that workspace, not the whole setup flow."
        primaryAction={{ label: "Open integrations", onClick: () => setActiveTab("integrations") }}
        secondaryAction={{ label: "Review overview", onClick: () => setActiveTab("overview") }}
      />

      <section className="brain-workspace">
        <nav className="brain-tab-rail" aria-label="Project Brain sections">
          {BRAIN_TABS.map((tab) => (
            <button key={tab.id} className={activeTab === tab.id ? "active" : ""} type="button" onClick={() => setActiveTab(tab.id)}>
              <span>{tab.eyebrow}</span>
              <strong>{tab.label}</strong>
            </button>
          ))}
        </nav>

        <section className="brain-panel" aria-live="polite">
          <div className="brain-panel-header">
            <p>{active.eyebrow}</p>
            <h2>{active.title}</h2>
            <span>{active.body}</span>
          </div>

          {activeTab === "overview" ? (
            <div className="brain-overview-grid">
              {BRAIN_STATUS_CARDS.map((card) => (
                <article className="brain-status-card" key={card.label}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <p>{card.text}</p>
                </article>
              ))}

              <article className="brain-next-step-card">
                <p>Recommended next step</p>
                <h3>Move Jira and TestRail setup under Brain → Integrations.</h3>
                <span>This gives FTUE a real destination and removes the confusing Jira/settings mental model.</span>
                <button type="button" onClick={() => setActiveTab("integrations")}>
                  Go to integrations
                </button>
              </article>
            </div>
          ) : null}

          {activeTab !== "overview" && activeTab !== "integrations" ? (
            <div className="brain-empty-state">
              <p className="brain-empty-kicker">V1 foundation</p>
              <h3>{active.label} is ready for the next build pass.</h3>
              <ul>
                {SECTION_EMPTY_STATES[activeTab].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {activeTab === "integrations" ? (
            <div className="brain-integrations-grid">
              <article className="brain-integration-card">
                <div>
                  <p>Jira integration</p>
                  <h3>Pull tickets and create Jira-ready QA work.</h3>
                  <span>Keep the existing Jira setup functional for now, but treat it as an integration inside Project Brain.</span>
                </div>
                <Link href="/jira/settings">Open current Jira setup</Link>
              </article>

              <article className="brain-integration-card">
                <div>
                  <p>TestRail integration</p>
                  <h3>Keep generated test coverage close to test management.</h3>
                  <span>TestRail-ready output and sync controls should live here as part of the workflow setup story.</span>
                </div>
                <Link href="/app">Use TestRail from toolbelt</Link>
              </article>

              <article className="brain-integration-card muted">
                <div>
                  <p>Future integrations</p>
                  <h3>GitHub, Linear, Notion, Confluence, and more.</h3>
                  <span>Brain should remain the stable home for connected workflow tools as QAtalyst grows.</span>
                </div>
                <button type="button" disabled>
                  Planned
                </button>
              </article>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
