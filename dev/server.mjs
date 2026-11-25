// Local dev server serving the Hyper Trove storefront (storefront/) backed by multivintage's multi-tenant APIs:
//   Tukupack:   http://localhost:8899/?store=tukupack
//   Anekafood:  http://localhost:8899/?store=anekafood
//   Back office: http://localhost:8899/admin (owner@tukupack.test / demo-password-1; admin@demo.test / demo-admin-pass)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { makeApp } from '../lib/app.mjs';
import { memoryDb } from '../lib/db-memory.mjs';
import { mkCred } from '../lib/crypto.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const STOREFRONT = path.join(ROOT, 'storefront');
const SEED_CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, 'dev', 'seed-catalog.json'), 'utf8'));

const db = memoryDb();
const PORT = Number(process.env.PORT) || 8899;
const app = makeApp({
  db,
  env: {
    SESSION_SECRET: 'dev-session-secret-0123456789abcdef',
    MASTER_KEY: 'dev-master-key-0123456789abcdef0123',
    SUPER_SETUP_KEY: 'dev-setup-key-123456',
    PLATFORM_DOMAIN: 'localhost',
    PUBLIC_BASE_URL: `http://localhost:${PORT}`
  }
});

// Cart state per (tenantSlug:cartToken)
const carts = new Map();

