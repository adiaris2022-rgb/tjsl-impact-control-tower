"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "@supabase/supabase-js";

type Item={id:string;name:string;price:number;qty:number};
const supabase=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const money=(n:number)=>"Rp "+n.toLocaleString("id-ID");

export default function Checkout(){
 const [items,setItems]=useState<Item[]>([]);
 const [mode,setMode]=useState("TAKE AWAY");
 const [outletId,setOutletId]=useState("");
 const [outletName,setOutletName]=useState("Outlet");
 const [customerName,setCustomerName]=useState("");
 const [whatsapp,setWhatsapp]=useState("");
 const [pickupDate,setPickupDate]=useState("");
 const [pickupTime,setPickupTime]=useState("");
 const [address,setAddress]=useState("");
 const [note,setNote]=useState("");
 const [payment,setPayment]=useState("QRIS");
 const [deliveryFee,setDeliveryFee]=useState("0");
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [receipt,setReceipt]=useState<{orderNo:string;code:string}|null>(null);

 useEffect(()=>{try{
   setItems(JSON.parse(localStorage.getItem("nortago_otc_items")||"[]"));
   setMode(localStorage.getItem("nortago_otc_mode")||"TAKE AWAY");
   setOutletId(localStorage.getItem("nortago_otc_outlet_id")||"");
   setOutletName(localStorage.getItem("nortago_otc_outlet_name")||"Outlet");
 }catch{}},[]);

 const subtotal=useMemo(()=>items.reduce((s,p)=>s+p.price*p.qty,0),[items]);
 const fee=mode==="DELIVERY"?Math.max(0,Number(deliveryFee)||0):0;
 const total=subtotal+fee;

 async function createOrder(){
   setError("");
   if(!items.length)return setError("Keranjang kosong.");
   if(!customerName.trim()||!whatsapp.trim())return setError("Nama dan WhatsApp wajib diisi.");
   if(!outletId)return setError("Outlet belum tersedia.");
   if(mode==="DELIVERY"&&!address.trim())return setError("Alamat delivery wajib diisi.");
   if(mode==="PRE-ORDER"&&(!pickupDate||!pickupTime))return setError("Tanggal dan jam pickup PO wajib diisi.");

   setSaving(true);
   const s=supabase();
   const {data:outlet,error:oe}=await s.from("otc_outlets").select("business_id").eq("id",outletId).maybeSingle();
   if(oe||!outlet){setError("Outlet tidak ditemukan.");setSaving(false);return;}

   const orderId=crypto.randomUUID();
   const orderNo="OTC-"+new Date().toISOString().slice(0,10).replaceAll("-","")+"-"+Math.random().toString(36).slice(2,6).toUpperCase();
   const pickupCode=Math.random().toString(36).slice(2,6).toUpperCase();
   const scheduledAt=mode==="PRE-ORDER"?new Date(pickupDate+"T"+pickupTime).toISOString():null;

   const {error:orderError}=await s.from("otc_orders").insert({
     id:orderId,business_id:outlet.business_id,outlet_id:outletId,
     partner_id:null,order_no:orderNo,order_source:"CUSTOMER_SELF_ORDER",
     fulfillment_type:mode==="PRE-ORDER"?"PRE_ORDER":mode==="TAKE AWAY"?"TAKE_AWAY":"DELIVERY",
     status:"NEW",customer_name:customerName.trim(),customer_whatsapp:whatsapp.trim(),
     delivery_address:mode==="DELIVERY"?address.trim():null,delivery_note:mode==="DELIVERY"?note.trim()||null:null,
     scheduled_at:scheduledAt,subtotal,delivery_fee:fee,discount:0,total,
     payment_method:payment,payment_status:"PENDING",pickup_code:pickupCode
   });
   if(orderError){setError(orderError.message);setSaving(false);return;}

   const rows=items.map(i=>({id:crypto.randomUUID(),order_id:orderId,product_id:i.id,product_name_snapshot:i.name,unit_price:i.price,quantity:i.qty,variant_snapshot:{},modifier_snapshot:{},note:null,line_total:i.price*i.qty}));
   const {error:itemError}=await s.from("otc_order_items").insert(rows);
   if(itemError){setError("Pesanan dibuat, tetapi detail item gagal disimpan. Hubungi operator.");setSaving(false);return;}

   setReceipt({orderNo,code:pickupCode});
   setSaving(false);
 }

 if(receipt)return <main className="app-shell"><section className="hero"><div><div className="eyebrow">ORDER CREATED</div><h1>Pesanan berhasil</h1><p>{receipt.orderNo} • {outletName}</p></div></section><section className="data-panel"><div className="sub-panel"><h3>Digital Order Receipt</h3><p className="method">Fulfillment: {mode} • Payment: {payment} • Status: PENDING</p>{items.map(i=><div className="receipt-line" key={i.id}><span>{i.name} × {i.qty}</span><strong>{money(i.price*i.qty)}</strong></div>)}{fee>0&&<div className="receipt-line"><span>Delivery fee</span><strong>{money(fee)}</strong></div>}<div className="metric" style={{marginTop:12}}><div className="metric-title">TOTAL</div><div className="metric-value">{money(total)}</div></div><div className="status" style={{display:"inline-block",marginTop:12}}>{mode==="DELIVERY"?"HANDOVER CODE":"PICKUP PASS"}: {receipt.code}</div><p className="method">Delivery menggunakan kurir pihak ketiga. OCT tidak mengelola armada, GPS, atau dispatch.</p></div></section><footer>Supported by NORTAGO</footer></main>;

 return <main className="app-shell"><header className="topbar"><Link href="/otc" className="ghost">← Kembali ke Menu</Link><strong>CHECKOUT</strong></header><section className="hero"><div><div className="eyebrow">{mode}</div><h1>Konfirmasi Pesanan</h1><p>{outletName} • Checkout menyesuaikan cara menerima pesanan.</p></div></section><section className="data-panel"><div className="split-grid"><div className="sub-panel"><h3>Customer</h3><div className="inline-form"><label>Nama<input value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Nama customer"/></label><label>WhatsApp<input value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} placeholder="08xxxxxxxxxx"/></label>{mode==="PRE-ORDER"&&<><label>Tanggal PO<input type="date" value={pickupDate} onChange={e=>setPickupDate(e.target.value)}/></label><label>Jam Pickup<input type="time" value={pickupTime} onChange={e=>setPickupTime(e.target.value)}/></label></>}{mode==="DELIVERY"&&<><label style={{gridColumn:"1/-1"}}>Alamat Delivery<textarea value={address} onChange={e=>setAddress(e.target.value)} placeholder="Alamat lengkap"/></label><label style={{gridColumn:"1/-1"}}>Catatan Delivery<input value={note} onChange={e=>setNote(e.target.value)} placeholder="Patokan / catatan untuk kurir"/></label><label>Biaya Delivery<input inputMode="numeric" value={deliveryFee} onChange={e=>setDeliveryFee(e.target.value.replace(/[^0-9]/g,""))}/></label></>}</div></div><div className="sub-panel"><h3>Ringkasan</h3>{items.length===0?<p className="method">Keranjang kosong. Kembali ke menu.</p>:items.map(i=><div className="receipt-line" key={i.id}><span>{i.name} × {i.qty}</span><strong>{money(i.price*i.qty)}</strong></div>)}<div className="metric"><div className="metric-title">SUBTOTAL</div><div className="metric-value">{money(subtotal)}</div></div>{mode==="DELIVERY"&&<div className="metric-note">Delivery fee: {money(fee)}</div>}<div className="metric"><div className="metric-title">TOTAL</div><div className="metric-value">{money(total)}</div></div><label>Metode Pembayaran<select value={payment} onChange={e=>setPayment(e.target.value)}><option>QRIS</option><option>CASH</option><option>OTHER</option></select></label>{error&&<div className="error">{error}</div>}<button className="primary-action" onClick={createOrder} disabled={saving||!items.length}>{saving?"MENYIMPAN PESANAN…":"BAYAR & BUAT PESANAN"}</button><p className="method">MVP gratis: pembayaran dicatat sebagai PENDING sampai operator melakukan verifikasi. Belum terhubung payment gateway.</p></div></div></section><footer>Supported by NORTAGO</footer></main>;
}