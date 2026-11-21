"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Outlet = { id: string; business_id: string; name: string };
type CatalogItem = { id: string; name: string; description: string | null; category: string | null; image_url: string | null; base_price: number; product_type: "PRODUCT" | "SERVICE"; is_active: boolean; is_available: boolean };

async function getSupabase() {
  const response = await fetch("/api/supabase-config", { cache: "no-store" });
  const config = await response.json().catch(() => ({}));
  if (!response.ok || !config.url || !config.key) throw new Error(config.error || "Konfigurasi Supabase tidak tersedia.");
  return createClient(config.url, config.key);
}
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);

export default function OwnerCatalog() {
  const [businessId, setBusinessId] = useState("");
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState("");
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyItemId, setBusyItemId] = useState("");
  const [editingItemId, setEditingItemId] = useState("");
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [detailsDrafts, setDetailsDrafts] = useState<Record<string, { name: string; description: string; category: string; image_url: string }>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [type, setType] = useState<"PRODUCT" | "SERVICE">("SERVICE");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  async function loadCatalog(selectedBusiness?: string, selectedOutlet?: string) {
    const supabase = await getSupabase();
    const bid = selectedBusiness || businessId;
    const oid = selectedOutlet || outletId;
    if (!bid || !oid) return;
    const { data, error: queryError } = await supabase.from("otc_outlet_products")
      .select("price,is_available,product:otc_products(id,name,description,category,image_url,base_price,product_type,is_active)")
      .eq("outlet_id", oid).order("product_id");
    if (queryError) throw queryError;
    const mapped = (data || []).filter((row: any) => row.product).map((row: any) => ({
      ...row.product,
      base_price: Number(row.price ?? row.product.base_price ?? 0),
      image_url: row.product.image_url ?? null,
      product_type: row.product.product_type === "SERVICE" ? "SERVICE" : "PRODUCT", 
      is_active: Boolean(row.product.is_active),
      is_available: Boolean(row.is_available),
    }));
    setItems(mapped as CatalogItem[]);
    setPriceDrafts(Object.fromEntries(mapped.map((item: any) => [item.id, String(item.base_price)])));
    setDetailsDrafts(Object.fromEntries(mapped.map((item: any) => [item.id, { name: item.name, description: item.description || "", category: item.category || "", image_url: item.image_url || "" }])));
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = await getSupabase();
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Login Owner diperlukan.");
        const { data: membership, error: membershipError } = await supabase.from("business_users").select("business_id").eq("user_id", auth.user.id);
        if (membershipError) throw membershipError;
        const ids = [...new Set((membership || []).map((row: any) => row.business_id).filter(Boolean))];
        if (!ids.length) throw new Error("Akun belum terhubung dengan bisnis.");
        const { data: outletData, error: outletError } = await supabase.from("otc_outlets").select("id,business_id,name").in("business_id", ids).eq("is_active", true).order("name");
        if (outletError) throw outletError;
        if (!alive) return;
        setOutlets((outletData || []) as Outlet[]);
        const initialBusiness = ids[0];
        const initialOutlet = outletData?.find((o: any) => o.business_id === initialBusiness)?.id || outletData?.[0]?.id || "";
        setBusinessId(initialBusiness);
        setOutletId(initialOutlet);
        if (!initialOutlet) setNotice("Belum ada outlet aktif. Buat/aktifkan outlet terlebih dahulu.");
        if (initialOutlet) await loadCatalog(initialBusiness, initialOutlet);
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : "Gagal memuat katalog.");
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  async function changeOutlet(id: string) {
    setOutletId(id); setError(""); setNotice("");
    const outlet = outlets.find((o) => o.id === id);
    if (!outlet) return;
    setBusinessId(outlet.business_id);
    try { await loadCatalog(outlet.business_id, id); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Gagal memuat katalog outlet."); }
  }

  async function toggleAvailability(item: CatalogItem) {
    if (!outletId || busyItemId) return;
    setBusyItemId(item.id); setError(""); setNotice("");
    try {
      const supabase = await getSupabase();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Login Owner diperlukan.");
      const { data: membership, error: membershipError } = await supabase.from("business_users").select("business_id").eq("user_id", auth.user.id).eq("business_id", businessId).maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) throw new Error("Akses bisnis tidak valid.");
      const nextAvailable = !item.is_available;
      const { error: updateError } = await supabase.from("otc_outlet_products")
        .update({ is_available: nextAvailable })
        .eq("outlet_id", outletId).eq("product_id", item.id);
      if (updateError) throw updateError;
      setNotice(nextAvailable ? "Item diaktifkan untuk outlet ini." : "Item dinonaktifkan hanya untuk outlet ini.");
      await loadCatalog(businessId, outletId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal mengubah ketersediaan item.");
    } finally { setBusyItemId(""); }
  }

  async function saveOutletPrice(item: CatalogItem) {
    const raw = priceDrafts[item.id];
    const nextPrice = Number(raw);
    if (raw === "" || !Number.isFinite(nextPrice) || nextPrice < 0 || !outletId || busyItemId) return;
    setBusyItemId(item.id); setError(""); setNotice("");
    try {
      const supabase = await getSupabase();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Login Owner diperlukan.");
      const { data: membership, error: membershipError } = await supabase.from("business_users").select("business_id").eq("user_id", auth.user.id).eq("business_id", businessId).maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) throw new Error("Akses bisnis tidak valid.");
      const { error: updateError } = await supabase.from("otc_outlet_products").update({ price: nextPrice }).eq("outlet_id", outletId).eq("product_id", item.id);
      if (updateError) throw updateError;
      setNotice("Harga outlet berhasil diperbarui. Harga pesanan yang sudah dibuat tidak berubah.");
      await loadCatalog(businessId, outletId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memperbarui harga outlet.");
    } finally { setBusyItemId(""); }
  }

  async function saveItemDetails(item: CatalogItem) {
    const draft = detailsDrafts[item.id];
    if (!draft || !draft.name.trim() || busyItemId) return;
    const image = draft.image_url.trim();
    if (image && !/^https?:\/\//i.test(image)) { setError("URL foto harus diawali http:// atau https://."); return; }
    setBusyItemId(item.id); setError(""); setNotice("");
    try {
      const supabase = await getSupabase();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Login Owner diperlukan.");
      const { data: membership, error: membershipError } = await supabase.from("business_users").select("business_id").eq("user_id", auth.user.id).eq("business_id", businessId).maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) throw new Error("Akses bisnis tidak valid.");
      const { data: updated, error: updateError } = await supabase.from("otc_products").update({
        name: draft.name.trim(), description: draft.description.trim() || null,
        category: draft.category.trim() || null, image_url: image || null,
      }).eq("id", item.id).eq("business_id", businessId).select("id").maybeSingle();
      if (updateError) throw updateError;
      if (!updated) throw new Error("Item tidak ditemukan atau akses ditolak.");
      setNotice("Detail katalog berhasil diperbarui. Perubahan berlaku untuk seluruh outlet bisnis ini.");
      setEditingItemId("");
      await loadCatalog(businessId, outletId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memperbarui detail katalog.");
    } finally { setBusyItemId(""); }
  }


  async function createItem(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || price === "" || Number(price) < 0 || !outletId) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const supabase = await getSupabase();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Login Owner diperlukan.");
      const { data: membership, error: membershipError } = await supabase.from("business_users").select("business_id").eq("user_id", auth.user.id).eq("business_id", businessId).maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) throw new Error("Akses bisnis tidak valid.");
      const { data: product, error: productError } = await supabase.from("otc_products").insert({
        business_id: businessId, name: name.trim(), description: description.trim() || null,
        category: category.trim() || null, image_url: imageUrl.trim() || null,
        base_price: Number(price), product_type: type, is_active: true,
      }).select("id").single();
      if (productError) throw productError;
      const { error: outletProductError } = await supabase.from("otc_outlet_products").upsert({
        outlet_id: outletId, product_id: product.id, price: Number(price), is_available: true,
      }, { onConflict: "outlet_id,product_id" });
      if (outletProductError) throw outletProductError;
      setName(""); setDescription(""); setCategory(""); setPrice(""); setImageUrl("");
      setNotice(type === "SERVICE" ? "Jasa berhasil ditambahkan dan aktif di outlet ini." : "Produk berhasil ditambahkan dan aktif di outlet ini.");
      await loadCatalog(businessId, outletId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menyimpan item katalog.");
    } finally { setSaving(false); }
  }

  return <main className="otc-page">
    <header className="otc-head"><div><b>NORTAGO Order</b><small>Owner · Catalog Management</small></div><Link href="/otc/owner">← Owner Dashboard</Link></header>
    <section className="customer-title"><span>OWNER CATALOG</span><h1>Kelola Produk & Jasa</h1><p>Tambah katalog, tetapkan harga, dan aktifkan item untuk outlet yang dipilih.</p>
      <label style={{display:"inline-grid",gap:6,marginTop:12}}>Outlet<select value={outletId} onChange={(e)=>changeOutlet(e.target.value)}>{outlets.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
    </section>
    {loading ? <div className="info-box wide">Memuat katalog…</div> : null}
    {error ? <div className="info-box wide" role="alert">{error}</div> : null}
    {notice ? <div className="info-box wide">{notice}</div> : null}
    <section className="otc-shop" style={{alignItems:"start"}}>
      <div className="menu-panel">
        <div className="section-head"><div><span className="eyebrow">OUTLET MENU</span><h2>Katalog outlet</h2></div><span className="pill">{items.length} item</span></div>
        {items.map(item=><article className="product-card" key={item.id}><div className="product-info"><small>{item.product_type === "SERVICE" ? "JASA" : "PRODUK"} · {item.is_active && item.is_available ? "TERSEDIA" : "NONAKTIF DI OUTLET"}</small><h3>{item.name}</h3><p>{item.category || "Tanpa kategori"}{item.description ? " · "+item.description : ""}</p><div style={{display:"grid",gap:8,marginTop:8}}><b>{money(item.base_price)}</b><label>Harga outlet (Rp)<input type="number" min="0" step="100" inputMode="decimal" value={priceDrafts[item.id] ?? String(item.base_price)} onChange={e=>setPriceDrafts(prev=>({...prev,[item.id]:e.target.value}))}/></label><button type="button" className="otc-secondary" disabled={Boolean(busyItemId)||loading} onClick={()=>saveOutletPrice(item)}>Simpan harga outlet</button></div></div><button type="button" className="otc-secondary" disabled={Boolean(busyItemId)||loading} onClick={()=>setEditingItemId(editingItemId===item.id?"":item.id)}>{editingItemId===item.id?"Tutup edit":"Edit detail"}</button>{editingItemId===item.id? <form onSubmit={event=>{event.preventDefault();saveItemDetails(item);}} style={{display:"grid",gap:8,padding:12,border:"1px solid #d7e1e5",borderRadius:12,marginTop:8}}><label>Nama item<input required maxLength={120} value={detailsDrafts[item.id]?.name ?? item.name} onChange={e=>setDetailsDrafts(prev=>({...prev,[item.id]:{...(prev[item.id]||{name:item.name,description:item.description||"",category:item.category||"",image_url:item.image_url||""}),name:e.target.value}}))}/></label><label>Deskripsi<textarea maxLength={500} value={detailsDrafts[item.id]?.description ?? item.description ?? ""} onChange={e=>setDetailsDrafts(prev=>({...prev,[item.id]:{...(prev[item.id]||{name:item.name,description:item.description||"",category:item.category||"",image_url:item.image_url||""}),description:e.target.value}}))}/></label><label>Kategori<input maxLength={80} value={detailsDrafts[item.id]?.category ?? item.category ?? ""} onChange={e=>setDetailsDrafts(prev=>({...prev,[item.id]:{...(prev[item.id]||{name:item.name,description:item.description||"",category:item.category||"",image_url:item.image_url||""}),category:e.target.value}}))}/></label><label>URL foto<input type="url" placeholder="https://…" value={detailsDrafts[item.id]?.image_url ?? item.image_url ?? ""} onChange={e=>setDetailsDrafts(prev=>({...prev,[item.id]:{...(prev[item.id]||{name:item.name,description:item.description||"",category:item.category||"",image_url:item.image_url||""}),image_url:e.target.value}}))}/></label><button type="submit" className="otc-primary full" disabled={Boolean(busyItemId)||loading}>{busyItemId===item.id?"Menyimpan…":"Simpan detail"}</button><p className="fine">Nama, deskripsi, kategori, dan foto adalah data produk/jasa bisnis yang digunakan bersama semua outlet. Harga tetap per outlet.</p></form>:null}<button type="button" className="otc-secondary" disabled={Boolean(busyItemId)||loading} onClick={()=>toggleAvailability(item)}>{busyItemId===item.id?"Memproses…":item.is_available?"Nonaktifkan di outlet":"Aktifkan di outlet"}</button></article>)}
        {!loading && items.length===0 ? <p className="muted">Belum ada item di outlet ini. Tambahkan item dari form.</p> : null}
      </div>
      <aside className="cart-panel" style={{position:"static"}}>
        <span className="eyebrow">NEW ITEM</span><h2>Tambah katalog</h2>
        <form onSubmit={createItem}>
          <label>Jenis katalog<select value={type} onChange={e=>setType(e.target.value as "PRODUCT"|"SERVICE")}><option value="SERVICE">Jasa</option><option value="PRODUCT">Produk</option></select></label>
          <label>Nama item<input value={name} onChange={e=>setName(e.target.value)} required maxLength={120} placeholder={type==="SERVICE"?"Contoh: Konsultasi 60 menit":"Nama produk"}/></label>
          <label>Deskripsi<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={500} placeholder="Penjelasan item"/></label>
          <label>Kategori<input value={category} onChange={e=>setCategory(e.target.value)} maxLength={80} placeholder="Contoh: Konsultasi / Makanan"/></label>
          <label>Harga outlet (Rp)<input inputMode="decimal" type="number" min="0" step="100" value={price} onChange={e=>setPrice(e.target.value)} required placeholder="0"/></label>
          <label>URL foto (opsional)<input type="url" value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://…"/></label>
          <button type="submit" className="otc-primary full" disabled={saving||loading||!outletId}>{saving?"Menyimpan…":"Tambah "+(type==="SERVICE"?"Jasa":"Produk")}</button>
          <p className="fine">Item akan dibuat pada bisnis Anda dan langsung ditautkan ke outlet terpilih. Harga dapat berbeda antar-outlet.</p>
        </form>
      </aside>
    </section>
  </main>;
}
