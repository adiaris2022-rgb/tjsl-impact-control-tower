"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";

type Product={id:string;name:string;category:string;description:string;price:number};

const products:Product[]=[
 {id:"kopi-susu",name:"Kopi Susu",category:"Coffee",description:"Kopi susu creamy untuk teman aktivitas.",price:22000},
 {id:"americano",name:"Americano",category:"Coffee",description:"Espresso dan air, clean dan bold.",price:18000},
 {id:"croissant",name:"Croissant",category:"Pastry",description:"Pastry renyah dan buttery.",price:28000},
];

export default function CustomerOrder(){
 const router=useRouter();
 const [mode,setMode]=useState<"TAKE AWAY"|"PRE-ORDER"|"DELIVERY">("TAKE AWAY");
 const [cart,setCart]=useState<Record<string,number>>({});
 const add=(id:string)=>setCart(c=>({...c,[id]:(c[id]||0)+1}));
 const remove=(id:string)=>setCart(c=>{const n={...c};if((n[id]||0)<=1)delete n[id];else n[id]-=1;return n;});
 const count=Object.values(cart).reduce((a,b)=>a+b,0);
 const total=products.reduce((s,p)=>s+p.price*(cart[p.id]||0),0);

 const checkout=()=>{
   if(!count)return;
   localStorage.setItem("nortago_otc_cart",JSON.stringify(cart));
   localStorage.setItem("nortago_otc_mode",mode);
   router.push("/otc/checkout");
 };

 return <main className="app-shell">
   <header className="hero"><div><div className="eyebrow">NORTAGO OTC</div><h1>Kedai Kopi</h1><p>Outlet Pusat • Menu & Harga</p></div></header>
   <section className="data-panel">
     <div className="sub-panel">
       <h3>Bagaimana Anda ingin menerima pesanan?</h3>
       <div className="mode-grid">{["TAKE AWAY","PRE-ORDER","DELIVERY"].map(x=><button key={x} onClick={()=>setMode(x as typeof mode)} className={mode===x?"active-mode":""}>{x}</button>)}</div>
       <p className="method">{mode==="TAKE AWAY"?"Pesan sekarang, ambil di outlet.":mode==="PRE-ORDER"?"Pesan sekarang, tentukan tanggal dan jam pickup.":"Pesan sekarang, siapkan untuk diserahkan kepada kurir pihak ketiga."}</p>
     </div>
     <div className="sub-panel">
       <div className="section-head"><h3>Menu</h3><span className="status">{count} item</span></div>
       {products.map(p=><div key={p.id} className="product-row">
         <div><div className="product-title">{p.name}</div><div className="method">{p.category} • {p.description}</div><strong>Rp {p.price.toLocaleString("id-ID")}</strong></div>
         <div className="qty">
           <button onClick={()=>remove(p.id)} aria-label={"Kurangi "+p.name}>−</button><b>{cart[p.id]||0}</b><button onClick={()=>add(p.id)} aria-label={"Tambah "+p.name}>+</button>
         </div>
       </div>)}
     </div>
     <div className="sub-panel">
       <div className="section-head"><strong>Total</strong><strong>Rp {total.toLocaleString("id-ID")}</strong></div>
       <button className="primary-action" onClick={checkout} disabled={!count}>LANJUT CHECKOUT →</button>
     </div>
   </section>
   <footer>Supported by NORTAGO</footer>
 </main>;
}