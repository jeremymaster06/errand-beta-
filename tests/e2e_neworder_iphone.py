"""WebKit + iPhone 15: 'Start a new order' opens the unpreset errand flow; review shows 'Add payment' and
singular '1 stop'; no placeholder card. 0 CSP. Writes screens/new_order_flow.png, review_add_payment.png."""
import re
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from authseed import SEED
ROOT='http://localhost:8776/errand-beta-/'; BASE=ROOT+'customer/'; OUT='/workspace/errand-tiles/screens/'
CFG=re.sub(r"(MAPS_API_KEY\s*=\s*)(['\"]).*?\2",r"\1''",open('/workspace/errand-tiles/js/config.js').read())
HTML=open('/workspace/errand-tiles/customer/index.html').read().replace('; upgrade-insecure-requests','')
fails=[]; errs=[]
def check(c,m):
  if not c: fails.append(m)
with sync_playwright() as p:
  b=p.webkit.launch(); c=b.new_context(**p.devices['iPhone 15']); c.add_init_script(SEED); pg=c.new_page()
  pg.on('console',lambda m: m.type=='error' and errs.append('console: '+m.text)); pg.on('pageerror',lambda e: errs.append(f'page: {e}'))
  c.route('**/js/config.js*',lambda r: r.fulfill(content_type='text/javascript',body=CFG)); c.route(BASE,lambda r: r.fulfill(content_type='text/html',body=HTML))
  c.add_init_script("window.__csp=0;document.addEventListener('securitypolicyviolation',e=>{window.__csp++;console.error('CSP '+e.violatedDirective+' '+e.blockedURI)})")
  pg.goto(BASE); pg.wait_for_timeout(900); W=lambda ms=400: pg.wait_for_timeout(ms)
  btn=pg.locator('#newOrderBtn'); check(btn.inner_text().strip()=='Start a new order','label')
  check(btn.get_attribute('data-act')=='C.newOrder' and btn.get_attribute('onclick') is None,'delegated action')
  check(btn.bounding_box()['y'] < pg.locator('h1.hello').bounding_box()['y'] < pg.locator('#tileErrands').bounding_box()['y'],'button above heading')
  check(pg.evaluate("document.querySelector('#newOrderBtn').parentElement.firstElementChild.id==='newOrderBtn'"),'button not first in sheet head')
  # a leftover tile preset must be cleared by the general entry
  pg.evaluate("S.c.preset={key:'post',f:{}}")
  btn.tap(); W(900)
  check(pg.evaluate("S.c.screen")=='add','opens add stop, got '+pg.evaluate("S.c.screen"))
  check(pg.evaluate("S.c.preset")is None and pg.evaluate("S.c.add.q")=='','not unpreset')
  pg.screenshot(path=OUT+'new_order_flow.png')
  # one stop -> review
  pg.evaluate("S.stops.push(mkStop('Shopping','stopshop')); S.c.screen='review'; R()"); W(1200)
  t=pg.inner_text('#screen')
  check('1 stop ·' in t and '1 stops' not in t,'pluralization')
  check('Add payment' in t and '4242' not in t and 'Apple Pay' not in t,'payment placeholder')
  pg.screenshot(path=OUT+'review_add_payment.png')
  pg.evaluate("S.c.preset={key:'cleaning',f:{}}; R()"); W(900)
  t=pg.inner_text('#tlTerms') if pg.locator('#tlTerms').count() else ''
  check('$300' in t and 'Normal wear' in t and '$1,000 is the most' in t and 'Request a refund or credit under our Damage & Loss Policy (Terms §4.3–4.4)' in t,'cleaning review terms: '+t)
  pg.evaluate("document.querySelector('#tlTerms').scrollIntoView()"); W(500); pg.screenshot(path=OUT+'review_terms_cleaning.png')
  pg.evaluate("S.c.preset={key:'post',f:{}}; R()"); W(900)
  t=pg.inner_text('#tlTerms') if pg.locator('#tlTerms').count() else ''
  check('capped at $500' in t and 'carrier' in t,'post review terms: '+t)
  pg.evaluate("document.querySelector('#tlTerms').scrollIntoView()"); W(500); pg.screenshot(path=OUT+'review_terms_post.png')
  pg.evaluate("S.c.preset=null; R()"); W(500)
  check(pg.evaluate('window.__csp')==0,'CSP violations')
  b.close()
print('errors:',errs); print('FAIL' if fails or errs else 'PASS',fails)
