"use client";
import { useMemo, useState } from "react";

type Mode = "TAKE AWAY" | "PRE-ORDER" | "DELIVERY";
const products = [
  { id: 1, name: "Kopi Susu", price: 22000, category: "Coffee" },
  { id: 2, name: "Americano", price: 18000, category: "Coffee" },
  { id: 3, name: "Croissant", price: 28000, category: "Food" },
];

export default function OTC() {
  const [mode, setMode] = useState<Mode>("TAKE AWAY");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [paid, setPaid] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState("QRIS");
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = useMemo(() => products.reduce((s, p) => s + p.price * (cart[p.id] || 0), 0), [cart]);
  const money = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
  const add = (id: number) => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));

  return <main style={{ minHeight:"100vh", background:"#f7f8fa", padding:20, fontFamily:"Inter,system-ui,sans-serif" }}>
    <div style={{ maxWidth:760, margin:"0 auto" }}>
      <header style={{ background:"#111827", color:"#fff", padding:22, borderRadius:18 }}>
        <small style={{ letterSpacing:2, opacity:.7 }}>NORTAGO OTC</small><h1 style={{ margin:"8px 0" }}>Kedai Kopi</h1><div style={{ opacity:.75 }}>Outlet Pusat • Buka hari ini</div>
      </header>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, margin:"16px 0" }}>
        {(["TAKE AWAY","PRE-ORDER","DELIVERY"] as Mode[]).map(x => <button key={x} onClick={() => {setMode(x);setPaid(false)}} style={{ padding:11,borderRadius:10,border:"1px solid #d0d5dd",background:mode===x?"#111827":"#fff",color:mode===x?"#fff":"#111827",fontWeight:700 }}>{x}</button>)}
      </div>

      <section style={{ background:"#fff", border:"1px solid #e4e7ec", borderRadius:14, padding:16, marginBottom:14 }}>
        <strong>{mode === "TAKE AWAY" ? "Pickup di outlet" : mode === "PRE-ORDER" ? "Jadwal pickup" : "Delivery oleh pihak ketiga"}</strong>
        {mode === "PRE-ORDER" && <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12 }}>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{padding:11,border:"1px solid #d0d5dd",borderRadius:9}}/>
          <input type="time" value={time} onChange={e=>setTime(e.target.value)} style={{padding:11,border:"1px solid #d0d5dd",borderRadius:9}}/>
        </div>}
        {mode === "DELIVERY" && <textarea value={address} onChange={e=>setAddress(e.target.value)} placeholder="Alamat pengantaran" rows={3} style={{width:"100%",boxSizing:"border-box",marginTop:12,padding:11,border:"1px solid #d0d5dd",borderRadius:9}}/>}
      </section>

      <h2 style={{fontSize:20}}>Menu / Produk</h2>
      {products.map(p => <article key={p.id} style={{background:"#fff",padding:16,margin:"10px 0",border:"1px solid #e4e7ec",borderRadius:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:12,color:"#667085"}}>{p.category}</div><strong>{p.name}</strong><div style={{marginTop:4}}>{money(p.price)}</div></div>
        <button onClick={()=>add(p.id)} style={{padding:"10px 14px",borderRadius:9,border:"1px solid #d0d5dd",background:"#fff"}}>Tambah</button>
      </article>)}

      <section style={{marginTop:18,padding:16,background:"#111827",color:"#fff",borderRadius:16}}>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>{count} item</span><strong>{money(total)}</strong></div>
        {count > 0 && !paid && <div style={{marginTop:14}}>
          <input placeholder="Nama pelanggan" style={{width:"100%",boxSizing:"border-box",padding:11,borderRadius:9,border:0,marginBottom:8}}/>
          <input placeholder="WhatsApp" style={{width:"100%",boxSizing:"border-box",padding:11,borderRadius:9,border:0,marginBottom:8}}/>
          <div style={{display:"flex",gap:8}}>{["QRIS","CASH","OTHER"].map(x=><button key={x} onClick={()=>setPayment(x)} style={{flex:1,padding:10,borderRadius:9,border:"1px solid #475467",background:payment===x?"#fff":"#1f2937",color:payment===x?"#111827":"#fff"}}>{x}</button>)}</div>
          <button onClick={()=>setPaid(true)} style={{width:"100%",marginTop:10,padding:13,border:0,borderRadius:10,background:"#fff",color:"#111827",fontWeight:800}}>Bayar & Buat Pesanan</button>
        </div>}
        {paid && <div style={{marginTop:12,padding:14,borderRadius:10,background:"#ecfdf3",color:"#027a48"}}>
          <strong>Pesanan berhasil dibuat.</strong><br/>OTC-00124 • PAID • {mode}
          {mode==="PRE-ORDER" && date && time ? <> • Pickup {date} {time}</> : null}
          {mode==="DELIVERY" ? <> • Menunggu handover ke delivery</> : null}
          <br/>Pickup Pass: <b>7K9P</b>
        </div>}
      </section>
      <footer style={{marginTop:45,textAlign:"center",fontSize:12,color:"#98a2b3"}}>Supported by NORTAGO</footer>
    </div>
  </main>;
}
