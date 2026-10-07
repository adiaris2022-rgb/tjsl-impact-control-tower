"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

async function getSupabase() {
  const response = await fetch("/api/supabase-config", { cache: "no-store" });
  const config = await response.json().catch(() => ({}));
  if (!response.ok || !config.url || !config.key) {
    throw new Error(config.error || "Supabase runtime configuration is not available.");
  }
  return createClient(config.url, config.key);
}

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
    const supabase = await getSupabase();
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

    const [biz, orders, prod, cap, csr, finance, intelligence, alerts, rater] = await Promise.all([
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
      supabase
        .from("nortago_owner_intelligence")
        .select("*")
        .eq("business_id", id)
        .maybeSingle(),
      supabase
        .from("nortago_owner_alerts")
        .select("id,alert_code,severity,title,detail,status,detected_at")
        .eq("business_id", id)
        .eq("status", "OPEN")
        .order("detected_at", { ascending: false })
        .limit(10),
      supabase
        .from("nortago_rater_status")
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
      intelligence: intelligence.data,
      alerts: alerts.data || [],
      rater: rater.data,
    });
  }

  useEffect(() => {
    load().catch((e) => setError(e.message || "Gagal memuat CT BOS NORTAGO."));
  }, []);

  const orders = d.orders || [];
  const prod = d.prod || [];
  const f = d.finance || {};
  const intelligence = d.intelligence || {};
  const alerts = d.alerts || [];
  const rater = d.rater || {};

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
      <main style={{minHeight:"100vh",background:"#061316",color:"#eefcf9",padding:24}}>
        <div style={{maxWidth:720,margin:"12vh auto",padding:28,border:"1px solid #214044",borderRadius:20,background:"#0a1c20"}}>
          <div style={{fontSize:11,fontWeight:800,letterSpacing:2,color:"#58d9c1"}}>CT BOS NORTAGO</div>
          <h1 style={{fontSize:32,margin:"12px 0"}}>Tower Kendali Bisnis</h1>
          <p style={{color:"#91aaa6"}}>{error}</p>
          <button onClick={load} style={{marginTop:12,padding:"12px 18px",border:0,borderRadius:10,background:"#51d8bd",fontWeight:800}}>Coba Lagi</button>
        </div>
      </main>
    );

  const openOrders = orders.filter((o:any)=>!["SUCCESS","PO_SUCCESS"].includes(o.status)).length;
  const blocked = prod.filter((p:any)=>p.status==="BLOCKED").length;
  const alertCount = alerts.length;
  const statusTone = rater.rater_status==="RATER COMPLETE" ? "#51d8bd" : "#f4c56b";

  const stat = (title:string,value:string,note?:string) => (
    <div style={{padding:"18px 18px 17px",border:"1px solid #19363a",borderRadius:16,background:"linear-gradient(145deg,#0b2024,#08181b)"}}>
      <div style={{fontSize:10,letterSpacing:1.4,color:"#6f8c88",fontWeight:800}}>{title}</div>
      <div style={{fontSize:24,fontWeight:800,marginTop:8,color:"#effbf9",letterSpacing:-.5}}>{value}</div>
      {note && <div style={{fontSize:10,color:"#66807d",marginTop:5}}>{note}</div>}
    </div>
  );

  return (
    <main style={{minHeight:"100vh",background:"radial-gradient(circle at 15% 0%,#103331 0%,#061316 38%,#040d0f 100%)",color:"#effbf9",padding:"22px 16px 48px"}}>
      <div style={{maxWidth:1180,margin:"0 auto"}}>
        <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap",padding:"8px 2px 22px",borderBottom:"1px solid #183236"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:11}}>
              <div style={{fontWeight:900,fontSize:20,letterSpacing:1}}>NORTAGO</div>
              <span style={{fontSize:10,color:"#55d8c0",border:"1px solid #255c58",borderRadius:20,padding:"5px 9px",letterSpacing:1}}>CT BOS</span>
            </div>
            <div style={{fontSize:11,color:"#6e8985",marginTop:5}}>Tower Kendali Bisnis · {d.biz?.name || "Business"}</div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button onClick={load} style={{padding:"9px 13px",borderRadius:9,border:"1px solid #234246",background:"#0a1c20",color:"#d7e8e5",fontWeight:700}}>↻ Refresh</button>
            <a href="/control-tower/subscription" style={{padding:"9px 13px",borderRadius:9,background:"#51d8bd",color:"#06201d",textDecoration:"none",fontWeight:800}}>Subscription</a>
          </div>
        </header>

        <section style={{padding:"28px 0 20px"}}>
          <div style={{fontSize:10,fontWeight:800,letterSpacing:2,color:"#55d8c0"}}>BUSINESS OWNER SYSTEM</div>
          <h1 style={{fontSize:"clamp(30px,5vw,46px)",lineHeight:1.02,letterSpacing:-1.5,margin:"9px 0 10px"}}>Tower Kendali Bisnis.</h1>
          <p style={{maxWidth:720,color:"#8fa9a5",lineHeight:1.6,margin:0}}>Satu layar untuk melihat apa yang terjadi, apa yang menyimpang, dan keputusan apa yang perlu diambil.</p>
        </section>

        <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:11}}>
          {stat("REVENUE HARI INI",money(todayRevenue))}
          {stat("REVENUE TERCATAT",money(revenue),"Finance System of Record")}
          {stat("COGS",money(cogs))}
          {stat("OPEX",money(opex))}
          {stat("NET PROFIT",money(netProfit),"After Tax + CSR")}
          {stat("TOTAL INVESTMENT",money(d.cap?.total_investment))}
        </section>

        <section style={{display:"grid",gridTemplateColumns:"minmax(0,1.4fr) minmax(280px,.8fr)",gap:14,marginTop:14}}>
          <div style={{border:"1px solid #19363a",borderRadius:18,padding:20,background:"#08191c"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",gap:10}}>
              <div><div style={{fontSize:10,letterSpacing:1.4,color:"#6f8c88",fontWeight:800}}>OWNER INTELLIGENCE</div><h2 style={{margin:"7px 0 4px",fontSize:20}}>Apa yang perlu diperhatikan?</h2></div>
              <div style={{fontSize:10,fontWeight:800,color:alertCount? "#f4c56b":"#51d8bd",padding:"7px 9px",borderRadius:8,border:"1px solid #254448"}}>{alertCount} ALERT</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginTop:16}}>
              {stat("GROSS PROFIT",money(intelligence.gross_profit))}
              {stat("OPERATING PROFIT",money(intelligence.operating_profit))}
              {stat("NET AFTER CSR",money(intelligence.net_profit_after_csr))}
              {stat("NET MARGIN",(Number(intelligence.net_margin_percent||0).toFixed(2))+"%")}
            </div>
            {alerts.length>0 ? <div style={{marginTop:14}}>{alerts.map((a:any)=><div key={a.id} style={{padding:"12px 13px",border:"1px solid #3d3430",borderRadius:11,marginTop:8,background:"#171714"}}><b style={{fontSize:12}}>{a.severity} · {a.title}</b><div style={{fontSize:11,color:"#93a6a2",marginTop:4,lineHeight:1.5}}>{a.detail}</div></div>)}</div> : <div style={{marginTop:14,padding:13,borderRadius:11,background:"#0c2421",color:"#76bdb0",fontSize:11}}>Tidak ada exception terbuka. Control tower dalam kondisi normal.</div>}
          </div>

          <div style={{border:"1px solid #19363a",borderRadius:18,padding:20,background:"#08191c"}}>
            <div style={{fontSize:10,letterSpacing:1.4,color:"#6f8c88",fontWeight:800}}>RATER CONTROL</div>
            <h2 style={{margin:"7px 0 5px",fontSize:20}}>Evidence & Control</h2>
            <div style={{display:"inline-block",margin:"8px 0 16px",padding:"7px 10px",borderRadius:9,border:"1px solid #244449",color:statusTone,fontSize:11,fontWeight:800}}>{rater.rater_status||"CHECKING"}</div>
            <div style={{display:"grid",gap:9}}>
              {[["Approval Rules",rater.approval_control?"READY":"NOT CONFIGURED"],["Missing Evidence",String(rater.missing_evidence||0)],["Recon Exceptions",String(rater.reconciliation_exceptions||0)],["Audit Events",String(rater.audit_events||0)]].map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid #142e32",fontSize:11}}><span style={{color:"#718d89"}}>{k}</span><b>{v}</b></div>)}
            </div>
          </div>
        </section>

        <section style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:11}}>
          {stat("OPEN ORDERS",String(openOrders))}
          {stat("PRODUCTION QUEUE",String(prod.length))}
          {stat("BLOCKED PRODUCTION",String(blocked))}
          {stat("CSR REMAINING",money(d.csr?.csr_remaining))}
          {stat("TAX",money(tax))}
          {stat("CSR 2.5%",money(csr))}
        </section>

        <section style={{marginTop:14,border:"1px solid #19363a",borderRadius:18,padding:20,background:"#08191c"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <div><div style={{fontSize:10,letterSpacing:1.4,color:"#6f8c88",fontWeight:800}}>OPERATIONS</div><h2 style={{margin:"7px 0 4px",fontSize:20}}>Production Queue</h2></div>
            <div style={{fontSize:10,color:blocked?"#f4c56b":"#6fa39b"}}>{blocked} BLOCKED</div>
          </div>
          {prod.length===0 ? <div style={{marginTop:15,color:"#718d89",fontSize:12}}>Tidak ada production order aktif.</div> : <div style={{marginTop:12,display:"grid",gap:7}}>{prod.map((p:any)=><div key={p.id} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"11px 12px",borderRadius:10,background:"#0b2024",fontSize:11}}><span style={{color:"#8ca6a2"}}>{p.order_id?.slice(0,12)}</span><b>{p.status}</b></div>)}</div>}
        </section>

        <section style={{marginTop:14,border:"1px solid #19363a",borderRadius:18,padding:20,background:"#08191c",overflow:"hidden"}}>
          <div style={{fontSize:10,letterSpacing:1.4,color:"#6f8c88",fontWeight:800}}>SALES SYSTEM OF RECORD</div>
          <h2 style={{margin:"7px 0 12px",fontSize:20}}>Today's Orders</h2>
          {orders.length===0 ? <div style={{color:"#718d89",fontSize:12}}>Belum ada order hari ini.</div> : <div style={{overflowX:"auto"}}><table style={{width:"100%",minWidth:650,borderCollapse:"collapse",fontSize:11}}><thead><tr>{["Order","Status","Payment","Total"].map((x,i)=><th key={x} style={{textAlign:i===3?"right":"left",padding:"9px 8px",color:"#66827e",borderBottom:"1px solid #173136"}}>{x}</th>)}</tr></thead><tbody>{orders.map((o:any)=><tr key={o.id}><td style={{padding:"11px 8px",borderBottom:"1px solid #10282c"}}>{o.order_no}</td><td style={{padding:"11px 8px",borderBottom:"1px solid #10282c"}}>{o.status}</td><td style={{padding:"11px 8px",borderBottom:"1px solid #10282c",color:"#8ca6a2"}}>{o.payment_status}</td><td style={{padding:"11px 8px",borderBottom:"1px solid #10282c",textAlign:"right"}}>{money(o.total)}</td></tr>)}</tbody></table></div>}
        </section>

        <section style={{marginTop:14}}>
          <div style={{fontSize:10,letterSpacing:1.4,color:"#6f8c88",fontWeight:800}}>BUSINESS MODULES</div>
          <h2 style={{margin:"7px 0 12px",fontSize:20}}>Masuk ke sistem</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10}}>
            {[
              ["/","SALES","NORTAGO OCT · Order & transaksi"],
              ["/procurement","PROCUREMENT","Stock · PO · Receiving"],
              ["/finance","FINANCE","Revenue · COGS · Profit · Tax"],
              ["/control-tower/bos/approvals","APPROVALS","Approval matrix · Control"],
              ["/control-tower/subscription","SUBSCRIPTION","Plan · Billing · Status"],
            ].map(([href,title,note]) => (
              <a key={href} href={href} style={{display:"block",padding:"16px",border:"1px solid #19363a",borderRadius:14,background:"#08191c",textDecoration:"none",color:"#effbf9"}}>
                <div style={{fontSize:11,fontWeight:900,letterSpacing:1.1,color:"#55d8c0"}}>{title}</div>
                <div style={{fontSize:11,color:"#78938f",marginTop:7,lineHeight:1.45}}>{note}</div>
                <div style={{fontSize:11,fontWeight:800,marginTop:12}}>Buka →</div>
              </a>
            ))}
          </div>
        </section>

        <footer style={{padding:"22px 2px 0",fontSize:9,color:"#4e6a66",letterSpacing:.4}}>CT BOS NORTAGO · System of Record · System of Control · System of Intelligence · System of Visibility</footer>
      </div>
    </main>  );
}
