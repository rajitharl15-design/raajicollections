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

const KIDS_STORE_SIZES = [
  '2-3', '3-4', '4-5', '5-6', '6-7', '7-8',
  '8-9', '9-10', '10-11', '11-12', '12-13', '13-14'
];

function openQuickView(product, isKids) {
  const overlay = document.createElement('div');
  overlay.className = 'quickview-modal';

  const variants = (product.variants || []).filter(v => v && v.size && v.color);
  const inStock = (q) => q == null ? true : Number(q) > 0;
  const productStock = Number(product.stock_qty) || 0;
  const productStockKnown = product.stock_qty != null;
  const sizeHasStock = (s) => (variants || []).some(v =>
    String(v.size).trim().toLowerCase() === String(s).trim().toLowerCase() &&
    inStock(v.stock_qty));
  const sizeOptions = isKids
    ? (() => {
      const allOut = productStockKnown && productStock <= 0;
      return KIDS_STORE_SIZES.map(s =>
        `<option value="${s}" ${allOut ? 'disabled' : ''}>${s} yr${allOut ? ' (Out of Stock)' : ''}</option>`).join('');
    })()
    : [...new Set(variants.map(v => v.size))].map(s => {
        const inStock = sizeHasStock(s);
        return `<option value="${escapeAttr(s)}" ${inStock ? '' : 'disabled'}>${escapeAttr(s)}${inStock ? '' : ' (Out of Stock)'}</option>`;
      }).join('');

  const price = Number(product.price);
  const old = product.old_price != null ? Number(product.old_price) : null;
  const noSize = !isKids && variants.length === 0;
  const allSizesGone = !isKids && variants.length > 0 &&
    variants.some(v => v.stock_qty != null) &&
    !variants.some(v => inStock(v.stock_qty));
  const allKidsGone = isKids && productStockKnown && productStock <= 0;

  const galleryImages = (product.images && product.images.length ? product.images : [product.image_url || 'images/dress.svg'])
    .map((u, i) => ({ src: u, id: i }));
  const galleryHasMany = galleryImages.length > 1;

  overlay.innerHTML = `
    <div class="quickview-box">
      <button class="quickview-close" title="Close">&times;</button>
      <div class="quickview-img-wrap">
        ${galleryHasMany ? `<button class="qv-nav qv-prev" type="button" aria-label="Previous image">&lsaquo;</button><button class="qv-nav qv-next" type="button" aria-label="Next image">&rsaquo;</button>` : ''}
        <img class="quickview-img" src="${escapeAttr(galleryImages[0].src)}" alt="${escapeAttr(product.name)}"><span class="quickview-tap">Click image to enlarge</span>
        ${galleryHasMany ? `<div class="qv-thumbs">${galleryImages.map((g, i) => `<button type="button" class="qv-thumb ${i===0?'active':''}" data-gidx="${i}" style="background-image:url('${escapeAttr(g.src)}')"></button>`).join('')}</div>` : ''}
      </div>
      <div class="quickview-body">
        <h2>${escapeAttr(product.name)}</h2>
        <p class="product-category">${escapeAttr(product.category_name || '')}</p>
        <p class="quickview-price">${old && old > price ? `<span class="old-price">₹${old.toLocaleString('en-IN')}</span> ` : ''}₹${price.toLocaleString('en-IN')}</p>
        ${noSize ? '' : `
        <label class="quickview-label">Size${isKids ? ' (for age)' : ''}</label>
        <select class="quickview-size"><option value="">Select Size...</option>${sizeOptions}</select>`}
        <p class="quickview-note"></p>
        <button class="btn-add quickview-add" ${noSize ? '' : 'disabled'}>Add to Cart</button>
      </div>
    </div>`;

  const sizeSel = overlay.querySelector('.quickview-size');
  const addBtn = overlay.querySelector('.quickview-add');
  const note = overlay.querySelector('.quickview-note');
  const imgEl = overlay.querySelector('.quickview-img');
  let galleryIdx = 0;
  const setGallery = (i) => {
    galleryIdx = (i + galleryImages.length) % galleryImages.length;
    imgEl.src = galleryImages[galleryIdx].src;
    overlay.querySelectorAll('.qv-thumb').forEach(th => th.classList.toggle('active', Number(th.dataset.gidx) === galleryIdx));
  };
  const prevBtn = overlay.querySelector('.qv-prev');
  const nextBtn = overlay.querySelector('.qv-next');
  if (prevBtn) prevBtn.addEventListener('click', e => { e.stopPropagation(); setGallery(galleryIdx - 1); });
  if (nextBtn) nextBtn.addEventListener('click', e => { e.stopPropagation(); setGallery(galleryIdx + 1); });
  overlay.querySelectorAll('.qv-thumb').forEach(th => {
    th.addEventListener('click', e => { e.stopPropagation(); setGallery(Number(th.dataset.gidx)); });
  });
  let picked = null;

  const pickVariant = () => {
    const s = sizeSel ? sizeSel.value : '';
    if (noSize) {
      picked = { size: '', color: '', image: product.image_url, price, variantLabel: '' };
    } else if (isKids) {
      if (!s || productStockKnown && productStock <= 0) picked = null;
      else picked = { size: `${s} yr`, color: '', image: product.image_url, price, variantLabel: `Size ${s} yr` };
    } else {
      const v = (variants || []).find(x =>
        String(x.size).trim().toLowerCase() === String(s).trim().toLowerCase() &&
        Number(x.stock_qty) > 0);
      if (!v) picked = null;
      else picked = {
        size: v.size,
        color: v.color,
        image: v.image_url || product.image_url,
        price: v.price != null ? Number(v.price) : price,
        variantLabel: `${v.size} · ${v.color}`,
        src: v.image_url,
      };
    }
    addBtn.disabled = !picked || (allSizesGone && !isKids) || allKidsGone;
    note.textContent = picked ? (picked.variantLabel ? `Selected: ${picked.variantLabel} · ₹${picked.price.toLocaleString('en-IN')}` : '') : '';
    if (picked && (isKids ? false : picked.src)) imgEl.src = picked.src;
  };

  if (sizeSel) sizeSel.addEventListener('change', pickVariant);
  if (noSize) pickVariant();
  if (allSizesGone || allKidsGone || (noSize && productStockKnown && productStock <= 0)) {
    note.textContent = 'Out of Stock';
    note.style.color = '#C62828';
    addBtn.disabled = true;
  }

  addBtn.addEventListener('click', () => {
    if (!picked) return;
    const sizeKey = picked.variantLabel ? String(sizeSel.value) : '';
    const key = `p${product.productId || product.id}_${String(sizeKey).replace(/[^a-z0-9_-]+/g, '-')}`.replace(/[^a-z0-9_-]+/g, '-');
    if (typeof Cart !== 'undefined') {
      Cart.add({
        id: key,
        name: product.name,
        price: picked.price,
        image: picked.image || 'images/dress.svg',
        productId: product.productId || product.id,
        size: picked.size,
        color: picked.color,
        variantLabel: picked.variantLabel,
      });
    }
    overlay.remove();
  });

  overlay.querySelector('.quickview-img-wrap').addEventListener('click', e => {
    e.stopPropagation();
    openProductLightbox(imgEl.src, imgEl.alt);
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('.quickview-close').addEventListener('click', () => overlay.remove());
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', esc); }
  });
  document.body.appendChild(overlay);
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

      const renderGrid = (list) => {
        grid.innerHTML = list.map(p => {
          const isKids = grid.hasAttribute('data-kids-sizes');
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
          const actionHtml = `<button class="btn-add quickview-open" data-pid="${p.id}">${hasVariants || isKids ? 'View &amp; Add to Cart' : 'Add to Cart'}</button>`;
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
        if (list.length === 0) {
          grid.innerHTML = '<p class="admin-loading">No products in this category yet.</p>';
        }
        if (typeof observer !== 'undefined') {
          document.querySelectorAll('.product-card').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            observer.observe(el);
          });
        }
        document.dispatchEvent(new CustomEvent('products:rendered'));
      };

      const wireCardEvents = (list) => {
        grid.querySelectorAll('.product-img-link').forEach(link => {
          link.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            const card = link.closest('.product-card');
            const qvBtn = card.querySelector('.quickview-open');
            const product = list.find(pr => String(pr.id) === (qvBtn || {}).dataset.pid);
            if (product) {
              openQuickView(product, grid.hasAttribute('data-kids-sizes'));
            } else {
              openProductLightbox(link.dataset.img, link.querySelector('img').alt);
            }
          });
        });
        grid.querySelectorAll('.quickview-open').forEach(btn => {
          btn.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            const product = list.find(pr => String(pr.id) === btn.dataset.pid);
            if (product) openQuickView(product, grid.hasAttribute('data-kids-sizes'));
          });
        });
      };

      const subcats = grid.getAttribute('data-subcats');
      if (subcats) {
        let parsed;
        try { parsed = JSON.parse(subcats); } catch (err) { parsed = []; }
        const groups = Array.isArray(parsed) ? parsed : [];
        const norm = (s) => String(s || '').trim().toLowerCase();
        const assignedSubcat = (p) => {
          if (!p.subcategory) return null;
          const want = norm(p.subcategory);
          for (const g of groups) {
            if (norm(g.label) === want || g.rules.some(r => norm(r) === want)) return g.label;
          }
          return null;
        };
        const matchSubcat = (p, group) => {
          const assigned = assignedSubcat(p);
          if (assigned) return assigned === group.label;
          const rules = group.rules;
          if (rules.length === 0) return true;
          const text = `${p.name || ''} ${p.category_name || ''} ${p.description || ''}`.toLowerCase();
          return rules.some(r => text.includes(r.toLowerCase()));
        };
        const tabWrap = document.createElement('div');
        tabWrap.className = 'subcat-tabs';
        const noAll = grid.hasAttribute('data-no-all');
        const allGroup = { label: 'All', rules: [] };
        const showGroup = (group) => {
          tabWrap.querySelectorAll('.subcat-tab').forEach(t => t.classList.toggle('active', t.dataset.label === group.label));
          const list = products.filter(p => matchSubcat(p, group));
          renderGrid(list);
          wireCardEvents(list);
        };
        const tabGroups = noAll ? groups : [allGroup, ...groups];
        for (const g of tabGroups) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'subcat-tab';
          btn.dataset.label = g.label;
          btn.textContent = g.label;
          btn.addEventListener('click', () => showGroup(g));
          tabWrap.appendChild(btn);
        }
        grid.parentNode.insertBefore(tabWrap, grid);
        if (typeof observer !== 'undefined') {
          document.querySelectorAll('.product-card').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            observer.observe(el);
          });
        }
        showGroup(noAll && groups[0] ? groups[0] : allGroup);
        return;
      }

      renderGrid(products);
      wireCardEvents(products);
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