async function seed() {
  await db.insert('users', { tenant_id: null, email: 'admin@demo.test', role: 'super', cred: await mkCred('demo-admin-pass') });

  const mkStore = async (slug, name, theme, about, listed = true) => {
    const t = await db.insert('tenants', {
      slug,
      name,
      status: 'active',
      theme_ref: 'trove',
      theme,
      settings: {
        listed,
        payments: ['manual'],
        pickup: true,
        pay_minutes: 60,
        about,
        whatsapp: '6281200000000',
        tiers: { regular: { qty: 10, amt: 0, pct: 5 }, b2b: { qty: 1, amt: 0, pct: 15 } },
        manual: { bank: 'BCA', account_no: '1234567890', account_name: name }
      }
    });
    await db.insert('users', { tenant_id: t.id, email: `owner@${slug}.test`, name: 'Owner', role: 'owner', cred: await mkCred('demo-password-1') });
    return t;
  };

  const seedCatalogForTenant = async (t, warehouses, { priceScale = 15000, offset = 0 } = {}) => {
    for (let idx = 0; idx < SEED_CATALOG.length; idx++) {
      const item = SEED_CATALOG[(idx + offset) % SEED_CATALOG.length];
      const p = await db.insert('products', {
        tenant_id: t.id,
        name: item.title,
        handle: item.handle,
        shopify_id: item.shopify_id || null,
        category: item.category || 'Groceries',
        sort: idx,
        image: item.image || '/cdn/shop/files/trove-logo.jpg',
        description: item.description || item.title
      });
      const vars = item.variants?.length
        ? item.variants
        : [{ title: 'Standard', price_cents: 999, weight_g: 450, sku: `MV-${idx}` }];
      for (const [vIdx, vr] of vars.entries()) {
        const priceIdr = Math.max(5000, Math.round(((Number(vr.price_cents) || 999) / 100) * priceScale / 500) * 500);
        const v = await db.insert('variants', {
          tenant_id: t.id,
          product_id: p.id,
          shopify_variant_id: vr.shopify_variant_id ? String(vr.shopify_variant_id) : null,
          sku: vr.sku || `MV-${idx}-${vIdx}`,
          name: vr.title && vr.title !== 'Default Title' ? vr.title : 'Standard',
          price: priceIdr,
          weight_g: Number(vr.weight_g || 450)
        });
        for (const [wIdx, w] of warehouses.entries()) {
          const qty = wIdx === 0 && idx % 7 === 0 ? 0 : idx % 5 === 0 ? 3 : 28;
          await db.insert('stock', { tenant_id: t.id, warehouse_id: w.id, variant_id: v.id, qty, reserved: 0 });
        }
      }
    }
  };

  // Store 1: TukuPack — IKEA Blue (#0058A3) & Yellow IKEA (#FFDA1A)
  const tukupack = await mkStore(
    'tukupack',
    'TukuPack',
    {
      primary: '#0058A3',
      accent: '#FFDA1A',
      background: '#F4F6F9',
      surface: '#FFFFFF',
      text: '#111827',
      font: 'Poppins',
      radius: 10,
      announcement_tag: 'TUKUPACK',
      announcement: '🎉 Free Express Delivery on orders Rp 250.000+ · Multi-Warehouse Same-Day Dispatch!'
    },
    'Fresh groceries, organic produce, bakery, meat & beverages routed from the nearest warehouse.'
  );
  const wj = await db.insert('warehouses', { tenant_id: tukupack.id, name: 'Warehouse Jakarta', address: 'Jl. Kemang Raya 10', postal_code: '12730', lat: -6.2615, lng: 106.8106 });
  const ws = await db.insert('warehouses', { tenant_id: tukupack.id, name: 'Warehouse Surabaya', address: 'Jl. Basuki Rahmat 55', postal_code: '60271', lat: -7.2654, lng: 112.7419 });
  await seedCatalogForTenant(tukupack, [wj, ws], { priceScale: 15000, offset: 0 });
  await db.insert('coupons', { tenant_id: tukupack.id, code: 'WELCOME10', type: 'pct', value: 10, min_purchase: 50000, max_uses: 100 });
  await db.insert('coupons', { tenant_id: tukupack.id, code: 'FIVEK', type: 'amt', value: 5000 });
  await db.insert('b2b_accounts', { tenant_id: tukupack.id, name: 'Cafe Biru', phone: '0811000111', login: 'cafe.biru', cred: await mkCred('demo-password-1') });
  await db.insert('courier_zones', { tenant_id: tukupack.id, name: 'Nearby', max_km: 8, fee: 12000, eta: '45–90 minutes' });
  await db.insert('courier_zones', { tenant_id: tukupack.id, name: 'City', max_km: 25, fee: 25000, eta: 'Same day' });

  // Store 2: Anekafood Packaging — #E60000 & Yellow IKEA (#FFDA1A)
  const aneka = await mkStore(
    'anekafood',
    'Anekafood Packaging',
    {
      primary: '#E60000',
      accent: '#FFDA1A',
      background: '#F5F5F5',
      surface: '#FFFFFF',
      text: '#111827',
      font: 'Poppins',
      radius: 10,
      announcement_tag: 'ANEKAFOOD PACKAGING',
      announcement: '✌🏼 Anekafood Packaging — Same-day dispatch from Jakarta Hub!'
    },
    'Complete fresh food, bakery, dairy & packaging supply with B2B wholesale tiers.'
  );
  const wa = await db.insert('warehouses', { tenant_id: aneka.id, name: 'Anekafood Hub Jakarta', address: 'Jl. Panjang Arteri 18', postal_code: '11520', lat: -6.1912, lng: 106.7689 });
  await seedCatalogForTenant(aneka, [wa], { priceScale: 14500, offset: 4 });
  await db.insert('courier_zones', { tenant_id: aneka.id, name: 'Jakarta Courier', max_km: 25, fee: 15000, eta: 'Same day' });
}
await seed();

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json'
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const moneyIdr = n => 'Rp ' + Math.round(Number(n || 0)).toLocaleString('id-ID');

function parseCookies(h = '') {
  const out = {};
  for (const part of String(h).split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  const ct = String(req.headers['content-type'] || '').toLowerCase();
  if (ct.includes('application/json') || raw.trim().startsWith('{') || raw.trim().startsWith('[')) {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  if (ct.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw).entries());
  }
  const m = ct.match(/boundary=([^\s;]+)/);
  if (m) {
    const obj = {};
    for (const part of raw.split('--' + m[1])) {
      const nm = part.match(/name="([^"]+)"/);
      const idx = part.indexOf('\r\n\r\n');
      if (nm && idx !== -1) obj[nm[1]] = part.slice(idx + 4).replace(/\r\n$/, '');
    }
    return obj;
  }
  return {};
}

async function resolveStore(req, url) {
  const q = (url.searchParams.get('store') || '').trim().toLowerCase();
  const pathSlug = (url.pathname.match(/^\/(tukupack|anekafood)(\/|$)/i) || [])[1]?.toLowerCase() || '';
  const cookies = parseCookies(req.headers.cookie);
  const hdr = (req.headers['x-tenant'] || '').trim().toLowerCase();
  const slug = q || pathSlug || hdr || cookies.mv_store || 'tukupack';
  let t = await db.one('tenants', { slug });
  if (!t) t = await db.one('tenants', { slug: 'tukupack' });
  const setCookie = (q || pathSlug) ? `mv_store=${encodeURIComponent(t.slug)}; Path=/; SameSite=Lax` : null;
  return { tenant: t, setCookie };
}

