"use client";

import "./otc.css";

import { useMemo, useState } from "react";

type Mode = "TAKE AWAY" | "PRE-ORDER" | "DELIVERY";

const products = [
  { id: "kopi-susu", name: "Kopi Susu", category: "Coffee", price: 22000 },
  { id: "americano", name: "Americano", category: "Coffee", price: 18000 },
  { id: "croissant", name: "Croissant", category: "Bakery", price: 28000 },
  { id: "matcha", name: "Matcha Latte", category: "Non Coffee", price: 26000 },
];

export default function OTCMiniApp() {
  const [mode, setMode] = useState<Mode>("TAKE AWAY");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState("QRIS");
  const [submitted, setSubmitted] = useState(false);

  const total = useMemo(
    () => products.reduce((sum, p) => sum + p.price * (cart[p.id] || 0), 0),
    [cart]
  );

  const add = (id: string) =>
    setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));

  const remove = (id: string) =>
    setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) - 1) }));

  const count = Object.values(cart).reduce((a, b) => a + b, 0);

  if (submitted) {
    return (
      <main className="otc-shell">
        <section className="otc-card success">
          <div className="eyebrow">NORTAGO OTC</div>
          <h1>Pesanan berhasil dibuat</h1>
          <p className="muted">Order OTC-00125 · {mode}</p>
          <div className="receipt-box">
            <b>Total Rp {total.toLocaleString("id-ID")}</b>
            <span>Pembayaran: {payment}</span>
            {mode === "PRE-ORDER" && <span>Jadwal: {date} {time}</span>}
            {mode === "DELIVERY" && <span>Alamat: {address}</span>}
            <span>Pickup / Handover Pass: <b>8M4K</b></span>
          </div>
          <button className="primary" onClick={() => setSubmitted(false)}>Buat Pesanan Baru</button>
        </section>
      </main>
    );
  }

  return (
    <main className="otc-shell">
      <header className="brand">
        <div>
          <div className="eyebrow">NORTAGO OTC</div>
          <h1>Owner Control Tower</h1>
          <p className="muted">Customer Commerce Demo</p>
        </div>
        <a href="/login" className="small-link">TJSL Control Tower</a>
      </header>

      <section className="outlet">
        <div><b>Kedai Demo</b><span>Outlet Bintaro · Buka hari ini</span></div>
        <span className="badge">MENU AKTIF</span>
      </section>

      <div className="mode-grid">
        {(["TAKE AWAY", "PRE-ORDER", "DELIVERY"] as Mode[]).map((m) => (
          <button key={m} className={mode === m ? "mode active" : "mode"} onClick={() => setMode(m)}>
            <b>{m}</b>
            <span>{m === "TAKE AWAY" ? "Ambil segera" : m === "PRE-ORDER" ? "Atur tanggal & jam" : "Kirim ke alamat"}</span>
          </button>
        ))}
      </div>

      <section className="grid">
        <div>
          <div className="section-title">Menu / Produk</div>
          <div className="menu">
            {products.map((p) => (
              <article className="product" key={p.id}>
                <div className="photo">{p.category === "Bakery" ? "🥐" : p.category === "Non Coffee" ? "🍵" : "☕"}</div>
                <div className="product-info">
                  <div className="category">{p.category}</div>
                  <h3>{p.name}</h3>
                  <b>Rp {p.price.toLocaleString("id-ID")}</b>
                  <div className="qty">
                    <button onClick={() => remove(p.id)}>-</button>
                    <span>{cart[p.id] || 0}</span>
                    <button onClick={() => add(p.id)}>+</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="cart">
          <div className="section-title">Cart & Checkout</div>
          {count === 0 ? <p className="muted">Belum ada produk.</p> : products.filter(p => cart[p.id]).map(p => (
            <div className="line" key={p.id}><span>{p.name} × {cart[p.id]}</span><b>Rp {(p.price * cart[p.id]).toLocaleString("id-ID")}</b></div>
          ))}
          <div className="total"><span>Total</span><b>Rp {total.toLocaleString("id-ID")}</b></div>

          <label>Nama
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama customer" />
          </label>
          <label>WhatsApp
            <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="08xxxxxxxxxx" />
          </label>

          {mode === "PRE-ORDER" && (
            <div className="two">
              <label>Tanggal<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
              <label>Jam<input type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
            </div>
          )}

          {mode === "DELIVERY" && (
            <label>Alamat Delivery
              <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Alamat lengkap penerima" />
            </label>
          )}

          <label>Catatan
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan pesanan (opsional)" />
          </label>

          <label>Metode Pembayaran
            <select value={payment} onChange={e => setPayment(e.target.value)}>
              <option>QRIS</option><option>Cash</option><option>Other</option>
            </select>
          </label>

          <button className="primary" disabled={!count || !name || !whatsapp || (mode === "PRE-ORDER" && (!date || !time)) || (mode === "DELIVERY" && !address)} onClick={() => setSubmitted(true)}>
            Checkout · Rp {total.toLocaleString("id-ID")}
          </button>
          <p className="fine">Delivery menggunakan pihak ketiga. OCT mencatat status sampai handover, bukan mengelola armada/GPS.</p>
        </aside>
      </section>
    </main>
  );
}
