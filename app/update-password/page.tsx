"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function UpdatePasswordPage() {
  const [password,setPassword] = useState("");
  const [confirm,setConfirm] = useState("");
  const [ready,setReady] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");

  useEffect(() => {
    let active = true;

    async function prepare() {
      try {
        const response = await fetch("/api/supabase-config", { cache:"no-store", signal:AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error("Konfigurasi Supabase belum tersedia.");
        const config = await response.json();
        const supabase = createBrowserClient(config.url, config.key);

        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const { data } = await supabase.auth.getSession();
        if (!data.session) throw new Error("Tautan reset tidak valid atau sudah kedaluwarsa. Minta reset password baru.");
        if (active) setReady(true);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Tautan reset tidak valid.");
      }
    }

    prepare();
    return () => { active = false; };
  }, []);

  async function updatePassword(e:React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak sama.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/supabase-config", { cache:"no-store", signal:AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("Konfigurasi Supabase belum tersedia.");
      const config = await response.json();
      const supabase = createBrowserClient(config.url, config.key);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage("Password berhasil diperbarui. Silakan login.");
      await supabase.auth.signOut({ scope:"local" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:"24px",background:"#081116",color:"#f5f7f8",fontFamily:"Arial,sans-serif"}}>
      <form onSubmit={updatePassword} style={{width:"100%",maxWidth:"430px",padding:"32px",border:"1px solid #26343b",borderRadius:"22px",background:"#0e181d",boxSizing:"border-box"}}>
        <div style={{fontSize:"12px",letterSpacing:"2px",fontWeight:700,opacity:.7}}>NORTAGO</div>
        <h1 style={{fontSize:"30px",margin:"16px 0 8px"}}>Buat Password Baru</h1>
        <p style={{opacity:.65,lineHeight:1.5}}>Gunakan password baru untuk akun TJSL Impact Control Tower.</p>
        {ready && <>
          <label style={{display:"block",marginTop:"24px",fontSize:"13px"}}>Password baru</label>
          <input required type="password" value={password} onChange={e=>setPassword(e.target.value)} style={{width:"100%",marginTop:"8px",padding:"13px",borderRadius:"10px",border:"1px solid #33434b",background:"#081116",color:"#fff",boxSizing:"border-box"}} />
          <label style={{display:"block",marginTop:"16px",fontSize:"13px"}}>Ulangi password</label>
          <input required type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} style={{width:"100%",marginTop:"8px",padding:"13px",borderRadius:"10px",border:"1px solid #33434b",background:"#081116",color:"#fff",boxSizing:"border-box"}} />
          {message && <div style={{marginTop:"14px",padding:"12px",borderRadius:"10px",background:"#153027",color:"#b8f1d3",fontSize:"13px"}}>{message}</div>}
          <button disabled={busy} type="submit" style={{width:"100%",marginTop:"20px",padding:"14px",border:0,borderRadius:"11px",background:"#f5f7f8",color:"#081116",fontWeight:700}}>{busy ? "Menyimpan…" : "Simpan Password Baru"}</button>
        </>}
        {error && <div style={{marginTop:"14px",padding:"12px",borderRadius:"10px",background:"#35171b",color:"#ffb4bd",fontSize:"13px"}}>{error}</div>}
        {message && !ready && <div style={{marginTop:"14px",padding:"12px",borderRadius:"10px",background:"#153027",color:"#b8f1d3",fontSize:"13px"}}>{message}</div>}
        <a href="/login" style={{display:"block",marginTop:"18px",textAlign:"center",color:"#a9c8d3",fontSize:"13px"}}>Ke Login</a>
      </form>
    </main>
  );
}
