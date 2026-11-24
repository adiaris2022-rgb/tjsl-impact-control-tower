"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { INBOX_PAGE_SIZE, buildInboxCursorFilter, cursorFromPage, type InboxCursor } from "./inbox-pagination.mjs";
import { fetchAllSummaryRows, SUMMARY_PAGE_SIZE } from "./summary-pagination.mjs";

type Outlet = { id: string; name: string };
type Order = { id: string; outlet_id: string; order_no: string; customer_name: string; customer_whatsapp: string; fulfillment_type: string; payment_method: string; scheduled_at: string | null; delivery_address: string | null; delivery_note: string | null; total: number | string; payment_option?: "FULL" | "DP"; payment_amount_due?: number | string; payment_balance_due?: number | string; status: string; payment_status: string; created_at: string };
async function getSupabase() {
  const response = await fetch("/api/supabase-config", { cache: "no-store" });
  const config = await response.json().catch(() => ({}));
  if (!response.ok || !config.url || !config.key) throw new Error(config.error || "Konfigurasi Supabase tidak tersedia.");
  return createClient(config.url, config.key);
}
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
type LifecycleAction = { label: string; nextStatus: string };
type AuditEvent = { id: number; from_status: string; to_status: string; note: string | null; created_at: string; actor_user_id: string };
function lifecycleActions(order: Order): LifecycleAction[] {
  switch (order.status) {
    case "NEW":
    case "PAID":
      return [{ label: "Jadwalkan", nextStatus: "SCHEDULED" }, { label: "Mulai proses", nextStatus: "PROCESSING" }];
    case "SCHEDULED":
      return [{ label: "Mulai proses", nextStatus: "PROCESSING" }, { label: "Perlu pemeriksaan", nextStatus: "FULFILLMENT_CHECK" }];
    case "PROCESSING":
      return [{ label: "Tandai siap", nextStatus: "READY" }, { label: "Periksa order", nextStatus: "FULFILLMENT_CHECK" }, { label: "Ada kendala", nextStatus: "FULFILLMENT_ISSUE" }];
    case "FULFILLMENT_CHECK":
      return [{ label: "Tandai siap", nextStatus: "READY" }, { label: "Ada kendala", nextStatus: "FULFILLMENT_ISSUE" }];
    case "FULFILLMENT_ISSUE":
      return [{ label: "Lanjutkan proses", nextStatus: "PROCESSING" }];
    case "READY":
      return order.fulfillment_type === "DELIVERY"
        ? [{ label: "Serahkan ke kurir", nextStatus: "HANDED_OVER_TO_DELIVERY" }]
        : order.fulfillment_type === "TAKE_AWAY" || order.fulfillment_type === "PRE_ORDER"
          ? [{ label: "Siap diambil", nextStatus: "WAITING_PICKUP" }]
          : [];
    case "WAITING_PICKUP":
      return order.fulfillment_type === "TAKE_AWAY" || order.fulfillment_type === "PRE_ORDER"
        ? [{ label: "Pickup terverifikasi", nextStatus: "PICKUP_VERIFIED" }]
        : [];
    case "PICKUP_VERIFIED":
      return order.fulfillment_type === "TAKE_AWAY" || order.fulfillment_type === "PRE_ORDER"
        ? [{ label: "Selesaikan order", nextStatus: "SUCCESS" }]
        : [];
    case "HANDED_OVER_TO_DELIVERY":
      return order.fulfillment_type === "DELIVERY" ? [{ label: "Tandai selesai", nextStatus: "SUCCESS" }] : [];
    case "SUCCESS":
      return order.fulfillment_type === "PRE_ORDER" ? [{ label: "Finalisasi Pre-Order", nextStatus: "PO_SUCCESS" }] : [];
    default:
      return [];
  }
}

