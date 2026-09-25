from pathlib import Path
import json,re,zipfile

ROOT=Path(__file__).resolve().parent
base=(ROOT/'base-template.html').read_text()
css='''
nav a{border:1px solid var(--line);background:transparent;color:var(--ink);border-radius:30px;padding:10px 18px;text-decoration:none;font-size:14px}nav a[aria-current=page]{background:var(--green);color:white}header .phone{text-align:right}.phone a{font-size:22px;font-weight:800;color:var(--green);text-decoration:none}.phone small{display:block;font-size:11px;color:var(--muted)}.hero-links{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}.hero-links a,.secondary{display:inline-block;padding:10px 14px;border:1px solid var(--green);border-radius:8px;text-decoration:none;color:var(--green);font-weight:650;font-size:14px}.hero-links a:first-child{background:var(--green);color:white}select{width:100%;min-width:0;border:1px solid #cbd5ca;border-radius:8px;padding:12px 9px;background:white;font:inherit;color:var(--ink);margin-top:5px}select:focus{outline:2px solid var(--green)}.calcgrid{display:grid;grid-template-columns:1.1fr 1fr;gap:24px}.estimate{background:#edf1e0;border-radius:16px;padding:28px}.estimate h3{font-size:clamp(26px,3vw,38px);margin:15px 0;line-height:1.2}.estimate .secondary{margin-top:12px;display:block;text-align:center}.clientlink{color:var(--green)}section,form{scroll-margin-top:20px}.mobile{gap:10px}.mobile a{flex:1}.mobile .call{background:var(--lime);color:var(--ink)}[hidden]{display:none!important}
@media(max-width:700px){header{align-items:start;gap:10px}.brand{font-size:15px;max-width:145px}.phone a{font-size:16px}.phone small{font-size:10px}nav a{font-size:12px;padding:9px 12px}.calcgrid{grid-template-columns:1fr}.estimate{padding:22px}.mobile{display:flex}.mobile a{font-size:13px;padding:12px 6px}.notice a{color:inherit}.hero-links a{font-size:13px}input{font-size:16px}}
'''
base=base.replace('</style>',css+'</style>')
base=base.replace('Прототип для согласования · формы демонстрационные, заявки не отправляются','Демонстрация · заявки не отправляются · <a href="client.html">Обоснование и данные для запуска →</a>')
base=base.replace('<div class="small">Дмитров · Москва · МО<br>Рабочее название</div>','<div class="phone"><a class="call" href="tel:+70000000000">+7 (000) 000-00-00</a><small>Быстрый звонок · демо-номер</small></div>')
base=base.replace('<div class="road"','<div class="hero-links"><a href="#calculator">Рассчитать без звонка</a><a class="call" href="tel:+70000000000">Позвонить</a></div><div class="road"')
base=base.replace('<section><div class="sectionhead">',(ROOT/'calculator.html').read_text()+'<section><div class="sectionhead">',1)
base=base.replace('<div class="mobile"><a href="#request">Рассчитать перевозку</a></div>','<div class="mobile"><a class="call" href="tel:+70000000000">☎ Позвонить</a><a href="#calculator">Узнать стоимость</a></div>')
base=base.replace('Прототип: название, контакты, график работы и реквизиты добавляются перед запуском. Цены и дополнительные услуги — после подтверждения исполнителей. Схема машины не является фотографией автопарка.','Дмитров · Москва · Московская область. <a class="call clientlink" href="tel:+70000000000">+7 (000) 000-00-00</a> — демонстрационный номер.<br>Прототип: услуги и цены требуют подтверждения. Схема транспорта не является фотографией автопарка. <a class="clientlink" href="client.html">Материалы для заказчика →</a>')
base=base.replace("const modes={small:","const modes={home:{title:'Грузоперевозки<br>по Дмитрову,<br>Москве и МО',intro:'Газель и грузовики до 20 т. Борт, тент или фургон. Сообщите адреса и груз — назовём цену рейса и условия погрузки.',weights:['1,5','2','3','5','10','20']},small:")
base=base.replace("select('small');","select(INITIAL_MODE);")
pages=[('index.html','home','Главная'),('gazel.html','small','Газель · 2–3 т'),('gruzovye.html','large','Машины 5–20 т'),('dmitrov-moskva.html','route','Дмитров ↔ Москва')]
config=json.loads((ROOT/'tariffs.json').read_text())
for filename,mode,label in pages:
 nav='<nav aria-label="Услуги">'+''.join(f'<a href="{f}"'+(' aria-current="page"' if m==mode else '')+f'>{l}</a>' for f,m,l in pages)+'</nav>'
 page=re.sub(r'<nav.*?</nav>',lambda _:nav,base,flags=re.S)
 page=page.replace('<script>','<script>\nconst INITIAL_MODE='+json.dumps(mode)+';\nconst TARIFFS='+json.dumps(config,ensure_ascii=False)+';\n',1)
 page=page.replace('</script>',(ROOT/'calculator.js').read_text()+'\n</script>')
 page=page.replace('<title>Дмитров · Прототип грузоперевозок</title>',f'<title>{label} · Дмитров — перевозки</title>')
 (ROOT/filename).write_text(page)
print('Built 4 pages. Tariffs embedded for offline use.')
