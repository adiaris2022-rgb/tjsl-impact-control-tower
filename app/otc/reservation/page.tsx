"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type Outlet = { id: string; name: string };

async function getSupabase() {
  const response = await fetch("/api/supabase-config", { cache: "no-store" });
  const config = await response.json().catch(() => ({}));
  if (!response.ok || !config.url || !config.key) throw new Error(config.error || "Konfigurasi Supabase tidak tersedia.");
  return createClient(config.url, config.key);
}

export default function Reservation() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [note, setNote] = useState("");
  const [reservationNo, setReservationNo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const todayLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = await getSupabase();
        const { data, error: queryError } = await supabase
          .from("otc_outlets").select("id,name").eq("is_active", true).order("name");
        if (queryError) throw queryError;
        if (!alive) return;
        setOutlets((data || []) as Outlet[]);
        setOutletId(data?.[0]?.id || "");
        if (!data?.length) setError("Belum ada outlet aktif untuk reservasi.");
      } catch (cause: unknown) {
        if (alive) setError(cause instanceof Error ? cause.message : "Gagal memuat outlet.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!outletId || !date || !time) throw new Error("Outlet, tanggal, dan jam reservasi wajib dipilih.");
      const reservedFor = new Date(date + "T" + time).toISOString();
      const supabase = await getSupabase();
      const { data, error: rpcError } = await supabase.rpc("nortago_create_customer_reservation", {
        p_outlet_id: outletId,
        p_customer_name: name,
        p_customer_whatsapp: whatsapp,
        p_reserved_for: reservedFor,
        p_party_size: Number(partySize),
        p_note: note || null,
      });
      if (rpcError) throw rpcError;
      if (!data?.reservation_no) throw new Error("Nomor reservasi tidak diterima.");
      setReservationNo(data.reservation_no);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Gagal membuat reservasi.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main className="otc-page"><div className="loading">Memuat outlet…</div></main>;

  return (
    <main className="otc-page">
      <header className="otc-head"><div><b>NORTAGO Order</b><small>Dine-In Reservation</small></div><Link href="/otc/customer-order">← Menu</Link></header>
      <section className="customer-title"><span>RESERVATION</span><h1>Reservasi meja</h1><p>Permintaan reservasi dicatat dan menunggu konfirmasi outlet.</p></section>
      {reservationNo ? (
        <section className="success-card">
          <span className="eyebrow">RESERVATION REQUEST RECORDED</span>
          <h2>{reservationNo}</h2>
          <p>Status: <b>PENDING</b>. Outlet perlu mengonfirmasi ketersediaan meja sebelum reservasi dianggap pasti.</p>
          <Link className="otc-primary" href="/otc/customer-order">Kembali ke menu</Link>
        </section>
      ) : (
        <form className="form-card narrow" onSubmit={submit}>
          {error ? <div className="info-box">{error}</div> : null}
          <label>Outlet<select value={outletId} onChange={(event) => setOutletId(event.target.value)} required>{outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select></label>
          <label>Nama<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} required /></label>
          <label>WhatsApp<input value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="08xxxxxxxxxx" required /></label>
          <div className="two">
            <label>Tanggal<input type="date" min={todayLocal} value={date} onChange={(event) => setDate(event.target.value)} required /></label>
            <label>Jam<input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
          </div>
          <label>Jumlah orang<input type="number" min="1" max="30" value={partySize} onChange={(event) => setPartySize(event.target.value)} required /></label>
          <label>Catatan<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="Permintaan khusus (opsional)" /></label>
          <button className="otc-primary full" disabled={saving || !outletId}>{saving ? "Menyimpan…" : "Kirim Permintaan Reservasi →"}</button>
        </form>
      )}
      <footer>Supported by NORTAGO · NORTAGO Order</footer>
    </main>
  );
}
