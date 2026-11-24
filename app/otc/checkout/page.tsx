"use client";
import {useSearchParams} from "next/navigation";import Link from "next/link";import {Suspense,useEffect,useMemo,useState} from "react";import {createClient} from "@supabase/supabase-js";
type Item={key:string;product:{id:string;name:string;price:number;product_type?:"PRODUCT"|"SERVICE";allow_full_payment?:boolean;allow_dp?:boolean;dp_type?:"PERCENT"|"FIXED";dp_value?:number};qty:number;variant:string;addons:{name:string;price:number}[]};
async function getSupabase(){const r=await fetch("/api/supabase-config",{cache:"no-store"});const c=await r.json().catch(()=>({}));if(!r.ok||!c.url||!c.key)throw new Error(c.error||"Supabase runtime configuration is not available.");return createClient(c.url,c.key);}
function CheckoutContent(){const q=useSearchParams();const rawMode=q.get("mode");const mode=rawMode==="PRE_ORDER"||rawMode==="DELIVERY"||rawMode==="TAKE_AWAY"?rawMode:"TAKE_AWAY";const todayLocal=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);const[cart,setCart]=useState<Item[]>([]);const[outletId,setOutletId]=useState("");const[outletName,setOutletName]=useState("");const[done,setDone]=useState(false);const[orderNo,setOrderNo]=useState("");const[receiptToken,setReceiptToken]=useState("");const[confirmedTotal,setConfirmedTotal]=useState<number|null>(null);const[confirmedDue,setConfirmedDue]=useState<number|null>(null);const[confirmedBalance,setConfirmedBalance]=useState<number|null>(null);const[error,setError]=useState("");const[name,setName]=useState("");const[wa,setWa]=useState("");const[payment,setPayment]=useState("QRIS");const[paymentChoice,setPaymentChoice]=useState<"FULL"|"DP">("FULL");const[date,setDate]=useState("");const[time,setTime]=useState("");const[address,setAddress]=useState("");const[note,setNote]=useState("");const[saving,setSaving]=useState(false);
 useEffect(()=>{try{setCart(JSON.parse(sessionStorage.getItem("otc_cart")||"[]"));setOutletId(sessionStorage.getItem("otc_outlet_id")||"")}catch{}},[]);
 useEffect(()=>{if(!outletId)return;(async()=>{try{const s=await getSupabase();const{data,error:e}=await s.from("otc_outlets").select("id,name").eq("id",outletId).maybeSingle();if(e)throw e;if(!data)throw new Error("Outlet tidak ditemukan.");setOutletName(data.name)}catch(e:any){setError(e.message||"Gagal memuat outlet.")}})()},[outletId]);
 const total=useMemo(()=>cart.reduce((n,i)=>n+i.product.price*i.qty,0),[cart]);
 const serviceItems=cart.filter(i=>i.product.product_type==="SERVICE");
 const fullAllowed=serviceItems.every(i=>i.product.allow_full_payment!==false);
 const dpAllowed=serviceItems.length>0&&serviceItems.every(i=>Boolean(i.product.allow_dp));
 const activePaymentChoice: "FULL"|"DP" = paymentChoice==="DP"&&dpAllowed ? "DP" : fullAllowed ? "FULL" : dpAllowed ? "DP" : "FULL";
 const amountDue=useMemo(()=>cart.reduce((sum,i)=>{
  const line=i.product.price*i.qty;
  if(activePaymentChoice!=="DP"||i.product.product_type!=="SERVICE")return sum+line;
  const value=Number(i.product.dp_value??50);
  const deposit=i.product.dp_type==="FIXED" ? Math.min(i.product.price,value)*i.qty : line*value/100;
  return sum+deposit;
 },0),[cart,activePaymentChoice]);
 const balanceDue=Math.max(0,total-amountDue);
 const label=mode==="TAKE_AWAY"?"TAKE AWAY":mode==="PRE_ORDER"?"PRE-ORDER":"DELIVERY";
 const createOrder=async(e:React.FormEvent)=>{
  e.preventDefault();
  if(!cart.length||!outletId)return;
  setSaving(true);setError("");
  try{
   const localSchedule=mode==="PRE_ORDER"&&date&&time?new Date(date+"T"+time+":00"):null;
   if(mode==="PRE_ORDER"&&(!localSchedule||localSchedule.getTime()<=Date.now()))throw new Error("Jadwal Pre-Order harus menggunakan waktu yang masih akan datang.");
   const scheduledAt=localSchedule?localSchedule.toISOString():null;
   const checkoutItems=cart.map(item=>({product_id:item.product.id,quantity:item.qty}));
   const checkoutPayload=JSON.stringify({
    outlet_id:outletId,
    customer_name:name.trim(),
    customer_whatsapp:wa.trim(),
    fulfillment_type:mode,
    items:checkoutItems,
    payment_method:payment,
    payment_option:activePaymentChoice,
    scheduled_at:scheduledAt,
    delivery_address:mode==="DELIVERY"?address:null,
    delivery_note:mode==="DELIVERY"?note:null
   });
   const payloadStorageKey="otc_checkout_idempotency_payload";
   const keyStorageKey="otc_checkout_idempotency_key";
   let idempotencyKey=sessionStorage.getItem(keyStorageKey);
   if(!idempotencyKey||sessionStorage.getItem(payloadStorageKey)!==checkoutPayload){
    const cryptoApi=globalThis.crypto;
    if(!cryptoApi?.randomUUID)throw new Error("Browser tidak mendukung secure checkout idempotency key.");
    idempotencyKey=cryptoApi.randomUUID();
   }
   sessionStorage.setItem(keyStorageKey,idempotencyKey);
   sessionStorage.setItem(payloadStorageKey,checkoutPayload);
   const supabase=await getSupabase();
   const {data,error:rpcError}=await supabase.rpc("nortago_create_customer_order_idempotent",{
    p_outlet_id:outletId,
    p_idempotency_key:idempotencyKey,
    p_customer_name:name,
    p_customer_whatsapp:wa,
    p_fulfillment_type:mode,
    p_items:checkoutItems,
    p_payment_method:payment,
    p_scheduled_at:scheduledAt,
    p_delivery_address:mode==="DELIVERY"?address:null,
    p_delivery_note:mode==="DELIVERY"?note:null,
    p_payment_option:activePaymentChoice
   });
   if(rpcError)throw rpcError;
   if(!data?.order_no||!data?.receipt_token)throw new Error("Respons checkout tidak lengkap.");
   setOrderNo(data.order_no);setReceiptToken(data.receipt_token);setConfirmedTotal(Number(data.total));setConfirmedDue(Number(data.payment_amount_due??data.total));setConfirmedBalance(Number(data.payment_balance_due??0));setOutletName(outletName||"Outlet");setDone(true);
   sessionStorage.removeItem("otc_cart");sessionStorage.removeItem("otc_outlet_id");sessionStorage.removeItem("otc_checkout_idempotency_key");sessionStorage.removeItem("otc_checkout_idempotency_payload");
  }catch(e:any){setError(e.message||"Gagal membuat order.");}
  finally{setSaving(false);}
 }
 if(done)return <main className="otc-page"><section className="success-card"><span className="eyebrow">ORDER RECORDED</span><h1>Pesanan tercatat.</h1><p>Order <b>{orderNo}</b> tercatat di <b>{outletName}</b>. Status: <b>NEW</b> · Pembayaran: <b>PENDING</b>.</p><div className="receipt-mini"><span>Fulfillment</span><b>{label}</b><span>Total pesanan</span><b>Rp {(confirmedTotal ?? total).toLocaleString("id-ID")}</b><span>Skema pembayaran</span><b>{activePaymentChoice==="DP"?"DP":"Pembayaran penuh"}</b><span>Tagihan awal</span><b>Rp {(confirmedDue ?? amountDue).toLocaleString("id-ID")}</b>{(confirmedBalance ?? balanceDue)>0?<><span>Sisa tagihan</span><b>Rp {(confirmedBalance ?? balanceDue).toLocaleString("id-ID")}</b></>:null}<span>Order No.</span><b>{orderNo}</b></div><p className="muted">Pesanan tersimpan. Pembayaran masih berstatus PENDING sampai diverifikasi.</p><Link className="otc-primary" href={"/otc/digital-receipt?token="+encodeURIComponent(receiptToken)}>Lihat Digital Receipt →</Link></section></main>;
 return <main className="otc-page"><header className="otc-head"><div><b>NORTAGO Order</b><small>Checkout · {outletName||"Outlet"}</small></div><Link href="/otc/customer-order">← Menu</Link></header><section className="customer-title"><span>CHECKOUT</span><h1>{label}</h1><p>Checkout membuat transaksi nyata di NORTAGO Order.</p></section>{error&&<div className="info-box wide" style={{marginBottom:12}}>{error}</div>}
 <form className="checkout-grid" onSubmit={createOrder}><div className="form-card"><h2>Customer & Fulfillment</h2><label>Nama<input value={name} onChange={e=>setName(e.target.value)} required/></label><label>WhatsApp<input value={wa} onChange={e=>setWa(e.target.value)} placeholder="08xxxxxxxxxx" required/></label>{mode==="PRE_ORDER"&&<div className="two"><label>Tanggal pickup<input type="date" min={todayLocal} value={date} onChange={e=>setDate(e.target.value)} required/></label><label>Jam pickup<input type="time" value={time} onChange={e=>setTime(e.target.value)} required/></label></div>}{mode==="DELIVERY"&&<><label>Alamat delivery<textarea value={address} onChange={e=>setAddress(e.target.value)} required/></label><label>Catatan delivery<textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Patokan / instruksi untuk kurir"/></label><div className="info-box">Kurir disediakan pihak ketiga. Biaya antar belum dihitung dan tidak termasuk total pesanan. Konfirmasikan ongkir dengan penjual sebelum pembayaran atau pesanan diproses. NORTAGO Order mencatat pesanan dan handover, bukan mengelola armada kurir.</div></>}{mode==="TAKE_AWAY"&&<div className="info-box">Order dibuat NEW/PENDING. Pickup Pass dibuat pada tahap fulfillment yang sesuai.</div>}<h3>Ringkasan produk & jasa</h3>{cart.map(i=><div className="cart-line" key={i.key}><span>{i.product.product_type === "SERVICE" ? "Jasa · " : "Produk · "}{i.product.name} × {i.qty}</span><b>Rp {(i.product.price*i.qty).toLocaleString("id-ID")}</b></div>)}</div>
 <div className="form-card"><h2>Pembayaran</h2>{serviceItems.length>0?<><label>Skema pembayaran jasa<select value={activePaymentChoice} onChange={e=>setPaymentChoice(e.target.value as "FULL"|"DP")}><option value="FULL" disabled={!fullAllowed}>Pembayaran penuh{!fullAllowed?" (tidak tersedia)":""}</option><option value="DP" disabled={!dpAllowed}>DP{!dpAllowed?" (tidak tersedia)":""}</option></select></label><small className="muted">Pilihan mengikuti pengaturan penjual untuk seluruh jasa di keranjang. Jika keranjang berisi produk fisik, nilai produk tetap masuk tagihan awal secara penuh.</small></>:<div className="info-box">Produk fisik dibayar penuh.</div>}<label>Metode pembayaran<select value={payment} onChange={e=>setPayment(e.target.value)}><option>QRIS</option><option>Cash</option><option>Other</option></select></label><div className="summary"><span>Total pesanan</span><strong>Rp {total.toLocaleString("id-ID")}</strong><span>Tagihan awal</span><strong>Rp {amountDue.toLocaleString("id-ID")}</strong>{balanceDue>0?<><span>Sisa tagihan</span><strong>Rp {balanceDue.toLocaleString("id-ID")}</strong></>:null}</div><button className="otc-primary full" disabled={!cart.length||saving||(!fullAllowed&&!dpAllowed)}>{saving?"Menyimpan…":"Buat Pesanan →"}</button><small className="muted">Sistem menyimpan skema dan nominal tagihan. Gateway belum terhubung; pembayaran tetap PENDING sampai diverifikasi.</small></div></form><footer>Supported by NORTAGO · NORTAGO Order</footer></main>}
export default function Checkout(){return <Suspense fallback={<main className="otc-page"><div className="loading">Memuat checkout…</div></main>}><CheckoutContent/></Suspense>}