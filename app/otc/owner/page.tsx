"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Outlet = { id: string; name: string };
type Order = { id: string; outlet_id: string; order_no: string; customer_name: string; customer_whatsapp: string; fulfillment_type: string; payment_method: string; scheduled_at: string | null; delivery_address: string | null; delivery_note: string | null; total: number | string; status: string; payment_status: string; created_at: string };
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
  const [inboxOrders, setInboxOrders] = useState<(Order & { outlet_name: string })[]>([]);
  const [metrics, setMetrics] = useState({ count: 0, total: 0, outlets: 0 });
  const [inboxSearch, setInboxSearch] = useState("");
  const [inboxFilter, setInboxFilter] = useState("ALL");
  const [expandedOrderId, setExpandedOrderId] = useState("");
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
          supabase.from("otc_orders").select("id,outlet_id,order_no,customer_name,customer_whatsapp,fulfillment_type,payment_method,scheduled_at,delivery_address,delivery_note,total,status,payment_status,created_at").eq("business_id", businessId).gte("created_at", start.toISOString()).order("created_at", { ascending: false }).limit(100),
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
        setInboxOrders(orderRows.map((order) => ({ ...order, outlet_name: names.get(order.outlet_id) || order.outlet_id })));
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : "Gagal memuat Owner Dashboard.");
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [businessId]);
  const currentTime = useMemo(() => new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }), []);
  const filteredInboxOrders = useMemo(() => inboxOrders.filter((order) => {
    const q = inboxSearch.trim().toLowerCase();
    const matchesSearch = !q || [order.order_no, order.customer_name, order.customer_whatsapp, order.outlet_name].some((value) => (value || "").toLowerCase().includes(q));
    const matchesFilter = inboxFilter === "ALL" || (inboxFilter === "OPEN" && !["SUCCESS", "PO_SUCCESS", "COMPLETED", "CANCELLED"].includes(order.status)) || (inboxFilter === "PAID" && order.payment_status === "PAID") || (inboxFilter === "UNPAID" && order.payment_status !== "PAID");
    return matchesSearch && matchesFilter;
  }), [inboxOrders, inboxSearch, inboxFilter]);
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
      <section className="data-panel">
        <div className="section-toolbar"><div><span className="eyebrow">ORDER INBOX · READ ONLY</span><h2>Pesanan hari ini</h2></div><span className="status-badge">{filteredInboxOrders.length} pesanan</span></div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",margin:"12px 0"}}>
          <input aria-label="Cari pesanan" placeholder="Cari nomor order, customer, WhatsApp, outlet…" value={inboxSearch} onChange={(e)=>setInboxSearch(e.target.value)} style={{flex:"1 1 240px",padding:12,borderRadius:10,border:"1px solid #d6dce2",background:"var(--otc-input-bg, #fff)",color:"inherit"}} />
          <select aria-label="Filter pesanan" value={inboxFilter} onChange={(e)=>setInboxFilter(e.target.value)} style={{padding:12,borderRadius:10,border:"1px solid #d6dce2",background:"var(--otc-input-bg, #fff)",color:"inherit"}}>
            <option value="ALL">Semua pesanan</option><option value="OPEN">Belum selesai</option><option value="PAID">Sudah dibayar</option><option value="UNPAID">Belum dibayar</option>
          </select>
        </div>
        {filteredInboxOrders.length===0?<div className="muted">Tidak ada pesanan yang sesuai.</div>:<div className="table-wrap"><table><thead><tr><th>Order / Customer</th><th>Outlet</th><th>Mode</th><th>Total</th><th>Status</th><th>Detail</th></tr></thead><tbody>
          {filteredInboxOrders.map(order=><tr key={order.id}>
            <td><strong>{order.order_no}</strong><div>{order.customer_name}</div><small>{order.created_at?new Date(order.created_at).toLocaleString("id-ID"):""}</small></td>
            <td>{order.outlet_name}</td><td>{order.fulfillment_type}</td><td>{money(Number(order.total||0))}</td><td><span className="status-badge">{order.status} · {order.payment_status}</span></td>
            <td><button type="button" className="otc-secondary" onClick={()=>setExpandedOrderId(expandedOrderId===order.id?"":order.id)}>{expandedOrderId===order.id?"Tutup":"Lihat"}</button></td>
          </tr>)}
          {filteredInboxOrders.filter(order=>order.id===expandedOrderId).map(order=><tr key={order.id+"-detail"}><td colSpan={6}><div style={{padding:12,display:"grid",gap:6}}>
            <strong>Detail {order.order_no}</strong><div>WhatsApp: {order.customer_whatsapp||"—"}</div><div>Metode pembayaran: {order.payment_method||"—"}</div><div>Jadwal: {order.scheduled_at?new Date(order.scheduled_at).toLocaleString("id-ID"):"—"}</div><div>Alamat delivery: {order.delivery_address||"—"}</div><div>Catatan: {order.delivery_note||"—"}</div><small>Inbox ini read-only. Perubahan status belum tersedia sampai workflow server-side disiapkan.</small>
          </div></td></tr>)}
        </tbody></table></div>}
      </section>
    </>}
    <footer>Supported by NORTAGO · Order & Sales summary · Business ID: {businessId || "—"}</footer>
  </main>;
}
