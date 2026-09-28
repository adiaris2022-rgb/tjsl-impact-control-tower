"use client";
import { useState } from "react";
const products=[{id:1,name:"Kopi Susu",price:22000},{id:2,name:"Americano",price:18000},{id:3,name:"Croissant",price:28000}];
export default function CustomerOrder(){
 const [cart,setCart]=useState<Record<number,number>>({});
 const add=(id:number)=>setCart({...cart,[id]:(cart[id]||0)+1});
 const count=Object.values(cart).reduce((a,b)=>a+b,0);
 const total=products.reduce((s,p)=>s+p.price*(cart[p.id]||0),0);
 return <main style={{minHeight:"100vh",background:"#f7f8fa",padding:24,fontFamily:"Inter,system-ui,sans-serif"}}>
  <div style={{maxWidth:720,margin:"0 auto"}}>
   <small style={{color:"#667085"}}>NORTAGO OTC</small><h1>Order Online</h1><p style={{color:"#667085"}}>Kedai Kopi • Outlet Pusat</p>
   {products.map(p=><div key={p.id} style={{background:"#fff",padding:16,margin:"10px 0",border:"1px solid #e4e7ec",borderRadius:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><strong>{p.name}</strong><div>Rp{p.price.toLocaleString("id-ID")}</div></div><button onClick={()=>add(p.id)} style={{padding:"9px 14px",borderRadius:9,border:"1px solid #d0d5dd",background:"#fff"}}>Tambah</button></div>)}
   <section style={{marginTop:20,padding:18,background:"#fff",border:"1px solid #e4e7ec",borderRadius:14}}><strong>Pesanan</strong><div>{count} item</div><h2>Rp{total.toLocaleString("id-ID")}</h2><button disabled={!count} style={{width:"100%",padding:13,border:0,borderRadius:10,background:"#111827",color:"#fff"}}>Lanjut Pembayaran</button></section>
   <div style={{marginTop:20,display:"grid",gap:10}}><a href="/po-scheduler">Pre-Order / Jadwal Pickup →</a><a href="/reservation">Reservasi Dine-In →</a></div>
   <footer style={{marginTop:60,textAlign:"center",fontSize:12,color:"#98a2b3"}}>Supported by NORTAGO</footer>
  </div>
 </main>;
}
