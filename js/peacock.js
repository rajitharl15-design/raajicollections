"use strict";
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const INR = (n) => "₹" + Number(n).toLocaleString("en-IN");
const params = new URLSearchParams(location.search);

let bag = JSON.parse(localStorage.getItem("ms_bag") || "[]");
let wish = JSON.parse(localStorage.getItem("ms_wish") || "[]");

/* ---------- Utils ---------- */
function save(key, v) { localStorage.setItem(key, JSON.stringify(v)); }

/* ---------- Mount shared chrome ---------- */
function overlayHTML() {
  return `
  <div class="overlay" id="overlay"></div>

  <aside class="bag" id="bagDrawer">
    <div class="bag-head"><h3><i class="fas fa-shopping-bag"></i> Bag</h3>
      <button class="del" id="bagClose"><i class="fas fa-xmark fa-lg"></i></button></div>
    <div class="savings-banner">🎉 Prices and offers are as marked · Secured with 100% payment protection</div>
    <div class="progress">
      <p id="shipMsg">Add items or get <b>free delivery</b></p>
      <div class="bar"><i id="shipBar"></i></div>
    </div>
    <div class="bag-list" id="bagList"></div>
    <div class="bag-foot">
      <div class="total"><span>Subtotal</span><span id="bagSubtotal">₹0</span></div>
      <button class="btn-pink" id="checkoutBtn">Proceed to checkout</button>
    </div>
  </aside>

  <aside class="bag" id="wishDrawer">
    <div class="bag-head"><h3><i class="fas fa-heart" style="color:var(--pink)"></i> Wishlist</h3>
      <button class="del" id="wishClose"><i class="fas fa-xmark fa-lg"></i></button></div>
    <div class="bag-list" id="wishList"></div>
  </aside>

  <div class="modal" id="modal">
    <div class="modal-box" id="modalBox"></div>
  </div>

  <!-- Easy order (WhatsApp) -->
  <div class="modal" id="orderModal">
    <div class="modal-box">
      <button class="icon-btn oclose" data-oclose aria-label="Close"><i class="fas fa-xmark"></i></button>
      <h3>Place your order</h3>
      <p class="sub">Fill the details — your order will be sent to us on WhatsApp. We confirm &amp; ship.</p>
      <div class="o-review" id="oReview"></div>
      <input id="oName" class="o-in" type="text" placeholder="Full name">
      <input id="oPhone" class="o-in" type="tel" placeholder="Phone (with WhatsApp)">
      <input id="oAddr" class="o-in" type="text" placeholder="Delivery address">
      <button class="btn-pink" id="oSend"><i class="fab fa-whatsapp"></i> Send order on WhatsApp</button>
      <p class="o-status" id="oStatus"></p>
    </div>
  </div>

  <div class="toast" id="toast"></div>`;
}

function bindHeader() {
  $("#menuBtn").addEventListener("click", () => location.href = "/store.html");
  $("#bagBtn").addEventListener("click", () => { renderBag(); openDrawer("bagDrawer"); });
  $("#wishBtn").addEventListener("click", () => { renderWish(); openDrawer("wishDrawer"); });
  $("#wishClose").addEventListener("click", () => closeDrawer("wishDrawer"));
  $("#bagClose").addEventListener("click", () => closeDrawer("bagDrawer"));
  $("#overlay").addEventListener("click", closeAllDrawers);
  $("#checkoutBtn").addEventListener("click", openOrder);

  // ---- PWA install ----
  let deferredInstall = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e;
    const el = $("#appInstallBtn");
    if (el) el.style.display = "";
    $("#appInstallBtn").addEventListener("click", async () => {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      await deferredInstall.userChoice;
      deferredInstall = null;
      if (el) el.style.display = "none";
    });
  });
  window.addEventListener("appinstalled", () => { const el = $("#appInstallBtn"); if (el) el.style.display = "none"; });

  // ---- Easy order modal ----
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-oclose]")) closeOrder();
  });
  $("#oSend").addEventListener("click", sendOrder);

  const search = $("#searchInput");
  if (search) {
    search.value = params.get("q") || "";
    search.addEventListener("keydown", (e) => {
      if (e.key === "Enter") location.href = "/listing.html?q=" + encodeURIComponent(search.value.trim());
    });
  }
  updateCounts();
}

