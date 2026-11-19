// Vice City Cover — the editor.
//
// Wires the controls to the renderer: photo slots, layout and grade
// pickers, per-panel crop controls, the caption fields and the PNG export.
// Photos never leave the machine — files are read with FileReader into
// data URLs and drawn straight onto a canvas. A `?shot=` query instead
// builds a fixed scene from the bundled sample photos so screenshots show
// the real app and the real covers it exports.

import { drawPoster, panelAt, defaultPosterState, GRADES, LAYOUTS, POSTER_SIZES } from './render.js';

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const state = defaultPosterState();
const photos = [null, null, null];
const photoNames = ['No photo', 'No photo', 'No photo'];
let activePanel = 0;
let dragging = null;

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function readFileAsImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      loadImageFromUrl(reader.result).then(resolve, reject);
    };
    reader.onerror = () => reject(new Error('could not read file'));
    reader.readAsDataURL(file);
  });
}

function setStatus(text) {
  $('status').textContent = text;
}

function sizeForPreview() {
  const dims = POSTER_SIZES[state.size];
  const box = preview.parentElement.getBoundingClientRect();
  const shotMode = document.body.classList.contains('shot-cover')
    || document.body.classList.contains('shot-portrait');
  // In a screenshot scene the poster fills the whole viewport; in the
  // editor it stays a comfortable preview size.
  const scale = shotMode
    ? Math.min(box.width / dims.w, 1.5)
    : Math.min((box.width - 8) / dims.w, 560 / dims.h, 1);
  return { w: dims.w, h: dims.h, scale };
}

function redraw() {
  const dims = POSTER_SIZES[state.size];
  const { scale } = sizeForPreview();
  preview.width = dims.w;
  preview.height = dims.h;
  preview.style.width = `${Math.round(dims.w * scale)}px`;
  preview.style.height = `${Math.round(dims.h * scale)}px`;
  drawPoster(preview, state, photos);
  refreshPanelControls();
}

function refreshPanelControls() {
  const spec = state.panels[activePanel];
  $('panelLabel').textContent = `Panel ${activePanel + 1} of 3`;
  $('panelPhoto').value = spec.photo === null ? '' : String(spec.photo);
  $('zoom').value = spec.zoom;
  $('zoomValue').textContent = `${Math.round(spec.zoom * 100)}%`;
  $('panX').value = Math.round(spec.ox * 100);
  $('panY').value = Math.round(spec.oy * 100);
  $('panXValue').textContent = `${Math.round(spec.ox * 100)}`;
  $('panYValue').textContent = `${Math.round(spec.oy * 100)}`;
  document.querySelectorAll('#panelDots button').forEach((btn, i) => {
    btn.classList.toggle('active', i === activePanel);
    btn.setAttribute('aria-pressed', String(i === activePanel));
  });
}

function refreshPhotoSlots() {
  photos.forEach((img, i) => {
    $(`slotName${i + 1}`).textContent = photoNames[i];
    $(`slotThumb${i + 1}`).textContent = img ? 'Loaded' : 'Empty';
    $(`slotThumb${i + 1}`).classList.toggle('loaded', Boolean(img));
  });
  const opts = photos.map((img, i) => `<option value="${i}">Photo ${i + 1} — ${photoNames[i]}</option>`).join('');
  $('panelPhoto').innerHTML = `<option value="">Empty panel</option>${opts}`;
  refreshPanelControls();
}

function buildPicker(containerId, entries, current, onPick) {
  const box = $(containerId);
  box.innerHTML = '';
  Object.entries(entries).forEach(([key, entry]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = entry.label;
    btn.setAttribute('aria-pressed', String(key === current));
    if (key === current) btn.classList.add('active');
    btn.addEventListener('click', () => {
      onPick(key);
      buildPicker(containerId, entries, key, onPick);
      redraw();
    });
    box.appendChild(btn);
  });
}

function buildSizePicker() {
  const box = $('sizePicker');
  box.innerHTML = '';
  Object.entries(POSTER_SIZES).forEach(([key, entry]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = entry.label;
    btn.setAttribute('aria-pressed', String(key === state.size));
    if (key === state.size) btn.classList.add('active');
    btn.addEventListener('click', () => {
      state.size = key;
      buildSizePicker();
      redraw();
    });
    box.appendChild(btn);
  });
}

async function assignPhoto(slot, file) {
  try {
    const img = await readFileAsImage(file);
    photos[slot] = img;
    photoNames[slot] = file.name.length > 24 ? `${file.name.slice(0, 21)}...` : file.name;
    setStatus(`Photo ${slot + 1} loaded — ${photoNames[slot]}. Pick a panel to place it.`);
  } catch {
    setStatus('That file could not be read as an image. Try a JPG or PNG photo.');
  }
  refreshPhotoSlots();
  redraw();
}

async function loadSample(slot, name) {
  try {
    photos[slot] = await loadImageFromUrl(`./samples/${name}.jpg`);
    photoNames[slot] = `${name}.jpg (sample)`;
  } catch {
    setStatus(`Sample ${name}.jpg could not be loaded.`);
  }
  refreshPhotoSlots();
  redraw();
}

