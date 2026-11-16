import Link from "next/link";

export default function Delivery() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="mark">N</span><div><strong>DELIVERY</strong><small>NORTAGO Order</small></div></div>
        <Link className="status" href="/otc">← Menu</Link>
      </header>
      <section className="hero">
        <div><div className="eyebrow">THIRD-PARTY DELIVERY</div><h1>Pesan dengan Delivery</h1>
          <p>Pilih outlet dan produk terlebih dahulu. Alamat pengantaran diisi pada checkout.</p></div>
      </section>
      <section className="data-panel">
        <p>Biaya antar dan integrasi kurir belum tersedia. Pesanan akan tercatat dengan status pembayaran PENDING.</p>
        <Link href="/otc/customer-order" className="otc-primary">Pilih Outlet & Menu →</Link>
      </section>
    </main>
  );
}