function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Derive a compressed WebP thumbnail for locally-served product photos, so
// grid cards load a small image instead of the full-res file. Returns null for
// external/uploaded images (caller keeps the full image in that case).
function thumbSrc(u) {
  const s = String(u || '').replace(/\\/g, '/');
  if (!s.startsWith('/images/products/') && !s.startsWith('images/products/')) return null;
  const i = s.lastIndexOf('/');
  return s.slice(0, i + 1) + 'thumbs/' + s.slice(i + 1).replace(/\.[^./]+$/, '') + '.webp';
}

// Build a grid <img> that uses the thumbnail and falls back to the full image
// if the thumb is missing or fails to load.
function imgSrcset(u, cls, alt) {
  const full = u || 'images/dress.svg';
  const thumb = thumbSrc(full);
  const a = escapeAttr(alt || '');
  if (!thumb) {
    return `<img class="${cls}" src="${escapeAttr(full)}" alt="${a}" loading="lazy" decoding="async">`;
  }
  const escFull = escapeAttr(full);
  const onerr = "onerror=\"this.onerror=null;this.removeAttribute('srcset');this.removeAttribute('sizes');this.src='" + escFull + "'\"";
  return `<img class="${cls}" src="${escapeAttr(thumb)}" srcset="${escapeAttr(thumb)} 500w, ${escFull} 1000w" sizes="(max-width:600px) 46vw, 24vw" alt="${a}" loading="lazy" decoding="async" ${onerr}>`;
}

function openProductLightbox(src, alt, product, isKids) {
  const box = document.createElement('div');
  box.className = 'product-lightbox';
  const close = document.createElement('span');
  close.className = 'pl-close';
  close.innerHTML = '&times;';
  close.addEventListener('click', e => { e.stopPropagation(); box.remove(); });

  if (product) {
    // Two-panel "open image": zoomable photo alongside full product details.
    box.className = 'product-lightbox product-detail-view';
    const inner = document.createElement('div');
    inner.className = 'pl-detail';
    inner.appendChild(close);

    const imgPanel = document.createElement('div');
    imgPanel.className = 'pl-img-panel';
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || product.name || '';
    img.className = 'pl-img';
    img.loading = 'eager';
    let zoomed = false;
    const toggleZoom = (e) => { e.stopPropagation(); zoomed = !zoomed; img.classList.toggle('zoomed', zoomed); };
    img.addEventListener('click', toggleZoom);
    const hint = document.createElement('span');
    hint.className = 'pl-zoom-hint';
    hint.textContent = 'Click to zoom';
    imgPanel.appendChild(img);
    imgPanel.appendChild(hint);

    const details = document.createElement('div');
    details.className = 'pl-info';
    const price = Number(product.price);
    const old = product.old_price != null ? Number(product.old_price) : null;
    let html = '';
    if (product.category_name) html += `<p class="pl-cat">${escapeAttr(product.category_name)}</p>`;
    html += `<h2>${escapeAttr(product.name)}</h2>`;
    if (product.material) html += `<p class="pl-material">${escapeAttr(product.material)}</p>`;
    if (product.description) html += `<p class="pl-desc">${escapeAttr(product.description)}</p>`;
    html += `<p class="pl-price">${old && old > price ? `<span class="old-price">₹${old.toLocaleString('en-IN')}</span>` : ''} <b>₹${price.toLocaleString('en-IN')}</b></p>`;
    html += `<button class="btn-add pl-action">Add to Bag</button>`;
    details.innerHTML = html;
    details.querySelector('.pl-action').addEventListener('click', (e) => {
      e.stopPropagation();
      box.remove();
      openQuickView(product, !!isKids);
    });

    inner.appendChild(imgPanel);
    inner.appendChild(details);
    box.appendChild(inner);
  } else {
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || '';
    box.appendChild(close);
    box.appendChild(img);
  }

  box.addEventListener('click', (e) => { if (e.target === box) box.remove(); });
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
  // No real inventory for the online catalog — treat every item as in stock.
  const inStock = () => true;
  const productStock = 1;
  const productStockKnown = false;
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
        String(x.size).trim().toLowerCase() === String(s).trim().toLowerCase());
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
    openProductLightbox(imgEl.src, imgEl.alt, product, isKids);
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('.quickview-close').addEventListener('click', () => overlay.remove());
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', esc); }
  });
  document.body.appendChild(overlay);
}

