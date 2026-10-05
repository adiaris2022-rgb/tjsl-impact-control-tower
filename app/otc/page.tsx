"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Mode = "TAKE_AWAY" | "PO" | "DELIVERY";

const products = [
  { id:"kopi", name:"Kopi Susu", price:22000, category:"Coffee", desc:"Espresso, susu, dan gula aren." },
  { id:"americano", name:"Americano", price:18000, category:"Coffee", desc:"Espresso dengan air mineral." },
  { id:"croissant", name:"Croissant", price:28000, category:"Food", desc:"Croissant butter renyah." },
  { id:"matcha", name:"Matcha Latte", price:26000, category:"Non Coffee", desc:"Matcha dan susu." },
];

const money=(n:number)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);

export default function OTC(){
  const [mode,setMode]=useState<Mode>("TAKE_AWAY");
  const [cart,setCart]=useState<Record<string,number>>({});
  const items=useMemo(()=>products.filter(p=>(cart[p.id]||0)>0),[cart]);
  const total=useMemo(()=>items.reduce((s,p)=>s+p.price*(cart[p.id]||0),0),[items,cart]);

  const add=(id:string)=>setCart(c=>({...c,[id]:(c[id]||0)+1}));
  const remove=(id:string)=>setCart(c=>{const n={...c}; if((n[id]||0)<=1) delete n[id]; else n[id]-=1; return n;});

  function continueCheckout(nextMode: Mode) {
    localStorage.setItem("nortago_otc_items", JSON.stringify(items.map(p=>({id:p.id,name:p.name,price:p.price,qty:cart[p.id]||0}))));
    localStorage.setItem("nortago_otc_mode", nextMode==="PO" ? "PRE-ORDER" : nextMode==="DELIVERY" ? "DELIVERY" : "TAKE AWAY");
    const checkout=nextMode==="PO"?"/otc/po":nextMode==="DELIVERY"?"/otc/delivery":"/otc/checkout?mode=takeaway";
    window.location.href=checkout;
  }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="mark">A</span><div><strong>NORTAGO OTC</strong><small>Customer Commerce</small></div></div>
      <Link className="status" href="/">← TJSL Control Tower</Link>
    </header>
    <section className="hero"><div><div className="eyebrow">CUSTOMER MINI APP</div><h1>Menu → Cart → Checkout</h1><p>Pilih outlet, produk, harga, lalu cara menerima pesanan.</p></div></section>
    <section className="data-panel">
      <div className="tower-tabs">
        {([["TAKE_AWAY","TAKE AWAY"],["PO","PRE-ORDER / PO"],["DELIVERY","DELIVERY"]] as const).map(([id,label])=>
          <button key={id} className={mode===id?"active":""} onClick={()=>setMode(id as Mode)}>{label}</button>
        )}
      </div>
      <div className="grid">
        {products.map(p=><article className="metric" key={p.id}>
          <div className="metric-title">{p.category}</div>
          <div className="metric-value" style={{fontSize:20}}>{p.name}</div>
          <div className="metric-note">{p.desc}</div>
          <div style={{fontWeight:900,marginTop:8}}>{money(p.price)}</div>
          <div style={{display:"flex",gap:7,alignItems:"center",marginTop:12}}>
            <button onClick={()=>remove(p.id)} style={{padding:"7px 11px"}}>−</button>
            <strong>{cart[p.id]||0}</strong>
            <button onClick={()=>add(p.id)} style={{padding:"7px 11px"}}>+</button>
          </div>
        </article>)}
      </div>
      <div className="panel" style={{marginTop:18}}>
        <div className="eyebrow">CART • {mode==="PO"?"PRE-ORDER / PO":mode.replace("_"," ")}</div>
        {items.length===0?<p className="method">Belum ada produk.</p>:<div className="steps">
          {items.map(p=><div key={p.id} style={{display:"flex",justifyContent:"space-between"}}><span>{p.name} × {cart[p.id]}</span><b>{money(p.price*(cart[p.id]||0))}</b></div>)}
          <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #20383a",paddingTop:10,fontWeight:900}}><span>Total</span><span>{money(total)}</span></div>
        </div>}
        <div style={{marginTop:16}}>{items.length>0&&<button onClick={()=>continueCheckout(mode)}>{mode==="PO"?"Atur Jadwal PO →":mode==="DELIVERY"?"Atur Delivery →":"Lanjut Checkout →"}</button>}</div>
      </div>
    </section>
    <footer>Supported by <b>NORTAGO</b> · Customer Self Order → Order Engine → Payment → Fulfillment → Handover → Owner Control Tower</footer>
  </main>;
}