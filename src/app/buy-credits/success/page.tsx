import Link from "next/link";

export default function BuyCreditsSuccessPage() {
  return (
    <main className="account-page">
      <section className="account-card">
        <p className="report-kicker">Checkout complete</p>
        <h1>Credits purchase received.</h1>
        <p>
          Stripe checkout completed. Credit awarding is handled by the Stripe webhook pass.
        </p>
        <Link className="account-back-link" href="/">
          Back to QAtalyst
        </Link>
      </section>
    </main>
  );
}
