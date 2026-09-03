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
  const img = p.img;
  const media = img ? `<img class="thumb" src="${img}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'thumb-ph',textContent:'📷'}))">`
                    : `<div class="thumb-ph">${p.icon || "🎽"}</div>`;
  const dirty = (o.name !== undefined || o.price !== undefined || o.old !== undefined || o.cat || o.subcat || o.size) ? "row-dirty" : "";
  return `<tr class="${dirty}" data-id="${p.id}">
    <td>${media}</td>
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

function exportDataJS() {
  const list = PRODUCTS.map((p) => {
    const o = overrides[p.id] || {};
    const fields = [`  { id: ${p.id}`];
    fields.push(`name: ${JSON.stringify(o.name !== undefined ? o.name : p.name)}`);
    fields.push(`cat: ${JSON.stringify(o.cat || p.cat)}`);
    fields.push(`subcat: ${JSON.stringify(o.subcat || p.subcat)}`);
    fields.push(`price: ${o.price !== undefined ? o.price : p.price}`);
    fields.push(`old: ${o.old !== undefined ? o.old : (p.old || 0)}`);
    if (p.img) fields.push(`img: ${JSON.stringify(p.img)}`);
    if (p.icon) fields.push(`icon: ${JSON.stringify(p.icon)}`);
    if (p.grad) fields.push(`grad: ${JSON.stringify(p.grad)}`);
    if (p.rating) fields.push(`rating: ${p.rating}`);
    const size = (o.size || p.size.join(",")).split(",").map((s) => s.trim()).filter(Boolean);
    fields.push(`size: ${JSON.stringify(size)}`);
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

document.addEventListener("click", (e) => {
  const cf = e.target.closest("[data-cat]");
  if (cf) { activeCat = cf.dataset.cat; renderFilters(); renderRows(); }
  if (e.target.id === "exportBtn") { persist(); exportDataJS(); }
  if (e.target.id === "reloadBtn") {
    if (confirm("Clear all locally saved edits on this device?")) { localStorage.removeItem(KEY); location.reload(); }
  }
});

renderFilters();
renderRows();