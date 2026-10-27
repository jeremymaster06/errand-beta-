"""WebKit + iPhone 15: clean start (no seeded data), opening tiles, Hold My Spot booking, blocked venue,
line review/status, runner + owner empty states, runner break/relief on a line job. 0 CSP violations.
Writes screens/clean_*.png."""
import re
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from authseed import SEED
ROOT='http://localhost:8776/errand-beta-/'; BASE=ROOT+'customer/'; OUT='/workspace/errand-tiles/screens/clean_'
CFG=re.sub(r"(MAPS_API_KEY\s*=\s*)(['\"]).*?\2",r"\1''",open('/workspace/errand-tiles/js/config.js').read())
IDX={a: open(f'/workspace/errand-tiles/{a}/index.html').read().replace('; upgrade-insecure-requests','') for a in ['customer','runner','owner']}
fails=[];errs=[]
def check(c,m):
  if not c: fails.append(m)
with sync_playwright() as p:
  b=p.webkit.launch(); c=b.new_context(**p.devices['iPhone 15']); c.add_init_script(SEED); pg=c.new_page()
  pg.on('console',lambda m: m.type=='error' and errs.append('console: '+m.text)); pg.on('pageerror',lambda e: errs.append(f'page: {e}'))
  pg.route('**/js/config.js*',lambda r: r.fulfill(content_type='text/javascript',body=CFG)); [pg.route(ROOT+a+'/',(lambda H: lambda r: r.fulfill(content_type='text/html',body=H))(H)) for a,H in IDX.items()]
  pg.add_init_script("window.__csp=0;document.addEventListener('securitypolicyviolation',e=>{window.__csp++;console.error('CSP '+e.violatedDirective)})")
  pg.goto(BASE); pg.wait_for_timeout(900)
  def shot(n): pg.wait_for_timeout(450); pg.screenshot(path=OUT+n+'.png')
  def tap(sel): pg.locator(sel).first.tap(); pg.wait_for_timeout(400)
  txt=lambda: pg.inner_text('#screen')
  check(pg.evaluate(r"Object.keys(localStorage).every(k=>k==='errand.shared.v1'||/^errand\.(auth|session)\./.test(k)) && !JSON.parse(localStorage.getItem('errand.shared.v1')||'{}').trip"),'unexpected localStorage seed')
  check(pg.evaluate("S.stops.length===0 && !S.trip && !S.line && S.history.length===0 && S.o.support.length===0"),'seeded state')
  check(pg.locator('#tileErrands').count()==1 and pg.locator('#tileLine').count()==1,'tiles missing')
  check('We hold your place in line.' in txt() and 'skip' not in txt().lower(),'tile subline'); shot('01_home_tiles')
  check(pg.locator('[onclick],[onchange],[onkeydown],[oninput]').count()==0,'inline handlers in DOM')
  tap('#tileErrands'); tap('#navBack'); check(pg.evaluate("S.c.screen")=='stops','errands opens trip'); check('No stops yet' in txt(),'empty trip'); shot('02_errand_empty')
  pg.evaluate("C.tab('home')")
  for t in ['activity','favorites','account']:
    pg.evaluate(f"C.tab('{t}')"); pg.wait_for_timeout(300); shot('03_customer_'+t)
  check('No trips yet' in (pg.evaluate("C.tab('activity')") or txt()),'activity empty')
  pg.evaluate("C.tab('home')"); pg.wait_for_timeout(300)
  # blocked venue
  tap('#tileLine'); check(pg.evaluate("S.c.screen")=='line','line opens'); shot('04_line_book_empty')
  pg.locator('#lnq').fill('DMV Garden City'); pg.wait_for_timeout(700); tap('#lnTyped')
  check(pg.locator('#lnBlocked').count()==1 and pg.locator('#lnReview').count()==0,'blocked venue not refused'); shot('05_line_blocked')
  for v in ['Shakespeare in the Park','Nassau County Courthouse','Island Harvest Food Bank','Polling place PS 21']:
    tap('#lnChange'); pg.locator('#lnq').fill(v); pg.wait_for_timeout(700); tap('#lnTyped'); check(pg.locator('#lnBlocked').count()==1,'not blocked: '+v)
  # allowed venue
  tap('#lnChange'); pg.locator('#lnq').fill('Apple Store Manhasset'); pg.wait_for_timeout(700); tap('#lnTyped')
  check(pg.locator('#lnBlocked').count()==0,'allowed venue blocked')
  check(pg.locator('#lnReview').is_disabled(),'review enabled before start/acks')
  t=pg.evaluate("(()=>{const d=new Date(Date.now()+26*3600e3);d.setMinutes(0,0,0);const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:00`})()")
  pg.locator('#lnStart').fill(t); pg.locator('#lnStart').dispatch_event('change'); pg.wait_for_timeout(300)
  pg.locator('#lnHours').select_option('3'); pg.wait_for_timeout(300)
  shot('06_line_book_filled')
  T=txt(); check('$135.00' in T,'estimate 15+40*3 = $135'); check('Includes the $15 booking fee' in T and '2-hour minimum ($95)' in T,'fee-included note + minimum')
  check('After a runner is on the way, you pay only for the time and mileage already used.' in T,'cancel copy'); check('$20' not in T and '$57' not in T and '$83' not in T,'old cancel amounts shown')
  check('ASAP' not in T and 'ticket' not in T.lower().replace('tickets, items or entry','').replace('entry, tickets or items',''),'ASAP/ticket wording')
  tap('#lnFees'); tap('#lnRules'); check(not pg.locator('#lnReview').is_disabled(),'review not enabled after acks')
  pg.evaluate("document.querySelector('#screen .page').scrollTop=2000"); shot('07_line_book_terms')
  tap('#lnReview'); check(pg.evaluate("S.c.screen")=='lineReview','review'); T=txt()
  check('Estimate. Final price set by server. Rate pending' in T and '$135.00' in T,'review label/total'); shot('08_line_review')
  tap('#lnBook'); check(pg.evaluate("S.c.screen")=='lineStatus' and pg.evaluate("S.line.status")=='requested','booked'); T=txt()
  check('Waiting for a runner' in T and 'handoff code appears here' in T and "join your runner in line" in T,'pending status'); shot('09_line_status_pending')
  # runner side
  pg.goto(ROOT+'runner/'); pg.wait_for_timeout(800); shot('10_runner_offline'); pg.evaluate("RN.online()"); pg.wait_for_timeout(400); shot('11_runner_request')
  tap('#screen button.btn:has-text("Accept")'); check(pg.locator('#reliefBtn').count()==1,'relief button missing'); shot('12_runner_line_job')
  tap('#reliefBtn'); check(pg.evaluate("S.line.relief")==True,'relief not requested')
  pg.evaluate("RN.almost()"); pg.goto(BASE); pg.wait_for_timeout(800); pg.evaluate("LN.go('lineStatus')"); pg.wait_for_timeout(400)
  check("Almost your turn, head over" in txt() and re.search(r'\b\d{4}\b',txt()),'almost + code'); shot('13_line_status_almost')
  # runner / owner empty states on a fresh load
  pg.evaluate("localStorage.clear()"); pg.goto(ROOT+'runner/'); pg.wait_for_timeout(800)
  pg.evaluate("RN.online()"); pg.wait_for_timeout(400); check('No requests right now' in txt(),'runner empty'); shot('14_runner_online_empty')
  for t in ['route','earn','acct']: pg.evaluate(f"RN.tab('{t}')"); pg.wait_for_timeout(300); shot('15_runner_'+t)
  pg.evaluate("RN.online()"); pg.goto(ROOT+'owner/'); pg.wait_for_timeout(800); D=pg.inner_text('#desk'); check('$4,812' not in D and 'Nothing yet' in D,'owner empty'); shot('16_owner_overview')
  for t in ['jobs','runners','support','promos']: pg.evaluate(f"OW.tab('{t}')"); pg.wait_for_timeout(300); shot('17_owner_'+t)
  csp=pg.evaluate("window.__csp"); check(csp==0,f'CSP violations {csp}')  # per-page counter; console errors catch earlier pages
  b.close()
print('CSP violations: 0' if not any('CSP' in e for e in errs) else 'CSP violations present')
print('ERRORS:',errs or 'none'); print('FAILS:',fails or 'none')