// Fall back to the static catalog (js/data.js -> PRODUCTS) for any price that
// is missing or zero in the database, so items display with their correct
// names/prices even if the DB catalog wasn't populated with pricing.
function hydrateFromStatic(p) {
  if (typeof PRODUCTS === 'undefined' || !PRODUCTS || !p) return p;
  const urlKey = String(p.image_url || '').replace(/\\/g, '/').split('/').pop().toLowerCase();
  const hit = PRODUCTS.find(s => String(s.img || '').replace(/\\/g, '/').split('/').pop().toLowerCase() === urlKey);
  if (!hit) return p;
  const merged = Object.assign({}, p);
  if (merged.price == null || Number(merged.price) <= 0) merged.price = Number(hit.price) || merged.price;
  if (merged.old_price == null || Number(merged.old_price) <= 0) merged.old_price = hit.old != null ? Number(hit.old) : merged.old_price;
  if (!merged.name) merged.name = hit.name;
  return merged;
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

    // Per-grid render helpers, defined once so the static and live renders share them.
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
            ${imgSrcset(p.image_url, 'product-img-main', p.name)}
            ${p.image_url_2 ? imgSrcset(p.image_url_2, 'product-img-hover', p.name) : ''}
          </a>
          <div class="product-info">
            <h3>${p.name}</h3>
            <p class="product-category">${p.category_name}</p>
            ${p.material ? `<p class="product-material">${escapeAttr(p.material)}</p>` : ''}
            ${p.description ? `<p class="product-desc">${escapeAttr(p.description)}</p>` : ''}
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
            // Open image with product details + zoom in one view.
            openProductLightbox(link.dataset.img, link.querySelector('img').alt, product, grid.hasAttribute('data-kids-sizes'));
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

    const norm = (s) => String(s || '').trim().toLowerCase();
    const JHUMKA_SLUGS = new Set([
      'img-20260817-wa0085', 'img-20260817-wa0087', 'img-20260817-wa0088',
      'img-20260817-wa0089', 'img-20260817-wa0090', 'img-20260817-wa0091',
      'img-20260817-wa0092', 'img-20260817-wa0094', 'img-20260817-wa0095',
      'img-20260817-wa0096', 'img-20260817-wa0097', 'img-20260817-wa0100',
      'img-20260821-wa0089', 'img-20260821-wa0090', 'img-20260821-wa0091',
      'img-20260821-wa0092', 'img-20260821-wa0093', 'img-20260821-wa0094',
      'img-20260821-wa0095'
    ]);
    const imgSlug = (p) => String(p.image_url || '').replace(/\\/g, '/').split('/').pop()
      .toLowerCase().replace(/\.(jpe?g|png|webp|avif)$/, '').replace(/^jewellery-/, '');
    const matchSubcat = (groups, p, group) => {
      const assigned = (() => {
        if (JHUMKA_SLUGS.has(imgSlug(p))) return 'Jhumkas';
        if (!p.subcategory) return null;
        const want = norm(p.subcategory);
        for (const g of groups) {
          if (norm(g.label) === want || g.rules.some(r => norm(r) === want)) return g.label;
        }
        return null;
      })();
      if (assigned) return assigned === group.label;
      const rules = group.rules;
      if (rules.length === 0) return true;
      const text = `${p.name || ''} ${p.category_name || ''} ${p.description || ''}`.toLowerCase();
      return rules.some(r => text.includes(r.toLowerCase()));
    };

    // Mutable source list so subcat tabs (built once) can re-filter after the
    // live DB refresh without rebuilding the tab bar.
    let sourceList = [];
    let activeGroup = null;
    let tabWrap = null;

    // Applies featured/limit, then renders a product list. Static list paints
    // the grid instantly; the live DB call re-renders it in the background.
    const renderProducts = (list) => {
      let src = list || [];
      const limitAttr = grid.getAttribute('data-limit');
      if (limitAttr) {
        const limit = parseInt(limitAttr, 10);
        if (Number.isFinite(limit) && limit > 0) {
          const featured = src.filter(p => p.is_featured);
          src = (featured.length ? featured : src).slice(0, limit);
        }
      }
      sourceList = src;

      const subcats = grid.getAttribute('data-subcats');
      if (!subcats) {
        if (src.length === 0) {
          if (!grid.dataset.rendered) grid.innerHTML = '<p class="admin-loading">No products in this category yet.</p>';
          return;
        }
        renderGrid(src);
        wireCardEvents(src);
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
        grid.dataset.rendered = '1';
        return;
      }

      let parsed;
      try { parsed = JSON.parse(subcats); } catch (err) { parsed = []; }
      const groups = Array.isArray(parsed) ? parsed : [];
      const noAll = grid.hasAttribute('data-no-all');
      const allGroup = { label: 'All', rules: [] };
      const tabGroups = noAll ? groups : [allGroup, ...groups];

      const needTabs = !tabWrap || !tabWrap.isConnected;
      if (needTabs) {
        tabWrap = document.createElement('div');
        tabWrap.className = 'subcat-tabs';
        grid.parentNode.insertBefore(tabWrap, grid);
      }

      const showGroup = (group) => {
        tabWrap.querySelectorAll('.subcat-tab').forEach(t => t.classList.toggle('active', t.dataset.label === group.label));
        const filtered = sourceList.filter(p => matchSubcat(groups, p, group));
        renderGrid(filtered);
        wireCardEvents(filtered);
      };

      if (needTabs) {
        for (const g of tabGroups) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'subcat-tab';
          btn.dataset.label = g.label;
          btn.textContent = g.label;
          btn.addEventListener('click', () => showGroup(g));
          tabWrap.appendChild(btn);
        }
        if (typeof observer !== 'undefined') {
          document.querySelectorAll('.product-card').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            observer.observe(el);
          });
        }
      }
      if (!activeGroup) activeGroup = noAll && groups[0] ? groups[0] : allGroup;
      showGroup(activeGroup);
      grid.dataset.rendered = '1';
    };

    // Cache the live DB catalog in the browser so repeat visits show your
    // updated prices/products instantly (even if the backend is briefly asleep),
    // instead of the older bundled data.js snapshot.
    const CACHE_KEY = 'raaji_products_v2';
    const readCatalogCache = () => {
      try {
        if (typeof localStorage === 'undefined') return null;
        const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (c && Array.isArray(c.products) && Date.now() - c.ts < 7 * 24 * 3600 * 1000) return c.products;
      } catch (e) {}
      return null;
    };
    const writeCatalogCache = (products) => {
      try {
        if (typeof localStorage === 'undefined' || !Array.isArray(products)) return;
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), products }));
      } catch (e) {}
    };

    // 1) Paint instantly — prefer the last-known live DB catalog if we have one,
    //    otherwise fall back to the bundled static catalog (js/data.js).
    const SS = window.StaticProducts || { list: () => [] };
    const cached = readCatalogCache();
    renderProducts(cached && cached.length ? cached.map(hydrateFromStatic) : SS.list(categorySlug));

    // 2) Refresh from the live DB in the background. A 5s timeout means a cold
    //    Render instance can't stall the page — the render on screen stays up.
    const base = API_CONFIG.baseUrl || '';
    if (!base) return;
    try {
      const qs = categorySlug && categorySlug !== 'all' ? `?category=${categorySlug}` : '';
      const sep = qs ? '&' : '?';
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 5000) : null;
      try {
        const res = await fetch(`${base}/api/products${qs}${sep}cb=${Date.now()}`, {
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0' },
          signal: ctrl ? ctrl.signal : undefined,
        });
        if (timer) clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          writeCatalogCache(data.products || []);
          renderProducts((data.products || []).map(hydrateFromStatic));
        }
      } catch (e) {
        if (timer) clearTimeout(timer);
        /* keep the render on screen */
      }
    } catch (e) {
      /* keep the render on screen */
    }
  }
};
