(() => {
  const hasServerCtx = Boolean(window.__MV_CONTEXT__);
  function resolveClientSlug() {
    const pm = location.pathname.match(/^\/(tukupack|anekafood)(\/|$)/i);
    const qs = new URLSearchParams(location.search).get('store');
    const explicit = (pm && pm[1].toLowerCase()) || (qs && qs.trim().toLowerCase()) || '';
    if (explicit) { try { localStorage.setItem('mv_store', explicit); } catch {} return explicit; }
    try { const saved = localStorage.getItem('mv_store'); if (saved) return saved; } catch {}
    const host = location.hostname.toLowerCase();
    const parts = host.split('.');
    if (parts.length >= 3 && !host.endsWith('.netlify.app') && host !== 'localhost') return parts[0];
    return 'tukupack';
  }
  const initSlug = hasServerCtx ? window.__MV_CONTEXT__.tenant.slug : resolveClientSlug();
  const ctx = window.__MV_CONTEXT__ || {
    tenant: {
      slug: initSlug,
      name: initSlug === 'anekafood' ? 'Anekafood Packaging' : 'TukuPack',
      theme: initSlug === 'anekafood'
        ? { primary: '#E60000', accent: '#FFDA1A', background: '#F5F5F5' }
        : { primary: '#0058A3', accent: '#FFDA1A', background: '#F4F6F9' },
      settings: {}
    },
    stores: [
      { slug: 'tukupack', name: 'TukuPack' },
      { slug: 'anekafood', name: 'Anekafood Packaging' }
    ],
    warehouses: []
  };
  const tenant = ctx.tenant;
  const warehouses = ctx.warehouses || [];
  const money = n => 'Rp ' + Math.round(Number(n || 0)).toLocaleString('id-ID');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  let STORE_INFO = null;
  let LIVE_MENU = [];
  let ACTIVE_CAT = 'All';

  function hexToRgb(hex, fb) {
    const m = String(hex || '').trim().match(/^#([0-9a-f]{6})$/i);
    if (!m) return fb;
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }

  function applyClientThemeCss() {
    if (hasServerCtx && document.getElementById('mv-tenant-theme')) return;
    const th = tenant.theme || {};
    const isAneka = tenant.slug === 'anekafood';
    const pHex = th.primary || (isAneka ? '#E60000' : '#0058A3');
    const aHex = th.accent || '#FFDA1A';
    const bHex = th.background || (isAneka ? '#F5F5F5' : '#F4F6F9');
    const pRgb = hexToRgb(pHex, isAneka ? '230,0,0' : '0,88,163');
    const aRgb = hexToRgb(aHex, '255,218,26');
    const bRgb = hexToRgb(bHex, '244,246,249');
    const aInk = isAneka ? '138,0,0' : '0,56,107';
    const invBg = isAneka ? '168,0,0' : '0,62,117';
    let st = document.getElementById('mv-tenant-theme');
    if (!st) { st = document.createElement('style'); st.id = 'mv-tenant-theme'; document.head.appendChild(st); }
    st.textContent = `
      :root { --mv-primary:${pHex}; --mv-accent:${aHex}; --color-badge-sale:${pHex}; --color-badge-hot:${pHex}; --color-badge-new:${aHex}; --color-badge-new-text:#000; }
      .color-scheme-1,.color-scheme-info { --color-background:${bRgb}; --color-primary:${pRgb}; --color-button:${pRgb}; --color-button-text:255,255,255; --color-product-price-sale:${pRgb}; --color-progress-bar:${pRgb}; }
      .color-scheme-2 { --color-primary:${pRgb}; --color-button:${pRgb}; --color-button-text:255,255,255; --color-product-price-sale:${pRgb}; --color-progress-bar:${pRgb}; }
      .color-scheme-inverse { --color-background:${invBg}; --color-secondary-background:${pRgb}; --color-primary:${aRgb}; --color-button:${aRgb}; --color-button-text:${aInk}; --color-border:${pRgb}; }
      .color-scheme-3,.color-scheme-4,.color-scheme-7 { --color-background:${pRgb}; --color-primary:${aRgb}; --color-button:${aRgb}; --color-button-text:${aInk}; --color-secondary-button:${pRgb}; --color-secondary-button-border:${aRgb}; --color-secondary-button-text:255,255,255; }
      .header .cart-count, cart-count { background-color:${aHex}!important; color:#000!important; }
      .announcement-bar.color-scheme-inverse { background-color:${pHex}!important; color:#fff!important; }
      .mv-brand-logo { display:inline-flex; align-items:center; gap:8px; max-width:100%; min-width:0; text-decoration:none; color:inherit; font-family:Poppins,sans-serif; font-weight:800; }
      .mv-brand-mark { display:inline-grid; place-items:center; width:32px; height:32px; border-radius:8px; background:${pHex}; color:${aHex}; font-size:15px; font-weight:800; flex-shrink:0; }
      .mv-brand-text { font-size:clamp(13.5px,2.2vw,18px); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .footer .mv-brand-mark { background:${aHex}; color:${pHex}; }
      .footer .mv-brand-text { color:#fff; font-size:19px; }
      .mv-fab { background:${pHex}; }
      .mv-fab .mv-chk { background:${aHex}; border-color:${aHex}; color:#000; }
    `;
  }

  function applyBranding() {
    applyClientThemeCss();
    const ann = tenant.theme?.announcement;
    if (ann) {
      document.querySelectorAll('.announcement-bar__text, .announcement-bar__message p').forEach(el => {
        el.textContent = ann;
      });
    }
    const ini = tenant.slug === 'anekafood' ? 'AP' : tenant.name.slice(0, 2).toUpperCase();
    const hLogo = document.querySelector('a.header__logo--image, a.header__logo--text');
    if (hLogo) {
      hLogo.setAttribute('href', `/${tenant.slug}`);
      hLogo.className = 'h3 relative flex header__logo--text mv-brand-logo';
      hLogo.innerHTML = `<span class="mv-brand-mark">${esc(ini)}</span><span class="mv-brand-text">${esc(tenant.name)}</span>`;
    }
    const fWrap = document.querySelector('.footer-image-box__image');
    if (fWrap && !fWrap.classList.contains('mv-footer-logo-wrap')) {
      fWrap.classList.add('mv-footer-logo-wrap');
      fWrap.innerHTML = `<span class="mv-brand-logo"><span class="mv-brand-mark">${esc(ini)}</span><span class="mv-brand-text">${esc(tenant.name)}</span></span>`;
    }
    const copy = document.querySelector('.footer__copyright-content');
    if (copy && !hasServerCtx) copy.innerHTML = `&copy; 2026 <a class="link-underline" href="/${esc(tenant.slug)}">${esc(tenant.name)}</a>.`;
    document.title = `${tenant.name} — Storefront`;
  }

  function mountFab() {
    if (document.getElementById('mv-fab')) return;
    const fab = document.createElement('div');
    fab.id = 'mv-fab';
    fab.className = 'mv-fab';
    const opts = (ctx.stores || []).map(s => `<option value="${esc(s.slug)}" ${s.slug === tenant.slug ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
    fab.innerHTML = `
      <select id="mv-store-sel" aria-label="Switch store">${opts}</select>
      <button type="button" id="mv-open-orders">Orders</button>
      <button type="button" class="mv-chk" id="mv-open-chk">Checkout (<span id="mv-fab-cnt">0</span>)</button>
      <a href="/admin">Admin</a>
    `;
    document.body.appendChild(fab);
    document.getElementById('mv-store-sel').addEventListener('change', e => {
      location.href = '/' + encodeURIComponent(e.target.value);
    });
    document.getElementById('mv-open-chk').addEventListener('click', openCheckout);
    document.getElementById('mv-open-orders').addEventListener('click', openOrderTracker);
  }

  async function refreshCartBadge() {
    try {
      const cart = await (await fetch('/cart.js')).json();
      const cnt = document.getElementById('mv-fab-cnt');
      if (cnt) cnt.textContent = String(cart.item_count || 0);
      document.querySelectorAll('cart-count').forEach(cc => {
        cc.textContent = String(cart.item_count || 0);
        cc.hidden = (cart.item_count || 0) === 0;
      });
      return cart;
    } catch { return null; }
  }

  function showToast(msg) {
    let t = document.getElementById('mv-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'mv-toast';
      t.className = 'mv-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(t._tm);
    t._tm = setTimeout(() => t.classList.remove('is-on'), 2200);
  }

  function openCartDrawer(data) {
    const drawer = document.querySelector('cart-drawer');
    if (!drawer) return;
    const target = drawer.querySelector('#CartDrawer-sections--19692154126565__cart-drawer');
    if (target && data.sections?.['sections--19692154126565__cart-drawer']) {
      target.outerHTML = data.sections['sections--19692154126565__cart-drawer'];
    }
    drawer.removeAttribute('hidden');
    if (drawer.show) drawer.show(document.body);
    drawer.setAttribute('open', '');
  }

  async function addVariantToCart(variantId, qty = 1) {
    const r = await fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: qty, sections: ['sections--19692154126565__cart-drawer'] })
    });
    const data = await r.json();
    if (!r.ok) { showToast(data.message || 'Could not add to cart'); return; }
    await refreshCartBadge();
    openCartDrawer(data);
    showToast(`Added to cart (${data.item_count || 1})`);
  }

  function ensureModal(title) {
    let el = document.getElementById('mv-modal-backdrop');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mv-modal-backdrop';
      el.className = 'mv-modal-backdrop';
      el.hidden = true;
      el.innerHTML = `
        <div class="mv-modal" role="dialog" aria-modal="true">
          <div class="mv-modal-head">
            <strong id="mv-modal-title"></strong>
            <button type="button" id="mv-close-modal" aria-label="Close" style="border:1px solid #ddd;background:#fff;border-radius:999px;min-width:44px;min-height:44px;padding:4px 12px;cursor:pointer;font-size:16px">✕</button>
          </div>
          <div class="mv-modal-body" id="mv-modal-body"></div>
        </div>`;
      document.body.appendChild(el);
      document.getElementById('mv-close-modal').onclick = () => { el.hidden = true; };
    }
    document.getElementById('mv-modal-title').textContent = title;
    el.hidden = false;
    return document.getElementById('mv-modal-body');
  }

  // ── Live Catalog synced with /api/menu (shows products added in /admin) ──
  async function loadLiveMenu() {
    try {
      const reqs = [
        fetch('/api/store', { headers: { 'x-tenant': tenant.slug } }),
        fetch('/api/menu', { headers: { 'x-tenant': tenant.slug } })
      ];
      if (!hasServerCtx) reqs.push(fetch('/api/directory'));
      const [stRes, menuRes, dirRes] = await Promise.all(reqs);
      if (stRes.ok) {
        STORE_INFO = await stRes.json();
        if (!hasServerCtx && STORE_INFO.store) {
          tenant.name = STORE_INFO.store.name || tenant.name;
          tenant.theme = { ...tenant.theme, ...(STORE_INFO.theme || {}) };
          applyBranding();
        }
      }
      if (dirRes?.ok) {
        const dir = await dirRes.json();
        if (dir.stores?.length) {
          ctx.stores = dir.stores;
          const sel = document.getElementById('mv-store-sel');
          if (sel) sel.innerHTML = dir.stores.map(s => `<option value="${esc(s.slug)}" ${s.slug === tenant.slug ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
        }
      }
      if (menuRes.ok) LIVE_MENU = (await menuRes.json()).products || [];
      renderLiveCatalog();
    } catch {}
  }

  function openProductModal(prod) {
    const body = ensureModal(prod.name);
    const vs = prod.variants || [];
    const totalAvail = vs.reduce((s, v) => s + Math.max(v.available || 0, 0), 0);
    body.innerHTML = `
      <div class="mv-qv">
        <img src="${esc(prod.image || '/cdn/shop/files/trove-logo.jpg')}" alt="${esc(prod.name)}">
        <div>
          <div style="font-size:12px;text-transform:uppercase;color:#666;margin-bottom:4px">${esc(tenant.name)} · ${esc(prod.category || 'General')}</div>
          <p style="font-size:14px;color:#444;line-height:1.5;margin:0 0 12px">${esc(prod.description || '')}</p>
          <div class="mv-field">
            <label>Option</label>
            <select id="mv-qv-var">${vs.map(v => `<option value="${esc(v.id)}" ${v.available <= 0 ? 'disabled' : ''}>${esc(v.name)} — ${esc(money(v.price))} (${v.available > 0 ? v.available + ' avail' : 'Sold out'})</option>`).join('')}</select>
          </div>
          <div class="mv-field">
            <label>Quantity</label>
            <input id="mv-qv-qty" type="number" min="1" value="1">
          </div>
          <button type="button" class="mv-btn-primary" id="mv-qv-add" style="width:100%" ${totalAvail <= 0 ? 'disabled' : ''}>${totalAvail > 0 ? 'Add to Cart' : 'Out of Stock'}</button>
        </div>
      </div>`;
    document.getElementById('mv-qv-add').onclick = async () => {
      const vid = document.getElementById('mv-qv-var').value;
      const qty = Math.max(1, Number(document.getElementById('mv-qv-qty').value || 1));
      document.getElementById('mv-modal-backdrop').hidden = true;
      await addVariantToCart(vid, qty);
    };
  }

  function renderLiveCatalog() {
    if (!LIVE_MENU.length) return;
    let host = document.getElementById('mv-live-catalog');
    if (!host) {
      host = document.createElement('section');
      host.id = 'mv-live-catalog';
      host.className = 'mv-live-sec page-width page-width--fixed';
      const main = document.querySelector('main#MainContent') || document.querySelector('main') || document.body;
      main.appendChild(host);
    }
    const cats = ['All', ...new Set(LIVE_MENU.map(p => p.category || 'General'))];
    const q = (document.getElementById('mv-live-q')?.value || '').trim().toLowerCase();
    const filtered = LIVE_MENU.filter(p => {
      const catOk = ACTIVE_CAT === 'All' || (p.category || 'General') === ACTIVE_CAT;
      const qOk = !q || p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q);
      return catOk && qOk;
    });

    host.innerHTML = `
      <div class="mv-live-head">
        <div>
          <h2 class="h2" style="margin:0">${esc(tenant.name)} Live Catalog (${filtered.length})</h2>
          <p style="margin:4px 0 0;font-size:13.5px;color:#555">Synced in real time with Back Office inventory &amp; multi-warehouse stock</p>
        </div>
        <input id="mv-live-q" class="mv-live-search" type="search" value="${esc(q)}" placeholder="Filter live catalog...">
      </div>
      <div class="mv-cat-pills">
        ${cats.map(c => `<button type="button" class="mv-cat-pill ${c === ACTIVE_CAT ? 'is-on' : ''}" data-mv-cat="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
      <div class="mv-live-grid">
        ${filtered.slice(0, 24).map(p => {
          const vs = p.variants || [];
          const lo = Math.min(...vs.map(v => Number(v.price)));
          const avail = vs.reduce((s, v) => s + Math.max(v.available || 0, 0), 0);
          const firstAvail = vs.find(v => v.available > 0) || vs[0];
          const badge = avail <= 0 ? 'Sold out' : avail <= 5 ? `Only ${avail} left` : '';
          return `
            <article class="mv-card ${avail <= 0 ? 'is-out' : ''}">
              <div class="mv-card-media" data-mv-qv="${esc(p.id)}">
                <img src="${esc(p.image || '/cdn/shop/files/trove-logo.jpg')}" alt="${esc(p.name)}" loading="lazy">
                ${badge ? `<span class="mv-card-badge">${esc(badge)}</span>` : ''}
              </div>
              <div class="mv-card-body">
                <div class="mv-card-cat">${esc(p.category || 'General')}</div>
                <h3 data-mv-qv="${esc(p.id)}">${esc(p.name)}</h3>
                <div class="mv-card-price">${vs.length > 1 ? '<small>From </small>' : ''}${esc(money(lo))}</div>
                <div class="mv-card-acts">
                  <button type="button" class="mv-btn-primary" style="width:100%" ${avail <= 0 ? 'disabled' : ''} data-mv-add="${esc(firstAvail?.id || '')}">
                    ${avail > 0 ? (vs.length > 1 ? 'Choose Option' : '+ Add to Cart') : 'Sold Out'}
                  </button>
                </div>
              </div>
            </article>`;
        }).join('')}
      </div>`;

    host.querySelector('#mv-live-q').addEventListener('input', renderLiveCatalog);
    host.querySelectorAll('[data-mv-cat]').forEach(b => {
      b.onclick = () => { ACTIVE_CAT = b.dataset.mvCat; renderLiveCatalog(); };
    });
    host.querySelectorAll('[data-mv-qv]').forEach(el => {
      el.onclick = () => {
        const prod = LIVE_MENU.find(x => x.id === el.dataset.mvQv);
        if (prod) openProductModal(prod);
      };
    });
    host.querySelectorAll('[data-mv-add]').forEach(btn => {
      btn.onclick = () => {
        const card = btn.closest('.mv-card');
        const pid = card?.querySelector('[data-mv-qv]')?.dataset.mvQv;
        const prod = LIVE_MENU.find(x => x.id === pid);
        if (prod && prod.variants.length > 1) return openProductModal(prod);
        addVariantToCart(btn.dataset.mvAdd, 1);
      };
    });
  }

  // ── Full Multi-Warehouse Checkout (/api/quote + /api/checkout) ──
  async function openCheckout() {
    const body = ensureModal(`${tenant.name} — Checkout`);
    body.innerHTML = 'Loading cart...';
    const cart = await (await fetch('/cart.js')).json();
    if (!cart.items?.length) {
      body.innerHTML = '<div class="mv-alert mv-alert-err">Your cart is empty. Add any product from the storefront first.</div>';
      return;
    }
    const wh = warehouses[0] || { id: '', lat: -6.2615, lng: 106.8106 };
    const items = cart.items.map(i => ({ variant_id: i.variant_id, qty: i.quantity }));
    const payments = STORE_INFO?.payments || ['manual'];
    const payLabels = { manual: 'Bank Transfer (Manual)', midtrans: 'Midtrans (QRIS / VA / Card)', doku: 'DOKU (QRIS / VA / Card)' };

    body.innerHTML = `
      <div id="mv-chk-msg"></div>
      <div class="mv-grid-2">
        <div class="mv-field"><label>Customer Name *</label><input id="mv-name" value="Budi Santoso"></div>
        <div class="mv-field"><label>Phone / WhatsApp *</label><input id="mv-phone" value="081234567890"></div>
        <div class="mv-field"><label>Email</label><input id="mv-email" value="budi@example.com"></div>
        <div class="mv-field"><label>Fulfillment</label>
          <select id="mv-mode">
            <option value="delivery">Delivery (Nearest Warehouse)</option>
            ${STORE_INFO?.pickup !== false ? '<option value="pickup">Store / Warehouse Pickup (Free)</option>' : ''}
          </select>
        </div>
      </div>
      <div class="mv-field" id="mv-addr-wrap"><label>Delivery Address *</label><input id="mv-addr" value="Jl. Kemang Raya No. 20, Jakarta Selatan"></div>
      <div class="mv-grid-2">
        <div class="mv-field"><label>Shipping / Pickup Option</label><select id="mv-ship"></select></div>
        <div class="mv-field"><label>Payment Method</label>
          <select id="mv-pay">${payments.map(p => `<option value="${esc(p)}">${esc(payLabels[p] || p)}</option>`).join('')}</select>
        </div>
      </div>
      <div class="mv-field">
        <label>Coupon Code</label>
        <div style="display:flex;gap:8px">
          <input id="mv-coupon" placeholder="Optional (e.g. WELCOME10)" style="flex:1">
          <button type="button" id="mv-apply-cpn" class="mv-btn-secondary">Apply</button>
        </div>
      </div>
      <div class="mv-quote-box" id="mv-quote">Calculating quote...</div>
      <button type="button" class="mv-btn-primary" id="mv-place" style="width:100%">Place Order</button>`;

    let quoteData = null;
    async function loadQuote() {
      const isPickup = document.getElementById('mv-mode').value === 'pickup';
      document.getElementById('mv-addr-wrap').style.display = isPickup ? 'none' : 'flex';
      const r = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-tenant': tenant.slug },
        body: JSON.stringify({
          items,
          pickup: isPickup,
          pickup_warehouse_id: isPickup ? wh.id : undefined,
          destination: { address: document.getElementById('mv-addr').value, postal_code: '12730', lat: wh.lat, lng: wh.lng },
          coupon: document.getElementById('mv-coupon').value.trim() || undefined
        })
      });
      const q = await r.json();
      const box = document.getElementById('mv-quote');
      if (!r.ok) { box.innerHTML = `<div class="mv-alert mv-alert-err">${esc(q.message || q.error)}</div>`; return; }
      quoteData = q;
      const shipSel = document.getElementById('mv-ship');
      const prev = shipSel.value;
      shipSel.innerHTML = (q.options || []).map(o => `<option value="${esc(o.id)}">${esc(o.label)} — ${esc(money(o.fee))}${o.eta ? ' (' + esc(o.eta) + ')' : ''}</option>`).join('');
      if (prev && [...shipSel.options].some(o => o.value === prev)) shipSel.value = prev;
      renderQuoteTotals();
    }

    function renderQuoteTotals() {
      if (!quoteData) return;
      const shipId = document.getElementById('mv-ship').value;
      const opt = (quoteData.options || []).find(o => o.id === shipId) || quoteData.options?.[0] || { id: 'pickup', label: 'Pickup', fee: 0 };
      const td = quoteData.pricing?.tier_discount || 0;
      const cd = quoteData.pricing?.coupon_discount || 0;
      const total = quoteData.subtotal - td - cd + opt.fee;
      document.getElementById('mv-quote').innerHTML = `
        <div class="mv-row"><span>Fulfilled from</span><strong>${esc(quoteData.warehouse?.name || '')}</strong></div>
        <div class="mv-row"><span>Subtotal</span><span>${esc(money(quoteData.subtotal))}</span></div>
        ${td ? `<div class="mv-row" style="color:#15803d"><span>Volume/B2B Discount</span><span>-${esc(money(td))}</span></div>` : ''}
        ${cd ? `<div class="mv-row" style="color:#15803d"><span>Coupon (${esc(quoteData.pricing.coupon)})</span><span>-${esc(money(cd))}</span></div>` : ''}
        ${quoteData.pricing?.coupon_error ? `<div class="mv-alert mv-alert-err" style="margin:6px 0">${esc(quoteData.pricing.coupon_error)}</div>` : ''}
        <div class="mv-row"><span>Shipping (${esc(opt.label)})</span><span>${esc(money(opt.fee))}</span></div>
        <div class="mv-row" style="font-weight:700;font-size:16px;margin-top:6px"><span>Total</span><span>${esc(money(total))}</span></div>`;
    }

    document.getElementById('mv-mode').onchange = loadQuote;
    document.getElementById('mv-ship').onchange = renderQuoteTotals;
    document.getElementById('mv-apply-cpn').onclick = loadQuote;
    await loadQuote();

    document.getElementById('mv-place').onclick = async () => {
      const phone = document.getElementById('mv-phone').value.trim();
      const shipId = document.getElementById('mv-ship').value || quoteData?.options?.[0]?.id || 'pickup';
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-tenant': tenant.slug },
        body: JSON.stringify({
          items,
          customer: { name: document.getElementById('mv-name').value.trim(), phone, email: document.getElementById('mv-email').value.trim() },
          destination: { address: document.getElementById('mv-addr').value.trim(), postal_code: '12730', lat: wh.lat, lng: wh.lng },
          shipping_id: shipId,
          pickup_warehouse_id: shipId === 'pickup' ? wh.id : undefined,
          payment: document.getElementById('mv-pay').value,
          coupon: document.getElementById('mv-coupon').value.trim() || undefined
        })
      });
      const res = await r.json();
      if (!r.ok) {
        document.getElementById('mv-chk-msg').innerHTML = `<div class="mv-alert mv-alert-err">${esc(res.message || res.error)}</div>`;
        return;
      }
      await fetch('/cart/clear.js', { method: 'POST' });
      await refreshCartBadge();
      try {
        const hist = JSON.parse(localStorage.getItem('mv_orders_' + tenant.slug) || '[]');
        hist.unshift({ no: res.order.no, phone });
        localStorage.setItem('mv_orders_' + tenant.slug, JSON.stringify(hist.slice(0, 10)));
      } catch {}
      const bankHtml = res.manual ? `<div class="mv-quote-box"><strong>Bank Transfer:</strong> ${esc(res.manual.bank)} · ${esc(res.manual.account_no)} (${esc(res.manual.account_name)})</div>` : '';
      const payBtn = res.order.payment?.url ? `<a class="mv-btn-primary" href="${esc(res.order.payment.url)}" target="_blank" style="display:inline-block;text-decoration:none;margin-top:8px">Complete Online Payment →</a>` : '';
      body.innerHTML = `<div class="mv-alert mv-alert-ok">Order <strong>${esc(res.order.no)}</strong> placed! Total: <strong>${esc(money(res.order.total))}</strong> (Status: ${esc(res.order.status)}).</div>${bankHtml}${payBtn}`;
    };
  }

  // ── Order Tracker (/api/orders/:no?phone=...) ──
  async function openOrderTracker() {
    const body = ensureModal(`${tenant.name} — Track Order`);
    let hist = [];
    try { hist = JSON.parse(localStorage.getItem('mv_orders_' + tenant.slug) || '[]'); } catch {}
    body.innerHTML = `
      <div class="mv-grid-2">
        <div class="mv-field"><label>Order Number</label><input id="mv-tr-no" value="${esc(hist[0]?.no || '')}" placeholder="e.g. SO261122..."></div>
        <div class="mv-field"><label>Phone Number</label><input id="mv-tr-ph" value="${esc(hist[0]?.phone || '')}" placeholder="0812..."></div>
      </div>
      <button type="button" class="mv-btn-primary" id="mv-tr-go" style="width:100%">Check Order Status</button>
      <div id="mv-tr-out" style="margin-top:14px"></div>`;

    document.getElementById('mv-tr-go').onclick = async () => {
      const no = document.getElementById('mv-tr-no').value.trim();
      const ph = document.getElementById('mv-tr-ph').value.trim();
      const out = document.getElementById('mv-tr-out');
      const r = await fetch(`/api/order?no=${encodeURIComponent(no)}&phone=${encodeURIComponent(ph)}`, { headers: { 'x-tenant': tenant.slug } });
      const d = await r.json();
      if (!r.ok) { out.innerHTML = `<div class="mv-alert mv-alert-err">${esc(d.message || d.error || 'Order not found')}</div>`; return; }
      const o = d.order;
      out.innerHTML = `
        <div class="mv-quote-box">
          <div class="mv-row"><span>Order No</span><strong>${esc(o.no)}</strong></div>
          <div class="mv-row"><span>Status</span><strong>${esc(o.status)}</strong></div>
          <div class="mv-row"><span>Shipping</span><span>${esc(o.shipping?.label || '')}${o.shipping?.waybill ? ' · Waybill: ' + esc(o.shipping.waybill) : ''}</span></div>
          <div class="mv-row"><span>Total</span><strong>${esc(money(o.total))}</strong></div>
        </div>`;
    };
  }

  document.addEventListener('click', e => {
    if (e.target.closest('[data-mv-checkout], button[name="checkout"], a[href="/checkout"]')) {
      e.preventDefault();
      openCheckout();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    applyBranding();
    mountFab();
    refreshCartBadge();
    loadLiveMenu();
  });
})();
