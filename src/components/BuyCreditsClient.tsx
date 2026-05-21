"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { CREDIT_PACK_LIST, formatCad, formatCredits, type CreditPack } from "@/lib/credits-config";

type CheckoutState = { packId: string; error: string };

type BuyCreditsClientProps = {
  initialBalance?: number | null;
  checkoutSuccess?: boolean;
  checkoutCancelled?: boolean;
  checkoutPackId?: string;
};

const pageStyle: CSSProperties = { margin: "0 auto", maxWidth: "1180px", padding: "42px 20px 82px" };
const windowStyle: CSSProperties = {
  border: "1px solid rgba(248, 113, 113, 0.22)",
  borderRadius: "32px",
  background: "radial-gradient(circle at top left, rgba(248, 113, 113, 0.14), transparent 36%), radial-gradient(circle at top right, rgba(37, 99, 235, 0.14), transparent 38%), linear-gradient(135deg, rgba(17, 17, 19, 0.96), rgba(3, 3, 5, 0.98))",
  boxShadow: "0 32px 80px rgba(0, 0, 0, 0.48)",
};
const heroStyle: CSSProperties = { ...windowStyle, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", padding: "34px" };
const sectionStyle: CSSProperties = { ...windowStyle, marginTop: "22px", padding: "26px" };
const kickerStyle: CSSProperties = { color: "#fecaca", fontSize: "0.72rem", fontWeight: 1000, letterSpacing: "0.32em", margin: "0 0 8px", textTransform: "uppercase" };
const h1Style: CSSProperties = { color: "#fff", fontSize: "clamp(2.4rem, 6vw, 5.25rem)", letterSpacing: "-0.075em", lineHeight: 0.92, margin: "10px 0 18px", maxWidth: "820px" };
const mutedTextStyle: CSSProperties = { color: "rgba(229, 231, 235, 0.76)", lineHeight: 1.55, margin: 0 };
const tinyLabelStyle: CSSProperties = { color: "rgba(220, 252, 231, 0.72)", fontSize: "0.68rem", fontWeight: 1000, letterSpacing: "0.11em", textTransform: "uppercase" };

function getPackBadge(pack: CreditPack) {
  if (pack.id === "pro") return "Best value";
  if (pack.id === "team") return "Team ready";
  if (pack.kind === "addon") return "Top-up";
  if (pack.kind === "support") return "Optional";
  return "Popular";
}

function getPackAccent(pack: CreditPack) {
  if (pack.id === "pro") return "#22c55e";
  if (pack.kind === "addon") return "#facc15";
  if (pack.kind === "support") return "#f87171";
  return "#60a5fa";
}

function getButtonStyle(pack: CreditPack, disabled: boolean): CSSProperties {
  const isGreen = pack.id === "pro" || pack.kind === "addon";
  const isRed = pack.kind === "support";

  return {
    border: `1px solid ${isRed ? "rgba(248, 113, 113, 0.42)" : isGreen ? "rgba(74, 222, 128, 0.42)" : "rgba(147, 197, 253, 0.42)"}`,
    borderRadius: "15px",
    background: isRed ? "linear-gradient(135deg, #dc2626, #991b1b)" : isGreen ? "linear-gradient(135deg, #16a34a, #15803d)" : "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#fff",
    cursor: disabled ? "not-allowed" : "pointer",
    filter: disabled ? "grayscale(0.55)" : "none",
    fontWeight: 1000,
    minHeight: "46px",
    opacity: disabled ? 0.62 : 1,
    padding: "11px 14px",
  };
}

function getPackCardStyle(pack: CreditPack): CSSProperties {
  return {
    border: `1px solid ${pack.id === "pro" ? "rgba(74, 222, 128, 0.42)" : pack.kind === "addon" ? "rgba(250, 204, 21, 0.28)" : pack.kind === "support" ? "rgba(248, 113, 113, 0.3)" : "rgba(148, 163, 184, 0.18)"}`,
    borderRadius: "24px",
    background: "radial-gradient(circle at top left, rgba(255, 255, 255, 0.075), transparent 34%), rgba(0, 0, 0, 0.38)",
    boxShadow: pack.id === "pro" ? "0 0 42px rgba(34, 197, 94, 0.14)" : "none",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    justifyContent: "space-between",
    minHeight: "250px",
    padding: "20px",
    overflow: "hidden",
    borderBottom: `4px solid ${getPackAccent(pack)}`,
  };
}

function getPillStyle(kind: "price" | "credits" | "muted"): CSSProperties {
  return {
    border: kind === "price" ? "1px solid rgba(147, 197, 253, 0.26)" : kind === "credits" ? "1px solid rgba(74, 222, 128, 0.28)" : "1px solid rgba(248, 113, 113, 0.24)",
    borderRadius: "16px",
    background: kind === "price" ? "rgba(30, 64, 175, 0.14)" : kind === "credits" ? "rgba(22, 101, 52, 0.16)" : "rgba(127, 29, 29, 0.12)",
    minHeight: "76px",
    padding: "12px",
  };
}

export default function BuyCreditsClient({ initialBalance = null, checkoutSuccess = false, checkoutCancelled = false }: BuyCreditsClientProps) {
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({ packId: "", error: "" });
  const primaryPacks = useMemo(() => CREDIT_PACK_LIST.filter((pack) => pack.kind === "primary"), []);
  const addonPacks = useMemo(() => CREDIT_PACK_LIST.filter((pack) => pack.kind === "addon"), []);
  const supportPacks = useMemo(() => CREDIT_PACK_LIST.filter((pack) => pack.kind === "support"), []);

  async function startCheckout(packId: string) {
    setCheckoutState({ packId, error: "" });

    try {
      const response = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;

      if (!response.ok || payload?.ok === false || !payload?.url) {
        throw new Error(payload?.error || "Could not start checkout.");
      }

      window.location.href = payload.url;
    } catch (error) {
      setCheckoutState({ packId: "", error: error instanceof Error ? error.message : "Could not start checkout." });
    }
  }

  function renderPackCard(pack: CreditPack) {
    const isLoading = checkoutState.packId === pack.id;
    const anyLoading = Boolean(checkoutState.packId);
    const hasCredits = pack.credits > 0;

    return (
      <article key={pack.id} style={getPackCardStyle(pack)}>
        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: "12px" }}>
          <span style={{ border: "1px solid rgba(147, 197, 253, 0.3)", borderRadius: "999px", background: "rgba(37, 99, 235, 0.16)", color: "#bfdbfe", fontSize: "0.68rem", fontWeight: 1000, letterSpacing: "0.1em", padding: "6px 9px", textTransform: "uppercase" }}>
            {getPackBadge(pack)}
          </span>
          <strong style={{ color: "#fecaca", fontSize: "0.68rem", fontWeight: 1000, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {pack.kind === "primary" ? "Credit Pack" : pack.kind === "addon" ? "Add-on" : "Support"}
          </strong>
        </div>

        <div>
          <h3 style={{ color: "#fff", fontSize: "1.55rem", letterSpacing: "-0.04em", margin: "0 0 8px" }}>{pack.label}</h3>
          <p style={mutedTextStyle}>{pack.description}</p>
        </div>

        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <div style={getPillStyle("price")}>
            <span style={tinyLabelStyle}>Price</span>
            <strong style={{ color: "#fff", display: "block", fontSize: "1.45rem", letterSpacing: "-0.045em", lineHeight: 1.1, marginTop: "6px" }}>{formatCad(pack.priceCad)}</strong>
          </div>
          <div style={getPillStyle(hasCredits ? "credits" : "muted")}>
            <span style={tinyLabelStyle}>{hasCredits ? "Credits" : "Support"}</span>
            <strong style={{ color: "#fff", display: "block", fontSize: "1.45rem", letterSpacing: "-0.045em", lineHeight: 1.1, marginTop: "6px" }}>{hasCredits ? formatCredits(pack.credits) : "No credits"}</strong>
          </div>
        </div>

        <button disabled={anyLoading} onClick={() => startCheckout(pack.id)} style={getButtonStyle(pack, anyLoading)} type="button">
          {isLoading ? "Opening checkout..." : pack.cta}
        </button>
      </article>
    );
  }

  const renderSection = (kicker: string, title: string, copy: string, packs: CreditPack[]) => (
    <section style={sectionStyle}>
      <div style={{ alignItems: "end", display: "flex", justifyContent: "space-between", gap: "18px", marginBottom: "18px" }}>
        <div>
          <p style={kickerStyle}>{kicker}</p>
          <h2 style={{ color: "#fff", fontSize: "clamp(1.45rem, 3vw, 2.2rem)", letterSpacing: "-0.045em", lineHeight: 1, margin: "6px 0 0" }}>{title}</h2>
        </div>
        <p style={{ ...mutedTextStyle, maxWidth: "520px" }}>{copy}</p>
      </div>
      <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>{packs.map(renderPackCard)}</div>
    </section>
  );

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <p style={kickerStyle}>QAtalyst Credits</p>
          <h1 style={h1Style}>Buy credits when you need more QA firepower.</h1>
          <p style={{ ...mutedTextStyle, fontSize: "1.04rem", maxWidth: "720px" }}>
            Keep QAtalyst simple and fair. Prices are in Canadian dollars. Use credits for generation, refinement, and Jira-connected QA workflows.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "22px" }}>
            <Link href="/app" style={{ alignItems: "center", border: "1px solid rgba(74, 222, 128, 0.42)", borderRadius: "15px", background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff", display: "inline-flex", fontWeight: 1000, justifyContent: "center", minHeight: "44px", padding: "0 18px", textDecoration: "none" }}>Launch App</Link>
          </div>
        </div>

        <aside style={{ alignSelf: "center", border: "1px solid rgba(74, 222, 128, 0.26)", borderRadius: "26px", background: "radial-gradient(circle at top left, rgba(74, 222, 128, 0.16), transparent 48%), rgba(0, 0, 0, 0.34)", padding: "22px" }}>
          <p style={kickerStyle}>Current Balance</p>
          <div style={{ alignItems: "center", border: "1px solid rgba(74, 222, 128, 0.36)", borderRadius: "18px", background: "rgba(22, 101, 52, 0.24)", display: "flex", justifyContent: "space-between", gap: "14px", margin: "14px 0", padding: "14px 16px" }}>
            <span style={tinyLabelStyle}>Credits</span>
            <strong style={{ color: "#fff", fontSize: "1.8rem", letterSpacing: "-0.04em" }}>{initialBalance === null ? "—" : formatCredits(initialBalance)}</strong>
          </div>
          <p style={mutedTextStyle}>New purchases are added after Stripe confirms checkout.</p>
        </aside>
      </section>

      {checkoutSuccess ? <div style={{ borderRadius: "18px", fontWeight: 950, margin: "18px 0", padding: "14px 18px", border: "1px solid rgba(74, 222, 128, 0.34)", background: "rgba(22, 101, 52, 0.2)", color: "#bbf7d0" }}>Checkout completed. Your credits should appear after the Stripe webhook processes.</div> : null}
      {checkoutCancelled ? <div style={{ borderRadius: "18px", fontWeight: 950, margin: "18px 0", padding: "14px 18px", border: "1px solid rgba(250, 204, 21, 0.34)", background: "rgba(113, 63, 18, 0.18)", color: "#fde68a" }}>Checkout cancelled. No credits were purchased.</div> : null}
      {checkoutState.error ? <div style={{ borderRadius: "18px", fontWeight: 950, margin: "18px 0", padding: "14px 18px", border: "1px solid rgba(248, 113, 113, 0.42)", background: "rgba(127, 29, 29, 0.22)", color: "#fecaca" }}>{checkoutState.error}</div> : null}

      <div id="primary-packs">{renderSection("Primary Packs", "Pick the pack that matches your workflow.", "Starter for testing, Pro for active sprint work, Team for heavier planning sessions.", primaryPacks)}</div>
      {renderSection("Add-on Packs", "Quick top-ups for one more push.", "Useful when you only need a small refill instead of a larger pack.", addonPacks)}
      {renderSection("Support", "Support continued development.", "Optional support for QAtalyst development. This is separate from credit packs and does not grant credits in this MVP.", supportPacks)}
    </main>
  );
}
