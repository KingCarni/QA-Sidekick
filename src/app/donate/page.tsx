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
    <main className="account-page">
      <section className="account-card">
        <div className="account-header-row">
          <div>
            <p className="report-kicker">Support QAtalyst</p>
            <h1>Donate</h1>
            <p>
              Donations support development, hosting, and product polish. This is separate from
              buying credits.
            </p>
          </div>
          <Link className="account-back-link" href="/">
            Back to app
          </Link>
        </div>
      </section>

      <section className="purchase-panel">
        <div className="purchase-header">
          <p className="report-kicker">One-time support</p>
          <h1>Help keep QAtalyst moving.</h1>
          <p>
            Pick an amount and complete checkout through Stripe. Donations go to product support,
            not account credits.
          </p>
        </div>

        <div className="donation-grid">
          {AMOUNTS.map((amount) => {
            const isLoading = loadingAmount === amount;
            const disabled = loadingAmount !== null;

            return (
              <button
                className="donation-card"
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

        {error ? <div className="purchase-error">{error}</div> : null}

        <div className="purchase-note">
          Payments are processed securely by Stripe. You will be redirected there to complete the
          donation.
        </div>
      </section>
    </main>
  );
}
