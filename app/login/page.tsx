"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);

  async function login(e:React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Email atau password tidak valid.");
      setBusy(false);
      return;
    }
    router.replace("/control-tower");
  }

  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:"24px",background:"#081116",color:"#f5f7f8",fontFamily:"Arial,sans-serif"}}>
      <form onSubmit={login} style={{width:"100%",maxWidth:"430px",padding:"32px",border:"1px solid #26343b",borderRadius:"22px",background:"#0e181d",boxSizing:"border-box"}}>
        <div style={{fontSize:"12px",letterSpacing:"2px",fontWeight:700,opacity:.7}}>NORTAGO</div>
        <h1 style={{fontSize:"32px",margin:"16px 0 8px"}}>Pilot Login</h1>
        <p style={{opacity:.65,lineHeight:1.5}}>TJSL Impact Control Tower</p>
        <label style={{display:"block",marginTop:"24px",fontSize:"13px"}}>Email</label>
        <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} style={{width:"100%",marginTop:"8px",padding:"13px",borderRadius:"10px",border:"1px solid #33434b",background:"#081116",color:"#fff",boxSizing:"border-box"}} />
        <label style={{display:"block",marginTop:"16px",fontSize:"13px"}}>Password</label>
        <input required type="password" value={password} onChange={e=>setPassword(e.target.value)} style={{width:"100%",marginTop:"8px",padding:"13px",borderRadius:"10px",border:"1px solid #33434b",background:"#081116",color:"#fff",boxSizing:"border-box"}} />
        {error && <div style={{marginTop:"14px",padding:"12px",borderRadius:"10px",background:"#35171b",color:"#ffb4bd",fontSize:"13px"}}>{error}</div>}
        <button disabled={busy} type="submit" style={{width:"100%",marginTop:"20px",padding:"14px",border:0,borderRadius:"11px",background:"#f5f7f8",color:"#081116",fontWeight:700}}>{busy ? "Memproses..." : "Masuk"}</button>
        <a href="/" style={{display:"block",marginTop:"18px",textAlign:"center",color:"#a9c8d3",fontSize:"13px"}}>Kembali</a>
      </form>
    </main>
  );
}