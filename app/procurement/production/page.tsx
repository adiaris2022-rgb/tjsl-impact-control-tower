"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, type ReactNode } from "react";
import { createClient, type User } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"
);

type ProductionOrder = {
  id: string; order_id: string; outlet_id: string; status: string; priority: string; queued_at: string; blocked_reason: string | null;
  otc_orders?: { order_no: string; customer_name: string | null; fulfillment_type: string; scheduled_at: string | null };
  otc_outlets?: { name: string };
  proc_production_items?: Array<{ id: string; product_name_snapshot: string; quantity: number; required_qty: number; unit: string; status: string }>;
};

export default function ProductionPage() {
  const [user, setUser] = useState<User | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) load(u);
    });
  }, []);

  async function load(u: User) {
    setError("");
    const { data: bu, error: e } = await supabase.from("business_users").select("business_id").eq("user_id", u.id).limit(1).maybeSingle();
    if (e || !bu) { setError(e?.message || "Akun belum terhubung ke bisnis."); return; }

    const [b, p] = await Promise.all([
      supabase.from("businesses").select("name").eq("id", bu.business_id).maybeSingle(),
      supabase.from("proc_production_orders").select("id,order_id,outlet_id,status,priority,queued_at,blocked_reason,otc_orders(order_no,customer_name,fulfillment_type,scheduled_at),otc_outlets(name),proc_production_items(id,product_name_snapshot,quantity,required_qty,unit,status)").eq("business_id", bu.business_id).order("queued_at", { ascending: true })
    ]);
    if (p.error) { setError(p.error.message); return; }
    setBusinessName(b.data?.name || "Cafe");
    setOrders((p.data || []) as ProductionOrder[]);
  }

  async function setStatus(id: string, status: string) {
    setBusy(true);
    setError("");
    const patch: Record<string, string> = { status };
    if (status === "IN_PROGRESS") patch.started_at = new Date().toISOString();
    if (status === "READY") patch.ready_at = new Date().toISOString();
    if (status === "COMPLETED") patch.completed_at = new Date().toISOString();
    const { error: e } = await supabase.from("proc_production_orders").update(patch).eq("id", id);
    if (e) setError(e.message); else if (user) await load(user);
    setBusy(false);
  }

  if (!user) return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}><section><h1>NORTAGO · Production</h1><p>Silakan login melalui Procurement Cafe terlebih dahulu.</p><a href="/procurement">← Kembali ke Procurement</a></section></main>;

  const active = orders.filter(o => !["COMPLETED", "CANCELLED"].includes(o.status));
  const completed = orders.filter(o => o.status === "COMPLETED");

  return <main style={{ minHeight: "100vh", background: "#f6f7f4", color: "#18201b", padding: 24 }}>
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <a href="/procurement">← Procurement Cafe</a>
      <header style={{ margin: "28px 0" }}><div style={{ fontSize: 12, letterSpacing: 2, opacity: .6 }}>NORTAGO · {businessName}</div><h1>Automatic Production Queue</h1><p>Order PAID / SCHEDULED / PROCESSING otomatis dibuat menjadi production order berdasarkan recipe aktif.</p></header>
      {error && <div style={{ background: "#fee", padding: 14, borderRadius: 10, marginBottom: 18 }}>{error}</div>}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 22 }}>
        <Metric title="Production Queue" value={String(active.length)} /><Metric title="Blocked" value={String(active.filter(o => o.status === "BLOCKED").length)} /><Metric title="Completed" value={String(completed.length)} />
      </section>
      <section style={{ background: "#fff", borderRadius: 16, padding: 22 }}>
        <h2>Production Orders</h2>
        <div style={{ display: "grid", gap: 14 }}>
          {active.map(o => <article key={o.id} style={{ border: "1px solid #e7e9e5", borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div><div style={{ fontSize: 12, opacity: .55 }}>ORDER</div><h3>{o.otc_orders?.order_no || o.order_id}</h3><div>{o.otc_orders?.customer_name || "Customer"} · {o.otc_orders?.fulfillment_type || "-"} · {o.otc_outlets?.name || "-"}</div></div>
              <b>{o.status}</b>
            </div>
            {o.blocked_reason && <div style={{ marginTop: 14, padding: 12, background: "#fff4e5", borderRadius: 10 }}><b>Production Blocked:</b> {o.blocked_reason}</div>}
            <div style={{ marginTop: 16, display: "grid", gap: 8 }}>{(o.proc_production_items || []).map(item => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #eee", paddingTop: 10 }}><span>{item.product_name_snapshot} × {item.quantity}</span><span><b>{item.required_qty}</b> {item.unit}</span></div>)}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              {o.status === "QUEUED" && <ActionButton disabled={busy} onClick={() => setStatus(o.id, "IN_PROGRESS")}>Mulai Produksi</ActionButton>}
              {o.status === "IN_PROGRESS" && <ActionButton disabled={busy} onClick={() => setStatus(o.id, "QC_PENDING")}>Selesai Produksi → QC</ActionButton>}
              {o.status === "QC_PENDING" && <ActionButton disabled={busy} onClick={() => setStatus(o.id, "READY")}>QC Lulus → READY</ActionButton>}
              {o.status === "READY" && <ActionButton disabled={busy} onClick={() => setStatus(o.id, "COMPLETED")}>Tandai COMPLETED</ActionButton>}
            </div>
          </article>)}
          {!active.length && <div style={{ padding: 30, textAlign: "center", opacity: .6 }}>Tidak ada production order aktif.</div>}
        </div>
      </section>
    </div>
  </main>;
}

function Metric({ title, value }: { title: string; value: string }) { return <div style={{ background: "#fff", borderRadius: 14, padding: 18 }}><div style={{ fontSize: 12, opacity: .55 }}>{title}</div><div style={{ fontSize: 30, fontWeight: 700, marginTop: 6 }}>{value}</div></div>; }
function ActionButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled: boolean }) { return <button onClick={onClick} disabled={disabled} style={{ padding: "10px 14px", border: 0, borderRadius: 9, background: "#18201b", color: "#fff" }}>{children}</button>; }
