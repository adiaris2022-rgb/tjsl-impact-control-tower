"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are not configured.");
  return createBrowserClient(url, key);
}

type Summary = {
  programs: number;
  partners: number;
  transactions: number;
  transactionValue: number;
  outcomes: number;
  verifiedEvidence: number;
  approvedProxies: number;
  sroi: number | null;
};

function money(v: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v);
}

export default function ControlTowerDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState("");
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [companyNameDraft, setCompanyNameDraft] = useState("");
  const [savingBrand, setSavingBrand] = useState(false);
  const [brandMessage, setBrandMessage] = useState("");
  const [businessName, setBusinessName] = useState("Perusahaan Anda");
  const [businessLogoUrl, setBusinessLogoUrl] = useState<string | null>(null);
  const [programRows, setProgramRows] = useState<any[]>([]);
  const [partnerRows, setPartnerRows] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"overview"|"programs"|"partners"|"outcomes"|"evidence"|"sroi"|"reports">("overview");
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [programForm, setProgramForm] = useState({name:"", reporting_period:""});
  const [partnerForm, setPartnerForm] = useState({program_id:"", business_name:"", owner_name:"", address:""});
  const [savingData, setSavingData] = useState(false);
  const [outcomeRows, setOutcomeRows] = useState<any[]>([]);
  const [showOutcomeForm, setShowOutcomeForm] = useState(false);
  const [outcomeForm, setOutcomeForm] = useState({partner_id:"",name:"",indicator:"",baseline:"",current_value:"",unit:""});
  const [evidenceRows, setEvidenceRows] = useState<any[]>([]);
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [evidenceForm, setEvidenceForm] = useState({outcome_id:"",source_type:"DOCUMENT",source_reference:"",evidence_period:""});
  const [proxyRows, setProxyRows] = useState<any[]>([]);
  const [sroiRows, setSroiRows] = useState<any[]>([]);
  const [showProxyForm, setShowProxyForm] = useState(false);
  const [showSroiForm, setShowSroiForm] = useState(false);
  const [proxyForm, setProxyForm] = useState({outcome_id:"",proxy_name:"",proxy_value:"",unit:"",methodology_source:"",assumption_note:""});
  const [sroiForm, setSroiForm] = useState({program_id:"",investment:"",proxy_id:"",gross_value:"",deadweight:"0",attribution:"0",displacement:"0",drop_off:"0"});
  const [reportRows, setReportRows] = useState<any[]>([]);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportForm, setReportForm] = useState({program_id:"",period:"",sroi_calculation_id:"",methodology_note:""});

  const [summary, setSummary] = useState<Summary>({
    programs: 0, partners: 0, transactions: 0, transactionValue: 0,
    outcomes: 0, verifiedEvidence: 0, approvedProxies: 0, sroi: null
  });

  async function loadDashboard(currentUser: User) {
    setLoading(true);
    setError("");
    const supabase = getSupabase();
    const { data: bu, error: buError } = await supabase
      .from("business_users")
      .select("business_id, role")
      .eq("user_id", currentUser.id)
      .maybeSingle();
    if (buError) { setError(buError.message); setLoading(false); return; }
    if (!bu) { setError("Akun belum terdaftar pada TJSL Impact Control Tower."); setLoading(false); return; }

    setRole(bu.role);
    setBusinessId(bu.business_id);
    const [biz, programs, partners, transactions, outcomes, evidence, proxies, sroi, programList, partnerList, outcomeList, evidenceList, proxyList, sroiList, reportList] = await Promise.all([
      supabase.from("businesses").select("name, logo_url").eq("id", bu.business_id).maybeSingle(),
      supabase.from("tjsl_programs").select("id", { count: "exact", head: true }),
      supabase.from("tjsl_partners").select("id", { count: "exact", head: true }),
      supabase.from("tjsl_transactions").select("amount").in("status", ["SUCCESS","PICKUP_VERIFIED","HANDED_OVER_TO_DELIVERY"]),
      supabase.from("tjsl_outcomes").select("id", { count: "exact", head: true }),
      supabase.from("tjsl_evidence").select("id", { count: "exact", head: true }).eq("status", "VERIFIED"),
      supabase.from("tjsl_financial_proxies").select("id", { count: "exact", head: true }).eq("approval_status", "APPROVED"),
      supabase.from("tjsl_sroi_calculations").select("sroi").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("tjsl_programs").select("id,name,reporting_period,status,created_at").order("created_at", { ascending: false }),
      supabase.from("tjsl_partners").select("id,program_id,business_name,owner_name,address,status,created_at").order("created_at", { ascending: false }),
      supabase.from("tjsl_outcomes").select("id,partner_id,name,indicator,baseline,current_value,unit,status").order("created_at", { ascending: false }),
      supabase.from("tjsl_evidence").select("id,outcome_id,storage_path,source_type,source_reference,evidence_period,status,submitted_by,verifier_id,verified_at,verification_note,created_at").order("created_at", { ascending: false }),
      supabase.from("tjsl_financial_proxies").select("id,outcome_id,proxy_name,proxy_value,unit,methodology_source,assumption_note,approval_status,approved_by,approved_at").order("created_at", { ascending: false }),
      supabase.from("tjsl_sroi_calculations").select("id,program_id,investment,gross_value,deadweight,attribution,displacement,drop_off,impact_value,sroi,status,created_at").order("created_at", { ascending: false }),
      supabase.from("tjsl_reports").select("id,program_id,period,status,sroi_calculation_id,methodology_note,approved_by,approved_at,created_at").order("created_at", { ascending: false })
    ]);

    const firstError = [biz, programs, partners, transactions, outcomes, evidence, proxies, sroi, programList, partnerList, outcomeList, evidenceList, proxyList, sroiList, reportList].find(x => x.error);
    if (firstError?.error) setError(firstError.error.message);
    setBusinessName(biz.data?.name ?? "Perusahaan Anda");
    setCompanyNameDraft(biz.data?.name ?? "Perusahaan Anda");
    setBusinessLogoUrl(biz.data?.logo_url ?? null);
    setProgramRows(programList.data ?? []);
    setPartnerRows(partnerList.data ?? []);
    setOutcomeRows(outcomeList.data ?? []);
    setEvidenceRows(evidenceList.data ?? []);
    setProxyRows(proxyList.data ?? []);
    setSroiRows(sroiList.data ?? []);\n    setReportRows(reportList.data ?? []);
    const tx = transactions.data ?? [];
    setSummary({
      programs: programs.count ?? 0,
      partners: partners.count ?? 0,
      transactions: tx.length,
      transactionValue: tx.reduce((n, x) => n + Number(x.amount ?? 0), 0),
      outcomes: outcomes.count ?? 0,
      verifiedEvidence: evidence.count ?? 0,
      approvedProxies: proxies.count ?? 0,
      sroi: sroi.data?.sroi == null ? null : Number(sroi.data.sroi)
    });
    setLoading(false);
  }

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadDashboard(data.session.user);
      else setLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Gagal memuat sesi.");
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadDashboard(session.user);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function saveCompanyName() {
    if (!businessId || !companyNameDraft.trim()) return;
    setSavingBrand(true); setBrandMessage("");
    const { error } = await getSupabase().from("businesses").update({ name: companyNameDraft.trim() }).eq("id", businessId);
    if (error) setBrandMessage(error.message);
    else { setBusinessName(companyNameDraft.trim()); setBrandMessage("Nama perusahaan tersimpan."); }
    setSavingBrand(false);
  }

  async function uploadCompanyLogo(file: File) {
    if (!businessId) return;
    if (!file.type.startsWith("image/")) { setBrandMessage("File logo harus berupa gambar."); return; }
    if (file.size > 2 * 1024 * 1024) { setBrandMessage("Ukuran logo maksimal 2 MB."); return; }
    setSavingBrand(true); setBrandMessage("");
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${businessId}/${crypto.randomUUID()}.${ext}`;
    const supabase = getSupabase();
    const upload = await supabase.storage.from("business-branding").upload(path, file, { upsert: false, contentType: file.type });
    if (upload.error) { setBrandMessage(upload.error.message); setSavingBrand(false); return; }
    const { data: urlData } = supabase.storage.from("business-branding").getPublicUrl(path);
    const { error } = await supabase.from("businesses").update({ logo_url: urlData.publicUrl }).eq("id", businessId);
    if (error) setBrandMessage(error.message);
    else { setBusinessLogoUrl(urlData.publicUrl); setBrandMessage("Logo perusahaan tersimpan."); }
    setSavingBrand(false);
  }

  async function createProgram() {
    if (!businessId || !programForm.name.trim()) return;
    setSavingData(true); setError("");
    const { error } = await getSupabase().from("tjsl_programs").insert({
      business_id: businessId,
      name: programForm.name.trim(),
      reporting_period: programForm.reporting_period || null,
      status: "ACTIVE"
    });
    if (error) setError(error.message);
    else { setProgramForm({name:"",reporting_period:""}); setShowProgramForm(false); if (user) await loadDashboard(user); }
    setSavingData(false);
  }

  async function createPartner() {
    if (!partnerForm.program_id || !partnerForm.business_name.trim()) return;
    setSavingData(true); setError("");
    const { error } = await getSupabase().from("tjsl_partners").insert({
      program_id: partnerForm.program_id,
      business_name: partnerForm.business_name.trim(),
      owner_name: partnerForm.owner_name.trim() || null,
      address: partnerForm.address.trim() || null,
      status: "ACTIVE"
    });
    if (error) setError(error.message);
    else { setPartnerForm({program_id:"",business_name:"",owner_name:"",address:""}); setShowPartnerForm(false); if (user) await loadDashboard(user); }
    setSavingData(false);
  }


  async function createOutcome() {
    if (!outcomeForm.partner_id || !outcomeForm.name.trim() || !outcomeForm.indicator.trim()) return;
    setSavingData(true); setError("");
    const payload = { partner_id: outcomeForm.partner_id, name: outcomeForm.name.trim(), indicator: outcomeForm.indicator.trim(), baseline: outcomeForm.baseline === "" ? null : Number(outcomeForm.baseline), current_value: outcomeForm.current_value === "" ? null : Number(outcomeForm.current_value), unit: outcomeForm.unit.trim() || null, status: "DRAFT" };
    const { error } = await getSupabase().from("tjsl_outcomes").insert(payload);
    if (error) setError(error.message);
    else { setOutcomeForm({partner_id:"",name:"",indicator:"",baseline:"",current_value:"",unit:""}); setShowOutcomeForm(false); if (user) await loadDashboard(user); }
    setSavingData(false);
  }

  async function submitEvidence(file: File | null) {
    if (!user || !businessId || !evidenceForm.outcome_id || !file) return;
    if (file.size > 10 * 1024 * 1024) { setError("Evidence maksimal 10 MB."); return; }
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") { setError("Evidence harus PDF atau gambar."); return; }
    setSavingData(true); setError("");
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = businessId + "/" + evidenceForm.outcome_id + "/" + crypto.randomUUID() + "." + ext;
    const supabase = getSupabase();
    const upload = await supabase.storage.from("tjsl-evidence").upload(path, file, {upsert:false, contentType:file.type});
    if (upload.error) { setError(upload.error.message); setSavingData(false); return; }
    const { error } = await supabase.from("tjsl_evidence").insert({
      outcome_id:evidenceForm.outcome_id, storage_path:path, source_type:evidenceForm.source_type,
      source_reference:evidenceForm.source_reference.trim() || null, evidence_period:evidenceForm.evidence_period || null,
      status:"SUBMITTED", submitted_by:user.id
    });
    if (error) { await supabase.storage.from("tjsl-evidence").remove([path]); setError(error.message); }
    else { setEvidenceForm({outcome_id:"",source_type:"DOCUMENT",source_reference:"",evidence_period:""}); setShowEvidenceForm(false); await loadDashboard(user); }
    setSavingData(false);
  }

  async function verifyEvidence(id:string, approved:boolean) {
    if (!user || (role !== "OWNER" && role !== "PROGRAM_MANAGER")) return;
    setSavingData(true); setError("");
    const { error } = await getSupabase().from("tjsl_evidence").update({
      status: approved ? "VERIFIED" : "REJECTED", verifier_id:user.id, verified_at:new Date().toISOString(),
      verification_note: approved ? "Verified in Control Tower." : "Evidence rejected in Control Tower."
    }).eq("id",id);
    if (error) setError(error.message); else await loadDashboard(user);
    setSavingData(false);
  }

  async function createProxy() {
    if (!proxyForm.outcome_id || !proxyForm.proxy_name.trim() || proxyForm.proxy_value === "" || !proxyForm.methodology_source.trim()) return;
    setSavingData(true); setError("");
    const { error } = await getSupabase().from("tjsl_financial_proxies").insert({
      outcome_id:proxyForm.outcome_id, proxy_name:proxyForm.proxy_name.trim(), proxy_value:Number(proxyForm.proxy_value),
      unit:proxyForm.unit.trim() || null, methodology_source:proxyForm.methodology_source.trim(),
      assumption_note:proxyForm.assumption_note.trim() || null, approval_status:"PENDING"
    });
    if (error) setError(error.message);
    else { setProxyForm({outcome_id:"",proxy_name:"",proxy_value:"",unit:"",methodology_source:"",assumption_note:""}); setShowProxyForm(false); await loadDashboard(user); }
    setSavingData(false);
  }

  async function approveProxy(id:string) {
    if (!user || (role !== "OWNER" && role !== "PROGRAM_MANAGER")) return;
    setSavingData(true); setError("");
    const { error } = await getSupabase().from("tjsl_financial_proxies").update({approval_status:"APPROVED",approved_by:user.id,approved_at:new Date().toISOString()}).eq("id",id);
    if (error) setError(error.message); else await loadDashboard(user);
    setSavingData(false);
  }

  async function calculateSroi() {
    if (!user || !sroiForm.program_id || sroiForm.investment === "" || !sroiForm.proxy_id || sroiForm.gross_value === "") return;
    setSavingData(true); setError("");
    const proxy = proxyRows.find(p=>p.id===sroiForm.proxy_id);
    if (!proxy || proxy.approval_status !== "APPROVED") { setError("Financial Proxy harus APPROVED."); setSavingData(false); return; }
    const linkedOutcome = outcomeRows.find(o=>o.id===proxy.outcome_id);
    if (!linkedOutcome) { setError("Outcome proxy tidak ditemukan."); setSavingData(false); return; }
    const verified = evidenceRows.some(e=>e.outcome_id===linkedOutcome.id && e.status==="VERIFIED");
    if (!verified) { setError("SROI Gate: Outcome belum memiliki evidence VERIFIED."); setSavingData(false); return; }
    const investment=Number(sroiForm.investment), gross=Number(sroiForm.gross_value);
    const dw=Number(sroiForm.deadweight)/100, attr=Number(sroiForm.attribution)/100, disp=Number(sroiForm.displacement)/100, drop=Number(sroiForm.drop_off)/100;
    const impact=gross*(1-dw)*(1-attr)*(1-disp)*(1-drop);
    const ratio=investment>0 ? impact/investment : null;
    const trace={formula:"Impact = Gross × (1-DW) × (1-Attribution) × (1-Displacement) × (1-Drop-off); SROI = Impact / Investment",proxy_id:proxy.id,outcome_id:linkedOutcome.id,verified_evidence:evidenceRows.filter(e=>e.outcome_id===linkedOutcome.id&&e.status==="VERIFIED").map(e=>e.id),inputs:{investment,gross_value:gross,deadweight:dw,attribution:attr,displacement:disp,drop_off:drop},calculated_at:new Date().toISOString()};
    const { error } = await getSupabase().from("tjsl_sroi_calculations").insert({program_id:sroiForm.program_id,investment,gross_value:gross,deadweight:dw,attribution:attr,displacement:disp,drop_off:drop,impact_value:impact,sroi:ratio,status:"ESTIMATED",calculation_trace:trace,created_by:user.id});
    if (error) setError(error.message); else { setShowSroiForm(false); await loadDashboard(user); }
    setSavingData(false);
  }

  async function createReport() {
    if (!user || !reportForm.program_id || !reportForm.period) return;
    setSavingData(true); setError("");
    const calc = reportForm.sroi_calculation_id ? sroiRows.find(x=>x.id===reportForm.sroi_calculation_id) : null;
    const methodology = reportForm.methodology_note.trim() || "Laporan dampak berbasis data program, transaksi, outcome, evidence terverifikasi, financial proxy, dan perhitungan SROI berstatus ESTIMATED. Angka dan asumsi harus ditinjau sesuai metodologi program.";
    const { error } = await getSupabase().from("tjsl_reports").insert({
      program_id:reportForm.program_id, period:reportForm.period, status:"DRAFT",
      sroi_calculation_id:calc?.id || null, methodology_note:methodology, created_by:user.id
    });
    if (error) setError(error.message);
    else { setReportForm({program_id:"",period:"",sroi_calculation_id:"",methodology_note:""}); setShowReportForm(false); await loadDashboard(user); }
    setSavingData(false);
  }

  async function approveReport(id:string) {
    if (!user || role !== "OWNER") return;
    setSavingData(true); setError("");
    const { error } = await getSupabase().from("tjsl_reports").update({status:"APPROVED",approved_by:user.id,approved_at:new Date().toISOString()}).eq("id",id);
    if (error) setError(error.message); else await loadDashboard(user);
    setSavingData(false);
  }
  async function signOut() {
    await getSupabase().auth.signOut();
    setRole("");
  }

  const cards = useMemo(() => [
    ["Program", summary.programs.toString(), "Program aktif/terdaftar"],
    ["Mitra Binaan", summary.partners.toString(), "Dalam scope akses akun"],
    ["Transaksi", summary.transactions.toString(), "Status transaksi valid"],
    ["Nilai Transaksi", money(summary.transactionValue), "Real transaction evidence"],
    ["Outcome", summary.outcomes.toString(), "Outcome tercatat"],
    ["Evidence Verified", summary.verifiedEvidence.toString(), "Lolos verifikasi"],
    ["Proxy Approved", summary.approvedProxies.toString(), "Proxy disetujui"],
    ["SROI Terakhir", summary.sroi == null ? "—" : summary.sroi.toFixed(2) + ":1", "Status tetap ESTIMATED"]
  ], [summary]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="company-brand top-company-brand">{businessLogoUrl ? <img src={businessLogoUrl} alt={businessName} /> : <div className="company-logo-placeholder">LOGO</div>}<div><strong>{businessName}</strong><small>TJSL Impact Control Tower</small></div></div>
        <div className="userbox"><span>{role}</span><button className="ghost" onClick={signOut}>Keluar</button></div>
      </header>
      <section className="hero">
        <div><div className="eyebrow">EXECUTIVE CONTROL TOWER</div><h1>Program → Data → Evidence → Impact</h1><p>Ringkasan eksekutif berbasis data yang tersedia dalam scope akun Anda.</p></div>
        <div className="status"><i/> SYSTEM ONLINE</div>
      </section>
{error && <div className="error page-error">{error}</div>}
      {role === "OWNER" && !loading && <section className="brand-settings">
        <div><div className="eyebrow">COMPANY IDENTITY</div><h2>Identitas Perusahaan</h2><p>Logo dan nama ini tampil sebagai identitas utama perusahaan di Control Tower.</p></div>
        <div className="brand-settings-form">
          <div className="brand-preview">{businessLogoUrl ? <img src={businessLogoUrl} alt={businessName} /> : <div className="company-logo-placeholder">LOGO</div>}<div><strong>{businessName}</strong><small>Primary brand</small></div></div>
          <label>Nama Perusahaan<input value={companyNameDraft} onChange={e => setCompanyNameDraft(e.target.value)} /></label>
          <div className="brand-actions"><button onClick={saveCompanyName} disabled={savingBrand}>Simpan Nama</button><label className="upload-button">Ganti Logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e => e.target.files?.[0] && uploadCompanyLogo(e.target.files[0])} disabled={savingBrand} /></label></div>
          {brandMessage && <div className={brandMessage.includes("tersimpan") ? "success" : "error"}>{brandMessage}</div>}
        </div>
      </section>}
      {loading ? <div className="loading">Memuat data control tower…</div> :
        <>
          <nav className="tower-tabs">
            <button className={activeTab==="overview"?"active":""} onClick={()=>setActiveTab("overview")}>Overview</button>
            <button className={activeTab==="programs"?"active":""} onClick={()=>setActiveTab("programs")}>Program</button>
            <button className={activeTab==="partners"?"active":""} onClick={()=>setActiveTab("partners")}>Mitra Binaan</button>
            <button className={activeTab==="outcomes"?"active":""} onClick={()=>setActiveTab("outcomes")}>Outcome</button>
            <button className={activeTab==="evidence"?"active":""} onClick={()=>setActiveTab("evidence")}>Evidence</button>
            <button className={activeTab==="sroi"?"active":""} onClick={()=>setActiveTab("sroi")}>SROI</button>\n            <button className={activeTab==="reports"?"active":""} onClick={()=>setActiveTab("reports")}>Report</button>
          </nav>
          {activeTab==="overview" && <><section className="grid">{cards.map(([title,value,note]) => <article className="metric" key={title}><div className="metric-title">{title}</div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></article>)}</section>
            <section className="panels"><article className="panel"><div className="panel-head"><div><div className="eyebrow">IMPACT CHAIN</div><h2>Jejak data program</h2></div><span className="pill">TRACEABLE</span></div><div className="chain">{["Program","Mitra Binaan","Transaksi","Outcome","Evidence","SROI"].map((x,i)=><div className="chain-item" key={x}><b>0{i+1}</b><span>{x}</span>{i<5&&<em>→</em>}</div>)}</div><p className="method">Transaksi adalah activity evidence. Outcome memerlukan evidence dan verifikasi. SROI hanya dihitung melalui input yang memenuhi gate metodologi.</p></article>
              <article className="panel"><div className="panel-head"><div><div className="eyebrow">WORKFLOW</div><h2>Control Tower</h2></div></div><ul className="steps"><li><span>01</span>Program & Mitra</li><li><span>02</span>Outcome & Indicator</li><li><span>03</span>Evidence & Verification</li><li><span>04</span>Financial Proxy</li><li><span>05</span>SROI & Executive Report</li></ul></article></section>
          </>}
          {activeTab==="programs" && <section className="data-panel"><div className="section-toolbar"><div><div className="eyebrow">PROGRAM MANAGEMENT</div><h2>Program TJSL</h2><p>Kelola program dan periode pelaporan dalam satu tempat.</p></div><button onClick={()=>setShowProgramForm(!showProgramForm)}>+ Program</button></div>
            {showProgramForm && <div className="inline-form"><label>Nama Program<input value={programForm.name} onChange={e=>setProgramForm({...programForm,name:e.target.value})} placeholder="Contoh: Digitalisasi Mitra Binaan" /></label><label>Periode Pelaporan<input type="date" value={programForm.reporting_period} onChange={e=>setProgramForm({...programForm,reporting_period:e.target.value})} /></label><button onClick={createProgram} disabled={savingData}>Simpan Program</button></div>}
            <div className="table-wrap"><table><thead><tr><th>Program</th><th>Periode</th><th>Status</th><th>Dibuat</th></tr></thead><tbody>{programRows.map(p=><tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.reporting_period||"—"}</td><td><span className="status-badge">{p.status}</span></td><td>{new Date(p.created_at).toLocaleDateString("id-ID")}</td></tr>)}{programRows.length===0&&<tr><td colSpan={4} className="empty">Belum ada program. Buat program pertama.</td></tr>}</tbody></table></div>
          </section>}
          {activeTab==="outcomes" && <section className="data-panel"><div className="section-toolbar"><div><div className="eyebrow">OUTCOME & INDICATOR</div><h2>Outcome Program</h2><p>Catat perubahan yang ingin diukur. Transaksi tidak otomatis dianggap sebagai outcome.</p></div><button onClick={()=>setShowOutcomeForm(!showOutcomeForm)}>+ Outcome</button></div>{showOutcomeForm && <div className="inline-form"><label>Mitra<select value={outcomeForm.partner_id} onChange={e=>setOutcomeForm({...outcomeForm,partner_id:e.target.value})}><option value="">Pilih mitra</option>{partnerRows.map(p=><option key={p.id} value={p.id}>{p.business_name}</option>)}</select></label><label>Nama Outcome<input value={outcomeForm.name} onChange={e=>setOutcomeForm({...outcomeForm,name:e.target.value})} placeholder="Contoh: peningkatan omzet" /></label><label>Indikator<input value={outcomeForm.indicator} onChange={e=>setOutcomeForm({...outcomeForm,indicator:e.target.value})} placeholder="Contoh: omzet bulanan" /></label><label>Unit<input value={outcomeForm.unit} onChange={e=>setOutcomeForm({...outcomeForm,unit:e.target.value})} placeholder="Rp / % / transaksi / orang" /></label><label>Baseline<input type="number" value={outcomeForm.baseline} onChange={e=>setOutcomeForm({...outcomeForm,baseline:e.target.value})} /></label><label>Current Value<input type="number" value={outcomeForm.current_value} onChange={e=>setOutcomeForm({...outcomeForm,current_value:e.target.value})} /></label><button onClick={createOutcome} disabled={savingData}>Simpan Outcome</button></div>}<div className="table-wrap"><table><thead><tr><th>Mitra</th><th>Outcome</th><th>Indikator</th><th>Baseline</th><th>Current</th><th>Status</th></tr></thead><tbody>{outcomeRows.map(o=><tr key={o.id}><td>{partnerRows.find(p=>p.id===o.partner_id)?.business_name||"—"}</td><td><strong>{o.name}</strong></td><td>{o.indicator}</td><td>{o.baseline ?? "—"} {o.unit||""}</td><td>{o.current_value ?? "—"} {o.unit||""}</td><td><span className="status-badge">{o.status}</span></td></tr>)}{outcomeRows.length===0&&<tr><td colSpan={6} className="empty">Belum ada outcome.</td></tr>}</tbody></table></div></section>}
          {activeTab==="evidence" && <section className="data-panel"><div className="section-toolbar"><div><div className="eyebrow">EVIDENCE & VERIFICATION</div><h2>Evidence Control</h2><p>Evidence wajib terkait outcome. Status terverifikasi menjadi gate untuk tahap impact/SROI.</p></div><button onClick={()=>setShowEvidenceForm(!showEvidenceForm)}>+ Evidence</button></div>{showEvidenceForm && <div className="inline-form"><label>Outcome<select value={evidenceForm.outcome_id} onChange={e=>setEvidenceForm({...evidenceForm,outcome_id:e.target.value})}><option value="">Pilih outcome</option>{outcomeRows.map(o=><option key={o.id} value={o.id}>{o.name} — {partnerRows.find(p=>p.id===o.partner_id)?.business_name||"Mitra"}</option>)}</select></label><label>Jenis Sumber<select value={evidenceForm.source_type} onChange={e=>setEvidenceForm({...evidenceForm,source_type:e.target.value})}><option>DOCUMENT</option><option>PHOTO</option><option>REPORT</option><option>SURVEY</option><option>OTHER</option></select></label><label>Referensi Sumber<input value={evidenceForm.source_reference} onChange={e=>setEvidenceForm({...evidenceForm,source_reference:e.target.value})} placeholder="Nomor dokumen / catatan sumber" /></label><label>Periode Evidence<input type="date" value={evidenceForm.evidence_period} onChange={e=>setEvidenceForm({...evidenceForm,evidence_period:e.target.value})} /></label><label>File Evidence<input type="file" accept="application/pdf,image/*" onChange={e=>e.target.files?.[0] && submitEvidence(e.target.files[0])} disabled={savingData} /></label></div>}<div className="table-wrap"><table><thead><tr><th>Outcome</th><th>Sumber</th><th>Periode</th><th>Status</th><th>Verifikasi</th></tr></thead><tbody>{evidenceRows.map(ev=><tr key={ev.id}><td><strong>{outcomeRows.find(o=>o.id===ev.outcome_id)?.name||"—"}</strong></td><td>{ev.source_type||"—"}<br/><small>{ev.source_reference||""}</small></td><td>{ev.evidence_period||"—"}</td><td><span className="status-badge">{ev.status}</span></td><td>{ev.status==="SUBMITTED" && (role==="OWNER" || role==="PROGRAM_MANAGER") ? <div className="verify-actions"><button onClick={()=>verifyEvidence(ev.id,true)} disabled={savingData}>Verify</button><button onClick={()=>verifyEvidence(ev.id,false)} disabled={savingData}>Reject</button></div> : ev.status==="VERIFIED" ? "✓ Verified" : "—"}</td></tr>)}{evidenceRows.length===0&&<tr><td colSpan={5} className="empty">Belum ada evidence.</td></tr>}</tbody></table></div><p className="method">NO EVIDENCE → NO VERIFIED OUTCOME → NO VERIFIED SROI.</p></section>}
          {activeTab==="sroi" && <section className="data-panel"><div className="section-toolbar"><div><div className="eyebrow">FINANCIAL PROXY & SROI</div><h2>Impact Valuation</h2><p>Proxy harus disetujui dan outcome harus memiliki evidence VERIFIED sebelum SROI dapat dihitung.</p></div></div>
            <div className="split-grid">
              <article className="sub-panel"><div className="section-toolbar"><div><h3>Financial Proxy</h3><p>Catat nilai moneter proxy beserta sumber metodologinya.</p></div><button onClick={()=>setShowProxyForm(!showProxyForm)}>+ Proxy</button></div>
              {showProxyForm && <div className="inline-form"><label>Outcome<select value={proxyForm.outcome_id} onChange={e=>setProxyForm({...proxyForm,outcome_id:e.target.value})}><option value="">Pilih outcome</option>{outcomeRows.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label>Nama Proxy<input value={proxyForm.proxy_name} onChange={e=>setProxyForm({...proxyForm,proxy_name:e.target.value})} placeholder="Contoh: nilai tambahan omzet" /></label><label>Proxy Value<input type="number" value={proxyForm.proxy_value} onChange={e=>setProxyForm({...proxyForm,proxy_value:e.target.value})} /></label><label>Unit<input value={proxyForm.unit} onChange={e=>setProxyForm({...proxyForm,unit:e.target.value})} placeholder="Rp / outcome" /></label><label>Sumber Metodologi<input value={proxyForm.methodology_source} onChange={e=>setProxyForm({...proxyForm,methodology_source:e.target.value})} placeholder="Sumber / studi / dokumen" /></label><label>Catatan Asumsi<textarea value={proxyForm.assumption_note} onChange={e=>setProxyForm({...proxyForm,assumption_note:e.target.value})} /></label><button onClick={createProxy} disabled={savingData}>Simpan Proxy</button></div>}
              <div className="table-wrap"><table><thead><tr><th>Outcome</th><th>Proxy</th><th>Value</th><th>Status</th><th>Approval</th></tr></thead><tbody>{proxyRows.map(p=><tr key={p.id}><td>{outcomeRows.find(o=>o.id===p.outcome_id)?.name||"—"}</td><td><strong>{p.proxy_name}</strong></td><td>{p.proxy_value} {p.unit||""}</td><td><span className="status-badge">{p.approval_status}</span></td><td>{p.approval_status==="PENDING" && (role==="OWNER"||role==="PROGRAM_MANAGER") ? <button onClick={()=>approveProxy(p.id)} disabled={savingData}>Approve</button> : p.approval_status==="APPROVED" ? "✓ Approved" : "—"}</td></tr>)}{proxyRows.length===0&&<tr><td colSpan={5} className="empty">Belum ada financial proxy.</td></tr>}</tbody></table></div></article>
              <article className="sub-panel"><div className="section-toolbar"><div><h3>SROI Calculation</h3><p>Hasil berstatus ESTIMATED dan menyimpan calculation trace.</p></div><button onClick={()=>setShowSroiForm(!showSroiForm)}>+ Hitung SROI</button></div>
              {showSroiForm && <div className="inline-form"><label>Program<select value={sroiForm.program_id} onChange={e=>setSroiForm({...sroiForm,program_id:e.target.value})}><option value="">Pilih program</option>{programRows.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Investment<input type="number" value={sroiForm.investment} onChange={e=>setSroiForm({...sroiForm,investment:e.target.value})} /></label><label>Approved Proxy<select value={sroiForm.proxy_id} onChange={e=>setSroiForm({...sroiForm,proxy_id:e.target.value})}><option value="">Pilih proxy</option>{proxyRows.filter(p=>p.approval_status==="APPROVED").map(p=><option key={p.id} value={p.id}>{p.proxy_name}</option>)}</select></label><label>Gross Outcome Value<input type="number" value={sroiForm.gross_value} onChange={e=>setSroiForm({...sroiForm,gross_value:e.target.value})} /></label><label>Deadweight %<input type="number" min="0" max="100" value={sroiForm.deadweight} onChange={e=>setSroiForm({...sroiForm,deadweight:e.target.value})} /></label><label>Attribution %<input type="number" min="0" max="100" value={sroiForm.attribution} onChange={e=>setSroiForm({...sroiForm,attribution:e.target.value})} /></label><label>Displacement %<input type="number" min="0" max="100" value={sroiForm.displacement} onChange={e=>setSroiForm({...sroiForm,displacement:e.target.value})} /></label><label>Drop-off %<input type="number" min="0" max="100" value={sroiForm.drop_off} onChange={e=>setSroiForm({...sroiForm,drop_off:e.target.value})} /></label><button onClick={calculateSroi} disabled={savingData}>Hitung & Simpan</button></div>}
              <div className="table-wrap"><table><thead><tr><th>Program</th><th>Investment</th><th>Impact Value</th><th>SROI</th><th>Status</th></tr></thead><tbody>{sroiRows.map(x=><tr key={x.id}><td>{programRows.find(p=>p.id===x.program_id)?.name||"—"}</td><td>Rp {Number(x.investment).toLocaleString("id-ID")}</td><td>Rp {Number(x.impact_value||0).toLocaleString("id-ID")}</td><td><strong>{x.sroi==null?"—":Number(x.sroi).toFixed(2)+":1"}</strong></td><td><span className="status-badge">{x.status}</span></td></tr>)}{sroiRows.length===0&&<tr><td colSpan={5} className="empty">Belum ada perhitungan SROI.</td></tr>}</tbody></table></div></article>
            </div><p className="method">SROI adalah estimasi metodologis. Proxy, deadweight, attribution, displacement, drop-off dan evidence harus dapat ditelusuri.</p></section>}
          {activeTab==="reports" && <section className="data-panel"><div className="section-toolbar"><div><div className="eyebrow">EXECUTIVE IMPACT REPORT</div><h2>Laporan Dampak Program</h2><p>Ringkasan eksekutif yang menghubungkan program, mitra, transaksi, outcome, evidence, proxy, dan estimated SROI.</p></div><button onClick={()=>setShowReportForm(!showReportForm)}>+ Report</button></div>
            {showReportForm && <div className="inline-form"><label>Program<select value={reportForm.program_id} onChange={e=>setReportForm({...reportForm,program_id:e.target.value})}><option value="">Pilih program</option>{programRows.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Periode<input type="date" value={reportForm.period} onChange={e=>setReportForm({...reportForm,period:e.target.value})} /></label><label>SROI Calculation<select value={reportForm.sroi_calculation_id} onChange={e=>setReportForm({...reportForm,sroi_calculation_id:e.target.value})}><option value="">Tanpa SROI</option>{sroiRows.filter(x=>x.status==="ESTIMATED").map(x=><option key={x.id} value={x.id}>{Number(x.sroi||0).toFixed(2)}:1 — {new Date(x.created_at).toLocaleDateString("id-ID")}</option>)}</select></label><label>Catatan Metodologi<textarea value={reportForm.methodology_note} onChange={e=>setReportForm({...reportForm,methodology_note:e.target.value})} placeholder="Catatan asumsi, batasan, dan sumber metodologi." /></label><button onClick={createReport} disabled={savingData}>Buat Draft Report</button></div>}
            <div className="report-grid"><div className="table-wrap"><table><thead><tr><th>Program</th><th>Periode</th><th>SROI</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{reportRows.map(r=>{const calc=sroiRows.find(x=>x.id===r.sroi_calculation_id); return <tr key={r.id}><td><strong>{programRows.find(p=>p.id===r.program_id)?.name||"—"}</strong></td><td>{r.period}</td><td>{calc?.sroi==null?"—":Number(calc.sroi).toFixed(2)+":1"}</td><td><span className="status-badge">{r.status}</span></td><td>{r.status==="DRAFT"&&role==="OWNER"?<button onClick={()=>approveReport(r.id)} disabled={savingData}>Approve</button>:"—"}</td></tr>})}{reportRows.length===0&&<tr><td colSpan={5} className="empty">Belum ada executive report.</td></tr>}</tbody></table></div></div>
            <div className="report-note"><strong>Struktur laporan:</strong> Program → Mitra Binaan → Aktivitas/Transaksi → Outcome & Indicator → Evidence Verified → Financial Proxy → Estimated SROI → Assumption & Limitation.</div>
          </section>}
          {activeTab==="partners" && <section className="data-panel"><div className="section-toolbar"><div><div className="eyebrow">PARTNER MANAGEMENT</div><h2>Mitra Binaan</h2><p>Registrasikan mitra binaan dan hubungkan langsung ke program TJSL.</p></div><button onClick={()=>setShowPartnerForm(!showPartnerForm)}>+ Mitra</button></div>
            {showPartnerForm && <div className="inline-form"><label>Program<select value={partnerForm.program_id} onChange={e=>setPartnerForm({...partnerForm,program_id:e.target.value})}><option value="">Pilih program</option>{programRows.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Nama Usaha<input value={partnerForm.business_name} onChange={e=>setPartnerForm({...partnerForm,business_name:e.target.value})} placeholder="Nama usaha mitra" /></label><label>Nama Pemilik<input value={partnerForm.owner_name} onChange={e=>setPartnerForm({...partnerForm,owner_name:e.target.value})} /></label><label>Alamat<textarea value={partnerForm.address} onChange={e=>setPartnerForm({...partnerForm,address:e.target.value})} /></label><button onClick={createPartner} disabled={savingData}>Simpan Mitra</button></div>}
            <div className="table-wrap"><table><thead><tr><th>Usaha</th><th>Program</th><th>Pemilik</th><th>Status</th></tr></thead><tbody>{partnerRows.map(p=><tr key={p.id}><td><strong>{p.business_name}</strong></td><td>{programRows.find(x=>x.id===p.program_id)?.name||"—"}</td><td>{p.owner_name||"—"}</td><td><span className="status-badge">{p.status}</span></td></tr>)}{partnerRows.length===0&&<tr><td colSpan={4} className="empty">Belum ada mitra binaan.</td></tr>}</tbody></table></div>
          </section>}
        </>}
      <footer>Supported by <img className="nortago-footer-logo" src="/nortago-mark.svg" alt="NORTAGO" /> <b>NORTAGO</b> · TJSL Impact Control Tower</footer>
    </main>
  );
}
