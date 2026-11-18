"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

type Interval = "MONTHLY" | "YEARLY";
type Outlet = { id: string; name: string; business_id: string };
type PaymentLink = { outlet_id: string; invoice_no: string; amount_idr: number; payment_url: string; expires_at: string | null };
const PRICE: Record<Interval, number> = { MONTHLY: 50000, YEARLY: 500000 };
const money = (value: number) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0,
}).format(value);

async function getSupabase() {
  const response = await fetch("/api/supabase-config", { cache: "no-store" });
  const config = await response.json().catch(() => ({}));
  if (!response.ok || !config.url || !config.key) throw new Error(config.error || "Konfigurasi Supabase tidak tersedia.");
  return createClient(config.url, config.key);
}

export default function SubscribePage() {
  const [interval, setInterval] = useState<Interval>("MONTHLY");
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [businessIds, setBusinessIds] = useState<string[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletIds, setSelectedOutletIds] = useState<string[]>([]);
  const [sessionToken, setSessionToken] = useState("");
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [failures, setFailures] = useState<Array<{ outlet_id: string; error: string }>>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = await getSupabase();
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token || "";
        if (!token) throw new Error("Silakan masuk ke akun Owner/Program Manager NORTAGO terlebih dahulu.");
        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !authData.user) throw new Error("Sesi login tidak valid. Silakan masuk kembali.");
        const { data: memberships, error: membershipError } = await supabase
          .from("business_users").select("business_id").eq("user_id", authData.user.id);
        if (membershipError) throw membershipError;
        const ids = [...new Set((memberships || []).map((row) => row.business_id as string).filter(Boolean))];
        if (!ids.length) throw new Error("Akun belum terhubung dengan bisnis. Hubungi administrator bisnis.");
        const { data: outletRows, error: outletError } = await supabase
          .from("otc_outlets").select("id,name,business_id").in("business_id", ids).eq("is_active", true).order("name");
        if (outletError) throw outletError;
        if (!alive) return;
        setSessionToken(token);
        setBusinessIds(ids);
        setBusinessId(ids[0]);
        const rows = (outletRows || []) as Outlet[];
        setOutlets(rows);
        const firstBusinessOutlets = rows.filter((row) => row.business_id === ids[0]);
        setSelectedOutletIds(firstBusinessOutlets.slice(0, 1).map((row) => row.id));
        setBusinessName("");
        setEmail(authData.user.email || "");
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : "Gagal memuat akun bisnis.");
      } finally {
        if (alive) setLoadingAccount(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const businessOutlets = useMemo(() => outlets.filter((outlet) => outlet.business_id === businessId), [outlets, businessId]);
  const outletCount = selectedOutletIds.length;
  const total = outletCount * PRICE[interval];
  const annualSaving = outletCount * 100000;
  const periodLabel = interval === "MONTHLY" ? "bulan" : "tahun";

  function changeBusiness(id: string) {
    setBusinessId(id);
    const first = outlets.find((outlet) => outlet.business_id === id);
    setSelectedOutletIds(first ? [first.id] : []);
    setPaymentLinks([]);
    setFailures([]);
  }

  function toggleOutlet(id: string) {
    setSelectedOutletIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
    setPaymentLinks([]);
    setFailures([]);
  }

  async function prepareSummary(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPaymentLinks([]);
    setFailures([]);
    if (!sessionToken) { setError("Sesi login tidak tersedia. Silakan masuk kembali."); return; }
    if (!businessId || !selectedOutletIds.length) { setError("Pilih minimal satu outlet."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/nortago/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({
          business_id: businessId,
          outlet_ids: selectedOutletIds,
          plan_code: interval === "MONTHLY" ? "NORTAGO_OUTLET_MONTHLY" : "NORTAGO_OUTLET_YEARLY",
          customer_name: ownerName,
          customer_email: email,
          customer_phone: phone,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok && response.status !== 207) throw new Error(result.message || result.error || "Gagal menyiapkan pembayaran.");
      setPaymentLinks(result.payments || []);
      setFailures(result.failures || []);
      if (!result.payments?.length) throw new Error(result.error || "Belum ada tautan pembayaran yang berhasil dibuat.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Terjadi kesalahan saat menyiapkan invoice.");
    } finally {
      setBusy(false);
    }
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
        <p>Pilih outlet yang akan diaktifkan dan periode langganan. Setiap outlet memiliki invoice dan masa aktif tersendiri.</p>
        <div className="subscribe-proof"><span>✓ Tagihan per outlet</span><span>✓ Kelola banyak outlet</span><span>✓ Pembayaran di muka</span></div>
      </section>

      <div className="subscribe-layout">
        <form className="subscribe-form" onSubmit={prepareSummary}>
          <section className="subscribe-section">
            <div className="subscribe-step">01</div>
            <div className="subscribe-section-content">
              <span className="eyebrow">BISNIS & OUTLET</span>
              <h2>Pilih outlet yang akan berlangganan</h2>
              {loadingAccount ? <p>Memuat akun bisnis…</p> : null}
              {!loadingAccount && !sessionToken ? <div className="error">{error || "Login diperlukan untuk melanjutkan."}</div> : null}
              {businessIds.length > 1 ? <label className="subscribe-select-label">Bisnis
                <select value={businessId} onChange={(e) => changeBusiness(e.target.value)}>
                  {businessIds.map((id) => <option key={id} value={id}>Bisnis · {id.slice(0, 8)}</option>)}
                </select>
              </label> : null}
              <p>Pilih satu atau beberapa outlet. Satu invoice dibuat untuk setiap outlet yang dipilih.</p>
              <div className="outlet-picker">
                {businessOutlets.length ? businessOutlets.map((outlet) => (
                  <label className="outlet-choice" key={outlet.id}>
                    <input type="checkbox" checked={selectedOutletIds.includes(outlet.id)} onChange={() => toggleOutlet(outlet.id)} />
                    <span><b>{outlet.name}</b><small>Langganan ditagihkan secara terpisah</small></span>
                  </label>
                )) : <p className="subscribe-hint">Belum ada outlet aktif pada bisnis ini. Buat outlet terlebih dahulu melalui Owner Dashboard.</p>}
              </div>
              <small className="subscribe-hint">Outlet terpilih: {outletCount}</small>
            </div>
          </section>

          <section className="subscribe-section">
            <div className="subscribe-step">02</div>
            <div className="subscribe-section-content">
              <span className="eyebrow">PERIODE TAGIHAN</span><h2>Pilih paket langganan</h2>
              <div className="plan-options">
                <button type="button" className={interval === "MONTHLY" ? "plan-option selected" : "plan-option"} onClick={() => setInterval("MONTHLY")}>
                  <span className="plan-radio">{interval === "MONTHLY" ? "●" : "○"}</span>
                  <span><b>Bulanan</b><small>Fleksibel, dibayar setiap bulan</small></span>
                  <strong>Rp50.000<small>/ outlet / bulan</small></strong>
                </button>
                <button type="button" className={interval === "YEARLY" ? "plan-option selected" : "plan-option"} onClick={() => setInterval("YEARLY")}>
                  <span className="plan-radio">{interval === "YEARLY" ? "●" : "○"}</span>
                  <span><b>Tahunan</b><small>Lebih hemat untuk penggunaan setahun</small></span>
                  <strong>Rp500.000<small>/ outlet / tahun</small><i>Hemat 16,7%</i></strong>
                </button>
              </div>
              {interval === "YEARLY" && outletCount > 0 ? <div className="saving-note">Penghematan {money(annualSaving)} untuk {outletCount} outlet dibandingkan pembayaran bulanan selama 12 bulan.</div> : null}
            </div>
          </section>

          <section className="subscribe-section">
            <div className="subscribe-step">03</div>
            <div className="subscribe-section-content">
              <span className="eyebrow">DATA PEMESAN</span><h2>Informasi penanggung jawab</h2>
              <p>Data ini diteruskan ke OrderHero untuk melengkapi invoice pembayaran.</p>
              <div className="subscribe-fields">
                <label>Nama bisnis<input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Nama bisnis" maxLength={120} /></label>
                <label>Nama penanggung jawab<input required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Nama lengkap" maxLength={120} /></label>
                <label>Nomor WhatsApp<input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" minLength={8} maxLength={20} /></label>
                <label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" maxLength={160} /></label>
              </div>
            </div>
          </section>
          {error ? <div className="error">{error}</div> : null}
          <button className="subscribe-submit" type="submit" disabled={busy || loadingAccount || !sessionToken || !outletCount}>
            {busy ? "Menyiapkan invoice…" : "Buat invoice & lanjut ke pembayaran →"}
          </button>
          <p className="subscribe-terms">Invoice dibuat oleh server berdasarkan harga resmi paket. Aktivasi hanya dilakukan setelah OrderHero mengonfirmasi pembayaran.</p>
        </form>

        <aside className="subscribe-summary">
          <span className="eyebrow">RINGKASAN BIAYA</span><h2>Pesanan langganan</h2>
          <div className="summary-row"><span>Outlet terpilih</span><b>{outletCount} outlet</b></div>
          <div className="summary-row"><span>Paket</span><b>{interval === "MONTHLY" ? "Bulanan" : "Tahunan"}</b></div>
          <div className="summary-row"><span>Harga per outlet</span><b>{money(PRICE[interval])}</b></div>
          <div className="summary-total"><span>Total per {periodLabel}</span><strong>{money(total)}</strong></div>
          <div className="summary-caption">Setiap outlet menerima invoice terpisah. Total di atas adalah gabungan nilai seluruh invoice.</div>
          {paymentLinks.length ? <div className="payment-links">
            <b>Invoice berhasil disiapkan</b>
            {paymentLinks.map((payment) => {
              const outlet = outlets.find((item) => item.id === payment.outlet_id);
              return <div className="payment-link-row" key={payment.invoice_no}>
                <span><b>{outlet?.name || "Outlet"}</b><small>{payment.invoice_no} · {money(payment.amount_idr)}</small></span>
                <a href={payment.payment_url} target="_blank" rel="noreferrer">Bayar →</a>
              </div>;
            })}
          </div> : null}
          {failures.length ? <div className="error">Sebagian outlet gagal diproses: {failures.length}. Periksa outlet yang belum mendapat invoice.</div> : null}
          <div className="payment-notice"><b>Pembayaran melalui OrderHero</b><p>Setiap tautan pembayaran diterbitkan oleh OrderHero LinkBayar. Jangan melakukan transfer di luar instruksi invoice resmi.</p><span>{paymentLinks.length ? "STATUS: MENUNGGU PEMBAYARAN" : "STATUS: SIAPKAN INVOICE"}</span></div>
        </aside>
      </div>
      <footer>NORTAGO Order · Sistem Pemesanan Digital Terintegrasi</footer>
    </main>
  );
}