function openDrawer(id) { $("#" + id).classList.add("show"); $("#overlay").classList.add("show"); }
function closeDrawer(id) { $("#" + id).classList.remove("show"); if (!$("#bagDrawer").classList.contains("show") && !$("#wishDrawer").classList.contains("show")) $("#overlay").classList.remove("show"); }
function closeAllDrawers() {
  $("#bagDrawer").classList.remove("show");
  $("#wishDrawer").classList.remove("show");
  $("#overlay").classList.remove("show");
}

/* ---------- Product card ---------- */
function offPct(p) { return p.old ? Math.round((1 - p.price / p.old) * 100) : 0; }

// Renders a real uploaded image, or falls back to the icon when none.
function media(p, cls) {
  if (p.img) return `<img class="${cls || ""}" src="${p.img}" alt="${p.name}" loading="lazy" onerror="this.style.display='none'">`;
  return `<span class="icon ${cls || ""}">${p.icon || "🎽"}</span>`;
}

function cardHTML(p) {
  const on = wish.includes(p.id);
  const off = offPct(p);
  return `
    <div class="pcard" data-id="${p.id}">
      <div class="pimg" style="background:${p.grad}" data-open="${p.id}">
        ${media(p, "pimg-img")}
        <button class="wish ${on ? "on" : ""}" data-wish="${p.id}" title="Wishlist"><i class="fa${on ? "s" : "r"} fa-heart"></i></button>
      </div>
      <button class="pbg" data-buy="${p.id}">Add to Bag · ${INR(p.price)}</button>
      <div class="pinfo">
        <div class="brand">Peacock</div>
        <div class="pname" data-open="${p.id}">${p.name}</div>
        <div class="price-row">
          <b>${INR(p.price)}</b>
          ${p.old ? `<span style="color:var(--muted);text-decoration:line-through">${INR(p.old)}</span>` : ""}
          ${off ? `<span class="off">(${off}% OFF)</span>` : ""}
        </div>
        ${off ? `<div class="zero">You are saving ${INR(p.old - p.price)} on this item</div>` : ""}
      </div>
    </div>`;
}

function renderInto(selector, list) {
  const el = $(selector);
  if (!el) return;
  el.innerHTML = list.length ? list.map(cardHTML).join("") : '<div class="empty-state">No products found.</div>';
}

