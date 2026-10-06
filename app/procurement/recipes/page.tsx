"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"
);

export default function RecipePage() {
  const [user, setUser] = useState<User | null>(null);
  const [businessId, setBusinessId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [productId, setProductId] = useState("");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("g");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session?.user) load(data.session.user);
    });
  }, []);

  async function load(u: User) {
    setError("");
    const { data: bu, error: e } = await supabase
      .from("business_users")
      .select("business_id")
      .eq("user_id", u.id)
      .limit(1)
      .maybeSingle();

    if (e || !bu) {
      setError(e?.message || "Akun belum terhubung ke bisnis.");
      return;
    }

    setBusinessId(bu.business_id);

    const [b, p, i, r] = await Promise.all([
      supabase.from("businesses").select("name").eq("id", bu.business_id).maybeSingle(),
      supabase.from("otc_products").select("id,name,category").eq("business_id", bu.business_id).eq("is_active", true).order("name"),
      supabase.from("proc_items").select("id,name,category,unit,qty").eq("business_id", bu.business_id).eq("is_active", true).order("name"),
      supabase
        .from("proc_product_recipes")
        .select("id,product_id,item_id,qty_per_sale,unit,is_active,otc_products(name),proc_items(name,unit)")
        .eq("business_id", bu.business_id)
        .eq("is_active", true)
        .order("created_at")
    ]);

    setBusinessName(b.data?.name || "Cafe");
    setProducts(p.data || []);
    setItems(i.data || []);
    setRecipes(r.data || []);
  }

  async function addRecipe() {
    if (!productId || !itemId || !qty || Number(qty) <= 0 || !user) return;
    setBusy(true);
    setError("");

    const { error: e } = await supabase.from("proc_product_recipes").upsert(
      {
        business_id: businessId,
        product_id: productId,
        item_id: itemId,
        qty_per_sale: Number(qty),
        unit,
        is_active: true
      },
      { onConflict: "product_id,item_id" }
    );

    if (e) {
      setError(e.message);
    } else {
      setProductId("");
      setItemId("");
      setQty("");
      await load(user);
    }
    setBusy(false);
  }

  async function removeRecipe(id: string) {
    if (!user) return;
    setBusy(true);
    const { error: e } = await supabase
      .from("proc_product_recipes")
      .update({ is_active: false })
      .eq("id", id);
    if (e) setError(e.message);
    else await load(user);
    setBusy(false);
  }

  if (!user) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "system-ui" }}>
        <section style={{ maxWidth: 620 }}>
          <h1>NORTAGO · Product Recipe</h1>
          <p>Silakan login melalui Procurement Cafe terlebih dahulu.</p>
          <a href="/procurement">← Kembali ke Procurement</a>
        </section>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f6f7f4", color: "#18201b", padding: 24, fontFamily: "system-ui" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <a href="/procurement">← Procurement Cafe</a>

        <header style={{ margin: "28px 0" }}>
          <div style={{ fontSize: 12, letterSpacing: 2, opacity: .6 }}>NORTAGO · {businessName}</div>
          <h1 style={{ fontSize: 38, margin: "8px 0" }}>Recipe & Gramasi Produk</h1>
          <p style={{ maxWidth: 760, lineHeight: 1.6 }}>
            Tentukan bahan baku yang dikonsumsi setiap kali satu produk terjual.
            Setelah transaksi berstatus <b>SUCCESS</b> atau <b>PO_SUCCESS</b>, stok akan berkurang otomatis.
          </p>
        </header>

        {error && <div style={{ background: "#fee", padding: 14, borderRadius: 10, marginBottom: 18 }}>{error}</div>}

        <section style={{ background: "#fff", borderRadius: 16, padding: 22, boxShadow: "0 4px 20px rgba(0,0,0,.06)", marginBottom: 22 }}>
          <h2 style={{ marginTop: 0 }}>Tambah Gramasi</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.3fr .8fr .7fr auto", gap: 12, alignItems: "end" }}>
            <label>Produk
              <select value={productId} onChange={e => setProductId(e.target.value)} style={{ display: "block", width: "100%", padding: 11, marginTop: 6 }}>
                <option value="">Pilih produk</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>

            <label>Bahan baku
              <select value={itemId} onChange={e => setItemId(e.target.value)} style={{ display: "block", width: "100%", padding: 11, marginTop: 6 }}>
                <option value="">Pilih bahan</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.name} · stok {i.unit}</option>)}
              </select>
            </label>

            <label>Qty / jual
              <input type="number" min="0.001" step="0.001" value={qty} onChange={e => setQty(e.target.value)} placeholder="18" style={{ display: "block", width: "100%", padding: 11, marginTop: 6 }} />
            </label>

            <label>Satuan
              <select value={unit} onChange={e => setUnit(e.target.value)} style={{ display: "block", width: "100%", padding: 11, marginTop: 6 }}>
                <option value="g">g</option>
                <option value="kg">kg</option>
                <option value="ml">ml</option>
                <option value="liter">liter</option>
                <option value="pcs">pcs</option>
              </select>
            </label>

            <button onClick={addRecipe} disabled={busy} style={{ padding: "12px 18px", border: 0, borderRadius: 10, background: "#18201b", color: "#fff" }}>
              {busy ? "..." : "Simpan"}
            </button>
          </div>
        </section>

        <section style={{ background: "#fff", borderRadius: 16, padding: 22, boxShadow: "0 4px 20px rgba(0,0,0,.06)" }}>
          <h2 style={{ marginTop: 0 }}>Recipe Aktif</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th align="left">Produk</th><th align="left">Bahan</th><th align="right">Gramasi</th><th align="left">Stok Unit</th><th /></tr></thead>
              <tbody>
                {recipes.map(r => (
                  <tr key={r.id}>
                    <td style={{ padding: "12px 8px", borderTop: "1px solid #eee" }}>{r.otc_products?.name}</td>
                    <td style={{ padding: "12px 8px", borderTop: "1px solid #eee" }}>{r.proc_items?.name}</td>
                    <td style={{ padding: "12px 8px", borderTop: "1px solid #eee", textAlign: "right" }}>{r.qty_per_sale} {r.unit}</td>
                    <td style={{ padding: "12px 8px", borderTop: "1px solid #eee" }}>{r.proc_items?.unit}</td>
                    <td style={{ padding: "12px 8px", borderTop: "1px solid #eee", textAlign: "right" }}>
                      <button onClick={() => removeRecipe(r.id)} disabled={busy}>Nonaktifkan</button>
                    </td>
                  </tr>
                ))}
                {!recipes.length && <tr><td colSpan={5} style={{ padding: 18, opacity: .6 }}>Belum ada recipe. Tambahkan gramasi di atas.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ marginTop: 22, background: "#eaf3ed", borderRadius: 16, padding: 22 }}>
          <b>Contoh logika:</b>
          <p style={{ marginBottom: 0, lineHeight: 1.7 }}>
            1 Latte terjual → recipe Kopi 18 g + Susu 180 ml. Jika hari ini terjual 100 Latte,
            sistem otomatis mengurangi Kopi 1,8 kg dan Susu 18 liter dari stok outlet.
          </p>
        </section>
      </div>
    </main>
  );
}
