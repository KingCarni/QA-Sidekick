import Link from "next/link";
import BuyCreditsButton from "@/components/Billing/BuyCreditsButton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function BuyCreditsPage() {
  return (
    <main className="account-page">
      <section className="account-card">
        <div className="account-header-row">
          <div>
            <p className="report-kicker">QAtalyst</p>
            <h1>Buy Credits</h1>
            <p>Top up your account for QA generation and refinement workflows.</p>
          </div>
          <Link className="account-back-link" href="/">
            Back to app
          </Link>
        </div>
      </section>

      <BuyCreditsButton />
    </main>
  );
}
