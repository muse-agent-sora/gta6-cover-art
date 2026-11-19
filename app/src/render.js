// Vice City Cover — the cover renderer.
//
// Given a poster state (layout, colour grade, title, subtitle, and one
// photo per panel with its own zoom and pan), this module paints the whole
// poster onto any 2D canvas: white gutters between the panels, a sunset or
// neon grade washed over each photo, and big condensed caption lettering
// across the foot. It knows nothing about the DOM: the editor hands it a
// canvas and a plain state object, and export just calls it on a fresh
// canvas at the chosen print size.

export const POSTER_SIZES = {
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
  wide: { w: 1920, h: 1080, label: '1920 x 1080' },
};

export const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    wash: ['rgba(255, 122, 26, 0.28)', 'rgba(214, 41, 118, 0.42)', 'rgba(43, 16, 66, 0.30)'],
    title: ['#ffd23e', '#ff7a1a', '#ff2e88'],
    band: 'rgba(24, 8, 38, 0.72)',
  },
  neon: {
    label: 'Neon Night',
    wash: ['rgba(0, 229, 255, 0.22)', 'rgba(255, 0, 153, 0.38)', 'rgba(10, 8, 48, 0.34)'],
    title: ['#7df9ff', '#ff5ce1', '#b967ff'],
    band: 'rgba(8, 6, 32, 0.78)',
  },
  midnight: {
    label: 'Midnight Blue',
    wash: ['rgba(64, 120, 255, 0.24)', 'rgba(120, 40, 200, 0.36)', 'rgba(4, 6, 24, 0.38)'],
    title: ['#cfe6ff', '#8fb8ff', '#e6b3ff'],
    band: 'rgba(4, 8, 28, 0.76)',
  },
};

// Panel rectangles as fractions of the poster, per layout. Every layout
// uses three panels so one photo can fill the poster or three photos can
// each own a panel.
export const LAYOUTS = {
  sunset: {
    label: 'Sunset Grid',
    panels: [
      { x: 0, y: 0, w: 1, h: 0.6 },
      { x: 0, y: 0.6, w: 0.5, h: 0.4 },
      { x: 0.5, y: 0.6, w: 0.5, h: 0.4 },
    ],
  },
  trio: {
    label: 'Neon Trio',
    panels: [
      { x: 0, y: 0, w: 1 / 3, h: 1 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
    ],
  },
  split: {
    label: 'Vice Split',
    panels: [
      { x: 0, y: 0, w: 0.62, h: 1 },
      { x: 0.62, y: 0, w: 0.38, h: 0.5 },
      { x: 0.62, y: 0.5, w: 0.38, h: 0.5 },
    ],
  },
};

export function defaultPosterState() {
  return {
    layout: 'sunset',
    grade: 'sunset',
    size: 'wide',
    title: 'SUNSET HEIST',
    subtitle: 'VICE CITY',
    panels: [
      { photo: 0, zoom: 1, ox: 0, oy: 0 },
      { photo: 1, zoom: 1, ox: 0, oy: 0 },
      { photo: 0, zoom: 1, ox: 0, oy: 0 },
    ],
  };
}

// Paints one photo into a rectangle, cover-fit, with the panel's zoom
// centred on its pan offset (ox, oy in fractions of the panel size).
function paintPhotoInto(ctx, img, rx, ry, rw, rh, zoom, ox, oy) {
  const base = Math.max(rw / img.naturalWidth, rh / img.naturalHeight);
  const scale = base * zoom;
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const dx = rx + (rw - pw) / 2 + ox * rw;
  const dy = ry + (rh - ph) / 2 + oy * rh;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rx, ry, rw, rh);
  ctx.clip();
  ctx.drawImage(img, dx, dy, pw, ph);
  ctx.restore();
}

