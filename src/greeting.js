(() => {
'use strict';
const SITE = window.SITE;
const $ = s => document.querySelector(s);
const q = new URLSearchParams(location.search);
const occasions = SITE.occasions || [];
const clip = (v, n) => (v || '').trim().slice(0, n);
const num = v => { const n = parseFloat(String(v || '').replace(/\s/g, '').replace(',', '.')); return isFinite(n) && n > 0 ? n : 0; };
const fmt = n => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: n < 10 && n % 1 ? 1 : 0 }).format(n);
const plural = (n, forms) => {
  const i = Math.floor(n), a = i % 100, b = i % 10;
  if (n % 1) return forms[1];
  return a > 10 && a < 20 ? forms[2] : b === 1 ? forms[0] : b > 1 && b < 5 ? forms[1] : forms[2];
};
const lowerFirst = s => s.charAt(0).toLowerCase() + s.slice(1);

const data = {
  h: q.get('h'), to: clip(q.get('to'), 60), co: clip(q.get('co'), 80), since: clip(q.get('since'), 4).replace(/\D/g, ''),
  trips: num(q.get('trips')), tons: num(q.get('tons')), km: num(q.get('km')),
  gift: Math.min(50, num(q.get('gift'))), until: clip(q.get('until'), 30)
};

if (data.to || data.co) card(); else generator();

function card() {
  const o = occasions.find(x => x.id === data.h) || occasions.find(x => x.id === 'thanks');
  const who = data.to || data.co;
  const title = o.id === 'thanks' ? `${who}, спасибо, что вы с нами` : `${who}, ${lowerFirst(o.title)}`;
  $('#g-title').textContent = title.replace(/ (с|со|в|и) /g, ' $1\u00a0');
  document.title = title;
  const sub = [data.to && data.co ? data.co : '', data.since ? `вместе с ${data.since} года` : ''].filter(Boolean).join(' — ');
  $('#g-sub').textContent = sub;
  $('#g-sub').hidden = !sub;
  $('#g-text').textContent = o.greeting;
  $('#g-wish').textContent = o.wish;

  // Показатели и их «перевод» в понятные вещи
  const stats = [];
  if (data.trips) stats.push([data.trips, plural(data.trips, ['рейс', 'рейса', 'рейсов']), 'Каждый — чья-то стройка, магазин или переезд']);
  if (data.tons) stats.push([data.tons, plural(data.tons, ['тонна груза', 'тонны груза', 'тонн груза']), data.tons >= 5 ? `≈ ${fmt(Math.round(data.tons / 5))} ${plural(Math.round(data.tons / 5), ['полный пятитонник', 'полных пятитонника', 'полных пятитонников'])}` : '']);
  if (data.km) stats.push([data.km, 'км дорог вместе', data.km >= 140 ? `≈ ${fmt(Math.round(data.km / 140))} ${plural(Math.round(data.km / 140), ['поездка', 'поездки', 'поездок'])} Дмитров — Москва и обратно` : '']);
  const box = $('#g-stats');
  stats.forEach(([n, label, note]) => {
    const d = document.createElement('div');
    d.className = 'g-stat';
    const b = document.createElement('b'); b.textContent = '0'; b.dataset.n = n;
    const s = document.createElement('span'); s.textContent = label;
    d.append(b, s);
    if (note) { const sm = document.createElement('small'); sm.textContent = note; d.append(sm); }
    box.append(d);
  });
  $('#g-kicker').hidden = !stats.length;

  if (data.gift) {
    $('#g-gift').hidden = false;
    $('#g-gift-title').textContent = `Подарок: −${fmt(data.gift)}% на следующий рейс`;
    $('#g-gift-text').textContent = data.until ? `Действует до ${data.until}. Просто скажите, что получили открытку.` : 'Просто скажите, что получили открытку.';
  }

  // Грузовик: тот же рисунок, что на сайте
  const svgEl = $('#g-truck');
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svgEl.append(g);
  const k = Math.min(30, (Math.min(window.innerWidth, 880) - 40) / 9.5);
  const t = data.tons > 60 ? '20' : data.tons > 20 ? '10' : '5';
  const info = TruckScene.draw(g, t, k, { noDims: true });
  svgEl.setAttribute('viewBox', `0 0 ${info.width} ${info.height}`);
  svgEl.setAttribute('width', info.width);
  svgEl.setAttribute('height', info.height);

  $('#card').hidden = false;

  // Счётчики запускаются, когда блок в поле зрения
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const run = el => {
    const target = +el.dataset.n;
    if (reduce) { el.textContent = fmt(target); return; }
    const t0 = performance.now(), dur = 1400;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(p < 1 ? Math.round(target * e) : target);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } }), { threshold: 0.4 }) : null;
  box.querySelectorAll('b').forEach(b => io ? io.observe(b) : run(b));
}

function generator() {
  $('#gen').hidden = false;
  const form = $('#gen-form'), sel = $('#gen-h'), out = $('#gen-out');
  occasions.forEach(o => { const op = document.createElement('option'); op.value = o.id; op.textContent = o.title; sel.append(op); });
  const base = location.href.split('?')[0].split('#')[0];
  const update = () => {
    const p = new URLSearchParams();
    [...form.elements].forEach(el => { if (el.name && el.value.trim()) p.set(el.name, el.value.trim()); });
    const ok = p.get('to') || p.get('co');
    const url = base + '?' + p.toString();
    out.textContent = ok ? url : 'Заполните хотя бы имя или компанию.';
    $('#gen-open').href = ok ? url : '#';
    const text = ok ? `${p.get('to') || p.get('co')}, это для вас 🙂` : '';
    $('#gen-tg').href = ok ? `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` : '#';
    form.dataset.url = ok ? url : '';
  };
  form.addEventListener('input', update);
  $('#gen-copy').addEventListener('click', async () => {
    if (!form.dataset.url) return;
    try { await navigator.clipboard.writeText(form.dataset.url); $('#gen-copy').textContent = 'Скопировано'; }
    catch (e) { $('#gen-copy').textContent = 'Скопируйте из поля выше'; }
    setTimeout(() => { $('#gen-copy').textContent = 'Скопировать ссылку'; }, 2000);
  });
  update();
}
})();
