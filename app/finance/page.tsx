"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"
);

const money = (n: any) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(n || 0));

function Card({ title, value, note }: { title: string; value: string; note?: string }) {
  return <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 18 }}>
    <small style={{ color: "#64748b" }}>{title}</small><div style={{ fontSize: 25, fontWeight: 800, marginTop: 7 }}>{value}</div>
    {note && <small style={{ color: "#64748b" }}>{note}</small>}
  </div>;
}

export default function FinancePage() {
  const [d, setD] = useState<any>({});
  const [err, setErr] = useState("");

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setErr("Login diperlukan"); return; }
    const { data: bu, error } = await supabase.from("business_users").select("business_id").eq("user_id", auth.user.id).limit(1).maybeSingle();
    if (error || !bu?.business_id) { setErr(error?.message || "Business belum terhubung"); return; }
    const id = bu.business_id;
    const [p,c,csr,dist,ret,tax] = await Promise.all([
      supabase.from("nortago_pnl_summary").select("*").eq("business_id",id).maybeSingle(),
      supabase.from("nortago_owner_capital_summary").select("*").eq("business_id",id).maybeSingle(),
      supabase.from("nortago_csr_summary").select("*").eq("business_id",id).maybeSingle(),
      supabase.from("nortago_profit_distributions").select("*").eq("business_id",id).order("created_at",{ascending:false}).limit(1).maybeSingle(),
      supabase.from("nortago_investment_returns").select("*").eq("business_id",id).order("period_end",{ascending:false}).limit(1).maybeSingle(),
      supabase.from("nortago_tax_periods").select("*").eq("business_id",id).order("period_end",{ascending:false}).limit(1).maybeSingle()
    ]);
    setD({p:p.data,c:c.data,csr:csr.data,dist:dist.data,ret:ret.data,tax:tax.data});
  }

  useEffect(() => { load().catch(e => setErr(e.message || "Gagal memuat finance")); }, []);
  if (err) return <main style={{padding:32}}><h1>NORTAGO Finance</h1><p>{err}</p><button onClick={load}>Retry</button></main>;

  const p=d.p||{},c=d.c||{},csr=d.csr||{},dist=d.dist||{},ret=d.ret||{},tax=d.tax||{};
  const gross=Number(p.revenue||0)-Number(p.cogs||0);
  const net=gross-Number(p.opex||0)-Number(p.tax||0);

  return <main style={{minHeight:"100vh",background:"#f8fafc",padding:28,color:"#0f172a"}}>
    <div style={{maxWidth:1250,margin:"0 auto"}}>
      <div style={{color:"#64748b",fontSize:12,fontWeight:800,letterSpacing:".12em"}}>NORTAGO FULL BOS</div>
      <h1>Finance &amp; Profit Control</h1>
      <p style={{color:"#64748b"}}>Revenue → COGS → Gross Profit → OPEX → Tax → Net Profit → CSR → Distributable Profit → ROI</p>
      <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:14}}>
        <Card title="Revenue" value={money(p.revenue)}/><Card title="COGS" value={money(p.cogs)}/><Card title="Gross Profit" value={money(gross)}/><Card title="OPEX" value={money(p.opex)}/>
        <Card title="Net Profit After Tax" value={money(net)}/><Card title="CSR 2.5%" value={money(csr.csr_allocated)}/><Card title="Distributable Profit" value={money(dist.distributable_amount)}/><Card title="ROI" value={String(ret.roi_percent||0)+"%"}/>
      </section>
      <section style={{marginTop:18,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>
        <Card title="Capital" value={money(c.total_investment)} note={"Allocated "+money(c.allocated_investment)+" · Unallocated "+money(c.unallocated_investment)}/>
        <Card title="Tax" value={money(tax.tax_amount)} note={tax.status||"Belum dihitung"}/>
        <Card title="CSR Fund" value={money(csr.csr_remaining)} note={"Spent "+money(csr.csr_spent)}/>
        <Card title="Profit Distribution" value={money(dist.distributed_amount)} note={dist.status||"DRAFT"}/>
      </section>
      <section style={{marginTop:18,background:"#fff",border:"1px solid #e5e7eb",borderRadius:16,padding:20}}>
        <h2>Control Rules</h2><ul><li>Revenue berasal dari transaksi finalized.</li><li>COGS mengikuti stock/recipe evidence.</li><li>Tax mengikuti konfigurasi periode dan aturan yang berlaku.</li><li>CSR 2,5% adalah kebijakan internal/partnership NORTAGO.</li><li>Profit distribution setelah profit, tax, CSR dan approval tervalidasi.</li></ul>
      </section>
    </div>
  </main>;
}
