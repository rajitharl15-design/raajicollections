const STORE_CONFIG = {
  whatsappNumber: '1234',
  upiId: '',
  currency: '₹'
};

const Cart = {
  items: {},

  init() {
    this.load();
    this.render();
  },

  load() {
    try {
      this.items = JSON.parse(localStorage.getItem('raaji_cart')) || {};
    } catch (e) {
      this.items = {};
    }
  },

  save() {
    localStorage.setItem('raaji_cart', JSON.stringify(this.items));
  },

  count() {
    return Object.values(this.items).reduce((sum, i) => sum + i.qty, 0);
  },

  total() {
    return Object.values(this.items).reduce((sum, i) => sum + i.qty * i.price, 0);
  },

  add(product) {
    const key = product.id;
    if (this.items[key]) {
      this.items[key].qty += 1;
    } else {
      this.items[key] = { ...product, qty: 1 };
    }
    this.save();
    this.render();
    this.toast(`${product.name} added to cart`);
  },

  setQty(key, qty) {
    if (qty <= 0) {
      delete this.items[key];
    } else {
      this.items[key].qty = qty;
    }
    this.save();
    this.render();
  },

  remove(key) {
    delete this.items[key];
    this.save();
    this.render();
  },

  clear() {
    this.items = {};
    this.save();
    this.render();
  },

  render() {
    const badge = document.getElementById('cartCount');
    if (badge) badge.textContent = this.count();

    const list = document.getElementById('cartItems');
    if (!list) return;

    const entries = Object.values(this.items);

    if (entries.length === 0) {
      list.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
    } else {
      list.innerHTML = entries.map(i => `
        <div class="cart-item">
          <img src="${i.image}" alt="${i.name}">
          <div class="cart-item-info">
            <h4>${i.name}</h4>
            <p>${STORE_CONFIG.currency}${i.price.toLocaleString('en-IN')}</p>
            <div class="cart-qty">
              <button onclick="Cart.setQty('${i.id}', ${i.qty - 1})">−</button>
              <span>${i.qty}</span>
              <button onclick="Cart.setQty('${i.id}', ${i.qty + 1})">+</button>
            </div>
          </div>
          <button class="cart-remove" onclick="Cart.remove('${i.id}')"><i class="fas fa-times"></i></button>
        </div>
      `).join('');
    }

    const total = document.getElementById('cartTotal');
    if (total) total.textContent = `${STORE_CONFIG.currency}${this.total().toLocaleString('en-IN')}`;

    const upiPayBtn = document.querySelector('.btn-pay-upi');
    if (upiPayBtn) upiPayBtn.style.display = STORE_CONFIG.upiId ? '' : 'none';
  },

  toast(msg) {
    const el = document.getElementById('cartToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
  }
};

function formatOrderText() {
  const entries = Object.values(Cart.items);
  const lines = entries.map(i =>
    `${i.qty} x ${i.name} - ${STORE_CONFIG.currency}${(i.qty * i.price).toLocaleString('en-IN')}`
  );
  return [
    'New Order - Raaji Collections',
    '--------------------------------',
    ...lines,
    '--------------------------------',
    `Total: ${STORE_CONFIG.currency}${Cart.total().toLocaleString('en-IN')}`,
    '',
    'Name:',
    'Address:'
  ].join('\n');
}

function openCheckout() {
  if (Cart.count() === 0) return;
  document.getElementById('cartDrawer').classList.remove('show');
  document.getElementById('orderItems').innerHTML = Object.values(Cart.items).map(i =>
    `<p>${i.qty} x ${i.name} <span>${STORE_CONFIG.currency}${(i.qty * i.price).toLocaleString('en-IN')}</span></p>`
  ).join('');
  document.getElementById('orderTotal').textContent =
    `${STORE_CONFIG.currency}${Cart.total().toLocaleString('en-IN')}`;
  document.getElementById('checkoutModal').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeCheckout() {
  document.getElementById('checkoutModal').classList.remove('show');
  document.body.style.overflow = '';
}

function payViaUpi() {
  const total = Cart.total();
  const amount = encodeURIComponent(total.toFixed(2).toString());
  const note = encodeURIComponent('Order - Raaji Collections');
  const upi = STORE_CONFIG.upiId ? encodeURIComponent(STORE_CONFIG.upiId) : '';
  const url = `upi://pay?pa=${upi}&pn=${encodeURIComponent('Raaji Collections')}&am=${amount}&cu=INR&tn=${note}`;
  window.location.href = url;
}

function orderOnWhatsApp() {
  const text = encodeURIComponent(formatOrderText());
  const url = `https://wa.me/${STORE_CONFIG.whatsappNumber}?text=${text}`;
  window.open(url, '_blank');
}

function placeOrder() {
  orderOnWhatsApp();
  const note = document.getElementById('orderNote');
  if (note) note.classList.remove('hidden');
  setTimeout(() => {
    Cart.clear();
    closeCheckout();
  }, 1500);
}

window.placeOrder = placeOrder;

document.addEventListener('DOMContentLoaded', () => {
  Cart.init();

  document.querySelectorAll('.btn-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.product-card');
      const nameEl = card.querySelector('h3');
      const priceEl = card.querySelector('.product-price');
      const imgEl = card.querySelector('img');
      const name = nameEl ? nameEl.textContent.trim() : 'Product';
      const priceText = priceEl ? priceEl.textContent.trim() : '0';
      const prices = priceText.match(/₹\s?[\d,]+/g) || [];
      const price = prices.length ? parseInt(prices[prices.length - 1].replace(/[^0-9]/g, ''), 10) : 0;
      const id = (name + '_' + price).replace(/\s+/g, '-').toLowerCase();
      const image = imgEl ? imgEl.getAttribute('src') : 'images/saree.svg';
      Cart.add({ id, name, price, image });
    });
  });

  const cartIcon = document.getElementById('cartOpen');
  if (cartIcon) {
    cartIcon.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('cartDrawer').classList.add('show');
      document.body.style.overflow = 'hidden';
    });
  }

  document.querySelectorAll('[data-close-cart]').forEach(el => {
    el.addEventListener('click', () => {
      document.getElementById('cartDrawer').classList.remove('show');
      document.body.style.overflow = '';
    });
  });

  const checkoutModal = document.getElementById('checkoutModal');
  if (checkoutModal) {
    checkoutModal.addEventListener('click', e => {
      if (e.target === checkoutModal) closeCheckout();
    });
  }

  document.querySelectorAll('.btn-checkout').forEach(b => b.addEventListener('click', openCheckout));
  document.querySelectorAll('.btn-pay-upi').forEach(b => b.addEventListener('click', payViaUpi));
  document.querySelectorAll('.btn-whatsapp').forEach(b => b.addEventListener('click', orderOnWhatsApp));
  document.querySelectorAll('.btn-place-order').forEach(b => b.addEventListener('click', placeOrder));
});
