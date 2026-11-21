(() => {
  const ctx = window.__MV_CONTEXT__ || { tenant: { slug: 'tukupack', name: 'Tukupack', theme: {} }, stores: [], warehouses: [] };
  const tenant = ctx.tenant;
  const warehouses = ctx.warehouses || [];
  const money = n => 'Rp ' + Math.round(Number(n || 0)).toLocaleString('id-ID');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function applyBranding() {
    const ann = tenant.theme?.announcement;
    if (ann) {
      document.querySelectorAll('.announcement-bar__text, .announcement-bar__message p').forEach(el => {
        el.textContent = ann;
      });
    }
    document.title = `${tenant.name} — Storefront`;
  }

  function mountFab() {
    if (!ctx.store_switcher || document.getElementById('mv-fab')) return;
    const fab = document.createElement('div');
    fab.id = 'mv-fab';
    fab.className = 'mv-fab';
    const opts = (ctx.stores || []).map(s => `<option value="${esc(s.slug)}" ${s.slug === tenant.slug ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
    fab.innerHTML = `
      <select id="mv-store-sel" aria-label="Switch store">${opts}</select>
      <button type="button" class="mv-chk" id="mv-open-chk">Checkout (<span id="mv-fab-cnt">0</span>)</button>
      <a href="/admin">Admin</a>
    `;
    document.body.appendChild(fab);
    document.getElementById('mv-store-sel').addEventListener('change', e => {
      const u = new URL(location.href);
      u.searchParams.set('store', e.target.value);
      location.href = u.toString();
    });
    document.getElementById('mv-open-chk').addEventListener('click', openCheckout);
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

  function ensureModal() {
    if (document.getElementById('mv-modal-backdrop')) return;
    const el = document.createElement('div');
    el.id = 'mv-modal-backdrop';
    el.className = 'mv-modal-backdrop';
    el.hidden = true;
    el.innerHTML = `
      <div class="mv-modal" role="dialog" aria-modal="true">
        <div class="mv-modal-head">
          <strong>${esc(tenant.name)} — Checkout</strong>
          <button type="button" id="mv-close-modal" aria-label="Close" style="border:1px solid #ddd;background:#fff;border-radius:999px;min-width:44px;min-height:44px;padding:4px 12px;cursor:pointer;font-size:16px">✕</button>
        </div>
        <div class="mv-modal-body" id="mv-modal-body"></div>
      </div>`;
    document.body.appendChild(el);
    document.getElementById('mv-close-modal').onclick = () => { el.hidden = true; };
  }

  async function openCheckout() {
    ensureModal();
    const back = document.getElementById('mv-modal-backdrop');
    const body = document.getElementById('mv-modal-body');
    back.hidden = false;
    body.innerHTML = 'Loading cart...';
    const cart = await (await fetch('/cart.js')).json();
    if (!cart.items?.length) {
      body.innerHTML = '<div class="mv-alert mv-alert-err">Your cart is empty. Add any product from the storefront first.</div>';
      return;
    }
    const wh = warehouses[0] || { lat: -6.2615, lng: 106.8106 };
    const items = cart.items.map(i => ({ variant_id: i.variant_id, qty: i.quantity }));
    body.innerHTML = `
      <div id="mv-chk-msg"></div>
      <div class="mv-grid-2">
        <div class="mv-field"><label>Customer Name *</label><input id="mv-name" value="Budi Santoso"></div>
        <div class="mv-field"><label>Phone / WhatsApp *</label><input id="mv-phone" value="081234567890"></div>
        <div class="mv-field"><label>Email</label><input id="mv-email" value="budi@example.com"></div>
        <div class="mv-field"><label>Coupon Code</label><input id="mv-coupon" placeholder="Optional (e.g. WELCOME10)"></div>
      </div>
      <div class="mv-field"><label>Delivery Address *</label><input id="mv-addr" value="Jl. Kemang Raya No. 20, Jakarta Selatan"></div>
      <div class="mv-quote-box" id="mv-quote">Calculating quote...</div>
      <div style="display:flex;justify-content:flex-end;gap:10px">
        <button type="button" class="mv-btn-primary" id="mv-place">Place Order</button>
      </div>`;

    let quoteData = null;
    async function loadQuote() {
      const r = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-tenant': tenant.slug },
        body: JSON.stringify({
          items,
          destination: { address: document.getElementById('mv-addr').value, postal_code: '12730', lat: wh.lat, lng: wh.lng },
          coupon: document.getElementById('mv-coupon').value.trim() || undefined
        })
      });
      const q = await r.json();
      const box = document.getElementById('mv-quote');
      if (!r.ok) { box.innerHTML = `<div class="mv-alert mv-alert-err">${esc(q.message || q.error)}</div>`; return; }
      quoteData = q;
      const opt = q.options?.[0] || { id: 'pickup', label: 'Pickup', fee: 0 };
      box.innerHTML = `
        <div class="mv-row"><span>Fulfilled from</span><strong>${esc(q.warehouse?.name || '')}</strong></div>
        <div class="mv-row"><span>Delivery (${esc(opt.label)})</span><span>${esc(money(opt.fee))}</span></div>
        <div class="mv-row"><span>Subtotal</span><span>${esc(money(q.subtotal))}</span></div>
        ${q.pricing?.coupon_discount ? `<div class="mv-row" style="color:#15803d"><span>Coupon (${esc(q.pricing.coupon)})</span><span>-${esc(money(q.pricing.coupon_discount))}</span></div>` : ''}
        <div class="mv-row" style="font-weight:700;font-size:16px;margin-top:6px"><span>Total</span><span>${esc(money(q.subtotal - (q.pricing?.tier_discount || 0) - (q.pricing?.coupon_discount || 0) + opt.fee))}</span></div>`;
    }
    document.getElementById('mv-coupon').addEventListener('change', loadQuote);
    await loadQuote();

    document.getElementById('mv-place').onclick = async () => {
      const opt = quoteData?.options?.[0] || { id: 'pickup' };
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-tenant': tenant.slug },
        body: JSON.stringify({
          items,
          customer: { name: document.getElementById('mv-name').value.trim(), phone: document.getElementById('mv-phone').value.trim(), email: document.getElementById('mv-email').value.trim() },
          destination: { address: document.getElementById('mv-addr').value.trim(), postal_code: '12730', lat: wh.lat, lng: wh.lng },
          shipping_id: opt.id,
          payment: 'manual',
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
      body.innerHTML = `<div class="mv-alert mv-alert-ok">Order <strong>${esc(res.order.no)}</strong> placed! Total: <strong>${esc(money(res.order.total))}</strong> (Status: ${esc(res.order.status)}).</div>`;
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
  });
})();
