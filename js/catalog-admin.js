"use strict";
const $ = (sel, c = document) => c.querySelector(sel);
const KEY = "ms_overrides";
let overrides = JSON.parse(localStorage.getItem(KEY) || "{}");
let deleted = new Set(JSON.parse(localStorage.getItem("ms_deleted") || "[]"));
function persistDeleted() { localStorage.setItem("ms_deleted", JSON.stringify([...deleted])); }
let activeCat = "";
let activeSubcat = "";

function catOptions(sel) {
  return `<option value="">(none)</option>` + CATS.map((c) => `<option ${c === sel ? "selected" : ""}>${c}</option>`).join("");
}
function subcatOptions(sel, cat) {
  const subs = cat ? [...new Set(PRODUCTS.filter((p) => p.cat === cat).map((p) => p.subcat))] : SUBCATS;
  return `<option value="">(none)</option>` + subs.map((s) => `<option ${s === sel ? "selected" : ""}>${s}</option>`).join("");
}

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }

function renderFilters() {
  const extra = ["Readymade Blouses"];
  $("#catFilter").innerHTML =
    `<button class="chip ${!activeCat ? "chip-on" : ""}" data-cat="">All</button>` +
    CATS.map((c) => `<button class="chip ${activeCat === c ? "chip-on" : ""}" data-cat="${c}">${c}</button>`).join("") +
    extra.map((c) => `<button class="chip ${activeCat === c ? "chip-on" : ""}" data-cat="${c}">${c}</button>`).join("");
  renderSubcatFilter();
}
function renderCatFilter() {}

function renderSubcatFilter() {
  const el = $("#subcatFilter");
  if (!el) return;
  const subs = activeCat
    ? [...new Set(PRODUCTS.filter((p) => p.cat === activeCat).map((p) => p.subcat))]
    : SUBCATS;
  el.innerHTML = `<option value="">(all subcategories)</option>` +
    subs.map((s) => `<option value="${esc(s)}" ${s === activeSubcat ? "selected" : ""}>${esc(s)}</option>`).join("");
}

function rowHTML(p) {
  const o = overrides[p.id] || {};
  const isDeleted = deleted.has(p.id);
  const effImg = o.img !== undefined ? o.img : p.img;
  const thumb = effImg ? `<img class="thumb" src="${effImg}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'thumb-ph',textContent:'📷'}))">`
                    : `<div class="thumb-ph">${p.icon || "🎽"}</div>`;
  const dirty = isDeleted || (o.name !== undefined || o.price !== undefined || o.old !== undefined || o.cat || o.subcat || o.size || o.img !== undefined) ? "row-dirty" : "";
  return `<tr class="${dirty}" data-id="${p.id}">
    <td><div style="display:flex;flex-direction:column;gap:5px;align-items:flex-start">
      ${thumb}
      <label class="chip" style="padding:4px 8px;font-size:.68rem;cursor:pointer">⬆ img<input type="file" accept="image/*" data-upimg="${p.id}" hidden></label>
      ${effImg ? `<button class="chip" style="padding:4px 8px;font-size:.68rem" data-delimg="${p.id}">✕ del img</button>` : ""}
      <button class="chip" style="padding:4px 8px;font-size:.68rem" data-toggle-del="${p.id}">${isDeleted ? "↩ undo" : "🗑 delete"}</button>
    </div></td>
    <td><input data-f="name" value="${esc(o.name !== undefined ? o.name : p.name)}" title="${esc(p.name)}"></td>
    <td><select class="cat-sel" data-f="cat">${catOptions(o.cat || p.cat)}</select></td>
    <td><select class="subcat-sel" data-f="subcat">${subcatOptions(o.subcat || p.subcat, o.cat || p.cat)}</select></td>
    <td><input class="narrow" type="number" min="0" data-f="price" value="${o.price !== undefined ? o.price : p.price}"></td>
    <td><input class="narrow" type="number" min="0" data-f="old" value="${o.old !== undefined ? o.old : p.old || 0}"></td>
    <td><input data-f="size" value="${esc((o.size || (p.size || []).join(",")))}" placeholder="S,M,L,XL"></td>
  </tr>`;
}

