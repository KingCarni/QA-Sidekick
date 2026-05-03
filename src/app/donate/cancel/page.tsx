import Link from "next/link";

export default function DonateCancelPage() {
  return (
    <main className="account-page">
      <section className="account-card">
        <p className="report-kicker">Donation cancelled</p>
        <h1>No donation was made.</h1>
        <p>You can return to QAtalyst or try again later.</p>
        <Link className="account-back-link" href="/">
          Back to QAtalyst
        </Link>
      </section>
    </main>
  );
}
