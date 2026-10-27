"""WebKit + iPhone 15: three separate apps (/customer/, /runner/, /owner/) on one origin.
Checks: manifests valid (own name/start_url/scope/icons), SW scoped per app, no role switcher, clean empty
states, cross-app flow (customer errand + Hold My Spot -> runner accepts -> owner sees it -> completed),
booking footer never covers fields, engine inputs (USPS -> post_office, empty grocery = 0 items,
drive_minutes), $3 no-show copy, 0 CSP violations on every page. Writes screens/clean_*.png."""
import re, json
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from authseed import SEED
ROOT='http://localhost:8776/errand-beta-/'; OUT='/workspace/errand-tiles/screens/clean_'
CFG=re.sub(r"(MAPS_API_KEY\s*=\s*)(['\"]).*?\2",r"\1''",open('/workspace/errand-tiles/js/config.js').read())
APPS={a: open(f'/workspace/errand-tiles/{a}/index.html').read().replace('; upgrade-insecure-requests','').replace('upgrade-insecure-requests','') for a in ['customer','runner','owner']}
fails=[]; errs=[]
def check(c,m):
  if not c: fails.append(m)
with sync_playwright() as p:
  b=p.webkit.launch(); c=b.new_context(**p.devices['iPhone 15']); c.add_init_script(SEED)
  c.route('**/js/config.js*',lambda r: r.fulfill(content_type='text/javascript',body=CFG))
  for a,html in APPS.items(): c.route(ROOT+a+'/',(lambda H: lambda r: r.fulfill(content_type='text/html',body=H))(html))
  c.add_init_script("window.__csp=0;document.addEventListener('securitypolicyviolation',e=>{window.__csp++;console.error('CSP '+e.violatedDirective+' '+e.blockedURI)})")
  def page(a):
    pg=c.new_page(); pg.on('console',lambda m: m.type=='error' and errs.append(a+' console: '+m.text)); pg.on('pageerror',lambda e: errs.append(f'{a} page: {e}'))
    pg.goto(ROOT+a+'/'); pg.wait_for_timeout(900); return pg
  # root page redirects to the customer app
  r=c.new_page(); r.goto(ROOT); r.wait_for_timeout(1500); check(r.url.rstrip('/').endswith('/customer'),'root does not redirect to /customer/: '+r.url); r.close()
  cu,ru,ow=page('customer'),page('runner'),page('owner')
  def shot(pg,n): pg.wait_for_timeout(450); pg.screenshot(path=OUT+n+'.png')
  txt=lambda pg: pg.inner_text('#screen')
  for a,pg,role in [('customer',cu,'c'),('runner',ru,'r'),('owner',ow,'o')]:
    check(pg.evaluate("S.view")==role,a+' role')
    check(pg.locator('[data-v],#pop,#more,.viewseg,.proto').count()==0 and pg.evaluate("typeof setView")=='undefined','role switcher present in '+a)
    check(pg.locator('[onclick],[onchange],[onkeydown],[oninput]').count()==0,'inline handlers in '+a)
    m=pg.evaluate("fetch(document.querySelector('link[rel=manifest]').href).then(r=>r.json())")
    check(m['start_url']=='./' and m['scope']=='./' and m['display']=='standalone' and m['name'] and m['short_name'],'manifest fields '+a)
    for ic in m['icons']:
      st=pg.evaluate(f"fetch(new URL({json.dumps(ic['src'])}, document.querySelector('link[rel=manifest]').href)).then(r=>r.status+' '+r.headers.get('content-type'))")
      check(st.startswith('200 image/png'),f'{a} icon {ic["src"]} {st}')
    print(a,'manifest:',m['name'],'/',m['short_name'],'start_url',m['start_url'],'scope',m['scope'])
    sc=pg.evaluate("navigator.serviceWorker ? navigator.serviceWorker.getRegistration().then(r=>r?r.scope:'none') : 'unsupported'")
    print(a,'sw scope:',sc); check(sc in ('unsupported','none') or sc.endswith('/'+a+'/'),'sw scope '+a+' '+sc)
  names={pg.evaluate("document.title") for pg in (cu,ru,ow)}; check(len(names)==3,'titles not distinct')
  # clean empty states
  check(cu.evaluate("S.stops.length===0 && !S.trip && !S.line && S.history.length===0"),'customer seeded')
  check(cu.locator('#tileErrands').count()==1 and cu.locator('#tileLine').count()==1,'tiles'); shot(cu,'customer_home')
  ru.evaluate("RN.online()"); ru.wait_for_timeout(300); check('No requests right now' in txt(ru),'runner empty'); ru.evaluate("RN.online()")
  ru.wait_for_timeout(300); shot(ru,'runner_home')
  D=ow.inner_text('#desk'); check('Nothing yet' in D and '$4,812' not in D,'owner empty'); shot(ow,'owner_home')
  # engine inputs
  e=cu.evaluate("[engineStop({type:'Post office',items:[]}), engineStop({type:'Groceries',items:[]}), (()=>{S.stops=[mkStop('Groceries','x',{custom:{name:'A',addr:'',lat:40.80,lng:-73.73}})]; const i=engineInputs(S.stops,4,{mi:4,min:13}); S.stops=[]; return i})()]")
  check(e[0]['type']=='post_office','USPS -> post_office '+str(e[0])); check(e[1].get('items')==0,'empty grocery items '+str(e[1]))
  check(e[2].get('drive_minutes')==13 and 'mph' not in e[2],'drive_minutes input '+str({k:e[2].get(k) for k in ('drive_minutes','mph')}))
  # customer places an errand (USPS stop) through the UI's add flow
  cu.evaluate("""S.stops.push(mkStop('Post office','usps',{custom:{name:'US Post Office',addr:'1 Welwyn Rd',lat:40.7998,lng:-73.7290,kind:'post'},items:[{n:'Mail 2 packages',p:0}]})); C.go('review')""")
  cu.wait_for_timeout(500); cu.evaluate("C.useTestMethod(); C.confirm()"); cu.wait_for_timeout(500); check('Finding a runner' in txt(cu),'customer tracking')
  # customer books Hold My Spot
  cu.evaluate("C.tab('home')"); cu.wait_for_timeout(300); cu.locator('#tileLine').tap(); cu.wait_for_timeout(400)
  cu.locator('#lnq').fill('Apple Store Manhasset'); cu.wait_for_timeout(700); cu.locator('#lnTyped').tap(); cu.wait_for_timeout(400)
  t=cu.evaluate("(()=>{const d=new Date(Date.now()+26*3600e3);d.setMinutes(0,0,0);const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:00`})()")
  cu.locator('#lnStart').fill(t); cu.locator('#lnStart').dispatch_event('change'); cu.wait_for_timeout(300); cu.locator('#lnHours').select_option('3'); cu.wait_for_timeout(300)
  T=txt(cu); check('$135.00' in T,'estimate $135'); check('$3 no-show fee' in T and '$15 no-show' not in T,'no-show copy $3')
  shot(cu,'06_line_book_filled')
  # footer must not cover any field at any scroll position (samples the middle of each field's visible part; sub-2px rounding slivers skipped)
  cov=cu.evaluate("""(()=>{const pg=document.querySelector('#screen .lnwrap .page'), foot=document.querySelector('#lnFoot'); const bad=[]; let pb=0, ft=0;
    for (let y=0; y<=pg.scrollHeight; y+=40){ pg.scrollTop=y; const v=pg.getBoundingClientRect(), f=foot.getBoundingClientRect(); pb=v.bottom; ft=f.top;
      if (v.bottom>f.top+0.5) bad.push('page under footer at '+y);
      for (const el of pg.querySelectorAll('input,select,label.ack')){ const r=el.getBoundingClientRect(); if (!r.height) continue;
        if (r.top>=v.bottom-2 || r.bottom<=v.top+2) continue; const cx=r.left+r.width/2, cy=(Math.max(r.top, v.top)+Math.min(r.bottom, v.bottom))/2;
        const hit=document.elementFromPoint(cx, cy); if (hit && foot.contains(hit)) bad.push((el.id||el.className)+'@'+y) } }
    pg.scrollTop=0; return {bad:[...new Set(bad)], pageBottom:pb, footTop:ft}})()""")
  check(not cov['bad'],'footer covers fields '+str(cov)); print('footer check:',cov)
  cu.locator('#lnFees').tap(); cu.locator('#lnRules').tap(); cu.wait_for_timeout(300)
  cu.evaluate("document.querySelector('#screen .lnwrap .page').scrollTop=2000"); shot(cu,'07_line_book_terms')
  cu.locator('#lnReview').tap(); cu.wait_for_timeout(400); T=txt(cu)
  check('Estimate. Final price set by server. Rate pending' in T and '$135.00' in T,'review'); shot(cu,'08_line_review')
  cu.locator('#lnBook').tap(); cu.wait_for_timeout(500); check(cu.evaluate("S.line.status")=='requested','booked'); shot(cu,'09_line_status_pending')
  # runner app sees both requests without reload (storage event)
  ru.evaluate("RN.online()"); ru.wait_for_timeout(600); T=txt(ru)
  check('Errand · 1 stop' in T and 'US Post Office' in T and 'Apple Store' in T,'runner did not get customer orders: '+T[:200]); shot(ru,'runner_requests')
  # owner app sees live jobs
  ow.evaluate("OW.tab('jobs')"); ow.wait_for_timeout(500); D=ow.inner_text('#desk'); check('Errand' in D and 'Apple Store' in D and 'requested' in D,'owner live jobs'); shot(ow,'owner_live_jobs')
  check(ow.evaluate("S.r.online")==True,'owner sees runner online')
  # runner accepts errand, completes it; accepts line hold, requests relief, marks almost
  ru.locator('#acceptTrip').tap(); ru.wait_for_timeout(500)
  for _ in range(9):
    if ru.locator('#nextStop').count()==0: break
    ru.locator('#nextStop').tap(); ru.wait_for_timeout(250)
  check(ru.locator('#doneTrip').count()==1,'runner errand job'); shot(ru,'runner_errand_job')
  cu.wait_for_timeout(400); check(cu.evaluate("S.trip.status")=='accepted','customer sees accepted errand')
  ru.locator('#doneTrip').tap(); ru.wait_for_timeout(400)
  ru.evaluate("RN.tab('drive')"); ru.wait_for_timeout(300); ru.locator('#screen button.btn:has-text("Accept")').first.tap(); ru.wait_for_timeout(400)
  check(ru.locator('#reliefBtn').count()==1,'relief button'); ru.locator('#reliefBtn').tap(); ru.evaluate("RN.almost()"); ru.wait_for_timeout(400); shot(ru,'12_runner_line_job')
  cu.wait_for_timeout(400); cu.evaluate("LN.go('lineStatus')"); cu.wait_for_timeout(400); T=txt(cu)
  check('Almost your turn, head over' in T and re.search(r'\b\d{4}\b',T),'customer sees almost + code'); shot(cu,'13_line_status_almost')
  ow.evaluate("OW.tab('overview')"); ow.wait_for_timeout(400); D=ow.inner_text('#desk'); check('1 completed' in D,'owner completed count'); shot(ow,'owner_after_flow')
  ow.evaluate("OW.tab('jobs')"); ow.wait_for_timeout(300); check('relief requested' in ow.inner_text('#desk'),'owner sees relief')
  cu.evaluate("C.tab('activity')"); cu.wait_for_timeout(300); check('completed' in txt(cu).lower(),'customer history'); shot(cu,'customer_activity')
  for a,pg in [('customer',cu),('runner',ru),('owner',ow)]:
    v=pg.evaluate("window.__csp"); print(a,'CSP violations:',v); check(v==0,f'CSP {a} {v}')
  b.close()
print('ERRORS:',errs or 'none'); print('FAILS:',fails or 'none')