export default function Owner() {
  const [businessIds, setBusinessIds] = useState<string[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [rows, setRows] = useState<{ outlet: string; transactions: number; nominal: number; partialDue: number; balanceDue: number; attention: number }[]>([]);
  const [inboxOrders, setInboxOrders] = useState<(Order & { outlet_name: string })[]>([]);
  const [metrics, setMetrics] = useState({ count: 0, total: 0, outlets: 0 });
  const [inboxSearch, setInboxSearch] = useState("");
  const [inboxFilter, setInboxFilter] = useState("ALL");
  const [expandedOrderId, setExpandedOrderId] = useState("");
  const [orderRefresh, setOrderRefresh] = useState(0);
  const [inboxCursor, setInboxCursor] = useState<InboxCursor | null>(null);
  const [inboxNextCursor, setInboxNextCursor] = useState<InboxCursor | null>(null);
  const [inboxHasMore, setInboxHasMore] = useState(false);
  const [lifecycleNote, setLifecycleNote] = useState("");
  const [busyOrderId, setBusyOrderId] = useState("");
  const [actionError, setActionError] = useState("");
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditError, setAuditError] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
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
        const inboxQuery = supabase.from("otc_orders").select("id,outlet_id,order_no,customer_name,customer_whatsapp,fulfillment_type,payment_method,scheduled_at,delivery_address,delivery_note,total,payment_option,payment_amount_due,payment_balance_due,status,payment_status,created_at").eq("business_id", businessId).gte("created_at", start.toISOString()).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(INBOX_PAGE_SIZE);
        const startIso = start.toISOString();
        const summaryPromise = fetchAllSummaryRows((cursor, pageSize) => {
          let query = supabase.from("otc_orders").select("id,outlet_id,total,payment_option,payment_amount_due,payment_balance_due,status,payment_status,created_at")
            .eq("business_id", businessId).gte("created_at", startIso)
            .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(pageSize);
          return cursor ? query.or(buildInboxCursorFilter(cursor)) : query;
        });
        const [{ data: inbox, error: inboxError }, { data: outlets, error: outletError }, summaryRows] = await Promise.all([
          inboxCursor ? inboxQuery.or(buildInboxCursorFilter(inboxCursor)) : inboxQuery,
          supabase.from("otc_outlets").select("id,name").eq("business_id", businessId),
          summaryPromise,
        ]);
        if (inboxError) throw inboxError;
        if (outletError) throw outletError;
        if (!alive) return;
        const outletRows = (outlets || []) as Outlet[];
        const names = new Map(outletRows.map((outlet) => [outlet.id, outlet.name]));
        const orderRows = summaryRows as Order[];
        const inboxRows = (inbox || []) as Order[];
        const grouped = [...new Set(orderRows.map((order) => order.outlet_id))].map((id) => {
          const matching = orderRows.filter((order) => order.outlet_id === id);
          return { outlet: names.get(id) || id, transactions: matching.length,
            nominal: matching.filter((order) => order.payment_status === "PAID" && order.payment_option !== "DP").reduce((sum, order) => sum + Number(order.total || 0), 0),
            partialDue: matching.filter((order) => order.payment_option === "DP" && order.payment_status !== "PAID").reduce((sum, order) => sum + Number(order.payment_amount_due || 0), 0),
            balanceDue: matching.filter((order) => order.payment_option === "DP" && order.payment_status !== "PAID").reduce((sum, order) => sum + Number(order.payment_balance_due || 0), 0),
            attention: matching.filter((order) => !["SUCCESS", "PO_SUCCESS"].includes(order.status)).length,
          };
        }).sort((a, b) => b.nominal - a.nominal);
        setRows(grouped);
        setMetrics({ count: orderRows.length, total: orderRows.filter((order) => order.payment_status === "PAID" && order.payment_option !== "DP").reduce((sum, order) => sum + Number(order.total || 0), 0), outlets: outletRows.length });
        const mappedInboxRows = inboxRows.map((order) => ({ ...order, outlet_name: names.get(order.outlet_id) || order.outlet_id }));
        const nextCursor = cursorFromPage(inboxRows);
        setInboxNextCursor(nextCursor);
        setInboxHasMore(Boolean(nextCursor));
        if (!inboxCursor) setInboxOrders(mappedInboxRows);
        else setInboxOrders((previous) => {
          const merged = new Map(previous.map((order) => [order.id, order]));
          mappedInboxRows.forEach((order) => merged.set(order.id, order));
          return Array.from(merged.values());
        });
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : "Gagal memuat Owner Dashboard.");
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [businessId, orderRefresh, inboxCursor]);
  useEffect(() => {
    if (!businessId || !expandedOrderId) { setAuditEvents([]); return; }
    let alive = true;
    setAuditLoading(true); setAuditError("");
    (async () => {
      try {
        const supabase = await getSupabase();
        const { data, error: auditQueryError } = await supabase.from("nortago_order_status_audit")
          .select("id,from_status,to_status,note,created_at,actor_user_id")
          .eq("business_id", businessId).eq("order_id", expandedOrderId)
          .order("created_at", { ascending: false }).limit(20);
        if (auditQueryError) throw auditQueryError;
        if (alive) setAuditEvents((data || []) as AuditEvent[]);
      } catch (cause) {
        if (alive) setAuditError(cause instanceof Error ? cause.message : "Riwayat status belum dapat dimuat.");
      } finally { if (alive) setAuditLoading(false); }
    })();
    return () => { alive = false; };
  }, [businessId, expandedOrderId, orderRefresh]);
  const currentTime = useMemo(() => new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }), []);
  const filteredInboxOrders = useMemo(() => inboxOrders.filter((order) => {
    const q = inboxSearch.trim().toLowerCase();
    const matchesSearch = !q || [order.order_no, order.customer_name, order.customer_whatsapp, order.outlet_name].some((value) => (value || "").toLowerCase().includes(q));
    const matchesFilter = inboxFilter === "ALL" || (inboxFilter === "OPEN" && !["SUCCESS", "PO_SUCCESS", "COMPLETED", "CANCELLED"].includes(order.status)) || (inboxFilter === "PAID" && order.payment_status === "PAID") || (inboxFilter === "UNPAID" && order.payment_status !== "PAID");
    return matchesSearch && matchesFilter;
  }), [inboxOrders, inboxSearch, inboxFilter]);
  async function handleStatusUpdate(order: Order, nextStatus: string) {
    if (busyOrderId) return;
    setBusyOrderId(order.id); setActionError("");
    try {
      const supabase = await getSupabase();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
      const { error: rpcError } = await supabase.rpc("nortago_update_order_status", {
        p_order_id: order.id,
        p_next_status: nextStatus,
        p_note: lifecycleNote.trim() || null,
      });
      if (rpcError) throw rpcError;
      setLifecycleNote("");
      setInboxCursor(null);
      setInboxNextCursor(null);
      setInboxHasMore(false);
      setOrderRefresh((value) => value + 1);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Gagal memperbarui status order.");
    } finally { setBusyOrderId(""); }
  }
  if (loading && !businessId) return <main className="otc-page"><div className="loading">Memuat Owner Dashboard…</div></main>;
  if (error && !businessId) return <main className="otc-page"><div className="info-box wide">{error}</div></main>;
  return <main className="otc-page">
    <header className="otc-head"><div><b>NORTAGO Order</b><small>Owner Dashboard · Order & Sales</small></div>
      <nav style={{ display: "flex", gap: 12, alignItems: "center" }}><Link href="/otc/owner/catalog">Kelola Produk & Jasa</Link><Link href="/otc/owner/subscriptions">Langganan Outlet</Link><Link href="/otc">Home</Link></nav>
    </header>
    <section className="customer-title"><span>ORDER & SALES</span><h1>Owner Dashboard</h1><p>Ringkasan transaksi dan penjualan untuk bisnis yang dipilih.</p>
      {businessIds.length > 1 ? <label className="business-switcher">Pilih bisnis
        <select value={businessId} onChange={(event) => { setBusinessId(event.target.value); setInboxCursor(null); setInboxNextCursor(null); setInboxOrders([]); setInboxHasMore(false); setExpandedOrderId(""); setActionError(""); setAuditEvents([]); }}>{businessIds.map((id) => <option key={id} value={id}>Bisnis · {id.slice(0, 8)}</option>)}</select>
      </label> : null}
    </section>
    {error ? <div className="info-box wide">{error}</div> : null}
    {loading ? <div className="loading">Memuat data bisnis…</div> : <>
      <section className="metric-grid otc-metrics">{[[String(metrics.count), "Transaksi hari ini"], [money(metrics.total), "Pelunasan terverifikasi"], [String(metrics.outlets), "Outlet"], [currentTime, "Waktu laporan"]].map(([value, label]) => <article key={label}><small>{label}</small><strong>{value}</strong></article>)}</section>
      <section className="data-panel"><div className="section-toolbar"><div><span className="eyebrow">TODAY BY OUTLET</span><h2>Ringkasan outlet</h2></div><Link className="otc-secondary" href="/otc/owner-report">Lihat laporan per jam</Link></div>
        {rows.length === 0 ? <div className="muted">Belum ada order hari ini.</div> : <div className="table-wrap"><table><thead><tr><th>Outlet</th><th>Transaksi</th><th>Pelunasan terverifikasi</th><th>DP pending</th><th>Sisa tagihan DP</th><th>Attention</th></tr></thead><tbody>{rows.map((row) => <tr key={row.outlet}><td>{row.outlet}</td><td>{row.transactions}</td><td>{money(row.nominal)}</td><td>{money(row.partialDue)}</td><td>{money(row.balanceDue)}</td><td><span className="status-badge">{row.attention} open</span></td></tr>)}</tbody></table></div>}
      </section>
      <section className="data-panel">
        <div className="section-toolbar"><div><span className="eyebrow">ORDER INBOX · STATUS MANAGEMENT</span><h2>Pesanan hari ini</h2></div><span className="status-badge">{filteredInboxOrders.length} cocok · {inboxOrders.length} dimuat</span></div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",margin:"12px 0"}}>
          <input aria-label="Cari pesanan" placeholder="Cari nomor order, customer, WhatsApp, outlet…" value={inboxSearch} onChange={(e)=>setInboxSearch(e.target.value)} style={{flex:"1 1 240px",padding:12,borderRadius:10,border:"1px solid #d6dce2",background:"var(--otc-input-bg, #fff)",color:"inherit"}} />
          <select aria-label="Filter pesanan" value={inboxFilter} onChange={(e)=>setInboxFilter(e.target.value)} style={{padding:12,borderRadius:10,border:"1px solid #d6dce2",background:"var(--otc-input-bg, #fff)",color:"inherit"}}>
            <option value="ALL">Semua pesanan</option><option value="OPEN">Belum selesai</option><option value="PAID">Sudah dibayar</option><option value="UNPAID">Belum dibayar</option>
          </select>
        </div>
        {filteredInboxOrders.length===0?<div className="muted">Tidak ada pesanan yang sesuai.</div>:<div className="table-wrap"><table><thead><tr><th>Order / Customer</th><th>Outlet</th><th>Mode</th><th>Total</th><th>Status</th><th>Detail</th></tr></thead><tbody>
          {filteredInboxOrders.map(order=><tr key={order.id}>
            <td><strong>{order.order_no}</strong><div>{order.customer_name}</div><small>{order.created_at?new Date(order.created_at).toLocaleString("id-ID"):""}</small></td>
            <td>{order.outlet_name}</td><td>{order.fulfillment_type}</td><td>{money(Number(order.total||0))}{order.payment_option === "DP" ? <small style={{display:"block"}}>Tagihan awal {money(Number(order.payment_amount_due||0))} · Sisa {money(Number(order.payment_balance_due||0))}</small> : null}</td><td><span className="status-badge">{order.status} · {order.payment_status}</span></td>
            <td><button type="button" className="otc-secondary" onClick={()=>setExpandedOrderId(expandedOrderId===order.id?"":order.id)}>{expandedOrderId===order.id?"Tutup":"Lihat"}</button></td>
          </tr>)}
          {filteredInboxOrders.filter(order=>order.id===expandedOrderId).map(order=><tr key={order.id+"-detail"}><td colSpan={6}><div style={{padding:12,display:"grid",gap:6}}>
            <strong>Detail {order.order_no}</strong><div>WhatsApp: {order.customer_whatsapp||"—"}</div><div>Metode pembayaran: {order.payment_method||"—"}</div><div>Skema pembayaran: {order.payment_option === "DP" ? "DP" : "Pembayaran penuh"}</div><div>Tagihan awal: {money(Number(order.payment_amount_due ?? order.total))}</div>{Number(order.payment_balance_due||0)>0?<div>Sisa tagihan DP: {money(Number(order.payment_balance_due))}</div>:null}<div>Jadwal: {order.scheduled_at?new Date(order.scheduled_at).toLocaleString("id-ID"):"—"}</div><div>Alamat delivery: {order.delivery_address||"—"}</div><div>Catatan pelanggan: {order.delivery_note||"—"}</div>
            <div style={{marginTop:12,display:"grid",gap:8}}>
              <label style={{display:"grid",gap:5}}>Catatan tindakan (opsional, maks. 500 karakter)
                <textarea value={lifecycleNote} maxLength={500} onChange={(e)=>setLifecycleNote(e.target.value)} rows={2} placeholder="Catatan untuk riwayat status…" style={{width:"100%",padding:10,borderRadius:9,border:"1px solid #d6dce2",background:"var(--otc-input-bg, #fff)",color:"inherit"}}/>
              </label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {lifecycleActions(order).map(action=><button key={action.nextStatus} type="button" className="otc-secondary" disabled={Boolean(busyOrderId)} onClick={()=>handleStatusUpdate(order,action.nextStatus)}>{busyOrderId===order.id? "Memproses…" : action.label}</button>)}
              </div>
              {actionError && expandedOrderId===order.id ? <div className="info-box">{actionError}</div> : null}
              <small>Setiap perubahan status divalidasi oleh server dan dicatat dalam audit trail. Status pembayaran tidak diubah oleh tindakan ini.</small>
            </div>
            <div style={{marginTop:14}}>
              <strong>Riwayat status</strong>
              {auditLoading?<div className="muted">Memuat riwayat…</div>:auditError?<div className="muted">Riwayat belum dapat ditampilkan: {auditError}</div>:auditEvents.length===0?<div className="muted">Belum ada perubahan status tercatat.</div>:<ul style={{paddingLeft:18,marginTop:8}}>{auditEvents.map(event=><li key={event.id} style={{marginBottom:8}}><strong>{event.from_status} → {event.to_status}</strong><div>{new Date(event.created_at).toLocaleString("id-ID")}</div>{event.note?<div>Catatan: {event.note}</div>:null}</li>)}</ul>}
            </div>
          </div></td></tr>)}
        </tbody></table></div>}
        {inboxHasMore ? <button type="button" className="otc-secondary" disabled={loading || !inboxNextCursor} onClick={() => inboxNextCursor && setInboxCursor(inboxNextCursor)}>Muat 100 order berikutnya</button> : <small className="muted">Semua order hari ini telah dimuat.</small>}
        <small className="muted" style={{display:"block",marginTop:8}}>Pencarian dan filter mencakup order yang sudah dimuat. Muat halaman berikutnya untuk mencari order yang lebih lama.</small>
      </section>
    </>}
    <footer>Supported by NORTAGO · Order & Sales summary · Business ID: {businessId || "—"}</footer>
  </main>;
}