function exportPng() {
  const dims = POSTER_SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = dims.w;
  off.height = dims.h;
  drawPoster(off, state, photos);
  off.toBlob((blob) => {
    if (!blob) {
      setStatus('Export failed — try again.');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-city-cover-${dims.w}x${dims.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus(`Exported vice-city-cover-${dims.w}x${dims.h}.png — share it anywhere.`);
  }, 'image/png');
}

// ---- wiring ----

[1, 2, 3].forEach((slot) => {
  $(`photo${slot}`).addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) assignPhoto(slot - 1, file);
    e.target.value = '';
  });
  $(`sample${slot}`).addEventListener('click', () => {
    loadSample(slot - 1, slot === 1 ? 'pier' : 'boulevard');
  });
});

$('fillAll').addEventListener('click', () => {
  const first = photos.findIndex(Boolean);
  if (first === -1) {
    setStatus('Load a photo first, then fill all panels with it.');
    return;
  }
  state.panels.forEach((panel) => { panel.photo = first; });
  setStatus(`All three panels now use photo ${first + 1}.`);
  redraw();
});

$('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
$('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });

$('panelPhoto').addEventListener('change', (e) => {
  state.panels[activePanel].photo = e.target.value === '' ? null : Number(e.target.value);
  redraw();
});
$('zoom').addEventListener('input', (e) => {
  state.panels[activePanel].zoom = Number(e.target.value) / 100;
  redraw();
});
$('panX').addEventListener('input', (e) => {
  state.panels[activePanel].ox = Number(e.target.value) / 100;
  redraw();
});
$('panY').addEventListener('input', (e) => {
  state.panels[activePanel].oy = Number(e.target.value) / 100;
  redraw();
});
document.querySelectorAll('#panelDots button').forEach((btn, i) => {
  btn.addEventListener('click', () => { activePanel = i; refreshPanelControls(); });
});

$('export').addEventListener('click', exportPng);

preview.addEventListener('pointerdown', (e) => {
  const rect = preview.getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * preview.width;
  const py = ((e.clientY - rect.top) / rect.height) * preview.height;
  const hit = panelAt(state, preview.width, preview.height, px, py);
  if (hit === -1) return;
  activePanel = hit;
  dragging = { x: e.clientX, y: e.clientY, ox: state.panels[hit].ox, oy: state.panels[hit].oy };
  preview.setPointerCapture(e.pointerId);
  refreshPanelControls();
});
preview.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const rect = preview.getBoundingClientRect();
  const spec = state.panels[activePanel];
  spec.ox = Math.max(-0.5, Math.min(0.5, dragging.ox + (e.clientX - dragging.x) / rect.width));
  spec.oy = Math.max(-0.5, Math.min(0.5, dragging.oy + (e.clientY - dragging.y) / rect.height));
  redraw();
});
preview.addEventListener('pointerup', () => { dragging = null; });

// ---- fixed scenes for screenshots: the app itself draws these ----

async function runShot(kind, params) {
  document.body.classList.add(`shot-${kind}`);
  await loadSample(0, 'pier');
  await loadSample(1, 'boulevard');
  state.title = params.get('title') || 'SUNSET HEIST';
  state.subtitle = params.get('subtitle') || 'VICE CITY';
  state.layout = params.get('layout') || 'sunset';
  state.grade = params.get('grade') || 'sunset';
  state.size = params.get('size') || 'wide';
  if (kind === 'portrait') {
    state.size = 'portrait';
    state.layout = 'trio';
    state.grade = 'neon';
    state.title = params.get('title') || 'NEON BOULEVARD';
  }
  if (kind === 'editor') {
    state.layout = 'split';
    state.grade = 'neon';
    state.title = 'BOULEVARD QUEEN';
  }
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  state.panels[0].photo = 0;
  state.panels[1].photo = 1;
  state.panels[2].photo = 0;
  // The pier sample is a close-up: nudge the hero framing down so the
  // fisherman's face and the horizon read instead of a bare shoulder.
  if (kind === 'cover') state.panels[0].oy = 0.16;
  if (kind === 'portrait') state.panels[0].oy = 0.1;
  activePanel = 1;
  buildLayoutPicker();
  buildGradePicker();
  buildSizePicker();
  refreshPhotoSlots();
  redraw();
  document.body.classList.add('shot-ready');
}

function buildLayoutPicker() {
  buildPicker('layoutPicker', LAYOUTS, state.layout, (key) => { state.layout = key; });
}
function buildGradePicker() {
  buildPicker('gradePicker', GRADES, state.grade, (key) => { state.grade = key; });
}

buildLayoutPicker();
buildGradePicker();
buildSizePicker();
refreshPhotoSlots();
$('title').value = state.title;
$('subtitle').value = state.subtitle;

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search));
} else {
  redraw();
}
window.addEventListener('resize', () => { if (!shot) redraw(); });
