"use client";
import {useState} from "react";

const products=[["Kopi Susu",22000],["Americano",18000],["Croissant",28000]] as const;

export default function CustomerOrder(){
  const [mode,setMode]=useState("TAKE AWAY");
  const [cart,setCart]=useState<Record<number,number>>({});
  const add=(i:number)=>setCart(c=>({...c,[i]:(c[i]||0)+1}));
  const remove=(i:number)=>setCart(c=>{const next={...c}; if((next[i]||0)<=1) delete next[i]; else next[i]-=1; return next;});
  const count=Object.values(cart).reduce((a,b)=>a+b,0);
  const total=products.reduce((s,p,i)=>s+p[1]*(cart[i]||0),0);

  return <main style={{minHeight:"100vh",background:"#f7f8fa",padding:20,fontFamily:"system-ui"}}>
    <div style={{maxWidth:760,margin:"0 auto"}}>
      <header style={{background:"#111827",color:"#fff",padding:22,borderRadius:18}}>
        <small>NORTAGO OTC</small><h1 style={{margin:"8px 0"}}>Kedai Kopi</h1><div>Outlet Pusat • Menu & Harga</div>
      </header>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,margin:"16px 0"}}>
        {["TAKE AWAY","PRE-ORDER","DELIVERY"].map(x=><button key={x} onClick={()=>setMode(x)} style={{padding:12,borderRadius:10,border:"1px solid #d0d5dd",background:mode===x?"#111827":"#fff",color:mode===x?"#fff":"#111827",fontWeight:700}}>{x}</button>)}
      </div>

      <div style={{background:"#fff",padding:14,borderRadius:12,border:"1px solid #e4e7ec"}}>
        <b>{mode}</b><div style={{color:"#667085",marginTop:5}}>{mode==="TAKE AWAY"?"Pesan sekarang, ambil di outlet.":mode==="PRE-ORDER"?"Pesan sekarang, tentukan jadwal pickup.":"Pesan sekarang, siapkan untuk diserahkan kepada kurir pihak ketiga."}</div>
      </div>

      {products.map((p,i)=><div key={i} style={{background:"#fff",padding:16,margin:"10px 0",border:"1px solid #e4e7ec",borderRadius:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
          <div>
            <strong>{p[0]}</strong>
            <div style={{color:"#667085"}}>Rp{p[1].toLocaleString("id-ID")}</div>
          </div>
          {(cart[i]||0)===0 ? (
            <button onClick={()=>add(i)} style={{padding:"10px 14px",borderRadius:9,border:"1px solid #d0d5dd",background:"#fff",fontWeight:700}}>Tambah</button>
          ) : (
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <button aria-label={"Kurangi "+p[0]} onClick={()=>remove(i)} style={{width:38,height:38,borderRadius:9,border:"1px solid #d0d5dd",background:"#fff",fontSize:20,fontWeight:700}}>−</button>
              <strong style={{minWidth:24,textAlign:"center",fontSize:18}}>{cart[i]}</strong>
              <button aria-label={"Tambah "+p[0]} onClick={()=>add(i)} style={{width:38,height:38,borderRadius:9,border:"1px solid #d0d5dd",background:"#111827",color:"#fff",fontSize:20,fontWeight:700}}>+</button>
            </div>
          )}
        </div>
        {(cart[i]||0)>0 && <div style={{marginTop:10,color:"#667085",fontSize:13}}>Jumlah: <b>{cart[i]}</b> • Subtotal: <b>Rp{(p[1]*cart[i]).toLocaleString("id-ID")}</b></div>}
      </div>)}

      <section style={{marginTop:18,padding:16,background:"#111827",color:"#fff",borderRadius:16}}>
        <div style={{display:"flex",justifyContent:"space-between"}}><span>Total {count} item</span><strong>Rp{total.toLocaleString("id-ID")}</strong></div>
        <a href={count?"/otc/checkout?mode="+encodeURIComponent(mode):"#"} style={{display:"block",textAlign:"center",marginTop:10,padding:12,borderRadius:10,background:"#fff",color:"#111827",textDecoration:"none",fontWeight:800,pointerEvents:count?"auto":"none"}}>Lanjut Checkout →</a>
      </section>

      <footer style={{marginTop:40,textAlign:"center",fontSize:12,color:"#98a2b3"}}>Supported by NORTAGO</footer>
    </div>
  </main>
}