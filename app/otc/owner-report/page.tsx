"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { buildInboxCursorFilter } from "../owner/inbox-pagination.mjs";
import { fetchAllSummaryRows, SUMMARY_PAGE_SIZE } from "../owner/summary-pagination.mjs";
import { summarizeHourlyOrders } from "./hourly-summary.mjs";

type Order = { id: string; total: number | string; status: string; payment_status: string; created_at: string };

async function getSupabase() {
  const response = await fetch("/api/supabase-config", { cache: "no-store" });
  const config = await response.json().catch(() => ({}));
  if (!response.ok || !config.url || !config.key) {
    throw new Error(config.error || "Konfigurasi Supabase tidak tersedia.");
  }
  return createClient(config.url, config.key);
}

const money = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);

export default function Report() {
  const [businessIds, setBusinessIds] = useState<string[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = await getSupabase();
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Sesi login tidak ditemukan.");
        const { data, error: membershipError } = await supabase
          .from("business_users").select("business_id").eq("user_id", auth.user.id);
        if (membershipError) throw membershipError;
        const ids = [...new Set((data || []).map((row) => row.business_id as string).filter(Boolean))];
        if (!ids.length) throw new Error("Akun ini belum terhubung dengan bisnis.");
        if (alive) {
          setBusinessIds(ids);
          setBusinessId(ids[0]);
        }
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : "Gagal memuat akun bisnis.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!businessId) return;
    let alive = true;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const supabase = await getSupabase();
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const startIso = start.toISOString();
        const reportRows = await fetchAllSummaryRows((cursor, pageSize) => {
          let query = supabase.from("otc_orders").select("id,total,status,payment_status,created_at")
            .eq("business_id", businessId).gte("created_at", startIso)
            .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(pageSize);
          return cursor ? query.or(buildInboxCursorFilter(cursor)) : query;
        }, SUMMARY_PAGE_SIZE);
        if (alive) setOrders(reportRows as Order[]);
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : "Gagal memuat laporan.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [businessId]);

  const rows = useMemo(() => {
    const grouped = new Map<string, { count: number; paidTotal: number }>();
    for (const order of orders) {
      const hour = new Date(order.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", hour12: false });
      const value = grouped.get(hour) || { count: 0, paidTotal: 0 };
      value.count += 1;
      if (order.payment_status === "PAID") value.paidTotal += Number(order.total || 0);
      grouped.set(hour, value);
    }
    return Array.from(grouped.entries())
      .map(([hour, value]) => ({ hour, ...value }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }, [orders]);

  if (loading && !businessId) return <main className="otc-page"><div className="loading">Memuat laporan…</div></main>;
  if (error && !businessId) return <main className="otc-page"><div className="info-box wide">{error}</div></main>;

  return (
    <main className="otc-page">
      <header className="otc-head">
        <div><b>NORTAGO Order</b><small>Automatic Hourly Report · NORTAGO Order data</small></div>
        <Link href="/otc/owner">← Owner</Link>
      </header>
      <section className="customer-title">
        <span>AUTOMATIC REPORT</span><h1>Laporan setiap jam</h1>
        <p>Jumlah order dan pembayaran terverifikasi per jam untuk bisnis yang dipilih, hari ini.</p>
        {businessIds.length > 1 ? (
          <label className="business-switcher">Pilih bisnis
            <select value={businessId} onChange={(event) => setBusinessId(event.target.value)}>
              {businessIds.map((id) => <option key={id} value={id}>Bisnis · {id.slice(0, 8)}</option>)}
            </select>
          </label>
        ) : null}
      </section>
      {error ? <div className="info-box wide">{error}</div> : null}
      {loading ? <div className="loading">Memuat data bisnis…</div> : (
        <section className="data-panel">
          <div className="table-wrap">
            {rows.length === 0 ? <div className="muted">Belum ada order hari ini.</div> : (
              <table>
                <thead><tr><th>Jam</th><th>Jumlah order</th><th>Pembayaran terverifikasi</th></tr></thead>
                <tbody>{rows.map((row) => <tr key={row.hour}>
                  <td>{row.hour}</td><td>{row.count}</td><td>{money(row.paidTotal)}</td>
                </tr>)}</tbody>
              </table>
            )}
          </div>
        </section>
      )}
      <div className="info-box wide">Nominal hanya menjumlahkan order dengan payment_status PAID. Status order dan status pembayaran adalah dua indikator yang berbeda.</div>
      <footer>Supported by NORTAGO · Report from NORTAGO Order · Business ID: {businessId || "—"}</footer>
    </main>
  );
}
