import "../../app/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NORTAGO Order | Legacy demo disabled",
  description: "Legacy OTC demo is disabled and is not a commercial transaction channel.",
};

export default function Layout() {
  return (
    <div className="otc-wrap">
      <main className="otc-page">
        <header className="otc-head">
          <div>
            <b>NORTAGO Order</b>
            <small>Legacy demo disabled</small>
          </div>
        </header>
        <section className="customer-title">
          <span>LEGACY APP DISABLED</span>
          <h1>Versi demo tidak tersedia</h1>
          <p>
            Aplikasi OTC legacy ini dinonaktifkan. Halaman ini tidak menerima
            pesanan, tidak memverifikasi pembayaran, dan bukan bukti transaksi.
          </p>
          <p>
            Gunakan jalur NORTAGO Order aktif yang diberikan oleh pemilik outlet.
          </p>
        </section>
        <footer>NORTAGO Order · Legacy demo disabled</footer>
      </main>
    </div>
  );
}
