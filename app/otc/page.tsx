"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
type Product=[string,string,string,number,string];
const products:Product[]=[
  ["a24723cd-6913-4208-9132-a4a3710e362c","Americano","Espresso dan air",18000,"Minuman"],
  ["28fe2f72-78b2-4a73-b2d4-d55efed11da3","Croissant","Butter croissant",28000,"Food"],
  ["9f091eab-c0b3-4f45-82c0-e2ab14c256cf","Kopi Susu","Kopi susu gula aren",22000,"Minuman"]
];
const money=(n:number)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
export default function OTC(){
 const [mode,setMode]=useState("TAKE AWAY");
 const [cart,setCart]=useState<Record<string,number>>({});
 const [outletId,setOutletId]=useState("31f8a689-30bc-44a9-8d13-385ee04a029e");
 const [outletName,setOutletName]=useState("Cabang Bandung");
 const total=useMemo(()=>products.reduce((s,p)=>s+(cart[p[0]]||0)*p[3],0),[cart]);
 const add=(id:string)=>setCart(c=>({...c,[id]:(c[id]||0)+1}));
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem("nortago_otc_cart")||"{}");if(saved&&typeof saved==="object")setCart(saved)}catch{}},[]);
 useEffect(()=>{try{localStorage.setItem("nortago_otc_cart",JSON.stringify(cart));localStorage.setItem("nortago_otc_items",JSON.stringify(products.filter(p=>cart[p[0]]).map(p=>({id:p[0],name:p[1],price:p[3],qty:cart[p[0]]}))));localStorage.setItem("nortago_otc_mode",mode);localStorage.setItem("nortago_otc_outlet_id",outletId);localStorage.setItem("nortago_otc_outlet_name",outletName)}catch{}},[cart,mode,outletId,outletName]);
 return <main className="otc">
  <header><div><b>NORTAGO OTC</b><small>Owner Control Tower · Customer Commerce</small></div><a href="/">TJSL</a></header>
  <section className="hero"><span>ORDER ONLINE</span><h1>Pesan. Bayar. Ambil, PO, atau Kirim.</h1><p>Menu, harga, checkout, dan fulfillment dalam satu alur.</p></section>
  <nav>{["TAKE AWAY","PRE-ORDER","DELIVERY"].map(x=><button className={mode===x?"active":""} onClick={()=>setMode(x)} key={x}>{x}</button>)}</nav>
  <section className="grid"><div><h2>Menu Produk & Harga</h2>
   <label>Outlet<select value={outletId} onChange={e=>{setOutletId(e.target.value);setOutletName(e.target.options[e.target.selectedIndex].text)}}>
    <option value="31f8a689-30bc-44a9-8d13-385ee04a029e">Cabang Bandung</option><option value="0ba48aa8-865f-4b39-8a5f-9f225616df18">Cabang Jakarta</option><option value="e95e992c-6b4b-41e1-8ba1-4617ef430a58">Cabang Subang</option><option value="f9f77bf4-4ab5-48f0-995c-b7a515b96271">Cabang Tasikmalaya</option>
   </select></label>
   {products.map(p=><article className="product" key={p[0]}><div className="photo">{p[1].slice(0,1)}</div><div><b>{p[1]}</b><small>{p[2]} · {p[4]}</small><strong>{money(p[3])}</strong></div><button onClick={()=>add(p[0])}>+ Tambah</button></article>)}
  </div><aside><h2>Keranjang</h2>
   {products.filter(p=>cart[p[0]]).map(p=><div className="line" key={p[0]}><span>{p[1]} × {cart[p[0]]}</span><b>{money(p[3]*cart[p[0]])}</b></div>)}
   <hr/><div className="total"><span>Total</span><b>{money(total)}</b></div>
   {mode==="PRE-ORDER"&&<><label>Tanggal pickup<input type="date"/></label><label>Jam pickup<input type="time"/></label></>}
   {mode==="DELIVERY"&&<><label>Alamat pengiriman<textarea placeholder="Alamat lengkap"/></label><label>Catatan delivery<input placeholder="Catatan untuk kurir"/></label></>}
   <label>Nama<input placeholder="Nama customer"/></label><label>WhatsApp<input placeholder="08xxxxxxxxxx"/></label>
   <label>Metode pembayaran<select><option>QRIS</option><option>Cash</option><option>Other</option></select></label>
   <Link className="checkout" aria-disabled={!total} href={total?"/otc/checkout":"#"}>Checkout {mode} →</Link>
   <small className="note">Delivery menggunakan pihak ketiga; OCT tidak mengelola armada/GPS kurir.</small>
  </aside></section><footer>Supported by <b>NORTAGO</b> · NORTAGO OTC</footer>
 </main>
}