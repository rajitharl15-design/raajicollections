"use strict";
const $ = (sel, c = document) => c.querySelector(sel);
const KEY = "ms_overrides";
let overrides = JSON.parse(localStorage.getItem(KEY) || "{}");
let activeCat = "";

function catOptions(sel) {
  return `<option value="">(none)</option>` + CATS.map((c) => `<option ${c === sel ? "selected" : ""}>${c}</option>`).join("");
}
function subcatOptions(sel, cat) {
  const subs = cat ? [...new Set(PRODUCTS.filter((p) => p.cat === cat).map((p) => p.subcat))] : SUBCATS;
  return `<option value="">(none)</option>` + subs.map((s) => `<option ${s === sel ? "selected" : ""}>${s}</option>`).join("");
}

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }

function renderFilters() {
  $("#catFilter").innerHTML =
    `<button class="chip ${!activeCat ? "chip-on" : ""}" data-cat="">All</button>` +
    CATS.map((c) => `<button class="chip ${activeCat === c ? "chip-on" : ""}" data-cat="${c}">${c}</button>`).join("");
}
function renderCatFilter() {}

function rowHTML(p) {
  const o = overrides[p.id] || {};
  const effImg = o.img !== undefined ? o.img : p.img;
  const thumb = effImg ? `<img class="thumb" src="${effImg}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'thumb-ph',textContent:'📷'}))">`
                    : `<div class="thumb-ph">${p.icon || "🎽"}</div>`;
  const dirty = (o.name !== undefined || o.price !== undefined || o.old !== undefined || o.cat || o.subcat || o.size || o.img !== undefined) ? "row-dirty" : "";
  return `<tr class="${dirty}" data-id="${p.id}">
    <td><div style="display:flex;flex-direction:column;gap:5px;align-items:flex-start">
      ${thumb}
      <label class="chip" style="padding:4px 8px;font-size:.68rem;cursor:pointer">⬆ img<input type="file" accept="image/*" data-upimg="${p.id}" hidden></label>
      ${effImg ? `<button class="chip" style="padding:4px 8px;font-size:.68rem" data-delimg="${p.id}">✕ del</button>` : ""}
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
  let list = activeCat ? PRODUCTS.filter((p) => p.cat === activeCat) : PRODUCTS.slice();
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

function exportDataJS() {
  const list = PRODUCTS.map((p) => {
    const o = overrides[p.id] || {};
    const img = o.img !== undefined ? o.img : p.img;
    const effPrice = o.price !== undefined ? o.price : p.price;
    const effOld = o.old !== undefined ? o.old : (p.old || 0);
    const effName = o.name !== undefined ? o.name : p.name;
    const effCat = o.cat || p.cat;
    const effSub = o.subcat || p.subcat;
    const effSize = (o.size || (p.size || []).join(",")).split(",").map((s) => s.trim()).filter(Boolean);
    const fields = [`  { id: ${p.id}`];
    fields.push(`name: ${JSON.stringify(effName)}`);
    fields.push(`cat: ${JSON.stringify(effCat)}`);
    fields.push(`subcat: ${JSON.stringify(effSub)}`);
    fields.push(`price: ${effPrice}`);
    fields.push(`old: ${effOld}`);
    if (p.img || (o.img !== undefined)) fields.push(`img: ${JSON.stringify(img)}`);
    if (p.icon && (o.img === undefined || o.img)) fields.push(`icon: ${JSON.stringify(p.icon)}`);
    if (p.grad && (o.img === undefined || o.img)) fields.push(`grad: ${JSON.stringify(p.grad)}`);
    if (p.rating) fields.push(`rating: ${p.rating}`);
    fields.push(`size: ${JSON.stringify(effSize)}`);
    if (p.desc) fields.push(`desc: ${JSON.stringify(p.desc)}`);
    return fields.join(", ") + " },";
  }).join("\n");
  const js = "const PRODUCTS = [\n" + list + "\n];\n\nfunction productById(id) {\n  return PRODUCTS.find((p) => p.id === Number(id));\n}\n\nconst CATS = [\"Women\", \"Men\", \"Kids\", \"Accessories\"];\nconst SUBCATS = [...new Set(PRODUCTS.map((p) => p.subcat))];\n";
  const blob = new Blob([js], { type: "text/javascript" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "data.js";
  a.click();
  URL.revokeObjectURL(a.href);
  $("#saveStatus").textContent = "✓ Exported data.js — replace js/data.js and push to make permanent";
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
    $("#saveStatus").textContent = "✓ Image removed locally (export data.js to make permanent)";
    return;
  }
  const cf = e.target.closest("[data-cat]");
  if (cf) { activeCat = cf.dataset.cat; renderFilters(); renderRows(); }
  if (e.target.id === "exportBtn") { persist(); exportDataJS(); }
  if (e.target.id === "reloadBtn") {
    if (confirm("Clear all locally saved edits on this device?")) { localStorage.removeItem(KEY); location.reload(); }
  }
});

renderFilters();
renderRows();
initToken();