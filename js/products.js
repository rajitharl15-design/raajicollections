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
      const products = data.products || [];
      if (products.length === 0) {
        grid.innerHTML = '<p class="admin-loading">No products in this category yet.</p>';
        return;
      }

      grid.innerHTML = products.map(p => {
        const price = Number(p.price);
        const old = p.old_price != null ? Number(p.old_price) : null;
        const priceHtml = (old && old > price)
          ? `<span class="old-price">₹${old.toLocaleString('en-IN')}</span> ₹${price.toLocaleString('en-IN')}`
          : `₹${price.toLocaleString('en-IN')}`;
        const badgeHtml = p.badge
          ? `<div class="product-badge ${p.badge.toLowerCase() === 'sale' ? 'sale' : ''}">${p.badge}</div>`
          : '';
        return `
        <div class="product-card">
          ${badgeHtml}
          <img src="${p.image_url || 'images/dress.svg'}" alt="${p.name}" loading="lazy">
          <div class="product-info">
            <h3>${p.name}</h3>
            <p class="product-category">${p.category_name}</p>
            <p class="product-price">${priceHtml}</p>
            <button class="btn-add">Add to Cart</button>
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
    } catch (err) {
      /* keep hardcoded cards if backend unavailable */
    }
  }
};