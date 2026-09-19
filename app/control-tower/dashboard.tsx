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
  const [activeTab, setActiveTab] = useState<"overview"|"programs"|"partners"|"outcomes">("overview");
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [programForm, setProgramForm] = useState({name:"", reporting_period:""});
  const [partnerForm, setPartnerForm] = useState({program_id:"", business_name:"", owner_name:"", address:""});
  const [savingData, setSavingData] = useState(false);\n  const [outcomeRows, setOutcomeRows] = useState<any[]>([]);\n  const [showOutcomeForm, setShowOutcomeForm] = useState(false);\n  const [outcomeForm, setOutcomeForm] = useState({partner_id:"",name:"",indicator:"",baseline:"",current_value:"",unit:""});

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
    const [biz, programs, partners, transactions, outcomes, evidence, proxies, sroi, programList, partnerList] = await Promise.all([
      supabase.from("businesses").select("name, logo_url").eq("id", bu.business_id).maybeSingle(),
      supabase.from("tjsl_programs").select("id", { count: "exact", head: true }),
      supabase.from("tjsl_partners").select("id", { count: "exact", head: true }),
      supabase.from("tjsl_transactions").select("amount").in("status", ["SUCCESS","PICKUP_VERIFIED","HANDED_OVER_TO_DELIVERY"]),
      supabase.from("tjsl_outcomes").select("id", { count: "exact", head: true }),
      supabase.from("tjsl_evidence").select("id", { count: "exact", head: true }).eq("status", "VERIFIED"),
      supabase.from("tjsl_financial_proxies").select("id", { count: "exact", head: true }).eq("approval_status", "APPROVED"),
      supabase.from("tjsl_sroi_calculations").select("sroi").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("tjsl_programs").select("id,name,reporting_period,status,created_at").order("created_at", { ascending: false }),
      supabase.from("tjsl_partners").select("id,program_id,business_name,owner_name,address,status,created_at").order("created_at", { ascending: false }),\n      supabase.from("tjsl_outcomes").select("id,partner_id,name,indicator,baseline,current_value,unit,status").order("created_at", { ascending: false })
    ]);

    const firstError = [biz, programs, partners, transactions, outcomes, evidence, proxies, sroi, programList, partnerList, outcomeList].find(x => x.error);
    if (firstError?.error) setError(firstError.error.message);
    setBusinessName(biz.data?.name ?? "Perusahaan Anda");
    setCompanyNameDraft(biz.data?.name ?? "Perusahaan Anda");
    setBusinessLogoUrl(biz.data?.logo_url ?? null);
    setProgramRows(programList.data ?? []);
    setPartnerRows(partnerList.data ?? []);\n    setOutcomeRows(outcomeList.data ?? []);
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

