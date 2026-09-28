"use client";

import { useMemo, useState } from "react";

type Mode = "TAKE AWAY" | "PRE-ORDER" | "DELIVERY";
type Product = { id: number; name: string; category: string; price: number; description: string };

const products: Product[] = [
  { id: 1, name: "Kopi Susu", category: "Coffee", price: 22000, description: "Espresso, susu, dan gula aren." },
  { id: 2, name: "Americano", category: "Coffee", price: 18000, description: "Espresso dengan air mineral." },
  { id: 3, name: "Croissant", category: "Bakery", price: 28000, description: "Croissant butter renyah." },
  { id: 4, name: "Chocolate Cake", category: "Bakery", price: 32000, description: "Cake cokelat lembut." }
];

const money = (n: number) => "Rp" + n.toLocaleString("id-ID");

export default function OTCMiniApp() {
  const [mode, setMode] = useState<Mode>("TAKE AWAY");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [checkedOut, setCheckedOut] = useState(false);

  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const subtotal = useMemo(
    () => products.reduce((sum, p) => sum + p.price * (cart[p.id] || 0), 0),
    [cart]
  );

  const add = (id: number) => {
    setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
    setCheckedOut(false);
  };

  const remove = (id: number) => {
    setCart(c => {
      const next = { ...c };
      if ((next[id] || 0) <= 1) delete next[id];
      else next[id] -= 1;
      return next;
    });
  };

  return (
    <main style={{ minHeight: "100vh", background: "#071014", color: "#edf7f4", padding: "28px 18px", fontFamily: "Inter,system-ui,sans-serif" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <header style={{ marginBottom: 22 }}>
          <div style={{ color: "#55d9bd", fontSize: 11, fontWeight: 900, letterSpacing: ".15em" }}>NORTAGO OTC</div>
          <h1 style={{ margin: "7px 0 3px", fontSize: 32 }}>Menu & Order</h1>
          <p style={{ margin: 0, color: "#829995" }}>Kedai Kopi • Pilih outlet, produk, dan cara menerima pesanan.</p>
        </header>

        <section style={{ background: "#0a171a", border: "1px solid #1f393b", borderRadius: 18, padding: 18, marginBottom: 18 }}>
          <div style={{ color: "#78918b", fontSize: 11, fontWeight: 800, marginBottom: 10 }}>CARA MENERIMA PESANAN</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {(["TAKE AWAY", "PRE-ORDER", "DELIVERY"] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setCheckedOut(false); }}
                style={{ background: mode === m ? "#55d9bd" : "#102327", color: mode === m ? "#061311" : "#9eb5b0", border: "1px solid #294044", padding: 13, borderRadius: 10, fontWeight: 900 }}>
                {m}
              </button>
            ))}
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "1.55fr .85fr", gap: 18 }}>
          <section>
            <h2 style={{ margin: "0 0 10px", fontSize: 20 }}>Menu / Produk</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {products.map(p => (
                <article key={p.id} style={{ background: "#0a1519", border: "1px solid #1e373a", borderRadius: 14, padding: 15, display: "flex", justifyContent: "space-between", gap: 15 }}>
                  <div>
                    <div style={{ color: "#55d9bd", fontSize: 10, fontWeight: 800 }}>{p.category}</div>
                    <h3 style={{ margin: "5px 0", fontSize: 17 }}>{p.name}</h3>
                    <p style={{ margin: 0, color: "#78918b", fontSize: 12 }}>{p.description}</p>
                    <strong style={{ display: "block", marginTop: 9 }}>{money(p.price)}</strong>
                  </div>
                  <button onClick={() => add(p.id)} style={{ alignSelf: "center", minWidth: 72 }}>+ Tambah</button>
                </article>
              ))}
            </div>
          </section>

          <aside style={{ background: "#0a1519", border: "1px solid #1e373a", borderRadius: 18, padding: 18, height: "fit-content" }}>
            <div style={{ color: "#55d9bd", fontSize: 10, fontWeight: 900, letterSpacing: ".12em" }}>CART • {mode}</div>
            <h2 style={{ margin: "7px 0 16px" }}>Checkout</h2>
            {count === 0 ? <p style={{ color: "#718985", fontSize: 13 }}>Belum ada produk.</p> : <>
              <div style={{ display: "grid", gap: 9 }}>
                {products.filter(p => cart[p.id]).map(p => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                    <span>{p.name} × {cart[p.id]}</span><span>{money(p.price * cart[p.id])}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: "1px solid #20383a", marginTop: 15, paddingTop: 15, display: "flex", justifyContent: "space-between", fontWeight: 900 }}>
                <span>Total</span><span>{money(subtotal)}</span>
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12 }}>
                {products.filter(p => cart[p.id]).map(p => <button key={p.id} onClick={() => remove(p.id)} style={{ background: "transparent", color: "#9eb5b0", border: "1px solid #294044", padding: "7px 9px", fontSize: 10 }}>− {p.name}</button>)}
              </div>
              <div style={{ marginTop: 14, color: "#9bb3ad", fontSize: 12, lineHeight: 1.6 }}>
                {mode === "PRE-ORDER" ? "📅 Checkout akan meminta tanggal & jam pickup." :
                 mode === "DELIVERY" ? "📍 Checkout akan meminta alamat & catatan delivery. Kurir tetap pihak ketiga." :
                 "🏪 Checkout untuk pickup segera di outlet."}
              </div>
              <button onClick={() => setCheckedOut(true)} style={{ width: "100%", marginTop: 15 }}>Lanjut Checkout</button>
              {checkedOut && <div style={{ marginTop: 14, padding: 13, borderRadius: 12, background: "#102c26", border: "1px solid #2d6b5b", color: "#8fe1cd", fontSize: 12, lineHeight: 1.6 }}>
                <strong>Checkout siap.</strong><br />
                Customer → {mode === "PRE-ORDER" ? "jadwal pickup" : mode === "DELIVERY" ? "alamat delivery" : "pickup"} → pembayaran → order → digital receipt.
              </div>}
            </>}
          </aside>
        </div>

        <footer style={{ marginTop: 30, color: "#526864", fontSize: 10 }}>
          Supported by NORTAGO • Customer Self Order → Order Engine → Payment → Fulfillment → Handover → Owner Control Tower
        </footer>
      </div>
    </main>
  );
}