"use client";
import {useSearchParams} from "next/navigation";import Link from "next/link";import {Suspense,useEffect,useMemo,useState} from "react";import {createClient} from "@supabase/supabase-js";
type Item={key:string;product:{id:string;name:string;price:number};qty:number;variant:string;addons:{name:string;price:number}[]};
async function getSupabase(){const r=await fetch("/api/supabase-config",{cache:"no-store"});const c=await r.json().catch(()=>({}));if(!r.ok||!c.url||!c.key)throw new Error(c.error||"Supabase runtime configuration is not available.");return createClient(c.url,c.key);}
function CheckoutContent(){const q=useSearchParams();const rawMode=q.get("mode");const mode=rawMode==="PRE_ORDER"||rawMode==="DELIVERY"||rawMode==="TAKE_AWAY"?rawMode:"TAKE_AWAY";const todayLocal=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);const[cart,setCart]=useState<Item[]>([]);const[outletId,setOutletId]=useState("");const[outletName,setOutletName]=useState("");const[done,setDone]=useState(false);const[orderNo,setOrderNo]=useState("");const[receiptToken,setReceiptToken]=useState("");const[confirmedTotal,setConfirmedTotal]=useState<number|null>(null);const[error,setError]=useState("");const[name,setName]=useState("");const[wa,setWa]=useState("");const[payment,setPayment]=useState("QRIS");const[date,setDate]=useState("");const[time,setTime]=useState("");const[address,setAddress]=useState("");const[note,setNote]=useState("");const[saving,setSaving]=useState(false);
 useEffect(()=>{try{setCart(JSON.parse(sessionStorage.getItem("otc_cart")||"[]"));setOutletId(sessionStorage.getItem("otc_outlet_id")||"")}catch{}},[]);
 useEffect(()=>{if(!outletId)return;(async()=>{try{const s=await getSupabase();const{data,error:e}=await s.from("otc_outlets").select("id,name").eq("id",outletId).maybeSingle();if(e)throw e;if(!data)throw new Error("Outlet tidak ditemukan.");setOutletName(data.name)}catch(e:any){setError(e.message||"Gagal memuat outlet.")}})()},[outletId]);
 const total=useMemo(()=>cart.reduce((n,i)=>n+i.product.price*i.qty,0),[cart]);const label=mode==="TAKE_AWAY"?"TAKE AWAY":mode==="PRE_ORDER"?"PRE-ORDER":"DELIVERY";
 const createOrder=async(e:React.FormEvent)=>{
  e.preventDefault();
  if(!cart.length||!outletId)return;
  setSaving(true);setError("");
  try{
   const supabase=await getSupabase();
   const scheduledAt=mode==="PRE_ORDER"&&date&&time?new Date(date+"T"+time+":00").toISOString():null;
   const {data,error:rpcError}=await supabase.rpc("nortago_create_customer_order",{
    p_outlet_id:outletId,
    p_customer_name:name,
    p_customer_whatsapp:wa,
    p_fulfillment_type:mode,
    p_items:cart.map(item=>({product_id:item.product.id,quantity:item.qty})),
    p_payment_method:payment,
    p_scheduled_at:scheduledAt,
    p_delivery_address:mode==="DELIVERY"?address:null,
    p_delivery_note:mode==="DELIVERY"?note:null
   });
   if(rpcError)throw rpcError;
   if(!data?.order_no||!data?.receipt_token)throw new Error("Respons checkout tidak lengkap.");
   setOrderNo(data.order_no);setReceiptToken(data.receipt_token);setConfirmedTotal(Number(data.total));setOutletName(outletName||"Outlet");setDone(true);
   sessionStorage.removeItem("otc_cart");sessionStorage.removeItem("otc_outlet_id");
  }catch(e:any){setError(e.message||"Gagal membuat order.");}
  finally{setSaving(false);}
 }
 if(done)return <main className="otc-page"><section className="success-card"><span className="eyebrow">ORDER RECORDED</span><h1>Pesanan tercatat.</h1><p>Order <b>{orderNo}</b> tercatat di <b>{outletName}</b>. Status: <b>NEW</b> · Pembayaran: <b>PENDING</b>.</p><div className="receipt-mini"><span>Fulfillment</span><b>{label}</b><span>Total</span><b>Rp {(confirmedTotal ?? total).toLocaleString("id-ID")}</b><span>Order No.</span><b>{orderNo}</b></div><p className="muted">Pesanan tersimpan. Pembayaran masih berstatus PENDING sampai diverifikasi.</p><Link className="otc-primary" href={"/otc/digital-receipt?token="+encodeURIComponent(receiptToken)}>Lihat Digital Receipt →</Link></section></main>;
 return <main className="otc-page"><header className="otc-head"><div><b>NORTAGO Order</b><small>Checkout · {outletName||"Outlet"}</small></div><Link href="/otc/customer-order">← Menu</Link></header><section className="customer-title"><span>CHECKOUT</span><h1>{label}</h1><p>Checkout membuat transaksi nyata di NORTAGO Order.</p></section>{error&&<div className="info-box wide" style={{marginBottom:12}}>{error}</div>}
 <form className="checkout-grid" onSubmit={createOrder}><div className="form-card"><h2>Customer & Fulfillment</h2><label>Nama<input value={name} onChange={e=>setName(e.target.value)} required/></label><label>WhatsApp<input value={wa} onChange={e=>setWa(e.target.value)} placeholder="08xxxxxxxxxx" required/></label>{mode==="PRE_ORDER"&&<div className="two"><label>Tanggal pickup<input type="date" min={todayLocal} value={date} onChange={e=>setDate(e.target.value)} required/></label><label>Jam pickup<input type="time" value={time} onChange={e=>setTime(e.target.value)} required/></label></div>}{mode==="DELIVERY"&&<><label>Alamat delivery<textarea value={address} onChange={e=>setAddress(e.target.value)} required/></label><label>Catatan delivery<textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Patokan / instruksi untuk kurir"/></label><div className="info-box">Kurir adalah pihak ketiga. OCT mencatat order dan handover, bukan dispatch armada.</div></>}{mode==="TAKE_AWAY"&&<div className="info-box">Order dibuat NEW/PENDING. Pickup Pass dibuat pada tahap fulfillment yang sesuai.</div>}<h3>Ringkasan item</h3>{cart.map(i=><div className="cart-line" key={i.key}><span>{i.product.name} × {i.qty}</span><b>Rp {(i.product.price*i.qty).toLocaleString("id-ID")}</b></div>)}</div>
 <div className="form-card"><h2>Pembayaran</h2><label>Metode<select value={payment} onChange={e=>setPayment(e.target.value)}><option>QRIS</option><option>Cash</option><option>Other</option></select></label><div className="summary"><span>Total order</span><strong>Rp {total.toLocaleString("id-ID")}</strong></div><button className="otc-primary full" disabled={!cart.length||saving}>{saving?"Menyimpan…":"Buat Pesanan →"}</button><small className="muted">Payment gateway belum terhubung. Sistem hanya mencatat metode dan membuat order sebagai PENDING.</small></div></form><footer>Supported by NORTAGO · NORTAGO Order</footer></main>}
export default function Checkout(){return <Suspense fallback={<main className="otc-page"><div className="loading">Memuat checkout…</div></main>}><CheckoutContent/></Suspense>}