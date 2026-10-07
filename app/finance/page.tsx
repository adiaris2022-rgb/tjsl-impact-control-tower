"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"
);

const money = (n: any) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(n || 0));

function Card({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 18 }}>
      <small style={{ color: "#64748b" }}>{title}</small>
      <div style={{ fontSize: 25, fontWeight: 800, marginTop: 7 }}>{value}</div>
      {note && <small style={{ color: "#64748b" }}>{note}</small>}
    </div>
  );
<style jsx>{`
.finance-page{box-sizing:border-box}.finance-page input,.finance-page button{max-width:100%;box-sizing:border-box}
@media(max-width:700px){.finance-page{padding:12px!important}.finance-page>div{width:100%;max-width:100%!important}.finance-page h1{font-size:28px;line-height:1.05}.finance-page section{min-width:0}.finance-kpis{grid-template-columns:1fr 1fr!important;gap:10px!important}.finance-secondary-kpis{grid-template-columns:1fr!important;gap:10px!important}.finance-page .finance-close-form{grid-template-columns:1fr!important;gap:10px!important}.finance-page .finance-close-form input{min-height:44px}.finance-page button{min-height:44px;width:100%}.finance-page ul{padding-left:20px}}
`}</style>
}


export default function FinancePage() {
  const [d, setD] = useState<any>({});
  const [err, setErr] = useState("");
  const [message, setMessage] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [retained, setRetained] = useState("0");
  const [closing, setClosing] = useState(false);

  async function load() {
    setErr("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setErr("Login diperlukan"); return; }

    const { data: bu, error } = await supabase
      .from("business_users").select("business_id").eq("user_id", auth.user.id).limit(1).maybeSingle();

    if (error || !bu?.business_id) { setErr(error?.message || "Business belum terhubung"); return; }

    const id = bu.business_id;
    const [p, c, csr, dist, ret, tax, finance] = await Promise.all([
      supabase.from("nortago_pnl_summary").select("*").eq("business_id", id).maybeSingle(),
      supabase.from("nortago_owner_capital_summary").select("*").eq("business_id", id).maybeSingle(),
      supabase.from("nortago_csr_summary").select("*").eq("business_id", id).maybeSingle(),
      supabase.from("nortago_profit_distributions").select("*").eq("business_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("nortago_investment_returns").select("*").eq("business_id", id).order("period_end", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("nortago_tax_periods").select("*").eq("business_id", id).order("period_end", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("nortago_finance_summary").select("*").eq("business_id", id).maybeSingle(),
    ]);

    for (const x of [p, c, csr, dist, ret, tax, finance]) if (x.error) throw x.error;
    setD({ p: p.data, c: c.data, csr: csr.data, dist: dist.data, ret: ret.data, tax: tax.data, finance: finance.data });
  }

  useEffect(() => {
    load().catch(e => setErr(e.message || "Gagal memuat finance"));
  }, []);

  async function finalizePeriod() {
    setMessage("");
    setErr("");
    if (!start || !end) { setErr("Isi periode mulai dan selesai."); return; }
    if (Number(taxRate) < 0 || Number(taxRate) > 100) { setErr("Tax rate harus 0–100%."); return; }
    if (Number(retained) < 0) { setErr("Retained amount tidak boleh negatif."); return; }

    setClosing(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Login diperlukan");
      const { data: bu, error: be } = await supabase.from("business_users").select("business_id").eq("user_id", auth.user.id).limit(1).maybeSingle();
      if (be || !bu?.business_id) throw new Error(be?.message || "Business belum terhubung");

      const { data, error } = await supabase.rpc("nortago_finalize_period", {
        p_business_id: bu.business_id,
        p_period_start: start,
        p_period_end: end,
        p_tax_rate: Number(taxRate) / 100,
        p_retained_amount: Number(retained),
      });
      if (error) throw error;
      setMessage("Period Close berhasil diproses. Tax, CSR, distributable profit, dan ROI telah dihitung.");
      await load();
      console.log(data);
    } catch (e: any) {
      setErr(e.message || "Period Close gagal.");
    } finally {
      setClosing(false);
    }
  }

  if (err && !d.p && !d.finance)
    return <main style={{ padding: 32 }}><h1>NORTAGO Finance</h1><p>{err}</p><button onClick={load}>Retry</button></main>;

  const f = d.finance || {};
  const c = d.c || {};
  const csr = d.csr || {};
  const dist = d.dist || {};
  const ret = d.ret || {};
  const tax = d.tax || {};

  const revenue = Number(f.revenue ?? d.p?.revenue ?? 0);
  const cogs = Number(f.cogs ?? d.p?.cogs ?? 0);
  const opex = Number(f.opex ?? d.p?.opex ?? 0);
  const taxAmount = Number(f.tax ?? d.p?.tax ?? 0);
  const csrAmount = Number(f.csr ?? 0);
  const gross = revenue - cogs;
  const netAfterTax = gross - opex - taxAmount;
  const finalProfit = netAfterTax - csrAmount;

  return (
    <main className="finance-page" style={{ minHeight: "100vh", background: "#f8fafc", padding: 28, color: "#0f172a" }}>
      <div style={{ maxWidth: 1250, margin: "0 auto" }}>
        <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800, letterSpacing: ".12em" }}>NORTAGO FULL BOS</div>
        <h1>Finance &amp; Profit Control</h1>
        <p style={{ color: "#64748b" }}>Revenue → COGS → Gross Profit → OPEX → Tax → Net Profit → CSR → Distributable Profit → ROI</p>

        {err && <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", padding: 14, borderRadius: 12, marginBottom: 14 }}>{err}</div>}
        {message && <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: 14, borderRadius: 12, marginBottom: 14 }}>{message}</div>}

        <section className="finance-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
          <Card title="Revenue" value={money(revenue)} />
          <Card title="COGS" value={money(cogs)} />
          <Card title="Gross Profit" value={money(gross)} />
          <Card title="OPEX" value={money(opex)} />
          <Card title="Net Profit After Tax" value={money(netAfterTax)} />
          <Card title="CSR 2.5%" value={money(csrAmount)} />
          <Card title="Distributable Profit" value={money(dist.distributable_amount ?? finalProfit)} />
          <Card title="ROI" value={String(ret.roi_percent || 0) + "%"} />
        </section>

        <section style={{ marginTop: 18, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20 }}>
          <h2>Period Close</h2>
          <p style={{ color: "#64748b" }}>Finalize satu periode untuk menghitung Tax, CSR 2,5%, distributable profit, dan ROI. Tax rate harus diisi sesuai skema pajak yang benar untuk entitas/periode tersebut.</p>
          <div className="finance-close-form" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
            <label>Mulai<input type="date" value={start} onChange={e => setStart(e.target.value)} style={{ display: "block", width: "100%", marginTop: 6, padding: 10 }} /></label>
            <label>Selesai<input type="date" value={end} onChange={e => setEnd(e.target.value)} style={{ display: "block", width: "100%", marginTop: 6, padding: 10 }} /></label>
            <label>Tax Rate (%)<input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={e => setTaxRate(e.target.value)} style={{ display: "block", width: "100%", marginTop: 6, padding: 10 }} /></label>
            <label>Retained Profit<input type="number" min="0" step="1000" value={retained} onChange={e => setRetained(e.target.value)} style={{ display: "block", width: "100%", marginTop: 6, padding: 10 }} /></label>
          </div>
          <button onClick={finalizePeriod} disabled={closing} style={{ marginTop: 14, padding: "11px 18px", borderRadius: 10, border: 0, background: "#0f172a", color: "#fff", fontWeight: 700 }}>
            {closing ? "Memproses..." : "FINALIZE PERIOD"}
          </button>
        </section>

        <section className="finance-secondary-kpis" style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
          <Card title="Capital" value={money(c.total_investment)} note={"Allocated " + money(c.allocated_investment) + " · Unallocated " + money(c.unallocated_investment)} />
          <Card title="Tax" value={money(tax.tax_amount)} note={tax.status || "Belum dihitung"} />
          <Card title="CSR Fund" value={money(csr.csr_remaining)} note={"Spent " + money(csr.csr_spent)} />
          <Card title="Profit Distribution" value={money(dist.distributed_amount)} note={dist.status || "DRAFT"} />
        </section>

        <section style={{ marginTop: 18, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20 }}>
          <h2>Control Rules</h2>
          <ul>
            <li>Revenue berasal dari transaksi finalized.</li>
            <li>COGS mengikuti stock/recipe evidence.</li>
            <li>Tax mengikuti konfigurasi periode dan aturan yang berlaku.</li>
            <li>CSR 2,5% adalah kebijakan internal/partnership NORTAGO, bukan tarif pajak universal.</li>
            <li>Profit distribution setelah profit, tax, CSR, retained amount, dan approval tervalidasi.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
