import Link from "next/link";

export default function Home() {
  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:"24px",background:"#081116",color:"#f5f7f8",fontFamily:"Arial,sans-serif"}}>
      <section style={{width:"100%",maxWidth:"720px",padding:"40px",border:"1px solid #26343b",borderRadius:"24px",background:"#0e181d",boxSizing:"border-box"}}>
        <div style={{fontSize:"12px",letterSpacing:"2px",fontWeight:700,opacity:.7}}>NORTAGO</div>
        <h1 style={{fontSize:"clamp(32px,7vw,56px)",lineHeight:1.05,margin:"18px 0 12px"}}>TJSL Impact<br/>Control Tower</h1>
        <p style={{fontSize:"18px",lineHeight:1.6,opacity:.8}}>Program → Data → Evidence → Impact</p>
        <p style={{lineHeight:1.7,opacity:.65}}>Control tower untuk memantau program TJSL, transaksi mitra, outcome, evidence, dan estimasi SROI.</p>
        <Link href="/control-tower" style={{display:"inline-block",marginTop:"20px",padding:"14px 20px",borderRadius:"12px",background:"#f5f7f8",color:"#081116",textDecoration:"none",fontWeight:700}}>Masuk ke Control Tower →</Link>
        <div style={{marginTop:"28px",fontSize:"12px",opacity:.5}}>Supported by NORTAGO · Staging</div>
      </section>
    </main>
  );
}
