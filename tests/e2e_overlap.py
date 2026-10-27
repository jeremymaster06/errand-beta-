# Runner/customer chrome stays on screen at phone widths (light + dark). The old ⋯ role menu is gone (three separate apps).
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from authseed import SEED
OUT='/workspace/errand-tiles/screens/'
errs=[];bad=[]
JS="""()=>{const hits=[];
for(const e of document.querySelectorAll('#screen .pill-online,#screen .turn,#screen .fbtn,#screen .sheet,#screen .navbar .nr>*,#screen .lt')){const r=e.getBoundingClientRect();
if(r.width&&(r.left<-1||r.right>innerWidth+1))hits.push('offscreen '+e.className)}
if(document.querySelector('#more,[data-v]'))hits.push('role switcher present');
const p=document.querySelector('.pill-online');if(p){const r=p.getBoundingClientRect();if(r.left<0||r.right>innerWidth)hits.push('pill offscreen')}
return hits}"""
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
  for scheme in ['light','dark']:
    for w in [320,375,390,430]:
      c=b.new_context(viewport={'width':w,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,color_scheme=scheme); c.add_init_script(SEED);pg=c.new_page()
      pg.on('console',lambda m: m.type=='error' and errs.append(m.text));pg.on('pageerror',lambda e: errs.append(str(e)))
      pg.on('dialog',lambda d:d.dismiss());pg.route('**/js/config.js*',lambda r: r.fulfill(content_type='text/javascript',body=__import__('re').sub(r"(MAPS_API_KEY\s*=\s*)(['\"]).*?\2",r"\1''",open('/workspace/errand-tiles/js/config.js').read())));pg.goto('http://localhost:8775/customer/index.html');pg.wait_for_timeout(500)
      steps=[('c_home',"0"),('c_trip',"C.go('stops')"),('c_review',"C.go('review')"),('c_pay',"C.confirm()"),('c_track',"C.useTestMethod(); C.confirm()"),('offline',"location.href='../runner/index.html'"),('online_offer',"RN.online()"),('route',"RN.tab('route')"),('earnings',"RN.tab('earn')"),('account',"RN.tab('acct')")]
      for name,js in steps:
        pg.evaluate(js);pg.wait_for_timeout(450 if 'location' not in js else 1200)
        h=pg.evaluate(JS)
        if h: bad.append(f'{scheme} {w} {name}: {h}')
        if name in('offline','online_offer','route'): pg.screenshot(path=f'{OUT}runner_{w}_{scheme}_{name}.png')
      c.close()
  b.close()
print('ERRORS:',errs or 'none');print('OVERLAPS:',bad or 'none')
