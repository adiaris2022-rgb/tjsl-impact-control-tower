"use client";
import { useState } from "react";
const products=[{id:1,name:"Kopi Susu",price:22000},{id:2,name:"Americano",price:18000},{id:3,name:"Croissant",price:28000}];
export default function CustomerOrder(){
 const [cart,setCart]=useState<Record<number,number>>({}); const [mode,setMode]=useState("TAKE AWAY");
 const add=(id:number)=>setCart({...cart,[id]:(cart[id]||0)+1}); const count=Object.values(cart).reduce((a,b)=>a+b,0);
 const total=products.reduce((s,p)=>s+p.price*(cart[p.id]||0),0);
 return <main style={{minHeight:"100vh",background:"#f7f8fa",padding:20,fontFamily:"Inter,system-ui,sans-serif"}}>
  <div style={{maxWidth:760,margin:"0 auto"}}>
   <div style={{background:"#111827",color:"#fff",padding:22,borderRadius:18}}><small style={{letterSpacing:2,opacity:.7}}>NORTAGO OTC</small><h1 style={{margin:"8px 0"}}>Kedai Kopi</h1><div style={{opacity:.75}}>Outlet Pusat • Buka hari ini</div></div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,margin:"16px 0"}}>{["TAKE AWAY","PRE-ORDER","DINE-IN"].map(x=><button key={x} onClick={()=>setMode(x)} style={{padding:11,borderRadius:10,border:"1px solid #d0d5dd",background:mode===x?"#111827":"#fff",color:mode===x?"#fff":"#111827",fontWeight:700}}>{x}</button>)}</div>
   {mode==="PRE-ORDER"&&<div style={{background:"#fff",padding:14,borderRadius:12,border:"1px solid #e4e7ec",marginBottom:12}}>Pilih jadwal pickup melalui <a href="/po-scheduler">Jadwal Pickup →</a></div>}
   {mode==="DINE-IN"&&<div style={{background:"#fff",padding:14,borderRadius:12,border:"1px solid #e4e7ec",marginBottom:12}}>Ingin reservasi meja? <a href="/reservation">Reservasi Dine-In →</a></div>}
   {products.map(p=><div key={p.id} style={{background:"#fff",padding:16,margin:"10px 0",border:"1px solid #e4e7ec",borderRadius:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><strong>{p.name}</strong><div style={{color:"#667085"}}>Rp{p.price.toLocaleString("id-ID")}</div></div><button onClick={()=>add(p.id)} style={{padding:"10px 14px",borderRadius:9,border:"1px solid #d0d5dd",background:"#fff"}}>Tambah</button></div>)}
   <section style={{position:"sticky",bottom:10,marginTop:18,padding:16,background:"#111827",color:"#fff",borderRadius:16,boxShadow:"0 10px 30px #0002"}}><div style={{display:"flex",justifyContent:"space-between"}}><span>{count} item</span><strong>Rp{total.toLocaleString("id-ID")}</strong></div><a href={count?"/checkout":"#"} style={{display:"block",textAlign:"center",marginTop:10,padding:12,borderRadius:10,background:"#fff",color:"#111827",textDecoration:"none",fontWeight:800,pointerEvents:count?"auto":"none"}}>Lanjut Pembayaran →</a></section>
   <footer style={{marginTop:45,textAlign:"center",fontSize:12,color:"#98a2b3"}}>Powered by NORTAGO OTC • Supported by NORTAGO</footer>
  </div>
 </main>
}
