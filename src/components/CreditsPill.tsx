"use client";

import { useCallback, useEffect, useState } from "react";

type CreditsResponse = {
  ok: boolean;
  balance?: number;
  credits?: number;
  error?: string;
};

export default function CreditsPill() {
  const [credits, setCredits] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadCredits = useCallback(async () => {
    setError("");

    try {
      const response = await fetch("/api/credits", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as CreditsResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not load credits.");
      }

      const nextCredits =
        typeof payload.credits === "number"
          ? payload.credits
          : typeof payload.balance === "number"
            ? payload.balance
            : null;

      setCredits(nextCredits);
    } catch (err) {
      setCredits(null);
      setError(err instanceof Error ? err.message : "Could not load credits.");
    }
  }, []);

  useEffect(() => {
    void loadCredits();
  }, [loadCredits]);

  return (
    <div className="qa-credits-wrap">
      <button className="qa-credits-pill" type="button" onClick={loadCredits} title="Refresh credits">
        <span>Credits</span>
        <strong>{credits === null ? "—" : credits}</strong>
      </button>
      {error ? <span className="qa-credits-error">{error}</span> : null}
    </div>
  );
}
