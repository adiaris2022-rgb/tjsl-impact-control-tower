"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => { router.replace("/login"); }, [router]);
  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"#071014",color:"#edf7f4",fontFamily:"system-ui,sans-serif"}}>
      <section style={{width:"min(470px,100%)",textAlign:"center"}}>
        <div style={{fontSize:14,fontWeight:800,letterSpacing:".12em"}}>NORTAGO</div>
        <h1 style={{fontSize:36,margin:"18px 0 8px"}}>TJSL Impact Control Tower</h1>
        <p style={{color:"#9fb1ad"}}>Membuka Control Tower…</p>
      </section>
    </main>
  );
}
