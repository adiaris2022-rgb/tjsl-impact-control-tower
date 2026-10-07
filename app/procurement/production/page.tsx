"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"
);

export default function ProductionPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError("Silakan login melalui Procurement."); return; }

    const { data: bu, error: buError } = await supabase.from("business_users").select("business_id").eq("user_id", auth.user.id).limit(1).maybeSingle();
    if (buError || !bu?.business_id) { setError(buError?.message || "Business belum terhubung."); return; }

    const { data, error: qError } = await supabase
      .from("proc_production_orders")
      .select("id,order_id,status,priority,queued_at,blocked_reason")
      .eq("business_id", bu.business_id)
      .order("queued_at", { ascending: true });

    if (qError) setError(qError.message);
    else setOrders(data || []);
  }

  useEffect(() => { load().catch(e => setError(e.message || "Gagal memuat production.")); }, []);

  async function updateStatus(id: string, status: string) {
    const { error: e } = await supabase.from("proc_production_orders").update({ status }).eq("id", id);
    if (e) setError(e.message);
    else await load();
  }

  const active = orders.filter(o => !["COMPLETED", "CANCELLED"].includes(o.status));

  return <main style={{ minHeight: "100vh", background: "#f6f7f4", padding: 24, color: "#18201b" }}>
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <a href="/procurement">← Procurement Cafe</a>
      <h1>NORTAGO · Automatic Production Queue</h1>
      <p>Order PAID / SCHEDULED / PROCESSING → Production Queue → QC → READY.</p>
      {error && <div style={{ padding: 14, background: "#fff4e5", borderRadius: 10 }}>{error}</div>}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, margin: "20px 0" }}>
        <Card title="Active Queue" value={String(active.length)} />
        <Card title="Blocked" value={String(active.filter(o => o.status === "BLOCKED").length)} />
        <Card title="Completed" value={String(orders.filter(o => o.status === "COMPLETED").length)} />
      </section>
      <section style={{ background: "#fff", borderRadius: 16, padding: 20 }}>
        {active.length === 0 && <p>Tidak ada production order aktif.</p>}
        {active.map(o => <div key={o.id} style={{ borderBottom: "1px solid #eee", padding: "14px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><b>{o.order_id?.slice(0, 12)}</b><b>{o.status}</b></div>
          {o.blocked_reason && <p>Blocked: {o.blocked_reason}</p>}
          {o.status === "QUEUED" && <button onClick={() => updateStatus(o.id, "IN_PROGRESS")}>Mulai Produksi</button>}
          {o.status === "IN_PROGRESS" && <button onClick={() => updateStatus(o.id, "QC_PENDING")}>Selesai → QC</button>}
          {o.status === "QC_PENDING" && <button onClick={() => updateStatus(o.id, "READY")}>QC Lulus</button>}
          {o.status === "READY" && <button onClick={() => updateStatus(o.id, "COMPLETED")}>Completed</button>}
        </div>)}
      </section>
    </div>
  </main>;
}

function Card({ title, value }: { title: string; value: string }) {
  return <div style={{ background: "#fff", borderRadius: 14, padding: 18 }}><small>{title}</small><div style={{ fontSize: 30, fontWeight: 700 }}>{value}</div></div>;
}
