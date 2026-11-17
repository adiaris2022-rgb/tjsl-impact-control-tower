"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Outlet = { id: string; name: string };
type Reservation = {
  id: string; outlet_id: string; reservation_no: string; customer_name: string;
  reserved_for: string; party_size: number; status: string; outlet_name?: string;
};
type Order = {
  id: string; outlet_id: string; total: number | string; status: string;
  payment_status: string; created_at: string;
};

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

export default function Owner() {
  const [businessIds, setBusinessIds] = useState<string[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [rows, setRows] = useState<{ outlet: string; transactions: number; nominal: number; attention: number }[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [metrics, setMetrics] = useState({ count: 0, total: 0, outlets: 0 });
  const [error, setError] = useState("");
  const [reservationError, setReservationError] = useState("");
  const [reservationBusy, setReservationBusy] = useState("");
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
        const [{ data: orders, error: orderError }, { data: outlets, error: outletError }, { data: upcoming, error: reservationQueryError }] = await Promise.all([
          supabase.from("otc_orders")
            .select("id,outlet_id,total,status,payment_status,created_at")
            .eq("business_id", businessId).gte("created_at", start.toISOString()),
          supabase.from("otc_outlets").select("id,name").eq("business_id", businessId),
          supabase.from("otc_reservations")
            .select("id,outlet_id,reservation_no,customer_name,reserved_for,party_size,status")
            .eq("business_id", businessId).gte("reserved_for", new Date().toISOString())
            .order("reserved_for").limit(50),
        ]);
        if (orderError) throw orderError;
        if (outletError) throw outletError;
        if (reservationQueryError) throw reservationQueryError;
        if (!alive) return;

        const outletRows = (outlets || []) as Outlet[];
        const names = new Map(outletRows.map((outlet) => [outlet.id, outlet.name]));
        const orderRows = (orders || []) as Order[];
        const grouped = [...new Set(orderRows.map((order) => order.outlet_id))].map((id) => {
          const matching = orderRows.filter((order) => order.outlet_id === id);
          return {
            outlet: names.get(id) || id,
            transactions: matching.length,
            nominal: matching.filter((order) => order.payment_status === "PAID")
              .reduce((sum, order) => sum + Number(order.total || 0), 0),
            attention: matching.filter((order) => !["SUCCESS", "PO_SUCCESS"].includes(order.status)).length,
          };
        }).sort((a, b) => b.nominal - a.nominal);

        setRows(grouped);
        setMetrics({
          count: orderRows.length,
          total: orderRows.filter((order) => order.payment_status === "PAID")
            .reduce((sum, order) => sum + Number(order.total || 0), 0),
          outlets: outletRows.length,
        });
        setReservations(((upcoming || []) as Reservation[]).map((reservation) => ({
          ...reservation, outlet_name: names.get(reservation.outlet_id) || reservation.outlet_id,
        })));
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : "Gagal memuat Owner Control Tower.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [businessId]);

  const currentTime = useMemo(() => new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }), []);

  async function updateReservation(reservationId: string, status: string) {
    setReservationBusy(reservationId);
    setReservationError("");
    try {
      const supabase = await getSupabase();
      const { error: rpcError } = await supabase.rpc("nortago_update_reservation_status", {
        p_reservation_id: reservationId, p_status: status,
      });
      if (rpcError) throw rpcError;
      setReservations((current) => current.map((item) =>
        item.id === reservationId ? { ...item, status } : item));
    } catch (cause) {
      setReservationError(cause instanceof Error ? cause.message : "Gagal memperbarui reservasi.");
    } finally {
      setReservationBusy("");
    }
  }

  if (loading && !businessId) return <main className="otc-page"><div className="loading">Memuat Owner Control Tower…</div></main>;
  if (error && !businessId) return <main className="otc-page"><div className="info-box wide">{error}</div></main>;

  return (
    <main className="otc-page">
      <header className="otc-head">
        <div><b>NORTAGO Order</b><small>Owner Control Tower · NORTAGO Order data</small></div>
        <nav style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/otc/owner/subscriptions">Langganan Outlet</Link><Link href="/otc">Home</Link>
        </nav>
      </header>
      <section className="customer-title">
        <span>EXECUTIVE VIEW</span><h1>Owner Control Tower</h1>
        <p>Ringkasan transaksi dan operasional untuk bisnis yang dipilih.</p>
        {businessIds.length > 1 ? (
          <label className="business-switcher">Pilih bisnis
            <select value={businessId} onChange={(event) => setBusinessId(event.target.value)}>
              {businessIds.map((id) => <option key={id} value={id}>Bisnis · {id.slice(0, 8)}</option>)}
            </select>
          </label>
        ) : null}
      </section>
      {error ? <div className="info-box wide">{error}</div> : null}
      {loading ? <div className="loading">Memuat data bisnis…</div> : <>
        <section className="metric-grid otc-metrics">
          {[[String(metrics.count), "Transaksi hari ini"], [money(metrics.total), "Pembayaran terverifikasi"],
            [String(metrics.outlets), "Outlet aktif"], [currentTime, "Dilihat sekarang"]].map(([value, label]) => (
            <article key={label}><small>{label}</small><strong>{value}</strong></article>
          ))}
        </section>
        <section className="data-panel">
          <div className="section-toolbar">
            <div><span className="eyebrow">TODAY BY OUTLET</span><h2>Ringkasan outlet</h2></div>
            <Link className="otc-secondary" href="/otc/owner-report">Lihat laporan per jam</Link>
          </div>
          {rows.length === 0 ? <div className="muted">Belum ada order hari ini.</div> : (
            <div className="table-wrap"><table><thead><tr><th>Outlet</th><th>Transaksi</th><th>Pembayaran terverifikasi</th><th>Attention</th></tr></thead>
              <tbody>{rows.map((row) => <tr key={row.outlet}><td>{row.outlet}</td><td>{row.transactions}</td>
                <td>{money(row.nominal)}</td><td><span className="status-badge">{row.attention} open</span></td></tr>)}</tbody>
            </table></div>
          )}
        </section>
        <section className="data-panel">
          <div className="section-toolbar">
            <div><span className="eyebrow">UPCOMING DINE-IN</span><h2>Permintaan reservasi</h2></div>
            <Link className="otc-secondary" href="/otc/reservation">Buat reservasi</Link>
          </div>
          {reservations.length === 0 ? <div className="muted">Belum ada reservasi mendatang.</div> : (
            <div className="table-wrap"><table><thead><tr><th>Nomor</th><th>Customer</th><th>Outlet</th><th>Waktu</th><th>Tamu</th><th>Status</th></tr></thead>
              <tbody>{reservations.map((item) => <tr key={item.id}>
                <td>{item.reservation_no}</td><td>{item.customer_name}</td><td>{item.outlet_name}</td>
                <td>{new Date(item.reserved_for).toLocaleString("id-ID")}</td><td>{item.party_size}</td>
                <td><span className="status-badge">{item.status}</span><div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {item.status === "PENDING" ? <>
                    <button type="button" className="otc-secondary" disabled={reservationBusy === item.id} onClick={() => updateReservation(item.id, "CONFIRMED")}>Konfirmasi</button>
                    <button type="button" className="otc-secondary" disabled={reservationBusy === item.id} onClick={() => updateReservation(item.id, "CANCELLED")}>Batalkan</button>
                  </> : null}
                  {item.status === "CONFIRMED" ? <button type="button" className="otc-secondary" disabled={reservationBusy === item.id} onClick={() => updateReservation(item.id, "CHECKED_IN")}>Check-in</button> : null}
                  {item.status === "CHECKED_IN" ? <button type="button" className="otc-secondary" disabled={reservationBusy === item.id} onClick={() => updateReservation(item.id, "COMPLETED")}>Selesai</button> : null}
                </div></td>
              </tr>)}</tbody></table></div>
          )}
          {reservationError ? <div className="info-box">{reservationError}</div> : null}
        </section>
      </>}
      <footer>Supported by NORTAGO · Owner summary from NORTAGO Order · Business ID: {businessId || "—"}</footer>
    </main>
  );
}
