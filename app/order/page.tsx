import Link from "next/link";

const features = [
  { number: "01", title: "Menu digital yang selalu rapi", text: "Tampilkan produk, harga, foto, kategori, dan ketersediaan dalam satu menu yang mudah dibuka dari ponsel." },
  { number: "02", title: "Pesan dan bayar langsung", text: "Pelanggan memilih menu, jumlah, jenis pesanan, detail, lalu menyelesaikan pembayaran melalui metode yang tersedia." },
  { number: "03", title: "PO, Takeaway, dan Delivery", text: "Pelanggan memilih Pre-Order untuk waktu tertentu, Takeaway untuk mengambil sendiri, atau Delivery untuk diantar." },
  { number: "04", title: "Fleksibel dari satu usaha hingga banyak outlet", text: "Dapat digunakan oleh UMKM, bisnis menengah, perusahaan besar, dan bisnis dengan beberapa outlet sesuai konfigurasi sistem." },
];

const steps = [
  { title: "Bagikan satu link", text: "Pasang link NORTAGO ORDER di bio WhatsApp, Instagram, Facebook, TikTok, status, grup, poster, atau iklan." },
  { title: "Pelanggan buka menu", text: "Menu, foto, pilihan produk, harga, dan informasi tersedia dalam satu halaman yang mudah dibuka." },
  { title: "Pilih, pesan, dan bayar", text: "Pelanggan memilih produk, jumlah, jenis order, jadwal bila diperlukan, lalu menyelesaikan pembayaran." },
  { title: "Penjual memproses", text: "Penjual menerima detail pesanan dan menyiapkan order untuk diambil atau diantar sesuai jadwal." },
];

