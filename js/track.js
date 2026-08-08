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
