"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are not configured.");
  return createClient(url, key);
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

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState("");
  const [businessName, setBusinessName] = useState("TJSL Impact Control Tower");
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
    const [biz, programs, partners, transactions, outcomes, evidence, proxies, sroi] = await Promise.all([
      supabase.from("businesses").select("name").eq("id", bu.business_id).maybeSingle(),
      supabase.from("tjsl_programs").select("id", { count: "exact", head: true }),
      supabase.from("tjsl_partners").select("id", { count: "exact", head: true }),
      supabase.from("tjsl_transactions").select("amount").in("status", ["SUCCESS","PICKUP_VERIFIED","HANDED_OVER_TO_DELIVERY"]),
      supabase.from("tjsl_outcomes").select("id", { count: "exact", head: true }),
      supabase.from("tjsl_evidence").select("id", { count: "exact", head: true }).eq("status", "VERIFIED"),
      supabase.from("tjsl_financial_proxies").select("id", { count: "exact", head: true }).eq("approval_status", "APPROVED"),
      supabase.from("tjsl_sroi_calculations").select("sroi").order("created_at", { ascending: false }).limit(1).maybeSingle()
    ]);

    const firstError = [biz, programs, partners, transactions, outcomes, evidence, proxies, sroi].find(x => x.error);
    if (firstError?.error) setError(firstError.error.message);
    setBusinessName(biz.data?.name ?? "TJSL Impact Control Tower");
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

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setSigning(true); setError("");
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal masuk.");
    } finally {
      setSigning(false);
    }
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

  if (!user) return (
    <main className="auth-shell">
      <section className="login-card">
        <div className="brand"><span className="mark">A</span><div><strong>NORTAGO</strong><small>AI-Powered Digital Products & Content</small></div></div>
        <div className="eyebrow">TJSL IMPACT CONTROL TOWER</div>
        <h1>Data TJSL.<br/><span>Dampak yang dapat diuji.</span></h1>
        <p className="lead">Satu control tower untuk memantau program, transaksi mitra, outcome, evidence, dan estimasi SROI.</p>
        <form onSubmit={signIn}>
          <label>Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required placeholder="nama@perusahaan.id" /></label>
          <label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" required placeholder="••••••••" /></label>
          {error && <div className="error">{error}</div>}
          <button disabled={signing}>{signing ? "Masuk..." : "Masuk ke Control Tower →"}</button>
        </form>
        <div className="footnote">Supported by <b>NORTAGO</b> · Staging</div>
      </section>
    </main>
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="mark">A</span><div><strong>TJSL IMPACT CONTROL TOWER</strong><small>{businessName}</small></div></div>
        <div className="userbox"><span>{role}</span><button className="ghost" onClick={signOut}>Keluar</button></div>
      </header>
      <section className="hero">
        <div><div className="eyebrow">EXECUTIVE CONTROL TOWER</div><h1>Program → Data → Evidence → Impact</h1><p>Ringkasan eksekutif berbasis data yang tersedia dalam scope akun Anda.</p></div>
        <div className="status"><i/> SYSTEM ONLINE <small>STAGING</small></div>
      </section>
      {error && <div className="error page-error">{error}</div>}
      {loading ? <div className="loading">Memuat data control tower…</div> :
        <><section className="grid">{cards.map(([title,value,note]) => <article className="metric" key={title}><div className="metric-title">{title}</div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></article>)}</section>
        <section className="panels">
          <article className="panel"><div className="panel-head"><div><div className="eyebrow">IMPACT CHAIN</div><h2>Jejak data program</h2></div><span className="pill">TRACEABLE</span></div>
            <div className="chain">{["Program","Mitra Binaan","Transaksi","Outcome","Evidence","SROI"].map((x,i)=><div className="chain-item" key={x}><b>0{i+1}</b><span>{x}</span>{i<5&&<em>→</em>}</div>)}</div>
            <p className="method">Transaksi adalah activity evidence. Outcome memerlukan evidence dan verifikasi. SROI hanya dihitung melalui input yang memenuhi gate metodologi.</p>
          </article>
          <article className="panel"><div className="panel-head"><div><div className="eyebrow">NEXT WORKFLOW</div><h2>Area yang siap dikembangkan</h2></div></div>
            <ul className="steps"><li><span>01</span>Program & Mitra</li><li><span>02</span>Outcome & Indicator</li><li><span>03</span>Evidence & Verification</li><li><span>04</span>Financial Proxy</li><li><span>05</span>SROI & Executive Report</li></ul>
          </article>
        </section></>}
      <footer>Supported by <b>NORTAGO</b> · TJSL Impact Control Tower · Free infrastructure mode</footer>
    </main>
  );
}
