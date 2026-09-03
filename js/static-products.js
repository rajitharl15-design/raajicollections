// Static catalog adapter for the legacy Raaji Collections pages.
// Intercepts /api/products fetches and serves data from the shared static
// catalog (js/data.js -> PRODUCTS), so the old pages work on GitHub Pages
// without a backend/database.
(function () {
  var CATEGORY = {
    'sarees': { cat: 'Women', sub: 'Sarees' },
    'dresses': { cat: 'Women', sub: 'Dresses' },
    'ready-made-blouses': { cat: 'Women', sub: 'Readymade Blouses' },
    'night-dresses': { cat: 'Women', sub: 'Night Dresses' },
    'tops': { cat: 'Women', sub: 'Dresses' },
    'jewellery': { cat: 'Accessories', sub: 'Jewellery' },
    'kids-wear': { cat: 'Kids', sub: null },
    'kids-boys': { cat: 'Kids', sub: 'Boys' },
    'kids-girls': { cat: 'Kids', sub: 'Girls' },
    'all': { cat: null, sub: null },
    'featured': { cat: null, sub: null }
  };

  function toOld(p) {
    var sizes = (Array.isArray(p.size) && p.size.length) ? p.size : ['S', 'M', 'L'];
    return {
      id: p.id,
      name: p.name,
      price: p.price,
      old_price: p.old || null,
      badge: p.new ? 'New' : (p.sale ? 'Sale' : (p.best ? 'Best Seller' : '')),
      image_url: p.img || '',
      image_url_2: '',
      category_name: p.cat,
      category: p.cat,
      is_featured: !!p.best,
      variants: sizes.map(function (size) {
        return { size: size, color: 'One', image_url: p.img || '', price: null, stock_qty: 10, is_active: true };
      })
    };
  }

  var origFetch = window.fetch && window.fetch.bind(window);
  window.fetch = function (url, opts) {
    var s = String(url);
    if (s.indexOf('/api/products') !== -1) {
      var base;
      try { base = new URL(s, location.origin); } catch (e) { base = null; }
      var cat = base ? base.searchParams.get('category') : '';
      var map = CATEGORY[cat] || CATEGORY['all'];
      var all = (typeof PRODUCTS !== 'undefined') ? PRODUCTS : [];
      var list = all.slice();
      if (map.cat) {
        list = list.filter(function (p) { return p.cat === map.cat && (!map.sub || p.subcat === map.sub); });
      } else if (cat === 'featured') {
        list = list.filter(function (p) { return p.new || p.best; });
      }
      var products = list.map(toOld);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: function () { return Promise.resolve({ products: products }); }
      });
    }
    return origFetch ? origFetch(url, opts) : Promise.reject(new Error('fetch unavailable'));
  };
})();