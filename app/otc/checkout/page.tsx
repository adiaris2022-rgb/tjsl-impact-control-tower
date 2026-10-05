"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Mode = "TAKE AWAY" | "PRE-ORDER" | "DELIVERY";
type Item = {id:string;name:string;price:number;qty:number};

export default function Checkout(){
 const [mode,setMode]=useState<Mode>("TAKE AWAY");
 const [items,setItems]=useState<Item[]>([]);
 const [done,setDone]=useState(false);
 const [name,setName]=useState("");
 const [wa,setWa]=useState("");
 const [address,setAddress]=useState("");
 const [date,setDate]=useState("");
 const [time,setTime]=useState("");
 useEffect(()=>{
   try{
    const raw=localStorage.getItem("nortago_otc_items");
    const savedMode=localStorage.getItem("nortago_otc_mode");
    if(raw)setItems(JSON.parse(raw));
    if(savedMode==="DELIVERY"||savedMode==="PRE-ORDER"||savedMode==="TAKE AWAY")setMode(savedMode);
   }catch{}
 },[]);
 const total=useMemo(()=>items.reduce((s,x)=>s+x.price*x.qty,0),[items]);
 const valid=!!name&&!!wa&&items.length>0&&(mode!=="DELIVERY"||!!address)&&(mode!=="PRE-ORDER"||!!date&&!!time);
 if(done)return <main className="auth-shell"><section className="login-card"><div className="eyebrow">ORDER SUCCESS</div><h1>Pesanan diterima.</h1><p className="lead">Order <b>OTC-00124</b> tercatat di NORTAGO OCT.</p><div className="metric"><div className="metric-title">TOTAL</div><div className="metric-value">Rp {total.toLocaleString("id-ID")}</div><div className="metric-note">Payment: QRIS · Status: PAID</div></div><div className="metric" style={{marginTop:12}}><div className="metric-title">{mode==="DELIVERY"?"HANDOVER CODE":"PICKUP PASS"}</div><div className="metric-value">7K9P</div><div className="metric-note">{mode==="DELIVERY"?"Single-use verification code untuk handover ke pihak delivery.":"Single-use pickup code."}</div></div><Link className="status" href="/otc">← Kembali ke Menu</Link></section></main>;
 return <main className="app-shell">
  <header className="topbar"><div className="brand"><span className="mark">A</span><div><strong>NORTAGO OTC</strong><small>Checkout</small></div></div><Link className="status" href="/otc">← Menu</Link></header>
  <section className="hero"><div><div className="eyebrow">CHECKOUT</div><h1>Konfirmasi Pesanan</h1><p>Produk, fulfillment, customer, dan pembayaran.</p></div></section>
  <section className="data-panel">
   <div className="tower-tabs">{(["TAKE AWAY","PRE-ORDER","DELIVERY"] as Mode[]).map(x=><button key={x} className={mode===x?"active":""} onClick={()=>{setMode(x);localStorage.setItem("nortago_otc_mode",x)}}>{x}</button>)}</div>
   <div className="inline-form">
    <label>Nama<input value={name} onChange={e=>setName(e.target.value)} placeholder="Nama customer"/></label>
    <label>WhatsApp<input value={wa} onChange={e=>setWa(e.target.value)} placeholder="08xxxxxxxxxx"/></label>
    {mode==="PRE-ORDER"&&<><label>Tanggal pickup<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Jam pickup<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label></>}
    {mode==="DELIVERY"&&<><label style={{gridColumn:"1/-1"}}>Alamat delivery<textarea value={address} onChange={e=>setAddress(e.target.value)} placeholder="Alamat lengkap"/></label><label style={{gridColumn:"1/-1"}}>Catatan delivery<textarea placeholder="Patokan / catatan untuk kurir"/></label></label></>}
    <label>Metode pembayaran<select defaultValue="QRIS"><option>QRIS</option><option>CASH</option><option>OTHER</option></select></label>
   </div>
   <div className="panel"><div className="eyebrow">ORDER SUMMARY</div>{items.length===0?<p className="method">Cart kosong. Kembali ke menu.</p>:items.map(x=><div key={x.id} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #193134"}}><span>{x.name} × {x.qty}</span><b>Rp {(x.price*x.qty).toLocaleString("id-ID")}</b></div>)}<div style={{display:"flex",justifyContent:"space-between",paddingTop:14,fontWeight:900}}><span>Total</span><span>Rp {total.toLocaleString("id-ID")}</span></div><button disabled={!valid} style={{marginTop:16}} onClick={()=>setDone(true)}>Bayar & Buat Order →</button></div>
   <div className="report-note"><strong>{mode}</strong> — {mode==="DELIVERY"?"OCT mencatat order sampai handover ke pihak delivery. Tidak ada fleet/GPS/dispatch internal V1.":mode==="PRE-ORDER"?"PO menyimpan tanggal dan jam pickup untuk production schedule.":"Order diproses sampai pickup pass diverifikasi."}</div>
  </section>
  <footer>Supported by <b>NORTAGO</b> · Digital Order Receipt · Owner Control Tower</footer>
 </main>;
}