"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Outlet = { id: string; name: string };
type Order = { id: string; outlet_id: string; total: number | string; status: string; payment_status: string; created_at: string };
async function getSupabase() {
  const response = await fetch("/api/supabase-config", { cache: "no-store" });
  const config = await response.json().catch(() => ({}));
  if (!response.ok || !config.url || !config.key) throw new Error(config.error || "Konfigurasi Supabase tidak tersedia.");
  return createClient(config.url, config.key);
}
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);

export default function Owner() {
  const [businessIds, setBusinessIds] = useState<string[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [rows, setRows] = useState<{ outlet: string; transactions: number; nominal: number; attention: number }[]>([]);
  const [metrics, setMetrics] = useState({ count: 0, total: 0, outlets: 0 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = await getSupabase();
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Sesi login tidak ditemukan.");
        const { data, error: membershipError } = await supabase.from("business_users").select("business_id").eq("user_id", auth.user.id);
        if (membershipError) throw membershipError;
        const ids = [...new Set((data || []).map((row) => row.business_id as string).filter(Boolean))];
        if (!ids.length) throw new Error("Akun ini belum terhubung dengan bisnis.");
        if (alive) { setBusinessIds(ids); setBusinessId(ids[0]); }
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : "Gagal memuat akun bisnis.");
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!businessId) return;
    let alive = true;
    setLoading(true); setError("");
    (async () => {
      try {
        const supabase = await getSupabase();
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const [{ data: orders, error: orderError }, { data: outlets, error: outletError }] = await Promise.all([
          supabase.from("otc_orders").select("id,outlet_id,total,status,payment_status,created_at").eq("business_id", businessId).gte("created_at", start.toISOString()),
          supabase.from("otc_outlets").select("id,name").eq("business_id", businessId),
        ]);
        if (orderError) throw orderError;
        if (outletError) throw outletError;
        if (!alive) return;
        const outletRows = (outlets || []) as Outlet[];
        const names = new Map(outletRows.map((outlet) => [outlet.id, outlet.name]));
        const orderRows = (orders || []) as Order[];
        const grouped = [...new Set(orderRows.map((order) => order.outlet_id))].map((id) => {
          const matching = orderRows.filter((order) => order.outlet_id === id);
          return { outlet: names.get(id) || id, transactions: matching.length,
            nominal: matching.filter((order) => order.payment_status === "PAID").reduce((sum, order) => sum + Number(order.total || 0), 0),
            attention: matching.filter((order) => !["SUCCESS", "PO_SUCCESS"].includes(order.status)).length,
          };
        }).sort((a, b) => b.nominal - a.nominal);
        setRows(grouped);
        setMetrics({ count: orderRows.length, total: orderRows.filter((order) => order.payment_status === "PAID").reduce((sum, order) => sum + Number(order.total || 0), 0), outlets: outletRows.length });
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : "Gagal memuat Owner Dashboard.");
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [businessId]);
  const currentTime = useMemo(() => new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }), []);
  if (loading && !businessId) return <main className="otc-page"><div className="loading">Memuat Owner Dashboard…</div></main>;
  if (error && !businessId) return <main className="otc-page"><div className="info-box wide">{error}</div></main>;
  return <main className="otc-page">
    <header className="otc-head"><div><b>NORTAGO Order</b><small>Owner Dashboard · Order & Sales</small></div>
      <nav style={{ display: "flex", gap: 12, alignItems: "center" }}><Link href="/otc/owner/subscriptions">Langganan Outlet</Link><Link href="/otc">Home</Link></nav>
    </header>
    <section className="customer-title"><span>ORDER & SALES</span><h1>Owner Dashboard</h1><p>Ringkasan transaksi dan penjualan untuk bisnis yang dipilih.</p>
      {businessIds.length > 1 ? <label className="business-switcher">Pilih bisnis
        <select value={businessId} onChange={(event) => setBusinessId(event.target.value)}>{businessIds.map((id) => <option key={id} value={id}>Bisnis · {id.slice(0, 8)}</option>)}</select>
      </label> : null}
    </section>
    {error ? <div className="info-box wide">{error}</div> : null}
    {loading ? <div className="loading">Memuat data bisnis…</div> : <>
      <section className="metric-grid otc-metrics">{[[String(metrics.count), "Transaksi hari ini"], [money(metrics.total), "Pembayaran terverifikasi"], [String(metrics.outlets), "Outlet"], [currentTime, "Waktu laporan"]].map(([value, label]) => <article key={label}><small>{label}</small><strong>{value}</strong></article>)}</section>
      <section className="data-panel"><div className="section-toolbar"><div><span className="eyebrow">TODAY BY OUTLET</span><h2>Ringkasan outlet</h2></div><Link className="otc-secondary" href="/otc/owner-report">Lihat laporan per jam</Link></div>
        {rows.length === 0 ? <div className="muted">Belum ada order hari ini.</div> : <div className="table-wrap"><table><thead><tr><th>Outlet</th><th>Transaksi</th><th>Pembayaran terverifikasi</th><th>Attention</th></tr></thead><tbody>{rows.map((row) => <tr key={row.outlet}><td>{row.outlet}</td><td>{row.transactions}</td><td>{money(row.nominal)}</td><td><span className="status-badge">{row.attention} open</span></td></tr>)}</tbody></table></div>}
      </section>
    </>}
    <footer>Supported by NORTAGO · Order & Sales summary · Business ID: {businessId || "—"}</footer>
  </main>;
}