function getCartCookie(req, tenantSlug) {
  const cookies = parseCookies(req.headers.cookie);
  const name = `mv_cart_${tenantSlug}`;
  if (cookies[name]) return { token: cookies[name], setCookie: null };
  const token = crypto.randomBytes(12).toString('hex');
  return { token, setCookie: `${name}=${token}; Path=/; SameSite=Lax` };
}

async function buildCartState(tenant, token) {
  const key = `${tenant.slug}:${token}`;
  const raw = carts.get(key) || { items: new Map(), note: '' };
  const products = await db.select('products', { tenant_id: tenant.id, active: true });
  const variants = await db.select('variants', { tenant_id: tenant.id, active: true });
  const byVar = new Map(variants.map(v => [v.id, v]));
  const byProd = new Map(products.map(p => [p.id, p]));

  const items = [];
  let subtotal = 0;
  let itemCount = 0;
  let idx = 0;
  for (const [vid, qty] of raw.items.entries()) {
    const v = byVar.get(vid);
    const p = v ? byProd.get(v.product_id) : null;
    if (!v || !p || qty <= 0) continue;
    idx++;
    const linePrice = Number(v.price) * qty;
    subtotal += linePrice;
    itemCount += qty;
    const numericVid = Number(v.shopify_variant_id) || v.id;
    items.push({
      id: numericVid,
      variant_id: v.id,
      shopify_variant_id: v.shopify_variant_id,
      key: `${v.id}:${idx}`,
      product_id: Number(p.shopify_id) || p.id,
      title: v.name && v.name !== 'Standard' ? `${p.name} - ${v.name}` : p.name,
      product_title: p.name,
      variant_title: v.name,
      handle: p.handle,
      vendor: tenant.name,
      quantity: qty,
      price: Number(v.price) * 100,
      price_idr: Number(v.price),
      line_price: linePrice * 100,
      line_price_idr: linePrice,
      image: p.image || '/cdn/shop/files/trove-logo.jpg',
      featured_image: { url: p.image || '/cdn/shop/files/trove-logo.jpg', alt: p.name },
      url: `/products/${p.handle}`,
      options_with_values: [{ name: 'Option', value: v.name || 'Standard' }]
    });
  }
  return {
    token,
    note: raw.note || '',
    item_count: itemCount,
    items_subtotal_price: subtotal * 100,
    total_price: subtotal * 100,
    total_price_idr: subtotal,
    currency: 'IDR',
    items
  };
}

