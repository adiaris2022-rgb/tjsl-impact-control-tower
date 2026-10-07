"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";

async function getSupabase() {
  const response = await fetch("/api/supabase-config", { cache: "no-store" });
  const config = await response.json().catch(() => ({}));
  if (!response.ok || !config.url || !config.key) {
    throw new Error(config.error ?? "Supabase runtime configuration is not available.");
  }
  return createClient(config.url, config.key);
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
    let listener: { subscription: { unsubscribe: () => void } } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const supabase = await getSupabase();
        if (cancelled) return;
        const {data} = await supabase.auth.getSession();
        if (cancelled) return;
        setUser(data.session?.user ?? null);
        if (data.session?.user) void load(data.session.user);
        else setLoading(false);

        const result = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null);
          if (session?.user) void load(session.user);
        });
        listener = result.data;
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Gagal menginisialisasi autentikasi.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      listener?.subscription.unsubscribe();
    };
  }, []);

  async function load(currentUser: User) {
    let s;
    try { s = await getSupabase(); } catch (e) { setError(e instanceof Error ? e.message : "Konfigurasi Supabase tidak tersedia."); setLoading(false); return; }
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
    const {error:e1}=await (await getSupabase()).auth.signInWithPassword({email,password});
    if(e1) setError(e1.message);
    setSigning(false);
  }
  async function signOut(){ await (await getSupabase()).auth.signOut(); setRole(""); }
  const money=(v:number)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(v);

  if(!user) return <main className="auth-shell">
    <section className="login-card">
      <div className="brand">
        <span style={{display:"inline-flex",width:54,height:48,alignItems:"center",justifyContent:"center",flex:"0 0 auto"}}>
          <svg viewBox="0 0 100 90" width="50" height="45" aria-label="NORTAGO logo" role="img">
            <defs>
              <linearGradient id="nortagoLogoGradient" x1="8" y1="72" x2="92" y2="18" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#19e4c7"/>
                <stop offset="0.52" stopColor="#11cce2"/>
                <stop offset="1" stopColor="#1769ee"/>
              </linearGradient>
            </defs>
            <path d="M20 77 C14 77 10 72 12 66 L48 14 C52 8 60 6 66 10 C72 14 73 22 69 28 L34 78 C31 82 25 82 20 77 Z" fill="url(#nortagoLogoGradient)"/>
            <path d="M66 10 C72 6 80 9 84 15 L96 35 C99 41 97 48 91 52 C85 55 78 53 75 47 L62 27 C58 21 60 14 66 10 Z" fill="url(#nortagoLogoGradient)"/>
            <path d="M58 26 L75 47 C78 53 85 55 91 52 C85 56 78 56 73 51 L55 31 Z" fill="#0b75ea" opacity=".45"/>
          </svg>
        </span>
        <div>
          <strong style={{fontSize:22,letterSpacing:1.2,color:"#fff"}}>NORTAGO</strong>
          <small>Business Operating System</small>
        </div>
      </div>

      <div className="eyebrow">CT BOS · CONTROL TOWER BUSINESS OWNER SYSTEM</div>
      <h1>Control bisnis.<br/><span>Ambil keputusan lebih cepat.</span></h1>
      <p className="lead">Satu control tower untuk melihat penjualan, operasional, procurement, finance, people, risiko, dan kinerja bisnis dalam satu sistem.</p>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,margin:"22px 0 26px"}}>
        {["SALES","OPERATIONS","FINANCE"].map((item)=><div key={item} style={{border:"1px solid rgba(255,255,255,.10)",borderRadius:10,padding:"9px 7px",textAlign:"center",fontSize:10,letterSpacing:1.2,color:"rgba(255,255,255,.65)"}}>{item}</div>)}
      </div>

      <form onSubmit={signIn}>
        <label>Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" required /></label>
        <label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" required /></label>
        {error&&<div className="error">{error}</div>}
        <button disabled={signing}>{signing?"Memverifikasi...":"Masuk ke CT BOS →"}</button>
      </form>

      <div className="footnote">
        <b>CT BOS NORTAGO</b> · System of Record · Control · Intelligence · Visibility
      </div>
    </section>
  </main>;

  return <main className="app-shell"><header className="topbar"><div className="brand"><span className="mark">A</span><div><strong>TJSL IMPACT CONTROL TOWER</strong><small>{businessName}</small></div></div><div className="userbox"><span>{role}</span><button className="ghost" onClick={signOut}>Keluar</button></div></header><section className="hero"><div><div className="eyebrow">EXECUTIVE CONTROL TOWER</div><h1>Program → Data → Evidence → Impact</h1><p>Ringkasan eksekutif berbasis data dalam scope akun Anda.</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}><a className="status" href="/operator-settings"><i/> OPERATOR SETTINGS →</a><a className="status" href="/otc"><i/> BUKA NORTAGO OTC →</a></div></section>{loading?<div className="loading">Memuat data…</div>:<section className="grid">{[["Program",stats.programs,"Program aktif"],["Mitra Binaan",stats.partners,"Dalam scope akun"],["Transaksi",stats.transactions,"Status valid"],["Nilai Transaksi",money(stats.value),"Real transaction evidence"]].map(([a,b,c])=><article className="metric" key={String(a)}><div className="metric-title">{a}</div><div className="metric-value">{b}</div><div className="metric-note">{c}</div></article>)}</section>}<footer>Supported by <b>NORTAGO</b> · TJSL Impact Control Tower · Free infrastructure mode · NORTAGO OTC enabled</footer></main>;
}
