import Link from "next/link";

export default function BuyCreditsCancelPage() {
  return (
    <main className="account-page">
      <section className="account-card">
        <p className="report-kicker">Checkout cancelled</p>
        <h1>No credits were purchased.</h1>
        <p>You can return to QAtalyst or try again later.</p>
        <Link className="account-back-link" href="/">
          Back to QAtalyst
        </Link>
      </section>
    </main>
  );
}
