"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Outlet = { id: string; name: string; business_id: string };
type TableRow = { id: string; table_code: string; table_name: string; capacity: number; zone: string | null; is_active: boolean };
async function getSupabase(): Promise<SupabaseClient> {
  const response = await fetch("/api/supabase-config", { cache: "no-store" });
  const config = await response.json().catch(() => ({}));
  if (!response.ok || !config.url || !config.key) throw new Error(config.error || "Konfigurasi Supabase tidak tersedia.");
  return createClient(config.url, config.key);
}
export default function NortagoBosTablesPage() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState("");
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editId, setEditId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [zone, setZone] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const client = await getSupabase();
        const { data: auth, error: authError } = await client.auth.getUser();
        if (authError || !auth.user) throw new Error("Silakan login terlebih dahulu.");
        const { data: memberships, error: membershipError } = await client.from("business_users").select("business_id").eq("user_id", auth.user.id);
        if (membershipError) throw membershipError;
        const businessIds = [...new Set((memberships || []).map((m) => m.business_id as string).filter(Boolean))];
        if (!businessIds.length) throw new Error("Akun belum terhubung dengan bisnis.");
        const { data: outletData, error: outletError } = await client.from("otc_outlets").select("id,name,business_id").in("business_id", businessIds).eq("is_active", true).order("name");
        if (outletError) throw outletError;
        if (active) { setSupabase(client); setOutlets((outletData || []) as Outlet[]); setOutletId((outletData || [])[0]?.id || ""); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Gagal memuat data outlet."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!supabase || !outletId) { setTables([]); return; }
    let active = true;
    setLoading(true); setError(""); setNotice("");
    (async () => {
      const { data, error: rpcError } = await supabase.rpc("nortago_bos_table_list", { p_outlet_id: outletId });
      if (!active) return;
      if (rpcError) setError(rpcError.message.includes("FEATURE_REQUIRES_NORTAGO_BOS") ? "Fitur ini hanya tersedia untuk outlet dengan NORTAGO BOS aktif." : rpcError.message);
      else setTables(Array.isArray(data) ? data as TableRow[] : []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [supabase, outletId]);

  const selectedOutlet = useMemo(() => outlets.find((o) => o.id === outletId), [outlets, outletId]);
  const resetForm = () => { setEditId(""); setCode(""); setName(""); setCapacity("4"); setZone(""); };
  const startEdit = (row: TableRow) => { setEditId(row.id); setCode(row.table_code); setName(row.table_name); setCapacity(String(row.capacity)); setZone(row.zone || ""); };
  async function saveTable(event: React.FormEvent) {
    event.preventDefault(); if (!supabase || !outletId) return;
    setBusy(true); setError(""); setNotice("");
    const { error: rpcError } = await supabase.rpc("nortago_bos_table_save", {
      p_outlet_id: outletId, p_table_id: editId || null, p_table_code: code.trim(),
      p_table_name: name.trim(), p_capacity: Number(capacity), p_zone: zone.trim() || null, p_is_active: true,
    });
    if (rpcError) setError(rpcError.message);
    else { setNotice(editId ? "Meja berhasil diperbarui." : "Meja berhasil ditambahkan."); resetForm();
      const { data, error: listError } = await supabase.rpc("nortago_bos_table_list", { p_outlet_id: outletId });
      if (listError) setError(listError.message); else setTables(Array.isArray(data) ? data as TableRow[] : []);
    }
    setBusy(false);
  }
  async function toggleActive(row: TableRow) {
    if (!supabase) return; setBusy(true); setError(""); setNotice("");
    const { error: rpcError } = await supabase.rpc("nortago_bos_table_save", {
      p_outlet_id: outletId, p_table_id: row.id, p_table_code: row.table_code,
      p_table_name: row.table_name, p_capacity: row.capacity, p_zone: row.zone, p_is_active: !row.is_active,
    });
    if (rpcError) setError(rpcError.message);
    else { setNotice(row.is_active ? "Meja dinonaktifkan." : "Meja diaktifkan kembali.");
      const { data } = await supabase.rpc("nortago_bos_table_list", { p_outlet_id: outletId });
      setTables(Array.isArray(data) ? data as TableRow[] : []);
    }
    setBusy(false);
  }
  const activeCount = tables.filter((t) => t.is_active).length;
  const totalCapacity = tables.filter((t) => t.is_active).reduce((sum, t) => sum + Number(t.capacity || 0), 0);

  return <main className="otc-page" style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px 60px" }}>
    <header className="otc-head"><div><b>NORTAGO BOS</b><small>Table Management</small></div><nav style={{ display: "flex", gap: 12 }}><Link href="/otc/owner">Owner Dashboard</Link><Link href="/otc">Home</Link></nav></header>
    <section className="customer-title"><span>BOS OPERATIONS</span><h1>Manajemen Meja</h1><p>Kelola daftar meja, kapasitas, area, dan status operasional outlet.</p></section>
    {error && <div className="info-box wide" role="alert">{error}</div>}
    {notice && <div className="info-box wide">{notice}</div>}
    {loading && <div className="loading">Memuat data…</div>}
    {!loading && outlets.length === 0 && !error && <div className="info-box wide">Belum ada outlet aktif yang terhubung ke akun bisnis.</div>}
    {!loading && outlets.length > 0 && <>
      <section className="data-panel" style={{ marginBottom: 20 }}>
        <label style={{ display: "grid", gap: 8, maxWidth: 420 }}>Outlet aktif<select value={outletId} onChange={(e) => setOutletId(e.target.value)}>{outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <div className="metric-grid otc-metrics" style={{ marginTop: 16 }}><article><small>Meja aktif</small><strong>{activeCount}</strong></article><article><small>Kapasitas meja aktif</small><strong>{totalCapacity} orang</strong></article><article><small>Total meja terdaftar</small><strong>{tables.length}</strong></article></div>
      </section>
      <section className="data-panel" style={{ marginBottom: 20 }}>
        <div className="section-toolbar"><div><span className="eyebrow">{editId ? "EDIT TABLE" : "ADD TABLE"}</span><h2>{editId ? "Perbarui meja" : "Tambah meja baru"}</h2></div>{editId && <button type="button" className="otc-secondary" onClick={resetForm}>Batal edit</button>}</div>
        <form onSubmit={saveTable} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
          <label>Kode meja<input required maxLength={16} pattern="[A-Za-z0-9_-]+" value={code} onChange={(e) => setCode(e.target.value)} placeholder="T01"/></label>
          <label>Nama meja<input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Meja 1"/></label>
          <label>Kapasitas (orang)<input required type="number" min={1} max={50} value={capacity} onChange={(e) => setCapacity(e.target.value)}/></label>
          <label>Area / Zona<input maxLength={60} value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Indoor, Teras…"/></label>
          <div style={{ display: "flex", alignItems: "end" }}><button type="submit" className="otc-primary" disabled={busy}>{busy ? "Menyimpan…" : editId ? "Simpan perubahan" : "Tambah meja"}</button></div>
        </form>
      </section>
      <section className="data-panel">
        <div className="section-toolbar"><div><span className="eyebrow">TABLE REGISTER</span><h2>Daftar meja · {selectedOutlet?.name || "Outlet"}</h2></div></div>
        {tables.length === 0 ? <p className="muted">Belum ada meja. Tambahkan meja pertama menggunakan formulir di atas.</p> : <div className="table-wrap"><table><thead><tr><th>Kode</th><th>Nama</th><th>Area</th><th>Kapasitas</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{tables.map((t) => <tr key={t.id}><td>{t.table_code}</td><td>{t.table_name}</td><td>{t.zone || "—"}</td><td>{t.capacity} orang</td><td><span className="status-badge">{t.is_active ? "Aktif" : "Nonaktif"}</span></td><td style={{ whiteSpace: "nowrap" }}><button className="otc-secondary" type="button" disabled={busy} onClick={() => startEdit(t)}>Edit</button> <button className="otc-secondary" type="button" disabled={busy} onClick={() => toggleActive(t)}>{t.is_active ? "Nonaktifkan" : "Aktifkan"}</button></td></tr>)}</tbody></table></div>}
      </section>
    </>}
    <footer>Table Management · NORTAGO BOS · {selectedOutlet?.name || "—"}</footer>
  </main>;
}
