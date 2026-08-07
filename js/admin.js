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
