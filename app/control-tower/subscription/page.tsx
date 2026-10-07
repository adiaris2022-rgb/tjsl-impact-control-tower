"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"
);

const money = (n: any) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(n || 0));

export default function SubscriptionPage() {
  const [business, setBusiness] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError("Sesi login tidak ditemukan."); setLoading(false); return; }

    const { data: bu, error: be } = await supabase.from("business_users").select("business_id").eq("user_id", auth.user.id).limit(1).maybeSingle();
    if (be || !bu?.business_id) { setError(be?.message || "Business belum terhubung."); setLoading(false); return; }

    const id = bu.business_id;
    const [biz, state, planRows] = await Promise.all([
      supabase.from("businesses").select("name").eq("id", id).maybeSingle(),
      supabase.rpc("nortago_subscription_state", { p_business_id: id }),
      supabase.from("nortago_subscription_plans").select("*").eq("is_active", true).order("annual_price"),
    ]);
    if (state.error) setError(state.error.message);
    setBusiness(biz.data);
    setSubscription(state.data?.[0] || null);
    setPlans(planRows.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const s = subscription || {};
  const active = s.status === "ACTIVE" && s.payment_status === "PAID" && Number(s.days_remaining || 0) > 0;
  const expired = s.status === "EXPIRED" || (s.expires_at && new Date(s.expires_at).getTime() <= Date.now());

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: 28, color: "#0f172a" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800, letterSpacing: ".12em" }}>NORTAGO ECOSYSTEM · CT BOS NORTAGO</div>
        <h1>Subscription & Activation</h1>
        <p style={{ color: "#64748b" }}>{business?.name || "Business"} · Subscription, Implementation & Customer Success</p>
        {error && <div style={{ padding: 14, background: "#fee2e2", borderRadius: 12, marginBottom: 16 }}>{error}</div>}

        {loading ? <p>Memuat subscription...</p> : <>
          <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20 }}>
            <h2>Subscription Saat Ini</h2>
            {!subscription ? <p>Belum ada subscription. Hubungi NORTAGO untuk activation dan onboarding.</p> :
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
                <Metric title="Plan" value={s.plan_name || s.plan_code} />
                <Metric title="Status" value={s.status || "-"} />
                <Metric title="Billing" value={s.billing_cycle === "ANNUAL" ? "Tahunan" : "Bulanan"} />
                <Metric title="Mulai" value={s.starts_at ? new Date(s.starts_at).toLocaleDateString("id-ID") : "-"} />
                <Metric title="Berakhir" value={s.expires_at ? new Date(s.expires_at).toLocaleDateString("id-ID") : "-"} />
                <Metric title="Sisa Masa Aktif" value={s.days_remaining == null ? "-" : String(s.days_remaining) + " hari"} />
                <Metric title="Support" value={s.support_level || "-"} />
                <Metric title="Payment" value={s.payment_status || "-"} />
              </div>}

            {active && Number(s.days_remaining) <= 30 && <div style={{ marginTop: 16, padding: 14, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12 }}>
              <b>⚠️ Masa aktif segera berakhir.</b><div style={{ marginTop: 4 }}>Sisa {s.days_remaining} hari. Renewal sebaiknya diproses sebelum tanggal berakhir.</div>
            </div>}
            {expired && <div style={{ marginTop: 16, padding: 14, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12 }}>
              <b>🔒 Subscription EXPIRED</b><div style={{ marginTop: 4 }}>Data bisnis tetap dipertahankan. Transaksi baru dikunci sampai subscription diperpanjang.</div>
            </div>}
          </section>

          <section style={{ marginTop: 18 }}>
            <h2>Paket NORTAGO</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
              {plans.map((p) => <div key={p.code} style={{ background: "#fff", border: p.code === "BUSINESS" ? "2px solid #0f172a" : "1px solid #e5e7eb", borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>{p.code}</div>
                <h3 style={{ margin: "6px 0" }}>{p.name}</h3>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{money(p.monthly_price)}<small style={{ fontSize: 13, fontWeight: 500 }}>/bulan</small></div>
                <div style={{ marginTop: 5, fontWeight: 700 }}>{money(p.annual_price)}/tahun</div>
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #eef2f7" }}>
                  <div>Implementation & Onboarding: <b>{money(p.implementation_fee)}</b></div>
                  <div style={{ marginTop: 6 }}>Maks. outlet: {p.max_outlets >= 999 ? "Multi-outlet" : p.max_outlets}</div>
                  <div style={{ marginTop: 6 }}>Maks. user: {p.max_users}</div>
                  <div style={{ marginTop: 6 }}>Support: {p.support_level}</div>
                </div>
                {p.code === "BUSINESS" && <div style={{ marginTop: 14, fontWeight: 800 }}>⭐ Paket rekomendasi NORTAGO</div>}
              </div>)}
            </div>
          </section>

          <section style={{ marginTop: 18, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20 }}>
            <h2>Activation & Pendampingan</h2>
            <ol style={{ lineHeight: 1.8, color: "#334155" }}>
              <li>Pilih paket dan periode langganan.</li>
              <li>Bayar Implementation & Onboarding Fee satu kali.</li>
              <li>NORTAGO melakukan setup Business, Outlet, User/Role, Product, Recipe, Inventory, Supplier dan Approval.</li>
              <li>Training Owner/Manager dan Go Live.</li>
              <li>Subscription diaktifkan setelah pembayaran terverifikasi.</li>
              <li>Pendampingan dan support berjalan selama subscription aktif.</li>
              <li>Saat expired, data tetap dipertahankan dan transaksi baru dikunci sampai renewal.</li>
            </ol>
            <div style={{ marginTop: 14, padding: 14, background: "#f1f5f9", borderRadius: 12 }}>
              <b>Catatan:</b> biaya Implementation & Onboarding tidak dibayar ulang pada renewal normal. Biaya tambahan hanya berlaku bila ada implementasi atau penambahan scope khusus.
            </div>
          </section>

          <button onClick={load} style={{ marginTop: 18, padding: "10px 16px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff" }}>Refresh Status</button>
        </>}
      </div>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div style={{ background: "#f8fafc", borderRadius: 12, padding: 14 }}><small style={{ color: "#64748b" }}>{title}</small><div style={{ marginTop: 5, fontWeight: 800 }}>{value}</div></div>;
}
