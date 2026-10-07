"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function getSupabase() {
  const response = await fetch("/api/supabase-config", { cache: "no-store" });
  const config = await response.json().catch(() => ({}));
  if (!response.ok || !config.url || !config.key) throw new Error(config.error || "Supabase configuration unavailable.");
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(config.url, config.key);
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);

  async function submit(e:React.FormEvent){
    e.preventDefault(); setError(""); setMessage("");
    if(password.length<8){setError("Password minimal 8 karakter.");return;}
    if(password!==confirm){setError("Konfirmasi password tidak sama.");return;}
    setSaving(true);
    try{
      const s=await getSupabase();
      const {error:e1}=await s.auth.updateUser({password});
      if(e1) throw e1;
      setMessage("Password berhasil diperbarui. Silakan masuk ke CT BOS.");
      setTimeout(()=>router.replace("/"),1200);
    }catch(e){setError(e instanceof Error?e.message:"Gagal memperbarui password.");}
    finally{setSaving(false);}
  }

  return <main className="auth-shell"><section className="login-card">
    <div className="brand"><div><strong style={{fontSize:22,color:"#fff"}}>NORTAGO</strong><small>Business Operating System</small></div></div>
    <div className="eyebrow">CT BOS · RESET PASSWORD</div>
    <h1><span>Password baru.</span><br/>Amankan akun Anda.</h1>
    <p className="lead">Gunakan minimal 8 karakter dan jangan gunakan password yang sama dengan layanan lain.</p>
    <form onSubmit={submit}>
      <label>Password Baru<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" required /></label>
      <label>Konfirmasi Password<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" required /></label>
      {message&&<div style={{fontSize:12,color:"#67d9c3",padding:"10px 12px",border:"1px solid #28584f",borderRadius:10}}>{message}</div>}
      {error&&<div className="error">{error}</div>}
      <button disabled={saving}>{saving?"Menyimpan...":"Simpan password →"}</button>
    </form>
  </section></main>;
}
