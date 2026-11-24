"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Mode = "TAKE_AWAY" | "PRE_ORDER" | "DELIVERY";
type Product = { id: string; name: string; price: number; product_type: "PRODUCT" | "SERVICE"; allow_full_payment: boolean; allow_dp: boolean; dp_type: "PERCENT" | "FIXED"; dp_value: number; cat?: string; desc?: string; image_url?: string | null };
type Outlet = { id: string; business_id: string; name: string };
type CartItem = { key: string; product: Product; qty: number; variant: string; addons: { name: string; price: number }[] };

async function getSupabase() {
  const response = await fetch("/api/supabase-config", { cache: "no-store" });
  const config = await response.json().catch(() => ({}));
  if (!response.ok || !config.url || !config.key) throw new Error(config.error || "Konfigurasi Supabase tidak tersedia.");
  return createClient(config.url, config.key);
}

export default function CustomerOrder() {
  const [mode, setMode] = useState<Mode>("TAKE_AWAY");
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuLoading, setMenuLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = await getSupabase();
        const { data, error: queryError } = await supabase
          .from("otc_outlets")
          .select("id,business_id,name")
          .eq("is_active", true)
          .order("name");
        if (queryError) throw queryError;
        if (!alive) return;
        setOutlets((data || []) as Outlet[]);
        setOutletId(data?.[0]?.id || "");
        if (!data?.length) setError("Belum ada outlet yang aktif.");
      } catch (cause: unknown) {
        if (alive) setError(cause instanceof Error ? cause.message : "Gagal memuat outlet.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!outletId) {
      setProducts([]);
      return;
    }
    let alive = true;
    setMenuLoading(true);
    setError("");
    setCart([]);
    (async () => {
      try {
        const supabase = await getSupabase();
        const { data, error: queryError } = await supabase
          .from("otc_outlet_products")
          .select("price,is_available,allow_full_payment,allow_dp,dp_type,dp_value,product:otc_products(id,name,description,category,image_url,base_price,product_type)")
          .eq("outlet_id", outletId)
          .eq("is_available", true)
          .eq("product.is_active", true);
        if (queryError) throw queryError;
        const mapped = (data || [])
          .filter((row: any) => row.product && row.product.id)
          .map((row: any) => ({
            id: row.product.id,
            name: row.product.name,
            price: Number(row.price ?? row.product.base_price ?? 0),
            cat: row.product.category || undefined,
            desc: row.product.description || undefined,
            image_url: row.product.image_url || null,
            product_type: (row.product.product_type === "SERVICE" ? "SERVICE" : "PRODUCT") as Product["product_type"],
            allow_full_payment: row.product.product_type === "SERVICE" ? row.allow_full_payment !== false : true,
            allow_dp: row.product.product_type === "SERVICE" && Boolean(row.allow_dp),
            dp_type: row.dp_type === "FIXED" ? "FIXED" : "PERCENT",
            dp_value: Number(row.dp_value ?? 50),
          }));
        if (alive) setProducts(mapped);
      } catch (cause: unknown) {
        if (alive) {
          setProducts([]);
          setError(cause instanceof Error ? cause.message : "Gagal memuat menu outlet.");
        }
      } finally {
        if (alive) setMenuLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [outletId]);

  const outlet = outlets.find((item) => item.id === outletId);
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.product.price * item.qty, 0), [cart]);

  const add = (product: Product) => setCart((current) => {
    const key = product.id + "|Default";
    const existing = current.find((item) => item.key === key);
    if (existing) return current.map((item) => item.key === key ? { ...item, qty: item.qty + 1 } : item);
    return [...current, { key, product, qty: 1, variant: "Default", addons: [] }];
  });

  const change = (key: string, delta: number) =>
    setCart((current) => current.map((item) => item.key === key ? { ...item, qty: item.qty + delta } : item).filter((item) => item.qty > 0));

  const goCheckout = () => {
    sessionStorage.setItem("otc_cart", JSON.stringify(cart));
    sessionStorage.setItem("otc_outlet_id", outletId);
  };

  if (loading) return <main className="otc-page"><div className="loading">Memuat outlet…</div></main>;
  if (error && !outlets.length) return <main className="otc-page"><div className="info-box wide">{error}</div></main>;

  return (
    <main className="otc-page">
      <header className="otc-head">
        <div><b>NORTAGO Order</b><small>Customer Mini App · {outlet?.name || "Outlet"}</small></div>
        <Link href="/otc">Home</Link>
      </header>
      <section className="customer-title">
        <span>ORDER ONLINE</span><h1>Menu & Checkout</h1>
        <p>Menu, ketersediaan, dan harga mengikuti outlet yang dipilih.</p>
        <label style={{ display: "inline-grid", gap: 6, marginTop: 15, color: "#9db2ae", fontSize: 12 }}>
          Outlet
          <select value={outletId} onChange={(event) => setOutletId(event.target.value)} style={{ background: "#081417", border: "1px solid #294447", color: "#e9f1ef", borderRadius: 9, padding: "10px 12px" }}>
            {outlets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </section>
      <div className="mode-grid otc-mode">
        {([["TAKE_AWAY", "Take Away", "Ambil segera"], ["PRE_ORDER", "Pre-Order", "Jadwal hari/tanggal"], ["DELIVERY", "Delivery", "Kurir pihak ketiga"]] as const).map(([value, title, subtitle]) => (
          <button type="button" className={mode === value ? "active-mode" : ""} onClick={() => setMode(value)} key={value}>
            <b>{title}</b><small>{subtitle}</small>
          </button>
        ))}
      </div>
      {error ? <div className="info-box wide">{error}</div> : null}
      <section className="otc-shop">
        <div className="menu-panel">
          <div className="section-head"><div><span className="eyebrow">MENU</span><h2>Produk & Jasa</h2></div><span className="pill">{menuLoading ? "Memuat…" : "Outlet Live"}</span></div>
          {menuLoading ? <p className="muted">Memuat produk outlet…</p> : products.length === 0 ? <p className="muted">Belum ada produk atau jasa tersedia di outlet ini.</p> : products.map((product) => (
            <article className="product-card" key={product.id}>
              <div className="product-photo">{product.image_url ? <img src={product.image_url} alt={product.name} /> : "PHOTO"}</div>
              <div className="product-info"><small>{product.product_type === "SERVICE" ? "JASA" : "PRODUK"}{product.cat ? " · " + product.cat : ""}</small><h3>{product.name}</h3><p>{product.desc || "Produk NORTAGO Order"}</p><b>Rp {product.price.toLocaleString("id-ID")}</b></div>
              <button type="button" className="otc-secondary" onClick={() => add(product)} disabled={menuLoading}>+ Tambah</button>
            </article>
          ))}
        </div>
        <aside className="cart-panel">
          <span className="eyebrow">CART</span><h2>Pesanan Anda</h2>
          {cart.length === 0 ? <p className="muted">Belum ada item.</p> : cart.map((item) => (
            <div className="cart-line" key={item.key}>
              <span>{item.product.name} × {item.qty}</span>
              <div style={{ textAlign: "right" }}><b>Rp {(item.product.price * item.qty).toLocaleString("id-ID")}</b><div className="qty"><button type="button" onClick={() => change(item.key, -1)}>−</button><span>{item.qty}</span><button type="button" onClick={() => change(item.key, 1)}>+</button></div></div>
            </div>
          ))}
          <div className="total-line"><span>Subtotal indikatif</span><strong>Rp {total.toLocaleString("id-ID")}</strong></div>
          <Link onClick={goCheckout} className={"otc-primary full " + (!cart.length || menuLoading ? "disabled" : "")} href={cart.length && !menuLoading ? "/otc/checkout?mode=" + mode : "#"}>Lanjut Checkout →</Link>
          {mode === "PRE_ORDER" ? <div className="info-box">Jadwal pickup dipilih pada halaman checkout.</div> : null}
          {mode === "DELIVERY" ? <div className="info-box">Delivery menggunakan kurir pihak ketiga. Biaya antar belum dihitung.</div> : null}
          {mode === "TAKE_AWAY" ? <div className="info-box">Pickup Pass dibuat setelah order tercatat.</div> : null}
        </aside>
      </section>
      <footer>Supported by NORTAGO · NORTAGO Order</footer>
    </main>
  );
}
