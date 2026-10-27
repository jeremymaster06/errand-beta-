"""WebKit + iPhone 15: a hostile place name renders as literal text (trip, review, tracking, toast, owner), never as markup. 0 CSP violations."""
import re
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from authseed import SEED
ROOT='http://localhost:8776/errand-beta-/'; EVIL='<img src=x onerror=alert(1)>'
CFG=re.sub(r"(MAPS_API_KEY\s*=\s*)(['\"]).*?\2",r"\1''",open('/workspace/errand-tiles/js/config.js').read())
IDX={a: open(f'/workspace/errand-tiles/{a}/index.html').read().replace('; upgrade-insecure-requests','') for a in ['customer','owner']}
fails=[];errs=[]
def check(c,m):
  if not c: fails.append(m)
with sync_playwright() as p:
  b=p.webkit.launch(); c=b.new_context(**p.devices['iPhone 15']); c.add_init_script(SEED); pg=c.new_page()
  pg.on('console',lambda m: m.type=='error' and errs.append('console: '+m.text)); pg.on('pageerror',lambda e: errs.append(f'page: {e}')); pg.on('dialog',lambda d: (errs.append('dialog fired'), d.dismiss()))
  pg.route('**/js/config.js*',lambda r: r.fulfill(content_type='text/javascript',body=CFG)); [pg.route(ROOT+a+'/',(lambda H: lambda r: r.fulfill(content_type='text/html',body=H))(H)) for a,H in IDX.items()]
  pg.add_init_script("window.__csp=0;document.addEventListener('securitypolicyviolation',e=>{window.__csp++;console.error('CSP '+e.violatedDirective)})")
  pg.goto(ROOT+'customer/'); pg.wait_for_timeout(900)
  noimg=lambda: pg.locator('img[src="x"], [onerror]').count()==0
  pg.evaluate(f"(()=>{{const e={EVIL!r};S.stops.push(mkStop('Personal pickup',null,{{custom:{{name:e,addr:e,lat:40.79,lng:-73.73}}}}),mkStop('Drop-off',null,{{custom:{{name:'Home',addr:'1 Main St',lat:40.8,lng:-73.72}},from:S.stops.length?null:null}}));S.stops[1].from=S.stops[0].id;C.go('stops')}})()"); pg.wait_for_timeout(500)
  check(EVIL in pg.inner_text('#screen'),'trip: name not shown as text'); check(noimg(),'trip: markup injected')
  pg.evaluate(f"toast({EVIL!r})"); pg.wait_for_timeout(200); check(EVIL in pg.inner_text('#toast'),'toast text'); check(noimg(),'toast markup')
  pg.evaluate("C.go('review')"); pg.wait_for_timeout(800); check(EVIL in pg.inner_text('#screen'),'review: name text'); check(noimg(),'review markup')
  pg.evaluate("S.trip={stops:S.stops,status:'accepted',step:0,q:{route:{order:[0,1]}}}"); check(EVIL in pg.evaluate("trackStatus(S.trip)"),'trackStatus')
  pg.goto(ROOT+'owner/'); pg.wait_for_timeout(900); check(noimg(),'owner markup')
  check(pg.evaluate('window.__csp')==0,'CSP violations')
  b.close()
print('errors:',errs); print('FAILS:',fails); print('PASS' if not fails and not errs else 'FAIL')
