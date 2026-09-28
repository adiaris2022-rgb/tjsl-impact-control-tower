"use client";
import {useEffect, useState} from "react";
export default function Checkout(){
 const [mode,setMode]=useState("TAKE AWAY");
 useEffect(()=>{const m=new URLSearchParams(window.location.search).get("mode"); if(m) setMode(m);},[]);
 const [method,setMethod]=useState("QRIS"),[done,setDone]=useState(false);
 const [date,setDate]=useState(""),[time,setTime]=useState(""),[address,setAddress]=useState("");
 const delivery=mode==="DELIVERY", po=mode==="PRE-ORDER";
 const resultLine = po ? ("PO "+(date||"-")+" "+(time||"-")) : delivery ? "DELIVERY • Handover to third-party courier" : "TAKE AWAY";
 return <main style={{minHeight:"100vh",background:"#f7f8fa",padding:24,fontFamily:"Inter,system-ui,sans-serif"}}><div style={{maxWidth:620,margin:"0 auto",background:"#fff",padding:24,borderRadius:18,border:"1px solid #e4e7ec"}}>
 <small>NORTAGO OTC • CHECKOUT</small><h1>Konfirmasi Pesanan</h1>
 <div style={{padding:16,background:"#f8fafc",borderRadius:12,margin:"16px 0"}}><b>{mode}</b><div>Kopi Susu × 2 — Rp44.000</div><div>Croissant × 1 — Rp28.000</div>{delivery&&<div>Delivery fee — dikonfigurasi bisnis/mitra</div>}<hr/><strong>Total Rp72.000 + biaya delivery jika berlaku</strong></div>
 <label>Nama<input placeholder="Nama pelanggan" style={{width:"100%",padding:12,margin:"6px 0 10px",boxSizing:"border-box"}}/></label>
 <label>WhatsApp<input placeholder="08xxxxxxxxxx" style={{width:"100%",padding:12,margin:"6px 0 10px",boxSizing:"border-box"}}/></label>
 {po&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><label>Tanggal pickup<input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{width:"100%",padding:12,marginTop:6,boxSizing:"border-box"}}/></label><label>Jam pickup<input type="time" value={time} onChange={e=>setTime(e.target.value)} style={{width:"100%",padding:12,marginTop:6,boxSizing:"border-box"}}/></label></div>}
 {delivery&&<label>Alamat Delivery<textarea value={address} onChange={e=>setAddress(e.target.value)} placeholder="Alamat lengkap penerima" style={{width:"100%",padding:12,margin:"6px 0",boxSizing:"border-box"}}/></label>}
 <label>Catatan<textarea placeholder="Catatan pesanan (opsional)" style={{width:"100%",padding:12,margin:"6px 0",boxSizing:"border-box"}}/></label>
 <div style={{marginTop:12}}><b>Pembayaran</b><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:8}}>{["QRIS","CASH","OTHER"].map(x=><button key={x} onClick={()=>setMethod(x)} style={{padding:12,borderRadius:10,border:"1px solid #d0d5dd",background:method===x?"#111827":"#fff",color:method===x?"#fff":"#111827"}}>{x}</button>)}</div></div>
 <button onClick={()=>setDone(true)} style={{width:"100%",marginTop:20,padding:14,border:0,borderRadius:11,background:"#111827",color:"#fff",fontWeight:800}}>Bayar & Buat Pesanan</button>
 {done&&<div style={{marginTop:16,padding:14,borderRadius:12,background:"#ecfdf3",color:"#027a48"}}><b>Pesanan berhasil dibuat.</b><br/>Order OTC-00124 • PAID • Source CUSTOMER_SELF_ORDER<br/>{resultLine}<br/>Pickup/Handover Code: 7K9P</div>}
 <footer style={{marginTop:40,textAlign:"center",fontSize:12,color:"#98a2b3"}}>Supported by NORTAGO</footer></div></main>
}