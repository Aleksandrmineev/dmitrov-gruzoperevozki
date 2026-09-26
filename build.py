#!/usr/bin/env python3
"""Сборка посадочных страниц: python3 build.py

Источники: src/template.html, src/styles.css, src/app.js, site.json, pages.json, tariffs.json.
Готовые страницы перезаписываются — правьте источники, а не *.html в корне.
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'


def load_json(name):
    return json.loads((ROOT / name).read_text(encoding='utf-8'))


def read(name):
    return (SRC / name).read_text(encoding='utf-8')


site = load_json('site.json')
pages = load_json('pages.json')
tariffs = load_json('tariffs.json')
esc = html.escape


def rub(n):
    return f'{n:,}'.replace(',', ' ') + ' ₽'


def price_from(tonnage, zone):
    step = tariffs['roundTo']
    return round(tariffs['baseRanges'][tonnage][0] * tariffs['zoneFactors'][zone] / step) * step


def js_json(data):
    """JSON для вставки в <script>: без закрывающих тегов внутри строк."""
    return json.dumps(data, ensure_ascii=False).replace('<', '\\u003c')


def nav(current):
    return ''.join(
        f'<a href="{p["file"]}"' + (' aria-current="page"' if p['file'] == current else '') + f'>{esc(p["nav"])}</a>'
        for p in pages)


def route_prices(page):
    smallest = min(page['tonnages'], key=float)
    stops = [('city', 'city', 'По Дмитрову'), ('district', 'district', 'По округу'), ('to_msk', 'moscow', 'Дмитров ↔ Москва')]
    return ''.join(
        f'<button type="button" data-zone="{key}" data-goal="route_click"><span>{label}</span><b>от {rub(price_from(smallest, zone))}</b></button>'
        for key, zone, label in stops)


def vehicles(page):
    longest = max(v['len'] for v in site['vehicles'])
    cards = []
    for v in site['vehicles']:
        if v['t'] not in page['tonnages']:
            continue
        t = v['t'].replace('.', ',')
        width = round(v['len'] / longest * 100, 1)
        cards.append(f'''<article class="veh">
  <div class="veh-top"><span class="veh-t">{t}<small>т</small></span><span class="veh-name">{esc(v["name"])}</span></div>
  <div class="veh-len" aria-hidden="true"><i style="width:{width}%"></i></div>
  <span class="veh-len-cap">Длина кузова относительно фуры 13,6 м</span>
  <dl class="veh-specs">
    <div><dt>Кузов, Д×Ш×В</dt><dd>{v["body"]}</dd></div>
    <div><dt>Объём</dt><dd>{v["volume"]}</dd></div>
    <div><dt>Европаллеты</dt><dd>до {v["pallets"]}</dd></div>
    <div><dt>Кузова</dt><dd>{esc(v["bodies"])}</dd></div>
  </dl>
  <p class="veh-fits">{esc(v["fits"])}</p>
  <div class="veh-foot">
    <div class="veh-price"><b>от {rub(price_from(v["t"], "city"))}</b><span>по Дмитрову</span></div>
    <button class="btn veh-btn" type="button" data-tonnage="{v["t"]}" data-goal="vehicle_click">Рассчитать</button>
  </div>
</article>''')
    return '\n'.join(cards)


def photo_key(t):
    return t.replace('.', '_')


def hero_bg(page):
    """Фото на фоне первого экрана, по одному на класс машины. Активное грузится сразу, остальные — после загрузки страницы."""
    active = page['sceneTonnage']
    slides = []
    for v in site['vehicles']:
        key = photo_key(v['t'])
        srcset = f'img/hero-{key}-1000.webp 1000w, img/hero-{key}-2000.webp 2000w'
        if not (ROOT / f'img/hero-{key}-1000.webp').exists():
            raise FileNotFoundError(f'Нет фото img/hero-{key}-1000.webp для {v["t"]} т')
        if v['t'] == active:
            img = f'<img src="img/hero-{key}-1000.webp" srcset="{srcset}" sizes="100vw" alt="" fetchpriority="high" decoding="async">'
        else:
            img = f'<img data-srcset="{srcset}" sizes="100vw" alt="" decoding="async">'
        on = ' is-on' if v['t'] == active else ''
        slides.append(f'<div class="hb-slide hb-t{key}{on}" data-t="{v["t"]}">{img}</div>')
    return ('<div class="hero-bg" id="hero-bg" aria-hidden="true"><div class="hb-layer">' + ''.join(slides) +
            '</div><div class="hb-shade"></div><div class="hb-trails"><i></i><i></i><i></i></div></div>')


def fleet_more(page):
    if len(page['tonnages']) == len(site['vehicles']):
        return ''
    return '<p class="fleet-more">Нужна другая грузоподъёмность? <a href="index.html#fleet">Все машины от Газели до фуры →</a></p>'


def metrika():
    mid = site.get('metrikaId')
    if not mid:
        return ''
    return f'''<script>(function(m,e,t,r,i,k,a){{m[i]=m[i]||function(){{(m[i].a=m[i].a||[]).push(arguments)}};m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)}})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym({int(mid)},"init",{{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true}});</script>'''


def demo_bar():
    if not site.get('demo'):
        return ''
    return '<div class="demo-bar">Демоверсия для согласования: телефон и цены условные, заявки не отправляются · <a href="client.html">Материалы для заказчика →</a></div>'


def fill(template, values):
    def sub(m):
        key = m.group(1)
        if key not in values:
            raise KeyError(f'Нет значения для {{{{{key}}}}}')
        return str(values[key])
    out = re.sub(r'\{\{([A-Z0-9_]+)\}\}', sub, template)
    left = re.findall(r'\{\{[^}]*\}\}', out)
    if left:
        raise ValueError(f'Остались незаполненные плейсхолдеры: {left}')
    return out


def main():
    template = read('template.html')
    css, js = read('styles.css'), read('scene.js') + '\n' + read('app.js')
    public_site = {k: site[k] for k in ('brand', 'phone', 'phoneTel', 'hours', 'telegram', 'max', 'demo', 'metrikaId', 'leadEndpoint', 'firstOrderDiscount', 'vehicles', 'variants', 'occasions')}
    public_tariffs = {k: tariffs[k] for k in ('baseRanges', 'zoneFactors', 'roundTo')}
    for page in pages:
        unknown = set(page['tonnages']) - set(tariffs['baseRanges'])
        if unknown:
            raise ValueError(f'{page["file"]}: нет тарифов для {unknown}')
        out = fill(template, {
            'TITLE': esc(page['title']),
            'DESCRIPTION': esc(page['description']),
            'EYEBROW': esc(page['eyebrow']),
            'H1': esc(page['h1']),
            'LEAD': esc(page['lead']),
            'BRAND': esc(site['brand']),
            'PHONE': esc(site['phone']),
            'PHONE_TEL': esc(site['phoneTel']),
            'HOURS': esc(site['hours']),
            'TELEGRAM': esc(site['telegram'] or '#telegram'),
            'MAX': esc(site['max'] or '#max'),
            'DISCOUNT': site['firstOrderDiscount'],
            'LEGAL': 'ИП / ООО, ИНН и ОГРН — добавить перед запуском' if site.get('demo') else esc(site.get('legal', '')),
            'NAV': nav(page['file']),
            'ROUTE_PRICES': route_prices(page),
            'HERO_BG': hero_bg(page),
            'VEHICLES': vehicles(page),
            'FLEET_MORE': fleet_more(page),
            'METRIKA': metrika(),
            'DEMO_BAR': demo_bar(),
            'CSS': css,
            'JS': js,
            'SITE_JSON': js_json(public_site),
            'TARIFFS_JSON': js_json(public_tariffs),
            'PAGE_JSON': js_json({'file': page['file'], 'tonnages': page['tonnages'], 'zone': page['zone'], 'sceneTonnage': page['sceneTonnage']}),
        })
        (ROOT / page['file']).write_text(out, encoding='utf-8')
        print(f'{page["file"]:<22} {len(out.encode()) / 1024:5.1f} КБ')

    greeting = fill(read('greeting.html'), {
        'BRAND': esc(site['brand']),
        'PHONE': esc(site['phone']),
        'PHONE_TEL': esc(site['phoneTel']),
        'CSS': css,
        'JS': read('scene.js') + '\n' + read('greeting.js'),
        'SITE_JSON': js_json(public_site),
    })
    (ROOT / 'greeting.html').write_text(greeting, encoding='utf-8')
    print(f'{"greeting.html":<22} {len(greeting.encode()) / 1024:5.1f} КБ')


if __name__ == '__main__':
    main()
