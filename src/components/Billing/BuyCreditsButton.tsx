"use client";

import { useMemo, useState } from "react";

type Pack = "standard" | "plus" | "pro" | "premium";

const PACKS: Record<Pack, { label: string; credits: number; price: string; description: string }> = {
  standard: {
    label: "Standard",
    credits: 25,
    price: "$5",
    description: "Quick top-up for a few QA generation and refinement passes.",
  },
  plus: {
    label: "Plus",
    credits: 75,
    price: "$10",
    description: "A stronger bundle for active QA planning across multiple tickets.",
  },
  pro: {
    label: "Pro",
    credits: 150,
    price: "$15",
    description: "Built for repeated test generation, risk review, bug improvement, and iteration.",
  },
  premium: {
    label: "Premium",
    credits: 500,
    price: "$25",
    description: "Best value for heavy use across projects, reports, and future Jira workflows.",
  },
};

export default function BuyCreditsButton({ defaultPack = "standard" }: { defaultPack?: Pack }) {
  const [pack, setPack] = useState<Pack>(defaultPack);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const packInfo = useMemo(() => PACKS[pack], [pack]);

  async function handleCheckout() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });

      const contentType = res.headers.get("content-type") || "";
      const raw = await res.text();
      const data = contentType.includes("application/json") ? JSON.parse(raw) : null;

      if (!res.ok || !data?.ok || !data?.url) {
        throw new Error(data?.error || `Checkout failed (${res.status})`);
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setLoading(false);
    }
  }

  return (
    <section className="purchase-panel">
      <div className="purchase-header">
        <p className="report-kicker">Buy Credits</p>
        <h1>Keep QAtalyst moving.</h1>
        <p>
          Purchase credits for test case generation, risk reviews, bug reports, test improvement,
          and future project/Jira workflows.
        </p>
      </div>

      <div className="purchase-grid">
        <div className="purchase-selected-card">
          <span>Selected pack</span>
          <strong>{packInfo.label}</strong>
          <p>
            {packInfo.credits} credits • {packInfo.price}
          </p>
        </div>

        <div className="purchase-picker-card">
          <label htmlFor="credit-pack">Pack</label>
          <select id="credit-pack" value={pack} onChange={(event) => setPack(event.target.value as Pack)}>
            {Object.entries(PACKS).map(([key, info]) => (
              <option key={key} value={key}>
                {info.label} — {info.credits} credits ({info.price})
              </option>
            ))}
          </select>

          <div className="purchase-description">
            <strong>{packInfo.label} pack</strong>
            <p>{packInfo.description}</p>
          </div>
        </div>

        <div className="purchase-info-card">
          <strong>What credits unlock</strong>
          <ul>
            <li>Test case generation</li>
            <li>Pre-production risk reviews</li>
            <li>Bug report improvement</li>
            <li>Test case improvement</li>
            <li>Future saved reports and Jira workflows</li>
          </ul>
        </div>
      </div>

      {error ? <div className="purchase-error">{error}</div> : null}

      <button className="purchase-primary-button" type="button" onClick={handleCheckout} disabled={loading}>
        {loading ? "Redirecting to Stripe..." : `Buy ${packInfo.label} (${packInfo.price})`}
      </button>
    </section>
  );
}
