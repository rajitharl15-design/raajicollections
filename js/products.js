function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function openProductLightbox(src, alt) {
  const box = document.createElement('div');
  box.className = 'product-lightbox';
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt || '';
  const close = document.createElement('span');
  close.className = 'pl-close';
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

// --- Variant picker modal ---
const COLOR_HEX = {
  red: '#c62828', pink: '#f8bbd0', rose: '#e91e63', maroon: '#800000', burgundy: '#800020',
  blue: '#1565c0', navy: '#1a237e', sky: '#4fc3f7', teal: '#00838f', green: '#2e7d32',
  olive: '#7cb342', yellow: '#fdd835', gold: '#c9a227', orange: '#ef6c00', peach: '#ffccbc',
  purple: '#6a1b9a', lavender: '#b39ddb', brown: '#6d4c41', beige: '#d7ccc8', cream: '#fff8e1',
  white: '#ffffff', black: '#212121', grey: '#9e9e9e', gray: '#9e9e9e', multi: '#ff9db6',
};

function colorSwatch(variant, size) {
  const img = variant.image_url;
  if (img) {
    return `<button class="vm-swatch" data-idx="${size}" title="${escapeAttr(variant.color)}" style="background-image:url('${escapeAttr(img)}')"></button>`;
  }
  const color = (variant.color || '').toLowerCase();
  const hex = COLOR_HEX[color] || '#d9a0b0';
  const isLight = ['white', 'cream', 'beige', 'yellow', 'gold', 'peach', 'sky'].includes(color);
  return `<button class="vm-swatch ${isLight ? 'light' : ''}" data-idx="${size}" title="${escapeAttr(variant.color)}" style="background:${hex}"></button>`;
}

function normalizeKey(s) {
  return String(s).replace(/\s+/g, ' ').trim().toLowerCase();
}

function openVariantPicker(product) {
  const variants = (product.variants || []).filter(v => v && v.size && v.color);

  // group variants by size, preserving first-seen order
  const sizes = [];
  const bySize = {};
  for (const v of variants) {
    const size = normalizeKey(v.size);
    if (!bySize[size]) {
      bySize[size] = [];
      sizes.push(size);
    }
    bySize[size].push(v);
  }

  const overlay = document.createElement('div');
  overlay.className = 'variant-modal';
  let selectedSize = sizes[0] || null;
  let selected = null;

  const selectColor = (v, size) => {
    selected = { variant: v, size: v.size };
    selectedSize = size;
    const box = overlay.querySelector('.vm-box');
    box.querySelectorAll('.vm-swatch').forEach(sw =>
      sw.classList.toggle('active', sw.dataset.idx === size && sw.title === v.color));
    box.querySelectorAll('.vm-size').forEach(chip =>
      chip.classList.toggle('active', chip.dataset.size === size));
    const img = box.querySelector('.vm-img');
    if (v.image_url && img) img.src = v.image_url;
    const price = v.price != null ? Number(v.price) : Number(product.price);
    const priceEl = box.querySelector('.vm-price-val');
    if (priceEl) priceEl.textContent = '₹' + price.toLocaleString('en-IN');
    const meta = box.querySelector('.vm-selected');
    if (meta) meta.textContent = `Selected: ${v.size} · ${v.color}`;
    box.querySelector('.vm-add').disabled = false;
  };

  const renderColors = (size) => {
    const colorsWrap = overlay.querySelector('.vm-colors');
    const list = bySize[size] || [];
    colorsWrap.innerHTML = list.length
      ? list.map(v => colorSwatch(v, size)).join('')
      : '<p class="vm-empty">No colors for this size yet.</p>';
    colorsWrap.querySelectorAll('.vm-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        const v = (bySize[size] || []).find(x => x.color === sw.title);
        if (v) selectColor(v, size);
      });
    });
  };

  const renderSizes = () => {
    const wrap = overlay.querySelector('.vm-sizes');
    wrap.innerHTML = sizes.map(size =>
      `<button class="vm-size ${size === selectedSize ? 'active' : ''}" data-size="${escapeAttr(size)}">${escapeAttr(size)}</button>`
    ).join('');
    wrap.querySelectorAll('.vm-size').forEach(chip => {
      chip.addEventListener('click', () => {
        selectedSize = chip.dataset.size;
        selected = null;
        overlay.querySelector('.vm-selected').textContent = '';
        overlay.querySelector('.vm-add').disabled = true;
        renderSizes();
        renderColors(chip.dataset.size);
      });
    });
  };

  overlay.innerHTML = `
    <div class="vm-box">
      <button class="vm-close" title="Close">&times;</button>
      <div class="vm-img-wrap">
        <img class="vm-img" src="${escapeAttr(product.image_url || 'images/dress.svg')}" alt="${escapeAttr(product.name)}">
      </div>
      <div class="vm-body">
        <h3>${escapeAttr(product.name)}</h3>
        <p class="vm-price"><span class="vm-price-val">₹${Number(product.price).toLocaleString('en-IN')}</span></p>
        <div class="vm-label">Select Size</div>
        <div class="vm-sizes"></div>
        <div class="vm-label">Select Color</div>
        <div class="vm-colors"></div>
        <p class="vm-selected"></p>
        <button class="btn-add vm-add" disabled>Select size &amp; color</button>
      </div>
    </div>`;

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('.vm-close').addEventListener('click', () => overlay.remove());
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', esc); }
  });

  overlay.querySelector('.vm-add').addEventListener('click', () => {
    if (!selected) return;
    const { variant, size } = selected;
    const price = variant.price != null ? Number(variant.price) : Number(product.price);
    const key = `p${product.productId || product.id}_${normalizeKey(size)}_${normalizeKey(variant.color)}`.replace(/[^a-z0-9_-]+/g, '-');
    if (typeof Cart !== 'undefined') {
      Cart.add({
        id: key,
        name: product.name,
        price,
        image: variant.image_url || product.image_url || 'images/dress.svg',
        productId: product.productId || product.id,
        size: variant.size,
        color: variant.color,
        variantLabel: `${variant.size} · ${variant.color}`,
      });
    }
    overlay.remove();
  });

  document.body.appendChild(overlay);
  renderSizes();
  if (selectedSize) renderColors(selectedSize);
}

