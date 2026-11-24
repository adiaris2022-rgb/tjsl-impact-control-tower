"use client";

import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

async function getSupabase() {
  const response = await fetch("/api/supabase-config", { cache: "no-store" });
  const config = await response.json().catch(() => ({}));
  if (!response.ok || !config.url || !config.key) {
    throw new Error(config.error || "Konfigurasi Supabase tidak tersedia.");
  }
  return createClient(config.url, config.key);
}

type ReceiptData = {
  order: {
    order_no: string;
    customer_name: string | null;
    fulfillment_type: string;
    status: string;
    payment_status: string;
    payment_method: string | null;
    payment_option: "FULL" | "DP";
    payment_amount_due: number;
    payment_balance_due: number;
    scheduled_at: string | null;
    subtotal: number;
    delivery_fee: number;
    discount: number;
    total: number;
    pickup_code: string | null;
    created_at: string;
    outlet_name: string;
  };
  items: Array<{ product_name_snapshot: string; unit_price: number; quantity: number; line_total: number }>;
};

function Receipt() {
  const query = useSearchParams();
  const token = query.get("token") || "";
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!token) {
      setError("Tautan receipt tidak lengkap.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const supabase = await getSupabase();
        const { data, error: rpcError } = await supabase.rpc("nortago_get_customer_receipt", {
          p_receipt_token: token,
        });
        if (rpcError) throw rpcError;
        if (!data?.order) throw new Error("Receipt tidak ditemukan atau tautan tidak valid.");
        if (alive) setReceipt(data as ReceiptData);
      } catch (cause: unknown) {
        if (alive) setError(cause instanceof Error ? cause.message : "Gagal memuat receipt.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  if (loading) return <main className="otc-page"><div className="loading">Memuat digital receipt…</div></main>;
  if (error || !receipt) return <main className="otc-page"><div className="info-box wide">{error || "Receipt tidak tersedia."}</div></main>;

  const order = receipt.order;
  const money = (value: number) => Number(value || 0).toLocaleString("id-ID");
  return (
    <main className="otc-page">
      <header className="otc-head">
        <div><b>NORTAGO Order</b><small>Digital Receipt · Private Access</small></div>
        <Link href="/otc/customer-order">Order lagi</Link>
      </header>
      <section className="success-card">
        <span className="eyebrow">DIGITAL RECEIPT</span>
        <h1>{order.order_no}</h1>
        <p>{order.outlet_name || "Outlet"} · {new Date(order.created_at).toLocaleString("id-ID")}</p>
        <div className="receipt-mini">
          <span>Customer</span><b>{order.customer_name || "—"}</b>
          <span>Fulfillment</span><b>{order.fulfillment_type}</b>
          <span>Status</span><b>{order.status}</b>
          <span>Payment</span><b>{order.payment_status} · {order.payment_method || "—"}</b>
          <span>Skema pembayaran</span><b>{order.payment_option === "DP" ? "DP" : "Pembayaran penuh"}</b>
          {order.scheduled_at ? <><span>Scheduled</span><b>{new Date(order.scheduled_at).toLocaleString("id-ID")}</b></> : null}
        </div>
        <div className="receipt-items">
          {receipt.items.map((item, index) => (
            <div className="cart-line" key={index}>
              <span>{item.product_name_snapshot} × {item.quantity}</span>
              <b>Rp {money(item.line_total)}</b>
            </div>
          ))}
        </div>
        <div className="total-line"><span>Total pesanan</span><strong>Rp {money(order.total)}</strong></div>
        <div className="total-line"><span>Tagihan awal</span><strong>Rp {money(order.payment_amount_due ?? order.total)}</strong></div>
        {(order.payment_balance_due ?? 0) > 0 ? <div className="total-line"><span>Sisa tagihan</span><strong>Rp {money(order.payment_balance_due)}</strong></div> : null}
        {order.pickup_code ? <div className="info-box">Pickup Pass: <b>{order.pickup_code}</b></div> : null}
        <p className="muted">Receipt diakses menggunakan tautan privat khusus pesanan ini.</p>
      </section>
      <footer>Supported by NORTAGO · NORTAGO Order</footer>
    </main>
  );
}

export default function DigitalReceipt() {
  return <Suspense fallback={<main className="otc-page"><div className="loading">Memuat…</div></main>}><Receipt /></Suspense>;
}
