/* ============================================================
   Developer Console (STAGING, v1) — owner inventory tools.
   Edits save to THIS browser only (localStorage). Nothing here
   rewrites site.js on disk. Use Export to download the updated
   catalog, then push it to the repo to make changes live.
   Photos are downscaled to 800px JPEG before saving — browser
   storage is limited (~5MB), so keep uploads small.
   ============================================================ */
const CONSOLE_OVERRIDES_KEY = "rcr-console-overrides";
const CONSOLE_NEW_KEY = "rcr-console-new-items";
const CONSOLE_SPECIALS_KEY = "rcr-vcr-specials";
const CONSOLE_DEFAULT_SPECIALS = ["cat-glaceon", "cat-vulpix", "cat-pluspower"];

function consoleStoreGet(key, fallback){
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
  catch(e){ return fallback; }
}
function consoleStoreSet(key, val){
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){}
}
function consoleGetOverrides(){ return consoleStoreGet(CONSOLE_OVERRIDES_KEY, {}); }
function consoleGetNew(){ return consoleStoreGet(CONSOLE_NEW_KEY, []); }
function consoleGetSpecialIds(){
  const list = consoleStoreGet(CONSOLE_SPECIALS_KEY, null);
  return (Array.isArray(list) && list.length) ? list : CONSOLE_DEFAULT_SPECIALS.slice();
}
function consoleSetSpecialIds(ids){ consoleStoreSet(CONSOLE_SPECIALS_KEY, ids); }

/* A Drive share link becomes a direct thumbnail URL for previews. */
function driveThumbUrl(src){
  if(!src) return null;
  const m = String(src).match(/drive\.google\.com\/file\/d\/([^\/\?]+)/);
  if(m) return "https://drive.google.com/thumbnail?id=" + m[1] + "&sz=w800";
  return src;
}
/* Display image for an item: uploaded photo > image-source field > catalog photo. */
function consoleResolveImg(item, ov){
  if(ov && ov.photo) return ov.photo;
  if(ov && ov.imgSrc) return driveThumbUrl(ov.imgSrc);
  if(item.imgs && item.imgs.length) return item.imgs[0];
  return null;
}
/* Merged catalog for display (table + preview): overrides applied. */
function consoleMergedCatalog(){
  const ov = consoleGetOverrides();
  const specials = consoleGetSpecialIds();
  const merged = CATALOG.map(base => {
    const o = ov[base.id] || {};
    const item = Object.assign({}, base);
    if(o.price != null && o.price !== "") item.price = parseFloat(o.price);
    if(o.sku != null) item.sku = o.sku;
    if(o.stock != null && o.stock !== "") item.stock = parseInt(o.stock, 10);
    if(o.imgSrc) item.imgSrc = o.imgSrc;
    if(o.photo) item.photo = o.photo;
    item.vcrSpecial = specials.indexOf(base.id) !== -1;
    if(o.photo || o.imgSrc){
      const resolved = consoleResolveImg(item, o);
      if(resolved) item.imgs = [resolved];
    }
    return item;
  });
  return merged.concat(consoleGetNew());
}
/* Export data: base catalog + overrides, kept raw (no resolved thumbnails). */
function consoleExportData(){
  const ov = consoleGetOverrides();
  const specials = consoleGetSpecialIds();
  const out = CATALOG.map(base => {
    const o = ov[base.id] || {};
    const item = Object.assign({}, base);
    if(o.price != null && o.price !== "") item.price = parseFloat(o.price);
    if(o.sku) item.sku = o.sku;
    if(o.stock != null && o.stock !== "") item.stock = parseInt(o.stock, 10);
    if(o.imgSrc) item.imgSrc = o.imgSrc;
    if(o.photo) item.photo = o.photo;
    if(specials.indexOf(base.id) !== -1) item.vcrSpecial = true;
    return item;
  });
  return out.concat(consoleGetNew());
}