function initInlinePicker(card, product) {
  if (!product) return;
  const variants = (product.variants || []).filter(v => v && v.size && v.color);
  if (variants.length === 0) return;

  const bySize = {};
  const sizeOrder = [];
  for (const v of variants) {
    const size = normalizeKey(v.size);
    if (!bySize[size]) { bySize[size] = []; sizeOrder.push(size); }
    bySize[size].push(v);
  }

  const sizeSel = card.querySelector('.pc-size');
  const colorSel = card.querySelector('.pc-color');
  const addBtn = card.querySelector('.pc-add');
  const note = card.querySelector('.pc-note');
  const imgLink = card.querySelector('.product-img-link');
  const imgEl = card.querySelector('.product-img-main');
  let activeColorKey = null;

  const colorArr = (size) => {
    const list = (bySize[size] || []).map(v => ({ v, key: normalizeKey(v.color) }));
    const seen = {};
    return list.filter(x => seen[x.key] ? false : (seen[x.key] = 1));
  };

  const reset = (msg) => {
    activeColorKey = null;
    addBtn.disabled = true;
    colorSel.disabled = true;
    colorSel.innerHTML = '<option value="">Select Color...</option>';
    note.textContent = msg || '';
  };

  const selectColor = (v, key) => {
    activeColorKey = key;
    addBtn.disabled = false;
    const price = v.price != null ? Number(v.price) : Number(product.price);
    note.textContent = `${v.size} · ${v.color} · ₹${price.toLocaleString('en-IN')}`;
    if (v.image_url) {
      imgEl.src = v.image_url;
      imgLink.dataset.img = v.image_url;
    }
  };

  const fillColors = () => {
    const list = colorArr(sizeSel.value);
    colorSel.disabled = false;
    colorSel.innerHTML = '<option value="">Select Color...</option>' +
      list.map(({ v }) => `<option value="${escapeAttr(normalizeKey(v.color))}">${escapeAttr(v.color)}</option>`).join('');
    if (list.length === 0) reset('No colors for this size.');
  };

  sizeSel.innerHTML = '<option value="">Select Size...</option>' +
    sizeOrder.map(size => `<option value="${escapeAttr(size)}">${escapeAttr(size)}</option>`).join('');

  sizeSel.addEventListener('change', () => {
    reset('');
    if (sizeSel.value) fillColors();
  });

  colorSel.addEventListener('change', () => {
    const v = (bySize[sizeSel.value] || []).find(x => normalizeKey(x.color) === colorSel.value);
    if (!v) { reset(''); return; }
    selectColor(v, colorSel.value);
  });

  addBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const v = (bySize[sizeSel.value] || []).find(x => normalizeKey(x.color) === activeColorKey);
    if (!v) return;
    const price = v.price != null ? Number(v.price) : Number(product.price);
    const key = `p${product.productId || product.id}_${normalizeKey(v.size)}_${normalizeKey(v.color)}`.replace(/[^a-z0-9_-]+/g, '-');
    if (typeof Cart !== 'undefined') {
      Cart.add({
        id: key,
        name: product.name,
        price,
        image: v.image_url || product.image_url || 'images/dress.svg',
        productId: product.productId || product.id,
        size: v.size,
        color: v.color,
        variantLabel: `${v.size} · ${v.color}`,
      });
    }
  });
}

