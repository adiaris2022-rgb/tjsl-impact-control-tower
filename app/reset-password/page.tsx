"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function ResetPasswordPage() {
  const [email,setEmail] = useState("");
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);

  async function requestReset(e:React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/supabase-config", { cache:"no-store", signal:AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("Konfigurasi Supabase belum tersedia.");
      const config = await response.json();
      const supabase = createBrowserClient(config.url, config.key);
      const redirectTo = `${window.location.origin}/update-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      setMessage("Jika email terdaftar, tautan reset password sudah dikirim. Periksa inbox dan folder Spam.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim reset password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:"24px",background:"#081116",color:"#f5f7f8",fontFamily:"Arial,sans-serif"}}>
      <form onSubmit={requestReset} style={{width:"100%",maxWidth:"430px",padding:"32px",border:"1px solid #26343b",borderRadius:"22px",background:"#0e181d",boxSizing:"border-box"}}>
        <div style={{fontSize:"12px",letterSpacing:"2px",fontWeight:700,opacity:.7}}>NORTAGO</div>
        <h1 style={{fontSize:"30px",margin:"16px 0 8px"}}>Reset Password</h1>
        <p style={{opacity:.65,lineHeight:1.5}}>Kirim tautan untuk membuat password baru.</p>
        <label style={{display:"block",marginTop:"24px",fontSize:"13px"}}>Email</label>
        <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} style={{width:"100%",marginTop:"8px",padding:"13px",borderRadius:"10px",border:"1px solid #33434b",background:"#081116",color:"#fff",boxSizing:"border-box"}} />
        {message && <div style={{marginTop:"14px",padding:"12px",borderRadius:"10px",background:"#153027",color:"#b8f1d3",fontSize:"13px"}}>{message}</div>}
        {error && <div style={{marginTop:"14px",padding:"12px",borderRadius:"10px",background:"#35171b",color:"#ffb4bd",fontSize:"13px"}}>{error}</div>}
        <button disabled={busy} type="submit" style={{width:"100%",marginTop:"20px",padding:"14px",border:0,borderRadius:"11px",background:"#f5f7f8",color:"#081116",fontWeight:700}}>{busy ? "Mengirim…" : "Kirim Reset Password"}</button>
        <a href="/login" style={{display:"block",marginTop:"18px",textAlign:"center",color:"#a9c8d3",fontSize:"13px"}}>Kembali ke Login</a>
      </form>
    </main>
  );
}
