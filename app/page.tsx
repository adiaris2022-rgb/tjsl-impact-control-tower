"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are not configured.");
  return createClient(url, key);
}

export default function ControlTower() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [role, setRole] = useState("");
  const [businessName, setBusinessName] = useState("TJSL Impact Control Tower");
  const [stats, setStats] = useState({ programs:0, partners:0, transactions:0, value:0 });

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({data}) => {
      setUser(data.session?.user ?? null);
      if (data.session?.user) load(data.session.user);
      else setLoading(false);
    }).catch(e => { setError(e instanceof Error ? e.message : "Gagal memuat sesi."); setLoading(false); });
    let listener: { subscription: { unsubscribe: () => void } } | null = null;
    try {
      const result = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) void load(session.user);
      });
      listener = result.data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menginisialisasi autentikasi.");
    }
    return () => listener?.subscription.unsubscribe();
  }, []);

  async function load(currentUser: User) {
    let s;
    try { s = getSupabase(); } catch (e) { setError(e instanceof Error ? e.message : "Konfigurasi Supabase tidak tersedia."); setLoading(false); return; }
    const {data: bu, error: e} = await s.from("business_users").select("business_id,role").eq("user_id", currentUser.id).maybeSingle();
    if (e || !bu) { setError(e?.message ?? "Akun belum terdaftar pada TJSL Impact Control Tower."); setLoading(false); return; }
    setRole(bu.role);
    const [b,p,pa,t] = await Promise.all([
      s.from("businesses").select("name").eq("id",bu.business_id).maybeSingle(),
      s.from("tjsl_programs").select("id",{count:"exact",head:true}),
      s.from("tjsl_partners").select("id",{count:"exact",head:true}),
      s.from("tjsl_transactions").select("amount").in("status",["SUCCESS","PICKUP_VERIFIED","HANDED_OVER_TO_DELIVERY"])
    ]);
    setBusinessName(b.data?.name ?? "TJSL Impact Control Tower");
    const tx=t.data??[];
    setStats({programs:p.count??0,partners:pa.count??0,transactions:tx.length,value:tx.reduce((n,x)=>n+Number(x.amount??0),0)});
    setLoading(false);
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault(); setSigning(true); setError("");
    const {error:e1}=await getSupabase().auth.signInWithPassword({email,password});
    if(e1) setError(e1.message);
    setSigning(false);
  }
  async function signOut(){ await getSupabase().auth.signOut(); setRole(""); }
  const money=(v:number)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(v);

  if(!user) return <main className="auth-shell"><section className="login-card"><div className="brand"><span className="mark">A</span><div><strong>NORTAGO</strong><small>AI-Powered Digital Products & Content</small></div></div><div className="eyebrow">TJSL IMPACT CONTROL TOWER</div><h1>Data TJSL.<br/><span>Dampak yang dapat diuji.</span></h1><p className="lead">Satu control tower untuk program, transaksi mitra, outcome, evidence, dan estimasi SROI.</p><form onSubmit={signIn}><label>Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required /></label><label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" required /></label>{error&&<div className="error">{error}</div>}<button disabled={signing}>{signing?"Masuk...":"Masuk ke Control Tower →"}</button></form><div className="footnote">Supported by <b>NORTAGO</b> · Staging</div></section></main>;

  return <main className="app-shell"><header className="topbar"><div className="brand"><span className="mark">A</span><div><strong>TJSL IMPACT CONTROL TOWER</strong><small>{businessName}</small></div></div><div className="userbox"><span>{role}</span><button className="ghost" onClick={signOut}>Keluar</button></div></header><section className="hero"><div><div className="eyebrow">EXECUTIVE CONTROL TOWER</div><h1>Program → Data → Evidence → Impact</h1><p>Ringkasan eksekutif berbasis data dalam scope akun Anda.</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}><a className="status" href="/operator-settings"><i/> OPERATOR SETTINGS →</a><a className="status" href="/otc"><i/> BUKA NORTAGO OTC →</a></div></section>{loading?<div className="loading">Memuat data…</div>:<section className="grid">{[["Program",stats.programs,"Program aktif"],["Mitra Binaan",stats.partners,"Dalam scope akun"],["Transaksi",stats.transactions,"Status valid"],["Nilai Transaksi",money(stats.value),"Real transaction evidence"]].map(([a,b,c])=><article className="metric" key={String(a)}><div className="metric-title">{a}</div><div className="metric-value">{b}</div><div className="metric-note">{c}</div></article>)}</section>}<footer>Supported by <b>NORTAGO</b> · TJSL Impact Control Tower · Free infrastructure mode · NORTAGO OTC enabled</footer></main>;
}
