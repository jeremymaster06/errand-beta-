"""WebKit + iPhone 15: Add payment gate (no order without a method), runner clock in/out, per-trip pay on the job
card before accept, per-stop arrive/start/done times, line-sit time, weekly timesheet with top-up. 0 CSP.
Writes screens/pay_add_payment.png, runner_clockin.png, runner_job_pay.png, runner_timesheet.png."""
import re
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from authseed import SEED
ROOT='http://localhost:8776/errand-beta-/'; OUT='/workspace/errand-tiles/screens/'
CFG=re.sub(r"(MAPS_API_KEY\s*=\s*)(['\"]).*?\2",r"\1''",open('/workspace/errand-tiles/js/config.js').read())
APPS={a: open(f'/workspace/errand-tiles/{a}/index.html').read().replace('; upgrade-insecure-requests','') for a in ['customer','runner','owner']}
PAID='Paid for every hour you work, with at least minimum wage guaranteed'
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
  W=lambda pg,ms=400: pg.wait_for_timeout(ms)
  cu=page('customer'); ru=page('runner')
  txt=lambda pg: pg.inner_text('#screen')
  # --- payment gate ---
  cu.evaluate("S.stops.push(mkStop('Post office','usps',{custom:{name:'US Post Office',addr:'1 Welwyn Rd',lat:40.7998,lng:-73.7290,kind:'post'},items:[]})); C.go('review')"); W(cu,800)
  check(cu.locator('#payBtn').inner_text().strip()=='Add payment to continue','pay label without method')
  cu.locator('#payBtn').tap(); W(cu,600)
  check(cu.evaluate("S.c.screen")=='addPayment' and cu.evaluate("S.trip") is None,'order placed without method')
  T=txt(cu); check('Stripe' in T and cu.locator('#addPaySheet input').count()==0,'add payment sheet copy / no card fields')
  cu.screenshot(path=OUT+'pay_add_payment.png')
  cu.locator('#useTestMethod').tap(); W(cu,600); check(cu.evaluate("S.c.screen")=='review' and 'Prototype test method' in txt(cu),'method shown')
  cu.locator('#payBtn').tap(); W(cu,800); check(cu.evaluate("S.trip && S.trip.status")=='matching','order after method')
  # --- runner: clean start, clock in ---
  ru.reload(); W(ru,900)
  check(ru.evaluate("!S.rt || !S.rt.on"),'runner starts clocked out'); T=txt(ru)
  check('clocked out' in T and PAID in T and 'only during an active job' in T,'clock-in screen copy')
  ru.screenshot(path=OUT+'runner_clockin.png')
  ru.evaluate("RN.acceptTrip()"); check(ru.evaluate("S.trip.status")=='matching','accepted while clocked out')
  ru.locator('#clockIn').tap(); W(ru,600); check(ru.evaluate("!!S.rt.on"),'clock in'); check(ru.locator('#clockOut').count()==1,'clock out button')
  check(ru.locator('#offerPay').inner_text()=='$12.00','job card pay before accept: '+ru.locator('#offerPay').inner_text())
  check('Trip pay $10.00 + $2.00 × 1 stop' in txt(ru),'pay breakdown on card')
  ru.screenshot(path=OUT+'runner_job_pay.png')
  ru.locator('#acceptTrip').tap(); W(ru,500)
  ru.locator('#nextStop').tap(); W(ru,250)                    # arrived
  ru.evaluate("S.trip.times[0].arrive -= 12*60000"); ru.locator('#nextStop').tap(); W(ru,250)   # started (12 min wait)
  ru.locator('#nextStop').tap(); W(ru,250)                    # done
  t=ru.evaluate("S.trip.times[0]"); check(t['arrive']<t['start']<=t['done'],'stop times logged')
  ru.locator('#doneTrip').tap(); W(ru,500)
  check(abs(ru.evaluate("S.rt.trips[0].pay")-14.10)<1e-9,'trip pay with wait '+str(ru.evaluate("S.rt.trips[0].pay")))
  ru.evaluate("RN.clockOut(); S.rt.shifts[0].in = S.rt.shifts[0].out - 3*36e5; RN.tab('earn')"); W(ru,600)
  T=txt(ru)
  check(ru.locator('#tsHours').inner_text()=='3.00 h','hours '+ru.locator('#tsHours').inner_text())
  check(ru.locator('#tsTopUp').inner_text()=='$36.90','top-up '+ru.locator('#tsTopUp').inner_text())
  check(ru.locator('#tsTotal').inner_text()=='$51.00' and ru.locator('#tsTips').inner_text()=='$0.00','total '+ru.locator('#tsTotal').inner_text()); check('Proposed, pending Jeremy' in T,'rates label')
  check('$10.00 / trip × 1' in T and '$2.00 / stop × 1' in T and '$0.30 / min × 7' in T and 'stop times' in T.lower() and 'Arrived' in T,'statement rows')
  ru.screenshot(path=OUT+'runner_timesheet.png', full_page=True)
  check(cu.evaluate('window.__csp')==0 and ru.evaluate('window.__csp')==0,'CSP violations')
  b.close()
print('ERRORS:', errs or 'none'); print('FAILS:', fails or 'none')
