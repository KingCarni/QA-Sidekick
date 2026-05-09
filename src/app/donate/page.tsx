"use client";

import Link from "next/link";
import { useState } from "react";

const AMOUNTS = [5, 10, 25, 50, 100] as const;

export default function DonatePage() {
  const [loadingAmount, setLoadingAmount] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function startCheckout(amountCad: number) {
    setError("");
    setLoadingAmount(amountCad);

    try {
      const res = await fetch("/api/donate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountCad }),
      });

      const contentType = res.headers.get("content-type") || "";
      const raw = await res.text();
      const data = contentType.includes("application/json") ? JSON.parse(raw) : null;

      if (!res.ok || !data?.ok || !data?.url) {
        throw new Error(data?.error || `Could not start checkout (${res.status})`);
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoadingAmount(null);
    }
  }

  return (
    <main className="qas156-shell qas156-donate-page">
      <section className="qas156-window qas156-donate-hero">
        <div className="qas156-hero-copy">
          <p className="qas156-kicker">Support QAtalyst</p>
          <h1>Help keep QAtalyst moving.</h1>
          <p>
            Donations support development, hosting, and product polish. This is separate from buying
            credits and does not add credits to your account.
          </p>

          <div className="qas156-action-row">
            <Link className="qas156-button qas156-button-primary" href="/app">
              Launch App
            </Link>
            <Link className="qas156-button qas156-button-secondary" href="/">
              Back to QAtalyst
            </Link>
          </div>
        </div>

        <div className="qas156-logo-panel" aria-label="QAtalyst">
          <img src="/qatalyst-header.png" alt="QAtalyst" />
          <span>Support the polish pass, hosting, and continued QA workflow development.</span>
        </div>
      </section>

      <section className="qas156-window qas156-donation-panel">
        <div className="qas156-donation-heading">
          <div>
            <p className="qas156-kicker">One-time support</p>
            <h2>Pick an amount and complete checkout through Stripe.</h2>
          </div>
          <p>
            Donations go to product support, not account credits. Payments are processed securely by
            Stripe, and you will be redirected there to complete the donation.
          </p>
        </div>

        <div className="qas156-donation-grid">
          {AMOUNTS.map((amount) => {
            const isLoading = loadingAmount === amount;
            const disabled = loadingAmount !== null;

            return (
              <button
                className="qas156-donation-card"
                disabled={disabled}
                key={amount}
                onClick={() => startCheckout(amount)}
                type="button"
              >
                <span>One-time</span>
                <strong>${amount} CAD</strong>
                <p>{isLoading ? "Redirecting to Stripe..." : `Donate $${amount} CAD`}</p>
              </button>
            );
          })}
        </div>

        {error ? <div className="qas156-error-box">{error}</div> : null}

        <div className="qas156-trust-note">
          Payments are processed securely by Stripe. Donations are optional support and separate from
          QAtalyst credit packs.
        </div>
      </section>
    </main>
  );
}
