"use client";

import { useMemo, useState } from "react";

type Mode = "TAKE AWAY" | "PRE-ORDER" | "DELIVERY";

const outlets = [
  { id: "bintaro", name: "Outlet Bintaro" },
  { id: "pondok", name: "Outlet Pondok Indah" },
];

const products = [
  { id: "kopi", name: "Kopi Susu", price: 22000, category: "Coffee", desc: "Espresso, susu, dan gula aren." },
  { id: "americano", name: "Americano", price: 18000, category: "Coffee", desc: "Espresso dengan air mineral." },
  { id: "croissant", name: "Croissant", price: 28000, category: "Bakery", desc: "Croissant butter renyah." },
  { id: "cake", name: "Chocolate Cake", price: 32000, category: "Bakery", desc: "Cake cokelat lembut." },
];

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

export default function OTCPage() {
  const [mode, setMode] = useState<Mode>("TAKE AWAY");
  const [outlet, setOutlet] = useState(outlets[0].id);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [schedule, setSchedule] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [payment, setPayment] = useState("QRIS");
  const [submitted, setSubmitted] = useState(false);

  const items = useMemo(
    () => products.filter((p) => (cart[p.id] || 0) > 0),
    [cart]
  );

  const total = useMemo(
    () => items.reduce((sum, p) => sum + p.price * (cart[p.id] || 0), 0),
    [items, cart]
  );

  const add = (id: string) => {
    setSubmitted(false);
    setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  };

  const remove = (id: string) => {
    setSubmitted(false);
    setCart((c) => {
      const next = { ...c };
      if ((next[id] || 0) <= 1) delete next[id];
      else next[id] -= 1;
      return next;
    });
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    setSubmitted(false);
  };

  const submitOrder = () => {
    if (!total) return;
    if (!name.trim() || !whatsapp.trim()) return;
    if (mode === "PRE-ORDER" && !schedule) return;
    if (mode === "DELIVERY" && !address.trim()) return;
    setSubmitted(true);
  };

  return (
    <main style={{ minHeight: "100vh", background: "#061014", color: "#eef7f5", padding: "22px 18px 42px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <header style={{ padding: "8px 0 24px" }}>
          <div style={{ fontSize: 12, letterSpacing: 2, color: "#56d6c0", fontWeight: 800 }}>NORTAGO OTC</div>
          <h1 style={{ margin: "8px 0 4px", fontSize: 34 }}>Menu & Order</h1>
          <p style={{ color: "#8da19f", margin: 0 }}>Kedai Kopi • Pilih outlet, produk, dan cara menerima pesanan.</p>
        </header>

        <section style={{ background: "#09191d", border: "1px solid #17363a", borderRadius: 20, padding: 16, marginBottom: 22 }}>
          <div style={{ fontSize: 12, color: "#8da19f", fontWeight: 800, marginBottom: 10 }}>CARA MENERIMA PESANAN</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
            {(["TAKE AWAY", "PRE-ORDER", "DELIVERY"] as Mode[]).map((m) => (
              <button key={m} onClick={() => changeMode(m)} style={{
                padding: "15px 8px", borderRadius: 13, border: mode === m ? "2px solid #55d6c0" : "1px solid #244247",
                background: mode === m ? "#55d6c0" : "#102428", color: mode === m ? "#061014" : "#a8bab8", fontWeight: 900
              }}>{m}</button>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 22 }}>
          <label style={{ display: "block", color: "#8da19f", fontSize: 12, fontWeight: 800, marginBottom: 8 }}>PILIH OUTLET</label>
          <select value={outlet} onChange={(e) => setOutlet(e.target.value)} style={{ width: "100%", padding: 13, borderRadius: 12, background: "#0b1b1f", color: "#eef7f5", border: "1px solid #244247", boxSizing: "border-box" }}>
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(300px,360px)", gap: 18, alignItems: "start" }}>
          <section>
            <h2 style={{ fontSize: 24, margin: "0 0 12px" }}>Menu / Produk</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {products.map((p) => (
                <article key={p.id} style={{ background: "#09191d", border: "1px solid #17363a", borderRadius: 16, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#55d6c0", fontWeight: 800 }}>{p.category}</div>
                      <strong style={{ display: "block", fontSize: 19, marginTop: 4 }}>{p.name}</strong>
                      <div style={{ color: "#78908e", margin: "5px 0 8px" }}>{p.desc}</div>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>{rupiah(p.price)}</div>
                    </div>
                    <button onClick={() => add(p.id)} style={{ alignSelf: "center", padding: "12px 16px", borderRadius: 12, border: 0, background: "#55d6c0", color: "#061014", fontWeight: 900, whiteSpace: "nowrap" }}>+ Tambah</button>
                  </div>
                  {(cart[p.id] || 0) > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                      <button onClick={() => remove(p.id)} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #35565a", background: "#102428", color: "#eef7f5" }}>−</button>
                      <strong>{cart[p.id]}</strong>
                      <button onClick={() => add(p.id)} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #35565a", background: "#102428", color: "#eef7f5" }}>+</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section style={{ background: "#09191d", border: "1px solid #17363a", borderRadius: 18, padding: 18, position: "sticky", top: 12 }}>
            <div style={{ color: "#55d6c0", fontSize: 12, fontWeight: 900 }}>CART • {mode}</div>
            <h2 style={{ margin: "5px 0 14px" }}>Checkout</h2>

            {items.length === 0 ? (
              <p style={{ color: "#78908e" }}>Belum ada produk.</p>
            ) : (
              <div style={{ display: "grid", gap: 9, marginBottom: 14 }}>
                {items.map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span>{p.name} × {cart[p.id]}</span>
                    <strong>{rupiah(p.price * cart[p.id])}</strong>
                  </div>
                ))}
                <div style={{ borderTop: "1px solid #244247", paddingTop: 10, display: "flex", justifyContent: "space-between", fontWeight: 900 }}>
                  <span>Total</span><span>{rupiah(total)}</span>
                </div>
              </div>
            )}

            {mode === "PRE-ORDER" && (
              <input value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="Tanggal & jam pengambilan" style={{ width: "100%", padding: 12, marginBottom: 10, borderRadius: 10, boxSizing: "border-box", background: "#102428", color: "#eef7f5", border: "1px solid #244247" }} />
            )}

            {mode === "DELIVERY" && (
              <>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Alamat pengantaran" rows={3} style={{ width: "100%", padding: 12, marginBottom: 10, borderRadius: 10, boxSizing: "border-box", background: "#102428", color: "#eef7f5", border: "1px solid #244247" }} />
                <input value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} placeholder="Catatan pengantaran (opsional)" style={{ width: "100%", padding: 12, marginBottom: 10, borderRadius: 10, boxSizing: "border-box", background: "#102428", color: "#eef7f5", border: "1px solid #244247" }} />
              </>
            )}

            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama customer" style={{ width: "100%", padding: 12, marginBottom: 10, borderRadius: 10, boxSizing: "border-box", background: "#102428", color: "#eef7f5", border: "1px solid #244247" }} />
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp" style={{ width: "100%", padding: 12, marginBottom: 10, borderRadius: 10, boxSizing: "border-box", background: "#102428", color: "#eef7f5", border: "1px solid #244247" }} />

            <select value={payment} onChange={(e) => setPayment(e.target.value)} style={{ width: "100%", padding: 12, marginBottom: 12, borderRadius: 10, background: "#102428", color: "#eef7f5", border: "1px solid #244247" }}>
              <option>QRIS</option><option>Cash</option><option>Other</option>
            </select>

            <button disabled={!total} onClick={submitOrder} style={{ width: "100%", padding: 14, borderRadius: 12, border: 0, background: total ? "#55d6c0" : "#294044", color: total ? "#061014" : "#78908e", fontWeight: 900 }}>
              Bayar & Buat Pesanan
            </button>

            {submitted && (
              <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: "#0d2a25", border: "1px solid #24564d" }}>
                <strong>Pesanan berhasil dibuat.</strong>
                <div style={{ color: "#9cc5bf", marginTop: 5 }}>Mode: {mode} • Outlet: {outlets.find((o) => o.id === outlet)?.name}</div>
                <div style={{ color: "#9cc5bf" }}>Pembayaran: {payment} • Total: {rupiah(total)}</div>
                {mode === "DELIVERY" && <div style={{ color: "#9cc5bf" }}>Delivery menggunakan kurir pihak ketiga.</div>}
              </div>
            )}
          </section>
        </div>

        <footer style={{ marginTop: 28, textAlign: "center", fontSize: 12, color: "#607976" }}>
          Supported by NORTAGO • Customer Self Order → Order Engine → Payment → Fulfillment → Handover → Owner Control Tower
        </footer>
      </div>
    </main>
  );
}

