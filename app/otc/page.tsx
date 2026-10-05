"use client";

import { useMemo, useState } from "react";

type Mode = "TAKE_AWAY" | "PO" | "DELIVERY";
const products = [
  { id: "kopi", name: "Kopi Susu", category: "Coffee", price: 22000, emoji: "☕" },
  { id: "americano", name: "Americano", category: "Coffee", price: 18000, emoji: "🧊" },
  { id: "croissant", name: "Croissant", category: "Bakery", price: 28000, emoji: "🥐" },
  { id: "matcha", name: "Matcha Latte", category: "Non Coffee", price: 25000, emoji: "🍵" },
];

export default function OTCEntry() {
  const [mode, setMode] = useState<Mode>("TAKE_AWAY");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkout, setCheckout] = useState(false);
  const [success, setSuccess] = useState(false);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = useMemo(() => products.reduce((s, p) => s + p.price * (cart[p.id] || 0), 0), [cart]);
  const add = (id: string) => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));

  const box: React.CSSProperties = { background: "#0d1b2a", borderRadius: 18, padding: 16, marginBottom: 14 };
  const input: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, padding: 12, borderRadius: 10, border: "1px solid #334155", background: "#091522", color: "#fff" };

  return (
    <main style={{ minHeight: "100vh", background: "#07111f", color: "#f8fafc", padding: 20, fontFamily: "system-ui,sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12, letterSpacing: 2, opacity: .6 }}>NORTAGO OTC</div>
          <h1 style={{ margin: "5px 0" }}>Customer Commerce</h1>
          <div style={{ opacity: .6 }}>Menu · Cart · Checkout · Fulfillment</div>
        </div>

        {!checkout && !success && <>
          <section style={box}>
            <b>Bagaimana Anda ingin menerima pesanan?</b>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 10 }}>
              {([["TAKE_AWAY","Take Away","Ambil sekarang"],["PO","Pre-Order","Atur jadwal"],["DELIVERY","Delivery","Kirim ke alamat"]] as const).map(([v,l,n]) =>
                <button key={v} onClick={() => setMode(v)} style={{ padding: 11, borderRadius: 12, border: mode === v ? "2px solid #38bdf8" : "1px solid #243447", background: mode === v ? "#102c43" : "#091522", color: "#fff" }}>
                  <b>{l}</b><div style={{ fontSize: 11, opacity: .6, marginTop: 4 }}>{n}</div>
                </button>
              )}
            </div>
          </section>

          <section style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <div><h2 style={{ margin: 0 }}>Menu Produk</h2><small style={{ opacity: .55 }}>Harga outlet & ketersediaan</small></div>
              <span style={{ opacity: .65 }}>{count} item</span>
            </div>
            {products.map(p => <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "#091522", borderRadius: 14, marginBottom: 9 }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: "#13283b", display: "grid", placeItems: "center", fontSize: 26 }}>{p.emoji}</div>
              <div style={{ flex: 1 }}><b>{p.name}</b><div style={{ fontSize: 12, opacity: .55 }}>{p.category} · Tersedia</div><strong>Rp {p.price.toLocaleString("id-ID")}</strong></div>
              <button onClick={() => add(p.id)} style={{ border: 0, borderRadius: 10, padding: "10px 13px", background: "#38bdf8", fontWeight: 800 }}>+ Tambah</button>
            </div>)}
          </section>

          <section style={box}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><b>Rp {total.toLocaleString("id-ID")}</b></div>
            <div style={{ fontSize: 12, opacity: .55, marginTop: 5 }}>
              {mode === "PO" ? "Tanggal & jam pickup dipilih saat checkout." : mode === "DELIVERY" ? "Alamat pengiriman diisi saat checkout. Kurir pihak ketiga." : "Pickup Pass dibuat setelah pembayaran."}
            </div>
            <button disabled={!count} onClick={() => setCheckout(true)} style={{ width: "100%", marginTop: 13, padding: 14, border: 0, borderRadius: 12, background: count ? "#22c55e" : "#334155", color: "#fff", fontWeight: 800 }}>Checkout · Rp {total.toLocaleString("id-ID")}</button>
          </section>
        </>}

        {checkout && !success && <section style={box}>
          <button onClick={() => setCheckout(false)} style={{ background: "none", border: 0, color: "#7dd3fc", padding: 0 }}>← Kembali</button>
          <h2>Checkout {mode === "PO" ? "Pre-Order" : mode === "DELIVERY" ? "Delivery" : "Take Away"}</h2>
          <label>Nama<input style={input} placeholder="Nama customer" /></label>
          <label style={{ display: "block", marginTop: 12 }}>WhatsApp<input style={input} placeholder="08xxxxxxxxxx" /></label>
          {mode === "PO" && <label style={{ display: "block", marginTop: 12 }}>Tanggal & jam pickup<input type="datetime-local" style={input} /></label>}
          {mode === "DELIVERY" && <label style={{ display: "block", marginTop: 12 }}>Alamat pengiriman<textarea rows={3} style={input} placeholder="Alamat lengkap + patokan" /></label>}
          <div style={{ marginTop: 16, padding: 14, background: "#091522", borderRadius: 12 }}>Total <b style={{ float: "right" }}>Rp {total.toLocaleString("id-ID")}</b><div style={{ fontSize: 12, opacity: .55, marginTop: 22 }}>Demo pembayaran: QRIS / Cash / metode terkonfigurasi.</div></div>
          <button onClick={() => setSuccess(true)} style={{ width: "100%", marginTop: 13, padding: 14, border: 0, borderRadius: 12, background: "#22c55e", color: "#fff", fontWeight: 800 }}>Bayar & Buat Pesanan</button>
        </section>}

        {success && <section style={{ ...box, textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 44 }}>✓</div><h2>Pesanan Berhasil</h2><p style={{ opacity: .65 }}>Order OTC-00124</p>
          <div style={{ padding: 18, background: "#091522", borderRadius: 14, margin: "18px 0" }}><small style={{ opacity: .55 }}>PICKUP / HANDOVER PASS</small><div style={{ fontSize: 30, fontWeight: 900, letterSpacing: 5 }}>7K9P</div></div>
          <p style={{ fontSize: 13, opacity: .6 }}>Transaksi tercatat untuk Owner Control Tower.</p>
          <button onClick={() => { setCart({}); setCheckout(false); setSuccess(false); }} style={{ padding: "12px 18px", border: 0, borderRadius: 10, background: "#38bdf8", fontWeight: 800 }}>Kembali ke Menu</button>
        </section>}

        <div style={{ textAlign: "center", fontSize: 11, opacity: .4, marginTop: 24 }}>Supported by NORTAGO · OTC V1 Demo · TJSL-hosted</div>
      </div>
    </main>
  );
}
