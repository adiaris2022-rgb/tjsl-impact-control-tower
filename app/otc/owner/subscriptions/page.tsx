"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Plan = { id: string; plan_code: string; billing_interval: "MONTHLY" | "YEARLY"; amount_idr: number; is_active: boolean };
type Subscription = { id: string; outlet_id: string; plan_id: string; status: string; current_period_start: string | null; current_period_end: string | null; next_due_at: string | null; grace_period_end: string | null; auto_renew: boolean };
type Outlet = { id: string; name: string };

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

const date = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const statusLabel: Record<string, string> = {
  PENDING: "Menunggu aktivasi",
  TRIALING: "Masa uji coba",
  ACTIVE: "Aktif",
  PAST_DUE: "Menunggak",
  SUSPENDED: "Ditangguhkan",
  CANCELED: "Dibatalkan",
  EXPIRED: "Kedaluwarsa",
};

export default function OwnerSubscriptionsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [businessIds, setBusinessIds] = useState<string[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = await getSupabase();
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Silakan masuk menggunakan akun bisnis terlebih dahulu.");

        const { data: memberships, error: membershipError } = await supabase
          .from("business_users")
          .select("business_id")
          .eq("user_id", auth.user.id);
        if (membershipError) throw membershipError;
        const ids = [...new Set((memberships || []).map((row) => row.business_id as string).filter(Boolean))];
        if (!ids.length) throw new Error("Akun ini belum terhubung dengan bisnis.");
        const id = ids[0];
        const [planResult, subscriptionResult, outletResult] = await Promise.all([
          supabase.from("subscription_plans")
            .select("id,plan_code,billing_interval,amount_idr,is_active")
            .eq("is_active", true)
            .order("amount_idr", { ascending: true }),
          supabase.from("outlet_subscriptions")
            .select("id,outlet_id,plan_id,status,current_period_start,current_period_end,next_due_at,grace_period_end,auto_renew")
            .eq("business_id", id)
            .order("created_at", { ascending: false }),
          supabase.from("otc_outlets")
            .select("id,name")
            .eq("business_id", id)
            .order("name", { ascending: true }),
        ]);
        if (planResult.error) throw planResult.error;
        if (subscriptionResult.error) throw subscriptionResult.error;
        if (outletResult.error) throw outletResult.error;

        if (!alive) return;
        setBusinessIds(ids);
        setBusinessId(id);
        setPlans((planResult.data || []) as Plan[]);
        setSubscriptions((subscriptionResult.data || []) as Subscription[]);
        setOutlets((outletResult.data || []) as Outlet[]);
      } catch (cause: unknown) {
        if (alive) setError(cause instanceof Error ? cause.message : "Gagal memuat data langganan.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!businessId) return;
    let alive = true;
    (async () => {
      try {
        const supabase = await getSupabase();
        const [subscriptionResult, outletResult] = await Promise.all([
          supabase.from("outlet_subscriptions")
            .select("id,outlet_id,plan_id,status,current_period_start,current_period_end,next_due_at,grace_period_end,auto_renew")
            .eq("business_id", businessId)
            .order("created_at", { ascending: false }),
          supabase.from("otc_outlets")
            .select("id,name")
            .eq("business_id", businessId)
            .order("name", { ascending: true }),
        ]);
        if (subscriptionResult.error) throw subscriptionResult.error;
        if (outletResult.error) throw outletResult.error;
        if (!alive) return;
        setSubscriptions((subscriptionResult.data || []) as Subscription[]);
        setOutlets((outletResult.data || []) as Outlet[]);
      } catch (cause: unknown) {
        if (alive) setError(cause instanceof Error ? cause.message : "Gagal memuat bisnis terpilih.");
      }
    })();
    return () => { alive = false; };
  }, [businessId]);

  const outletNames = useMemo(() => new Map(outlets.map((outlet) => [outlet.id, outlet.name])), [outlets]);
  const planById = useMemo(() => new Map(plans.map((plan) => [plan.id, plan])), [plans]);

  return (
    <main className="otc-page">
      <header className="otc-head">
        <div><b>NORTAGO Order</b><small>Owner Dashboard · Subscription Management</small></div>
        <Link href="/otc/owner">Kembali ke Owner</Link>
      </header>

      <section className="customer-title">
        <span>BUSINESS BILLING</span>
        <h1>Langganan Outlet</h1>
        <p>Pantau status dan paket langganan setiap outlet dalam satu dashboard bisnis.</p>
      </section>

      {loading ? <div className="loading">Memuat data langganan…</div> : null}
      {!loading && error ? <div className="info-box wide">{error}</div> : null}

      {!loading && !error ? <>
        <section className="metric-grid otc-metrics">
          <article><small>Outlet bisnis</small><strong>{outlets.length}</strong></article>
          <article><small>Catatan langganan</small><strong>{subscriptions.length}</strong></article>
          <article><small>Paket tersedia</small><strong>{plans.length}</strong></article>
          <article><small>Model tagihan</small><strong>Per outlet</strong></article>
        </section>

        <section className="data-panel">
          <div className="section-toolbar">
            <div><span className="eyebrow">SUBSCRIPTION OVERVIEW</span><h2>Status langganan per outlet</h2></div>
            {businessIds.length > 1 ? (
              <label className="business-switcher">Pilih bisnis
                <select value={businessId} onChange={(event) => setBusinessId(event.target.value)}>
                  {businessIds.map((id) => <option key={id} value={id}>Bisnis · {id.slice(0, 8)}</option>)}
                </select>
              </label>
            ) : null}
          </div>
          {subscriptions.length === 0 ? (
            <div className="muted">Belum ada catatan langganan untuk bisnis ini. Aktivasi paket akan tersedia setelah alur invoice dan pembayaran disiapkan.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Outlet</th><th>Paket</th><th>Status</th><th>Akhir periode</th><th>Tagihan berikutnya</th></tr></thead>
                <tbody>
                  {subscriptions.map((subscription) => {
                    const plan = planById.get(subscription.plan_id);
                    return <tr key={subscription.id}>
                      <td>{outletNames.get(subscription.outlet_id) || "Outlet tidak ditemukan"}</td>
                      <td>{plan ? `${plan.billing_interval === "MONTHLY" ? "Bulanan" : "Tahunan"} · ${money(plan.amount_idr)}` : "Paket tidak ditemukan"}</td>
                      <td><span className="status-badge">{statusLabel[subscription.status] || subscription.status}</span></td>
                      <td>{date(subscription.current_period_end)}</td>
                      <td>{date(subscription.next_due_at)}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="data-panel">
          <div className="section-toolbar"><div><span className="eyebrow">OFFICIAL PRICE LIST</span><h2>Harga per outlet</h2></div></div>
          <div className="metric-grid otc-metrics">
            {plans.map((plan) => {
              const isBos = plan.plan_code.startsWith("NORTAGO_BOS");
              const isYearly = plan.billing_interval === "YEARLY";
              return <article key={plan.id}>
                <small>{isBos ? "NORTAGO BOS" : "NORTAGO Order"} · {isYearly ? "Tahunan" : "Bulanan"}</small>
                <strong>{money(plan.amount_idr)}</strong>
                <small>per outlet / {isYearly ? "tahun" : "bulan"}</small>
                {isYearly ? <small>Hemat 2 bulan dibanding pembayaran bulanan</small> : null}
              </article>;
            })}
          </div>
          <p className="muted">Dashboard ini masih bersifat pemantauan. Perubahan paket, penerbitan invoice, dan pembayaran belum diaktifkan.</p>
        </section>
      </> : null}
      <footer>Business ID: {businessId || "—"} · NORTAGO Order</footer>
    </main>
  );
}
