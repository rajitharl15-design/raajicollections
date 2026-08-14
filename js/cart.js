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
            ${i.variantLabel ? `<p class="cart-variant">${i.variantLabel}</p>` : ''}
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

function openCheckout() {
  if (Cart.count() === 0) return;
  document.getElementById('cartDrawer').classList.remove('show');
  document.getElementById('orderItems').innerHTML = Object.values(Cart.items).map(i =>
    `<p>${i.qty} x ${i.name}${i.variantLabel ? ' (' + i.variantLabel + ')' : ''} <span>${STORE_CONFIG.currency}${(i.qty * i.price).toLocaleString('en-IN')}</span></p>`
  ).join('');
  document.getElementById('orderTotal').textContent =
    `${STORE_CONFIG.currency}${Cart.total().toLocaleString('en-IN')}`;
  document.getElementById('checkoutModal').classList.add('show');
  document.body.style.overflow = 'hidden';
  window._lastOrderNumber = null;
  const link = document.getElementById('whatsappLink');
  if (link) link.style.display = 'none';
}

function updateWhatsAppLink(orderNumber, confirmCode) {
  const link = document.getElementById('whatsappLink');
  if (!link) return;
  const wa = STORE_CONFIG.whatsappNumber;
  if (!wa) {
    link.style.display = 'none';
    return;
  }
  link.style.display = '';
  const items = Object.values(Cart.items).map(i => `${i.qty} x ${i.name}${i.variantLabel ? ' (' + i.variantLabel + ')' : ''}`).join(', ');
  const orderPart = orderNumber ? `My order number is ${orderNumber}. ` : '';
  const codePart = confirmCode ? `Payment code: ${confirmCode}. ` : '';
  const msg = `Hello Raaji Collections! ${orderPart}${codePart}I placed an order for: ${items}. Total: ${STORE_CONFIG.currency}${Cart.total().toLocaleString('en-IN')}. I will send the payment screenshot here to confirm.`;
  link.href = `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;
}

function closeCheckout() {
  document.getElementById('checkoutModal').classList.remove('show');
  document.body.style.overflow = '';
}

function loadCheckout() {}

async function placeOrder() {
  const form = document.getElementById('checkoutForm');
  const note = document.getElementById('orderNote');
  const btn = document.getElementById('placeOrderBtn');

  if (!form || !form.reportValidity()) return;

  const fd = new FormData(form);
  const items = Object.values(Cart.items).map(i => ({
    product_id: i.productId || i.id,
    quantity: i.qty,
    size: i.size || null,
    color: i.color || null,
  }));

  const payload = {
    customer: {
      first_name: fd.get('name'),
      phone: fd.get('phone'),
    },
    shipping: {
      address: fd.get('address'),
      area: fd.get('area'),
      city: fd.get('city'),
      state: fd.get('state'),
      pincode: fd.get('pincode'),
    },
    items,
    paymentMethod: 'cod',
  };

  btn.disabled = true;
  btn.textContent = 'Placing order...';

  if (API_CONFIG.baseUrl) {
    try {
      const res = await fetch(`${API_CONFIG.baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Order failed');
      window._lastOrderNumber = data.order_number;
      window._lastConfirmCode = data.confirm_code;
      note.textContent = data.confirm_code
        ? `Order placed! Number ${data.order_number} · Payment code: ${data.confirm_code}. Tap the WhatsApp button below to send your payment screenshot.`
        : `Order placed! Your order number is ${data.order_number}. Tap the WhatsApp button below to confirm.`;
      note.classList.remove('hidden');
      updateWhatsAppLink(data.order_number, data.confirm_code);
      const link = document.getElementById('whatsappLink');
      if (link) link.style.display = '';
      setTimeout(() => {
        Cart.clear();
        closeCheckout();
      }, 7000);
    } catch (err) {
      note.textContent = `Order failed: ${err.message}`;
      note.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Place Order';
    }
  } else {
    const upi = STORE_CONFIG.upiId ? `UPI: ${STORE_CONFIG.upiId}` : 'Scan the QR / contact us to pay';
    note.textContent = `${upi} - now share your payment screenshot on WhatsApp to confirm the order.`;
    note.classList.remove('hidden');
    setTimeout(() => {
      Cart.clear();
      closeCheckout();
    }, 6000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  Cart.init();

  let productCatalog = [];

  if (API_CONFIG.baseUrl) {
    fetch(`${API_CONFIG.baseUrl}/api/products`)
      .then(r => r.json())
      .then(data => { productCatalog = data.products || []; })
      .catch(() => {});
  }

  // Event delegation so dynamically rendered cards also work
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn-add');
    if (!btn) return;
    const card = btn.closest('.product-card');
    if (!card) return;
    const nameEl = card.querySelector('h3');
    const priceEl = card.querySelector('.product-price');
    const imgEl = card.querySelector('img');
    const name = nameEl ? nameEl.textContent.trim() : 'Product';
    const priceText = priceEl ? priceEl.textContent.trim() : '0';
    const prices = priceText.match(/₹\s?[\d,]+/g) || [];
    const price = prices.length ? parseInt(prices[prices.length - 1].replace(/[^0-9]/g, ''), 10) : 0;
    const id = (name + '_' + price).replace(/\s+/g, '-').toLowerCase();
    const image = imgEl ? imgEl.getAttribute('src') : 'images/dress.svg';
    const catalogItem = productCatalog.find(p => p.name === name);
    Cart.add({
      id,
      name,
      price,
      image,
      productId: catalogItem ? catalogItem.id : undefined,
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
  const placeOrderBtn = document.getElementById('placeOrderBtn');
  if (placeOrderBtn) placeOrderBtn.addEventListener('click', placeOrder);
});
