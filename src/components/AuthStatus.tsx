"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import CreditsPill from "@/components/CreditsPill";

export default function AuthStatus() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <aside className="qa-auth-widget" aria-label="Account status">
        <div className="qa-auth-card qa-auth-card-loading">
          <span className="qa-auth-dot" />
          <span>Loading account…</span>
        </div>
      </aside>
    );
  }

  if (!session?.user) {
    return (
      <aside className="qa-auth-widget" aria-label="Account status">
        <div className="qa-auth-card qa-auth-card-signed-out">
          <div className="qa-auth-action-row">
            <button className="qa-auth-primary-button" type="button" onClick={() => signIn("google")}>
              Sign in
            </button>
          </div>
          <div className="qa-auth-copy qa-auth-copy-under">
            <span className="qa-auth-kicker">Account</span>
            <strong>Not signed in</strong>
          </div>
        </div>
      </aside>
    );
  }

  const displayName = session.user.email ?? session.user.name ?? "QA user";

  return (
    <aside className="qa-auth-widget" aria-label="Account status">
      <div className="qa-auth-card qa-auth-card-signed-in">
        <div className="qa-auth-copy qa-auth-copy-under account-identity-row">
          <div>
            <span className="qa-auth-kicker account-kicker">Signed in</span>
            <strong className="signed-in-email" title={displayName}>{displayName}</strong>
          </div>
        </div>

        <div className="qa-auth-action-row account-action-row">
          <CreditsPill />
          <Link className="qa-auth-secondary-button" href="/account">
            Account
          </Link>
          <button className="qa-auth-ghost-button" type="button" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
