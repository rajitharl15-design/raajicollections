const PRICE_STORAGE_KEY = 'raaji_prices';

let isAdminMode = false;
let priceOverrides = {};
let dbPrices = {};

function loadPriceOverrides() {
  try {
    priceOverrides = JSON.parse(localStorage.getItem(PRICE_STORAGE_KEY)) || {};
  } catch (e) {
    priceOverrides = {};
  }
}

function savePriceOverrides() {
  localStorage.setItem(PRICE_STORAGE_KEY, JSON.stringify(priceOverrides));
}

async function loadDbPrices() {
  if (!window.API_CONFIG || !API_CONFIG.baseUrl) return;
  try {
    const res = await fetch(`${API_CONFIG.baseUrl}/api/products`);
    if (!res.ok) throw new Error('Failed to load products');
    const data = await res.json();
    dbPrices = {};
    (data.products || []).forEach(p => {
      dbPrices[p.name] = { price: Number(p.price), old_price: p.old_price != null ? Number(p.old_price) : null };
    });
    applyAllPrices();
  } catch (e) {
    /* keep hardcoded prices if backend is down */
  }
}

function priceTextOf(el) {
  const oldEl = el.querySelector('.old-price');
  if (oldEl) {
    const all = el.textContent.replace(/[^0-9,]/g, '').split(',');
    return parseInt(all[all.length - 1].replace(/,/g, ''), 10) || 0;
  }
  return parseInt(el.textContent.replace(/[^0-9]/g, ''), 10) || 0;
}

function applyPrice(el) {
  const card = el.closest('.product-card');
  if (!card) return;
  const nameEl = card.querySelector('h3');
  if (!nameEl) return;
  const name = nameEl.textContent.trim();

  let price, oldPrice;
  const db = dbPrices[name];
  const local = priceOverrides[name];

  if (db) {
    price = db.price;
    oldPrice = db.old_price;
  }
  if (local != null) {
    price = local;
  }

  if (price == null) return;

  if (oldPrice != null && oldPrice > price) {
    el.innerHTML = `<span class="old-price">₹${oldPrice.toLocaleString('en-IN')}</span> ₹${price.toLocaleString('en-IN')}`;
  } else {
    el.textContent = `₹${price.toLocaleString('en-IN')}`;
  }
}

function applyAllPrices() {
  document.querySelectorAll('.product-price').forEach(applyPrice);
}

function setAdminMode(on) {
  isAdminMode = on;
  document.body.classList.toggle('admin-mode', on);
  const bar = document.getElementById('adminBar');
  if (bar) bar.style.display = on ? 'flex' : 'none';
  const toast = document.getElementById('adminToast');
  if (toast) {
    toast.textContent = on ? 'Admin mode ON - click image or price to edit' : 'Admin mode OFF';
    toast.classList.add('show');
    clearTimeout(setAdminMode._t);
    setAdminMode._t = setTimeout(() => toast.classList.remove('show'), 2000);
  }
}

function resetPrices() {
  priceOverrides = {};
  savePriceOverrides();
  applyAllPrices();
  const toast = document.getElementById('adminToast');
  if (toast) {
    toast.textContent = 'All prices reset to original';
    toast.classList.add('show');
    clearTimeout(setAdminMode._t);
    setAdminMode._t = setTimeout(() => toast.classList.remove('show'), 2000);
  }
}

function copyChanges() {
  const entries = Object.entries(priceOverrides);
  if (entries.length === 0) {
    const toast = document.getElementById('adminToast');
    if (toast) {
      toast.textContent = 'No price changes yet';
      toast.classList.add('show');
      clearTimeout(setAdminMode._t);
      setAdminMode._t = setTimeout(() => toast.classList.remove('show'), 2000);
    }
    return;
  }
  const text = entries.map(([name, price]) => `${name} => ₹${price}`).join('\n');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text);
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  const toast = document.getElementById('adminToast');
  if (toast) {
    toast.textContent = 'Price changes copied - paste them to update the repo';
    toast.classList.add('show');
    clearTimeout(setAdminMode._t);
    setAdminMode._t = setTimeout(() => toast.classList.remove('show'), 3000);
  }
}

async function editPriceFor(card) {
  if (!isAdminMode) return;
  const nameEl = card.querySelector('h3');
  if (!nameEl) return;
  const priceEl = card.querySelector('.product-price');
  if (!priceEl) return;
  const name = nameEl.textContent.trim();
  const current = priceOverrides[name] != null ? priceOverrides[name] : priceTextOf(priceEl);
  const input = prompt(`New price for "${name}" (in ₹):`, current);
  if (input == null) return;
  const val = parseInt(input.replace(/[^0-9]/g, ''), 10);
  if (isNaN(val) || val <= 0) return;

  if (window.API_CONFIG && API_CONFIG.baseUrl) {
    try {
      const adminKey = localStorage.getItem('raaji_admin_key');
      const res = await fetch(`${API_CONFIG.baseUrl}/api/admin/products/${name.toLowerCase().replace(/\s+/g, '-')}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(adminKey ? { 'x-admin-key': adminKey } : {}),
        },
        body: JSON.stringify({ price: val }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to save price');
      delete priceOverrides[name];
      savePriceOverrides();
      await loadDbPrices();
      const toast = document.getElementById('adminToast');
      if (toast) {
        toast.textContent = `Saved to database: ${name} ₹${val}`;
        toast.classList.add('show');
        clearTimeout(setAdminMode._t);
        setAdminMode._t = setTimeout(() => toast.classList.remove('show'), 3000);
      }
    } catch (err) {
      alert(`Could not save price: ${err.message}. Check your admin key in the Admin dashboard.`);
    }
  } else {
    priceOverrides[name] = val;
    savePriceOverrides();
    applyPrice(priceEl);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadPriceOverrides();
  loadDbPrices();
  applyAllPrices();

  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      setAdminMode(!isAdminMode);
    }
  });

  document.querySelectorAll('.product-price').forEach(el => {
    el.addEventListener('click', function (e) {
      if (!isAdminMode) return;
      e.preventDefault();
      e.stopPropagation();
      editPriceFor(this.closest('.product-card'));
    });
  });

  document.querySelectorAll('.product-card img').forEach(img => {
    img.addEventListener('click', function (e) {
      if (!isAdminMode) return;
      e.preventDefault();
      e.stopPropagation();
      editPriceFor(this.closest('.product-card'));
    });
  });

  document.querySelectorAll('[data-admin-exit]').forEach(b =>
    b.addEventListener('click', () => setAdminMode(false))
  );
  document.querySelectorAll('[data-admin-reset]').forEach(b =>
    b.addEventListener('click', resetPrices)
  );
  document.querySelectorAll('[data-admin-copy]').forEach(b =>
    b.addEventListener('click', copyChanges)
  );
});
