const ADMIN_KEY_STORAGE = 'raaji_admin_key';
const ORDER_STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];
const KIDS_AGE_SIZES = [
  '0-3M', '3-6M', '6-9M', '9-12M', '1-2Y', '2-3Y', '3-4Y', '4-5Y',
  '5-6Y', '6-7Y', '7-8Y', '8-9Y', '9-10Y', '10-11Y', '11-12Y', '12-13Y'
];
const CARRIERS = [
  'Delhivery',
  'Blue Dart',
  'India Post',
  'DTDC',
  'XpressBees',
  'Rapido',
  'Shiprocket',
  'EKart',
  'FedEx',
  'DHL',
  'Other',
];

const apiBase = () => API_CONFIG.baseUrl || 'http://localhost:3000';

let adminKey = localStorage.getItem(ADMIN_KEY_STORAGE) || '';
let currentFilter = 'all';
let orders = [];
let selectedImages = [];

function formatMoney(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

async function api(path, options = {}) {
  const headers = { 'x-admin-key': adminKey, ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${apiBase()}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function loadOrders() {
  try {
    orders = (await api('/api/admin/orders')).orders;
    render();
  } catch (err) {
    if (err.status === 401) {
      showLogin();
    } else {
      document.getElementById('adminOrders').innerHTML =
        `<p class="admin-loading">Failed to load orders: ${err.message}</p>`;
    }
  }
}

function carrierOptions(selected) {
  const s = String(selected || '');
  const known = CARRIERS.some(c => String(c).toLowerCase() === s.toLowerCase());
  return CARRIERS.map(c => {
    const isOther = c === 'Other';
    let match;
    if (s !== '') {
      match = isOther ? !known : String(c).toLowerCase() === s.toLowerCase();
    } else {
      match = isOther;
    }
    return `<option value="${escapeHtml(c)}"${match ? ' selected' : ''}>${escapeHtml(c)}${isOther && !known && s ? ` — ${escapeHtml(s)}` : ''}</option>`;
  }).join('');
}

function render() {
  renderStats();
  renderOrders();
}

function renderStats() {
  const total = orders.length;
  const pending = orders.filter(o => o.status === 'pending').length;
  const paid = orders.filter(o => o.payment_status === 'paid').length;
  const revenue = orders.filter(o => o.payment_status === 'paid')
    .reduce((sum, o) => sum + Number(o.total), 0);
  document.getElementById('adminStats').innerHTML = `
    <div class="stat-card"><span>Total Orders</span><strong>${total}</strong></div>
    <div class="stat-card"><span>Pending</span><strong>${pending}</strong></div>
    <div class="stat-card"><span>Paid</span><strong>${paid}</strong></div>
    <div class="stat-card"><span>Revenue (paid)</span><strong>${formatMoney(revenue)}</strong></div>`;
}

function renderOrders() {
  const container = document.getElementById('adminOrders');
  const filtered = currentFilter === 'all'
    ? orders
    : orders.filter(o => o.status === currentFilter || o.payment_status === currentFilter);

  if (filtered.length === 0) {
    container.innerHTML = '<p class="admin-loading">No orders found.</p>';
    return;
  }

  container.innerHTML = filtered.map(o => `
    <div class="admin-order">
      <div class="admin-order-head">
        <div>
          <h3>${o.order_number}</h3>
          <p class="admin-order-meta">${o.first_name}${o.phone ? ' · ' + o.phone : ''}${o.shipping_city ? ' · ' + o.shipping_city : ''}</p>
          <p class="admin-order-meta">${formatDate(o.created_at)}</p>
        </div>
        <div class="admin-order-amount">${formatMoney(o.total)}</div>
      </div>
      <div class="admin-order-body">
        <div class="admin-badges">
          <span class="badge badge-status ${o.status}">${o.status}</span>
          <span class="badge badge-pay ${o.payment_status}">${o.payment_status}</span>
          ${o.tracking_number ? `<span class="badge badge-track" title="Courier tracking">📦 ${escapeHtml(o.tracking_carrier || 'Courier')} · ${escapeHtml(o.tracking_number)}</span>` : ''}
          ${o.confirm_code ? `<span class="badge badge-code" title="Ask customer for this code with their payment screenshot">🔐 ${escapeHtml(o.confirm_code)}</span>` : ''}
        </div>
        <div class="admin-actions">
          <div class="admin-action-group">
            <label>Status</label>
            <select data-order-id="${o.id}" data-field="status">
              ${ORDER_STATUSES.map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="admin-action-group">
            <label>Payment</label>
            <select data-order-id="${o.id}" data-field="payment_status">
              ${PAYMENT_STATUSES.map(s => `<option value="${s}" ${s === o.payment_status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="admin-order-foot">
        <button class="btn-link" data-view="${o.id}"><i class="fas fa-eye"></i> Details</button>
        <button class="btn-link btn-delete" data-del="${o.id}"><i class="fas fa-trash"></i> Delete</button>
        <span class="admin-saved" id="saved-${o.id}"></span>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('select[data-order-id]').forEach(sel => {
    sel.addEventListener('change', async () => {
      const orderId = sel.dataset.orderId;
      const field = sel.dataset.field;
      const value = sel.value;
      const saved = document.getElementById(`saved-${orderId}`);
      try {
        const data = await api(`/api/admin/orders/${orderId}`, {
          method: 'PATCH',
          body: JSON.stringify({ [field]: value }),
        });
        saved.textContent = `Saved: ${data.order.status} / ${data.order.payment_status}`;
        setTimeout(() => { saved.textContent = ''; }, 3000);
        const idx = orders.findIndex(o => o.id === Number(orderId));
        if (idx !== -1) {
          orders[idx].status = data.order.status;
          orders[idx].payment_status = data.order.payment_status;
        }
        renderStats();
      } catch (err) {
        saved.textContent = `Error: ${err.message}`;
      }
    });
  });

  container.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => showOrderDetails(btn.dataset.view));
  });

  container.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.del;
      if (!confirm(`Delete order #${id}? This cannot be undone.`)) return;
      try {
        await api(`/api/admin/orders/${id}`, { method: 'DELETE' });
        orders = orders.filter(x => x.id !== Number(id));
        renderStats();
        renderOrders();
      } catch (err) {
        alert('Failed to delete order: ' + err.message);
      }
    });
  });
}

