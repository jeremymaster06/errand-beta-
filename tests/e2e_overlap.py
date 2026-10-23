# Checks the ⋯ menu button never overlaps runner chrome at phone widths (light + dark).
from playwright.sync_api import sync_playwright
OUT='/workspace/errand-redesign/screens/'
errs=[];bad=[]
JS="""()=>{const m=document.querySelector('#more').getBoundingClientRect();const hits=[];
for(const e of document.querySelectorAll('#screen .pill-online,#screen .turn,#screen .fbtn,#screen .sheet,#screen .navbar .nr>*,#screen .lt')){const r=e.getBoundingClientRect();
if(r.width&&!(r.right<=m.left||r.left>=m.right||r.bottom<=m.top||r.top>=m.bottom))hits.push(e.className)}
const p=document.querySelector('.pill-online');if(p){const r=p.getBoundingClientRect();if(r.left<0||r.right>innerWidth)hits.push('pill offscreen')}
return hits}"""
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
  for scheme in ['light','dark']:
    for w in [320,375,390,430]:
      c=b.new_context(viewport={'width':w,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,color_scheme=scheme);pg=c.new_page()
      pg.on('console',lambda m: m.type=='error' and errs.append(m.text));pg.on('pageerror',lambda e: errs.append(str(e)))
      pg.goto('http://localhost:8765/index.html');pg.wait_for_timeout(500)
      steps=[('offline',"setView('r')"),('online_offer',"RN.online()"),('route',"RN.accept()"),('route_step',"RN.next()"),('earnings',"RN.tab('earn')"),('account',"RN.tab('acct')")]
      for name,js in steps:
        pg.evaluate(js);pg.wait_for_timeout(2600 if name=='route' else 450)
        h=pg.evaluate(JS)
        if h: bad.append(f'{scheme} {w} {name}: {h}')
        if name in('offline','online_offer','route'): pg.screenshot(path=f'{OUT}runner_{w}_{scheme}_{name}.png')
      c.close()
  b.close()
print('ERRORS:',errs or 'none');print('OVERLAPS:',bad or 'none')
