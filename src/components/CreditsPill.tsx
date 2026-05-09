
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { subscribeToCreditBalanceUpdated } from "@/lib/credit-balance-events";
import { formatCredits } from "@/lib/credits-config";

type CreditsResponse = { ok?: boolean; balance?: number; error?: string };

export default function CreditsPill() {
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function loadCredits() {
    try {
      const response = await fetch("/api/credits", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as CreditsResponse | null;
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Could not load credits.");
      setBalance(typeof payload?.balance === "number" ? payload.balance : 0);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load credits.");
    }
  }

  useEffect(() => {
    loadCredits();
    function handleFocus() { loadCredits(); }
    window.addEventListener("focus", handleFocus);
    const unsubscribe = subscribeToCreditBalanceUpdated(setBalance);
    return () => {
      window.removeEventListener("focus", handleFocus);
      unsubscribe();
    };
  }, []);

  return <Link className="qa-credits-pill" href="/buy-credits" title={error || "Buy credits"}><span>Credits</span><strong>{balance === null ? "…" : formatCredits(balance)}</strong></Link>;
}
