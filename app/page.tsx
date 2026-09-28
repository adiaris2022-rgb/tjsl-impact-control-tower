import Link from "next/link";

const products = [
  { name: "Kopi Susu", price: 22000 },
  { name: "Americano", price: 18000 },
  { name: "Croissant", price: 28000 },
];

export default function Home() {
  return (
    <main style={{minHeight:"100vh",background:"#081116",color:"#f5f7f8",padding:"24px",fontFamily:"Inter,system-ui,sans-serif"}}>
      <section style={{maxWidth:900,margin:"0 auto",padding:"40px 0"}}>
        <div style={{letterSpacing:3,fontWeight:800,fontSize:13,opacity:.7}}>NORTAGO</div>
        <h1 style={{fontSize:"clamp(38px,8vw,72px)",lineHeight:1.02,margin:"18px 0 12px"}}>OTC</h1>
        <p style={{fontSize:22,lineHeight:1.5,opacity:.82,maxWidth:700}}>Satu tautan untuk pelanggan memesan. Satu control tower untuk Owner mengendalikan bisnis.</p>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:28}}>
          <Link href="/customer-order" style={{padding:"14px 20px",borderRadius:12,background:"#fff",color:"#081116",textDecoration:"none",fontWeight:800}}>Buka Link Pelanggan →</Link>
          <Link href="/owner" style={{padding:"14px 20px",borderRadius:12,border:"1px solid #52616a",color:"#fff",textDecoration:"none",fontWeight:700}}>Owner Control Tower</Link>
        </div>
        <section style={{marginTop:56,background:"#101d23",border:"1px solid #26363e",borderRadius:20,padding:24}}>
          <div style={{fontSize:12,letterSpacing:2,opacity:.65}}>CONTOH LINK YANG DIBAGIKAN PEDAGANG</div>
          <h2 style={{margin:"10px 0"}}>Kedai Kopi — Outlet Pusat</h2>
          <p style={{opacity:.7}}>Pelanggan dari Instagram, Facebook, TikTok, WhatsApp, atau kampanye berbayar diarahkan langsung ke halaman order.</p>
          <div style={{display:"grid",gap:10,marginTop:20}}>
            {products.map(p=><div key={p.name} style={{display:"flex",justifyContent:"space-between",padding:"14px 0",borderBottom:"1px solid #26363e"}}><span>{p.name}</span><strong>Rp{p.price.toLocaleString("id-ID")}</strong></div>)}
          </div>
        </section>
        <footer style={{marginTop:60,textAlign:"center",fontSize:12,opacity:.5}}>Supported by NORTAGO · OTC</footer>
      </section>
    </main>
  );
}
