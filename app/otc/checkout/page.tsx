"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useState } from "react";

function Checkout(){
 const params=useSearchParams();
 const mode=params.get("mode")||"TAKE_AWAY";
 const [done,setDone]=useState(false);
 const [payment,setPayment]=useState("QRIS");
 const baseTotal=72000;
 const deliveryFee=mode==="DELIVERY"?10000:0;
 const total=baseTotal+deliveryFee;
 if(done) return <main className="app-shell"><section className="hero"><div><div className="eyebrow">ORDER CREATED</div><h1>Pesanan berhasil</h1><p>Order OTC-00124 tercatat dan siap diproses.</p></div></section><section className="data-panel"><div className="sub-panel"><h3>Digital Order Receipt</h3><p className="method">Fulfillment: {mode.replace("_"," ")} • Payment: {payment}</p><div className="metric" style={{marginTop:12}}><div className="metric-title">TOTAL</div><div className="metric-value">Rp {total.toLocaleString("id-ID")}</div></div><div className="status" style={{display:"inline-block",marginTop:12}}>{mode==="DELIVERY"?"HANDOVER CODE: 7K9P":"PICKUP PASS: 7K9P"}</div><p className="method">Untuk DELIVERY, OCT tidak mengelola armada/driver; pesanan diserahkan kepada kurir pihak ketiga setelah handover verification.</p></div></section><footer>Supported by NORTAGO</footer></main>;
 return <main className="app-shell"><header className="topbar"><Link href="/otc" className="ghost">← Kembali ke Menu</Link><strong>CHECKOUT</strong></header><section className="hero"><div><div className="eyebrow">{mode.replace("_"," ")}</div><h1>Konfirmasi Pesanan</h1><p>Data checkout menyesuaikan cara menerima pesanan.</p></div></section><section className="data-panel"><div className="split-grid"><div className="sub-panel"><h3>Customer</h3><div className="inline-form"><label>Nama<input placeholder="Nama customer"/></label><label>WhatsApp<input placeholder="08xxxxxxxxxx"/></label>{mode==="PRE_ORDER"&&<><label>Tanggal PO<input type="date"/></label><label>Jam Pickup<input type="time"/></label></>}{mode==="DELIVERY"&&<><label style={{gridColumn:"1/-1"}}>Alamat Delivery<input placeholder="Alamat lengkap"/></label><label style={{gridColumn:"1/-1"}}>Catatan Delivery<input placeholder="Patokan / catatan untuk kurir"/></label></>}</div></div><div className="sub-panel"><h3>Pembayaran</h3><div className="inline-form"><label>Metode<select value={payment} onChange={e=>setPayment(e.target.value)}><option>QRIS</option><option>CASH</option><option>OTHER</option></select></label><div className="metric"><div className="metric-title">SUBTOTAL</div><div className="metric-value">Rp {baseTotal.toLocaleString("id-ID")}</div>{mode==="DELIVERY"&&<div className="metric-note">Delivery fee demo: Rp {deliveryFee.toLocaleString("id-ID")}</div>}</div><div className="metric"><div className="metric-title">TOTAL</div><div className="metric-value">Rp {total.toLocaleString("id-ID")}</div></div><button onClick={()=>setDone(true)}>BAYAR & BUAT PESANAN</button></div></div></div></section><footer>Supported by NORTAGO</footer></main>
}
export default function Page(){return <Suspense fallback={<div className="loading">Memuat checkout…</div>}><Checkout/></Suspense>}
