(() => {
'use strict';
const SITE = window.SITE, T = window.TARIFFS, PAGE = window.PAGE;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rub = n => new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.flat().forEach(k => k != null && n.append(k));
  return n;
};

/* ---------- UTM и цели ---------- */
const params = new URLSearchParams(location.search);
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid'];
let utm = {};
try { utm = JSON.parse(sessionStorage.getItem('utm') || '{}'); } catch (e) {}
UTM_KEYS.forEach(k => { const v = params.get(k); if (v) utm[k] = v.slice(0, 200); });
try { sessionStorage.setItem('utm', JSON.stringify(utm)); } catch (e) {}

const reached = new Set();
function track(goal, once) {
  if (once && reached.has(goal)) return;
  reached.add(goal);
  try {
    if (SITE.metrikaId && typeof window.ym === 'function') window.ym(SITE.metrikaId, 'reachGoal', goal);
    else if (SITE.demo) console.info('[цель]', goal);
  } catch (e) {}
}

let toastTimer;
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
}

/* ---------- Данные квиза ---------- */
const TASKS = [
  ['build', 'Стройматериалы'], ['pallets', 'Паллеты и товары'], ['move', 'Мебель, переезд'],
  ['equipment', 'Оборудование'], ['dacha', 'Дача и участок'], ['shop', 'Покупки из магазина'],
  ['other', 'Другое']
];
const ZONES = [
  ['city', 'По Дмитрову', 'city'], ['district', 'По Дмитровскому округу', 'district'],
  ['to_msk', 'Дмитров → Москва', 'moscow'], ['from_msk', 'Москва → Дмитров', 'moscow'],
  ['other', 'Другой маршрут по МО', null]
];
const LOADERS = [['no', 'Не нужны'], ['yes', 'Нужны'], ['unsure', 'Пока не знаю']];
const vehicle = t => SITE.vehicles.find(v => v.t === t);
const tonLabel = t => (t === 'unknown' ? 'Подберите машину' : `${vehicle(t).name}, ${t.replace('.', ',')} т`);
const label = (list, key) => (list.find(x => x[0] === key) || [, '—'])[1];

const state = { task: null, tonnage: null, zone: PAGE.zone || null, loaders: null };

/* Мультилендинг: ?g=g05 или utm_content=g05 в адресе объявления (только текущий URL, не сохранённые метки) */
const vKey = (params.get('g') || params.get('utm_content') || '').toLowerCase();
const variant = SITE.variants[vKey];
if (variant) {
  if (variant.h1) { $('#h1').textContent = variant.h1; document.title = variant.h1 + ' — ' + SITE.brand; }
  if (variant.tonnage && vehicle(variant.tonnage)) state.tonnage = variant.tonnage;
  if (variant.zone) state.zone = variant.zone;
  if (variant.task) state.task = variant.task;
}

const tonnageOptions = () => {
  const list = [...PAGE.tonnages];
  if (state.tonnage && state.tonnage !== 'unknown' && !list.includes(state.tonnage)) list.push(state.tonnage);
  return list.sort((a, b) => a - b).map(t => {
    const v = vehicle(t);
    return [t, `${t.replace('.', ',')} т · ${v.name}`, `${v.volume}, ${v.pallets} паллет`];
  }).concat([['unknown', 'Не знаю — подберите', 'Бесплатно, по описанию или фото груза']]);
};

const STEPS = [
  { key: 'task', q: 'Что нужно перевезти?', options: () => TASKS },
  { key: 'tonnage', q: 'Какая машина нужна?', hint: 'Сомневаетесь — выберите «подберите», это бесплатно', options: tonnageOptions },
  { key: 'zone', q: 'Куда везём?', options: () => ZONES },
  { key: 'loaders', q: 'Нужны грузчики?', hint: 'Оплачиваются отдельно, цена будет в заявке', options: () => LOADERS }
];

function estimate() {
  const range = T.baseRanges[state.tonnage];
  const zone = ZONES.find(z => z[0] === state.zone);
  const factor = zone && zone[2] ? T.zoneFactors[zone[2]] : null;
  if (!range || !factor) return null;
  const r = n => Math.round(n / T.roundTo) * T.roundTo;
  return [r(range[0] * factor), r(range[1] * factor)];
}

/* ---------- Рендер квиза ---------- */
const body = $('#q-body'), back = $('#q-back'), bar = $('#q-bar'), stepLabel = $('#q-label');
let step = 0;
let scene = null;
let heroBg = null;

