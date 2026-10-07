"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"
);

const money = (n: any) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

export default function BOSApprovals() {
  const [businessId, setBusinessId] = useState("");
  const [rules, setRules] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [form, setForm] = useState({
    module: "PROCUREMENT",
    action: "PURCHASE_ORDER",
    role: "OWNER",
    min_amount: "0",
    max_amount: "",
    requires_evidence: true,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Sesi login tidak ditemukan.");

    const { data: bu, error: be } = await supabase
      .from("business_users")
      .select("business_id,role")
      .eq("user_id", auth.user.id)
      .limit(1)
      .maybeSingle();

    if (be || !bu?.business_id) throw new Error(be?.message || "Business belum terhubung.");
    setBusinessId(bu.business_id);

    const [r, q] = await Promise.all([
      supabase.from("nortago_approval_matrix").select("*").eq("business_id", bu.business_id).order("module").order("min_amount"),
      supabase.from("nortago_approval_requests").select("*").eq("business_id", bu.business_id).order("requested_at", { ascending: false }).limit(50),
    ]);

    if (r.error) throw r.error;
    if (q.error) throw q.error;
    setRules(r.data || []);
    setRequests(q.data || []);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message || "Gagal memuat approval control."));
  }, []);

  async function saveRule(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    const { error: rpcError } = await supabase.rpc("upsert_approval_rule", {
      p_business_id: businessId,
      p_id: editingId,
      p_module: form.module,
      p_action: form.action,
      p_role: form.role,
      p_min_amount: Number(form.min_amount || 0),
      p_max_amount: form.max_amount === "" ? null : Number(form.max_amount),
      p_requires_evidence: form.requires_evidence,
      p_is_active: true,
    });

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setMessage(editingId ? "Approval rule diperbarui." : "Approval rule ditambahkan.");
    setEditingId(null);
    setForm({ module: "PROCUREMENT", action: "PURCHASE_ORDER", role: "OWNER", min_amount: "0", max_amount: "", requires_evidence: true });
    await load();
  }

  async function decide(id: string, decision: "APPROVE" | "REJECT") {
    setError("");
    setMessage("");
    const { error: rpcError } = await supabase.rpc("nortago_decide_approval", {
      p_request_id: id,
      p_decision: decision,
      p_decision_note: decision === "APPROVE" ? "Approved via CT BOS NORTAGO" : "Rejected via CT BOS NORTAGO",
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setMessage(decision === "APPROVE" ? "Approval disetujui." : "Approval ditolak.");
    await load();
  }

  function editRule(r: any) {
    setEditingId(r.id);
    setForm({
      module: r.module,
      action: r.action,
      role: r.role,
      min_amount: String(r.min_amount ?? 0),
      max_amount: r.max_amount == null ? "" : String(r.max_amount),
      requires_evidence: Boolean(r.requires_evidence),
    });
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: 28, color: "#0f172a" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800, letterSpacing: ".12em" }}>
          NORTAGO ECOSYSTEM · CT BOS NORTAGO
        </div>
        <h1>Approval Control</h1>
        <p style={{ color: "#64748b" }}>
          Approval Matrix + Approval Queue. Hanya OWNER yang boleh mengubah aturan dan mengambil keputusan approval.
        </p>

        {error && <div style={{ padding: 12, background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 12, marginBottom: 14 }}>{error}</div>}
        {message && <div style={{ padding: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, marginBottom: 14 }}>{message}</div>}

        <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginBottom: 18 }}>
          <h2>{editingId ? "Edit Approval Rule" : "Tambah Approval Rule"}</h2>
          <form onSubmit={saveRule} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
            <label>Module<input value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} style={{ width: "100%", padding: 10, marginTop: 5 }} /></label>
            <label>Action<input value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} style={{ width: "100%", padding: 10, marginTop: 5 }} /></label>
            <label>Required Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={{ width: "100%", padding: 10, marginTop: 5 }}><option>OWNER</option><option>PROGRAM_MANAGER</option><option>PARTNER</option><option>STAFF</option></select></label>
            <label>Min Amount<input type="number" min="0" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: e.target.value })} style={{ width: "100%", padding: 10, marginTop: 5 }} /></label>
            <label>Max Amount<input type="number" min="0" value={form.max_amount} onChange={(e) => setForm({ ...form, max_amount: e.target.value })} placeholder="Tidak terbatas" style={{ width: "100%", padding: 10, marginTop: 5 }} /></label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 25 }}><input type="checkbox" checked={form.requires_evidence} onChange={(e) => setForm({ ...form, requires_evidence: e.target.checked })} /> Requires Evidence</label>
            <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
              <button type="submit" style={{ padding: "10px 14px", borderRadius: 10, border: 0, background: "#0f172a", color: "#fff" }}>{editingId ? "Simpan Perubahan" : "Tambah Rule"}</button>
              {editingId && <button type="button" onClick={() => setEditingId(null)} style={{ padding: "10px 14px", borderRadius: 10 }}>Batal</button>}
            </div>
          </form>
        </section>

        <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginBottom: 18 }}>
          <h2>Approval Matrix</h2>
          {rules.length === 0 ? <p>Belum ada approval rule. RATER akan tetap WARNING sampai rule aktif dikonfigurasi.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th align="left">Module</th><th align="left">Action</th><th align="left">Role</th><th align="right">Range</th><th>Evidence</th><th>Status</th><th /></tr></thead>
                <tbody>{rules.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #eef2f7" }}>
                    <td>{r.module}</td><td>{r.action}</td><td>{r.role}</td>
                    <td align="right">{money(r.min_amount)} — {r.max_amount == null ? "∞" : money(r.max_amount)}</td>
                    <td align="center">{r.requires_evidence ? "YES" : "NO"}</td>
                    <td align="center">{r.is_active ? "ACTIVE" : "INACTIVE"}</td>
                    <td align="right"><button onClick={() => editRule(r)} style={{ padding: "6px 10px", borderRadius: 8 }}>Edit</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>

        <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20 }}>
          <h2>Approval Queue</h2>
          {requests.length === 0 ? <p>Tidak ada approval request.</p> : requests.map((r) => (
            <div key={r.id} style={{ padding: 14, borderTop: "1px solid #eef2f7", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <b>{r.module} · {r.action}</b>
                <div style={{ color: "#64748b", marginTop: 4 }}>{r.reference_type} · {money(r.requested_amount)} · Required {r.required_role}</div>
                <small>Status: {r.status} · Evidence: {r.requires_evidence ? (r.evidence_url ? "OK" : "MISSING") : "NOT REQUIRED"}</small>
              </div>
              {r.status === "PENDING" && <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => decide(r.id, "APPROVE")} style={{ padding: "9px 12px", borderRadius: 9 }}>Approve</button>
                <button onClick={() => decide(r.id, "REJECT")} style={{ padding: "9px 12px", borderRadius: 9 }}>Reject</button>
              </div>}
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