function renderRows() {
  let list = PRODUCTS.slice();
  if (activeCat === "Readymade Blouses") list = list.filter((p) => p.subcat === "Readymade Blouses");
  else if (activeCat) list = list.filter((p) => p.cat === activeCat);
  if (activeSubcat) list = list.filter((p) => p.subcat === activeSubcat);
  $("#rows").innerHTML = list.map(rowHTML).join("");
  $("#totalCount").textContent = PRODUCTS.length;
  $("#shownCount").textContent = list.length;
  $("#rows").querySelectorAll("input,select").forEach((el) => el.addEventListener("change", onEdit));
}

function onEdit(e) {
  const el = e.target;
  const tr = el.closest("tr");
  const id = Number(tr.dataset.id);
  overrides[id] = overrides[id] || {};
  overrides[id][el.dataset.f] = el.value;
  if (overrides[id].old === "0" || overrides[id].old === "") overrides[id].old = 0;
  tr.classList.add("row-dirty");
  markSaved(true);
}

let saveTimer;
function markSaved(on) {
  const s = $("#saveStatus");
  if (on) { s.textContent = "Saving…"; clearTimeout(saveTimer); saveTimer = setTimeout(() => { persist(); s.textContent = "✓ Saved locally to " + new Date().toLocaleTimeString(); }, 400); }
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(overrides));
}

function initToken() {
  const inp = $("#tokenInput");
  if (!inp) return;
  inp.value = localStorage.getItem("pf_token") || "";
  inp.addEventListener("change", () => {
    localStorage.setItem("pf_token", inp.value.trim());
    $("#saveStatus").textContent = "✓ Upload token saved";
  });
}

// Build the final live catalog: apply edits AND drop deleted products.
function finalCatalog() {
  return PRODUCTS.filter((p) => !deleted.has(p.id)).map((p) => {
    const o = overrides[p.id] || {};
    return {
      id: p.id,
      name: o.name !== undefined ? o.name : p.name,
      cat: o.cat || p.cat,
      subcat: o.subcat || p.subcat,
      price: o.price !== undefined ? o.price : p.price,
      old: o.old !== undefined ? o.old : (p.old || 0),
      img: o.img !== undefined ? o.img : p.img,
      size: (o.size || (p.size || []).join(",")).split(",").map((s) => s.trim()).filter(Boolean),
      ...(p.icon ? { icon: p.icon } : {}),
      ...(p.grad ? { grad: p.grad } : {}),
      ...(p.rating ? { rating: p.rating } : {}),
      ...(p.desc ? { desc: p.desc } : {}),
    };
  });
}