function render(focus) {
  if (scene) scene.set(state.tonnage);
  if (heroBg) heroBg.set(state.tonnage);
  body.replaceChildren();
  back.hidden = step === 0 || step > STEPS.length;
  const total = STEPS.length;
  if (step < total) {
    stepLabel.textContent = `Шаг ${step + 1} из ${total}`;
    bar.style.width = ((step + 1) / (total + 1) * 100) + '%';
    renderStep(STEPS[step]);
  } else if (step === total) {
    stepLabel.textContent = 'Готово';
    bar.style.width = '100%';
    renderResult();
  }
  if (focus && step < total) {
    const f = body.querySelector('[aria-pressed=true], button');
    if (f) f.focus({ preventScroll: true });
  }
}

function renderStep(s) {
  const opts = s.options();
  const grid = el('div', { className: 'q-options', role: 'group' });
  grid.setAttribute('aria-label', s.q);
  opts.forEach(([value, text, sub], i) => {
    const b = el('button', { type: 'button', className: 'q-opt' }, el('b', { textContent: text }), sub ? el('small', { textContent: sub }) : null);
    if (opts.length % 2 && i === opts.length - 1) b.classList.add('q-opt-wide');
    b.setAttribute('aria-pressed', String(state[s.key] === value));
    b.addEventListener('click', () => {
      state[s.key] = value;
      track('quiz_step_' + (step + 1), true);
      if (step === 0) track('quiz_start', true);
      step++;
      render(true);
    });
    grid.append(b);
  });
  body.append(el('p', { className: 'q-question', textContent: s.q }));
  if (s.hint) body.append(el('p', { className: 'q-hint', textContent: s.hint }));
  body.append(grid);
}

function renderResult() {
  track('quiz_result', true);
  const est = estimate();
  const summary = el('ul', { className: 'q-summary' },
    row('Груз', label(TASKS, state.task)),
    row('Машина', tonLabel(state.tonnage)),
    row('Маршрут', label(ZONES, state.zone)),
    row('Грузчики', label(LOADERS, state.loaders)));
  const price = est
    ? [el('p', { className: 'q-kicker', textContent: 'Предварительная стоимость рейса' }),
       el('p', { className: 'q-price', textContent: `${rub(est[0])} – ${rub(est[1])}` }),
       el('p', { className: 'q-price-note', textContent: state.loaders === 'no' ? 'Подача, пробег и время погрузки включены.' : 'Подача и пробег включены, грузчики — отдельной строкой.' })]
    : [el('p', { className: 'q-kicker', textContent: 'Стоимость' }),
       el('p', { className: 'q-price', textContent: 'Рассчитаем точно' }),
       el('p', { className: 'q-price-note', textContent: state.tonnage === 'unknown' ? 'Подберём машину по описанию груза и назовём цену.' : 'Для этого маршрута цену считаем по адресам.' })];

  const form = leadForm('quiz', 'Получить точную цену');
  body.append(el('div', { className: 'q-result' }, ...price, summary,
    el('div', { className: 'q-offer' }, el('b', { textContent: 'Зафиксируем точную цену за 10 минут' }), ` и дадим скидку ${SITE.firstOrderDiscount}% на первый рейс.`),
    form));
}

function row(k, v) { return el('li', {}, el('span', { textContent: k }), el('b', { textContent: v })); }

function leadForm(kind, cta) {
  const f = el('form', { className: 'lead-form', noValidate: true });
  f.dataset.kind = kind;
  const phone = el('input', { name: 'phone', type: 'tel', inputMode: 'tel', autocomplete: 'tel', placeholder: '+7 (___) ___-__-__', required: true });
  const ch = el('div', { className: 'channels', role: 'radiogroup' });
  ch.setAttribute('aria-label', 'Как удобнее связаться');
  [['call', 'Звонок'], ['telegram', 'Telegram'], ['max', 'MAX']].forEach(([v, t], i) => {
    ch.append(el('label', {}, el('input', { type: 'radio', name: 'channel', value: v, checked: i === 0 }), el('span', { textContent: t })));
  });
  f.append(
    el('label', {}, 'Телефон', phone),
    el('p', { className: 'lbl', textContent: 'Как удобнее связаться' }), ch,
    el('label', { className: 'consent' }, el('input', { type: 'checkbox', name: 'consent', required: true }),
      el('span', {}, 'Согласен на обработку персональных данных по ', el('a', { href: 'privacy.html', textContent: 'политике' }))),
    el('button', { className: 'btn btn-accent btn-block', type: 'submit', textContent: cta }),
    el('p', { className: 'form-status', role: 'status' }));
  bindForm(f);
  return f;
}

