"""WebKit + iPhone 15: Hold My Spot minimum + total copy, checkout timing (ASAP / scheduled / flexible) with the real
flex saving matching charge, receipt and history, standalone drop-off (no ASAP, setting price), owner courier handoff
(off by default, demo only, eligibility + banned reasons, customer note). 0 CSP violations.
Writes screens/hms_booking_min.png, checkout_flex_window.png, owner_courier_demo.png."""
import re
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from authseed import SEED
ROOT='http://localhost:8776/errand-beta-/'; OUT='/workspace/errand-tiles/screens/'
CFG=re.sub(r"(MAPS_API_KEY\s*=\s*)(['\"]).*?\2",r"\1''",open('/workspace/errand-tiles/js/config.js').read())
IDX={a: open(f'/workspace/errand-tiles/{a}/index.html').read().replace('; upgrade-insecure-requests','') for a in ['customer','owner']}
fails=[]; errs=[]
def check(c,m):
  if not c: fails.append(m)
money=lambda s: float(re.sub(r'[^0-9.]','',s))
with sync_playwright() as p:
  b=p.webkit.launch(); c=b.new_context(**p.devices['iPhone 15']); c.add_init_script(SEED)
  c.add_init_script("window.__csp=0;document.addEventListener('securitypolicyviolation',e=>{window.__csp++;console.error('CSP '+e.violatedDirective)})")
  c.route('**/js/config.js*',lambda r: r.fulfill(content_type='text/javascript',body=CFG)); [c.route(ROOT+a+'/',(lambda H: lambda r: r.fulfill(content_type='text/html',body=H))(H)) for a,H in IDX.items()]
  def page(a):
    pg=c.new_page(); pg.on('console',lambda m: m.type=='error' and errs.append(a+' console: '+m.text)); pg.on('pageerror',lambda e: errs.append(f'{a} page: {e}'))
    pg.goto(ROOT+a+'/'); pg.wait_for_timeout(900); return pg
  cu=page('customer'); W=lambda ms=400: cu.wait_for_timeout(ms); txt=lambda: cu.inner_text('#screen')
  def tap(sel): cu.locator(sel).first.tap(); W()
  # ---------- Hold My Spot ----------
  tap('#tileLine'); cu.locator('#lnq').fill('Apple Store Manhasset'); W(700); tap('#lnTyped')
  t=cu.evaluate("(()=>{const d=new Date(Date.now()+26*3600e3);d.setMinutes(0,0,0);const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:00`})()")
  cu.locator('#lnStart').fill(t); cu.locator('#lnStart').dispatch_event('change'); W(300)
  opts=cu.eval_on_selector_all('#lnHours option','o=>o.map(x=>+x.value)'); check(min(opts)==2 and max(opts)==12,'hours options '+str(opts[:2])+'..'+str(opts[-1:]))
  check(cu.inner_text('#lnMin')=='2-hour minimum ($95)','min line next to hourly rate'); check('$40/hr + $15 booking fee' in cu.inner_text('#lnRate'),'rate cell')
  check(cu.locator('#lnRate #lnMin').count()==1,'min line not inside rate cell')
  check('$95.00' in cu.inner_text('#lnEst'),'2h total $95')
  cu.locator('#lnHours').select_option('3'); W(300); E=cu.inner_text('#lnEst')
  check('$135.00' in E and 'Extra hours' in cu.inner_text('#lnExtra') and 'Ending early' in cu.inner_text('#lnEarly'),'3h total + rules beside it')
  cl=cu.inner_text('#lnClaims'); check('W-2 runners' in cl and 'Live tracking during your sit' in cl and 'Insured (pending)' in cl and 'Vetted (pending)' in cl,'claims '+cl)
  check(not re.search(r'show[- ]?up guarantee|guarantee[sd]? (to )?show|guaranteed arrival',txt(),re.I),'show-up guarantee shown')
  cu.locator('#lnEst').scroll_into_view_if_needed(); W(300); cu.screenshot(path=OUT+'hms_booking_min.png')
  cu.evaluate("S.c.ln.hours=1; LN.book_()"); W(); check(cu.evaluate("S.line") is None,'booked under the minimum')
  cu.evaluate("C.tab('home')"); W()
  # ---------- checkout timing ----------
  cu.evaluate("S.stops=[mkStop('Groceries','stopshop',{items:[{n:'Milk',p:4}]}),mkStop('Dry cleaning','cleaners')]; S.pay.method={label:'Visa 4242'}; S.timing='asap'; S.c.screen='review'; R()"); W(600)
  check(cu.locator('#ckMode-asap,#ckMode-scheduled,#ckMode-flex').count()==3,'three timing modes')
  asap=cu.evaluate("quote().total"); tap('#ckMode-scheduled'); check(cu.locator('#ckWindow').count()==1,'scheduled window select')
  tap('#ckMode-flex'); fl=cu.inner_text('#flexLine'); q=cu.evaluate("(()=>{const q=quote();return {total:q.total,save:q.flexSave}})()")
  m=re.match(r'^Flexible window: save \$(\d+\.\d\d)\. Arrives between (\d{1,2}:\d\d [AP]M) and (\d{1,2}:\d\d [AP]M)\.$',fl); check(m,'flex line '+fl)
  check(m and abs(float(m.group(1))-(asap-q['total']))<0.005 and q['save']>0,'saving != real ASAP difference')
  check(not re.search(r'up to|\bwas\b',txt(),re.I),'up to / was price on review')
  pay=money(cu.inner_text('#payBtn')); check(abs(pay-q['total'])<0.005,'pay button != discounted total')
  cu.locator('#flexLine').scroll_into_view_if_needed(); W(300); cu.screenshot(path=OUT+'checkout_flex_window.png')
  tap('#payBtn'); W(600)
  rc=cu.inner_text('#receipt'); charged=money(re.search(r'Total charged\s*(\$[\d,.]+)',rc).group(1))
  check(abs(charged-q['total'])<0.005 and abs(cu.evaluate("S.trip.q.total")-q['total'])<0.005,'charge/receipt mismatch')
  check('Flexible window · arrives between' in rc,'receipt window')
  cu.evaluate("S.trip.status='done'; C.finish ? C.finish() : null"); W()
  h=cu.evaluate("S.history.length ? S.history[0].total : null")
  if h is not None: check(abs(h-q['total'])<0.005,'history total mismatch')
  cu.evaluate("S.trip=null; S.history=[]; Store.save(); C.tab('home')"); W()
  # ---------- standalone drop-off ----------
  cu.evaluate("S.stops=[mkStop('Personal pickup',null,{custom:{name:'Home',addr:'1 Main St',lat:40.79,lng:-73.73},items:[{n:'Box of books',p:0}]}),mkStop('Drop-off',null,{custom:{name:'Office',addr:'9 Elm St',lat:40.8,lng:-73.72},items:[{n:'Box of books',p:0}]})]; S.timing='asap'; S.c.screen='review'; R()"); W(600)
  check(cu.locator('#ckMode-asap').count()==0 and cu.locator('#ckMode-scheduled').count()==1,'standalone drop-off offers ASAP')
  check('$29.00' in cu.inner_text('#standaloneNote') and 'Pending Jeremy' in cu.inner_text('#standaloneNote'),'standalone price note')
  tap('#payBtn'); W(600); check(cu.evaluate("S.trip && S.trip.q.timing")=='scheduled','standalone trip timing')
  # ---------- owner courier ----------
  ow=page('owner'); ow.locator('#auDemoOwner').count() and ow.locator('#auDemoOwner').tap(); ow.wait_for_timeout(700); ow.evaluate("OW.tab('jobs')"); ow.wait_for_timeout(500)
  D=lambda: ow.inner_text('#owDispatch')
  check(ow.locator('#owCourier').is_disabled() and 'Turn on demo mode' in D(),'courier on by default')
  check('Demo only, no partner contract' in D() and 'Courier fee $10.00' in D(),'demo label/fee')
  ow.locator('#owDemo').tap(); ow.wait_for_timeout(400); check(not ow.locator('#owCourier').is_disabled() and 'Eligible' in D(),'eligible standalone')
  ow.screenshot(path=OUT+'owner_courier_demo.png')
  ow.locator('#owCourier').tap(); ow.wait_for_timeout(500); check('Sent to Partner Courier (demo)' in D(),'sent')
  cu.reload(); cu.wait_for_timeout(900); cu.evaluate("S.c.screen='tracking'; R()"); W(500)
  check(cu.locator('#courierNote').count()==1 and cu.inner_text('#courierNote')=='This delivery is carried by our partner, Partner Courier (demo). Your price doesn’t change. We share your name, drop-off address and phone with them only to complete it.','customer courier note')
  # banned + store purchase reasons
  for stops,why in [("[mkStop('Drop-off',null,{custom:{name:'X',addr:'1 A St',lat:40.79,lng:-73.73},items:[{n:'2 bottles of wine',p:0}]})]",'Alcohol'),
                    ("[mkStop('Groceries','stopshop',{items:[{n:'Milk',p:4}]}),mkStop('Drop-off',null,{custom:{name:'X',addr:'1 A St',lat:40.79,lng:-73.73},items:[{n:'Milk',p:0}]})]",'store purchase')]:
    ow.evaluate(f"S.trip={{id:'t',status:'matching',stops:{stops},q:quote(),pref:'any'}}; R()"); ow.wait_for_timeout(300)
    check(ow.locator('#owCourier').is_disabled() and why in ow.inner_text('#owCourierWhy'),'not blocked: '+why)
  for n,pg in [('customer',cu),('owner',ow)]: check(pg.evaluate('window.__csp')==0,n+' CSP violations')
  b.close()
print('ERRORS:', errs or 'none'); print('FAILS:', fails or 'none')
