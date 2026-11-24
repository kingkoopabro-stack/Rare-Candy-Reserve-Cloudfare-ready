/* Rare Candy Reserve — Pixel Art Designer
 * Plain script, no modules / imports / CDN / external assets.
 * Public API: window.RCRPixel
 * Works standalone and inside an iframe; makes no assumptions
 * about a parent page. DOM binding only runs when a document
 * with the designer markup is present, so the core model is
 * testable in Node.
 */
(function (global) {
  'use strict';

  var EXPORT_KEY = 'rcr-pixel-export';
  var DESIGNS_KEY = 'rcr-pixel-designs';
  var SIZES = [16, 32, 48];
  var MAX_UNDO = 20;

  /* 16-colour SNES-ish palette (default) + genre palettes. */
  var PALETTES = {
    snes: {
      name: 'SNES (16 colours)',
      colors: ['#000000', '#f8f8f8', '#a8a8a8', '#585858', '#f83800',
        '#f8a800', '#f8f8a8', '#00a800', '#58d854', '#00a8f8',
        '#3cbcfc', '#0000f8', '#f838f8', '#a800a8', '#f8b8d8', '#7c4dff']
    },
    gameboy: {
      name: 'Game Boy greens',
      colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f', '#d8e8b0',
        '#f8f8f8', '#202020', '#6b8e4e', '#4a6b3a', '#c8d8a0',
        '#e8f0c8', '#184018', '#5a7d4a', '#a0b878', '#889860', '#385028']
    },
    neon: {
      name: 'Neon arcade',
      colors: ['#0b0b14', '#ff2d95', '#00e5ff', '#39ff88', '#ff9a00',
        '#7c4dff', '#ffea00', '#ff004c', '#00ffcc', '#ff6bff',
        '#ffffff', '#9d4edd', '#00b4ff', '#ff3860', '#7dff00', '#ff8c42']
    },
    earthy: {
      name: 'Earthy',
      colors: ['#2b1d0e', '#5c3a21', '#8b5a2b', '#c68a4b', '#e8c39a',
        '#3a5f2b', '#6b8e4e', '#a8b878', '#7a4a2b', '#a0522d',
        '#d8a05a', '#f2e3c9', '#4a3b2b', '#6e7f80', '#b0a090', '#ffffff']
    }
  };

  /* ---------- Pure grid model (no DOM) ---------- */

  function createGrid(size) {
    var grid = [];
    var y, x;
    for (y = 0; y < size; y++) {
      var row = [];
      for (x = 0; x < size; x++) row.push(null);
      grid.push(row);
    }
    return grid;
  }

  function getPixel(grid, x, y) {
    if (!grid || y < 0 || y >= grid.length) return null;
    if (x < 0 || x >= grid[y].length) return null;
    return grid[y][x];
  }

  function setPixel(grid, x, y, color) {
    if (!grid || y < 0 || y >= grid.length) return false;
    if (x < 0 || x >= grid[y].length) return false;
    grid[y][x] = color || null;
    return true;
  }

  /* Resize keeps the drawing where it fits: top-left anchored.
   * Growing pads with transparent cells; shrinking crops cells
   * beyond the new edge (only those cells are lost). */
  function resizeGrid(grid, newSize) {
    var oldSize = grid.length;
    var out = createGrid(newSize);
    var n = Math.min(oldSize, newSize);
    var y, x;
    for (y = 0; y < n; y++) {
      for (x = 0; x < n; x++) out[y][x] = grid[y][x];
    }
    return out;
  }

  function cloneGrid(grid) {
    return grid.map(function (row) { return row.slice(); });
  }

  function gridEquals(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    var y, x;
    for (y = 0; y < a.length; y++) {
      if (a[y].length !== b[y].length) return false;
      for (x = 0; x < a[y].length; x++) {
        if (a[y][x] !== b[y][x]) return false;
      }
    }
    return true;
  }

  /* 4-way flood fill. Returns number of cells changed. */
  function floodFill(grid, x, y, color) {
    var target = getPixel(grid, x, y);
    if (target === color) return 0;
    var size = grid.length;
    var stack = [[x, y]];
    var changed = 0;
    var seen = {};
    while (stack.length) {
      var cell = stack.pop();
      var cx = cell[0], cy = cell[1];
      if (cx < 0 || cy < 0 || cx >= size || cy >= size) continue;
      var key = cx + ',' + cy;
      if (seen[key]) continue;
      seen[key] = true;
      if (getPixel(grid, cx, cy) !== target) continue;
      setPixel(grid, cx, cy, color);
      changed++;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    return changed;
  }

  /* ---------- Undo / redo ---------- */

  function createHistory() {
    return { undoStack: [], redoStack: [] };
  }

  function pushHistory(history, grid) {
    history.undoStack.push(cloneGrid(grid));
    if (history.undoStack.length > MAX_UNDO) history.undoStack.shift();
    history.redoStack = [];
  }

  function undo(history, grid) {
    if (!history.undoStack.length) return null;
    history.redoStack.push(cloneGrid(grid));
    return history.undoStack.pop();
  }

  function redo(history, grid) {
    if (!history.redoStack.length) return null;
    history.undoStack.push(cloneGrid(grid));
    return history.redoStack.pop();
  }

  /* ---------- Rendering / export (canvas) ---------- */

  function renderToCanvas(grid, canvas, showGrid) {
    if (!canvas) return false;
    var size = grid.length;
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.clearRect(0, 0, size, size);
    var y, x;
    for (y = 0; y < size; y++) {
      for (x = 0; x < size; x++) {
        var c = grid[y][x];
        if (c) {
          ctx.fillStyle = c;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    if (showGrid) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (var i = 1; i < size; i++) {
        ctx.fillRect(i, 0, 1, size);
        ctx.fillRect(0, i, size, 1);
      }
    }
    return true;
  }

  /* PNG data URL of the grid at native resolution (no grid lines).
   * `canvasFactory` lets tests inject a stub canvas; in the browser
   * it defaults to document.createElement('canvas'). */
  function exportPNGDataURL(grid, canvasFactory) {
    var make = canvasFactory ||
      (typeof document !== 'undefined'
        ? function () { return document.createElement('canvas'); }
        : null);
    if (!make) return null;
    var canvas = make();
    if (!renderToCanvas(grid, canvas, false)) return null;
    if (typeof canvas.toDataURL !== 'function') return null;
    return canvas.toDataURL('image/png');
  }

  /* ---------- Saved designs (localStorage) ---------- */

  function loadDesigns(store) {
    var s = store || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!s) return {};
    try {
      return JSON.parse(s.getItem(DESIGNS_KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function saveDesign(store, name, grid) {
    var s = store || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!s || !name) return false;
    var all = loadDesigns(s);
    all[name] = { size: grid.length, pixels: grid };
    try {
      s.setItem(DESIGNS_KEY, JSON.stringify(all));
      return true;
    } catch (e) {
      return false;
    }
  }

  function deleteDesign(store, name) {
    var s = store || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!s) return false;
    var all = loadDesigns(s);
    if (!Object.prototype.hasOwnProperty.call(all, name)) return false;
    delete all[name];
    try {
      s.setItem(DESIGNS_KEY, JSON.stringify(all));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- DOM designer ---------- */

  function init(options) {
    options = options || {};
    if (typeof document === 'undefined') return null;
    var canvas = document.getElementById(options.canvasId || 'px-canvas');
    if (!canvas) return null;

    var state = {
      size: 16,
      grid: createGrid(16),
      color: '#ff2d95',
      tool: 'pencil',
      showGrid: true,
      paletteName: 'snes',
      customColors: [],
      previewScale: 4,
      animate: false,
      history: createHistory(),
      painting: false,
      strokeSnapshot: null
    };

    function $(id) { return document.getElementById(id); }

    var preview = $('px-preview');
    var statusEl = $('px-status');

    function setStatus(msg) {
      if (statusEl) statusEl.textContent = msg;
    }

    function drawAll() {
      renderToCanvas(state.grid, canvas, state.showGrid);
      if (preview) {
        renderToCanvas(state.grid, preview, false);
        var px = state.size * state.previewScale;
        preview.style.width = px + 'px';
        preview.style.height = px + 'px';
      }
      var undoBtn = $('px-undo');
      var redoBtn = $('px-redo');
      if (undoBtn) undoBtn.disabled = !state.history.undoStack.length;
      if (redoBtn) redoBtn.disabled = !state.history.redoStack.length;
    }

    function beginStroke() {
      state.strokeSnapshot = cloneGrid(state.grid);
    }

    function endStroke() {
      if (state.strokeSnapshot && !gridEquals(state.strokeSnapshot, state.grid)) {
        state.history.undoStack.push(state.strokeSnapshot);
        if (state.history.undoStack.length > MAX_UNDO) state.history.undoStack.shift();
        state.history.redoStack = [];
      }
      state.strokeSnapshot = null;
      drawAll();
    }

    function paintCell(x, y) {
      if (state.tool === 'pencil') {
        setPixel(state.grid, x, y, state.color);
      } else if (state.tool === 'eraser') {
        setPixel(state.grid, x, y, null);
      } else if (state.tool === 'fill') {
        floodFill(state.grid, x, y, state.color);
      } else if (state.tool === 'eyedropper') {
        var picked = getPixel(state.grid, x, y);
        if (picked) {
          state.color = picked;
          syncColorUI();
          setStatus('Picked ' + picked + ' — pencil is active again.');
          setTool('pencil');
        } else {
          setStatus('That cell is empty — nothing to pick.');
        }
      }
      drawAll();
    }

    function cellFromEvent(ev) {
      var rect = canvas.getBoundingClientRect();
      var x = Math.floor((ev.clientX - rect.left) / rect.width * state.size);
      var y = Math.floor((ev.clientY - rect.top) / rect.height * state.size);
      return { x: x, y: y };
    }

    canvas.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      canvas.setPointerCapture(ev.pointerId);
      state.painting = true;
      beginStroke();
      var cell = cellFromEvent(ev);
      paintCell(cell.x, cell.y);
      if (state.tool === 'fill' || state.tool === 'eyedropper') {
        state.painting = false;
        endStroke();
      }
    });
    canvas.addEventListener('pointermove', function (ev) {
      if (!state.painting) return;
      if (state.tool === 'fill' || state.tool === 'eyedropper') return;
      ev.preventDefault();
      var cell = cellFromEvent(ev);
      paintCell(cell.x, cell.y);
    });
    function stopPainting() {
      if (!state.painting) return;
      state.painting = false;
      endStroke();
    }
    canvas.addEventListener('pointerup', stopPainting);
    canvas.addEventListener('pointercancel', stopPainting);
    canvas.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });

    /* --- Tools --- */
    function setTool(tool) {
      state.tool = tool;
      var btns = document.querySelectorAll('[data-tool]');
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('active', btns[i].getAttribute('data-tool') === tool);
      }
    }
    var toolBtns = document.querySelectorAll('[data-tool]');
    for (var t = 0; t < toolBtns.length; t++) {
      toolBtns[t].addEventListener('click', function () {
        setTool(this.getAttribute('data-tool'));
      });
    }

    /* --- Grid size: keeps the drawing where it fits (top-left
     * anchored). Growing pads with empty cells; shrinking crops
     * only the cells beyond the new edge. Nothing else changes. */
    function setSize(size) {
      if (size === state.size) return;
      var oldSize = state.size;
      pushHistory(state.history, state.grid);
      state.grid = resizeGrid(state.grid, size);
      state.size = size;
      var sizeBtns = document.querySelectorAll('[data-size]');
      for (var i = 0; i < sizeBtns.length; i++) {
        sizeBtns[i].classList.toggle('active',
          parseInt(sizeBtns[i].getAttribute('data-size'), 10) === size);
      }
      if (size > oldSize) {
        setStatus('Grid is now ' + size + '×' + size + ' — your drawing stayed where it was, with empty space added on the right and bottom.');
      } else {
        setStatus('Grid is now ' + size + '×' + size + ' — your drawing stayed where it was; anything past the new edge was cropped.');
      }
      drawAll();
    }
    var sizeBtns = document.querySelectorAll('[data-size]');
    for (var s = 0; s < sizeBtns.length; s++) {
      sizeBtns[s].addEventListener('click', function () {
        setSize(parseInt(this.getAttribute('data-size'), 10));
      });
    }

    /* --- Palettes --- */
    var paletteEl = $('px-palette');
    var paletteNameEl = $('px-palette-name');

    function renderPalette() {
      if (!paletteEl) return;
      paletteEl.innerHTML = '';
      var pal = PALETTES[state.paletteName];
      if (paletteNameEl) paletteNameEl.textContent = pal.name;
      pal.colors.forEach(function (c) {
        var sw = document.createElement('button');
        sw.type = 'button';
        sw.className = 'px-swatch' + (state.color === c ? ' active' : '');
        sw.style.background = c;
        sw.title = c;
        sw.setAttribute('aria-label', 'Colour ' + c);
        sw.addEventListener('click', function () {
          state.color = c;
          syncColorUI();
        });
        paletteEl.appendChild(sw);
      });
    }

    function renderCustom() {
      var wrap = $('px-custom-colors');
      if (!wrap) return;
      wrap.innerHTML = '';
      state.customColors.forEach(function (c) {
        var sw = document.createElement('button');
        sw.type = 'button';
        sw.className = 'px-swatch' + (state.color === c ? ' active' : '');
        sw.style.background = c;
        sw.title = c;
        sw.setAttribute('aria-label', 'Custom colour ' + c);
        sw.addEventListener('click', function () {
          state.color = c;
          syncColorUI();
        });
        wrap.appendChild(sw);
      });
      if (!state.customColors.length) {
        wrap.innerHTML = '<span class="px-hint">No custom colours yet — pick a colour, then tap “+ Add”.</span>';
      }
    }

    function syncColorUI() {
      var picker = $('px-color-picker');
      if (picker) picker.value = state.color;
      var cur = $('px-current-color');
      if (cur) {
        cur.style.background = state.color;
        cur.textContent = state.color;
      }
      renderPalette();
      renderCustom();
    }

    var paletteSelect = $('px-palette-select');
    if (paletteSelect) {
      Object.keys(PALETTES).forEach(function (key) {
        var opt = document.createElement('option');
        opt.value = key;
        opt.textContent = PALETTES[key].name;
        paletteSelect.appendChild(opt);
      });
      paletteSelect.value = state.paletteName;
      paletteSelect.addEventListener('change', function () {
        state.paletteName = paletteSelect.value;
        renderPalette();
      });
    }

    var picker = $('px-color-picker');
    if (picker) {
      picker.addEventListener('input', function () {
        state.color = picker.value;
        syncColorUI();
      });
    }

    var addCustomBtn = $('px-add-custom');
    if (addCustomBtn) {
      addCustomBtn.addEventListener('click', function () {
        if (state.customColors.indexOf(state.color) !== -1) {
          setStatus(state.color + ' is already in your custom colours.');
          return;
        }
        state.customColors.push(state.color);
        if (state.customColors.length > 6) state.customColors.shift();
        renderCustom();
        setStatus('Added ' + state.color + ' to your custom colours (kept on this device).');
      });
    }

    /* --- Grid toggle / clear / undo / redo --- */
    var gridToggle = $('px-grid-toggle');
    if (gridToggle) {
      gridToggle.addEventListener('click', function () {
        state.showGrid = !state.showGrid;
        gridToggle.textContent = state.showGrid ? 'Grid: on' : 'Grid: off';
        gridToggle.classList.toggle('active', state.showGrid);
        drawAll();
      });
    }

    var clearBtn = $('px-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (!window.confirm('Clear the whole canvas? This cannot be undone except with Undo.')) return;
        pushHistory(state.history, state.grid);
        state.grid = createGrid(state.size);
        setStatus('Canvas cleared. Undo brings it back.');
        drawAll();
      });
    }

    var undoBtn = $('px-undo');
    if (undoBtn) {
      undoBtn.addEventListener('click', function () {
        var prev = undo(state.history, state.grid);
        if (prev) {
          state.grid = prev;
          setStatus('Undid that step.');
          drawAll();
        }
      });
    }
    var redoBtn = $('px-redo');
    if (redoBtn) {
      redoBtn.addEventListener('click', function () {
        var next = redo(state.history, state.grid);
        if (next) {
          state.grid = next;
          setStatus('Redid that step.');
          drawAll();
        }
      });
    }

    /* --- Preview scale + animation --- */
    var scaleBtns = document.querySelectorAll('[data-scale]');
    for (var sc = 0; sc < scaleBtns.length; sc++) {
      scaleBtns[sc].addEventListener('click', function () {
        state.previewScale = parseInt(this.getAttribute('data-scale'), 10);
        for (var i = 0; i < scaleBtns.length; i++) {
          scaleBtns[i].classList.toggle('active',
            parseInt(scaleBtns[i].getAttribute('data-scale'), 10) === state.previewScale);
        }
        drawAll();
      });
    }
    var animateBtn = $('px-animate-toggle');
    if (animateBtn && preview) {
      animateBtn.addEventListener('click', function () {
        state.animate = !state.animate;
        preview.classList.toggle('px-bob', state.animate);
        animateBtn.classList.toggle('active', state.animate);
        animateBtn.textContent = state.animate ? '⏸ Stop animation' : '▶ Animate (bob / wobble)';
      });
    }

    /* --- Download PNG --- */
    var downloadBtn = $('px-download');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', function () {
        var url = exportPNGDataURL(state.grid);
        if (!url) {
          setStatus('Could not make a PNG in this browser. Try saving the design instead.');
          return;
        }
        var a = document.createElement('a');
        a.href = url;
        a.download = 'pixel-art-' + state.size + 'x' + state.size + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setStatus('PNG downloaded (' + state.size + '×' + state.size + ', transparent background).');
      });
    }

    /* --- Save / load named designs --- */
    var loadSelect = $('px-load-list');
    function refreshSaves() {
      if (!loadSelect) return;
      var all = loadDesigns();
      var names = Object.keys(all);
      loadSelect.innerHTML = '';
      if (!names.length) {
        var opt0 = document.createElement('option');
        opt0.value = '';
        opt0.textContent = 'No saved designs yet';
        loadSelect.appendChild(opt0);
      }
      names.sort().forEach(function (name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name + ' (' + all[name].size + '×' + all[name].size + ')';
        loadSelect.appendChild(opt);
      });
    }
    var saveBtn = $('px-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var nameInput = $('px-save-name');
        var name = nameInput ? nameInput.value.trim() : '';
        if (!name) {
          setStatus('Give your design a name first.');
          if (nameInput) nameInput.focus();
          return;
        }
        if (saveDesign(null, name, state.grid)) {
          refreshSaves();
          if (loadSelect) loadSelect.value = name;
          setStatus('Saved “' + name + '” on this device.');
        } else {
          setStatus('Could not save — this browser may be out of storage space.');
        }
      });
    }
    var loadBtn = $('px-load');
    if (loadBtn) {
      loadBtn.addEventListener('click', function () {
        var name = loadSelect ? loadSelect.value : '';
        if (!name) {
          setStatus('Nothing saved yet — save a design first.');
          return;
        }
        var all = loadDesigns();
        var saved = all[name];
        if (!saved) {
          setStatus('Could not find “' + name + '”.');
          return;
        }
        pushHistory(state.history, state.grid);
        state.size = saved.size;
        state.grid = cloneGrid(saved.pixels);
        var sb = document.querySelectorAll('[data-size]');
        for (var i = 0; i < sb.length; i++) {
          sb[i].classList.toggle('active',
            parseInt(sb[i].getAttribute('data-size'), 10) === state.size);
        }
        setStatus('Loaded “' + name + '” (' + state.size + '×' + state.size + ').');
        drawAll();
      });
    }
    var deleteBtn = $('px-delete-save');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function () {
        var name = loadSelect ? loadSelect.value : '';
        if (!name) return;
        if (!window.confirm('Delete saved design “' + name + '”?')) return;
        if (deleteDesign(null, name)) {
          refreshSaves();
          setStatus('Deleted “' + name + '”.');
        }
      });
    }

    /* --- Send to Harmony Engine ---
     * Writes the PNG data URL to localStorage key `rcr-pixel-export`.
     * The game maker reads that key. */
    var sendBtn = $('px-send-harmony');
    if (sendBtn) {
      sendBtn.addEventListener('click', function () {
        var url = exportPNGDataURL(state.grid);
        if (!url) {
          setStatus('Could not make a PNG to send. Try again, or download the PNG instead.');
          return;
        }
        try {
          localStorage.setItem(EXPORT_KEY, url);
        } catch (e) {
          setStatus('Could not write to this browser’s storage — download the PNG instead.');
          return;
        }
        setStatus('Sent to Harmony Engine! Open the Game Maker — your ' +
          state.size + '×' + state.size + ' sprite is ready to use as a tile or character.');
      });
    }

    renderPalette();
    renderCustom();
    syncColorUI();
    refreshSaves();
    setTool('pencil');
    drawAll();
    setStatus('Ready — pick a colour and click or drag on the grid to paint.');
    return state;
  }

  var api = {
    SIZES: SIZES,
    PALETTES: PALETTES,
    EXPORT_KEY: EXPORT_KEY,
    DESIGNS_KEY: DESIGNS_KEY,
    MAX_UNDO: MAX_UNDO,
    createGrid: createGrid,
    getPixel: getPixel,
    setPixel: setPixel,
    resizeGrid: resizeGrid,
    cloneGrid: cloneGrid,
    gridEquals: gridEquals,
    floodFill: floodFill,
    createHistory: createHistory,
    pushHistory: pushHistory,
    undo: undo,
    redo: redo,
    renderToCanvas: renderToCanvas,
    exportPNGDataURL: exportPNGDataURL,
    loadDesigns: loadDesigns,
    saveDesign: saveDesign,
    deleteDesign: deleteDesign,
    init: init
  };

  global.RCRPixel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
