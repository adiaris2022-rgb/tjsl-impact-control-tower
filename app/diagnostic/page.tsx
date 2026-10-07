export default function DiagnosticPage() {
  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",fontFamily:"Arial,sans-serif",background:"#f7f7f7"}}>
      <section style={{padding:"32px",background:"#fff",borderRadius:"16px",boxShadow:"0 8px 30px rgba(0,0,0,.08)",textAlign:"center"}}>
        <div style={{fontSize:"12px",letterSpacing:"2px",fontWeight:700}}>NORTAGO CT BOS</div>
        <h1 style={{margin:"12px 0 8px"}}>NEXT DIAGNOSTIC OK</h1>
        <p style={{margin:0}}>Server-rendered route is responding correctly.</p>
      </section>
    </main>
  );
}