function renderCartSections(cartState, requested = []) {
  const itemsHtml = cartState.items.map((item, i) => {
    const line = i + 1;
    return `
      <div id="CartDrawer-Item-${line}" class="cart-item flex gap-3 py-4 border-b" data-line-key="${esc(item.key)}">
        <a href="${esc(item.url)}" class="cart-item__media shrink-0" style="width:72px;height:72px;overflow:hidden;border-radius:8px;background:#f4f4f4;display:block">
          <img src="${esc(item.image)}" alt="${esc(item.product_title)}" style="width:100%;height:100%;object-fit:cover">
        </a>
        <div class="cart-item__details flex-grow flex flex-col gap-1">
          <div class="flex justify-between gap-2">
            <a href="${esc(item.url)}" class="cart-item__title font-medium text-sm" style="text-decoration:none;color:inherit">${esc(item.product_title)}</a>
            <a is="cart-remove-item" href="/cart/change?line=${line}&quantity=0" data-index="${line}" class="text-xs opacity-60 hover:opacity-100" aria-label="Remove">✕</a>
          </div>
          ${item.variant_title && item.variant_title !== 'Standard' ? `<div class="text-xs opacity-70">${esc(item.variant_title)}</div>` : ''}
          <div class="flex items-center justify-between gap-2 mt-1">
            <quantity-input class="quantity flex items-center border rounded" style="display:inline-flex;align-items:center;border:1px solid #ddd;border-radius:6px">
              <button class="quantity__button px-2 py-1" name="minus" type="button">−</button>
              <input class="quantity__input text-center text-sm" type="number" name="updates[]" value="${item.quantity}" min="0" data-index="${line}" style="width:36px;border:none;text-align:center;background:transparent">
              <button class="quantity__button px-2 py-1" name="plus" type="button">+</button>
            </quantity-input>
            <div class="font-semibold text-sm">${esc(moneyIdr(item.line_price_idr))}</div>
          </div>
        </div>
      </div>`;
  }).join('');

  const drawerHtml = `
    <div id="CartDrawer-sections--19692154126565__cart-drawer" class="drawer__content flex flex-col h-full w-full">
      <div class="drawer__header" style="padding:14px 16px;border-bottom:1px solid #e5e5e5;display:flex;align-items:center;justify-content:space-between;gap:12px">
        <h2 id="CartDrawer-Heading" class="drawer__heading h4" style="margin:0">Your cart (${cartState.item_count})</h2>
        <button class="drawer__close-btn" aria-controls="CartDrawer" aria-label="Close" type="button" style="position:static;min-width:44px;min-height:44px;display:grid;place-items:center">✕</button>
      </div>
      <div class="drawer__body v-scrollable flex-1" style="padding:16px;overflow-y:auto">
        <div id="CartDrawerEmpty-sections--19692154126565__cart-drawer" class="${cartState.item_count > 0 ? 'hidden' : ''} text-center py-8">
          <p class="h4 mb-2">Your cart is currently empty.</p>
          <a href="/collections/all" class="btn btn--primary">Continue shopping</a>
        </div>
        <div id="CartDrawerBody-sections--19692154126565__cart-drawer" class="${cartState.item_count === 0 ? 'hidden' : ''} flex flex-col gap-2">
          <cart-items data-section-id="sections--19692154126565__cart-drawer">${itemsHtml}</cart-items>
        </div>
      </div>
      <div id="CartDrawerFooter-sections--19692154126565__cart-drawer" class="${cartState.item_count === 0 ? 'hidden' : ''} drawer__footer" style="padding:14px 16px;border-top:1px solid #e5e5e5;background:#fff">
        <div class="flex justify-between items-center mb-3 text-sm">
          <span>Subtotal</span>
          <span class="font-bold text-base">${esc(moneyIdr(cartState.total_price_idr))}</span>
        </div>
        <div class="flex gap-2" style="display:flex;gap:8px;flex-wrap:wrap">
          <a href="/cart" class="btn btn--secondary flex-1 text-center" style="min-height:44px">View cart</a>
          <button type="button" class="btn btn--primary flex-1" style="min-height:44px" data-mv-checkout>Checkout (${cartState.item_count})</button>
        </div>
      </div>
    </div>`;

  const sections = { 'sections--19692154126565__cart-drawer': drawerHtml };
  for (const sid of requested) if (sid && !sections[sid]) sections[sid] = drawerHtml;
  return sections;
}

async function resolveVariantForTenant(tenant, idInput) {
  const s = String(idInput || '').trim();
  if (!s) return null;
  const vars = await db.select('variants', { tenant_id: tenant.id, active: true });
  return vars.find(v => v.id === s || v.shopify_variant_id === s) || null;
}

