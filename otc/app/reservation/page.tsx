import Link from "next/link";

export default function ReservationUnavailable() {
  return (
    <main className="otc-page">
      <header className="otc-head">
        <div>
          <b>NORTAGO Order</b>
          <small>Order-only release</small>
        </div>
        <Link href="/otc/customer-order">← Menu</Link>
      </header>
      <section className="customer-title">
        <span>ORDER ONLY</span>
        <h1>Reservasi meja tidak tersedia</h1>
        <p>
          Reservasi, Dine-In, Walk-In, antrean, dan pengelolaan meja bukan
          bagian dari NORTAGO Order. Fitur operasional tersebut ditunda ke
          rilis BOS berikutnya.
        </p>
        <Link className="otc-primary" href="/otc/customer-order">
          Kembali ke menu pesanan
        </Link>
      </section>
      <footer>NORTAGO Order · Digital Ordering</footer>
    </main>
  );
}
