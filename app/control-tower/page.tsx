import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll(items) { items.forEach(({name,value,options}) => cookieStore.set(name,value,options)); } } }
  );
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/control-tower?error=" + encodeURIComponent(error.message));
  redirect("/control-tower");
}

export default async function ControlTowerPage({ searchParams }: { searchParams: Promise<{ error?: string; tenant?: string }> }) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll(items) { items.forEach(({name,value,options}) => cookieStore.set(name,value,options)); } } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { default: Dashboard } = await import("./dashboard");
    return <Dashboard />;
  }
  const params = await searchParams;
  const tenant = params.tenant ?? "nortago-staging-test";
  const { data: branding } = await supabase
    .from("tjsl_public_branding")
    .select("display_name, logo_url")
    .eq("slug", tenant)
    .eq("is_active", true)
    .maybeSingle();

  return (
    <main className="auth-shell">
      <section className="login-card">
        <div className="company-brand">
          {branding?.logo_url ? <img src={branding.logo_url} alt={branding.display_name} /> : <div className="company-logo-placeholder">LOGO</div>}
          <div><strong>{branding?.display_name ?? "Perusahaan Anda"}</strong><small>Program TJSL</small></div>
        </div>
        <div className="eyebrow">TJSL IMPACT CONTROL TOWER</div>
        <h1>Data TJSL.<br/><span>Dampak yang dapat diuji.</span></h1>
        <p className="lead">Satu control tower untuk memantau program, transaksi mitra, outcome, evidence, dan estimasi SROI.</p>
        <form action={signIn}>
          <label>Email<input name="email" type="email" required placeholder="nama@perusahaan.id" /></label>
          <label>Password<input name="password" type="password" required placeholder="••••••••" /></label>
          {params.error && <div className="error">{params.error}</div>}
          <button>Masuk ke Control Tower →</button>
        </form>
        <div className="footnote">Supported by <img className="nortago-footer-logo" src="/nortago-mark.svg" alt="NORTAGO" /> <b>NORTAGO</b></div>
      </section>
    </main>
  );
}
