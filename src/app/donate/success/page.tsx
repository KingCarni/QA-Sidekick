import Link from "next/link";

export default function DonateSuccessPage() {
  return (
    <main className="account-page">
      <section className="account-card">
        <p className="report-kicker">Thank you</p>
        <h1>Donation received.</h1>
        <p>Thank you for supporting QAtalyst development.</p>
        <Link className="account-back-link" href="/">
          Back to QAtalyst
        </Link>
      </section>
    </main>
  );
}
