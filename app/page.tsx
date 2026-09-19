export default function Home() {
  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"#071014",color:"#edf7f4",fontFamily:"system-ui,sans-serif"}}>
      <section style={{width:"min(560px,100%)",padding:34,border:"1px solid #20383a",borderRadius:24,background:"#0c191d",textAlign:"center"}}>
        <div style={{fontSize:14,fontWeight:800,letterSpacing:".12em",color:"#55d9bd"}}>NORTAGO</div>
        <div style={{fontSize:11,color:"#829995",marginTop:5}}>AI-Powered Digital Products & Content</div>
        <div style={{fontSize:11,fontWeight:800,letterSpacing:".16em",color:"#55d9bd",marginTop:42}}>TJSL IMPACT CONTROL TOWER</div>
        <h1 style={{fontSize:"clamp(32px,7vw,48px)",lineHeight:1.05,margin:"12px 0"}}>Data TJSL.<br/>Dampak yang dapat diuji.</h1>
        <p style={{color:"#9fb1ad",lineHeight:1.6}}>Satu control tower untuk memantau program, transaksi mitra, outcome, evidence, dan estimasi SROI.</p>
        <a href="/login" style={{display:"inline-block",marginTop:18,padding:"13px 18px",borderRadius:11,background:"#55d9bd",color:"#061311",fontWeight:800,textDecoration:"none"}}>Masuk ke Control Tower →</a>
        <div style={{marginTop:24,color:"#687d79",fontSize:11}}>Supported by NORTAGO · Staging</div>
      </section>
    </main>
  );
}
