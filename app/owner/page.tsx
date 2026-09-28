"use client";
import { useState } from "react";
const outlets=[{name:"Outlet Pusat",count:18,nominal:2145000,issue:1},{name:"Outlet Selatan",count:11,nominal:1280000,issue:0},{name:"Outlet Barat",count:7,nominal:865000,issue:1}];
const money=(n:number)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
export default function Owner(){
 const [selected,setSelected]=useState("ALL");
 const rows=selected==="ALL"?outlets:outlets.filter(x=>x.name===selected);
 const count=rows.reduce((s,x)=>s+x.count,0), nominal=rows.reduce((s,x)=>s+x.nominal,0);
 return <main style={{minHeight:"100vh",background:"#f6f8fa",padding:24,fontFamily:"Inter,system-ui,sans-serif"}}><div style={{maxWidth:1100,margin:"0 auto"}}>
  <small style={{color:"#667085"}}>NORTAGO OTC</small><h1>Owner Control Tower</h1><p style={{color:"#667085"}}>Owner melihat ringkasan bisnis tanpa harus membuka detail operasional.</p>
  <select value={selected} onChange={e=>setSelected(e.target.value)} style={{padding:10,borderRadius:10,border:"1px solid #d0d5dd"}}><option value="ALL">Semua Outlet</option>{outlets.map(x=><option key={x.name}>{x.name}</option>)}</select>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,margin:"24px 0"}}><Card t="Transaksi" v={String(count)}/><Card t="Nominal Transaksi" v={money(nominal)}/><Card t="Outlet" v={String(rows.length)}/><Card t="Perlu Perhatian" v={String(rows.reduce((s,x)=>s+x.issue,0))}/></div>
  <section style={{background:"#fff",border:"1px solid #e4e7ec",borderRadius:16,overflow:"hidden"}}>{rows.map(x=><div key={x.name} style={{display:"grid",gridTemplateColumns:"1fr 140px 180px 100px",gap:12,padding:16,borderBottom:"1px solid #f2f4f7"}}><strong>{x.name}</strong><span>{x.count} transaksi</span><strong>{money(x.nominal)}</strong><span>Issue {x.issue}</span></div>)}</section>
  <p style={{marginTop:18,color:"#667085",fontSize:13}}>Laporan Owner dapat dikirim otomatis setiap jam: jumlah transaksi dan nominal per outlet + total seluruh outlet.</p>
  <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:24}}><a href="/owner-report">Lihat Owner Hourly Report →</a><a href="/digital-receipt">Lihat Digital Receipt →</a></div>
  <footer style={{marginTop:70,textAlign:"center",fontSize:12,color:"#98a2b3"}}>Supported by NORTAGO</footer>
 </div></main>;
}
function Card({t,v}:{t:string,v:string}){return <div style={{background:"#fff",border:"1px solid #e4e7ec",borderRadius:16,padding:18}}><div style={{fontSize:13,color:"#667085"}}>{t}</div><div style={{fontSize:26,fontWeight:800,marginTop:8}}>{v}</div></div>}