function hexToRgb(hex, fallback) {
  const m = String(hex || '').trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function buildTenantThemeCss(tenant) {
  const th = tenant.theme || {};
  const isAneka = tenant.slug === 'anekafood';
  const primaryHex = th.primary || (isAneka ? '#E60000' : '#0058A3');
  const accentHex = th.accent || '#FFDA1A';
  const bgHex = th.background || (isAneka ? '#F5F5F5' : '#F4F6F9');
  const pRgb = hexToRgb(primaryHex, isAneka ? '230,0,0' : '0,88,163');
  const aRgb = hexToRgb(accentHex, '255,218,26');
  const bgRgb = hexToRgb(bgHex, '244,246,249');
  const btnTextRgb = '255,255,255';
  const accentTextRgb = isAneka ? '138,0,0' : '0,56,107';
  const inverseBgRgb = isAneka ? '168,0,0' : '0,62,117';

  return `<style id="mv-tenant-theme">
  :root {
    --mv-primary: ${primaryHex};
    --mv-accent: ${accentHex};
    --mv-accent-ink: rgb(${accentTextRgb});
    --color-badge-sale: ${primaryHex};
    --color-badge-sale-text: #FFFFFF;
    --color-badge-hot: ${primaryHex};
    --color-badge-new: ${accentHex};
    --color-badge-new-text: #000000;
  }
  .color-scheme-1, .color-scheme-info {
    --color-background: ${bgRgb};
    --color-primary: ${pRgb};
    --color-button: ${pRgb};
    --color-button-text: ${btnTextRgb};
    --color-product-price-sale: ${pRgb};
    --color-progress-bar: ${pRgb};
  }
  .color-scheme-2 {
    --color-primary: ${pRgb};
    --color-button: ${pRgb};
    --color-button-text: ${btnTextRgb};
    --color-product-price-sale: ${pRgb};
    --color-progress-bar: ${pRgb};
  }
  .color-scheme-inverse {
    --color-background: ${inverseBgRgb};
    --color-secondary-background: ${pRgb};
    --color-primary: ${aRgb};
    --color-button: ${aRgb};
    --color-button-text: ${accentTextRgb};
    --color-border: ${pRgb};
  }
  .color-scheme-3, .color-scheme-4, .color-scheme-7 {
    --color-background: ${pRgb};
    --color-primary: ${aRgb};
    --color-button: ${aRgb};
    --color-button-text: ${accentTextRgb};
    --color-secondary-button: ${pRgb};
    --color-secondary-button-border: ${aRgb};
    --color-secondary-button-text: 255,255,255;
  }
  .color-scheme-13 {
    --color-background: ${aRgb};
    --color-primary: ${pRgb};
    --color-text-heading: ${accentTextRgb};
    --color-foreground: ${accentTextRgb};
    --color-subtext: ${accentTextRgb};
    --color-button: ${pRgb};
    --color-button-text: 255,255,255;
  }
  .header .cart-count, cart-count {
    background-color: ${accentHex} !important;
    color: #000000 !important;
  }
  .announcement-bar.color-scheme-inverse {
    background-color: ${primaryHex} !important;
    color: #FFFFFF !important;
  }
  .header__logo {
    max-width: 100% !important;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    gap: 10px;
  }
  .header__top {
    column-gap: 12px !important;
  }
  .header__search,
  .header__search .search__form {
    min-width: 0 !important;
    max-width: 100% !important;
  }
  @media (min-width: 1024px) {
    .header__logo {
      width: auto;
      max-width: none !important;
      overflow: visible;
    }
    .header__top--logo-left {
      grid-template-columns: auto minmax(0, 1fr) auto !important;
      column-gap: 20px !important;
    }
    .header__top--logo-left .header__search {
      padding-inline: 16px !important;
      justify-self: center;
      width: 100%;
      max-width: 56rem;
    }
  }
  .mv-footer-logo-wrap {
    width: auto !important;
    max-width: 100%;
  }
  .mv-brand-logo {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: 100%;
    min-width: 0;
    text-decoration: none;
    color: inherit;
    font-family: Poppins, sans-serif;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.15;
  }
  .mv-brand-mark {
    display: inline-grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: ${primaryHex};
    color: ${accentHex};
    font-size: 15px;
    font-weight: 800;
    flex-shrink: 0;
  }
  .mv-brand-text {
    font-size: clamp(13.5px, 2.2vw, 18px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .footer .mv-brand-mark {
    width: 36px;
    height: 36px;
    background: ${accentHex};
    color: ${primaryHex};
  }
  .footer .mv-brand-text {
    color: #FFFFFF;
    font-size: 19px;
    white-space: normal;
    overflow: visible;
  }
  .mv-fab { background: ${primaryHex}; }
  .mv-fab .mv-chk { background: ${accentHex}; border-color: ${accentHex}; color: #000000; }
</style>`;
}

function brandLogoHtml(tenant, footer = false) {
  const name = esc(tenant.name);
  const ini = esc(tenant.slug === 'anekafood' ? 'AP' : 'TP');
  if (footer) {
    return `<span class="mv-brand-logo"><span class="mv-brand-mark">${ini}</span><span class="mv-brand-text">${name}</span></span>`;
  }
  return `<a href="/${esc(tenant.slug)}" class="h3 relative flex header__logo--text mv-brand-logo" aria-label="${name}"><span class="mv-brand-mark">${ini}</span><span class="mv-brand-text">${name}</span></a>`;
}

async function injectBridge(html, tenant) {
  const whs = await db.select('warehouses', { tenant_id: tenant.id, active: true });
  const allTenants = (await db.select('tenants', { status: 'active' }))
    .filter(t => (t.settings || {}).listed !== false)
    .map(t => ({ slug: t.slug, name: t.name }));
  const ctxJson = JSON.stringify({
    tenant: { slug: tenant.slug, name: tenant.name, theme: tenant.theme || {}, settings: tenant.settings || {} },
    stores: allTenants,
    store_switcher: Boolean(app.getPlatformSettings().store_switcher),
    warehouses: whs.map(w => ({ id: w.id, name: w.name, address: w.address, lat: w.lat, lng: w.lng }))
  }).replace(/<\/script/gi, '<\\/script');

  const headInject = `${buildTenantThemeCss(tenant)}\n<link rel="stylesheet" href="/mv-bridge.css">\n<script>window.__MV_CONTEXT__ = ${ctxJson};</script>`;
  const brand = esc(tenant.name);
  let out = html
    .replace(/<script[^>]+src="https:\/\/cdn\.shopify\.com\/[^"]+"[^>]*><\/script>/gi, '')
    .replace(/<script[^>]*>\s*await import\("https:\/\/cdn\.shopify\.com\/[^"]+"\)[\s\S]*?<\/script>/gi, '')
    .replace(/<a\s+href="\/"\s+class="h3 relative flex header__logo--image"[\s\S]*?<\/a>/i, brandLogoHtml(tenant, false))
    .replace(/<div\s+class="footer-image-box__image"[\s\S]*?trove-logo-footer\.png[\s\S]*?<\/picture>\s*<\/motion-element>\s*<\/div>/i, `<div class="footer-image-box__image mv-footer-logo-wrap">${brandLogoHtml(tenant, true)}</div>`)
    .replace(/<img[^>]*trove-logo-footer\.png[^>]*>/gi, brandLogoHtml(tenant, true))
    .replace(/Hyper Shopify Theme\s*(&ndash;|–|-)\s*Hyper Trove/gi, brand)
    .replace(/Hyper\s+Trove/gi, brand)
    .replace(/Trove\s+Market/gi, brand)
    .replace(/Powered by Shopify/gi, `${brand} Storefront`);
  if (out.includes('</head>')) out = out.replace('</head>', `${headInject}\n</head>`);
  if (out.includes('</body>')) out = out.replace('</body>', `<script src="/mv-bridge.js" defer></script>\n</body>`);
  return out;
}

function sendJson(res, status, data, cookies = []) {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (cookies.length) headers['set-cookie'] = cookies;
  res.writeHead(status, headers);
  res.end(JSON.stringify(data));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = url.pathname;

  // Backend multi-tenant API
  if (pathname.startsWith('/api/')) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const headers = new Headers(req.headers);
    if (!headers.get('x-tenant')) {
      const { tenant } = await resolveStore(req, url);
      if (tenant) headers.set('x-tenant', tenant.slug);
    }
    const r = await app.handle(new Request(url, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks)
    }));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    return res.end(Buffer.from(await r.arrayBuffer()));
  }

  const { tenant, setCookie: storeCookie } = await resolveStore(req, url);
  const { token: cartToken, setCookie: cartCookie } = getCartCookie(req, tenant.slug);
  const cookies = [storeCookie, cartCookie].filter(Boolean);

  // Shopify-compatible cart & storefront AJAX routes
  if (req.method === 'GET' && (pathname === '/cart.js' || pathname === '/cart.json' || (pathname === '/cart' && String(req.headers.accept || '').includes('application/json')))) {
    return sendJson(res, 200, await buildCartState(tenant, cartToken), cookies);
  }
  if (req.method === 'POST' && (pathname === '/cart/add' || pathname === '/cart/add.js')) {
    const body = await readBody(req);
    const itemsReq = Array.isArray(body.items) ? body.items : [{ id: body.id, quantity: body.quantity ?? 1 }];
    const key = `${tenant.slug}:${cartToken}`;
    const raw = carts.get(key) || { items: new Map(), note: '' };
    let lastVar = null;
    for (const it of itemsReq) {
      const v = await resolveVariantForTenant(tenant, it.id);
      if (!v) return sendJson(res, 404, { status: 404, message: 'Product variant not found' }, cookies);
      const qty = Math.max(1, Math.floor(Number(it.quantity ?? 1)));
      raw.items.set(v.id, (raw.items.get(v.id) || 0) + qty);
      lastVar = v;
    }
    carts.set(key, raw);
    const state = await buildCartState(tenant, cartToken);
    const secList = typeof body.sections === 'string' ? body.sections.split(',') : Array.isArray(body.sections) ? body.sections : [];
    const added = state.items.find(i => i.variant_id === lastVar?.id) || state.items[0] || {};
    return sendJson(res, 200, { ...added, ...state, sections: renderCartSections(state, secList) }, cookies);
  }
  if (req.method === 'POST' && (pathname === '/cart/change' || pathname === '/cart/change.js')) {
    const body = await readBody(req);
    const key = `${tenant.slug}:${cartToken}`;
    const raw = carts.get(key) || { items: new Map(), note: '' };
    const before = await buildCartState(tenant, cartToken);
    const line = Number(body.line);
    const qty = Math.max(0, Math.floor(Number(body.quantity ?? 0)));
    let vid = null;
    if (Number.isFinite(line) && line >= 1 && line <= before.items.length) vid = before.items[line - 1].variant_id;
    else if (body.id) vid = (await resolveVariantForTenant(tenant, String(body.id).split(':')[0]))?.id || null;
    if (vid) {
      if (qty === 0) raw.items.delete(vid);
      else raw.items.set(vid, qty);
      carts.set(key, raw);
    }
    const state = await buildCartState(tenant, cartToken);
    const secList = Array.isArray(body.sections) ? body.sections : [];
    return sendJson(res, 200, { ...state, sections: renderCartSections(state, secList) }, cookies);
  }
  if (req.method === 'POST' && (pathname === '/cart/update' || pathname === '/cart/update.js')) {
    const body = await readBody(req);
    const key = `${tenant.slug}:${cartToken}`;
    const raw = carts.get(key) || { items: new Map(), note: '' };
    if (body.note !== undefined) raw.note = String(body.note);
    carts.set(key, raw);
    const state = await buildCartState(tenant, cartToken);
    const secList = typeof body.sections === 'string' ? body.sections.split(',') : Array.isArray(body.sections) ? body.sections : [];
    return sendJson(res, 200, { ...state, sections: renderCartSections(state, secList) }, cookies);
  }
  if (req.method === 'POST' && pathname === '/cart/clear.js') {
    carts.delete(`${tenant.slug}:${cartToken}`);
    return sendJson(res, 200, await buildCartState(tenant, cartToken), cookies);
  }
  if (req.method === 'GET' && pathname === '/search/suggest') {
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const prods = await db.select('products', { tenant_id: tenant.id, active: true }, { order: 'sort' });
    const vars = await db.select('variants', { tenant_id: tenant.id, active: true });
    const hits = q ? prods.filter(p => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)).slice(0, 10) : [];
    const cards = hits.map(p => {
      const lo = Math.min(...vars.filter(v => v.product_id === p.id).map(v => Number(v.price)));
      return `<a href="/products/${esc(p.handle)}" style="display:flex;align-items:center;gap:12px;padding:8px;border-bottom:1px solid #f1f5f9;text-decoration:none;color:inherit">
        <img src="${esc(p.image || '/cdn/shop/files/trove-logo.jpg')}" alt="${esc(p.name)}" style="width:48px;height:48px;object-fit:cover;border-radius:6px">
        <div><div style="font-weight:600;font-size:13px">${esc(p.name)}</div><div style="font-size:12px;opacity:.7">${esc(p.category)} · ${esc(moneyIdr(lo))}</div></div>
      </a>`;
    }).join('');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(`<!DOCTYPE html><html><body><div id="PredictiveSearchResults-sections--19692152914149__header"><div data-total-results="${hits.length}" style="padding:12px">${cards || `<div style="padding:16px;text-align:center;opacity:.7">No products found for "${esc(q)}".</div>`}</div></div></body></html>`);
  }

  const prodMatch = pathname.match(/^\/products\/([^/.]+?)(\.js)?\/?$/);
  if (req.method === 'GET' && prodMatch) {
    const handle = prodMatch[1];
    const p = await db.one('products', { tenant_id: tenant.id, handle });
    if (p && prodMatch[2] === '.js') {
      const vs = await db.select('variants', { tenant_id: tenant.id, product_id: p.id });
      return sendJson(res, 200, { ...p, variants: vs }, cookies);
    }
    if (p && url.searchParams.has('section_id')) {
      const vs = await db.select('variants', { tenant_id: tenant.id, product_id: p.id });
      const first = vs[0];
      const opts = vs.map(v => `<option value="${esc(v.shopify_variant_id || v.id)}">${esc(v.name)} — ${esc(moneyIdr(v.price))}</option>`).join('');
      const qvHtml = `<!DOCTYPE html><html><body><div class="shopify-section"><div class="quick-view__content p-4"><div class="flex flex-col gap-4">
        <div style="border-radius:12px;overflow:hidden;background:#f5f5f5;aspect-ratio:1/1;max-height:280px"><img src="${esc(p.image)}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover"></div>
        <div>
          <span style="font-size:11px;text-transform:uppercase;color:#666">${esc(tenant.name)} · ${esc(p.category)}</span>
          <h2 class="h3 mt-1 mb-2">${esc(p.name)}</h2>
          <div class="text-lg font-bold mb-2">${esc(moneyIdr(first?.price || 0))}</div>
          <p class="text-sm opacity-80 mb-3">${esc(p.description)}</p>
          <form method="post" action="/cart/add" data-type="add-to-cart-form" class="flex flex-col gap-3">
            ${vs.length > 1 ? `<select name="id" class="form-control form-control--select">${opts}</select>` : `<input type="hidden" name="id" value="${esc(first?.shopify_variant_id || first?.id || '')}">`}
            <div class="flex gap-2 items-center"><input type="number" name="quantity" value="1" min="1" class="form-control" style="width:80px"><button type="submit" name="add" class="btn btn--primary flex-1">Add to cart</button></div>
          </form>
        </div></div></div></div></body></html>`;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(qvHtml);
    }
  }

  // Admin & bridge assets in public/
  const rel = path.normalize(pathname === '/admin' || pathname === '/admin/' ? '/admin.html' : pathname).replace(/^(\.\.(\/|\\|$))+/, '').replace(/^\/+/, '');
  const pubFile = path.join(PUBLIC, rel);
  if (rel && pubFile.startsWith(PUBLIC) && fs.existsSync(pubFile) && fs.statSync(pubFile).isFile()) {
    res.writeHead(200, { 'content-type': TYPES[path.extname(pubFile)] || 'application/octet-stream', 'cache-control': 'no-store' });
    return res.end(fs.readFileSync(pubFile));
  }

  // Real multitheme.zip storefront files in storefront/
  const isStoreRoot = /^\/(tukupack|anekafood)\/?$/i.test(pathname);
  let sfTarget = (!rel || isStoreRoot) ? path.join(STOREFRONT, 'index.html') : path.join(STOREFRONT, rel);
  if (fs.existsSync(sfTarget) && fs.statSync(sfTarget).isDirectory()) sfTarget = path.join(sfTarget, 'index.html');
  else if (!fs.existsSync(sfTarget) && fs.existsSync(path.join(STOREFRONT, rel, 'index.html'))) sfTarget = path.join(STOREFRONT, rel, 'index.html');

  if (sfTarget.startsWith(STOREFRONT) && fs.existsSync(sfTarget) && fs.statSync(sfTarget).isFile()) {
    const ext = path.extname(sfTarget).toLowerCase();
    if (ext === '.html' && path.basename(sfTarget) !== 'preview.html') {
      const html = await injectBridge(fs.readFileSync(sfTarget, 'utf8'), tenant);
      const hdrs = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' };
      if (cookies.length) hdrs['set-cookie'] = cookies;
      res.writeHead(200, hdrs);
      return res.end(html);
    }
    res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream' });
    return fs.createReadStream(sfTarget).pipe(res);
  }

  res.writeHead(404);
  res.end('Not found');
}).listen(PORT, () => console.log(`TukuPack:   http://localhost:${PORT}/tukupack  (or /?store=tukupack)\nAnekafood:  http://localhost:${PORT}/anekafood (or /?store=anekafood)\nAdmin:      http://localhost:${PORT}/admin`));