\n  async function createOutcome() {\n    if (!outcomeForm.partner_id || !outcomeForm.name.trim() || !outcomeForm.indicator.trim()) return;\n    setSavingData(true); setError("");\n    const payload = { partner_id: outcomeForm.partner_id, name: outcomeForm.name.trim(), indicator: outcomeForm.indicator.trim(), baseline: outcomeForm.baseline === "" ? null : Number(outcomeForm.baseline), current_value: outcomeForm.current_value === "" ? null : Number(outcomeForm.current_value), unit: outcomeForm.unit.trim() || null, status: "DRAFT" };\n    const { error } = await getSupabase().from("tjsl_outcomes").insert(payload);\n    if (error) setError(error.message);\n    else { setOutcomeForm({partner_id:"",name:"",indicator:"",baseline:"",current_value:"",unit:""}); setShowOutcomeForm(false); if (user) await loadDashboard(user); }\n    setSavingData(false);\n  }\n  async function signOut() {
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
            <button className={activeTab==="partners"?"active":""} onClick={()=>setActiveTab("partners")}>Mitra Binaan</button>\n            <button className={activeTab==="outcomes"?"active":""} onClick={()=>setActiveTab("outcomes")}>Outcome</button>
          </nav>
          {activeTab==="overview" && <><section className="grid">{cards.map(([title,value,note]) => <article className="metric" key={title}><div className="metric-title">{title}</div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></article>)}</section>
            <section className="panels"><article className="panel"><div className="panel-head"><div><div className="eyebrow">IMPACT CHAIN</div><h2>Jejak data program</h2></div><span className="pill">TRACEABLE</span></div><div className="chain">{["Program","Mitra Binaan","Transaksi","Outcome","Evidence","SROI"].map((x,i)=><div className="chain-item" key={x}><b>0{i+1}</b><span>{x}</span>{i<5&&<em>→</em>}</div>)}</div><p className="method">Transaksi adalah activity evidence. Outcome memerlukan evidence dan verifikasi. SROI hanya dihitung melalui input yang memenuhi gate metodologi.</p></article>
              <article className="panel"><div className="panel-head"><div><div className="eyebrow">WORKFLOW</div><h2>Control Tower</h2></div></div><ul className="steps"><li><span>01</span>Program & Mitra</li><li><span>02</span>Outcome & Indicator</li><li><span>03</span>Evidence & Verification</li><li><span>04</span>Financial Proxy</li><li><span>05</span>SROI & Executive Report</li></ul></article></section>
          </>}
          {activeTab==="programs" && <section className="data-panel"><div className="section-toolbar"><div><div className="eyebrow">PROGRAM MANAGEMENT</div><h2>Program TJSL</h2><p>Kelola program dan periode pelaporan dalam satu tempat.</p></div><button onClick={()=>setShowProgramForm(!showProgramForm)}>+ Program</button></div>
            {showProgramForm && <div className="inline-form"><label>Nama Program<input value={programForm.name} onChange={e=>setProgramForm({...programForm,name:e.target.value})} placeholder="Contoh: Digitalisasi Mitra Binaan" /></label><label>Periode Pelaporan<input type="date" value={programForm.reporting_period} onChange={e=>setProgramForm({...programForm,reporting_period:e.target.value})} /></label><button onClick={createProgram} disabled={savingData}>Simpan Program</button></div>}
            <div className="table-wrap"><table><thead><tr><th>Program</th><th>Periode</th><th>Status</th><th>Dibuat</th></tr></thead><tbody>{programRows.map(p=><tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.reporting_period||"—"}</td><td><span className="status-badge">{p.status}</span></td><td>{new Date(p.created_at).toLocaleDateString("id-ID")}</td></tr>)}{programRows.length===0&&<tr><td colSpan={4} className="empty">Belum ada program. Buat program pertama.</td></tr>}</tbody></table></div>
          </section>}
          {activeTab==="outcomes" && <section className="data-panel"><div className="section-toolbar"><div><div className="eyebrow">OUTCOME & INDICATOR</div><h2>Outcome Program</h2><p>Catat perubahan yang ingin diukur. Transaksi tidak otomatis dianggap sebagai outcome.</p></div><button onClick={()=>setShowOutcomeForm(!showOutcomeForm)}>+ Outcome</button></div>{showOutcomeForm && <div className="inline-form"><label>Mitra<select value={outcomeForm.partner_id} onChange={e=>setOutcomeForm({...outcomeForm,partner_id:e.target.value})}><option value="">Pilih mitra</option>{partnerRows.map(p=><option key={p.id} value={p.id}>{p.business_name}</option>)}</select></label><label>Nama Outcome<input value={outcomeForm.name} onChange={e=>setOutcomeForm({...outcomeForm,name:e.target.value})} placeholder="Contoh: peningkatan omzet" /></label><label>Indikator<input value={outcomeForm.indicator} onChange={e=>setOutcomeForm({...outcomeForm,indicator:e.target.value})} placeholder="Contoh: omzet bulanan" /></label><label>Unit<input value={outcomeForm.unit} onChange={e=>setOutcomeForm({...outcomeForm,unit:e.target.value})} placeholder="Rp / % / transaksi / orang" /></label><label>Baseline<input type="number" value={outcomeForm.baseline} onChange={e=>setOutcomeForm({...outcomeForm,baseline:e.target.value})} /></label><label>Current Value<input type="number" value={outcomeForm.current_value} onChange={e=>setOutcomeForm({...outcomeForm,current_value:e.target.value})} /></label><button onClick={createOutcome} disabled={savingData}>Simpan Outcome</button></div>}<div className="table-wrap"><table><thead><tr><th>Mitra</th><th>Outcome</th><th>Indikator</th><th>Baseline</th><th>Current</th><th>Status</th></tr></thead><tbody>{outcomeRows.map(o=><tr key={o.id}><td>{partnerRows.find(p=>p.id===o.partner_id)?.business_name||"—"}</td><td><strong>{o.name}</strong></td><td>{o.indicator}</td><td>{o.baseline ?? "—"} {o.unit||""}</td><td>{o.current_value ?? "—"} {o.unit||""}</td><td><span className="status-badge">{o.status}</span></td></tr>)}{outcomeRows.length===0&&<tr><td colSpan={6} className="empty">Belum ada outcome.</td></tr>}</tbody></table></div></section>}\n          {activeTab==="partners" && <section className="data-panel"><div className="section-toolbar"><div><div className="eyebrow">PARTNER MANAGEMENT</div><h2>Mitra Binaan</h2><p>Registrasikan mitra binaan dan hubungkan langsung ke program TJSL.</p></div><button onClick={()=>setShowPartnerForm(!showPartnerForm)}>+ Mitra</button></div>
            {showPartnerForm && <div className="inline-form"><label>Program<select value={partnerForm.program_id} onChange={e=>setPartnerForm({...partnerForm,program_id:e.target.value})}><option value="">Pilih program</option>{programRows.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Nama Usaha<input value={partnerForm.business_name} onChange={e=>setPartnerForm({...partnerForm,business_name:e.target.value})} placeholder="Nama usaha mitra" /></label><label>Nama Pemilik<input value={partnerForm.owner_name} onChange={e=>setPartnerForm({...partnerForm,owner_name:e.target.value})} /></label><label>Alamat<textarea value={partnerForm.address} onChange={e=>setPartnerForm({...partnerForm,address:e.target.value})} /></label><button onClick={createPartner} disabled={savingData}>Simpan Mitra</button></div>}
            <div className="table-wrap"><table><thead><tr><th>Usaha</th><th>Program</th><th>Pemilik</th><th>Status</th></tr></thead><tbody>{partnerRows.map(p=><tr key={p.id}><td><strong>{p.business_name}</strong></td><td>{programRows.find(x=>x.id===p.program_id)?.name||"—"}</td><td>{p.owner_name||"—"}</td><td><span className="status-badge">{p.status}</span></td></tr>)}{partnerRows.length===0&&<tr><td colSpan={4} className="empty">Belum ada mitra binaan.</td></tr>}</tbody></table></div>
          </section>}
        </>}
      <footer>Supported by <img className="nortago-footer-logo" src="/nortago-mark.svg" alt="NORTAGO" /> <b>NORTAGO</b> · TJSL Impact Control Tower</footer>
    </main>
  );
}
