'use client';

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Row = Record<string, any>;

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const money = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);

function Card({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 20, boxShadow: "0 6px 24px rgba(15,23,42,.05)" }}>
      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{value}</div>
      {note && <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>{note}</div>}
    </div>
  );
}

export default function BOSControlTower() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("NORTAGO");
  const [orders, setOrders] = useState<Row[]>([]);
  const [production, setProduction] = useState<Row[]>([]);
  const [stock, setStock] = useState<Row[]>([]);
  const [capital, setCapital] = useState<Row | null>(null);
  const [csr, setCsr] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Sesi login tidak ditemukan.");
      return;
    }

    const { data: bu, error: buError } = await supabase
      .from("business_users")
      .select("business_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (buError || !bu?.business_id) {
      setError(buError?.message ?? "Business belum terhubung ke user.");
      return;
    }

    const id = bu.business_id;
    setBusinessId(id);

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

    const [biz, ord, prod, st, cap, csrData] = await Promise.all([
      supabase.from("businesses").select("name").eq("id", id).maybeSingle(),
      supabase.from("otc_orders")
        .select("id, order_no, status, total, payment_status, fulfillment_type, created_at")
        .eq("business_id", id)
        .gte("created_at", start)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase.from("proc_production_orders")
        .select("id, order_id, status, priority, queued_at, ready_at, blocked_reason")
        .eq("business_id", id)
        .in("status", ["QUEUED", "IN_PROGRESS", "QC_PENDING", "READY", "BLOCKED"])
        .order("queued_at", { ascending: true })
        .limit(12),
      supabase.from("proc_stock")
        .select("item_id, outlet_id, qty, proc_items(name, unit, reorder_point)")
        .eq("business_id", id)
        .limit(100),
      supabase.from("nortago_owner_capital_summary").select("*").eq("business_id", id).maybeSingle(),
      supabase.from("nortago_csr_summary").select("*").eq("business_id", id).maybeSingle(),
    ]);

    if (biz.data?.name) setBusinessName(biz.data.name);
    if (ord.error) throw ord.error;
    if (prod.error) throw prod.error;
    if (st.error) throw st.error;
    if (cap.error) throw cap.error;
    if (csrData.error) throw csrData.error;

    setOrders(ord.data ?? []);
    setProduction(prod.data ?? []);
    setStock(st.data ?? []);
    setCapital(cap.data ?? null);
    setCsr(csrData.data ?? null);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message ?? "Gagal memuat Control Tower."));
  }, []);

  const todayRevenue = useMemo(
    () => orders.filter(o => ["SUCCESS", "PO_SUCCESS"].includes(o.status)).reduce((s, o) => s + Number(o.total || 0), 0),
    [orders]
  );
  const openOrders = orders.filter(o => !["SUCCESS", "PO_SUCCESS"].includes(o.status)).length;
  const blockedProduction = production.filter(p => p.status === "BLOCKED").length;
  const lowStock = stock.filter(s => Number(s.qty) <= Number(s.proc_items?.reorder_point || 0)).length;

  if (error) {
    return <main style={{ minHeight: "100vh", padding: 32, background: "#f8fafc" }}><div style={{ maxWidth: 720, margin: "80px auto", background: "#fff", borderRadius: 20, padding: 28, border: "1px solid #e5e7eb" }}><h1>NORTAGO Control Tower</h1><p>{error}</p></div></main>;
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", padding: 28 }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, marginBottom: 28 }}>
          <div>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800, letterSpacing: ".12em" }}>NORTAGO FULL BOS</div>
            <h1 style={{ fontSize: 34, margin: "6px 0 0", fontWeight: 850 }}>{businessName} — Owner Control Tower</h1>
            <p style={{ color: "#64748b", marginTop: 8 }}>System of Record · Control · Intelligence · Visibility</p>
          </div>
          <button onClick={load} style={{ border: "1px solid #cbd5e1", background: "#fff", padding: "10px 16px", borderRadius: 12, fontWeight: 700 }}>Refresh</button>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
          <Card title="Revenue Hari Ini" value={money(todayRevenue)} note="SUCCESS + PO_SUCCESS" />
          <Card title="Open Orders" value={String(openOrders)} note="Belum selesai" />
          <Card title="Production Queue" value={String(production.length)} note="Aktif sekarang" />
          <Card title="Blocked Production" value={String(blockedProduction)} note="Perlu tindakan" />
          <Card title="Low Stock" value={String(lowStock)} note="≤ reorder point" />
          <Card title="Total Investment" value={money(Number(capital?.total_investment || 0))} note="Capital ledger" />
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, marginTop: 18 }}>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 20 }}>
            <h2 style={{ marginTop: 0 }}>Live Operations</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {production.length === 0 && <div style={{ color: "#64748b" }}>Tidak ada production queue aktif.</div>}
              {production.map(p => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: 13, border: "1px solid #eef2f7", borderRadius: 12 }}>
                  <div><strong>{p.order_id?.slice(0, 8)}</strong><div style={{ color: "#64748b", fontSize: 12 }}>{p.priority} · {p.status}</div></div>
                  <span style={{ fontWeight: 800 }}>{p.status === "BLOCKED" ? "BLOCKED" : "ACTIVE"}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 20 }}>
            <h2 style={{ marginTop: 0 }}>CSR</h2>
            <div style={{ display: "grid", gap: 14 }}>
              <div><small>Net Profit After Tax</small><strong style={{ display: "block", fontSize: 22 }}>{money(Number(csr?.net_profit_after_tax || 0))}</strong></div>
              <div><small>Allocated 2.5%</small><strong style={{ display: "block", fontSize: 22 }}>{money(Number(csr?.csr_allocated || 0))}</strong></div>
              <div><small>Spent</small><strong style={{ display: "block", fontSize: 22 }}>{money(Number(csr?.csr_spent || 0))}</strong></div>
              <div><small>Remaining</small><strong style={{ display: "block", fontSize: 22 }}>{money(Number(csr?.csr_remaining || 0))}</strong></div>
            </div>
          </div>
        </section>

        <section style={{ marginTop: 18, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>Today's Orders</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Order","Status","Fulfillment","Payment","Total"].map(h => <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #e5e7eb", fontSize: 12, color: "#64748b" }}>{h}</th>)}</tr></thead>
              <tbody>{orders.map(o => <tr key={o.id}>
                <td style={{ padding: 10, fontWeight: 700 }}>{o.order_no}</td>
                <td style={{ padding: 10 }}>{o.status}</td>
                <td style={{ padding: 10 }}>{o.fulfillment_type}</td>
                <td style={{ padding: 10 }}>{o.payment_status}</td>
                <td style={{ padding: 10, fontWeight: 700 }}>{money(Number(o.total || 0))}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>

        <section style={{ marginTop: 18, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 20 }}>
          <h2 style={{ marginTop: 0 }}>Stock Risk</h2>
          {lowStock === 0 ? <p style={{ color: "#64748b" }}>Tidak ada item di bawah reorder point.</p> :
            <div style={{ display: "grid", gap: 8 }}>{stock.filter(s => Number(s.qty) <= Number(s.proc_items?.reorder_point || 0)).slice(0, 20).map(s =>
              <div key={s.item_id + s.outlet_id} style={{ display: "flex", justifyContent: "space-between", padding: 10, borderBottom: "1px solid #f1f5f9" }}>
                <span>{s.proc_items?.name ?? s.item_id}</span><strong>{s.qty} {s.proc_items?.unit ?? ""}</strong>
              </div>
            )}</div>}
        </section>
      </div>
    </main>
  );
}
