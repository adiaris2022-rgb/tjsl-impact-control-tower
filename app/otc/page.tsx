"use client";
import { useMemo, useState } from "react";
import Link from "next/link";

const products=[
 {id:"kopi-susu",name:"Kopi Susu",price:22000,category:"Coffee"},
 {id:"americano",name:"Americano",price:18000,category:"Coffee"},
 {id:"croissant",name:"Croissant",price:28000,category:"Food"},
 {id:"matcha",name:"Matcha Latte",price:24000,category:"Non Coffee"},
];

export default function OTCPage(){
 const [mode,setMode]=useState<"TAKE_AWAY"|"PRE_ORDER"|"DELIVERY">("TAKE_AWAY");
 const [cart,setCart]=useState<Record<string,number>>({});
 const total=useMemo(()=>products.reduce((s,p)=>s+(cart[p.id]||0)*p.price,0),[cart]);
 const add=(id:string)=>setCart(c=>({...c,[id]:(c[id]||0)+1}));
 const dec=(id:string)=>setCart(c=>{const n=(c[id]||0)-1; const x={...c}; if(n<=0) delete x[id]; else x[id]=n; return x;});
 return <main className="app-shell">
  <header className="topbar"><div className="company-brand"><div className="mark">A</div><div><strong>NORTAGO OTC</strong><small>Owner Control Tower</small></div></div><Link href="/login" className="ghost">Owner Login</Link></header>
  <section className="hero"><div><div className="eyebrow">CUSTOMER ORDER</div><h1>Menu & Checkout</h1><p>Pilih produk, cara menerima pesanan, lalu lanjut ke checkout.</p></div><div className="status"><i/>ONLINE <small>OCT</small></div></section>
  <section className="data-panel">
   <div className="section-toolbar"><div><h2>Bagaimana Anda ingin menerima pesanan?</h2><p>Semua channel masuk ke Order Engine yang sama.</p></div></div>
   <div className="tower-tabs">
    {([["TAKE_AWAY","TAKE AWAY"],["PRE_ORDER","PRE-ORDER / PO"],["DELIVERY","DELIVERY"]] as const).map(([v,l])=><button key={v} className={mode===v?"active":""} onClick={()=>setMode(v)}>{l}</button>)}
   </div>
   <div className="split-grid">
    <div className="sub-panel"><h3>Menu Produk</h3><p className="method">Outlet: Kedai Kopi Empat Sekawan • Harga dapat berbeda per outlet.</p>
     <div className="table-wrap"><table><thead><tr><th>Produk</th><th>Kategori</th><th>Harga</th><th/></tr></thead><tbody>
      {products.map(p=><tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.category}</td><td>Rp {p.price.toLocaleString("id-ID")}</td><td><button onClick={()=>add(p.id)}>Tambah</button></td></tr>)}
     </tbody></table></div>
    </div>
    <div className="sub-panel"><h3>Keranjang</h3><p className="method">{mode==="TAKE_AWAY"?"Ambil segera di outlet.":mode==="PRE_ORDER"?"Tentukan tanggal dan waktu pengambilan.":"Pesanan diserahkan ke kurir pihak ketiga setelah siap."}</p>
     {products.filter(p=>cart[p.id]).map(p=><div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #193134"}}><span>{p.name} × {cart[p.id]}</span><span>Rp {(p.price*(cart[p.id]||0)).toLocaleString("id-ID")} <button className="ghost" onClick={()=>dec(p.id)}>−</button></span></div>)}
     <div style={{display:"flex",justifyContent:"space-between",marginTop:18,fontWeight:900}}><span>Total</span><span>Rp {total.toLocaleString("id-ID")}</span></div>
     {total>0&&<Link href={"/otc/checkout?mode="+mode} className="status" style={{display:"inline-block",marginTop:18,textDecoration:"none"}}>LANJUT CHECKOUT →</Link>}
    </div>
   </div>
  </section>
  <footer>Supported by NORTAGO • Digital ordering & operational control layer</footer>
 </main>
}