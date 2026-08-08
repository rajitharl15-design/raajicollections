const ORDER_STEPS = ['pending', 'confirmed', 'shipped', 'delivered'];
const PAYMENT_STEPS = ['pending', 'paid'];

function formatMoney(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function statusIndex(status) {
  const i = ORDER_STEPS.indexOf(status);
  return i === -1 ? 0 : i;
}

function statusLabel(status) {
  return (status || 'pending').charAt(0).toUpperCase() + (status || 'pending').slice(1);
}

function trackingUrl(carrier, number) {
  const c = (carrier || '').toLowerCase();
  const n = encodeURIComponent(number);
  if (c.includes('delhivery')) return `https://www.astark.in/track/${n}`;
  if (c.includes('india post') || c.includes('dart')) return `https://www.indiapost.gov.in/EPO_Tracking.aspx`;
  if (c.includes('dtdc')) return `https://www.dtdc.in/tracking.asp`;
  if (c.includes('blue dart')) return `https://www.bluedart.com/tracking`;
  if (c.includes('xpressbee')) return `https://www.xpressbees.com/track-order`;
  if (c.includes('shiprocket')) return `https://shiprocket.co/tracking`;
  if (c.includes('ekart')) return `https://www.ekartlogistics.com/tracking`;
  if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
  if (c.includes('dhl')) return `https://www.dhl.com/in-en/home/tracking.html?tracking-id=${n}`;
  return '';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderTimeline(order) {
  const current = statusIndex(order.status);
  const steps = [
    { label: 'Order Placed', sub: 'We received your order' },
    { label: 'Confirmed', sub: order.payment_status === 'paid' ? 'Payment received' : 'Awaiting payment confirmation' },
    { label: 'Shipped', sub: 'Order handed to courier' },
    { label: 'Delivered', sub: 'Enjoy your purchase!' },
  ];

  return steps.map((s, i) => {
    const done = i === 0 ? true : i <= current;
    const isLast = i === steps.length - 1;
    return `
      <div class="track-step ${done ? 'done' : ''}">
        <div class="track-dot">${done ? '<i class="fas fa-check"></i>' : ''}</div>
        ${isLast ? '' : '<div class="track-line"></div>'}
        <div class="track-step-info">
          <strong>${s.label}</strong>
          <span>${s.sub}</span>
        </div>
      </div>`;
  }).join('');
}

async function trackOrder() {
  const input = document.getElementById('trackInput');
  const err = document.getElementById('trackError');
  const result = document.getElementById('trackResult');
  const btn = document.getElementById('trackBtn');
  const orderNumber = input.value.trim().toUpperCase();

  err.textContent = '';
  if (!orderNumber) {
    err.textContent = 'Please enter your order number.';
    return;
  }

  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Tracking...';

  try {
    const res = await fetch(`${API_CONFIG.baseUrl}/api/orders/${encodeURIComponent(orderNumber)}`);
    if (!res.ok) {
      if (res.status === 404) throw new Error('Order not found. Please check the order number.');
      throw new Error('Could not fetch your order. Please try again.');
    }
    const { order } = await res.json();

    document.getElementById('trackOrderNumber').textContent = order.order_number;
    document.getElementById('trackMeta').textContent = formatDate(order.created_at);
    document.getElementById('trackStatus').textContent = statusLabel(order.status);
    document.getElementById('trackStatus').className = 'badge badge-status ' + (order.status || 'pending');
    document.getElementById('trackTotal').textContent = formatMoney(order.total);
    document.getElementById('trackTimeline').innerHTML = renderTimeline(order);

    const trackingBox = document.getElementById('trackTracking');
    if (order.tracking_number && order.status === 'shipped') {
      const carrier = order.tracking_carrier || 'Courier';
      const url = trackingUrl(carrier, order.tracking_number);
      trackingBox.innerHTML = `
        <div class="track-tracking-box">
          <span class="track-tracking-label">Shipment Tracking</span>
          <strong>${escapeHtml(carrier)} — ${escapeHtml(order.tracking_number)}</strong>
          ${url ? `<a class="track-tracking-link" href="${url}" target="_blank" rel="noopener">Track on courier site <i class="fas fa-external-link-alt"></i></a>` : ''}
        </div>`;
      trackingBox.classList.remove('hidden');
    } else {
      trackingBox.classList.add('hidden');
      trackingBox.innerHTML = '';
    }

    const waNum = (window.STORE_CONFIG && STORE_CONFIG.whatsappNumber) || '918125491097';
    const msg = encodeURIComponent(`Hi! I want to ask about my order ${order.order_number} (${statusLabel(order.status)}).`);
    document.getElementById('trackWhatsapp').href = `https://wa.me/${waNum}?text=${msg}`;

    result.classList.remove('hidden');
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (e) {
    err.textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('trackBtn');
  const input = document.getElementById('trackInput');
  btn.addEventListener('click', trackOrder);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') trackOrder();
  });
});
