"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  const [forgot, setForgot] = useState(false);
  const [signup, setSignup] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [signupSent, setSignupSent] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [role, setRole] = useState("");
  const [businessName, setBusinessName] = useState("TJSL Impact Control Tower");
  const [stats, setStats] = useState({ programs:0, partners:0, transactions:0, value:0 });
  const router = useRouter();

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
        if (data.session?.user) { router.replace("/control-tower/bos"); return; }
        else setLoading(false);

        const result = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null);
          if (session?.user) router.replace("/control-tower/bos");
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
    else router.replace("/control-tower/bos");
    setSigning(false);
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setRegistering(true); setError(""); setSignupSent(false);
    try {
      if (password.length < 8) throw new Error("Password minimal 8 karakter.");
      const s = await getSupabase();
      const { data, error: e1 } = await s.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      if (e1) throw e1;
      if (data.session) {
        setError("Akun berhasil dibuat, tetapi akun belum memiliki akses bisnis. Hubungi owner untuk aktivasi.");
        return;
      }
      setSignupSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat akun.");
    } finally {
      setRegistering(false);
    }
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setResetting(true); setError(""); setResetSent(false);
    try {
      const s = await getSupabase();
      const { error: e1 } = await s.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (e1) throw e1;
      setResetSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengirim link reset password.");
    } finally {
      setResetting(false);
    }
  }
  async function signOut(){ await (await getSupabase()).auth.signOut(); setRole(""); }
  const money=(v:number)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(v);

  if(!user) return <main className="auth-shell">
    <section className="login-card">
      <div className="brand">
        <span style={{display:"inline-flex",width:54,height:48,alignItems:"center",justifyContent:"center",flex:"0 0 auto"}}>
          <svg viewBox="0 0 120 110" width="52" height="48" aria-label="NORTAGO logo" role="img" data-logo-lock="nortago-original-reference">
            <defs>
              <linearGradient id="nortagoLockedLeft" x1="18" y1="96" x2="66" y2="18" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#18e4c6"/>
                <stop offset="0.55" stopColor="#10cfe0"/>
                <stop offset="1" stopColor="#18aee8"/>
              </linearGradient>
              <linearGradient id="nortagoLockedRight" x1="60" y1="18" x2="105" y2="96" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#16b8ed"/>
                <stop offset="0.55" stopColor="#1689ed"/>
                <stop offset="1" stopColor="#145be9"/>
              </linearGradient>
            </defs>
            <path d="M24 91 L64 22" fill="none" stroke="url(#nortagoLockedLeft)" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M62 22 L103 91" fill="none" stroke="url(#nortagoLockedRight)" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <div>
          <strong style={{fontSize:22,letterSpacing:1.2,color:"#fff"}}>NORTAGO</strong>
          <small>Business Operating System</small>
        </div>
      </div>

      <div className="eyebrow">CT BOS · MENARA KENDALI BISNIS</div>
      <h1><span>Menara Kendali Bisnis.</span><br/>Ambil keputusan lebih cepat.</h1>
      <p className="lead">Satu control tower untuk melihat penjualan, operasional, procurement, finance, people, risiko, dan kinerja bisnis dalam satu sistem.</p>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,margin:"22px 0 26px"}}>
        {["SALES","OPERATIONS","FINANCE"].map((item)=><div key={item} style={{border:"1px solid rgba(255,255,255,.10)",borderRadius:10,padding:"9px 7px",textAlign:"center",fontSize:10,letterSpacing:1.2,color:"rgba(255,255,255,.65)"}}>{item}</div>)}
      </div>

      {!forgot && !signup ? <form onSubmit={signIn}>
        <label>Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" required /></label>
        <label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" required /></label>
        {error&&<div className="error">{error}</div>}
        <button disabled={signing}>{signing?"Memverifikasi...":"Masuk ke CT BOS →"}</button>
        <div style={{display:"flex",justifyContent:"center",gap:14,alignItems:"center",marginTop:2}}>
          <button type="button" onClick={()=>{setForgot(true);setSignup(false);setError("");setResetSent(false)}} style={{background:"transparent",border:"0",color:"#67d9c3",fontSize:12,padding:"4px",boxShadow:"none"}}>Lupa password?</button>
          <span style={{color:"rgba(255,255,255,.18)"}}>·</span>
          <button type="button" onClick={()=>{setSignup(true);setForgot(false);setError("");setSignupSent(false);setPassword("");}} style={{background:"transparent",border:"0",color:"#67d9c3",fontSize:12,padding:"4px",boxShadow:"none"}}>Daftar akun</button>
        </div>
      </form> : signup ? <form onSubmit={signUp}>
        <div style={{fontSize:20,fontWeight:800,marginBottom:4}}>Daftar akun</div>
        <div style={{fontSize:12,lineHeight:1.55,color:"#8fa9a5",marginBottom:8}}>Buat akun CT BOS menggunakan email Anda. Setelah pendaftaran, cek email untuk verifikasi akun.</div>
        <label>Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" required /></label>
        <label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="new-password" minLength={8} required /></label>
        <label>Konfirmasi Password<input type="password" autoComplete="new-password" required onChange={e=>{if(e.target.value!==password){setError("Konfirmasi password tidak sama.");}else if(error==="Konfirmasi password tidak sama.")setError("");}} /></label>
        {signupSent&&<div style={{fontSize:12,lineHeight:1.5,color:"#67d9c3",padding:"10px 12px",border:"1px solid #28584f",borderRadius:10}}>Akun berhasil didaftarkan. Cek inbox email Anda dan klik link verifikasi.</div>}
        {error&&<div className="error">{error}</div>}
        <button disabled={registering}>{registering?"Mendaftarkan...":"Daftar ke CT BOS →"}</button>
        <button type="button" onClick={()=>{setSignup(false);setError("");setSignupSent(false);setPassword("");}} style={{background:"transparent",border:"0",color:"#8fa9a5",fontSize:12,padding:"4px",boxShadow:"none"}}>← Kembali ke login</button>
      </form> : <form onSubmit={sendReset}>
        <div style={{fontSize:20,fontWeight:800,marginBottom:4}}>Reset password</div>
        <div style={{fontSize:12,lineHeight:1.55,color:"#8fa9a5",marginBottom:8}}>Masukkan email akun CT BOS. Kami akan mengirimkan link untuk membuat password baru.</div>
        <label>Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" required /></label>
        {resetSent&&<div style={{fontSize:12,lineHeight:1.5,color:"#67d9c3",padding:"10px 12px",border:"1px solid #28584f",borderRadius:10}}>Link reset password sudah dikirim. Periksa inbox dan folder spam.</div>}
        {error&&<div className="error">{error}</div>}
        <button disabled={resetting}>{resetting?"Mengirim...":"Kirim link reset →"}</button>
        <button type="button" onClick={()=>{setForgot(false);setError("");setResetSent(false)}} style={{background:"transparent",border:"0",color:"#8fa9a5",fontSize:12,padding:"4px",boxShadow:"none"}}>← Kembali ke login</button>
      </form>}

      <div className="footnote">
        <b>CT BOS NORTAGO</b> · System of Record · Control · Intelligence · Visibility
      </div>
    </section>
  </main>;

  return <main className="app-shell"><header className="topbar"><div className="brand"><span className="mark">A</span><div><strong>TJSL IMPACT CONTROL TOWER</strong><small>{businessName}</small></div></div><div className="userbox"><span>{role}</span><button className="ghost" onClick={signOut}>Keluar</button></div></header><section className="hero"><div><div className="eyebrow">EXECUTIVE CONTROL TOWER</div><h1>Program → Data → Evidence → Impact</h1><p>Ringkasan eksekutif berbasis data dalam scope akun Anda.</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}><a className="status" href="/operator-settings"><i/> OPERATOR SETTINGS →</a><a className="status" href="/otc"><i/> BUKA NORTAGO OTC →</a></div></section>{loading?<div className="loading">Memuat data…</div>:<section className="grid">{[["Program",stats.programs,"Program aktif"],["Mitra Binaan",stats.partners,"Dalam scope akun"],["Transaksi",stats.transactions,"Status valid"],["Nilai Transaksi",money(stats.value),"Real transaction evidence"]].map(([a,b,c])=><article className="metric" key={String(a)}><div className="metric-title">{a}</div><div className="metric-value">{b}</div><div className="metric-note">{c}</div></article>)}</section>}<footer>Supported by <b>NORTAGO</b> · TJSL Impact Control Tower · Free infrastructure mode · NORTAGO OTC enabled</footer></main>;
}
