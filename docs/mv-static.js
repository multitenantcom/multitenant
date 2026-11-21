(() => {
  const BASE = '/multitenant';
  const STORES = {
    tukupack: {
      slug: 'tukupack',
      name: 'TukuPack',
      ini: 'TP',
      primary: '#0058A3',
      pRgb: '0,88,163',
      accent: '#FFDA1A',
      aRgb: '255,218,26',
      bgRgb: '244,246,249',
      accentInk: '0,56,107',
      invBg: '0,62,117',
      announcement: '🎉 Free Express Delivery on orders Rp 250.000+ · Multi-Warehouse Same-Day Dispatch!'
    },
    anekafood: {
      slug: 'anekafood',
      name: 'Anekafood Packaging',
      ini: 'AP',
      primary: '#E60000',
      pRgb: '230,0,0',
      accent: '#FFDA1A',
      aRgb: '255,218,26',
      bgRgb: '245,245,245',
      accentInk: '138,0,0',
      invBg: '168,0,0',
      announcement: '✌🏼 Anekafood Packaging — Same-day dispatch from Jakarta Hub!'
    }
  };

  const qStore = new URLSearchParams(location.search).get('store');
  if (qStore && STORES[qStore.toLowerCase()]) localStorage.setItem('mv_gh_store', qStore.toLowerCase());
  const slug = STORES[localStorage.getItem('mv_gh_store')] ? localStorage.getItem('mv_gh_store') : 'tukupack';
  const S = STORES[slug];
  const money = n => 'Rp ' + Math.round(Number(n || 0)).toLocaleString('id-ID');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // Inject dynamic tenant theme CSS immediately
  const st = document.createElement('style');
  st.id = 'mv-tenant-theme';
  st.textContent = `
    :root { --mv-primary: ${S.primary}; --mv-accent: ${S.accent}; --color-badge-sale: ${S.primary}; --color-badge-hot: ${S.primary}; --color-badge-new: ${S.accent}; --color-badge-new-text: #000; }
    .color-scheme-1, .color-scheme-info { --color-background: ${S.bgRgb}; --color-primary: ${S.pRgb}; --color-button: ${S.pRgb}; --color-button-text: 255,255,255; --color-product-price-sale: ${S.pRgb}; --color-progress-bar: ${S.pRgb}; }
    .color-scheme-2 { --color-primary: ${S.pRgb}; --color-button: ${S.pRgb}; --color-button-text: 255,255,255; --color-product-price-sale: ${S.pRgb}; --color-progress-bar: ${S.pRgb}; }
    .color-scheme-inverse { --color-background: ${S.invBg}; --color-secondary-background: ${S.pRgb}; --color-primary: ${S.aRgb}; --color-button: ${S.aRgb}; --color-button-text: ${S.accentInk}; --color-border: ${S.pRgb}; }
    .color-scheme-3, .color-scheme-4, .color-scheme-7 { --color-background: ${S.pRgb}; --color-primary: ${S.aRgb}; --color-button: ${S.aRgb}; --color-button-text: ${S.accentInk}; --color-secondary-button: ${S.pRgb}; --color-secondary-button-border: ${S.aRgb}; --color-secondary-button-text: 255,255,255; }
    .color-scheme-13 { --color-background: ${S.aRgb}; --color-primary: ${S.pRgb}; --color-text-heading: ${S.accentInk}; --color-foreground: ${S.accentInk}; --color-subtext: ${S.accentInk}; --color-button: ${S.pRgb}; --color-button-text: 255,255,255; }
    .header .cart-count, cart-count { background-color: ${S.accent} !important; color: #000 !important; }
    .announcement-bar.color-scheme-inverse { background-color: ${S.primary} !important; color: #fff !important; }
    .header__logo { max-width: 100% !important; width: 100%; min-width: 0; overflow: hidden; gap: 10px; }
    .header__top { column-gap: 12px !important; }
    .header__search, .header__search .search__form { min-width: 0 !important; max-width: 100% !important; }
    @media (min-width: 1024px) {
      .header__logo { width: auto; max-width: none !important; overflow: visible; }
      .header__top--logo-left { grid-template-columns: auto minmax(0, 1fr) auto !important; column-gap: 20px !important; }
      .header__top--logo-left .header__search { padding-inline: 16px !important; justify-self: center; width: 100%; max-width: 56rem; }
    }
    .mv-footer-logo-wrap { width: auto !important; max-width: 100%; }
    .mv-brand-logo { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; min-width: 0; text-decoration: none; color: inherit; font-family: Poppins, sans-serif; font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; }
    .mv-brand-mark { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; background: ${S.primary}; color: ${S.accent}; font-size: 15px; font-weight: 800; flex-shrink: 0; }
    .mv-brand-text { font-size: clamp(13.5px, 2.2vw, 18px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .footer .mv-brand-mark { width: 36px; height: 36px; background: ${S.accent}; color: ${S.primary}; }
    .footer .mv-brand-text { color: #fff; font-size: 19px; white-space: normal; overflow: visible; }
    .mv-fab { background: ${S.primary}; }
    .mv-fab .mv-chk { background: ${S.accent}; border-color: ${S.accent}; color: #000; }
  `;
  document.head.appendChild(st);

  // Client-side cart & search shim for static GitHub Pages
  let catalogPromise = null;
  const loadCatalog = () => (catalogPromise ||= fetch(BASE + '/catalog.json').then(r => r.json()).catch(() => []));
  const cartKey = () => 'mv_gh_cart_' + S.slug;
  const getCart = () => { try { return JSON.parse(localStorage.getItem(cartKey()) || '[]'); } catch { return []; } };
  const saveCart = items => localStorage.setItem(cartKey(), JSON.stringify(items));

  async function buildCartState() {
    const raw = getCart();
    const cat = await loadCatalog();
    let totalIdr = 0, count = 0;
    const items = raw.map((it, idx) => {
      const prod = cat.find(p => p.variants?.some(v => String(v.shopify_variant_id) === String(it.id))) || cat[0];
      const vr = prod?.variants?.find(v => String(v.shopify_variant_id) === String(it.id)) || prod?.variants?.[0];
      const priceIdr = Math.max(5000, Math.round(((Number(vr?.price_cents) || 999) / 100) * 15000 / 500) * 500);
      const lineIdr = priceIdr * it.qty;
      totalIdr += lineIdr; count += it.qty;
      return {
        id: it.id, key: it.id + ':' + (idx + 1), product_title: prod?.title || 'Product',
        variant_title: vr?.title !== 'Default Title' ? vr?.title : '', quantity: it.qty,
        price_idr: priceIdr, line_price_idr: lineIdr,
        image: BASE + (prod?.image || '/cdn/shop/files/trove-logo.jpg'),
        url: BASE + '/products/' + (prod?.handle || '')
      };
    });
    return { item_count: count, total_price_idr: totalIdr, items };
  }

  const EXISTING_PRODUCTS = new Set([
    'almond-strawberry-milk-unsweet-vanilla-96-fl-oz-bottle',
    'bright-fresh-strawberry-clusters-1-lb',
    'handcrafted-classic-french-croissants',
    'premium-beef-short-ribs-bone-in-2-lb',
    'smooth-buttery-avocado'
  ]);
  const EXISTING_COLLECTIONS = new Set([
    '', 'all', 'beverages', 'bread-cake', 'dairy-egg',
    'meat-seafood', 'new-arrivals', 'on-sale', 'vegetables-fruits'
  ]);

  function itemPriceIdr(vr) {
    return Math.max(5000, Math.round(((Number(vr?.price_cents) || 999) / 100) * 15000 / 500) * 500);
  }

  function renderDrawer(state) {
    const html = `
      <div id="CartDrawer-sections--19692154126565__cart-drawer" class="drawer__content flex flex-col h-full w-full">
        <div class="drawer__header" style="padding:14px 16px;border-bottom:1px solid #e5e5e5;display:flex;align-items:center;justify-content:space-between;gap:12px">
          <h2 id="CartDrawer-Heading" class="drawer__heading h4" style="margin:0">Your cart (${state.item_count})</h2>
          <button class="drawer__close-btn" aria-controls="CartDrawer" aria-label="Close" type="button" style="position:static;min-width:44px;min-height:44px;display:grid;place-items:center">✕</button>
        </div>
        <div class="drawer__body v-scrollable flex-1" style="padding:16px;overflow-y:auto">
          <div class="${state.item_count > 0 ? 'hidden' : ''} text-center py-8"><p class="h4 mb-2">Your cart is currently empty.</p></div>
          <div class="${state.item_count === 0 ? 'hidden' : ''} flex flex-col gap-2">
            ${state.items.map((it, i) => `
              <div class="cart-item flex gap-3 py-4 border-b" style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #eee;align-items:center">
                <img src="${esc(it.image)}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0">
                <div style="flex:1;min-width:0">
                  <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
                    <a href="${esc(it.url)}" style="font-weight:600;font-size:13.5px;overflow-wrap:anywhere;text-decoration:none;color:inherit">${esc(it.product_title)}</a>
                    <button type="button" data-mv-cart-qty data-line="${i + 1}" data-qty="0" aria-label="Remove item" style="border:0;background:none;cursor:pointer;opacity:.6;font-size:14px;padding:2px 6px">✕</button>
                  </div>
                  ${it.variant_title ? `<div style="font-size:12px;opacity:.65">${esc(it.variant_title)}</div>` : ''}
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px">
                    <div style="display:inline-flex;align-items:center;border:1px solid #ddd;border-radius:6px">
                      <button type="button" data-mv-cart-qty data-line="${i + 1}" data-qty="${Math.max(0, it.quantity - 1)}" aria-label="Decrease quantity" style="border:0;background:none;padding:4px 10px;cursor:pointer;font-size:14px">−</button>
                      <span style="min-width:24px;text-align:center;font-size:13px;font-weight:600">${it.quantity}</span>
                      <button type="button" data-mv-cart-qty data-line="${i + 1}" data-qty="${it.quantity + 1}" aria-label="Increase quantity" style="border:0;background:none;padding:4px 10px;cursor:pointer;font-size:14px">+</button>
                    </div>
                    <strong style="font-size:13px">${esc(money(it.line_price_idr))}</strong>
                  </div>
                </div>
              </div>`).join('')}
          </div>
        </div>
        <div class="${state.item_count === 0 ? 'hidden' : ''} drawer__footer" style="padding:14px 16px;border-top:1px solid #e5e5e5;background:#fff">
          <div class="flex justify-between items-center mb-3"><span>Subtotal</span><strong>${esc(money(state.total_price_idr))}</strong></div>
          <button type="button" class="btn btn--primary w-full" style="min-height:44px" data-mv-checkout>Checkout (${state.item_count})</button>
        </div>
      </div>`;
    return { 'sections--19692154126565__cart-drawer': html };
  }

  const origFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const urlStr = typeof input === 'string' ? input : input.url || '';
    const u = new URL(urlStr, location.origin);
    const p = u.pathname.replace(BASE, '');
    if (p === '/cart.js' || p === '/cart.json' || (p === '/cart' && String((init.headers && (init.headers.Accept || init.headers.accept)) || '').includes('json'))) {
      return new Response(JSON.stringify(await buildCartState()), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (p === '/cart/add' || p === '/cart/add.js') {
      let body = {};
      const rawBody = init.body ?? (input instanceof Request ? await input.clone().text().catch(() => '') : '');
      if (rawBody instanceof FormData) body = Object.fromEntries(rawBody.entries());
      else if (typeof rawBody === 'string' && rawBody) { try { body = JSON.parse(rawBody); } catch { body = Object.fromEntries(new URLSearchParams(rawBody).entries()); } }
      const reqs = Array.isArray(body.items) ? body.items : [{ id: body.id, quantity: body.quantity || 1 }];
      const cur = getCart();
      for (const r of reqs) {
        if (!r.id) continue;
        const hit = cur.find(x => String(x.id) === String(r.id));
        if (hit) hit.qty += Math.max(1, Number(r.quantity || 1));
        else cur.push({ id: String(r.id), qty: Math.max(1, Number(r.quantity || 1)) });
      }
      saveCart(cur);
      const stData = await buildCartState();
      refreshBadge();
      const first = stData.items[0] || {};
      return new Response(JSON.stringify({ ...first, ...stData, sections: renderDrawer(stData) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (p === '/cart/change' || p === '/cart/change.js') {
      let body = {};
      const rawBody = init.body ?? (input instanceof Request ? await input.clone().text().catch(() => '') : '');
      if (rawBody instanceof FormData) body = Object.fromEntries(rawBody.entries());
      else if (typeof rawBody === 'string' && rawBody) { try { body = JSON.parse(rawBody); } catch { body = Object.fromEntries(new URLSearchParams(rawBody).entries()); } }
      const cur = getCart();
      const line = Number(body.line);
      const qty = Math.max(0, Math.floor(Number(body.quantity ?? 0)));
      if (Number.isFinite(line) && line >= 1 && line <= cur.length) {
        if (qty === 0) cur.splice(line - 1, 1);
        else cur[line - 1].qty = qty;
        saveCart(cur);
      }
      const stData = await buildCartState();
      refreshBadge();
      return new Response(JSON.stringify({ ...stData, sections: renderDrawer(stData) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (p === '/cart/update' || p === '/cart/update.js') {
      const stData = await buildCartState();
      return new Response(JSON.stringify({ ...stData, sections: renderDrawer(stData) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (p === '/cart/clear.js') {
      saveCart([]);
      refreshBadge();
      return new Response(JSON.stringify(await buildCartState()), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const qvMatch = p.match(/^\/products\/([^/.]+?)\/?$/);
    if (qvMatch && u.searchParams.has('section_id')) {
      const cat = await loadCatalog();
      const prod = cat.find(x => x.handle === qvMatch[1]) || cat[0];
      const vars = prod?.variants || [];
      const first = vars[0];
      const priceIdr = Math.max(5000, Math.round(((Number(first?.price_cents) || 999) / 100) * 15000 / 500) * 500);
      const opts = vars.map(v => {
        const vp = Math.max(5000, Math.round(((Number(v.price_cents) || 999) / 100) * 15000 / 500) * 500);
        return `<option value="${esc(v.shopify_variant_id)}">${esc(v.title === 'Default Title' ? 'Standard' : v.title)} — ${esc(money(vp))}</option>`;
      }).join('');
      const qvHtml = `<!DOCTYPE html><html><body><div class="shopify-section"><div class="quick-view__content p-4"><div class="flex flex-col gap-4">
        <div style="border-radius:12px;overflow:hidden;background:#f5f5f5;aspect-ratio:1/1;max-height:280px"><img src="${BASE}${esc(prod?.image || '')}" alt="${esc(prod?.title || '')}" style="width:100%;height:100%;object-fit:cover"></div>
        <div>
          <span style="font-size:11px;text-transform:uppercase;color:#666">${esc(S.name)} · ${esc(prod?.category || '')}</span>
          <h2 class="h3 mt-1 mb-2">${esc(prod?.title || '')}</h2>
          <div class="text-lg font-bold mb-2">${esc(money(priceIdr))}</div>
          <p class="text-sm opacity-80 mb-3">${esc(prod?.description || '')}</p>
          <form method="post" action="${BASE}/cart/add" data-type="add-to-cart-form" class="flex flex-col gap-3">
            ${vars.length > 1 ? `<select name="id" class="form-control form-control--select">${opts}</select>` : `<input type="hidden" name="id" value="${esc(first?.shopify_variant_id || '')}">`}
            <div class="flex gap-2 items-center"><input type="number" name="quantity" value="1" min="1" class="form-control" style="width:80px"><button type="submit" name="add" class="btn btn--primary flex-1">Add to cart</button></div>
          </form>
        </div></div></div></div></body></html>`;
      return new Response(qvHtml, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    if (p === '/search/suggest') {
      const q = (u.searchParams.get('q') || '').trim().toLowerCase();
      const cat = await loadCatalog();
      const hits = q ? cat.filter(x => x.title.toLowerCase().includes(q) || (x.category || '').toLowerCase().includes(q)).slice(0, 8) : [];
      const cards = hits.map(x => `<a href="${BASE}/products/${esc(x.handle)}" style="display:flex;align-items:center;gap:12px;padding:8px;border-bottom:1px solid #eee;text-decoration:none;color:inherit"><img src="${BASE}${esc(x.image)}" style="width:44px;height:44px;object-fit:cover;border-radius:6px"><div><div style="font-weight:600;font-size:13px">${esc(x.title)}</div><div style="font-size:12px;opacity:.7">${esc(x.category)}</div></div></a>`).join('');
      return new Response(`<!DOCTYPE html><html><body><div id="PredictiveSearchResults-sections--19692152914149__header"><div data-total-results="${hits.length}" style="padding:12px">${cards || 'No products found.'}</div></div></body></html>`, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    return origFetch(input, init);
  };

  function rebrandDom() {
    document.title = S.name + ' — Storefront';
    document.querySelectorAll('.announcement-bar__text, .announcement-bar__message p').forEach(el => { el.textContent = S.announcement; });
    const hLogo = document.querySelector('a.header__logo--image');
    if (hLogo) {
      hLogo.className = 'h3 relative flex header__logo--text mv-brand-logo';
      hLogo.innerHTML = `<span class="mv-brand-mark">${S.ini}</span><span class="mv-brand-text">${esc(S.name)}</span>`;
    }
    const fWrap = document.querySelector('.footer-image-box__image');
    if (fWrap) {
      fWrap.classList.add('mv-footer-logo-wrap');
      fWrap.innerHTML = `<span class="mv-brand-logo"><span class="mv-brand-mark">${S.ini}</span><span class="mv-brand-text">${esc(S.name)}</span></span>`;
    }
    const copy = document.querySelector('.footer__copyright-content');
    if (copy) copy.innerHTML = `&copy; 2026 <a class="link-underline" href="${BASE}/">${esc(S.name)}</a>.`;
  }

  async function refreshBadge() {
    const stData = await buildCartState();
    const el = document.getElementById('mv-fab-cnt');
    if (el) el.textContent = String(stData.item_count);
    document.querySelectorAll('cart-count').forEach(cc => { cc.textContent = String(stData.item_count); cc.hidden = stData.item_count === 0; });
  }

  function mountBar() {
    if (document.getElementById('mv-fab')) return;
    const fab = document.createElement('div');
    fab.id = 'mv-fab';
    fab.className = 'mv-fab';
    fab.innerHTML = `
      <select id="mv-store-sel" aria-label="Switch store">
        <option value="tukupack" ${S.slug === 'tukupack' ? 'selected' : ''}>TukuPack</option>
        <option value="anekafood" ${S.slug === 'anekafood' ? 'selected' : ''}>Anekafood Packaging</option>
      </select>
      <button type="button" class="mv-chk" id="mv-open-chk">Checkout (<span id="mv-fab-cnt">0</span>)</button>
      <a href="${BASE}/preview.html">Preview</a>
    `;
    document.body.appendChild(fab);
    document.getElementById('mv-store-sel').onchange = e => {
      const u = new URL(location.href);
      u.searchParams.set('store', e.target.value);
      location.href = u.toString();
    };
    document.getElementById('mv-open-chk').onclick = openCheckout;
  }

  function openModalShell(title) {
    let back = document.getElementById('mv-modal-backdrop');
    if (!back) {
      back = document.createElement('div');
      back.id = 'mv-modal-backdrop';
      back.className = 'mv-modal-backdrop';
      back.innerHTML = `<div class="mv-modal"><div class="mv-modal-head"><strong id="mv-modal-title"></strong><button type="button" id="mv-close-modal" aria-label="Close" style="border:1px solid #ddd;background:#fff;border-radius:999px;min-width:44px;min-height:44px;cursor:pointer;font-size:16px">✕</button></div><div class="mv-modal-body" id="mv-modal-body"></div></div>`;
      document.body.appendChild(back);
      document.getElementById('mv-close-modal').onclick = () => { back.hidden = true; };
      back.addEventListener('click', ev => { if (ev.target === back) back.hidden = true; });
    }
    document.getElementById('mv-modal-title').textContent = title;
    back.hidden = false;
    return document.getElementById('mv-modal-body');
  }

  async function openProductModal(handle) {
    const body = openModalShell(S.name + ' — Product');
    body.innerHTML = '<div style="padding:20px;text-align:center">Loading product...</div>';
    const cat = await loadCatalog();
    const prod = cat.find(x => x.handle === handle) || cat[0];
    if (!prod) { body.innerHTML = '<div class="mv-alert mv-alert-err">Product not found.</div>'; return; }
    const vars = prod.variants || [];
    const first = vars[0];
    const priceIdr = itemPriceIdr(first);
    const opts = vars.map(v => `<option value="${esc(v.shopify_variant_id)}">${esc(v.title === 'Default Title' ? 'Standard' : v.title)} — ${esc(money(itemPriceIdr(v)))}</option>`).join('');
    body.innerHTML = `
      <div style="display:grid;gap:16px">
        <div style="border-radius:12px;overflow:hidden;background:#f5f5f5;aspect-ratio:16/10;max-height:260px">
          <img src="${BASE}${esc(prod.image || '')}" alt="${esc(prod.title)}" style="width:100%;height:100%;object-fit:cover">
        </div>
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;opacity:.65">${esc(S.name)} · ${esc(prod.category || 'Catalog')}</div>
          <h3 style="margin:4px 0 8px;font-size:20px;font-weight:700">${esc(prod.title)}</h3>
          <div style="font-size:18px;font-weight:700;color:${S.primary};margin-bottom:8px">${esc(money(priceIdr))}</div>
          <p style="font-size:13.5px;opacity:.8;margin-bottom:14px">${esc(prod.description || prod.title)}</p>
          <form method="post" action="${BASE}/cart/add" data-type="add-to-cart-form" style="display:flex;flex-direction:column;gap:10px">
            ${vars.length > 1 ? `<select name="id" class="form-control form-control--select">${opts}</select>` : `<input type="hidden" name="id" value="${esc(first?.shopify_variant_id || '')}">`}
            <div style="display:flex;gap:8px;align-items:center">
              <input type="number" name="quantity" value="1" min="1" class="form-control" style="width:84px">
              <button type="submit" name="add" class="mv-btn-primary" style="flex:1">Add to cart</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  function renderCatalogGrid(items, emptyMsg) {
    if (!items.length) return `<div class="mv-alert mv-alert-err">${esc(emptyMsg)}</div>`;
    return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:12px">
      ${items.map(p => {
        const vr = p.variants?.[0];
        const price = itemPriceIdr(vr);
        return `<div style="border:1px solid #eee;border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px;background:#fff">
          <a href="${BASE}/products/${esc(p.handle)}" style="display:block;aspect-ratio:1/1;border-radius:8px;overflow:hidden;background:#f5f5f5">
            <img src="${BASE}${esc(p.image || '')}" alt="${esc(p.title)}" style="width:100%;height:100%;object-fit:cover">
          </a>
          <div style="font-size:11px;opacity:.65">${esc(p.category || '')}</div>
          <a href="${BASE}/products/${esc(p.handle)}" style="font-weight:600;font-size:13px;line-height:1.3;text-decoration:none;color:inherit;flex:1">${esc(p.title)}</a>
          <div style="font-weight:700;font-size:13.5px;color:${S.primary}">${esc(money(price))}</div>
          <form method="post" action="${BASE}/cart/add" style="margin:0">
            <input type="hidden" name="id" value="${esc(vr?.shopify_variant_id || '')}">
            <input type="hidden" name="quantity" value="1">
            <button type="submit" class="mv-btn-primary" style="width:100%;padding:8px;font-size:12.5px">Add to cart</button>
          </form>
        </div>`;
      }).join('')}
    </div>`;
  }

  async function openCollectionModal(colSlug) {
    const label = colSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const body = openModalShell(`${S.name} — ${label}`);
    body.innerHTML = '<div style="padding:20px;text-align:center">Loading collection...</div>';
    const cat = await loadCatalog();
    const terms = colSlug.toLowerCase().split('-').filter(w => w.length > 2 && w !== 'new');
    let hits = cat.filter(p => {
      const hay = `${p.title} ${p.category || ''} ${p.description || ''}`.toLowerCase();
      return terms.some(t => hay.includes(t.replace(/s$/, '')));
    });
    if (!hits.length) hits = cat.slice(0, 12);
    body.innerHTML = `<div style="font-size:12.5px;opacity:.7;margin-bottom:10px">Showing ${hits.length} items for <strong>${esc(label)}</strong></div>` + renderCatalogGrid(hits, 'No products in this collection.');
  }

  async function openSearchModal(query) {
    const q = (query || '').trim();
    const body = openModalShell(`Search: "${q || 'All products'}"`);
    body.innerHTML = '<div style="padding:20px;text-align:center">Searching...</div>';
    const cat = await loadCatalog();
    const ql = q.toLowerCase();
    const hits = ql ? cat.filter(p => `${p.title} ${p.category || ''} ${p.description || ''}`.toLowerCase().includes(ql)) : cat.slice(0, 16);
    body.innerHTML = `
      <form data-mv-search-inline style="display:flex;gap:8px;margin-bottom:14px">
        <input type="search" value="${esc(q)}" placeholder="Search products..." class="form-control" style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:8px">
        <button type="submit" class="mv-btn-primary">Search</button>
      </form>
      ${renderCatalogGrid(hits.slice(0, 24), 'No products matched "' + q + '".')}`;
    body.querySelector('[data-mv-search-inline]').onsubmit = ev => {
      ev.preventDefault();
      openSearchModal(ev.target.querySelector('input').value);
    };
  }

  function openPolicyModal(policyPath) {
    const isPrivacy = policyPath.includes('privacy');
    const body = openModalShell(S.name + ' — ' + (isPrivacy ? 'Privacy Policy' : 'Terms of Service'));
    body.innerHTML = isPrivacy
      ? `<p><strong>${esc(S.name)}</strong> stores cart items locally in your browser (<code>localStorage</code>) for this interactive GitHub Pages demo. No personal payment details are transmitted.</p>`
      : `<p>Welcome to <strong>${esc(S.name)}</strong>. Prices shown are in IDR (Rp). Demo orders placed on GitHub Pages are simulated locally; connect the Netlify + Supabase backend for live order processing.</p>`;
  }

  async function openCheckout() {
    const body = openModalShell(`${S.name} — Demo Checkout`);
    const stData = await buildCartState();
    if (!stData.items.length) {
      body.innerHTML = '<div class="mv-alert mv-alert-err">Your cart is empty. Add any product from the storefront first.</div>';
      return;
    }
    let shipFee = 0;
    let discount = 0;
    const renderCheckout = () => {
      const coupon = (document.getElementById('mv-coupon')?.value || '').trim().toUpperCase();
      discount = coupon === 'WELCOME10' ? Math.round(stData.total_price_idr * 0.1) : coupon === 'FIVEK' ? Math.min(5000, stData.total_price_idr) : 0;
      const grand = Math.max(0, stData.total_price_idr - discount + shipFee);
      const qBox = document.getElementById('mv-chk-summary');
      if (qBox) {
        qBox.innerHTML = `
          ${stData.items.map(i => `<div class="mv-row"><span>${i.quantity}× ${esc(i.product_title)}</span><strong>${esc(money(i.line_price_idr))}</strong></div>`).join('')}
          <hr style="border:0;border-top:1px solid #ddd;margin:8px 0">
          <div class="mv-row"><span>Subtotal</span><span>${esc(money(stData.total_price_idr))}</span></div>
          ${discount ? `<div class="mv-row" style="color:#15803d"><span>Coupon (${esc(coupon)})</span><span>-${esc(money(discount))}</span></div>` : ''}
          <div class="mv-row"><span>Shipping</span><span>${shipFee ? esc(money(shipFee)) : 'Free (Pickup)'}</span></div>
          <div class="mv-row" style="font-size:16px;font-weight:700;margin-top:4px"><span>Total</span><span>${esc(money(grand))}</span></div>`;
      }
    };
    body.innerHTML = `
      <div class="mv-quote-box" id="mv-chk-summary"></div>
      <div class="mv-grid-2">
        <div class="mv-field"><label>Customer Name</label><input id="mv-name" value="Budi Santoso"></div>
        <div class="mv-field"><label>WhatsApp</label><input id="mv-phone" value="081234567890"></div>
      </div>
      <div class="mv-field"><label>Delivery Address</label><input id="mv-addr" value="Jl. Kemang Raya No. 20, Jakarta Selatan"></div>
      <div class="mv-grid-2">
        <div class="mv-field"><label>Delivery Method</label>
          <select id="mv-ship"><option value="0">Store Pickup (Free)</option><option value="12000">Store Courier (Rp 12.000)</option></select>
        </div>
        <div class="mv-field"><label>Coupon Code</label><input id="mv-coupon" placeholder="Try WELCOME10 or FIVEK"></div>
      </div>
      <button type="button" class="mv-btn-primary" id="mv-place">Place Demo Order</button>
    `;
    renderCheckout();
    document.getElementById('mv-ship').onchange = e => { shipFee = Number(e.target.value || 0); renderCheckout(); };
    document.getElementById('mv-coupon').oninput = renderCheckout;
    document.getElementById('mv-place').onclick = () => {
      const ordNo = 'ORD-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      saveCart([]);
      refreshBadge();
      body.innerHTML = `<div class="mv-alert mv-alert-ok">Demo order <strong>${ordNo}</strong> placed for <strong>${esc(S.name)}</strong>! (Static GitHub Pages demo)</div>`;
    };
  }

  function showToast(msg) {
    let t = document.getElementById('mv-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'mv-toast';
      t.style.cssText = 'position:fixed;left:50%;bottom:76px;transform:translateX(-50%);background:#111;color:#fff;padding:10px 18px;border-radius:999px;font:600 13px Poppins,sans-serif;z-index:999999;box-shadow:0 8px 24px rgba(0,0,0,.25);pointer-events:none;transition:opacity .2s';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._tm);
    t._tm = setTimeout(() => { t.style.opacity = '0'; }, 2200);
  }

  function openCartDrawer(data) {
    const drawer = document.querySelector('cart-drawer');
    if (drawer) {
      const target = drawer.querySelector('#CartDrawer-sections--19692154126565__cart-drawer');
      if (target && data.sections?.['sections--19692154126565__cart-drawer']) {
        target.outerHTML = data.sections['sections--19692154126565__cart-drawer'];
      }
      drawer.removeAttribute('hidden');
      if (drawer.show) drawer.show(document.body);
      drawer.setAttribute('open', '');
    }
  }

  // Intercept ALL form submits (/cart/add, /search, /contact, /localization, /cart) so static GitHub Pages never 404/405s
  document.addEventListener('submit', async e => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    const act = form.getAttribute('action') || '';
    if (act.includes('/cart/add')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const fd = new FormData(form);
      const r = await fetch(BASE + '/cart/add.js', { method: 'POST', body: fd });
      const data = await r.json();
      const qv = form.closest('quick-view-modal');
      if (qv) {
        if (qv.hide) qv.hide();
        qv.removeAttribute('open');
        qv.setAttribute('hidden', '');
      }
      openCartDrawer(data);
      showToast('Added to cart (' + (data.item_count || 1) + ')');
      return;
    }
    if (act === '/search' || act === BASE + '/search') {
      e.preventDefault();
      e.stopImmediatePropagation();
      const q = form.querySelector('input[name="q"]')?.value || '';
      openSearchModal(q);
      return;
    }
    if (act.startsWith('/contact') || act.startsWith(BASE + '/contact')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const email = form.querySelector('input[type="email"]')?.value?.trim() || '';
      if (email) {
        const subs = JSON.parse(localStorage.getItem('mv_gh_subs') || '[]');
        if (!subs.includes(email)) subs.push(email);
        localStorage.setItem('mv_gh_subs', JSON.stringify(subs));
      }
      form.reset();
      showToast('Subscribed to ' + S.name + ' updates!');
      return;
    }
    if (act === '/localization' || act === BASE + '/localization') {
      e.preventDefault();
      e.stopImmediatePropagation();
      showToast('Currency: IDR (Rp)');
      return;
    }
    if (act === '/cart' || act === BASE + '/cart') {
      e.preventDefault();
      e.stopImmediatePropagation();
      openCheckout();
    }
  }, true);

  document.addEventListener('click', async e => {
    const qtyBtn = e.target.closest('[data-mv-cart-qty]');
    if (qtyBtn) {
      e.preventDefault();
      const line = Number(qtyBtn.dataset.line);
      const qty = Number(qtyBtn.dataset.qty);
      const r = await fetch(BASE + '/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line, quantity: qty })
      });
      const data = await r.json();
      openCartDrawer(data);
      return;
    }
    if (e.target.closest('[data-mv-checkout], button[name="checkout"], a[href*="/checkout"]')) {
      e.preventDefault();
      openCheckout();
      return;
    }
    const link = e.target.closest('a[href]');
    if (!link) return;
    const rawHref = link.getAttribute('href') || '';
    if (rawHref === '#' && !link.hasAttribute('aria-controls') && !link.hasAttribute('data-drawer-trigger')) {
      e.preventDefault();
      return;
    }
    if (rawHref.startsWith('http') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('#')) return;
    const u = new URL(link.href, location.origin);
    const p = u.pathname.replace(BASE, '');
    if (p === '/search') {
      e.preventDefault();
      openSearchModal(u.searchParams.get('q') || '');
      return;
    }
    if (p.startsWith('/policies/')) {
      e.preventDefault();
      openPolicyModal(p);
      return;
    }
    const prodMatch = p.match(/^\/products\/([^/]+?)\/?$/);
    if (prodMatch && !EXISTING_PRODUCTS.has(prodMatch[1])) {
      e.preventDefault();
      openProductModal(prodMatch[1]);
      return;
    }
    const colMatch = p.match(/^\/collections\/([^/]+?)\/?$/);
    if (colMatch && !EXISTING_COLLECTIONS.has(colMatch[1])) {
      e.preventDefault();
      openCollectionModal(colMatch[1]);
    }
  });

  document.addEventListener('DOMContentLoaded', async () => {
    rebrandDom();
    mountBar();
    refreshBadge();
    const stData = await buildCartState();
    const target = document.querySelector('#CartDrawer-sections--19692154126565__cart-drawer');
    if (target) target.outerHTML = renderDrawer(stData)['sections--19692154126565__cart-drawer'];
  });
})();