/* ---------- Телефон и отправка ---------- */
function formatPhone(v) {
  let d = v.replace(/\D/g, '');
  if (d.startsWith('8')) d = '7' + d.slice(1);
  if (d && !d.startsWith('7')) d = '7' + d;
  d = d.slice(0, 11);
  const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
  let out = '+7';
  if (p[0]) out += ' (' + p[0];
  if (p[0].length === 3) out += ')';
  if (p[1]) out += ' ' + p[1];
  if (p[2]) out += '-' + p[2];
  if (p[3]) out += '-' + p[3];
  return d ? out : '';
}

function bindForm(f) {
  const phone = f.elements.phone;
  phone.addEventListener('input', () => { phone.value = formatPhone(phone.value); phone.removeAttribute('aria-invalid'); });
  phone.addEventListener('focus', () => { if (!phone.value) phone.value = '+7 ('; track('form_focus', true); });
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const status = f.querySelector('.form-status');
    const btn = f.querySelector('[type=submit]');
    status.className = 'form-status';
    const digits = phone.value.replace(/\D/g, '');
    if (digits.length !== 11) {
      phone.setAttribute('aria-invalid', 'true');
      status.classList.add('err');
      status.textContent = 'Проверьте номер: нужно 10 цифр после +7.';
      phone.focus();
      return;
    }
    if (!f.elements.consent.checked) {
      status.classList.add('err');
      status.textContent = 'Нужно согласие на обработку данных, чтобы мы могли перезвонить.';
      return;
    }
    const payload = {
      kind: f.dataset.kind,
      phone: '+' + digits,
      channel: f.elements.channel ? f.elements.channel.value : 'call',
      company: f.elements.company ? f.elements.company.value.trim().slice(0, 200) : undefined,
      quiz: f.dataset.kind === 'quiz' ? { task: state.task, tonnage: state.tonnage, zone: state.zone, loaders: state.loaders, estimate: estimate() } : undefined,
      page: location.pathname.split('/').pop() || 'index.html',
      variant: variant ? vKey : undefined,
      utm,
      sentAt: new Date().toISOString()
    };
    btn.disabled = true;
    btn.textContent = 'Отправляем…';
    try {
      if (SITE.leadEndpoint) {
        const res = await fetch(SITE.leadEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
      } else {
        await new Promise(r => setTimeout(r, 500));
      }
      track('lead_' + f.dataset.kind);
      track('lead');
      done(f);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Отправить ещё раз';
      status.classList.add('err');
      status.replaceChildren('Не удалось отправить. Попробуйте ещё раз или позвоните: ', el('a', { href: 'tel:' + SITE.phoneTel, textContent: SITE.phone }));
    }
  });
}

function done(f) {
  const icon = el('div', { className: 'q-done-icon' });
  icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const box = el('div', { className: 'q-done' }, icon,
    el('p', { className: 'q-question', textContent: 'Заявка принята' }),
    el('p', { textContent: `Перезвоним в течение 10 минут в рабочее время (${SITE.hours.toLowerCase()}) и назовём точную цену.` }),
    SITE.demo ? el('p', { textContent: 'Демоверсия: заявка никуда не отправлена.' }) : null);
  f.replaceWith(box);
  if (f.dataset.kind === 'quiz') { back.hidden = true; stepLabel.textContent = 'Заявка принята'; }
}

/* ---------- Навигация и связь с остальной страницей ---------- */
back.addEventListener('click', () => {
  step = Math.max(0, step - 1);
  render(true);
});

function openQuiz() {
  const firstEmpty = STEPS.findIndex(s => !state[s.key]);
  step = firstEmpty === -1 ? STEPS.length : firstEmpty;
  render(false);
  $('#quiz').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  if (step < STEPS.length) setTimeout(() => { const f = body.querySelector('[aria-pressed=true], button'); if (f) f.focus({ preventScroll: true }); }, 400);
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-goal],[data-tonnage],[data-task],[data-zone],[data-messenger]');
  if (!t) return;
  if (t.dataset.goal) track(t.dataset.goal);
  if (t.dataset.messenger && !SITE[t.dataset.messenger]) {
    e.preventDefault();
    toast('Демоверсия: ссылка на мессенджер появится после подключения аккаунта.');
    return;
  }
  if (t.dataset.tonnage || t.dataset.task || t.dataset.zone) {
    e.preventDefault();
    if (t.dataset.tonnage) state.tonnage = t.dataset.tonnage;
    if (t.dataset.task) state.task = t.dataset.task;
    if (t.dataset.zone) state.zone = t.dataset.zone;
    openQuiz();
  }
});

