"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const money = (n: any) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(n || 0));

export default function BOSControlTower() {
  const [data, setData] = useState<any>({});
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError("Sesi login tidak ditemukan."); return; }

    const { data: bu, error: buError } = await supabase
      .from("business_users").select("business_id").eq("user_id", auth.user.id).limit(1).maybeSingle();

    if (buError || !bu?.business_id) { setError(buError?.message || "Business belum terhubung."); return; }

    const id = bu.business_id;
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const [biz, orders, production, stock, capital, csr, pnl] = await Promise.all([
      supabase.from("businesses").select("name").eq("id", id).maybeSingle(),
      supabase.from("otc_orders").select("id,order_no,status,total,payment_status,fulfillment_type,created_at").eq("business_id", id).gte("created_at", start.toISOString()).order("created_at", { ascending: false }).limit(20),
      supabase.from("proc_production_orders").select("id,order_id,status,priority,blocked_reason").eq("business_id", id).in("status", ["QUEUED","IN_PROGRESS","QC_PENDING","READY","BLOCKED"]).limit(20),
      supabase.from("proc_stock").select("item_id,outlet_id,qty").eq("business_id", id).limit(100),
      supabase.from("nortago_owner_capital_summary").select("*").eq("business_id", id).maybeSingle(),
      supabase.from("nortago_csr_summary").select("*").eq("business_id", id).maybeSingle(),
      supabase.from("nortago_pnl_summary").select("*").eq("business_id", id).maybeSingle()
    ]);

    if (orders.error) throw orders.error;
    if (production.error) throw production.error;
    if (stock.error) throw stock.error;

    setData({ business: biz.data, orders: orders.data || [], production: production.data || [], stock: stock.data || [], capital: capital.data, csr: csr.data, pnl: pnl.data });
  }

  useEffect(() => { load().catch(e => setError(e.message || "Gagal memuat Control Tower.")); }, []);

  const orders = data.orders || [];
  const production = data.production || [];
  const stock = data.stock || [];
  const todayRevenue = orders.filter((o: any) => ["SUCCESS","PO_SUCCESS"].includes(o.status)).reduce((s: number, o: any) => s + Number(o.total || 0), 0);
  const openOrders = orders.filter((o: any) => !["SUCCESS","PO_SUCCESS"].includes(o.status)).length;
  const blocked = production.filter((p: any) => p.status === "BLOCKED").length;

  if (error) return <main style={{ padding: 32, background: "#f8fafc", minHeight: "100vh" }}><h1>NORTAGO Control Tower</h1><p>{error}</p><button onClick={load}>Retry</button></main>;

  return <main style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", padding: 28 }}>
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800, letterSpacing: ".12em" }}>NORTAGO FULL BOS</div>
        <h1>{data.business?.name || "Business"} — Owner Control Tower</h1>
        <p style={{ color: "#64748b" }}>System of Record · Control · Intelligence · Visibility</p>
        <button onClick={load} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff" }}>Refresh</button>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
        <Card title="Revenue Hari Ini" value={money(todayRevenue)} />
        <Card title="Open Orders" value={String(openOrders)} />
        <Card title="Production Queue" value={String(production.length)} />
        <Card title="Blocked Production" value={String(blocked)} />
        <Card title="Stock Records" value={String(stock.length)} />
        <Card title="Total Investment" value={money(data.capital?.total_investment)} />
        <Card title="Net Profit" value={money(Number(data.pnl?.revenue || 0) - Number(data.pnl?.cogs || 0) - Number(data.pnl?.opex || 0) - Number(data.pnl?.tax || 0))} />
        <Card title="CSR 2.5%" value={money(data.csr?.csr_allocated)} />
      </section>

      <section style={{ marginTop: 18, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20 }}>
        <h2>Live Operations</h2>
        {production.length === 0 ? <p style={{ color: "#64748b" }}>Tidak ada production queue aktif.</p> :
          production.map((p: any) => <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: 12, borderTop: "1px solid #eef2f7" }}><span>{p.order_id?.slice(0, 8)}</span><b>{p.status}</b></div>)}
      </section>

      <section style={{ marginTop: 18, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20 }}>
        <h2>Today's Orders</h2>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th align="left">Order</th><th align="left">Status</th><th align="left">Payment</th><th align="right">Total</th></tr></thead>
          <tbody>{orders.map((o: any) => <tr key={o.id}><td>{o.order_no}</td><td>{o.status}</td><td>{o.payment_status}</td><td align="right">{money(o.total)}</td></tr>)}</tbody>
        </table></div>
      </section>
    </div>
  </main>;
}

function Card({ title, value }: { title: string; value: string }) {
  return <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 18 }}><small style={{ color: "#64748b" }}>{title}</small><div style={{ fontSize: 25, fontWeight: 800, marginTop: 7 }}>{value}</div></div>;
}
