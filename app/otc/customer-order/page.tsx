"use client";

import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "@supabase/supabase-js";

type Mode="TAKE AWAY"|"PRE-ORDER"|"DELIVERY"|"DINE-IN";
type Product={id:string;name:string;category:string;description:string;price:number};
const supabase=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function CustomerOrder(){
 const router=useRouter();
 const [mode,setMode]=useState<Mode>("TAKE AWAY");
 const [products,setProducts]=useState<Product[]>([]);
 const [cart,setCart]=useState<Record<string,number>>({});
 const [outletId,setOutletId]=useState("");
 const [outletName,setOutletName]=useState("Outlet");
 const [loading,setLoading]=useState(true);
 const [partySize,setPartySize]=useState("2");
 const [reservationDate,setReservationDate]=useState("");
 const [reservationTime,setReservationTime]=useState("");
 const [tableNote,setTableNote]=useState("");

 useEffect(()=>{(async()=>{
   const s=supabase();
   const {data:outlet}=await s.from("otc_outlets").select("id,name").eq("is_active",true).order("created_at").limit(1).maybeSingle();
   if(!outlet){setLoading(false);return;}
   setOutletId(outlet.id);setOutletName(outlet.name);
   const {data}=await s.from("otc_outlet_products").select("product_id,price,is_available,otc_products(id,name,category,description,base_price)").eq("outlet_id",outlet.id).eq("is_available",true);
   const rows=(data??[]).map((r:any)=>({id:r.otc_products.id,name:r.otc_products.name,category:r.otc_products.category??"",description:r.otc_products.description??"",price:Number(r.price??r.otc_products.base_price??0)}));
   setProducts(rows);setLoading(false);
 })().catch(()=>setLoading(false));},[]);

 const add=(id:string)=>setCart(c=>({...c,[id]:(c[id]||0)+1}));
 const remove=(id:string)=>setCart(c=>{const n={...c};if((n[id]||0)<=1)delete n[id];else n[id]-=1;return n;});
 const count=Object.values(cart).reduce((a,b)=>a+b,0);
 const total=products.reduce((s,p)=>s+p.price*(cart[p.id]||0),0);

 const checkout=()=>{
   if(!count||!outletId)return;
   const items=products.filter(p=>(cart[p.id]||0)>0).map(p=>({id:p.id,name:p.name,price:p.price,qty:cart[p.id]}));
   localStorage.setItem("nortago_otc_items",JSON.stringify(items));
   localStorage.setItem("nortago_otc_mode",mode);
   localStorage.setItem("nortago_otc_outlet_id",outletId);
   localStorage.setItem("nortago_otc_outlet_name",outletName);
   if(mode==="DINE-IN"){
     localStorage.setItem("nortago_otc_dinein",JSON.stringify({partySize:Number(partySize)||1,date:reservationDate,time:reservationTime,tableNote}));
   }
   router.push("/otc/checkout");
 };

 const description=mode==="TAKE AWAY"?"Pesan sekarang, ambil di outlet.":mode==="PRE-ORDER"?"Pesan sekarang, tentukan tanggal dan jam pickup.":mode==="DELIVERY"?"Pesan sekarang, siapkan untuk diserahkan kepada kurir pihak ketiga.":"Reservasi waktu makan, pilih menu, dan check-in di outlet.";

 return <main className="app-shell">
   <header className="hero"><div><div className="eyebrow">NORTAGO OTC</div><h1>Kedai Kopi</h1><p>{outletName} • Menu & Harga</p></div></header>
   <section className="data-panel">
     <div className="sub-panel">
       <h3>Bagaimana Anda ingin menerima / menggunakan pesanan?</h3>
       <div className="mode-grid">{(["TAKE AWAY","PRE-ORDER","DELIVERY","DINE-IN"] as Mode[]).map(x=><button key={x} onClick={()=>setMode(x)} className={mode===x?"active-mode":""}>{x}</button>)}</div>
       <p className="method">{description}</p>
       {mode==="DINE-IN"&&<div className="reservation-grid">
         <label>Jumlah tamu<input type="number" min="1" value={partySize} onChange={e=>setPartySize(e.target.value)}/></label>
         <label>Tanggal<input type="date" value={reservationDate} onChange={e=>setReservationDate(e.target.value)}/></label>
         <label>Waktu<input type="time" value={reservationTime} onChange={e=>setReservationTime(e.target.value)}/></label>
         <label>Catatan meja (opsional)<input value={tableNote} onChange={e=>setTableNote(e.target.value)} placeholder="Mis. area non-smoking"/></label>
       </div>}
     </div>
     <div className="sub-panel">
       <div className="section-head"><h3>Menu</h3><span className="status">{count} item</span></div>
       {loading?<p className="method">Memuat menu…</p>:products.length===0?<p className="method">Belum ada produk aktif.</p>:products.map(p=><div key={p.id} className="product-row">
         <div><div className="product-title">{p.name}</div><div className="method">{p.category} • {p.description}</div><strong>Rp {p.price.toLocaleString("id-ID")}</strong></div>
         <div className="qty"><button onClick={()=>remove(p.id)} aria-label={"Kurangi "+p.name}>−</button><b>{cart[p.id]||0}</b><button onClick={()=>add(p.id)} aria-label={"Tambah "+p.name}>+</button></div>
       </div>)}
     </div>
     <div className="sub-panel">
       <div className="section-head"><strong>Total</strong><strong>Rp {total.toLocaleString("id-ID")}</strong></div>
       <button className="primary-action" onClick={checkout} disabled={!count||loading}>LANJUT CHECKOUT →</button>
     </div>
   </section>
   <footer>Supported by NORTAGO · Take Away · Pre-Order · Delivery · Dine-In</footer>
 </main>;
}