"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";

type Product={id:string;name:string;price:number};
const products:Product[]=[
 {id:"kopi-susu",name:"Kopi Susu",price:22000},
 {id:"americano",name:"Americano",price:18000},
 {id:"croissant",name:"Croissant",price:28000},
];

export default function Checkout(){
 const [cart,setCart]=useState<Record<string,number>>({});
 const [mode,setMode]=useState("TAKE AWAY");
 const [done,setDone]=useState(false);
 const [payment,setPayment]=useState("QRIS");
 const [deliveryFee,setDeliveryFee]=useState("0");
 useEffect(()=>{
   try{setCart(JSON.parse(localStorage.getItem("nortago_otc_cart")||"{}"));setMode(localStorage.getItem("nortago_otc_mode")||"TAKE AWAY");}catch{}
 },[]);
 const items=useMemo(()=>products.filter(p=>(cart[p.id]||0)>0).map(p=>({...p,qty:cart[p.id]})),[cart]);
 const subtotal=items.reduce((s,p)=>s+p.price*p.qty,0);
 const fee=mode==="DELIVERY"?Math.max(0,Number(deliveryFee)||0):0;
 const total=subtotal+fee;

 if(done)return <main className="app-shell"><section className="hero"><div><div className="eyebrow">ORDER CREATED</div><h1>Pesanan berhasil</h1><p>Pesanan tercatat dan siap diproses.</p></div></section><section className="data-panel"><div className="sub-panel"><h3>Digital Order Receipt</h3><p className="method">Fulfillment: {mode} • Payment: {payment}</p>{items.map(i=><div className="receipt-line" key={i.id}><span>{i.name} × {i.qty}</span><strong>Rp {(i.price*i.qty).toLocaleString("id-ID")}</strong></div>)}{fee>0&&<div className="receipt-line"><span>Delivery fee</span><strong>Rp {fee.toLocaleString("id-ID")}</strong></div>}<div className="metric" style={{marginTop:12}}><div className="metric-title">TOTAL</div><div className="metric-value">Rp {total.toLocaleString("id-ID")}</div></div><div className="status" style={{display:"inline-block",marginTop:12}}>{mode==="DELIVERY"?"HANDOVER CODE":"PICKUP PASS"}: 7K9P</div><p className="method">Delivery menggunakan kurir pihak ketiga. OCT tidak mengelola armada, GPS, atau dispatch.</p></div></section><footer>Supported by NORTAGO</footer></main>;

 return <main className="app-shell"><header className="topbar"><Link href="/otc" className="ghost">← Kembali ke Menu</Link><strong>CHECKOUT</strong></header><section className="hero"><div><div className="eyebrow">{mode}</div><h1>Konfirmasi Pesanan</h1><p>Checkout menyesuaikan cara menerima pesanan.</p></div></section><section className="data-panel"><div className="split-grid"><div className="sub-panel"><h3>Customer</h3><div className="inline-form"><label>Nama<input placeholder="Nama customer"/></label><label>WhatsApp<input placeholder="08xxxxxxxxxx"/></label>{mode==="PRE-ORDER"&&<><label>Tanggal PO<input type="date"/></label><label>Jam Pickup<input type="time"/></label></>}{mode==="DELIVERY"&&<><label style={{gridColumn:"1/-1"}}>Alamat Delivery<input placeholder="Alamat lengkap"/></label><label style={{gridColumn:"1/-1"}}>Catatan Delivery<input placeholder="Patokan / catatan untuk kurir"/></label><label>Biaya Delivery<input inputMode="numeric" value={deliveryFee} onChange={e=>setDeliveryFee(e.target.value.replace(/[^0-9]/g,""))}/></label></>}</div></div><div className="sub-panel"><h3>Ringkasan</h3>{items.length===0?<p className="method">Keranjang kosong. Kembali ke menu.</p>:items.map(i=><div className="receipt-line" key={i.id}><span>{i.name} × {i.qty}</span><strong>Rp {(i.price*i.qty).toLocaleString("id-ID")}</strong></div>)}<div className="metric"><div className="metric-title">SUBTOTAL</div><div className="metric-value">Rp {subtotal.toLocaleString("id-ID")}</div></div>{mode==="DELIVERY"&&<div className="metric-note">Delivery fee: Rp {fee.toLocaleString("id-ID")}</div>}<div className="metric"><div className="metric-title">TOTAL</div><div className="metric-value">Rp {total.toLocaleString("id-ID")}</div></div><label>Metode Pembayaran<select value={payment} onChange={e=>setPayment(e.target.value)}><option>QRIS</option><option>CASH</option><option>OTHER</option></select></label><button className="primary-action" onClick={()=>setDone(true)} disabled={!items.length}>BAYAR & BUAT PESANAN</button></div></div></section><footer>Supported by NORTAGO</footer></main>;
}