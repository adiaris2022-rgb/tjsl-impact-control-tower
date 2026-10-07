"use client";

import { useState } from "react";

export default function DiagnosticClientPage() {
  const [count, setCount] = useState(0);
  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",fontFamily:"Arial,sans-serif",background:"#f7f7f7"}}>
      <section style={{padding:"32px",background:"#fff",borderRadius:"16px",boxShadow:"0 8px 30px rgba(0,0,0,.08)",textAlign:"center"}}>
        <div style={{fontSize:"12px",letterSpacing:"2px",fontWeight:700}}>NORTAGO CT BOS</div>
        <h1 style={{margin:"12px 0 8px"}}>CLIENT DIAGNOSTIC OK</h1>
        <p>React client-side JavaScript is running.</p>
        <button onClick={() => setCount(count + 1)} style={{padding:"12px 18px",borderRadius:"10px",border:"1px solid #ccc",background:"#fff"}}>Tes klik: {count}</button>
      </section>
    </main>
  );
}