window.ProductsRenderer = {
  apiBase: () => API_CONFIG.baseUrl || '',
  loaded: false,

  async load() {
    if (this.loaded) return;
    this.loaded = true;

    const grid = document.querySelector('.product-grid[data-products]');
    if (!grid) return;
    const categorySlug = grid.getAttribute('data-products');
    const base = API_CONFIG.baseUrl || '';
    if (!base) return; // no backend, keep static cards

    try {
      const qs = categorySlug && categorySlug !== 'all' ? `?category=${categorySlug}` : '';
      const sep = qs ? '&' : '?';
      const res = await fetch(`${base}/api/products${qs}${sep}cb=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0' } });
      if (!res.ok) throw new Error('load failed');
      const data = await res.json();
      let products = data.products || [];
      const limitAttr = grid.getAttribute('data-limit');
      if (limitAttr) {
        const limit = parseInt(limitAttr, 10);
        if (Number.isFinite(limit) && limit > 0) {
          const featured = products.filter(p => p.is_featured);
          products = (featured.length ? featured : products).slice(0, limit);
        }
      }
      if (products.length === 0) {
        grid.innerHTML = '<p class="admin-loading">No products in this category yet.</p>';
        return;
      }

      grid.innerHTML = products.map(p => {
        const forcePlain = grid.hasAttribute('data-no-variants');
        const hasVariants = !forcePlain && Array.isArray(p.variants) && p.variants.length > 0;
        const sizes = hasVariants ? [...new Set(p.variants.map(v => v.size))] : [];
        const price = Number(p.price);
        const old = p.old_price != null ? Number(p.old_price) : null;
        const priceHtml = (old && old > price)
          ? `<span class="old-price">₹${old.toLocaleString('en-IN')}</span> ₹${price.toLocaleString('en-IN')}`
          : `₹${price.toLocaleString('en-IN')}`;
        const badgeHtml = p.badge
          ? `<div class="product-badge ${p.badge.toLowerCase() === 'sale' ? 'sale' : ''}">${p.badge}</div>`
          : '';
        const variantMeta = hasVariants
          ? `<p class="product-variant-meta">${sizes.length} Size${sizes.length > 1 ? 's' : ''} · ${p.variants.length} Color${p.variants.length > 1 ? 's' : ''}</p>`
          : '';
        const actionHtml = hasVariants
          ? `<div class="pc-var" data-pid="${p.id}">
              <select class="pc-size" aria-label="Size">
                <option value="">Select Size...</option>
              </select>
              <select class="pc-color" aria-label="Color" disabled>
                <option value="">Select Color...</option>
              </select>
              <button class="btn-add pc-add" disabled>Add to Cart</button>
              <span class="pc-note"></span>
            </div>`
          : `<button class="btn-add">Add to Cart</button>`;
        return `
        <div class="product-card${hasVariants ? ' has-variants' : ''}">
          ${badgeHtml}
          <a class="product-img-link" href="#" data-img="${escapeAttr(p.image_url || 'images/dress.svg')}" title="Click to enlarge">
            <img class="product-img-main" src="${p.image_url || 'images/dress.svg'}" alt="${p.name}" loading="lazy">
            ${p.image_url_2 ? `<img class="product-img-hover" src="${escapeAttr(p.image_url_2)}" alt="${p.name}" loading="lazy">` : ''}
          </a>
          <div class="product-info">
            <h3>${p.name}</h3>
            <p class="product-category">${p.category_name}</p>
            <p class="product-price">${priceHtml}</p>
            ${variantMeta}
            ${actionHtml}
          </div>
        </div>`;
      }).join('');

      // Re-run the observer for animations
      if (typeof observer !== 'undefined') {
        document.querySelectorAll('.product-card').forEach(el => {
          el.style.opacity = '0';
          el.style.transform = 'translateY(30px)';
          observer.observe(el);
        });
      }
      document.dispatchEvent(new CustomEvent('products:rendered'));
      grid.querySelectorAll('.product-img-link').forEach(link => {
        link.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          openProductLightbox(link.dataset.img, link.querySelector('img').alt);
        });
      });
      grid.querySelectorAll('.pc-var').forEach(card => initInlinePicker(card, products.find(pr => String(pr.id) === card.dataset.pid)));
      grid.querySelectorAll('.btn-var').forEach(btn => {
        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          let variants;
          try { variants = JSON.parse(btn.dataset.variants); } catch (err) { variants = []; }
          openVariantPicker({
            id: btn.dataset.pid,
            productId: btn.dataset.pid,
            name: btn.dataset.name,
            price: Number(btn.dataset.price),
            image_url: btn.dataset.img,
            variants,
          });
        });
      });
    } catch (err) {
      /* keep hardcoded cards if backend unavailable */
    }
  }
};
