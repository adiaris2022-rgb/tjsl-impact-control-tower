"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Interval = "MONTHLY" | "YEARLY";
const PRICE: Record<Interval, number> = { MONTHLY: 50000, YEARLY: 500000 };
const money = (value: number) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0,
}).format(value);

export default function SubscribePage() {
  const [outletCount, setOutletCount] = useState(1);
  const [interval, setInterval] = useState<Interval>("MONTHLY");
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [preview, setPreview] = useState(false);

  const total = useMemo(() => outletCount * PRICE[interval], [outletCount, interval]);
  const annualSaving = outletCount * 100000;
  const periodLabel = interval === "MONTHLY" ? "bulan" : "tahun";

  function prepareSummary(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPreview(true);
  }

  return (
    <main className="otc-page subscribe-page">
      <header className="otc-head">
        <div><b>NORTAGO Order</b><small>Subscription · Pemesanan Lisensi Outlet</small></div>
        <Link href="/otc">Kembali ke NORTAGO Order</Link>
      </header>

      <section className="subscribe-hero">
        <span className="eyebrow">LANGGANAN NORTAGO ORDER</span>
        <h1>Satu sistem pemesanan.<br /><em>Untuk setiap outlet Anda.</em></h1>
        <p>Pilih jumlah outlet dan periode langganan. Biaya dihitung per outlet, sehingga bisnis dengan beberapa cabang tetap mudah dikelola.</p>
        <div className="subscribe-proof"><span>✓ Tagihan per outlet</span><span>✓ Kelola banyak outlet</span><span>✓ Pembayaran di muka</span></div>
      </section>

      <div className="subscribe-layout">
        <form className="subscribe-form" onSubmit={prepareSummary}>
          <section className="subscribe-section">
            <div className="subscribe-step">01</div>
            <div className="subscribe-section-content">
              <span className="eyebrow">SKALA BISNIS</span>
              <h2>Berapa outlet yang akan digunakan?</h2>
              <p>Setiap outlet memiliki langganan dan masa aktif tersendiri.</p>
              <div className="outlet-counter">
                <button type="button" aria-label="Kurangi jumlah outlet" onClick={() => { setOutletCount((n) => Math.max(1, n - 1)); setPreview(false); }}>−</button>
                <div><strong>{outletCount}</strong><small>{outletCount === 1 ? "Outlet" : "Outlet"}</small></div>
                <button type="button" aria-label="Tambah jumlah outlet" onClick={() => { setOutletCount((n) => Math.min(100, n + 1)); setPreview(false); }}>+</button>
              </div>
              <small className="subscribe-hint">Pilih 1–100 outlet. Jumlah dapat disesuaikan sebelum pembayaran.</small>
            </div>
          </section>

          <section className="subscribe-section">
            <div className="subscribe-step">02</div>
            <div className="subscribe-section-content">
              <span className="eyebrow">PERIODE TAGIHAN</span>
              <h2>Pilih paket langganan</h2>
              <div className="plan-options">
                <button type="button" className={interval === "MONTHLY" ? "plan-option selected" : "plan-option"} onClick={() => { setInterval("MONTHLY"); setPreview(false); }}>
                  <span className="plan-radio">{interval === "MONTHLY" ? "●" : "○"}</span>
                  <span><b>Bulanan</b><small>Fleksibel, dibayar setiap bulan</small></span>
                  <strong>Rp50.000<small>/ outlet / bulan</small></strong>
                </button>
                <button type="button" className={interval === "YEARLY" ? "plan-option selected" : "plan-option"} onClick={() => { setInterval("YEARLY"); setPreview(false); }}>
                  <span className="plan-radio">{interval === "YEARLY" ? "●" : "○"}</span>
                  <span><b>Tahunan</b><small>Lebih hemat untuk penggunaan setahun</small></span>
                  <strong>Rp500.000<small>/ outlet / tahun</small><i>Hemat 16,7%</i></strong>
                </button>
              </div>
              {interval === "YEARLY" ? <div className="saving-note">Penghematan {money(annualSaving)} untuk {outletCount} outlet dibandingkan pembayaran bulanan selama 12 bulan.</div> : null}
            </div>
          </section>

          <section className="subscribe-section">
            <div className="subscribe-step">03</div>
            <div className="subscribe-section-content">
              <span className="eyebrow">DATA PEMESAN</span>
              <h2>Informasi bisnis dan pemilik</h2>
              <p>Data ini digunakan untuk menyiapkan invoice langganan.</p>
              <div className="subscribe-fields">
                <label>Nama bisnis<input required value={businessName} onChange={(e) => { setBusinessName(e.target.value); setPreview(false); }} placeholder="Contoh: Kedai Kopi Nusantara" maxLength={120} /></label>
                <label>Nama penanggung jawab<input required value={ownerName} onChange={(e) => { setOwnerName(e.target.value); setPreview(false); }} placeholder="Nama lengkap" maxLength={120} /></label>
                <label>Nomor WhatsApp<input required type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setPreview(false); }} placeholder="08xxxxxxxxxx" minLength={8} maxLength={20} /></label>
                <label>Email<input required type="email" value={email} onChange={(e) => { setEmail(e.target.value); setPreview(false); }} placeholder="nama@email.com" maxLength={160} /></label>
              </div>
            </div>
          </section>
          <button className="subscribe-submit" type="submit">Tinjau ringkasan pesanan →</button>
          <p className="subscribe-terms">Dengan melanjutkan, Anda meminta penyiapan pesanan langganan. Pembayaran dan aktivasi belum dilakukan pada tahap ini.</p>
        </form>

        <aside className="subscribe-summary">
          <span className="eyebrow">RINGKASAN BIAYA</span>
          <h2>Pesanan langganan</h2>
          <div className="summary-row"><span>Jumlah outlet</span><b>{outletCount} outlet</b></div>
          <div className="summary-row"><span>Paket</span><b>{interval === "MONTHLY" ? "Bulanan" : "Tahunan"}</b></div>
          <div className="summary-row"><span>Harga per outlet</span><b>{money(PRICE[interval])}</b></div>
          <div className="summary-total"><span>Total per {periodLabel}</span><strong>{money(total)}</strong></div>
          <div className="summary-caption">Harga sudah dihitung berdasarkan jumlah outlet. Tidak ada biaya per akun bisnis.</div>
          {preview ? (
            <div className="summary-preview" role="status">
              <b>Ringkasan berhasil disiapkan</b>
              <span>{businessName} · {ownerName}</span>
              <span>{phone} · {email}</span>
              <span>{outletCount} outlet · {interval === "MONTHLY" ? "Bulanan" : "Tahunan"} · {money(total)}</span>
            </div>
          ) : null}
          <div className="payment-notice"><b>Pembayaran melalui OrderHero</b><p>Halaman pembayaran akan dihubungkan setelah URL/API LinkBayar dan konfigurasi webhook OrderHero tersedia. Jangan melakukan transfer ke rekening yang tidak tercantum pada invoice resmi.</p><span>STATUS: MENUNGGU INTEGRASI PEMBAYARAN</span></div>
        </aside>
      </div>
      <footer>NORTAGO Order · Sistem Pemesanan Digital Terintegrasi</footer>
    </main>
  );
}
