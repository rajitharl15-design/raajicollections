const ADMIN_KEY_STORAGE = 'raaji_admin_key';
const ORDER_STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

const apiBase = () => API_CONFIG.baseUrl || 'http://localhost:3000';

let adminKey = localStorage.getItem(ADMIN_KEY_STORAGE) || '';
let currentFilter = 'all';
let orders = [];

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
}

async function showOrderDetails(orderId) {
  const data = await api(`/api/admin/orders/${orderId}`);
  const o = data.order;
  const items = o.items.map(i =>
    `<li>${i.quantity} × ${i.product_name} — ${formatMoney(i.line_total)}</li>`).join('');
  const payments = (o.payments || []).map(p =>
    `<li>${p.method} · ${p.status}${p.transaction_id ? ' · TXN: ' + p.transaction_id : ''} — ${formatMoney(p.amount)}</li>`).join('');

  const modal = document.createElement('div');
  modal.className = 'admin-modal';
  modal.innerHTML = `
    <div class="admin-modal-box">
      <button class="admin-modal-close"><i class="fas fa-times"></i></button>
      <h2>${o.order_number}</h2>
      <p class="admin-order-meta">${o.shipping_name || ''} · ${o.shipping_phone || ''}${o.shipping_city ? ' · ' + o.shipping_city : ''}${o.shipping_state ? ', ' + o.shipping_state : ''}${o.shipping_pincode ? ' - ' + o.shipping_pincode : ''}</p>
      <p class="admin-order-meta">${o.shipping_address || ''}</p>
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
    </div>`;
  modal.querySelector('.admin-modal-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
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
      err.textContent = 'Invalid admin key.';
      adminKey = '';
    }
  });

  document.getElementById('adminKeyInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('adminLoginBtn').click();
  });

  const exportBtn = document.getElementById('adminExportBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportOrdersCsv);

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
  let selectedImages = [];
  const imgInput = document.getElementById('pfImages');
  const dropBtn = document.getElementById('pfDropBtn');
  if (imgInput && dropBtn) {
    dropBtn.addEventListener('click', e => {
      e.preventDefault();
      imgInput.click();
    });
    imgInput.addEventListener('change', () => {
      selectedImages = [];
      const preview = document.getElementById('pfPreview');
      preview.innerHTML = '';
      const files = Array.from(imgInput.files);
      if (files.length === 0) return;
      const label = document.getElementById('pfDropLabel');
      if (label) label.textContent = files.length + ' image(s) selected';
      files.forEach(file => {
        if (!file.type.startsWith('image/')) {
          imgLabelHint(file.name + ' is not an image');
          return;
        }
        const url = URL.createObjectURL(file);
        selectedImages.push(url);
        const img = document.createElement('img');
        img.src = url;
        img.alt = file.name;
        img.className = 'pf-prev-img';
        img.title = 'Click to zoom';
        preview.appendChild(img);
      });
      preview.addEventListener('click', e => {
        const t = e.target;
        if (t && t.classList && t.classList.contains('pf-prev-img')) {
          openImageLightbox(t.src);
        }
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