export default function OrderLandingPage() {
  return (
    <main className="nortago-landing">
      <style>{`
        .nortago-landing{--ink:#142a3a;--muted:#647586;--blue:#1767d2;--blue2:#0e4da8;--line:#e5edf4;--pale:#f4f8fc;--mint:#e9f7f2;background:#fff;color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh}
        .nl-wrap{width:min(1160px,calc(100% - 40px));margin:auto}
        .nl-nav{height:76px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}
        .nl-brand{display:flex;align-items:center;gap:11px;font-weight:850;letter-spacing:.02em}
        .nl-mark{width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#1c77e8,#154ca8);display:grid;place-items:center;color:white;font-weight:900}
        .nl-navlinks{display:flex;align-items:center;gap:24px;font-size:14px;color:#4c6071}
        .nl-nav a{text-decoration:none;color:inherit}
        .nl-cta{display:inline-flex;align-items:center;justify-content:center;background:var(--blue);color:#fff!important;padding:12px 18px;border-radius:12px;font-weight:750;text-decoration:none;box-shadow:0 8px 22px #1767d21f}
        .nl-cta:hover{background:var(--blue2)}
        .nl-hero{padding:76px 0 64px;display:grid;grid-template-columns:1.1fr .9fr;gap:42px;align-items:center}
        .nl-eyebrow{display:inline-flex;background:#eaf3ff;color:#175db6;padding:8px 12px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.08em}
        .nl-hero h1{font-size:clamp(38px,5vw,64px);line-height:1.04;letter-spacing:-.045em;margin:20px 0 18px;max-width:700px}
        .nl-hero h1 em{font-style:normal;color:var(--blue)}
        .nl-lead{font-size:18px;line-height:1.7;color:var(--muted);max-width:620px}
        .nl-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}
        .nl-secondary{display:inline-flex;align-items:center;justify-content:center;border:1px solid #d6e2ed;padding:12px 18px;border-radius:12px;font-weight:750;text-decoration:none;color:var(--ink)}
        .nl-proof{margin-top:20px;color:#788896;font-size:13px}
        .nl-preview{border:1px solid var(--line);background:linear-gradient(145deg,#f7fbff,#edf5fc);border-radius:28px;padding:22px;box-shadow:0 24px 70px #183e6012}
        .nl-previewtop{display:flex;justify-content:space-between;align-items:center;color:#526779;font-size:13px;font-weight:750;margin-bottom:18px}
        .nl-screen{background:#fff;border:1px solid #e6edf3;border-radius:20px;padding:18px;box-shadow:0 12px 30px #12345a0b}
        .nl-screenhead{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
        .nl-screenhead strong{font-size:16px}
        .nl-pill{font-size:11px;background:#e8f6ee;color:#21804b;border-radius:999px;padding:6px 9px;font-weight:800}
        .nl-item{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #edf1f5}
        .nl-food{width:54px;height:54px;border-radius:13px;background:linear-gradient(135deg,#ffe7c7,#f6c27e);display:grid;place-items:center;font-size:25px}
        .nl-item:nth-child(3) .nl-food{background:linear-gradient(135deg,#f8d9dc,#e69ba5)}
        .nl-item:nth-child(4) .nl-food{background:linear-gradient(135deg,#d6f0df,#92d2ad)}
        .nl-iteminfo{flex:1}
        .nl-iteminfo b{display:block;font-size:14px}
        .nl-iteminfo small{color:#7c8b98;display:block;margin-top:4px}
        .nl-price{font-weight:850;font-size:14px}
        .nl-total{display:flex;justify-content:space-between;padding:16px 0;font-size:14px;font-weight:800}
        .nl-mockbtn{display:block;background:#1767d2;color:white;text-align:center;padding:12px;border-radius:12px;font-weight:800;font-size:14px}
        .nl-section{padding:66px 0}
        .nl-section.tint{background:var(--pale)}
        .nl-sectionhead{text-align:center;max-width:760px;margin:0 auto 34px}
        .nl-sectionhead h2{font-size:clamp(28px,3vw,42px);line-height:1.14;letter-spacing:-.03em;margin:12px 0}
        .nl-sectionhead p{color:var(--muted);line-height:1.7;font-size:16px}
        .nl-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
        .nl-card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:22px}
        .nl-cardnum{color:var(--blue);font-weight:850;font-size:12px;letter-spacing:.1em}
        .nl-card h3{font-size:18px;line-height:1.3;margin:13px 0}
        .nl-card p{font-size:14px;color:var(--muted);line-height:1.65;margin:0}
        .nl-flow{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
        .nl-flowstep{position:relative;padding:22px;border:1px solid var(--line);border-radius:18px;background:#fff}
        .nl-flowstep span{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#eaf3ff;color:var(--blue);font-weight:850;margin-bottom:14px}
        .nl-flowstep h3{margin:0 0 9px;font-size:17px}
        .nl-flowstep p{margin:0;color:var(--muted);font-size:14px;line-height:1.6}
        .nl-banner{border-radius:28px;background:linear-gradient(125deg,#135bb8,#1d80e6);padding:42px;color:white;display:flex;justify-content:space-between;align-items:center;gap:24px}
        .nl-banner h2{font-size:clamp(27px,3vw,38px);line-height:1.15;margin:0 0 10px;letter-spacing:-.03em}
        .nl-banner p{color:#e5f1ff;margin:0;line-height:1.6}
        .nl-banner .nl-secondary{background:#fff;border:0;color:#1557a8;white-space:nowrap}
        .nl-footer{border-top:1px solid var(--line);padding:28px 0;color:#718190;font-size:13px;display:flex;justify-content:space-between;gap:12px}
        @media(max-width:900px){.nl-hero{grid-template-columns:1fr;padding:52px 0}.nl-grid4{grid-template-columns:repeat(2,1fr)}.nl-flow{grid-template-columns:repeat(2,1fr)}.nl-navlinks{gap:12px}}
        @media(max-width:600px){.nl-wrap{width:min(100% - 28px,1160px)}.nl-nav{height:66px}.nl-navlinks>a:not(.nl-cta){display:none}.nl-hero{padding:42px 0 48px;gap:28px}.nl-hero h1{font-size:42px}.nl-lead{font-size:16px}.nl-preview{padding:12px;border-radius:22px}.nl-section{padding:48px 0}.nl-grid4,.nl-flow{grid-template-columns:1fr}.nl-banner{padding:26px;flex-direction:column;align-items:flex-start}.nl-banner .nl-secondary{white-space:normal}.nl-footer{flex-direction:column}}
      `}</style>
      <div className="nl-wrap">
        <nav className="nl-nav">
          <div className="nl-brand"><span className="nl-mark">N</span><span>NORTAGO <span style={{color:"#1767d2"}}>ORDER</span></span></div>
          <div className="nl-navlinks"><a href="#fitur">Fitur</a><a href="#cara-kerja">Cara kerja</a><Link href="/login">Login Owner</Link><Link className="nl-cta" href="/otc/customer-order">Lihat Menu</Link></div>
        </nav>
        <section className="nl-hero">
          <div>
            <span className="nl-eyebrow">ORDERING SYSTEM UNTUK BISNIS F&amp;B</span>
            <h1>Pesanan lebih rapi.<br/><em>Operasional lebih ringan.</em></h1>
            <p className="nl-lead">Jadikan menu, pemesanan, dan pembayaran bisnis Anda mudah diakses melalui satu link. Bagikan di WhatsApp, Instagram, Facebook, TikTok, bio, status, grup, atau iklan. Pelanggan tinggal buka menu, pilih, pesan, dan bayar—tanpa perlu mengunduh aplikasi.</p>
            <div className="nl-actions"><Link className="nl-cta" href="/otc/customer-order">Jelajahi Menu Digital ↗</Link><a className="nl-secondary" href="#cara-kerja">Lihat cara kerja</a></div>
            <div className="nl-proof">Fleksibel untuk UMKM, usaha menengah, perusahaan besar, dan bisnis dengan banyak outlet.</div>
          </div>
          <div className="nl-preview" aria-label="Ilustrasi menu digital">
            <div className="nl-previewtop"><span>Customer Menu Preview</span><span>● LIVE MENU</span></div>
            <div className="nl-screen">
              <div className="nl-screenhead"><strong>Menu Hari Ini</strong><span className="nl-pill">Tersedia</span></div>
              <div className="nl-item"><div className="nl-food">🍜</div><div className="nl-iteminfo"><b>Mie Ayam Special</b><small>Favorit pelanggan</small></div><span className="nl-price">Rp18k</span></div>
              <div className="nl-item"><div className="nl-food">🥤</div><div className="nl-iteminfo"><b>Es Teh Segar</b><small>Minuman</small></div><span className="nl-price">Rp6k</span></div>
              <div className="nl-item"><div className="nl-food">🍱</div><div className="nl-iteminfo"><b>Nasi Ayam</b><small>Menu pilihan</small></div><span className="nl-price">Rp22k</span></div>
              <div className="nl-total"><span>Pesanan Anda</span><span>3 item</span></div><div className="nl-mockbtn">Lanjut ke Checkout</div>
            </div>
          </div>
        </section>
      </div>
      <section className="nl-section tint" id="fitur"><div className="nl-wrap">
        <div className="nl-sectionhead"><span className="nl-eyebrow">SATU LINK UNTUK PROMOSI DAN TRANSAKSI</span><h2>Promosi Anda mengundang pelanggan.<br/>Link NORTAGO ORDER memudahkan transaksi.</h2><p>Tidak perlu mengarahkan pelanggan ke percakapan panjang untuk menanyakan menu, harga, atau mengulang pesanan. Menu dan alur order tersedia dalam satu link.</p></div>
        <div className="nl-grid4">{features.map(f=><article className="nl-card" key={f.number}><span className="nl-cardnum">{f.number}</span><h3>{f.title}</h3><p>{f.text}</p></article>)}</div>
      </div></section>
      <section className="nl-section" id="cara-kerja"><div className="nl-wrap">
        <div className="nl-sectionhead"><span className="nl-eyebrow">CARA KERJA</span><h2>Empat langkah. Satu alur order.</h2><p>Mulai dari link menu yang mudah dibagikan hingga tim menindaklanjuti pesanan.</p></div>
        <div className="nl-flow">{steps.map((s,i)=><article className="nl-flowstep" key={s.title}><span>{i+1}</span><h3>{s.title}</h3><p>{s.text}</p></article>)}</div>
      </div></section>
      <section className="nl-section tint"><div className="nl-wrap"><div className="nl-banner"><div><h2>Untuk usaha kecil hingga perusahaan multi-outlet.<br/>Satu link pemesanan yang praktis.</h2><p>NORTAGO ORDER membantu pelanggan memesan dan membayar, serta membantu penjual menerima dan memproses order.</p></div><Link className="nl-secondary" href="/otc/customer-order">Buka Customer Menu ↗</Link></div></div></section>
      <footer className="nl-wrap nl-footer"><span>© NORTAGO ORDER · Sistem Pemesanan Digital Terintegrasi</span><span>Menu · Checkout · Order Management</span></footer>
    </main>
  );
}