async function showOrderDetails(orderId) {
  const data = await api(`/api/admin/orders/${orderId}`);
  const o = data.order;
  const items = o.items.map(i =>
    `<li>${i.quantity} × ${i.product_name}${i.size || i.color ? ` <span class="badge badge-code">${i.size ? i.size : ''}${i.size && i.color ? ' · ' : ''}${i.color ? i.color : ''}</span>` : ''} — ${formatMoney(i.line_total)}</li>`).join('');
  const payments = (o.payments || []).map(p =>
    `<li>${p.method} · ${p.status}${p.transaction_id ? ' · TXN: ' + p.transaction_id : ''} — ${formatMoney(p.amount)}</li>`).join('');

  const modal = document.createElement('div');
  modal.className = 'admin-modal';
  modal.innerHTML = `
    <div class="admin-modal-box">
      <button class="admin-modal-close"><i class="fas fa-times"></i></button>
      <h2>${o.order_number}</h2>
      ${o.confirm_code ? `<p class="admin-order-meta"><strong>Payment code:</strong> <span class="badge badge-track">${escapeHtml(o.confirm_code)}</span> — ask customer to include this with their payment screenshot</p>` : ''}
      <p class="admin-order-meta">${o.shipping_name || ''} · ${o.shipping_phone || ''}${o.shipping_city ? ' · ' + o.shipping_city : ''}${o.shipping_state ? ', ' + o.shipping_state : ''}${o.shipping_pincode ? ' - ' + o.shipping_pincode : ''}</p>
      <p class="admin-order-meta">${o.shipping_address || ''}${o.shipping_area ? (o.shipping_address ? ', ' : '') + escapeHtml(o.shipping_area) : ''}</p>
      <h4>Items</h4>
      <ul>${items || '<li>None</li>'}</ul>
      <h4>Payments</h4>
      <ul>${payments || '<li>None</li>'}</ul>
      <div class="admin-total-line">
        <span>Subtotal</span><span>${formatMoney(o.subtotal)}</span>
        <span>Shipping</span><span>${formatMoney(o.shipping_fee)}</span>
        <span>Discount</span><span>${formatMoney(o.discount)}</span>
        <span><strong>Total</strong></span><span><strong>${formatMoney(o.total)}</strong></span>
      </div>
      <p class="admin-order-meta">${o.notes ? 'Notes: ' + o.notes : ''}</p>
      <div class="admin-tracking">
        <h4>Tracking</h4>
        <label>Carrier
          <select data-tracking="carrier" data-order="${o.id}">
            ${o.tracking_carrier ? '' : '<option value="" selected disabled>Select courier</option>'}
            ${carrierOptions(o.tracking_carrier)}
          </select>
        </label>
        <label class="admin-other-carrier hidden" data-carrier-other="${o.id}">Other Carrier Name
          <input data-tracking="carrier-other" type="text" value="${CARRIERS.some(c => String(c).toLowerCase() === String(o.tracking_carrier || '').toLowerCase()) ? '' : escapeHtml(o.tracking_carrier || '')}" placeholder="Type courier name">
        </label>
        <label>Tracking / AWB Number
          <input data-tracking="number" data-order="${o.id}" type="text" value="${escapeHtml(o.tracking_number || '')}" placeholder="e.g. DL1234567890">
        </label>
        <button class="btn-link" data-tracking-save="${o.id}"><i class="fas fa-save"></i> Save Tracking</button>
        <span class="admin-saved" id="trackingSaved-${o.id}"></span>
      </div>
      <div class="admin-whatsapp-msg">
        <h4>WhatsApp update for customer</h4>
        <button class="btn-link" data-wa-ship="${o.id}" data-phone="${escapeHtml(o.shipping_phone || '')}"><i class="fab fa-whatsapp"></i> Copy Shipped message</button>
        <button class="btn-link" data-wa-deliver="${o.id}" data-phone="${escapeHtml(o.shipping_phone || '')}"><i class="fab fa-whatsapp"></i> Copy Delivered message</button>
        <span class="admin-saved" id="waSaved-${o.id}"></span>
        <p class="admin-wa-hint">Copies a message — paste it in your WhatsApp chat with the customer.</p>
      </div>
    </div>`;
  modal.querySelector('.admin-modal-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  const carrierSel = modal.querySelector(`[data-tracking="carrier"]`);
  const otherBox = modal.querySelector(`[data-carrier-other="${o.id}"]`);
  const toggleOther = () => {
    if (carrierSel.value === 'Other') {
      otherBox.classList.remove('hidden');
    } else {
      otherBox.classList.add('hidden');
    }
  };
  if (carrierSel) carrierSel.addEventListener('change', toggleOther);
  const initialCarrier = String(o.tracking_carrier || '');
  if (carrierSel) {
    if (initialCarrier === '' || CARRIERS.some(c => String(c).toLowerCase() === initialCarrier.toLowerCase())) {
      otherBox.classList.add('hidden');
    } else {
      carrierSel.value = 'Other';
      toggleOther();
    }
  }

  modal.querySelector(`[data-tracking-save="${o.id}"]`).addEventListener('click', async () => {
    const box = modal.querySelector('.admin-tracking');
    const saved = document.getElementById(`trackingSaved-${o.id}`);
    const others = box.querySelector('[data-tracking="carrier-other"]');
    const payload = {
      tracking_carrier: (carrierSel.value === 'Other' ? (others && others.value.trim()) : carrierSel.value) || '',
      tracking_number: box.querySelector('[data-tracking="number"]').value.trim(),
    };
    try {
      const data = await api(`/api/admin/orders/${o.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      saved.textContent = 'Tracking saved';
      setTimeout(() => { saved.textContent = ''; }, 3000);
      const idx = orders.findIndex(x => x.id === Number(o.id));
      if (idx !== -1) {
        orders[idx].tracking_carrier = data.order.tracking_carrier;
        orders[idx].tracking_number = data.order.tracking_number;
      }
    } catch (err) {
      saved.textContent = `Error: ${err.message}`;
    }
  });
  modal.querySelectorAll('[data-wa-ship], [data-wa-deliver]').forEach(btn => {
    btn.addEventListener('click', () => {
      const isShip = btn.hasAttribute('data-wa-ship');
      const carrierSel = modal.querySelector('[data-tracking="carrier"]');
      const others = modal.querySelector('[data-tracking="carrier-other"]');
      const tracking = {
        carrier: (carrierSel && carrierSel.value === 'Other' ? (others && others.value.trim()) : (carrierSel && carrierSel.value)) || '',
        number: modal.querySelector('[data-tracking="number"]').value.trim(),
      };
      const total = formatMoney(o.total);
      const trackingPart = tracking.number
        ? `\nTracking: ${tracking.carrier || 'Courier'} — ${tracking.number}`
        : '\nI will share the tracking number as soon as it is dispatched.';
      const msg = isShip
        ? `Hello ${o.shipping_name || ''}! Your order ${o.order_number} has been SHIPPED 🚚\nItems: ${o.items.map(i => `${i.quantity} x ${i.product_name}`).join(', ')}\nTotal: ${total}${trackingPart}\nThank you for shopping with Raaji Collections!`
        : `Hello ${o.shipping_name || ''}! Your order ${o.order_number} has been DELIVERED 🎉\nWe hope you love your items! If you need anything, just message us anytime.\n— Raaji Collections`;
      copyText(msg);
      const saved = document.getElementById(`waSaved-${o.id}`);
      if (saved) {
        saved.textContent = 'Copied! Paste it in WhatsApp.';
        setTimeout(() => { saved.textContent = ''; }, 3000);
      }
    });
  });
  document.body.appendChild(modal);
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => { fallbackCopy(text); });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (_) {}
  document.body.removeChild(ta);
}

function showLogin() {
  document.getElementById('adminLogin').classList.remove('hidden');
  document.getElementById('adminDashboard').classList.add('hidden');
}

let adminCategories = [];

async function loadAdminCategories() {
  const select = document.getElementById('pfCategory');
  if (!select) return;
  try {
    const data = await api('/api/admin/categories');
    adminCategories = data.categories;
    select.innerHTML = data.categories.map(c =>
      `<option value="${c.id}">${c.name}</option>`).join('');
    const filter = document.getElementById('pmCategoryFilter');
    if (filter) {
      filter.innerHTML = `<option value="">All</option>` +
        data.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    }
  } catch (err) {
    select.innerHTML = `<option value="">Categories failed to load</option>`;
  }
}

let adminProducts = [];

async function loadAdminProducts() {
  const list = document.getElementById('pmList');
  try {
    adminProducts = (await api('/api/admin/products')).products;
    renderAdminProducts();
  } catch (err) {
    if (list) list.innerHTML = `<p class="admin-loading">Failed to load products: ${err.message}</p>`;
  }
}

function renderAdminProducts() {
  const filter = document.getElementById('pmCategoryFilter');
  const cat = filter ? filter.value : '';
  const filtered = cat ? adminProducts.filter(p => String(p.category_name) === cat) : adminProducts;
  const list = document.getElementById('pmList');
  if (!list) return;
  if (filtered.length === 0) {
    list.innerHTML = '<p class="admin-loading">No products found.</p>';
    return;
  }
  list.innerHTML = filtered.map(p => `
    <div class="pm-product">
      <img src="${p.image_url}" alt="${p.name}">
      <div class="pm-info">
        <h4 data-slug="${p.slug}">${p.name}</h4>
        <p class="admin-order-meta">Category
          <select data-field="category_id" data-slug="${p.slug}">
            ${adminCategories.map(c => `<option value="${c.id}" ${c.id === p.category_id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </p>
        <label>Name
          <input data-field="name" data-slug="${p.slug}" type="text" value="${escapeHtml(p.name)}">
        </label>
        <label>Price (₹) <input data-field="price" data-slug="${p.slug}" type="number" min="0" value="${p.price}"></label>
        <label>Old Price (₹) <input data-field="old_price" data-slug="${p.slug}" type="number" min="0" value="${p.old_price != null ? p.old_price : ''}" placeholder="none"></label>
        <label>Stock <input data-field="stock_qty" data-slug="${p.slug}" type="number" min="0" value="${p.stock_qty}"></label>
        <label>Badge <input data-field="badge" data-slug="${p.slug}" type="text" value="${escapeHtml(p.badge || '')}" placeholder="New / Sale"></label>
        <label class="pm-check">Visible on store
          <input data-field="is_active" data-slug="${p.slug}" type="checkbox" ${p.is_active ? 'checked' : ''}>
        </label>
        <button class="btn-link" data-save="${p.slug}"><i class="fas fa-save"></i> Save</button>
        <button class="btn-link" data-variants="${p.id}" data-vname="${escapeHtml(p.name)}" data-kids="${/kids/i.test(p.category_name || '') ? '1' : '0'}"><i class="fas fa-th-large"></i> Sizes &amp; Colors</button>
        <button class="btn-link btn-delete" data-delete="${p.slug}"><i class="fas fa-trash-alt"></i> Delete</button>
        <span class="pm-saved" id="pmSaved-${p.slug}"></span>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-save]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const slug = btn.dataset.save;
      const el = document.getElementById(`pmSaved-${slug}`);
      if (el) { el.textContent = 'Saving...'; }
      const result = await saveAdminProduct(slug);
      if (el) { el.textContent = (result && result.name) ? `Saved: ${result.name}` : `Error: ${result}`; setTimeout(() => { el.textContent = ''; }, 3000); }
    });
  });

  list.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const slug = btn.dataset.delete;
      const product = adminProducts.find(p => p.slug === slug);
      const name = product ? product.name : slug;
      if (!confirm(`Delete "${name}" permanently? This also removes its images.`)) return;
      const el = document.getElementById(`pmSaved-${slug}`);
      try {
        await api(`/api/admin/products/${slug}`, { method: 'DELETE' });
        adminProducts = adminProducts.filter(p => p.slug !== slug);
        loadAdminProducts();
      } catch (err) {
        if (el) { el.textContent = `Error: ${err.message}`; setTimeout(() => { el.textContent = ''; }, 3000); }
      }
    });
  });

  list.querySelectorAll('[data-variants]').forEach(btn => {
    btn.addEventListener('click', () => openVariantEditor(btn.dataset.variants, btn.dataset.vname, btn.dataset.kids === '1'));
  });

  list.querySelectorAll('#pmList input[data-field], #pmList select[data-field]').forEach(inp => {
    if (inp.type === 'checkbox') return;
    inp.addEventListener('change', async () => {
      const slug = inp.dataset.slug;
      const el = document.getElementById(`pmSaved-${slug}`);
      if (el) { el.textContent = 'Saving...'; }
      const result = await saveAdminProduct(slug);
      if (el) { el.textContent = (result && result.name) ? `Saved: ${result.name}` : `Error: ${result}`; setTimeout(() => { el.textContent = ''; }, 3000); }
    });
  });

  list.querySelectorAll('input[data-field="is_active"]').forEach(cb => {
    cb.addEventListener('change', async () => {
      const slug = cb.dataset.slug;
      const el = document.getElementById(`pmSaved-${slug}`);
      if (el) { el.textContent = 'Saving...'; }
      const data = await api(`/api/admin/products/${slug}`, {
        method: 'PATCH', body: JSON.stringify({ is_active: cb.checked }),
      });
      if (el) { el.textContent = `Visibility saved`; setTimeout(() => { el.textContent = ''; }, 3000); }
      const idx = adminProducts.findIndex(p => p.slug === slug);
      if (idx !== -1) adminProducts[idx] = { ...adminProducts[idx], ...data.product };
    });
  });
}

async function saveAdminProduct(slug) {
  const list = document.getElementById('pmList');
  const inputs = list.querySelectorAll(`input[data-slug="${slug}"]`);
  const payload = {};
  inputs.forEach(inp => {
    const field = inp.dataset.field;
    const val = inp.value.trim();
    if (field === 'name' && val) payload.name = val;
    else if (field === 'price' && val) payload.price = Number(val);
    else if (field === 'old_price') payload.old_price = val === '' ? '' : Number(val);
    else if (field === 'stock_qty' && val !== '') payload.stock_qty = Number(val);
    else if (field === 'badge') payload.badge = val;
  });
  const catSel = list.querySelector(`select[data-field="category_id"][data-slug="${slug}"]`);
  if (catSel) payload.category_id = Number(catSel.value);
  try {
    const data = await api(`/api/admin/products/${slug}`, {
      method: 'PATCH', body: JSON.stringify(payload),
    });
    const idx = adminProducts.findIndex(p => p.slug === slug);
    if (idx !== -1) adminProducts[idx] = { ...adminProducts[idx], ...data.product };
    const h4 = list.querySelector(`h4[data-slug="${slug}"]`);
    if (h4) h4.textContent = data.product.name;
    return data.product;
  } catch (err) {
    return err.message;
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// === Variant editor (sizes & colors) ===
let vmProductId = null;
let vmIsKids = false;

function vmGroupHTML(size, colors) {
  (colors = colors || []).forEach(c => { c = c || {}; });
  const sizeField = vmIsKids
    ? `<select class="vm-size">
        <option value="" ${!size ? 'selected' : ''}>Select age/size...</option>
        ${KIDS_AGE_SIZES.map(s => `<option value="${s}" ${size === s ? 'selected' : ''}>${s}</option>`).join('')}
        ${size && !KIDS_AGE_SIZES.includes(size) ? `<option value="${escapeHtml(size)}" selected>${escapeHtml(size)}</option>` : ''}
      </select>`
    : `<input class="vm-size" type="text" placeholder="Size (e.g. S / M / L / Free)" value="${escapeHtml(size || '')}">`;
  const colorRows = colors.map((c, i) => vmColorRowHTML(c, i, false)).join('') ||
    vmColorRowHTML({}, 0, false);
  return `
    <div class="vm-group">
      <div class="vm-group-head">
        <span class="vm-group-tag">Size</span>
        ${sizeField}
        <button type="button" class="vm-group-del" title="Remove this size">&times;</button>
      </div>
      <div class="vm-group-colors">
        <div class="vm-group-colors-head">
          <span class="vm-group-colors-tag">Colors</span>
          <button type="button" class="vm-color-add btn-outline">+ Add Color</button>
        </div>
        ${colorRows}
      </div>
    </div>`;
}

function vmColorRowHTML(c, i, fromAdd) {
  c = c || {};
  return `
    <div class="vm-row">
      <input class="vm-color" type="text" placeholder="Color (e.g. Pink)" value="${escapeHtml(c.color || '')}">
      <input class="vm-price" type="number" min="0" step="0.01" placeholder="Price (opt)" value="${c.price != null ? c.price : ''}">
      <input class="vm-stock" type="number" min="0" placeholder="Stock (opt)" value="${c.stock_qty != null ? c.stock_qty : ''}">
      <input class="vm-img" type="text" placeholder="Image URL for this color (optional)" value="${escapeHtml(c.image_url || '')}">
      <button type="button" class="vm-row-del" title="Remove this color">&times;</button>
    </div>`;
}

async function openVariantEditor(productId, name, isKids) {
  vmProductId = productId;
  vmIsKids = !!isKids;
  document.getElementById('vmProductName').textContent = name;
  document.getElementById('vmStatus').textContent = '';
  const modal = document.getElementById('variantModal');
  const rows = document.getElementById('vmRows');
  modal.classList.remove('hidden');
  rows.innerHTML = '<p class="admin-loading">Loading variants...</p>';
  try {
    const data = await api(`/api/admin/products/${productId}/variants`);
    if (data.variants.length) {
      const bySize = {};
      const order = [];
      for (const v of data.variants) {
        const s = String(v.size || '').trim().toLowerCase();
        if (!bySize[s]) { bySize[s] = { size: s, colors: [] }; order.push(s); }
        bySize[s].colors.push(v);
      }
      rows.innerHTML = order.map(s => vmGroupHTML(bySize[s].size, bySize[s].colors)).join('');
    } else {
      rows.innerHTML = vmGroupHTML('', [{}, {}]);
    }
    bindVariantEditor();
  } catch (err) {
    rows.innerHTML = `<p class="admin-loading">Failed to load: ${err.message}</p>`;
  }
}

function bindVariantEditor() {
  document.querySelectorAll('#vmRows .vm-group-del').forEach(del => {
    del.addEventListener('click', () => {
      const group = del.closest('.vm-group');
      if (group && confirm('Remove this size and all its colors?')) group.remove();
    });
  });
  document.querySelectorAll('#vmRows .vm-color-add').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.vm-group-colors').insertAdjacentHTML('beforeend', vmColorRowHTML({}, -1));
      bindColorRowDeletes();
    });
  });
  bindColorRowDeletes();
}

function bindColorRowDeletes() {
  document.querySelectorAll('#vmRows .vm-row-del').forEach(del => {
    del.removeEventListener('click', __vmDelColor);
    del.addEventListener('click', __vmDelColor);
  });
}

function __vmDelColor(e) {
  e.currentTarget.closest('.vm-row').remove();
}

function addVariantGroup() {
  const rows = document.getElementById('vmRows');
  rows.insertAdjacentHTML('beforeend', vmGroupHTML('', [{}]));
  bindVariantEditor();
}

async function saveVariants() {
  const status = document.getElementById('vmStatus');
  const rows = [];
  document.querySelectorAll('#vmRows .vm-group').forEach(group => {
    const size = group.querySelector('.vm-size').value.trim();
    group.querySelectorAll('.vm-row').forEach(r => {
      const color = r.querySelector('.vm-color').value.trim();
      if (!size || !color) return;
      rows.push({
        size,
        color,
        image_url: r.querySelector('.vm-img').value.trim(),
        price: r.querySelector('.vm-price').value,
        stock_qty: r.querySelector('.vm-stock').value,
      });
    });
  });
  if (rows.length === 0) {
    status.textContent = 'Add at least one size + color.';
    status.style.color = '#C62828';
    return;
  }
  try {
    const data = await api(`/api/admin/products/${vmProductId}/variants`, {
      method: 'PUT',
      body: JSON.stringify({ variants: rows }),
    });
    status.textContent = `Saved ${data.count} variant(s).`;
    status.style.color = '#2E7D32';
    setTimeout(() => { status.textContent = ''; }, 3000);
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
    status.style.color = '#C62828';
  }
}

function imgLabelHint(msg) {
  const lbl = document.getElementById('pfDropLabel');
  if (lbl) { lbl.textContent = msg; setTimeout(() => { lbl.textContent = '+ Click to add product images (multiple)'; }, 3000); }
}

function openImageLightbox(src) {
  const box = document.createElement('div');
  box.className = 'pf-lightbox';
  const img = document.createElement('img');
  img.src = src;
  const close = document.createElement('span');
  close.className = 'pf-lb-close';
  close.innerHTML = '&times;';
  close.addEventListener('click', e => { e.stopPropagation(); box.remove(); });
  box.appendChild(close);
  box.appendChild(img);
  box.addEventListener('click', () => box.remove());
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { box.remove(); document.removeEventListener('keydown', esc); }
  });
  document.body.appendChild(box);
}

async function dataUrlFromObjectUrls(urls) {
  const out = [];
  for (const u of urls) {
    try {
      const res = await fetch(u);
      const blob = await res.blob();
      const dataUrl = await new Promise((res2, rej) => {
        const r = new FileReader();
        r.onload = () => res2(r.result);
        r.onerror = rej;
        r.readAsDataURL(blob);
      });
      out.push(dataUrl);
    } catch (e) {
      return null;
    }
  }
  return out;
}

async function saveNewProduct() {
  const status = document.getElementById('pfStatus');
  const btn = document.getElementById('pfSaveBtn');
  const name = document.getElementById('pfName').value.trim();
  const categoryId = document.getElementById('pfCategory').value;
  const price = document.getElementById('pfPrice').value;
  const oldPrice = document.getElementById('pfOldPrice').value;
  const stock = document.getElementById('pfStock').value;
  const badge = document.getElementById('pfBadge').value.trim();
  const desc = document.getElementById('pfDesc').value.trim();

  if (!name || !categoryId || !price) {
    status.textContent = 'Name, category and price are required.';
    status.style.color = '#C62828';
    return;
  }

  const payloadBase = {
    name,
    category_id: Number(categoryId),
    price: Number(price),
    old_price: oldPrice ? Number(oldPrice) : null,
    stock_qty: Number(stock || 0),
    badge: badge || null,
    description: desc || null,
  };

  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = 'Saving...';
  status.textContent = '';

  try {
    const dataUrls = selectedImages[0] && selectedImages[0].startsWith('blob:')
      ? await dataUrlFromObjectUrls(selectedImages)
      : selectedImages;
    if (dataUrls === null) {
      throw new Error('Could not read the selected images.');
    }
    const data = await api('/api/admin/products', {
      method: 'POST',
      body: JSON.stringify({ ...payloadBase, images: dataUrls.map(d => ({ dataUrl: d, alt: name })) }),
    });
    status.style.color = '#2E7D32';
    status.textContent = `Saved: ${data.product.name} (₹${data.product.price})`;
    document.getElementById('pfName').value = '';
    document.getElementById('pfPrice').value = '';
    document.getElementById('pfOldPrice').value = '';
    document.getElementById('pfDesc').value = '';
    document.getElementById('pfBadge').value = '';
    document.getElementById('pfImages').value = '';
    document.getElementById('pfPreview').innerHTML = '';
    selectedImages = [];
  } catch (err) {
    status.style.color = '#C62828';
    status.textContent = `Error: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
}

function showDashboard() {
  document.getElementById('adminLogin').classList.add('hidden');
  document.getElementById('adminDashboard').classList.remove('hidden');
  loadOrders();
}

function escapeCsv(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportOrdersCsv() {
  if (orders.length === 0) return alert('No orders to export.');
  const head = ['Order Number', 'Date', 'Status', 'Payment', 'Name', 'Phone', 'Email',
    'City', 'State', 'Pincode', 'Subtotal', 'Shipping', 'Discount', 'Total', 'Items'];
  const rows = orders.map(o => [
    o.order_number, formatDate(o.created_at), o.status, o.payment_status,
    o.first_name || o.shipping_name, o.phone, o.email,
    o.shipping_city, o.shipping_state, o.shipping_pincode,
    o.subtotal, o.shipping_fee, o.discount, o.total, o.item_count,
  ]);
  const csv = [head, ...rows].map(r => r.map(escapeCsv).join(',')).join('\n');
  downloadFile('raaji-orders.csv', '\ufeff' + csv, 'text/csv;charset=utf-8');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('adminLoginBtn').addEventListener('click', async () => {
    const key = document.getElementById('adminKeyInput').value.trim();
    const err = document.getElementById('adminLoginErr');
    if (!key) { err.textContent = 'Enter your admin key.'; return; }
    adminKey = key;
    try {
      await api('/api/admin/orders');
      localStorage.setItem(ADMIN_KEY_STORAGE, key);
      err.textContent = '';
      showDashboard();
    } catch (e) {
      err.textContent = e.status === 429
        ? 'Too many failed attempts. Try again in 15 minutes.'
        : 'Invalid admin key.';
      adminKey = '';
    }
  });

  document.getElementById('adminKeyInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('adminLoginBtn').click();
  });

  const exportBtn = document.getElementById('adminExportBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportOrdersCsv);

  const vmModal = document.getElementById('variantModal');
  if (vmModal) {
    vmModal.querySelector('[data-vm-close]').addEventListener('click', () => vmModal.classList.add('hidden'));
    vmModal.addEventListener('click', e => { if (e.target === vmModal) vmModal.classList.add('hidden'); });
  }
  const vmAddRow = document.getElementById('vmAddRow');
  if (vmAddRow) vmAddRow.addEventListener('click', addVariantGroup);
  const vmSave = document.getElementById('vmSave');
  if (vmSave) vmSave.addEventListener('click', saveVariants);

  const clearBtn = document.getElementById('adminClearBtn');
  if (clearBtn) clearBtn.addEventListener('click', async () => {
    const n = orders.length;
    if (n === 0) return alert('No orders to clear.');
    if (!confirm(`Delete ALL ${n} orders? This cannot be undone.`)) return;
    if (!confirm('Are you absolutely sure? All order history will be permanently removed.')) return;
    try {
      const res = await api('/api/admin/orders', { method: 'DELETE' });
      alert(`Cleared ${res.deleted} order(s).`);
      orders = [];
      renderStats();
      renderOrders();
    } catch (err) {
      alert('Failed to clear orders: ' + err.message);
    }
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('tab-orders').classList.toggle('hidden', tab !== 'orders');
      document.getElementById('tab-addproduct').classList.toggle('hidden', tab !== 'addproduct');
      document.getElementById('tab-manageproducts').classList.toggle('hidden', tab !== 'manageproducts');
      if (tab === 'addproduct') loadAdminCategories();
      if (tab === 'manageproducts') { loadAdminCategories(); loadAdminProducts(); }
    });
  });

  const pmCat = document.getElementById('pmCategoryFilter');
  if (pmCat) pmCat.addEventListener('change', renderAdminProducts);
  const pmRefresh = document.getElementById('pmRefreshBtn');
  if (pmRefresh) pmRefresh.addEventListener('click', loadAdminProducts);

  // Add product form
  const imgInput = document.getElementById('pfImages');
  const dropBtn = document.getElementById('pfDropBtn');
  if (imgInput && dropBtn) {
    dropBtn.addEventListener('click', e => {
      e.preventDefault();
      imgInput.click();
    });
    imgInput.addEventListener('change', () => {
      const preview = document.getElementById('pfPreview');
      const files = Array.from(imgInput.files);
      imgInput.value = '';
      if (files.length === 0) return;
      const label = document.getElementById('pfDropLabel');
      const added = [];
      files.forEach(file => {
        if (!file.type.startsWith('image/')) {
          imgLabelHint(file.name + ' is not an image');
          return;
        }
        const url = URL.createObjectURL(file);
        selectedImages.push(url);
        added.push(url);
      });
      if (added.length && label) label.textContent = selectedImages.length + ' image(s) selected';
      added.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.className = 'pf-prev-img';
        img.title = 'Click to zoom';
        img.addEventListener('click', e => {
          e.stopPropagation();
          openImageLightbox(img.src);
        });
        preview.appendChild(img);
      });
    });
  }

  const saveBtn = document.getElementById('pfSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveNewProduct);

  document.getElementById('adminLogoutBtn').addEventListener('click', () => {
    localStorage.removeItem(ADMIN_KEY_STORAGE);
    adminKey = '';
    showLogin();
  });

  document.querySelectorAll('.admin-filters .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-filters .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.status;
      renderOrders();
    });
  });

  if (adminKey) {
    showDashboard();
  } else {
    showLogin();
  }
});