/* ---------- Праздничная плашка ---------- */
function occasionWindow(o, now) {
  const y = now.getFullYear();
  const day = (yy, mm, dd) => new Date(yy, mm - 1, dd);
  if (o.rule && o.rule.startsWith('last-sunday-')) {
    const m = +o.rule.split('-')[2];
    const d = day(y, m + 1, 0);
    d.setDate(d.getDate() - d.getDay());
    const from = new Date(d); from.setDate(d.getDate() - (o.before || 0));
    const to = new Date(d); to.setDate(d.getDate() + (o.after || 0));
    return [from, to];
  }
  if (o.from && o.to) {
    const [fm, fd] = o.from.split('-').map(Number), [tm, td] = o.to.split('-').map(Number);
    let from = day(y, fm, fd), to = day(y, tm, td);
    if (to < from) { if (now >= from) to = day(y + 1, tm, td); else from = day(y - 1, fm, fd); }
    return [from, to];
  }
  return null;
}
function showOccasion() {
  const list = SITE.occasions || [];
  const forced = params.get('occasion');
  const now = new Date(); now.setHours(12, 0, 0, 0);
  const o = forced ? list.find(x => x.id === forced) : list.find(x => {
    if (x.manual || !x.banner) return false;
    const w = occasionWindow(x, now);
    return w && now >= w[0] && now <= new Date(w[1].getTime() + 864e5 - 1);
  });
  if (!o || !o.banner) return;
  const key = 'occasion-closed-' + o.id + '-' + now.getFullYear();
  try { if (!forced && localStorage.getItem(key)) return; } catch (e) {}
  $('#occasion-title').textContent = o.title;
  $('#occasion-text').textContent = o.banner;
  $('#occasion').hidden = false;
  $('#occasion-close').addEventListener('click', () => {
    $('#occasion').hidden = true;
    try { localStorage.setItem(key, '1'); } catch (e) {}
  });
}
showOccasion();

/* ---------- Фото на фоне: параллакс и смена по тоннажу ---------- */
function mountHeroBg(root) {
  const layer = root.querySelector('.hb-layer');
  const slides = [...root.querySelectorAll('.hb-slide')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current = (slides.find(s => s.classList.contains('is-on')) || slides[0]).dataset.t;
  const load = s => { const img = s.querySelector('img[data-srcset]'); if (img) { img.srcset = img.dataset.srcset; img.removeAttribute('data-srcset'); } };
  const loadAll = () => slides.forEach(load);
  if (document.readyState === 'complete') setTimeout(loadAll, 1500); else window.addEventListener('load', () => setTimeout(loadAll, 1500));

  let mx = 0, my = 0, tx = 0, ty = 0, raf = 0;
  const hero = root.closest('.hero');
  function apply() {
    const r = hero.getBoundingClientRect();
    const sy = Math.max(0, -r.top);
    layer.style.transform = `translate3d(${(-tx * 22).toFixed(1)}px, ${(sy * 0.35 - ty * 14).toFixed(1)}px, 0)`;
  }
  function tick() {
    tx += (mx - tx) * 0.07; ty += (my - ty) * 0.07;
    apply();
    raf = Math.abs(mx - tx) > 0.001 || Math.abs(my - ty) > 0.001 ? requestAnimationFrame(tick) : 0;
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  if (!reduce) {
    hero.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; kick();
    });
    const needsPermission = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
    if (!needsPermission) window.addEventListener('deviceorientation', e => {
      if (e.gamma == null) return;
      mx = Math.max(-1, Math.min(1, e.gamma / 25)) * 0.5;
      my = Math.max(-1, Math.min(1, ((e.beta || 45) - 45) / 25)) * 0.5;
      kick();
    });
    window.addEventListener('scroll', () => requestAnimationFrame(apply), { passive: true });
  }
  apply();
  return {
    set(t) {
      const to = slides.find(s => s.dataset.t === t);
      if (!to || t === current) return;
      const from = slides.find(s => s.dataset.t === current), next = t;
      load(to);
      from.classList.remove('is-on'); from.classList.add('is-out');
      to.classList.remove('is-out');
      void to.offsetWidth;
      to.classList.add('is-on');
      setTimeout(() => from.classList.remove('is-out'), 1200);
      current = next;
    }
  };
}
const heroBgEl = $('#hero-bg');
heroBg = heroBgEl ? mountHeroBg(heroBgEl) : null;

const sceneEl = $('#scene');
scene = sceneEl && window.TruckScene ? TruckScene.mount(sceneEl, state.tonnage && state.tonnage !== 'unknown' ? state.tonnage : PAGE.sceneTonnage) : null;
$$('form.lead-form').forEach(bindForm);
render(false);
})();
