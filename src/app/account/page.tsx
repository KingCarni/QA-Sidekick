"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import CreditsPill from "@/components/CreditsPill";

export default function AccountPage() {
  const { data: session, status } = useSession();

  const email = session?.user?.email ?? "Not signed in";
  const name = session?.user?.name ?? "QAtalyst user";
  const isSignedIn = Boolean(session?.user);

  return (
    <main className="qatalyst-account-shell">
      <section className="account-hero-card">
        <div className="account-hero-copy">
          <div className="account-breadcrumb-row">
            <Link href="/app">QAtalyst app</Link>
            <span>/</span>
            <strong>Account</strong>
          </div>

          <p className="account-eyebrow">Account · Credits · Billing</p>
          <h1>Manage your QAtalyst account.</h1>
          <p className="account-hero-subtitle">
            Update the basics, check your credits, and jump back into Project Brain when you need workspace setup.
          </p>

          <div className="account-hero-actions">
            <Link className="account-primary-link" href="/buy-credits">
              Buy credits
            </Link>
            <Link className="account-secondary-link" href="/brain">
              Open Project Brain
            </Link>
            <Link className="account-secondary-link" href="/app">
              Back to toolbelt
            </Link>
          </div>
        </div>

        <aside className="account-hero-logo" aria-label="QAtalyst">
          <img src="/qatalyst-header.png" alt="QAtalyst" />
        </aside>
      </section>

      <section className="account-dashboard-grid account-dashboard-grid-three" aria-label="Account dashboard">
        <article className="account-panel account-profile-panel">
          <p className="account-eyebrow">Profile</p>
          <h2>Your profile</h2>
          <dl className="account-detail-list">
            <div>
              <dt>Email</dt>
              <dd>{status === "loading" ? "Loading…" : email}</dd>
            </div>
            <div>
              <dt>Name</dt>
              <dd>{name}</dd>
            </div>
            <div className="account-status-row">
              <div>
                <dt>Status</dt>
                <dd>{isSignedIn ? "Signed in" : "Not signed in"}</dd>
              </div>
              {isSignedIn ? (
                <button className="account-inline-signout" type="button" onClick={() => signOut()}>
                  Sign out
                </button>
              ) : (
                <Link className="account-inline-signout" href="/api/auth/signin">
                  Sign in
                </Link>
              )}
            </div>
          </dl>
        </article>

        <article className="account-panel account-credits-panel">
          <p className="account-eyebrow">Credits</p>
          <h2>Your credits</h2>
          <div className="account-credit-display">
            <CreditsPill />
          </div>
          <p>Use credits to generate test cases, risk reviews, bug reports, and improvement passes.</p>
        </article>

        <article className="account-panel account-billing-panel">
          <p className="account-eyebrow">Billing</p>
          <h2>Purchases and billing</h2>
          <p>
            Credits, purchases, receipts, and future billing controls stay here in Account.
          </p>
          <div className="account-mini-list">
            <span>Credit purchases</span>
            <span>Billing history later</span>
            <span>Team billing later</span>
          </div>
        </article>
      </section>

      <section className="account-brain-handoff">
        <div>
          <p className="account-eyebrow">Project Brain</p>
          <h2>Workspace setup moved to Brain.</h2>
          <p>
            Source Vault, Bug Collection, Jira, TestRail, saved reports, QA rules, terminology, and risk hotspots now belong in Project Brain.
          </p>
        </div>

        <div className="account-brain-link-grid">
          <Link href="/brain">Brain overview</Link>
          <Link href="/brain?tab=sources">Source Vault</Link>
          <Link href="/brain?tab=bugs">Bug Collection</Link>
          <Link href="/brain?tab=reports">Saved Reports</Link>
          <Link href="/brain?tab=integrations">Integrations</Link>
        </div>
      </section>
    </main>
  );
}
