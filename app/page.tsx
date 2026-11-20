"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const PUBLIC_APP_URL = "https://nortago-ct-bos-production.up.railway.app";


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
  const [email,setEmail]=useState("");
  const [busy,setBusy]=useState(false);
  const [sent,setSent]=useState(false);
  const [error,setError]=useState("");
  const [quoteCycle,setQuoteCycle]=useState<"MONTHLY"|"YEARLY">("MONTHLY");

  async function requestTestAccess(e:React.FormEvent){
    e.preventDefault();
    setBusy(true); setSent(false); setError("");
    try{
      const configResponse=await fetch("/api/supabase-config",{cache:"no-store",signal:AbortSignal.timeout(10000)});
      const config=await configResponse.json().catch(()=>({}));
      if(!configResponse.ok || !config.url || !config.key) throw new Error(config.error || "Konfigurasi akses belum tersedia.");
      const supabase=createBrowserClient(config.url,config.key);
      const redirectTo=`${PUBLIC_APP_URL}/auth/confirm?next=/control-tower`;
      const {error:e1}=await supabase.auth.signInWithOtp({
        email:email.trim(),
        options:{emailRedirectTo:redirectTo,shouldCreateUser:true}
      });
      if(e1) throw e1;
      setSent(true);
    }catch(err){
      setError(err instanceof Error && /rate limit/i.test(err.message) ? "Email sedang dibatasi sementara oleh layanan autentikasi. Tunggu sekitar 1 menit sebelum meminta link lagi." : err instanceof Error ? err.message : "Link akses gagal dikirim. Silakan coba lagi.");
    }finally{setBusy(false);}
  }

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
        <div style={{marginTop:28,padding:"20px",border:"1px solid rgba(103,217,195,.25)",borderRadius:18,background:"rgba(103,217,195,.06)"}}>
          <div style={{fontSize:11,color:"#67d9c3",fontWeight:900,letterSpacing:1.3}}>AKSES GRATIS / TES</div>
          <div style={{fontSize:24,fontWeight:900,marginTop:7}}>Coba CT BOS tanpa password.</div>
          <p style={{fontSize:13,color:"#9db5b1",lineHeight:1.55,margin:"8px 0 14px"}}>Masukkan email. Kami kirim link sekali klik langsung ke CT BOS. Password belum diperlukan.</p>
          <form onSubmit={requestTestAccess} style={{display:"flex",gap:9,flexWrap:"wrap"}}>
            <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@email.com" style={{flex:"1 1 220px",minWidth:0,padding:"13px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,.15)",background:"#081714",color:"#fff",boxSizing:"border-box"}} />
            <button disabled={busy} type="submit" style={{flex:"0 0 auto",background:"#67d9c3",color:"#04100e",border:0,borderRadius:10,padding:"13px 17px",fontWeight:900}}>{busy?"Mengirim…":"Kirim Link Tes →"}</button>
          </form>
          {sent&&<div style={{marginTop:12,padding:"10px 12px",borderRadius:10,border:"1px solid #28584f",background:"rgba(103,217,195,.07)",color:"#b8f1d3",fontSize:12}}>Link akses sudah dikirim. Buka email Anda lalu klik link tersebut untuk masuk langsung ke CT BOS.</div>}
          {error&&<div style={{marginTop:12,padding:"10px 12px",borderRadius:10,background:"#35171b",color:"#ffb4bd",fontSize:12}}>{error}</div>}
        </div>
        <div style={{display:"flex",gap:22,flexWrap:"wrap",marginTop:18,color:"#78918d",fontSize:11}}>
          <span>✓ Tanpa password untuk tes</span><span>✓ Link melalui email</span><span>✓ Langsung ke CT BOS</span>
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
      <div style={{textAlign:"center",maxWidth:760,margin:"0 auto 28px"}}><div style={{color:"#67d9c3",fontSize:11,fontWeight:900,letterSpacing:1.4}}>PENAWARAN BERDASARKAN KEBUTUHAN</div><h2 style={{fontSize:38,margin:"10px 0"}}>Harga CT BOS bersifat custom.</h2><p style={{color:"#8fa9a5",lineHeight:1.7}}>Setiap bisnis memiliki skala operasional, jumlah outlet, pengguna, modul, dan kebutuhan integrasi yang berbeda. Tim NORTAGO menyusun penawaran setelah asesmen ruang lingkup bisnis Anda.</p></div>
      <article style={{maxWidth:850,margin:"0 auto",border:"1px solid rgba(103,217,195,.35)",borderRadius:22,padding:28,background:"linear-gradient(145deg,rgba(20,69,61,.35),rgba(8,23,21,.88))"}}>
        <div style={{fontSize:11,color:"#67d9c3",fontWeight:900,letterSpacing:1.4}}>CT BOS · CUSTOM BUSINESS SCOPE</div>
        <h3 style={{fontSize:25,margin:"10px 0"}}>Satu sistem, disesuaikan dengan struktur bisnis Anda.</h3>
        <p style={{fontSize:13,color:"#a7bfbb",lineHeight:1.7}}>Nilai penawaran ditentukan berdasarkan jumlah outlet dan user, modul yang digunakan, integrasi, migrasi data, konfigurasi, pelatihan, serta kebutuhan dukungan operasional.</p>
        <div style={{fontSize:12,fontWeight:800,color:"#d8e9e5",marginTop:22}}>Preferensi periode pembayaran</div>
        <div role="group" aria-label="Preferensi periode pembayaran CT BOS" style={{display:"flex",gap:9,marginTop:10,flexWrap:"wrap"}}>
          <button type="button" aria-pressed={quoteCycle==="MONTHLY"} onClick={()=>setQuoteCycle("MONTHLY")} style={{border:"1px solid rgba(103,217,195,.45)",background:quoteCycle==="MONTHLY"?"#67d9c3":"rgba(255,255,255,.04)",color:quoteCycle==="MONTHLY"?"#04100e":"#fff",borderRadius:999,padding:"11px 18px",fontWeight:800}}>Bulanan</button>
          <button type="button" aria-pressed={quoteCycle==="YEARLY"} onClick={()=>setQuoteCycle("YEARLY")} style={{border:"1px solid rgba(103,217,195,.45)",background:quoteCycle==="YEARLY"?"#67d9c3":"rgba(255,255,255,.04)",color:quoteCycle==="YEARLY"?"#04100e":"#fff",borderRadius:999,padding:"11px 18px",fontWeight:800}}>Tahunan</button>
        </div>
        <div style={{marginTop:18,padding:16,borderRadius:13,background:"rgba(255,255,255,.035)",border:"1px solid rgba(255,255,255,.08)"}}>
          <div style={{fontSize:12,color:"#67d9c3",fontWeight:900}}>Ruang lingkup yang dinilai</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,marginTop:12}}>
            {["Jumlah outlet dan pengguna","Modul Sales, Procurement, Finance, HR & Ops","Integrasi dan alur kerja khusus","Migrasi data dan konfigurasi","Pelatihan dan onboarding","Dukungan operasional / SLA"].map(x=><div key={x} style={{fontSize:12,color:"#b6cbc7"}}>✓ {x}</div>)}
          </div>
        </div>
        <p style={{fontSize:12,color:"#8fa9a5",lineHeight:1.7,margin:"18px 0 0"}}>Periode yang dipilih: <b style={{color:"#fff"}}>{quoteCycle==="MONTHLY"?"Bulanan":"Tahunan"}</b>. Nilai langganan CT BOS dan biaya implementasi/onboarding akan dirinci terpisah dalam penawaran resmi setelah asesmen. Tidak ada harga paket tetap yang ditampilkan pada halaman ini.</p>
        <div style={{marginTop:18,padding:"13px 15px",borderRadius:12,border:"1px solid rgba(103,217,195,.18)",color:"#a7bfbb",fontSize:12,lineHeight:1.6}}>Untuk memulai asesmen, gunakan akses tes di bagian atas halaman lalu hubungi tim NORTAGO untuk pembahasan kebutuhan dan penawaran.</div>
      </article>
      <article style={{margin:"34px auto 0",maxWidth:850,border:"1px solid rgba(103,217,195,.25)",borderRadius:18,padding:22,background:"rgba(103,217,195,.045)",textAlign:"center"}}>
        <div style={{fontSize:10,color:"#67d9c3",fontWeight:900,letterSpacing:1.4}}>PRODUK MANDIRI · NORTAGO ORDER</div>
        <h3 style={{fontSize:23,margin:"8px 0"}}>Sistem Pemesanan Digital Terintegrasi</h3>
        <div style={{fontSize:25,fontWeight:900}}>Rp50.000 <span style={{fontSize:12,color:"#8fa9a5",fontWeight:500}}>/ outlet / bulan</span></div>
        <div style={{fontSize:14,color:"#b6cbc7",marginTop:6}}>Rp500.000 / outlet / tahun · Hemat Rp100.000 (16,7%)</div>
        <p style={{fontSize:12,color:"#8fa9a5",lineHeight:1.6}}>Ditagihkan per outlet, terpisah dari CT BOS. Setiap outlet memiliki invoice dan masa aktif sendiri. Pembayaran bersifat prepaid/manual; tidak mengasumsikan auto-renewal.</p>
        <button onClick={()=>router.push("/otc/subscribe")} style={{border:"1px solid rgba(103,217,195,.45)",background:"transparent",color:"#fff",borderRadius:10,padding:"11px 18px",fontWeight:800}}>Lihat NORTAGO Order →</button>
      </article>
    </section>

    <section style={{borderTop:"1px solid rgba(255,255,255,.07)",borderBottom:"1px solid rgba(255,255,255,.07)",background:"rgba(255,255,255,.018)"}}>
      <div style={{maxWidth:900,margin:"0 auto",padding:"68px 22px",textAlign:"center"}}><h2 style={{fontSize:36,margin:"0 0 14px"}}>Owner tidak perlu mengejar data.</h2><p style={{color:"#8fa9a5",lineHeight:1.7,fontSize:16}}>CT BOS dirancang agar aktivitas penting tercatat, approval terlacak, evidence tersedia, dan penyimpangan terlihat lebih cepat.</p><button onClick={()=>document.getElementById("harga")?.scrollIntoView({behavior:"smooth"})} style={{marginTop:16,background:"#67d9c3",border:0,borderRadius:11,padding:"14px 22px",fontWeight:900}}>Lihat Penawaran CT BOS →</button></div>
    </section>

    <footer style={{maxWidth:1180,margin:"0 auto",padding:"28px 22px 36px",display:"flex",justifyContent:"space-between",gap:20,flexWrap:"wrap",color:"#607873",fontSize:10}}>
      <span><b style={{color:"#a7bfbb"}}>NORTAGO</b> · Business Operating System</span><span>System of Record · Control · Intelligence · Visibility</span>
    </footer>

    <style jsx>{`
      @media (max-width: 820px){
        :global(html), :global(body){width:100%!important;max-width:100%!important;overflow-x:hidden!important}
        :global(*){box-sizing:border-box}
        nav{padding:16px!important;width:100%!important;max-width:100%!important}
        .hero-section{grid-template-columns:1fr!important;gap:28px!important;padding:38px 16px 54px!important}
        .hero-section h1{font-size:46px!important;line-height:1.02!important;letter-spacing:-1.8px!important}
        .hero-section .hero-card{width:100%;box-sizing:border-box;padding:16px!important;border-radius:20px!important}
        .hero-section .hero-card > div:nth-child(3){grid-template-columns:1fr 1fr!important}
        .module-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        .plans-grid{grid-template-columns:1fr!important;max-width:430px;margin-left:auto;margin-right:auto}
        section{box-sizing:border-box;width:100%!important;max-width:100%!important}
        .hero-section > div,.module-grid > div,.plans-grid > article{min-width:0!important;max-width:100%!important}
        button{max-width:100%!important}
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