"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"
);

const money = (n: any) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

function Card({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 18 }}>
      <small style={{ color: "#64748b" }}>{title}</small>
      <div style={{ fontSize: 25, fontWeight: 800, marginTop: 7 }}>{value}</div>
      {note && <small style={{ color: "#64748b" }}>{note}</small>}
    </div>
  );
}

export default function BOSControlTower() {
  const [d, setD] = useState<any>({});
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setError("Sesi login tidak ditemukan.");
      return;
    }

    const { data: bu, error: be } = await supabase
      .from("business_users")
      .select("business_id")
      .eq("user_id", auth.user.id)
      .limit(1)
      .maybeSingle();

    if (be || !bu?.business_id) {
      setError(be?.message || "Business belum terhubung.");
      return;
    }

    const id = bu.business_id;
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const [biz, orders, prod, cap, csr, finance] = await Promise.all([
      supabase.from("businesses").select("name").eq("id", id).maybeSingle(),
      supabase
        .from("otc_orders")
        .select("id,order_no,status,total,payment_status")
        .eq("business_id", id)
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("proc_production_orders")
        .select("id,order_id,status,priority,blocked_reason")
        .eq("business_id", id)
        .in("status", ["QUEUED", "IN_PROGRESS", "QC_PENDING", "READY", "BLOCKED"])
        .limit(20),
      supabase
        .from("nortago_owner_capital_summary")
        .select("*")
        .eq("business_id", id)
        .maybeSingle(),
      supabase
        .from("nortago_csr_summary")
        .select("*")
        .eq("business_id", id)
        .maybeSingle(),
      supabase
        .from("nortago_finance_summary")
        .select("*")
        .eq("business_id", id)
        .maybeSingle(),
    ]);

    if (orders.error) throw orders.error;
    if (prod.error) throw prod.error;
    if (finance.error) throw finance.error;

    setD({
      biz: biz.data,
      orders: orders.data || [],
      prod: prod.data || [],
      cap: cap.data,
      csr: csr.data,
      finance: finance.data,
    });
  }

  useEffect(() => {
    load().catch((e) => setError(e.message || "Gagal memuat CT BOS NORTAGO."));
  }, []);

  const orders = d.orders || [];
  const prod = d.prod || [];
  const f = d.finance || {};

  const todayRevenue = orders
    .filter((o: any) => ["SUCCESS", "PO_SUCCESS"].includes(o.status))
    .reduce((s: number, o: any) => s + Number(o.total || 0), 0);

  const revenue = Number(f.revenue || 0);
  const cogs = Number(f.cogs || 0);
  const opex = Number(f.opex || 0);
  const tax = Number(f.tax || 0);
  const csr = Number(f.csr || 0);
  const netProfit = revenue - cogs - opex - tax - csr;

  if (error)
    return (
      <main style={{ padding: 32 }}>
        <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800, letterSpacing: ".12em" }}>
          CT BOS NORTAGO
        </div>
        <h1>Control Tower Business Owner System</h1>
        <p>{error}</p>
        <button onClick={load}>Retry</button>
      </main>
    );

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: 28, color: "#0f172a" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800, letterSpacing: ".12em" }}>
          NORTAGO ECOSYSTEM · CT BOS NORTAGO
        </div>
        <h1>{d.biz?.name || "Business"} — CT BOS NORTAGO</h1>
        <h2 style={{ fontSize: 18, marginTop: -4 }}>Control Tower Business Owner System</h2>
        <p style={{ color: "#64748b" }}>
          System of Record · System of Control · System of Intelligence · System of Visibility
        </p>
        <button
          onClick={load}
          style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff" }}
        >
          Refresh
        </button>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, marginTop: 18 }}>
          <Card title="Revenue Hari Ini" value={money(todayRevenue)} />
          <Card title="Revenue Tercatat" value={money(revenue)} note="Finance System of Record" />
          <Card title="COGS" value={money(cogs)} />
          <Card title="OPEX" value={money(opex)} />
          <Card title="Tax" value={money(tax)} />
          <Card title="CSR 2.5%" value={money(csr)} />
          <Card title="Net Profit" value={money(netProfit)} note="Revenue − COGS − OPEX − Tax − CSR" />
          <Card title="Open Orders" value={String(orders.filter((o: any) => !["SUCCESS", "PO_SUCCESS"].includes(o.status)).length)} />
          <Card title="Production Queue" value={String(prod.length)} />
          <Card title="Blocked Production" value={String(prod.filter((p: any) => p.status === "BLOCKED").length)} />
          <Card title="Total Investment" value={money(d.cap?.total_investment)} />
          <Card title="CSR Remaining" value={money(d.csr?.csr_remaining)} />
        </section>

        <section style={{ marginTop: 18, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20 }}>
          <h2>Owner Financial Control</h2>
          <p style={{ color: "#64748b" }}>
            Angka keuangan utama dibaca dari NORTAGO Finance System of Record. Belum ada transaksi finance pada business ini, sehingga nilai saat ini dapat tetap Rp0.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
            <Card title="Revenue" value={money(revenue)} />
            <Card title="COGS" value={money(cogs)} />
            <Card title="OPEX" value={money(opex)} />
            <Card title="Tax" value={money(tax)} />
            <Card title="CSR" value={money(csr)} />
            <Card title="Net Profit" value={money(netProfit)} />
          </div>
        </section>

        <section style={{ marginTop: 18, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20 }}>
          <h2>Production Queue</h2>
          {prod.length === 0 ? (
            <p>Tidak ada production order aktif.</p>
          ) : (
            prod.map((p: any) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: 12, borderTop: "1px solid #eef2f7" }}>
                <span>{p.order_id?.slice(0, 12)}</span>
                <b>{p.status}</b>
              </div>
            ))
          )}
        </section>

        <section style={{ marginTop: 18, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20 }}>
          <h2>Today's Orders</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Order</th>
                <th align="left">Status</th>
                <th align="left">Payment</th>
                <th align="right">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o: any) => (
                <tr key={o.id}>
                  <td>{o.order_no}</td>
                  <td>{o.status}</td>
                  <td>{o.payment_status}</td>
                  <td align="right">{money(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
