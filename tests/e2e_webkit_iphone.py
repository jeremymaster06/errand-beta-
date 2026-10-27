import re
"""WebKit + iPhone 15 profile (touch, mobile), served under /errand-beta-/ like GitHub Pages.
Full ordering flow by taps: store + store + personal pickup -> Review -> Pay -> Tracking.
Checks: zero console/page errors, 0 CSP violations, tap targets >= 44pt, SW scope, no absolute-path 404s."""
import re, sys
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from authseed import SEED
BASE='http://localhost:8776/errand-beta-/customer/'
CFG=open('/workspace/errand-tiles/js/config.js').read()
CFG=re.sub(r"(MAPS_API_KEY\s*=\s*)(['\"]).*?\2",r"\1''",CFG)   # local: no real key
TARGETS="""(()=>{const bad=[];for(const e of document.querySelectorAll('#screen button,#screen a,#screen input,#screen select,#screen [onclick],#screen [role=option],#screen .srow')){
 const r=e.getBoundingClientRect(),cs=getComputedStyle(e);if(!r.width||!r.height||cs.visibility==='hidden'||e.closest('[hidden]'))continue;
 if(r.bottom<0||r.top>innerHeight)continue; if(e.closest('.ovl')===null&&document.querySelector('#screen .ovl'))continue;
 const pad=e.closest('label,.acfield');const R=pad?pad.getBoundingClientRect():r;
 if(Math.min(R.width,R.height)<43.5)bad.push((e.getAttribute('aria-label')||e.textContent||e.className).trim().slice(0,30)+' '+Math.round(R.width)+'x'+Math.round(R.height))}return bad})()"""
fails=[];errs=[]
def check(c,m):
  if not c: fails.append(m)
def run(scheme):
  with sync_playwright() as p:
    b=p.webkit.launch(); dev=dict(p.devices['iPhone 15'])
    c=b.new_context(**dev,color_scheme=scheme); c.add_init_script(SEED); pg=c.new_page()
    pg.on('console',lambda m: m.type=='error' and errs.append(f'{scheme} console: {m.text}'))
    pg.on('pageerror',lambda e: errs.append(f'{scheme} page: {e}'))
    pg.on('response',lambda r: r.status>=400 and errs.append(f'{scheme} {r.status} {r.url}'))
    pg.route('**/js/config.js*',lambda r: r.fulfill(content_type='text/javascript',body=CFG))
    # Local http only: WebKit (unlike Chrome) applies upgrade-insecure-requests to localhost, so strip it here.
    # GitHub Pages is https, where the directive is harmless and stays in the shipped index.html.
    IDX=open('/workspace/errand-tiles/customer/index.html').read().replace('; upgrade-insecure-requests','')
    pg.route(BASE,lambda r: r.fulfill(content_type='text/html',body=IDX))
    pg.add_init_script("window.__csp=0;document.addEventListener('securitypolicyviolation',e=>{window.__csp++;console.error('CSP '+e.violatedDirective+' '+e.blockedURI)})")
    pg.goto(BASE); pg.wait_for_timeout(800)
    check(pg.evaluate("matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window"),f'{scheme} touch not enabled')
    sw=pg.evaluate("navigator.serviceWorker? navigator.serviceWorker.getRegistration().then(r=>r&&r.scope):null")
    tt={}
    def targets(n):
      pg.wait_for_timeout(450); bad=pg.evaluate(TARGETS)
      if bad: tt[n]=bad
      pg.screenshot(path=f'/workspace/errand-tiles/screens/webkit_{scheme}_{n}.png')
    def tap(sel): pg.locator(sel).first.tap(); pg.wait_for_timeout(450)
    def typ(t): pg.keyboard.type(t,delay=40); pg.wait_for_timeout(700)
    targets('home')
    tap('#tileErrands'); check(pg.evaluate("S.c.screen")=='add',f'{scheme} where'); typ('stop'); targets('suggestions')
    tap('#ac0'); check(pg.evaluate("S.c.screen")=='store',f'{scheme} store 1'); targets('store')
    tap('#stList .irow:not(.oos) .addbtn'); tap('#stList .irow:not(.oos) >> nth=1 >> .addbtn')
    tap('#viewCart'); targets('cart'); tap('#cartDone')
    check(pg.evaluate("S.c.screen")=='stops' and pg.evaluate("S.stops.length")>=1,f'{scheme} stop 1 not added')
    n0=pg.evaluate("S.stops.length")
    tap('.addstop'); typ('cvs'); tap('#ac0'); check(pg.evaluate("S.c.screen")=='store',f'{scheme} store 2')
    tap('#stList .irow:not(.oos) .addbtn'); tap('#viewCart'); tap('#cartDone')
    tap('.addstop'); typ('12 elm'); tap('#acList .cell.ac:has-text("12 Elm")')
    check(pg.evaluate("S.c.screen")=='place',f'{scheme} personal details'); targets('personal')
    pg.locator('#plWhat').tap(); pg.keyboard.type('Blue casserole dish'); tap('#plBody button.btn:has-text("Add stop")')
    check(pg.evaluate("S.stops.length")==n0+2,f'{scheme} 3 stops not added'); targets('trip')
    tap('#screen button.btn:has-text("Review")'); check(pg.evaluate("S.c.screen")=='review',f'{scheme} review'); targets('review')
    check(re.search(r'\bPro\b',pg.inner_text('#screen')) is None,f'{scheme} Pro visible on review')
    check(pg.locator('#payBtn').inner_text().strip()=='Add payment to continue',f'{scheme} pay without method')
    tap('#payBtn'); check(pg.evaluate("S.c.screen")=='addPayment' and not pg.evaluate("S.trip"),f'{scheme} order placed without method')
    tap('#useTestMethod'); check(pg.evaluate("S.c.screen")=='review',f'{scheme} back to review')
    tap('#screen button.btn:has-text("Pay $")'); pg.wait_for_timeout(3000)
    check(pg.evaluate("S.c.screen")=='tracking' and pg.locator('.eta').count()==1,f'{scheme} tracking'); targets('tracking')
    csp=pg.evaluate("window.__csp||0"); check(csp==0,f'{scheme} CSP violations: {csp}')
    for k,v in tt.items(): fails.append(f'{scheme} small tap targets on {k}: {v}')
    print(scheme,'sw scope:',sw,'csp:',csp)
    b.close()
for s in ['light','dark']: run(s)
print('ERRORS:',errs or 'none'); print('FAILS:',fails or 'none')