/* ---------- Modal (size) ---------- */
function openSizeModal(p) {
  const sizes = p.size.join(", ");
  $("#modalBox").innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
      <div style="width:74px;height:92px;border-radius:6px;background:${p.grad};display:grid;place-items:center;color:#fff;font-size:1.8rem;overflow:hidden">${media(p, "m-img")}</div>
      <div>
        <h3>${p.name}</h3>
        <div class="sub">${p.cat} · ${p.subcat || ""} · ${INR(p.price)}${p.old ? ` <s style="color:var(--muted)">${INR(p.old)}</s>` : ""}</div>
      </div>
    </div>
    <div class="sub">Select size · <b>${sizes}</b></div>
    <div class="size-row">
      ${p.size.map((s) => `<button class="size-chip" data-sz="${s}">${s}</button>`).join("")}
    </div>
    <div class="modal-foot">
      <button class="btn-ghost addWish" data-wish="${p.id}">♥ Wishlist</button>
      <button class="add" data-confirm="${p.id}">Add to Bag</button>
    </div>`;
  $("#modal").classList.add("show");
  let sel = null;
  $$(".size-chip", $("#modalBox")).forEach((c) => c.addEventListener("click", () => {
    $$(".size-chip", $("#modalBox")).forEach((x) => { x.style.borderColor = "var(--line)"; x.style.color = "var(--ink)"; });
    c.style.borderColor = "var(--pink)"; c.style.color = "var(--pink)";
    sel = c.dataset.sz;
  }));
  $("#modalBox [data-confirm]").addEventListener("click", () => {
    if (!sel && p.size.length > 1) return toast("Please select a size");
    addToBag(p.id, sel || p.size[0]); closeModal();
  });
  $$("[data-wish]", $("#modalBox")).forEach((b) => b.addEventListener("click", () => { toggleWish(p.id); closeModal(); }));
}
function closeModal() { if ($("#modal")) $("#modal").classList.remove("show"); }

/* ---------- Delegated clicks ---------- */
document.addEventListener("click", (e) => {
  const open = e.target.closest("[data-open]");
  if (open) { const p = productById(open.dataset.open); if (p) openSizeModal(p); return; }

  const buy = e.target.closest("[data-buy]");
  if (buy) { const p = productById(buy.dataset.buy); if (p) openSizeModal(p); return; }

  const wishEl = e.target.closest("[data-wish]");
  if (wishEl) { toggleWish(Number(wishEl.dataset.wish)); return; }

  const del = e.target.closest("[data-del]");
  if (del) { bag = bag.filter((b) => b.key !== del.dataset.del); save("ms_bag", bag); renderBag(); updateCounts(); return; }

  const move = e.target.closest("[data-move]");
  if (move) {
    const p = productById(Number(move.dataset.move));
    if (p) { addToBag(p.id, p.size[0]); toggleWish(p.id, false); }
  }

  if (e.target.closest("[data-wqty]")) {
    const id = e.target.closest("[data-wqty]").dataset.wqty;
    openSizeModal(productById(Number(id)));
  }
});

/* ---------- Bag ---------- */
function addToBag(id, size) {
  const key = id + "" + size;
  const found = bag.find((b) => b.key === key);
  if (found) found.qty++; else bag.push({ key, id: Number(id), size, qty: 1 });
  save("ms_bag", bag);
  updateCounts();
  toast("Item added to bag 🛍️");
}
function bagTotal() { return bag.reduce((s, b) => s + productById(b.id).price * b.qty, 0); }

function renderBag() {
  const list = $("#bagList");
  if (!list) return;
  if (bag.length === 0) {
    list.innerHTML = '<div class="bag-empty">Your bag is empty<br><br>Keep shopping!</div>';
    $("#bagSubtotal").textContent = INR(0);
    setShip(0, 999);
    return;
  }
  list.innerHTML = bag.map((b) => {
    const p = productById(b.id);
    return `<div class="bitem">
      <div class="bitem-img" style="background:${p.grad}">${media(p, "b-img")}</div>
      <div class="bitem-info">
        <div class="bname">${p.name}</div>
        <div class="bsize">Size: ${b.size} · ${p.cat}</div>
        <div class="controls">
          <div class="qty">
            <button data-min="${b.key}">−</button><span>${b.qty}</span><button data-plus="${b.key}">+</button>
          </div>
          <button class="del" data-del="${b.key}"><i class="fas fa-trash-can"></i></button>
        </div>
        <div style="font-weight:700;margin-top:4px">${INR(p.price * b.qty)}</div>
      </div>
    </div>`;
  }).join("");
  const total = bagTotal();
  $("#bagSubtotal").textContent = INR(total);
  setShip(total, 999);
}

/* ---------- Easy order (WhatsApp) ---------- */
function openOrder() {
  if (bag.length === 0) return toast("Your bag is empty");
  renderOrderReview();
  $("#orderModal").classList.add("show");
  $("#oStatus").textContent = "";
}
function closeOrder() { $("#orderModal").classList.remove("show"); }

function renderOrderReview() {
  const items = bag.map((b) => {
    const p = productById(b.id);
    return `${b.qty} × ${p.name}${b.size ? " (" + b.size + ")" : ""} = ${INR(p.price * b.qty)}`;
  }).join("\n");
  const total = bagTotal();
  $("#oReview").innerHTML = `<pre>${items}\n\n<b>Total: ${INR(total)}</b></pre>`;
  $("#oPhone").value = ""; $("#oName").value = ""; $("#oAddr").value = "";
}

function sendOrder() {
  const name = $("#oName").value.trim();
  const phone = $("#oPhone").value.trim();
  const addr = $("#oAddr").value.trim();
  if (!name || !phone || !addr) return toast("Please fill your name, phone and address");
  if (bag.length === 0) return toast("Your bag is empty");
  const items = bag.map((b) => {
    const p = productById(b.id);
    return `${b.qty} × ${p.name} (₹${p.price})${b.size ? " [Size " + b.size + "]" : ""} = ₹${p.price * b.qty}`;
  }).join("\n");
  const total = bagTotal();
  const text = `*NEW ORDER — Peacock Fashions*\n\n*Customer:* ${name}\n*Phone:* ${phone}\n*Address:* ${addr}\n\n*Items:*\n${items}\n\n*Total: ₹${total}*`;
  const wa = (window.STORE_CONFIG && window.STORE_CONFIG.whatsappNumber) ? window.STORE_CONFIG.whatsappNumber : "918125491097";
  window.open("https://wa.me/" + wa + "?text=" + encodeURIComponent(text), "_blank");
  $("#oStatus").textContent = "Opening WhatsApp — press Send there to confirm your order.";
  $("#oStatus").style.color = "var(--green)";
}

function setShip(total, freeAbove) {
  const bar = $("#shipBar"), msg = $("#shipMsg");
  if (!bar || !msg) return;
  if (total >= freeAbove) {
    msg.innerHTML = "🎉 <b>You have unlocked FREE delivery!</b>";
    bar.style.width = "100%";
  } else {
    msg.innerHTML = "Add <b>" + INR(freeAbove - total) + "</b> more for FREE delivery";
    bar.style.width = Math.min(100, (total / freeAbove) * 100) + "%";
  }
}

document.addEventListener("click", (e) => {
  const min = e.target.closest("[data-min]");
  const plus = e.target.closest("[data-plus]");
  if (min) {
    const it = bag.find((b) => b.key === min.dataset.min);
    if (it) { it.qty--; if (it.qty <= 0) bag = bag.filter((b) => b.key !== it.key); }
    save("ms_bag", bag); updateCounts(); renderBag();
  }
  if (plus) {
    const it = bag.find((b) => b.key === plus.dataset.plus);
    if (it) it.qty++;
    save("ms_bag", bag); updateCounts(); renderBag();
  }
});
function idx(key) {}
document.addEventListener("click", (e) => {
  const min = e.target.closest("[data-min]");
  if (!min) return;
  const it = bag.find((b) => b.key === min.dataset.min);
  if (it) { it.qty--; if (it.qty <= 0) bag = bag.filter((b) => b.key !== it.key); }
  save("ms_bag", bag); updateCounts(); renderBag();
});

/* ---------- Wishlist ---------- */
function toggleWish(id, force) {
  const has = wish.includes(id);
  if (force === false) wish = wish.filter((w) => w !== id);
  else if (has) wish = wish.filter((w) => w !== id);
  else wish.push(id);
  save("ms_wish", wish);
  updateCounts();
  toast(has ? "Removed from wishlist" : "Saved to wishlist ♥");
  $$("[data-wish]").forEach((b) => {
    if (Number(b.dataset.wish) === id) {
      const on = wish.includes(id);
      b.classList.toggle("on", on);
      b.innerHTML = `<i class="fa${on ? "s" : "r"} fa-heart"></i>`;
    }
  });
}

function renderWish() {
  const list = $("#wishList");
  if (!list) return;
  if (wish.length === 0) {
    list.innerHTML = '<div class="bag-empty">No favourites yet</div>';
    return;
  }
  list.innerHTML = wish.map((id) => {
    const p = productById(id);
    return `<div class="bitem">
      <div class="bitem-img" style="background:${p.grad}">${media(p, "b-img")}</div>
      <div class="bitem-info">
        <div class="bname">${p.name}</div>
        <div class="bsize">${p.cat} · ${INR(p.price)}</div>
        <div class="controls" style="justify-content:flex-start;gap:10px">
          <button class="btn-pink" style="width:auto;padding:8px 14px;font-size:.8rem" data-move="${p.id}">Move to bag</button>
          <button class="del" data-del-wish="${p.id}"><i class="fas fa-trash-can"></i></button>
        </div>
      </div>
    </div>`;
  }).join("");
}

document.addEventListener("click", (e) => {
  const delW = e.target.closest("[data-del-wish]");
  if (delW) { wish = wish.filter((w) => w !== Number(delW.dataset.delWish)); save("ms_wish", wish); updateCounts(); renderWish(); }
});

function updateCounts() {
  const bc = $("#bagCount"), wc = $("#wishCount");
  if (bc) bc.textContent = bag.reduce((s, b) => s + b.qty, 0);
  if (wc) wc.textContent = wish.length;
}

/* ---------- Toast ---------- */
function toast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 1800);
}

/* ---------- Listing ---------- */
const q = (params.get("q") || "").trim().toLowerCase();
const cat = params.get("cat") || "";
const subcat = params.get("subcat") || "";

function initListing() {
  if (!$("#plpGrid") && !$("#catList")) return;
  const grid = $("#plpGrid");
  if (grid) {
    // filters
    const catList = $("#catList");
    if (catList) {
      catList.innerHTML = `<label><input type="radio" name="cat" value="" ${!cat ? "checked" : ""}> All</label>` +
        CATS.map((c) => `<label><input type="radio" name="cat" value="${c}" ${cat === c ? "checked" : ""}> ${c}</label>`).join("");
    }

    // subcategory tabs for the active category
    const bar = $("#subcatBar");
    let activeSub = subcat;
    let activeCat = cat;
    if (bar) {
      const renderChips = () => {
        const subs = [...new Set(PRODUCTS.filter((p) => p.cat === activeCat).map((p) => p.subcat))]
          .filter((s) => s !== "Readymade Blouses"); // hidden from Peacock nav/filters
        bar.innerHTML = subs.map((s) =>
          `<button class="chip ${s === activeSub ? "chip-on" : ""}" data-sub="${s}">${s}</button>`).join("");
      };
      renderChips();
      $$(".chip", bar).forEach((ch) => ch.addEventListener("click", () => {
        activeSub = activeSub === ch.dataset.sub ? "" : ch.dataset.sub;
        renderChips();
        apply();
      }));
    }

    const apply = () => {
      const sel = catList ? (document.querySelector('input[name="cat"]:checked')?.value || "") : cat;
      const maxP = $("#priceMax")?.value || 99999;
      const sort = $("#sortBy")?.value || "popularity";
      let list = PRODUCTS.slice();
      if (sel) list = list.filter((p) => p.cat === sel);
      if (activeSub) list = list.filter((p) => p.subcat === activeSub);
      if (subcat && !activeSub) list = list.filter((p) => p.subcat === subcat);
      if (q) list = list.filter((p) => (p.name + " " + p.cat + " " + p.subcat).toLowerCase().includes(q));
      list = list.filter((p) => p.price <= +maxP);
      if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
      else if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
      else if (sort === "discount") list.sort((a, b) => offPct(b) - offPct(a));
      $("#resultCount").textContent = list.length + " items";
      $("#resultTitle").textContent = sel + (activeSub ? " · " + activeSub : "");
      renderInto("#plpGrid", list);
    };

    $("#applyFilters").addEventListener("click", apply);
    $$('input[name="cat"]').forEach((r) => r.addEventListener("change", () => {
      activeCat = document.querySelector('input[name="cat"]:checked')?.value || "";
      activeSub = "";
      renderChips();
      apply();
    }));
    $("#sortBy") && $("#sortBy").addEventListener("change", apply);
    $("#priceMax") && $("#priceMax").addEventListener("input", () => {
      $("#priceLabel").textContent = INR($("#priceMax").value);
      apply();
    });
    apply();
    return;
  }
}

/* ---------- Home ---------- */
function initHome() {
  if (!$("#slides")) return;
  // carousel
  let i = 0;
  const slides = $("#slides"), total = $$(".slide", slides).length;
  const go = (n) => {
    i = (n + total) % total;
    slides.style.transform = `translateX(-${i * 100}%)`;
  };
  $("#prev").addEventListener("click", () => go(i - 1));
  $("#next").addEventListener("click", () => go(i + 1));
  setInterval(() => go(i + 1), 5000);

  renderInto("#rowNew", PRODUCTS.slice(0, 8));
  renderInto("#rowBest", PRODUCTS.slice(8, 14).concat(PRODUCTS.slice(0, 2)));
  renderInto("#rowWomen", PRODUCTS.filter((p) => p.cat === "Women").slice(0, 6));
  renderInto("#rowMen", PRODUCTS.filter((p) => p.cat === "Men").slice(0, 5));
  renderInto("#rowAccess", PRODUCTS.filter((p) => p.cat === "Accessories").slice(0, 5));
}

/* ---------- Boot ---------- */
function applyOverrides() {
  try {
    const o = JSON.parse(localStorage.getItem("ms_overrides") || "{}");
    for (const id in o) {
      const p = PRODUCTS.find((x) => x.id === Number(id));
      if (!p) continue;
      const d = o[id];
      if (d.name !== undefined) p.name = d.name;
      if (d.price !== undefined) p.price = +d.price;
      if (d.old !== undefined) p.old = d.old ? +d.old : 0;
      if (d.cat) p.cat = d.cat;
      if (d.subcat) p.subcat = d.subcat;
      if (d.size) p.size = d.size.split(",").map((s) => s.trim()).filter(Boolean);
      if (d.img !== undefined) p.img = d.img;
    }
  } catch (e) {}
}

function boot() {
  // NOTE: local admin overrides no longer apply to the public store. To publish
  // edits (name/price/image), use the Catalog Editor's "Export data.js" and push.
  mountApp();
  document.body.insertAdjacentHTML("beforeend", overlayHTML());
  bindHeader();
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  initHome();
  initListing();
}

document.addEventListener("DOMContentLoaded", boot);