function consoleDownload(filename, text, type){
  const blob = new Blob([text], { type: type || "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function consoleExportJson(){
  consoleDownload("rcr-catalog-export.json", JSON.stringify(consoleExportData(), null, 2), "application/json");
  consoleSetMsg("✓ Catalog JSON downloaded — push it to the repo to go live.");
}
function consoleExportSnippet(){
  const data = consoleExportData().map(item => {
    const c = Object.assign({}, item);
    if(c.imgs) c.imgs = c.imgs.filter(u => typeof u === "string" && u.indexOf("data:") !== 0);
    delete c.photo;
    return c;
  });
  const txt = "/* Rare Candy Reserve — CATALOG export from the Developer Console (staging).\n" +
    "   Paste into assets/js/site.js, replacing the CATALOG array.\n" +
    "   Photos saved as data URLs are NOT included — use the Image source field instead. */\n" +
    "const CATALOG = " + JSON.stringify(data, null, 2) + ";\n";
  consoleDownload("catalog-snippet.js", txt, "text/javascript");
  consoleSetMsg("✓ site.js snippet downloaded — paste the CATALOG array into assets/js/site.js.");
}
function consoleSetMsg(t){
  const el = document.getElementById("consoleMsg");
  if(el) el.textContent = t || "";
}

/* ---------- photo upload (downscaled to 800px JPEG) ---------- */
function consoleHandlePhoto(file, done){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 800;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      done(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => { done(reader.result); };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/* ---------- table ---------- */
function consoleEl(id){ return document.getElementById(id); }
function consoleEsc(s){
  return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function consoleRowHTML(item){
  const ov = consoleGetOverrides()[item.id] || {};
  const thumb = consoleResolveImg(item, ov);
  const priceVal = (ov.price != null && ov.price !== "") ? ov.price : (item.price != null ? item.price : "");
  const skuVal = ov.sku != null ? ov.sku : (item.sku || "");
  const stockVal = (ov.stock != null && ov.stock !== "") ? ov.stock : (item.stock != null ? item.stock : "");
  const srcVal = ov.imgSrc != null ? ov.imgSrc : (item.imgSrc || "");
  const status = item.outOfStock ? "⛔ Out of stock" : item.draft ? "✏️ Draft" : item.comingSoon ? "🕐 Coming soon" : "Live";
  return `<tr data-row="${item.id}">
    <td><div style="display:flex;gap:10px;align-items:center;min-width:220px">
      ${thumb ? `<img class="console-thumb" src="${consoleEsc(thumb)}" alt="">` : `<span class="console-thumb" style="display:flex;align-items:center;justify-content:center;font-size:22px">${item.icon || "📦"}</span>`}
      <div><b>${consoleEsc(item.name)}</b><br><span style="color:var(--muted);font-size:12px">${consoleEsc(item.tag || "")} · ${consoleEsc(item.id)} · ${status}</span></div>
    </div></td>
    <td><input type="number" step="0.01" min="0" data-id="${item.id}" data-field="price" value="${consoleEsc(priceVal)}" placeholder="—" style="width:90px"></td>
    <td><input type="text" data-id="${item.id}" data-field="sku" value="${consoleEsc(skuVal)}" placeholder="RCR-…" style="width:110px"></td>
    <td><input type="number" step="1" min="0" data-id="${item.id}" data-field="stock" value="${consoleEsc(stockVal)}" placeholder="—" style="width:70px"></td>
    <td><input type="text" data-id="${item.id}" data-field="imgSrc" value="${consoleEsc(srcVal)}" placeholder="images/… or Drive link" style="width:200px"></td>
    <td><input type="file" accept="image/*" data-photo="${item.id}" style="width:170px">
      ${ov.photo ? `<button class="btn ghost small" data-clear-photo="${item.id}">Remove photo</button>` : ""}</td>
    <td style="text-align:center"><input type="checkbox" data-special="${item.id}" ${item.vcrSpecial ? "checked" : ""} style="width:20px;height:20px"></td>
    <td><button class="btn ghost small" data-reset="${item.id}">Reset</button></td>
  </tr>`;
}
function consoleRenderTable(){
  const body = consoleEl("consoleTableBody");
  if(!body) return;
  const q = (consoleEl("consoleSearch") ? consoleEl("consoleSearch").value : "").trim().toLowerCase();
  const items = consoleMergedCatalog().filter(it => {
    if(!q) return true;
    return (it.name + " " + (it.tag || "") + " " + it.id + " " + (it.sku || "")).toLowerCase().indexOf(q) !== -1;
  });
  body.innerHTML = items.map(consoleRowHTML).join("");
  const count = consoleEl("consoleCount");
  if(count) count.textContent = items.length + " item" + (items.length === 1 ? "" : "s") + (q ? " matching “" + q + "”" : "") + " · " + consoleMergedCatalog().length + " total in console";
}
function consoleSaveOverride(id, field, value){
  const ov = consoleGetOverrides();
  const o = ov[id] || {};
  if(field === "price" || field === "stock"){
    if(value === "" || value == null) delete o[field]; else o[field] = value;
  } else {
    if(value === "" || value == null) delete o[field]; else o[field] = value;
  }
  if(Object.keys(o).length === 0) delete ov[id]; else ov[id] = o;
  consoleStoreSet(CONSOLE_OVERRIDES_KEY, ov);
}
function consoleResetItem(id){
  const ov = consoleGetOverrides();
  delete ov[id];
  consoleStoreSet(CONSOLE_OVERRIDES_KEY, ov);
  consoleRenderTable();
  consoleRenderPreview();
  consoleSetMsg("Reset " + id + " to the catalog defaults.");
}
function consoleToggleSpecial(id, on){
  let list = consoleGetSpecialIds();
  if(on && list.indexOf(id) === -1) list.push(id);
  if(!on) list = list.filter(x => x !== id);
  consoleSetSpecialIds(list);
}

/* ---------- preview pane (Desktop / Mobile widths, shrunk to fit) ---------- */
function consoleRenderPreview(){
  const inner = consoleEl("consolePreviewInner");
  if(!inner) return;
  const items = consoleMergedCatalog().slice(0, 4);
  let html = "";
  try { html = '<div class="grid">' + items.map(c => catalogCard(c)).join("") + "</div>"; }
  catch(e){ html = '<p class="note">Preview unavailable — catalogCard() not loaded.</p>'; }
  inner.innerHTML = html;
  consoleApplyPreviewMode();
}
function consoleApplyPreviewMode(){
  const sel = consoleEl("consolePreviewMode");
  const mode = sel ? sel.value : "desktop";
  const inner = consoleEl("consolePreviewInner");
  const wrap = consoleEl("consolePreviewWrap");
  if(!inner || !wrap) return;
  const w = mode === "mobile" ? 390 : 1000;
  const scale = Math.min(1, 600 / w);
  inner.style.width = w + "px";
  inner.style.transform = "scale(" + scale + ")";
  inner.style.transformOrigin = "top left";
  wrap.style.height = Math.ceil(inner.scrollHeight * scale + 12) + "px";
}

/* ---------- add-new-item form ---------- */
function consoleAddItem(e){
  e.preventDefault();
  const val = id => { const el = consoleEl(id); return el ? el.value.trim() : ""; };
  const name = val("newName");
  if(!name){ consoleSetMsg("Give the new item a name first."); return; }
  const priceRaw = val("newPrice");
  const stockRaw = val("newStock");
  const item = {
    id: "custom-" + Date.now(),
    slug: "custom-" + Date.now(),
    icon: "✨",
    tag: val("newTag") || "New item",
    name: name,
    price: priceRaw === "" ? null : parseFloat(priceRaw),
    sku: val("newSku") || null,
    stock: stockRaw === "" ? null : parseInt(stockRaw, 10),
    imgSrc: val("newImgSrc") || null,
    img: null,
    imgs: [],
    custom: true
  };
  const fileInput = consoleEl("newPhoto");
  const finish = photoUrl => {
    if(photoUrl) item.imgs = [photoUrl];
    else if(item.imgSrc) item.imgs = [driveThumbUrl(item.imgSrc)];
    const list = consoleGetNew();
    list.push(item);
    consoleStoreSet(CONSOLE_NEW_KEY, list);
    ["newName","newTag","newPrice","newSku","newStock","newImgSrc"].forEach(id => { const el = consoleEl(id); if(el) el.value = ""; });
    if(fileInput) fileInput.value = "";
    consoleRenderTable();
    consoleRenderPreview();
    consoleSetMsg("✓ Added “" + name + "” to the console (saved in this browser only — export to make it live).");
  };
  if(fileInput && fileInput.files && fileInput.files[0]) consoleHandlePhoto(fileInput.files[0], finish);
  else finish(null);
}

/* ---------- bulk multi-upload (add many items at once) ---------- */
let consoleBulkRows = [];
function consoleBulkCleanName(filename){
  const base = String(filename || "").replace(/\.[^.]+$/, "");
  return base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}
function consoleBulkRender(){
  const wrap = consoleEl("consoleBulkRows");
  if(!wrap) return;
  if(!consoleBulkRows.length){
    wrap.innerHTML = '<p style="color:var(--muted)">No photos selected yet — pick one or more images above.</p>';
  } else {
    wrap.innerHTML = consoleBulkRows.map((r, i) => `
      <div class="card" style="display:flex;gap:12px;align-items:flex-start;margin-bottom:12px">
        ${r.photo ? `<img src="${consoleEsc(r.photo)}" alt="" style="width:90px;height:90px;object-fit:cover;border-radius:10px;flex:none">` : `<span class="console-thumb" style="width:90px;height:90px;flex:none;display:flex;align-items:center;justify-content:center;font-size:22px">⏳</span>`}
        <div style="flex:1;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0 12px">
          <div><label>Name *</label><input data-bulk="${i}" data-bfield="name" value="${consoleEsc(r.name)}"></div>
          <div><label>Tag</label><input data-bulk="${i}" data-bfield="tag" value="${consoleEsc(r.tag)}"></div>
          <div><label>Price ($)</label><input data-bulk="${i}" data-bfield="price" type="number" step="0.01" min="0" value="${consoleEsc(r.price)}" placeholder="—"></div>
          <div><label>SKU</label><input data-bulk="${i}" data-bfield="sku" value="${consoleEsc(r.sku)}" placeholder="RCR-…"></div>
          <div><label>Stock (qty)</label><input data-bulk="${i}" data-bfield="stock" type="number" step="1" min="0" value="${consoleEsc(r.stock)}" placeholder="—"></div>
        </div>
        <button class="btn ghost small" data-bulk-remove="${i}" title="Remove this row">✕</button>
      </div>`).join("");
  }
  const addBtn = consoleEl("consoleBulkAdd");
  if(addBtn) addBtn.disabled = consoleBulkRows.length === 0;
}
function consoleBulkOnFiles(input){
  const files = (input && input.files) ? Array.from(input.files) : [];
  files.forEach(file => {
    const row = { name: consoleBulkCleanName(file.name), tag: "New item", price: "", sku: "", stock: "", photo: null };
    consoleBulkRows.push(row);
    consoleHandlePhoto(file, url => { row.photo = url; consoleBulkRender(); });
  });
  consoleBulkRender();
  consoleSetMsg(files.length ? "Picked " + files.length + " photo(s) — fill in names/prices, then Add all." : "");
}
function consoleBulkAddAll(){
  const rows = consoleBulkRows.filter(r => r.name && r.name.trim());
  if(!rows.length){ consoleSetMsg("Give at least one item a name first."); return; }
  const ts = Date.now();
  const list = consoleGetNew();
  rows.forEach((r, i) => {
    const priceRaw = String(r.price == null ? "" : r.price).trim();
    const stockRaw = String(r.stock == null ? "" : r.stock).trim();
    list.push({
      id: "custom-" + ts + "-" + i,
      slug: "custom-" + ts + "-" + i,
      icon: "✨",
      tag: (r.tag && r.tag.trim()) || "New item",
      name: r.name.trim(),
      price: priceRaw === "" ? null : parseFloat(priceRaw),
      sku: (r.sku && r.sku.trim()) || null,
      stock: stockRaw === "" ? null : parseInt(stockRaw, 10),
      imgSrc: null,
      img: null,
      imgs: r.photo ? [r.photo] : [],
      custom: true
    });
  });
  consoleStoreSet(CONSOLE_NEW_KEY, list);
  consoleBulkRows = [];
  const fi = consoleEl("consoleBulkFiles");
  if(fi) fi.value = "";
  consoleBulkRender();
  consoleRenderTable();
  consoleRenderPreview();
  consoleSetMsg("✓ Added " + rows.length + " item(s) to the console (saved in this browser only — export to make them live).");
}

/* ---------- init ---------- */
function consoleInit(){
  if(!consoleEl("consoleTableBody")) return;
  consoleRenderTable();
  consoleRenderPreview();
  const search = consoleEl("consoleSearch");
  if(search) search.addEventListener("input", consoleRenderTable);
  const mode = consoleEl("consolePreviewMode");
  if(mode) mode.addEventListener("change", consoleApplyPreviewMode);
  const ej = consoleEl("consoleExportJson");
  if(ej) ej.addEventListener("click", consoleExportJson);
  const es = consoleEl("consoleExportSnippet");
  if(es) es.addEventListener("click", consoleExportSnippet);
  const ra = consoleEl("consoleResetAll");
  if(ra) ra.addEventListener("click", () => {
    if(!confirm("Reset ALL console edits (prices, SKUs, stock, photos, new items)? This cannot be undone.")) return;
    try { localStorage.removeItem(CONSOLE_OVERRIDES_KEY); localStorage.removeItem(CONSOLE_NEW_KEY); } catch(e){}
    consoleRenderTable();
    consoleRenderPreview();
    consoleSetMsg("All console edits reset to the catalog defaults.");
  });
  const form = consoleEl("consoleAddForm");
  if(form) form.addEventListener("submit", consoleAddItem);
  /* bulk multi-upload wiring */
  const bf = consoleEl("consoleBulkFiles");
  if(bf) bf.addEventListener("change", () => consoleBulkOnFiles(bf));
  const ba = consoleEl("consoleBulkAdd");
  if(ba) ba.addEventListener("click", consoleBulkAddAll);
  const br = consoleEl("consoleBulkRows");
  if(br){
    br.addEventListener("input", e => {
      const t = e.target;
      if(t.dataset && t.dataset.bulk != null && t.dataset.bfield){
        const row = consoleBulkRows[parseInt(t.dataset.bulk, 10)];
        if(row) row[t.dataset.bfield] = t.value;
      }
    });
    br.addEventListener("click", e => {
      const t = e.target;
      if(t.dataset && t.dataset.bulkRemove != null){
        consoleBulkRows.splice(parseInt(t.dataset.bulkRemove, 10), 1);
        consoleBulkRender();
      }
    });
  }
  consoleBulkRender();
  /* table events (delegated so re-renders keep working) */
  const body = consoleEl("consoleTableBody");
  body.addEventListener("change", e => {
    const t = e.target;
    if(t.dataset && t.dataset.field){
      consoleSaveOverride(t.dataset.id, t.dataset.field, t.value);
      if(t.dataset.field === "imgSrc") { consoleRenderTable(); }
      consoleRenderPreview();
      consoleSetMsg("Saved — this browser only. Export to make it live.");
    }
    if(t.dataset && t.dataset.special){
      consoleToggleSpecial(t.dataset.special, t.checked);
      consoleRenderPreview();
    }
    if(t.dataset && t.dataset.photo && t.files && t.files[0]){
      const id = t.dataset.photo;
      consoleHandlePhoto(t.files[0], url => {
        const ov = consoleGetOverrides();
        const o = ov[id] || {};
        o.photo = url;
        ov[id] = o;
        consoleStoreSet(CONSOLE_OVERRIDES_KEY, ov);
        consoleRenderTable();
        consoleRenderPreview();
        consoleSetMsg("✓ Photo saved for this browser (downscaled to 800px). Export to make it live.");
      });
    }
  });
  body.addEventListener("click", e => {
    const t = e.target;
    if(t.dataset && t.dataset.reset) consoleResetItem(t.dataset.reset);
    if(t.dataset && t.dataset.clearPhoto){
      const ov = consoleGetOverrides();
      if(ov[t.dataset.clearPhoto]){ delete ov[t.dataset.clearPhoto].photo; if(Object.keys(ov[t.dataset.clearPhoto]).length === 0) delete ov[t.dataset.clearPhoto]; }
      consoleStoreSet(CONSOLE_OVERRIDES_KEY, ov);
      consoleRenderTable();
      consoleRenderPreview();
    }
  });
  window.addEventListener("resize", consoleApplyPreviewMode);
}
if(typeof document !== "undefined" && document.addEventListener){
  document.addEventListener("DOMContentLoaded", consoleInit);
}