function paintGradeWash(ctx, rx, ry, rw, rh, grade) {
  const wash = ctx.createLinearGradient(rx, ry, rx + rw * 0.35, ry + rh);
  wash.addColorStop(0, grade.wash[0]);
  wash.addColorStop(0.55, grade.wash[1]);
  wash.addColorStop(1, grade.wash[2]);
  ctx.fillStyle = wash;
  ctx.fillRect(rx, ry, rw, rh);
  const vig = ctx.createRadialGradient(
    rx + rw / 2, ry + rh / 2, Math.min(rw, rh) * 0.35,
    rx + rw / 2, ry + rh / 2, Math.max(rw, rh) * 0.75,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(rx, ry, rw, rh);
}

// A retro striped sun, drawn in the top corner of the hero panel.
function paintStripedSun(ctx, cx, cy, r, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const sun = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  sun.addColorStop(0, grade.title[0]);
  sun.addColorStop(0.6, grade.title[1]);
  sun.addColorStop(1, grade.title[2]);
  ctx.fillStyle = sun;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = 'rgba(10, 6, 24, 0.9)';
  for (let i = 0; i < 4; i += 1) {
    const y = cy + r * (0.05 + i * 0.22);
    ctx.fillRect(cx - r, y, r * 2, r * 0.055);
  }
  ctx.restore();
}

function fitCaptionSize(ctx, text, fontFamily, maxWidth, startSize) {
  let size = startSize;
  for (;;) {
    ctx.font = `${size}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth || size <= 16) return size;
    size = Math.max(16, Math.floor(size * 0.92));
  }
}

function paintCaptionBand(ctx, w, h, state, grade) {
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim().toUpperCase();
  if (!title && !subtitle) return;
  const bandH = h * (title ? 0.21 : 0.1);
  const bandY = h - bandH;
  ctx.fillStyle = grade.band;
  ctx.fillRect(0, bandY, w, bandH);
  ctx.fillStyle = grade.title[1];
  ctx.fillRect(0, bandY, w, Math.max(3, h * 0.004));
  if (subtitle) {
    // Shrink the tagline until its letterspaced width fits the band.
    let subSize = Math.round(h * 0.028);
    let subWidth = 0;
    for (;;) {
      ctx.font = `700 ${subSize}px "Archivo Black", "Arial Black", sans-serif`;
      const gap = Math.round(subSize * 0.35);
      subWidth = [...subtitle].reduce((sum, ch) => sum + ctx.measureText(ch).width + gap, -gap);
      if (subWidth <= w * 0.92 || subSize <= 10) break;
      subSize = Math.max(10, Math.floor(subSize * 0.9));
    }
    ctx.font = `700 ${subSize}px "Archivo Black", "Arial Black", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    const gap = Math.round(subSize * 0.35);
    let x = w * 0.045;
    for (const ch of subtitle) {
      ctx.fillText(ch, x, bandY + h * 0.055);
      x += ctx.measureText(ch).width + gap;
    }
  }
  if (title) {
    const family = '"Anton", "Archivo Black", "Arial Black", sans-serif';
    const size = fitCaptionSize(ctx, title, family, w * 0.92, h * 0.115);
    ctx.font = `${size}px ${family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const ty = bandY + bandH * 0.82;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.09);
    ctx.strokeStyle = 'rgba(12, 4, 24, 0.9)';
    ctx.strokeText(title, w / 2, ty);
    const fill = ctx.createLinearGradient(0, ty - size, 0, ty + size * 0.1);
    fill.addColorStop(0, grade.title[0]);
    fill.addColorStop(0.55, grade.title[1]);
    fill.addColorStop(1, grade.title[2]);
    ctx.fillStyle = fill;
    ctx.fillText(title, w / 2, ty);
  }
}

// The main entry point: paints the full poster described by `state` onto
// `canvas` (which must already be sized to the wanted export size), using
// `photos`, an array of loaded images (or nulls) indexed by slot.
export function drawPoster(canvas, state, photos) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const layout = LAYOUTS[state.layout] || LAYOUTS.sunset;
  const grade = GRADES[state.grade] || GRADES.sunset;
  const gutter = Math.round(Math.min(w, h) * 0.014);
  ctx.fillStyle = '#f5efe6';
  ctx.fillRect(0, 0, w, h);
  layout.panels.forEach((panel, i) => {
    const rx = Math.round(panel.x * w) + (panel.x > 0 ? gutter : 0);
    const ry = Math.round(panel.y * h) + (panel.y > 0 ? gutter : 0);
    const rw = Math.round(panel.w * w) - (panel.x > 0 ? gutter : 0) - (panel.x + panel.w < 1 ? gutter : 0);
    const rh = Math.round(panel.h * h) - (panel.y > 0 ? gutter : 0) - (panel.y + panel.h < 1 ? gutter : 0);
    const spec = state.panels[i] || { photo: null, zoom: 1, ox: 0, oy: 0 };
    const img = spec.photo === null || spec.photo === undefined ? null : photos[spec.photo];
    if (img) {
      paintPhotoInto(ctx, img, rx, ry, rw, rh, spec.zoom || 1, spec.ox || 0, spec.oy || 0);
    } else {
      const empty = ctx.createLinearGradient(rx, ry, rx + rw, ry + rh);
      empty.addColorStop(0, '#3a2350');
      empty.addColorStop(1, '#160a24');
      ctx.fillStyle = empty;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = `700 ${Math.round(Math.min(rw, rh) * 0.05)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('ADD A PHOTO', rx + rw / 2, ry + rh / 2);
    }
    paintGradeWash(ctx, rx, ry, rw, rh, grade);
    if (i === 0 && img) {
      paintStripedSun(ctx, rx + rw * 0.86, ry + rh * 0.2, Math.min(rw, rh) * 0.11, grade);
    }
  });
  paintCaptionBand(ctx, w, h, state, grade);
  return { layout: state.layout, grade: state.grade, w, h };
}

// Which panel index contains the point (px, py) on a canvas of size w x h,
// or -1 when the point lands on a gutter or outside the poster.
export function panelAt(state, w, h, px, py) {
  const layout = LAYOUTS[state.layout] || LAYOUTS.sunset;
  const gutter = Math.round(Math.min(w, h) * 0.014);
  for (let i = 0; i < layout.panels.length; i += 1) {
    const p = layout.panels[i];
    const rx = Math.round(p.x * w) + (p.x > 0 ? gutter : 0);
    const ry = Math.round(p.y * h) + (p.y > 0 ? gutter : 0);
    const rw = Math.round(p.w * w) - (p.x > 0 ? gutter : 0) - (p.x + p.w < 1 ? gutter : 0);
    const rh = Math.round(p.h * h) - (p.y > 0 ? gutter : 0) - (p.y + p.h < 1 ? gutter : 0);
    if (px >= rx && px <= rx + rw && py >= ry && py <= ry + rh) return i;
  }
  return -1;
}
