/* Сцена с грузовиком: технический рисунок выбранной машины в масштабе.
   Едет при прокрутке, фон реагирует на мышь и наклон телефона (Android — без запроса разрешения). */
window.TruckScene = (() => {
'use strict';
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.append(n);
  return n;
};

/* Геометрия в метрах. x — от задней стенки кузова вперёд, y — от земли вверх. */
const GEO = {
  '1.5': { L: 3.0, H: 1.8, floor: 0.8, cab: 1.9, cabH: 2.15, r: 0.34, rear: [1.9] },
  '2':   { L: 4.2, H: 2.0, floor: 0.85, cab: 1.9, cabH: 2.2, r: 0.34, rear: [2.8] },
  '3':   { L: 5.0, H: 2.2, floor: 0.95, cab: 2.0, cabH: 2.6, r: 0.4, rear: [3.3] },
  '5':   { L: 6.2, H: 2.4, floor: 1.1, cab: 2.1, cabH: 2.95, r: 0.48, rear: [4.1] },
  '10':  { L: 7.5, H: 2.5, floor: 1.2, cab: 2.3, cabH: 3.15, r: 0.5, rear: [4.3, 5.6] },
  '20':  { L: 13.6, H: 2.7, floor: 1.25, cab: 2.4, cabH: 3.5, r: 0.5, rear: [1.4, 2.75, 4.1], semi: true }
};
const MAX_LEN = 13.6 + 3.4 + 0.6;
const MAX_H = 4.6;

function totalLen(g) { return g.semi ? g.L + 3.4 : g.L + 0.15 + g.cab; }

/* Рисует машину в группу root. k — пикселей на метр. Возвращает размеры и колёса. */
function draw(root, t, k, opts = {}) {
  const g = GEO[t] || GEO['5'];
  const len = totalLen(g);
  const W = (len + 0.6) * k, Hpx = MAX_H * k;
  const X = m => (m + 0.3) * k;
  const Y = m => Hpx - m * k;
  root.replaceChildren();
  const wheels = [];
  const body = svg('g', { class: 'ts-truck' }, root);

  // кузов / полуприцеп
  const top = g.floor + g.H + 0.08;
  svg('rect', { x: X(0), y: Y(top), width: g.L * k, height: (top - g.floor + 0.12) * k, rx: 2, class: 'ts-body' }, body);
  // рёбра кузова
  const ribs = Math.max(2, Math.round(g.L / 1.2));
  for (let i = 1; i < ribs; i++) svg('line', { x1: X(g.L / ribs * i), y1: Y(top), x2: X(g.L / ribs * i), y2: Y(g.floor - 0.04), class: 'ts-rib' }, body);
  // паллеты внутри
  const n = Math.floor(g.L / 1.25);
  const pw = 1.1, ph = Math.min(1.35, g.H - 0.3);
  const gap = (g.L - n * pw) / (n + 1);
  for (let i = 0; i < n; i++) {
    const px = gap + i * (pw + gap);
    svg('rect', { x: X(px), y: Y(g.floor + 0.14 + ph), width: pw * k, height: ph * k, class: 'ts-cargo' }, body);
    svg('rect', { x: X(px), y: Y(g.floor + 0.14), width: pw * k, height: 0.14 * k, class: 'ts-pallet' }, body);
  }
  // рама
  const frameEnd = g.semi ? g.L + 3.1 : len - 0.1;
  svg('line', { x1: X(g.semi ? g.L - 2.2 : 0.2), y1: Y(g.floor - 0.12), x2: X(frameEnd), y2: Y(g.floor - 0.12), class: 'ts-frame' }, body);
  if (g.semi) svg('line', { x1: X(0.3), y1: Y(g.floor - 0.12), x2: X(g.L - 0.2), y2: Y(g.floor - 0.12), class: 'ts-frame' }, body);

  // кабина
  const c0 = g.semi ? g.L + 0.6 : g.L + 0.15, c1 = c0 + g.cab * (g.semi ? 1.15 : 1);
  const cb = g.floor - 0.35, ch = g.cabH + (g.semi ? 0 : 0);
  const cab = `M${X(c0)} ${Y(cb)} V${Y(ch)} H${X(c1 - 0.55)} L${X(c1 - 0.05)} ${Y(ch - 1.0)} L${X(c1)} ${Y(cb + 0.35)} V${Y(cb)} Z`;
  svg('path', { d: cab, class: 'ts-cab' }, body);
  const wy = ch - 0.25;
  svg('path', { d: `M${X(c0 + 0.35)} ${Y(wy)} H${X(c1 - 0.62)} L${X(c1 - 0.2)} ${Y(ch - 1.05)} H${X(c0 + 0.35)} Z`, class: 'ts-glass' }, body);
  svg('line', { x1: X(c0 + 0.2), y1: Y(cb + 0.3), x2: X(c1 - 0.3), y2: Y(cb + 0.3), class: 'ts-rib' }, body);
  svg('rect', { x: X(c1 - 0.12), y: Y(cb + 0.62), width: 0.14 * k, height: 0.2 * k, rx: 1, class: 'ts-light' }, body);

  // колёса
  const axles = g.rear.slice();
  if (g.semi) axles.push(g.L + 0.2, c1 - 0.7); else axles.push(c1 - 0.8);
  axles.forEach(ax => {
    const w = svg('g', { transform: `translate(${X(ax)} ${Y(g.r)})` }, body);
    svg('circle', { r: g.r * k, class: 'ts-tyre' }, w);
    svg('circle', { r: g.r * k * 0.55, class: 'ts-rim' }, w);
    const spin = svg('g', { class: 'ts-spin' }, w);
    for (let a = 0; a < 3; a++) svg('line', { x1: 0, y1: 0, x2: 0, y2: -g.r * k * 0.5, transform: `rotate(${a * 120})`, class: 'ts-spoke' }, spin);
    wheels.push(spin);
  });

  // размерные линии
  if (!opts.noDims) {
    const d = svg('g', { class: 'ts-dim' }, root);
    const dy = Y(top + 0.45);
    svg('line', { x1: X(0), y1: dy, x2: X(g.L), y2: dy }, d);
    [0, g.L].forEach(m => svg('line', { x1: X(m), y1: dy - 5, x2: X(m), y2: dy + 5 }, d));
    svg('line', { x1: X(0), y1: dy + 5, x2: X(0), y2: Y(top) - 2, class: 'ts-ext' }, d);
    svg('line', { x1: X(g.L), y1: dy + 5, x2: X(g.L), y2: Y(top) - 2, class: 'ts-ext' }, d);
    const tx = svg('text', { x: X(g.L / 2), y: dy - 7, 'text-anchor': 'middle' }, d);
    tx.textContent = String(g.L).replace('.', ',') + ' м';
  }
  return { width: W, height: Hpx, wheels, r: g.r, len };
}

/* Фон: силуэт города и столбы — генерируется один раз, с фиксированным «случайным» рисунком. */
function skyline(g, width, h) {
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  let x = 0, d = `M0 ${h}`;
  while (x < width) {
    const w = 30 + rnd() * 70, bh = 18 + rnd() * 60;
    d += ` V${h - bh} H${x + w}`;
    x += w;
    if (rnd() > 0.93) { // купол собора
      d += ` V${h - 70} Q${x + 14} ${h - 102} ${x + 28} ${h - 70} V${h - 40}`;
      x += 28;
    }
  }
  d += ` V${h} Z`;
  svg('path', { d }, g);
}
function poles(g, width, h) {
  for (let x = 40; x < width; x += 220) {
    svg('line', { x1: x, y1: h, x2: x, y2: h - 90 }, g);
    svg('path', { d: `M${x} ${h - 90} q14 -6 26 0`, fill: 'none' }, g);
    svg('circle', { cx: x + 120, cy: h - 32, r: 26 }, g);
    svg('line', { x1: x + 120, y1: h, x2: x + 120, y2: h - 10 }, g);
  }
}

/* Интерактивная сцена в hero */
function mount(el, initialTon) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const s = svg('svg', { class: 'ts-svg', 'aria-hidden': 'true', focusable: 'false' }, el);
  const far = svg('g', { class: 'ts-far' }, s);
  const mid = svg('g', { class: 'ts-mid' }, s);
  const road = svg('g', { class: 'ts-road' }, s);
  const roadLine = svg('line', { class: 'ts-road-base' }, road);
  const dashes = svg('line', { class: 'ts-road-dash' }, road);
  const car = svg('g', { class: 'ts-car' }, s);
  const inner = svg('g', {}, car);
  const label = document.createElement('div');
  label.className = 'ts-label';
  el.append(label);

  let W = 0, H = 0, k = 1, info = null, ton = initialTon, x = 0, mx = 0, my = 0, tx = 0, ty = 0, ground = 0;

  function layout() {
    W = el.clientWidth; H = el.clientHeight;
    s.setAttribute('viewBox', `0 0 ${W} ${H}`);
    s.setAttribute('width', W); s.setAttribute('height', H);
    k = Math.min((H - 36) / MAX_H, (W * 0.92) / MAX_LEN);
    ground = H - 14;
    far.replaceChildren(); mid.replaceChildren();
    skyline(far, W + 200, ground);
    poles(mid, W + 400, ground);
    roadLine.setAttribute('x1', -50); roadLine.setAttribute('x2', W + 50);
    roadLine.setAttribute('y1', ground + 1); roadLine.setAttribute('y2', ground + 1);
    dashes.setAttribute('x1', -50); dashes.setAttribute('x2', W + 50);
    dashes.setAttribute('y1', ground + 8); dashes.setAttribute('y2', ground + 8);
    redraw();
  }

  let drive = 0, busy = false, queued = null;
  const ease = {
    in: t => t * t * t,
    out: t => 1 - Math.pow(1 - t, 3)
  };
  function animate(from, to, ms, fn, done) {
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / ms);
      drive = from + (to - from) * fn(t);
      frame();
      if (t < 1) requestAnimationFrame(step); else done && done();
    };
    requestAnimationFrame(step);
  }

  function setLabel() {
    const v = (window.SITE && SITE.vehicles || []).find(v => v.t === ton);
    label.textContent = v ? `${ton.replace('.', ',')} т · ${v.name} · кузов ${v.body.split(' × ')[0]} м · до ${v.pallets} паллет` : '';
  }

  function redraw() { info = draw(inner, ton, k); setLabel(); frame(); }

  /* Смена машины: текущая уезжает вправо, новая заезжает слева. Фон стоит. */
  function swap(next) {
    if (reduce || !info) { ton = next; redraw(); return; }
    if (busy) { queued = next; return; }
    busy = true;
    label.classList.add('ts-hide');
    animate(0, W - baseX() + 40, 650, ease.in, () => {
      ton = next;
      info = draw(inner, ton, k);
      setLabel();
      drive = -(baseX() + info.width + 40);
      frame();
      animate(drive, 0, 1100, ease.out, () => {
        label.classList.remove('ts-hide');
        busy = false;
        if (queued && queued !== ton) { const q = queued; queued = null; swap(q); } else queued = null;
      });
    });
  }

  function baseX() {
    const rect = el.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, 1 - rect.bottom / (window.innerHeight + H)));
    return Math.max(0, W - info.width) * (0.08 + p * 0.84);
  }

  function frame() {
    if (!info) return;
    const bx = baseX();
    x = bx + drive;
    const y = ground - info.height;
    inner.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    car.setAttribute('transform', `translate(${(tx * 6).toFixed(1)} 0)`);
    far.setAttribute('transform', `translate(${(-tx * 18).toFixed(1)} ${(ty * 4).toFixed(1)})`);
    mid.setAttribute('transform', `translate(${(-tx * 36).toFixed(1)} ${(ty * 6).toFixed(1)})`);
    dashes.style.strokeDashoffset = String(-(x * 1.4));
    const deg = (x / k) / info.r * 57.3;
    info.wheels.forEach(w => w.setAttribute('transform', `rotate(${deg.toFixed(1)})`));
  }

  // плавное следование за мышью / наклоном
  let raf = 0;
  function tick() {
    tx += (mx - tx) * 0.08; ty += (my - ty) * 0.08;
    frame();
    raf = Math.abs(mx - tx) > 0.002 || Math.abs(my - ty) > 0.002 ? requestAnimationFrame(tick) : 0;
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  if (!reduce) {
    const hero = el.closest('.hero') || el;
    hero.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
      kick();
    });
    // наклон: работает там, где браузер отдаёт событие без запроса разрешения (Android)
    const needsPermission = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
    if (!needsPermission) {
      window.addEventListener('deviceorientation', e => {
        if (e.gamma == null) return;
        mx = Math.max(-1, Math.min(1, e.gamma / 30)) * 0.5;
        my = Math.max(-1, Math.min(1, ((e.beta || 45) - 45) / 30)) * 0.5;
        kick();
      });
    }
    window.addEventListener('scroll', () => requestAnimationFrame(frame), { passive: true });
  }
  window.addEventListener('resize', () => requestAnimationFrame(layout));
  layout();

  return {
    set(t) { if (t && t !== 'unknown' && GEO[t] && t !== (queued || ton)) swap(t); }
  };
}

return { mount, draw, GEO, totalLen };
})();
