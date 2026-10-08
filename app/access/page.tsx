"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const PUBLIC_APP_URL = "https://nortago-ct-bos-production.up.railway.app";

export default function DirectAccessPage() {
  const [email,setEmail] = useState("");
  const [busy,setBusy] = useState(false);
  const [sent,setSent] = useState(false);
  const [error,setError] = useState("");

  async function sendLink(e:React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSent(false);
    setError("");
    try {
      const response = await fetch("/api/supabase-config", { cache:"no-store", signal:AbortSignal.timeout(10000) });
      const config = await response.json().catch(()=>({}));
      if (!response.ok || !config.url || !config.key) {
        throw new Error(config.error || "Konfigurasi autentikasi belum tersedia.");
      }
      const supabase = createBrowserClient(config.url, config.key);
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${PUBLIC_APP_URL}/auth/callback?next=/control-tower`,
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Link akses gagal dikirim.";
      setError(/rate limit/i.test(message)
        ? "Permintaan email sedang dibatasi sementara. Tunggu sekitar 1 menit lalu coba sekali lagi."
        : message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:"22px",background:"radial-gradient(circle at 50% 0%,rgba(103,217,195,.12),transparent 35%),#06100f",color:"#fff",fontFamily:"Inter,Arial,sans-serif"}}>
      <section style={{width:"100%",maxWidth:430,padding:26,border:"1px solid rgba(103,217,195,.2)",borderRadius:22,background:"#0a1917",boxSizing:"border-box"}}>
        <div style={{fontSize:11,letterSpacing:1.8,fontWeight:900,color:"#67d9c3"}}>NORTAGO · CT BOS</div>
        <h1 style={{fontSize:30,lineHeight:1.12,margin:"14px 0 8px"}}>Akses langsung</h1>
        <p style={{color:"#9db5b1",lineHeight:1.6,fontSize:14}}>Tidak perlu membuka landing page. Masukkan email untuk menerima link masuk langsung ke Control Tower.</p>
        <form onSubmit={sendLink}>
          <label style={{display:"block",marginTop:20,fontSize:12,color:"#b8cbc7"}}>Email</label>
          <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@email.com" style={{width:"100%",marginTop:8,padding:14,borderRadius:10,border:"1px solid rgba(255,255,255,.14)",background:"#071310",color:"#fff",boxSizing:"border-box"}} />
          <button disabled={busy} type="submit" style={{width:"100%",marginTop:14,padding:14,border:0,borderRadius:11,background:"#67d9c3",color:"#04100e",fontWeight:900}}>{busy?"Mengirim…":"Kirim Link Akses →"}</button>
        </form>
        {sent && <div style={{marginTop:14,padding:12,borderRadius:10,background:"rgba(103,217,195,.08)",border:"1px solid rgba(103,217,195,.25)",color:"#b8f1d3",fontSize:12}}>Link akses sudah dikirim. Gunakan email terbaru dan klik link tersebut satu kali.</div>}
        {error && <div style={{marginTop:14,padding:12,borderRadius:10,background:"#35171b",color:"#ffb4bd",fontSize:12}}>{error}</div>}
        <a href="/login" style={{display:"block",marginTop:18,textAlign:"center",color:"#9fc2cf",fontSize:12}}>Sudah punya password? Masuk dengan Email + Password</a>
      </section>
    </main>
  );
}
