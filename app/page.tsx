"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const plans = [
  {name:"STARTER",price:"Rp499 ribu",period:"/bulan",desc:"Untuk bisnis yang ingin mulai punya sistem kendali.",items:["1 outlet","5 user","Sales & transaksi","Procurement dasar","Finance dasar"],featured:false},
  {name:"BUSINESS",price:"Rp999 ribu",period:"/bulan",desc:"Untuk bisnis yang membutuhkan Full BOS.",items:["Hingga 3 outlet","15 user","Sales + Procurement + Finance","Approval & Control","Owner Control Tower"],featured:true},
  {name:"PRO",price:"Rp1,999 juta",period:"/bulan",desc:"Untuk bisnis multi-outlet dan kebutuhan prioritas.",items:["Multi-outlet","50 user","Full BOS","Priority support","Control & Intelligence"],featured:false},
];

function Logo(){
  return <svg viewBox="0 0 120 110" width="46" height="42" aria-label="NORTAGO logo" role="img" data-logo-lock="nortago-original-reference">
    <defs>
      <linearGradient id="landingLeft" x1="18" y1="96" x2="66" y2="18" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#18e4c6"/><stop offset=".55" stopColor="#10cfe0"/><stop offset="1" stopColor="#18aee8"/></linearGradient>
      <linearGradient id="landingRight" x1="60" y1="18" x2="105" y2="96" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#16b8ed"/><stop offset=".55" stopColor="#1689ed"/><stop offset="1" stopColor="#145be9"/></linearGradient>
    </defs>
    <path d="M24 91 L64 22" fill="none" stroke="url(#landingLeft)" strokeWidth="30" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M62 22 L103 91" fill="none" stroke="url(#landingRight)" strokeWidth="30" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

export default function LandingPage(){
  const router=useRouter();
  useEffect(()=>{ /* sales page is public; authentication is handled at /login */ },[]);
  return <main style={{minHeight:"100vh",background:"radial-gradient(circle at 80% 10%,rgba(15,180,220,.14),transparent 32%),radial-gradient(circle at 15% 30%,rgba(24,228,198,.08),transparent 28%),#06100f",color:"#fff",fontFamily:"Inter,ui-sans-serif,system-ui,sans-serif"}}>
    <nav style={{maxWidth:1180,margin:"0 auto",padding:"22px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:20}}>
      <div style={{display:"flex",alignItems:"center",gap:11}}><Logo/><div><b style={{fontSize:18,letterSpacing:1.5}}>NORTAGO</b><div style={{fontSize:10,color:"#82a29d",letterSpacing:1}}>BUSINESS OPERATING SYSTEM</div></div></div>
      <button onClick={()=>router.push("/login")} style={{border:"1px solid rgba(255,255,255,.16)",background:"rgba(255,255,255,.04)",color:"#fff",borderRadius:10,padding:"10px 17px",fontWeight:700}}>Masuk</button>
    </nav>

    <section className="hero-section" style={{maxWidth:1180,margin:"0 auto",padding:"72px 22px 86px",display:"grid",gridTemplateColumns:"1.15fr .85fr",gap:42,alignItems:"center"}}>
      <div>
        <div style={{display:"inline-flex",border:"1px solid rgba(103,217,195,.24)",background:"rgba(103,217,195,.07)",color:"#67d9c3",borderRadius:999,padding:"7px 12px",fontSize:11,fontWeight:800,letterSpacing:1}}>CT BOS NORTAGO · MENARA KENDALI BISNIS</div>
        <h1 style={{fontSize:"clamp(42px,6vw,72px)",lineHeight:1.02,letterSpacing:-2.5,margin:"22px 0 18px"}}>Bisnis berjalan.<br/><span style={{color:"#67d9c3"}}>Owner tetap memegang kendali.</span></h1>
        <p style={{fontSize:18,lineHeight:1.7,color:"#a7bfbb",maxWidth:680,margin:0}}>Satu Business Operating System untuk melihat penjualan, operasional, procurement, finance, people, risiko, dan kinerja bisnis dalam satu control tower.</p>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:28}}>
          <button onClick={()=>document.getElementById("harga")?.scrollIntoView({behavior:"smooth"})} style={{background:"#67d9c3",color:"#04100e",border:0,borderRadius:11,padding:"14px 20px",fontWeight:900}}>Lihat Paket & Harga →</button>
          <button onClick={()=>router.push("/login")} style={{background:"transparent",color:"#fff",border:"1px solid rgba(255,255,255,.16)",borderRadius:11,padding:"14px 20px",fontWeight:800}}>Sudah punya akun? Masuk</button>
        </div>
        <div style={{display:"flex",gap:22,flexWrap:"wrap",marginTop:28,color:"#78918d",fontSize:11}}>
          <span>✓ System of Record</span><span>✓ System of Control</span><span>✓ System of Intelligence</span><span>✓ System of Visibility</span>
        </div>
      </div>
      <div className="hero-card" style={{border:"1px solid rgba(103,217,195,.15)",borderRadius:24,padding:20,background:"linear-gradient(145deg,rgba(15,46,42,.88),rgba(7,20,19,.92))",boxShadow:"0 24px 80px rgba(0,0,0,.3)"}}>
        <div style={{fontSize:10,color:"#67d9c3",fontWeight:900,letterSpacing:1.5}}>OWNER CONTROL TOWER</div>
        <div style={{fontSize:28,fontWeight:900,marginTop:8}}>Apa yang terjadi di bisnis Anda?</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:18}}>
          {["Revenue","COGS","OPEX","Net Profit","Open Orders","Risk & Alert"].map((x,i)=><div key={x} style={{padding:15,border:"1px solid rgba(255,255,255,.08)",borderRadius:14,background:"rgba(255,255,255,.025)"}}><div style={{fontSize:10,color:"#78918d"}}>{x}</div><div style={{fontSize:20,fontWeight:900,marginTop:7}}>{["Rp 24,8 jt","Rp 9,2 jt","Rp 5,1 jt","Rp 10,5 jt","12","3"][i]}</div></div>)}
        </div>
        <div style={{marginTop:12,padding:14,borderRadius:13,background:"rgba(103,217,195,.06)",color:"#a7bfbb",fontSize:12}}>Data → Evidence → Control → Intelligence → Keputusan Owner</div>
      </div>
    </section>

    <section style={{maxWidth:1180,margin:"0 auto",padding:"20px 22px 80px"}}>
      <div style={{textAlign:"center",maxWidth:700,margin:"0 auto 34px"}}><div style={{color:"#67d9c3",fontSize:11,fontWeight:900,letterSpacing:1.4}}>SATU EKOSISTEM</div><h2 style={{fontSize:38,margin:"10px 0"}}>Bukan sekadar dashboard.</h2><p style={{color:"#8fa9a5",lineHeight:1.7}}>CT BOS menghubungkan aktivitas bisnis dengan bukti, approval, laporan, dan kontrol Owner.</p></div>
      <div className="module-grid" style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
        {["SALES","PROCUREMENT","FINANCE","HR & OPS","CT BOS"].map((x,i)=><div key={x} style={{border:"1px solid rgba(255,255,255,.09)",borderRadius:14,padding:"22px 14px",textAlign:"center",background:i===4?"rgba(103,217,195,.08)":"rgba(255,255,255,.02)"}}><div style={{fontWeight:900,fontSize:12}}>{x}</div><div style={{fontSize:10,color:"#78918d",marginTop:7}}>{["Order & transaksi","Stock & PO","Profit & tax","People & operations","Control & intelligence"][i]}</div></div>)}
      </div>
    </section>

    <section id="harga" style={{maxWidth:1180,margin:"0 auto",padding:"20px 22px 90px"}}>
      <div style={{textAlign:"center",marginBottom:34}}><div style={{color:"#67d9c3",fontSize:11,fontWeight:900,letterSpacing:1.4}}>PILIH SESUAI SKALA BISNIS</div><h2 style={{fontSize:38,margin:"10px 0"}}>Mulai dari sistem yang benar.</h2><p style={{color:"#8fa9a5"}}>Harga awal untuk paket berlangganan CT BOS NORTAGO.</p></div>
      <div className="plans-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        {plans.map(p=><article key={p.name} style={{border:p.featured?"1px solid rgba(103,217,195,.55)":"1px solid rgba(255,255,255,.09)",borderRadius:20,padding:24,background:p.featured?"linear-gradient(160deg,rgba(20,69,61,.7),rgba(8,23,21,.95))":"rgba(255,255,255,.025)",position:"relative"}}>
          {p.featured&&<div style={{position:"absolute",right:18,top:18,fontSize:9,fontWeight:900,letterSpacing:1,color:"#06100f",background:"#67d9c3",padding:"6px 9px",borderRadius:999}}>REKOMENDASI</div>}
          <div style={{fontSize:11,fontWeight:900,letterSpacing:1.4,color:"#67d9c3"}}>{p.name}</div><div style={{fontSize:34,fontWeight:900,marginTop:13}}>{p.price}<span style={{fontSize:12,color:"#78918d",fontWeight:500}}>{p.period}</span></div>
          <p style={{fontSize:12,color:"#8fa9a5",lineHeight:1.6,minHeight:42}}>{p.desc}</p>
          <div style={{display:"grid",gap:9,margin:"18px 0 24px"}}>{p.items.map(it=><div key={it} style={{fontSize:12,color:"#b6cbc7"}}>✓ {it}</div>)}</div>
          <button onClick={()=>router.push("/login")} style={{width:"100%",border:p.featured?"0":"1px solid rgba(255,255,255,.14)",background:p.featured?"#67d9c3":"rgba(255,255,255,.04)",color:p.featured?"#04100e":"#fff",borderRadius:10,padding:"12px",fontWeight:900}}>Pilih {p.name} →</button>
        </article>)}
      </div>
      <div style={{textAlign:"center",marginTop:20,color:"#657d79",fontSize:11}}>Implementasi tersedia terpisah sesuai kebutuhan bisnis.</div>
    </section>

    <section style={{borderTop:"1px solid rgba(255,255,255,.07)",borderBottom:"1px solid rgba(255,255,255,.07)",background:"rgba(255,255,255,.018)"}}>
      <div style={{maxWidth:900,margin:"0 auto",padding:"68px 22px",textAlign:"center"}}><h2 style={{fontSize:36,margin:"0 0 14px"}}>Owner tidak perlu mengejar data.</h2><p style={{color:"#8fa9a5",lineHeight:1.7,fontSize:16}}>CT BOS dirancang agar aktivitas penting tercatat, approval terlacak, evidence tersedia, dan penyimpangan terlihat lebih cepat.</p><button onClick={()=>document.getElementById("harga")?.scrollIntoView({behavior:"smooth"})} style={{marginTop:16,background:"#67d9c3",border:0,borderRadius:11,padding:"14px 22px",fontWeight:900}}>Lihat Paket CT BOS →</button></div>
    </section>

    <footer style={{maxWidth:1180,margin:"0 auto",padding:"28px 22px 36px",display:"flex",justifyContent:"space-between",gap:20,flexWrap:"wrap",color:"#607873",fontSize:10}}>
      <span><b style={{color:"#a7bfbb"}}>NORTAGO</b> · Business Operating System</span><span>System of Record · Control · Intelligence · Visibility</span>
    </footer>

    <style jsx>{`
      @media (max-width: 820px){
        :global(html), :global(body){overflow-x:hidden!important}
        nav{padding:16px!important}
        .hero-section{grid-template-columns:1fr!important;gap:28px!important;padding:38px 16px 54px!important}
        .hero-section h1{font-size:46px!important;line-height:1.02!important;letter-spacing:-1.8px!important}
        .hero-section .hero-card{width:100%;box-sizing:border-box;padding:16px!important;border-radius:20px!important}
        .hero-section .hero-card > div:nth-child(3){grid-template-columns:1fr 1fr!important}
        .module-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        .plans-grid{grid-template-columns:1fr!important;max-width:430px;margin-left:auto;margin-right:auto}
        section{box-sizing:border-box;width:100%}
      }
      @media (max-width: 480px){
        .hero-section h1{font-size:42px!important}
        .hero-section p{font-size:16px!important;line-height:1.6!important}
        .module-grid{gap:8px!important}
        .module-grid > div{min-width:0!important;padding:16px 10px!important}
      }
    `}</style>
  </main>
}
