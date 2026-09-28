"use client";

import { useMemo, useState } from "react";

type Mode = "TAKE AWAY" | "PRE-ORDER" | "DELIVERY";

const products = [
  { id: "kopi", name: "Kopi Susu", price: 22000, category: "Coffee" },
  { id: "americano", name: "Americano", price: 18000, category: "Coffee" },
  { id: "croissant", name: "Croissant", price: 28000, category: "Food" },
];

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export default function OTCPage() {
  const [mode, setMode] = useState<Mode>("TAKE AWAY");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const total = useMemo(
    () => products.reduce((sum, p) => sum + p.price * (cart[p.id] || 0), 0),
    [cart]
  );

  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <header style={{ padding: "16px 0 22px" }}>
        <div style={{ fontSize: 12, letterSpacing: 1.5, color: "#667085" }}>NORTAGO OTC</div>
        <h1 style={{ margin: "6px 0", fontSize: 30 }}>Order sekarang. Ambil atau kirim sesuai kebutuhan.</h1>
        <p style={{ color: "#667085", margin: 0 }}>Demo Mini App — Menu, harga, cart, dan checkout.</p>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 20 }}>
        {(["TAKE AWAY", "PRE-ORDER", "DELIVERY"] as Mode[]).map((m) => (
          <button key={m} onClick={() => { setMode(m); setSubmitted(false); }} style={{
            padding: "12px 8px", borderRadius: 12, border: mode === m ? "2px solid #111827" : "1px solid #d0d5dd",
            background: mode === m ? "#111827" : "#fff", color: mode === m ? "#fff" : "#111827", fontWeight: 700
          }}>{m}</button>
        ))}
      </section>

      <section>
        <h2 style={{ fontSize: 20 }}>Menu / Produk</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {products.map((p) => (
            <article key={p.id} style={{ background: "#fff", border: "1px solid #eaecf0", borderRadius: 16, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#667085" }}>{p.category}</div>
                  <strong style={{ fontSize: 18 }}>{p.name}</strong>
                  <div style={{ marginTop: 4 }}>{rupiah(p.price)}</div>
                </div>
                <button onClick={() => add(p.id)} style={{ alignSelf: "center", padding: "10px 16px", borderRadius: 10, border: 0, background: "#111827", color: "#fff", fontWeight: 700 }}>
                  + Tambah
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 22, background: "#fff", borderRadius: 16, padding: 18, border: "1px solid #eaecf0" }}>
        <h2 style={{ marginTop: 0 }}>Checkout — {mode}</h2>
        {mode === "PRE-ORDER" && <input placeholder="Tanggal & jam pengambilan" style={{ width: "100%", padding: 12, marginBottom: 10, boxSizing: "border-box" }} />}
        {mode === "DELIVERY" && <input placeholder="Alamat pengantaran" style={{ width: "100%", padding: 12, marginBottom: 10, boxSizing: "border-box" }} />}
        <input placeholder="Nama customer" style={{ width: "100%", padding: 12, marginBottom: 10, boxSizing: "border-box" }} />
        <input placeholder="WhatsApp" style={{ width: "100%", padding: 12, marginBottom: 10, boxSizing: "border-box" }} />
        <select style={{ width: "100%", padding: 12, marginBottom: 12 }}>
          <option>QRIS</option><option>Cash</option><option>Other</option>
        </select>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, marginBottom: 12 }}>
          <span>Total</span><span>{rupiah(total)}</span>
        </div>
        <button disabled={total === 0} onClick={() => setSubmitted(true)} style={{ width: "100%", padding: 14, borderRadius: 12, border: 0, background: total ? "#111827" : "#98a2b3", color: "#fff", fontWeight: 800 }}>
          Bayar & Buat Pesanan
        </button>
        {submitted && <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: "#ecfdf3" }}>
          Pesanan berhasil dibuat. Order Engine menerima order {mode.toLowerCase()} dan Control Tower dapat memantau transaksinya.
        </div>}
      </section>

      <footer style={{ marginTop: 24, textAlign: "center", fontSize: 12, color: "#667085" }}>
        Supported by NORTAGO
      </footer>
    </div>
  );
}
