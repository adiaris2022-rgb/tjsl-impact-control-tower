"use client";

import { useEffect, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";

const ENGINE_DEFS = [
  { key: "MASTER_ENGINE", title: "Master Engine", desc: "Saklar utama seluruh automation TJSL. OFF = engine tidak menjalankan proses otomatis." },
  { key: "TRANSACTION_MONITORING", title: "Transaction Monitoring", desc: "Mengaktifkan pemantauan transaksi mitra dari OCT." },
  { key: "OUTCOME_ENGINE", title: "Outcome Engine", desc: "Mengaktifkan pencatatan outcome dan indikator program." },
  { key: "EVIDENCE_VERIFICATION", title: "Evidence & Verification", desc: "Mengaktifkan alur evidence DRAFT → SUBMITTED → VERIFIED." },
  { key: "SROI_ENGINE", title: "SROI Engine", desc: "Mengizinkan kalkulasi SROI hanya dari evidence yang memenuhi gate." },
  { key: "EXECUTIVE_REPORT", title: "Executive Report", desc: "Mengaktifkan pembentukan laporan dampak untuk Owner/TJSL." },
  { key: "ALERT_ENGINE", title: "Alert Engine", desc: "Mengaktifkan exception alert dan notifikasi operasional yang dikonfigurasi." },
];

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase belum dikonfigurasi.");
  return createClient(url, key);
}

export default function OperatorSettings() {
  const [user, setUser] = useState<User | null>(null);
  const [businessId, setBusinessId] = useState("");
  const [role, setRole] = useState("");
  const [states, setStates] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const s = supabase();
    s.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session?.user) void load(data.session.user);
    }).catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat sesi."));
  }, []);

  async function load(current: User) {
    setError("");
    const s = supabase();
    const { data: bu, error: be } = await s.from("business_users").select("business_id,role").eq("user_id", current.id).maybeSingle();
    if (be || !bu) {
      setError(be?.message ?? "Akun belum terdaftar.");
      return;
    }
    setBusinessId(bu.business_id);
    setRole(bu.role);
    const { data, error: se } = await s.from("tjsl_operator_settings").select("setting_key,enabled").eq("business_id", bu.business_id);
    if (se) {
      setError(se.message);
      return;
    }
    const next: Record<string, boolean> = {};
    ENGINE_DEFS.forEach((x) => { next[x.key] = true; });
    (data ?? []).forEach((x) => { next[x.setting_key] = x.enabled; });
    setStates(next);
  }

  async function toggle(key: string) {
    if (!businessId || busy) return;
    setBusy(key);
    setMessage("");
    setError("");
    const nextValue = !states[key];
    const s = supabase();
    const { error: e } = await s.from("tjsl_operator_settings").upsert({
      business_id: businessId,
      setting_key: key,
      enabled: nextValue,
      description: ENGINE_DEFS.find((x) => x.key === key)?.desc ?? null,
      updated_by: user?.id ?? null,
    }, { onConflict: "business_id,setting_key" });
    if (e) setError(e.message);
    else {
      setStates((v) => ({ ...v, [key]: nextValue }));
      setMessage(nextValue ? key + " diaktifkan." : key + " dimatikan.");
    }
    setBusy(null);
  }

  async function signOut() { await supabase().auth.signOut(); }

  if (!user) return (
    <main className="auth-shell">
      <section className="login-card">
        <div className="brand"><span className="mark">A</span><div><strong>NORTAGO</strong><small>TJSL Impact Control Tower</small></div></div>
        <div className="eyebrow">OPERATOR SETTINGS</div>
        <h1>Engine Control.<br/><span>ON / OFF.</span></h1>
        <p className="lead">Masuk melalui Control Tower untuk mengatur engine otomatis per organisasi.</p>
        <a className="settings-link" href="/">← Kembali ke Control Tower</a>
      </section>
    </main>
  );

  const master = states.MASTER_ENGINE !== false;
  const canEdit = role === "OWNER" || role === "PROGRAM_MANAGER";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="mark">A</span><div><strong>TJSL OPERATOR SETTINGS</strong><small>Engine Control Center</small></div></div>
        <div className="userbox"><span>{role}</span><button className="ghost" onClick={signOut}>Keluar</button></div>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">OPERATOR SETTINGS</div>
          <h1>Control the engines.</h1>
          <p>Atur engine TJSL tanpa mengubah data program atau schema.</p>
        </div>
        <a className="status" href="/"><i/> KEMBALI KE CONTROL TOWER →</a>
      </section>

      <section className="engine-banner">
        <div>
          <b>MASTER ENGINE</b>
          <span>{master ? "ENGINE AKTIF" : "ENGINE NONAKTIF"}</span>
          <small>Master switch menjadi guard utama. Modul lain tidak dianggap aktif untuk automation ketika Master OFF.</small>
        </div>
        <button className={master ? "engine-switch on" : "engine-switch"} disabled={!canEdit || busy !== null} onClick={() => toggle("MASTER_ENGINE")}>
          <i/>{master ? "ON" : "OFF"}
        </button>
      </section>

      {message && <div className="success settings-message">{message}</div>}
      {error && <div className="error settings-message">{error}</div>}

      <section className="settings-grid">
        {ENGINE_DEFS.filter((x) => x.key !== "MASTER_ENGINE").map((engine) => {
          const enabled = master && states[engine.key] !== false;
          return (
            <article className="engine-card" key={engine.key}>
              <div className="engine-copy">
                <div className="engine-kicker">{engine.key.replaceAll("_", " ")}</div>
                <h2>{engine.title}</h2>
                <p>{engine.desc}</p>
                <strong className={enabled ? "state-on" : "state-off"}>{enabled ? "● ON" : "● OFF"}</strong>
              </div>
              <button className={enabled ? "engine-switch on" : "engine-switch"} disabled={!canEdit || !master || busy !== null} onClick={() => toggle(engine.key)}>
                <i/>{enabled ? "ON" : "OFF"}
              </button>
            </article>
          );
        })}
      </section>

      {!canEdit && <div className="settings-note">Role <b>{role}</b> hanya dapat melihat status. OWNER / PROGRAM_MANAGER yang dapat mengubah settings.</div>}

      <footer>Supported by <b>NORTAGO</b> · TJSL Impact Control Tower · Operator Settings</footer>
    </main>
  );
}