async function publish() {
  const list = finalCatalog();
  try {
    const key = localStorage.getItem("peacock_admin_key") || "";
    const res = await fetch("/api/peacock-admin/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(key ? { "x-admin-key": key } : {}) },
      body: JSON.stringify({ products: list }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || ("Publish failed (" + res.status + ")"));
    $("#saveStatus").textContent = "✓ Published to store — " + list.length + " products live now";
  } catch (err) {
    $("#saveStatus").textContent = "✗ " + err.message + " (are you signed in? check the Admin login)";
  }
}

function exportDataJS() {
  const list = finalCatalog().map((p) => {
    const fields = [`  { id: ${p.id}`];
    fields.push(`name: ${JSON.stringify(p.name)}`);
    fields.push(`cat: ${JSON.stringify(p.cat)}`);
    fields.push(`subcat: ${JSON.stringify(p.subcat)}`);
    fields.push(`price: ${p.price}`);
    fields.push(`old: ${p.old}`);
    if (p.img) fields.push(`img: ${JSON.stringify(p.img)}`);
    if (p.icon) fields.push(`icon: ${JSON.stringify(p.icon)}`);
    if (p.grad) fields.push(`grad: ${JSON.stringify(p.grad)}`);
    if (p.rating) fields.push(`rating: ${p.rating}`);
    fields.push(`size: ${JSON.stringify(p.size)}`);
    if (p.desc) fields.push(`desc: ${JSON.stringify(p.desc)}`);
    return fields.join(", ") + " },";
  }).join("\n");
  const js = "let PRODUCTS = [\n" + list + "\n];\n\nfunction productById(id) {\n  return PRODUCTS.find((p) => p.id === Number(id));\n}\n\nlet CATS = [\"Women\", \"Men\", \"Kids\", \"Accessories\"];\nlet SUBCATS = [...new Set(PRODUCTS.map((p) => p.subcat))];\n";
  const blob = new Blob([js], { type: "text/javascript" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "data.js";
  a.click();
  URL.revokeObjectURL(a.href);
  $("#saveStatus").textContent = "✓ Exported data.js — replace js/data.js and push (or just use Publish)";
}

function setImageLocal(id, dataUrl) {
  overrides[id] = overrides[id] || {};
  overrides[id].img = dataUrl;
  persist();
  renderRows();
  $("#saveStatus").textContent = "✓ Image saved locally (export data.js to make permanent)";
}

async function uploadToBackend(id, file) {
  const fd = new FormData();
  fd.append("image", file);
  const headers = {};
  const token = localStorage.getItem("pf_token") || "";
  if (token) headers["x-upload-token"] = token;
  const res = await fetch("/api/upload", { method: "POST", body: fd, headers });
  if (!res.ok) throw new Error("upload failed");
  const data = await res.json();
  overrides[id] = overrides[id] || {};
  overrides[id].img = data.url;
  persist();
  renderRows();
  $("#saveStatus").textContent = "✓ Image uploaded to server: " + data.url;
}

document.addEventListener("change", (e) => {
  if (e.target && e.target.id === "subcatFilter") {
    activeSubcat = e.target.value;
    renderRows();
    return;
  }
  const up = e.target.closest("[data-upimg]");
  if (up && up.files && up.files[0]) {
    const id = Number(up.dataset.upimg);
    const file = up.files[0];
    // try the backend first; fall back to local base64 storage if it is unreachable
    uploadToBackend(id, file).catch(() => {
      if (file.size > 900 * 1024) { alert("Backend offline and image > ~900KB for local storage. Use a smaller image or start the backend."); return; }
      const r = new FileReader();
      r.onload = () => setImageLocal(id, r.result);
      r.readAsDataURL(file);
    });
  }
});

document.addEventListener("click", (e) => {
  const del = e.target.closest("[data-delimg]");
  if (del) {
    const id = Number(del.dataset.delimg);
    overrides[id] = overrides[id] || {};
    overrides[id].img = "";   // "" = no image -> fall back to icon/gradient
    persist();
    renderRows();
    $("#saveStatus").textContent = "✓ Image removed (Publish or Export to save)";
    return;
  }
  const tog = e.target.closest("[data-toggle-del]");
  if (tog) {
    const id = Number(tog.dataset.toggleDel);
    if (deleted.has(id)) deleted.delete(id); else deleted.add(id);
    persistDeleted();
    renderRows();
    $("#saveStatus").textContent = deleted.has(id) ? "Product marked for deletion — click Publish to remove it" : "Product undeleting — click Publish to keep it";
    return;
  }
  const cf = e.target.closest("[data-cat]");
  if (cf) { activeCat = cf.dataset.cat; activeSubcat = ""; renderFilters(); renderRows(); }
  if (e.target.id === "exportBtn") { persist(); exportDataJS(); }
  if (e.target.id === "publishBtn") { persist(); publish(); }
  if (e.target.id === "reloadBtn") {
    if (confirm("Clear all locally saved edits and deletions on this device?")) { localStorage.removeItem(KEY); localStorage.removeItem("ms_deleted"); location.reload(); }
  }
});

renderFilters();
renderRows();
initToken();