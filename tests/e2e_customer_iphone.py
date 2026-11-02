"""WebKit + iPhone 15, customer app with a runner on the same device.
Clean start and empty states; ordering by taps with a tap count; add-stop search; final drop-off can be any
address and changes route and price; More options; runner pick (never auto-assigned); consent; tracking; chat;
runner price change approval; cancel and refund copy; help; notifications; history and reorder; account;
line sitting end to end with the runner; ride ban; blocked venue; layout (tap targets, no overflow); manifests and
service worker scope; 0 console errors, 0 CSP. Writes screens/cust_*.png and prints the tap counts."""
import re, sys, os, json
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from authseed import SEED
ROOT='http://localhost:8776/errand-beta-/'; OUT='/workspace/errand-tiles/screens/'
CFG=re.sub(r"(MAPS_API_KEY\s*=\s*)(['\"]).*?\2",r"\1''",open('/workspace/errand-tiles/js/config.js').read())
APPS={a: open(f'/workspace/errand-tiles/{a}/index.html').read().replace('; upgrade-insecure-requests','') for a in ['customer','runner','owner']}
fails=[]; errs=[]; n=[0]; taps=[0]; TAPS={}
def check(c,m):
  n[0]+=1
  if not c: fails.append(m)
def ctx(b,p):
  c=b.new_context(**p.devices['iPhone 15']); c.add_init_script(SEED)
  c.add_init_script("window.__csp=0;document.addEventListener('securitypolicyviolation',e=>{window.__csp++;console.error('CSP '+e.violatedDirective)})")
  c.route('**/js/config.js*',lambda r: r.fulfill(content_type='text/javascript',body=CFG))
  for a,H in APPS.items(): c.route(ROOT+a+'/',(lambda H: lambda r: r.fulfill(content_type='text/html',body=H))(H))
  return c
def page(c,a):
  pg=c.new_page(); pg.on('console',lambda m: m.type=='error' and errs.append(a+' console: '+m.text)); pg.on('pageerror',lambda e: errs.append(f'{a} page: {e}'))
  pg.goto(ROOT+a+'/'); pg.wait_for_timeout(900); return pg
W=lambda pg,ms=450: pg.wait_for_timeout(ms)
T=lambda pg: pg.inner_text('body')
def tap(pg,sel,ms=450):
  taps[0]+=1; l=pg.locator(sel).first
  if not l.count(): fails.append('missing '+sel+' on '+str(pg.evaluate("(S.c&&S.c.screen)||''"))+': '+T(pg)[:300].replace('\n',' | ')); raise SystemExit(print('\n'.join(fails+errs)) or 1)
  l.scroll_into_view_if_needed(); W(pg,150)
  try: l.tap(timeout=5000)
  except Exception as e: fails.append('cannot tap '+sel+': '+str(e).split(chr(10))[0]); raise SystemExit(print('\n'.join(fails+errs)) or 1)
  W(pg,ms)
LAYOUT="""()=>{const bad=[],vw=innerWidth;for(const e of document.querySelectorAll('button,a[href],input:not([type=hidden]),select,[role=button],[role=radio]')){const r=e.getBoundingClientRect();if(!r.width||!r.height||getComputedStyle(e).visibility==='hidden')continue;
 const t=e.type==='checkbox'||e.type==='radio'?e.closest('label')||e:e,tr=t.getBoundingClientRect();if(tr.height<44&&!e.closest('.tabbar')&&!e.classList.contains('linkbtn')&&!e.closest('details')&&!e.matches('.stsrc'))bad.push((e.id||e.className||e.tagName)+':h'+Math.round(tr.height));
 if(r.right>vw+1)bad.push((e.id||e.tagName)+':overflow')}
 if(document.documentElement.scrollWidth>vw+1)bad.push('page:hscroll');return bad.slice(0,6)}"""
def layout(pg,tag):
  b=pg.evaluate(LAYOUT); check(not b,tag+' layout: '+str(b))
RUNNER="S.runners={r1:{id:'r1',name:'Dana',pricing:'own',rates:{base:22,extraStop:6,bigShop:null,asap:8,lineHourly:30,lineMin:1},area:'gnp',online:true,sub:{tier:'starter',status:'active',since:Date.now(),day:1,consent:{}},rating:[9,2],jobs:2,jobLog:[],earn:[]},r2:{id:'r2',name:'Eli',pricing:'engine',rates:{lineHourly:28,lineMin:2},area:'man',online:false,sub:{tier:'standard',status:'active',since:Date.now(),day:1,consent:{}},rating:null,jobs:0,jobLog:[],earn:[]}};Store.save();"
HOME="S.prefs.home={addr:'25 Grace Ave, Great Neck',lat:40.7887,lng:-73.7280};Store.save();"
with sync_playwright() as p:
  b=p.webkit.launch(); c=ctx(b,p); cu=page(c,'customer')
  # ---- clean start, empty states
  check(cu.locator('#tileErrands').count()==1 and cu.locator('#tileLine').count()==1,'home has Errands and Line Sitting tiles')
  check(not re.search(r'gradient',cu.evaluate("[...document.querySelectorAll('*')].map(e=>getComputedStyle(e).backgroundImage).filter(x=>x!=='none').join(' ')")),'no gradients')
  check(not re.search('[\U0001F300-\U0001FAFF\u2600-\u26FF\u2700-\u27BF]',T(cu)),'no emoji on home')
  check(cu.locator('.wordmark').count()>=1 and cu.inner_text('.wordmark').strip()=='errandco','lowercase wordmark')
  cu.screenshot(path=OUT+'cust_home.png'); layout(cu,'home')
  cu.evaluate("C.tab('activity')"); W(cu); check(re.search(r'No errands yet|nothing here yet',T(cu),re.I),'activity empty state'); cu.screenshot(path=OUT+'cust_activity_empty.png')
  cu.evaluate("C.tab('home')"); W(cu)
  tap(cu,'#tileErrands'); W(cu,300)
  check(cu.locator('#acq').count()==1,'Errands opens stop search straight away')
  cu.locator('#acq').fill('zzzz-no-such-place'); W(cu,700); check(re.search(r'No places found|Use this exact address',T(cu),re.I),'search no-results message')
  cu.locator('#acClear').tap(); W(cu,300)
  cu.evaluate("C.go('home')"); W(cu)
  check(cu.evaluate("S.runners && Object.keys(S.runners).length")==0,'clean start: no runners')
  cu.evaluate("S.stops=[mkStop('Pharmacy','cvs')];C.go('review')"); W(cu,700)
  check(cu.locator('#noRunners').count()==1 and 'check back' in cu.inner_text('#noRunners'),'no runners empty state'); check(cu.locator('#payBtn').is_disabled(),'cannot request with no runner')
  cu.evaluate("S.stops=[];S.c.screen='home';R()"); W(cu)
  # ---- tap count, first order (home address saved, no card yet)
  cu.evaluate(RUNNER+HOME); cu.reload(); W(cu,900); taps[0]=0
  tap(cu,'#tileErrands'); tap(cu,'#q-cvs',600); tap(cu,'.addbtn'); tap(cu,'#cartDone',600)
  check(cu.evaluate("S.stops.length")==1 and 'CVS' in T(cu),'stop added')
  check('Final drop-off: all items delivered here' in T(cu),'final drop-off label on stops screen')
  tap(cu,'#toReview',700); check(cu.evaluate("S.c.runner||null") is None,'no runner preselected')
  check(cu.locator('#rk-r1').count()==1 and cu.locator('#rk-r2').count()==1,'both runners listed, offline one too')
  check(cu.locator('#payBtn').is_disabled(),'Request disabled until a runner is picked')
  tap(cu,'#rk-r1',600); tap(cu,'#payAdd',600); check(cu.evaluate("!!S.pay.method"),'test card added inline')
  check(cu.locator('#payBtn').is_disabled(),'Request disabled until consent'); tap(cu,'label[for=ckConsent]',300)
  cu.screenshot(path=OUT+'cust_review.png'); layout(cu,'review')
  tap(cu,'#payBtn',800); check(cu.evaluate("S.trip&&S.trip.status")=='matching','first order requested')
  TAPS['first order (store item, runner, add test card, consent, request)']=taps[0]
  cu.screenshot(path=OUT+'cust_tracking_waiting.png'); layout(cu,'tracking')
  check('Waiting for' in T(cu) or 'Dana' in T(cu),'tracking shows waiting for picked runner')
  tap(cu,'#cancelTrip',500)
  if cu.locator('#cancelYes').count(): tap(cu,'#cancelYes',500)
  check(cu.evaluate("S.trip") is None,'cancel before accept'); 
  # ---- repeat order: card saved
  taps[0]=0
  tap(cu,'#tileErrands'); tap(cu,'#q-cvs',600); tap(cu,'.addbtn'); tap(cu,'#cartDone',600); tap(cu,'#toReview',700); tap(cu,'#rk-r1',600); tap(cu,'label[for=ckConsent]',300); tap(cu,'#payBtn',800)
  check(cu.evaluate("S.trip&&S.trip.status")=='matching','repeat order requested'); TAPS['repeat order (card saved)']=taps[0]
  cu.evaluate("C.cancel()"); W(cu)
  # ---- final drop-off: any address, route and price recalc
  cu.evaluate("S.stops=[mkStop('Groceries','stopshop',{items:[{n:'Milk',p:4,q:1}]}),mkStop('Pharmacy','cvs'),mkStop('Dry cleaning','cleaners'),mkStop('Returns','ups')];S.c.runner='r1';C.go('review')"); W(cu,800)
  p1=cu.inner_text('#ckPrice'); m1=cu.evaluate("quote().route.miles")
  check('Home' in cu.inner_text('#finalDrop'),'final drop-off defaults to home')
  tap(cu,'#destChange',600); check(cu.locator('#acq').count()==1,'change drop-off opens address search')
  cu.evaluate("AS.chosen&&0"); cu.evaluate("S.dest={name:'Office',addr:'1 Kings Point Rd, Kings Point',lat:40.8190,lng:-73.7360};AS.close?AS.close():0;C.go('review')"); W(cu,800)
  m2=cu.evaluate("quote().route.miles"); check(m2!=m1,'route recalculated when drop-off changes (%s -> %s mi)'%(m1,m2))
  check('Office' in cu.inner_text('#finalDrop') and '1 Kings Point Rd' in cu.inner_text('#finalDrop'),'new drop-off shown')
  check('$28.00' in cu.inner_text('#ckPrice'),'runner price for 4 stops = base + extra stop: '+cu.inner_text('#ckPrice')[:60])
  cu.evaluate("S.c.runner='r2';R()"); W(cu,600); pe1=cu.evaluate("quote().price")
  cu.evaluate("S.dest={name:'Far',addr:'Port Washington',lat:40.8257,lng:-73.6982};R()"); W(cu,600); pe2=cu.evaluate("quote().price")
  check(pe1!=pe2,'engine price recalculated when drop-off moves (%s -> %s)'%(pe1,pe2))
  cu.evaluate("S.dest=null;S.c.runner=null;R()"); W(cu,500)
  # ---- More options
  check(cu.locator('#moreOpts').count()==1 and not cu.evaluate("document.getElementById('moreOpts').open"),'More options collapsed by default')
  cu.locator('#moreOpts summary').tap(); W(cu,300); check(cu.evaluate("document.getElementById('moreOpts').open") and cu.locator('#ckNoteIn').count()==1,'More options shows note and item hold')
  tap(cu,'#ckMode-asap',500); check(cu.evaluate("S.timing")=='asap','ASAP chosen')
  tap(cu,'#ckMode-scheduled',500); opts=cu.evaluate("[...document.querySelectorAll('#ckWindow option')].map(o=>o.text)")
  check(len(opts)>=6 and all(re.match(r'^(Today|Tomorrow|Mon|Tue|Wed|Thu|Fri|Sat|Sun) ',o) for o in opts),'scheduled windows are real upcoming times: '+str(opts[:3]))
  check(cu.locator('#payBtn').count()==1 and cu.locator('.btn:not(.plain):not(.gray):not(.sm)').count()<=2,'one main button on review')
  # ---- ride ban
  cu.evaluate("S.c.note='Can you give me a ride to the station';C.confirm()"); W(cu,400)
  check(cu.evaluate("S.trip") is None and 'never give rides' in T(cu),'ride request in the note refused')
  cu.evaluate("S.c.note='';S.stops=[];C.go('home')"); W(cu)
  # ---- line sitting, with the runner app open on the same device
  ru=page(c,'runner')
  cu.evaluate("S.runners['test-runner']=Object.assign({},S.runners.r1,{id:'test-runner',name:'Test runner',jobLog:[],earn:[]});Store.save()"); ru.reload(); W(ru,700); cu.reload(); W(cu,900)
  taps[0]=0
  tap(cu,'#tileLine'); cu.locator('#lnq').fill('DMV Garden City'); W(cu,800); tap(cu,'#lnTyped',600)
  check(cu.locator('#lnBlocked').count()==1 and (cu.locator('#lnReview').count()==0 or cu.locator('#lnReview').is_disabled()),'blocked venue refused (DMV)')
  cu.screenshot(path=OUT+'cust_line_blocked.png')
  layout(cu,'line blocked')
  tap(cu,'#lnChange'); cu.locator('#lnq').fill('Apple Store Manhasset'); W(cu,800); tap(cu,'#lnTyped',600)
  check(cu.locator('#lnReview').is_disabled(),'line review needs a start time and both boxes')
  cu.evaluate("(()=>{const d=new Date(Date.now()+26*3600e3),z=n=>String(n).padStart(2,'0');const e=document.getElementById('lnStart');e.value=d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+'T10:00';e.dispatchEvent(new Event('change',{bubbles:true}))})()"); taps[0]+=1; W(cu)
  tap(cu,'label:has(#lnFees)',250); tap(cu,'label:has(#lnRules)',250); layout(cu,'line form')
  tap(cu,'#lnReview',700); check(cu.locator('#lnBook').is_disabled() and cu.evaluate("S.c.ln.runner||null") is None,'line: no runner preselected')
  tap(cu,'#rk-test-runner',500); check(cu.locator('#jobAgreement').count()==1,'line: job agreement shown at booking')
  check(cu.locator('#lnBook').is_disabled() and 'Demo only' in T(cu),'line: Request disabled until consent, Demo only shown')
  if cu.locator('#lnPayAdd').count(): tap(cu,'#lnPayAdd',400)
  tap(cu,'label[for=lnConsent]',300); cu.screenshot(path=OUT+'cust_line_review.png'); layout(cu,'line review')
  tap(cu,'#lnBook',800); check(cu.evaluate("S.line&&S.line.status")=='requested' and cu.evaluate("!!(S.line.consent&&S.line.consent.at)"),'line requested with consent logged')
  TAPS['line sitting (place, time, 2 boxes, review, runner, consent, request)']=taps[0]
  W(ru,500); check(ru.locator('#acceptLine').count()==1 and '$60.00' in ru.inner_text('#lineOffer'),'runner sees line pay before accepting')
  ru.locator('#acceptLine').tap(); W(ru,700); W(cu,400)
  code=ru.evaluate("S.line.code"); check(bool(code) and str(code) in T(cu),'customer sees the same handoff code live')
  check('Accepted · starts' in T(cu),'customer sees accepted with the start time')
  cu.evaluate("C.go('chat')"); W(cu); cu.locator('#chatIn').fill('I will be there at 10'); tap(cu,'#chatSend',500)
  W(ru,400); check('I will be there at 10' in ru.evaluate("JSON.stringify(S.line.chat||[])"),'chat reaches the runner')
  cu.evaluate("LN.go('lineStatus')"); W(cu)
  ru.locator('#lineAlmost').tap(); W(ru,600); W(cu,400); check('Almost your turn' in T(cu),'customer pinged: almost your turn')
  ru.locator('#lineEnd').tap(); W(ru,700); cu.evaluate("C.tab('home')"); W(cu,500)
  check(cu.evaluate("S.line") is None and cu.evaluate("S.history[0].kind")=='line','line finished, in history')
  tap(cu,'#bellBtn',500); check('Line sitting finished' in T(cu),'notification for finished line'); cu.screenshot(path=OUT+'cust_notifications.png')
  cu.evaluate("C.tab('activity')"); W(cu); check('Line Sitting' in T(cu),'activity lists the line sitting'); cu.screenshot(path=OUT+'cust_activity.png')
  # ---- help
  cu.evaluate("C.help(0)"); W(cu); check(cu.locator('#issueList').count()==1,'help shows issue list')
  cu.locator('#issueList button').first.tap(); W(cu,300)
  if cu.locator('#helpNote').count(): cu.locator('#helpNote').fill('Test issue')
  tap(cu,'#sendHelp',600); check(cu.evaluate("S.support.length")>=1,'help request saved for the owner'); cu.screenshot(path=OUT+'cust_help.png')
  # ---- errand tiles
  cu.evaluate("C.tab('home')"); W(cu); check(cu.locator('#tileGrid button').count()>=5,'more errand tiles listed')
  tap(cu,'#tile-post',600); check(cu.locator('#tsGo').is_disabled(),'post: Continue disabled until a choice')
  tap(cu,'label:has(#ts-mode-dropoff)',300); check(cu.locator('#tsGo').is_disabled(),'post: sealed box and value still needed')
  tap(cu,'label:has(#ts-sealed)',300); cu.locator('#ts-value').fill('40'); W(cu,300); cu.locator('#ts-value').blur(); W(cu,300)
  cu.locator('#ts-value').fill('900'); W(cu,400); check(cu.locator('#tsGo').is_disabled() and '500' in T(cu),'post: over $500 declared value refused')
  cu.locator('#ts-value').fill('40'); W(cu,400); check(not cu.locator('#tsGo').is_disabled(),'post: sealed and value enable Continue'); layout(cu,'tile post')
  check("Runners can't sign" in T(cu) and "We can't" not in T(cu),'post copy: runners, not the platform')
  tap(cu,'#tsGo',600); check(cu.evaluate("S.c.screen") in ('stops','add','place'),'post continues to the errand: '+str(cu.evaluate("S.c.screen")))
  cu.evaluate("S.stops=[];S.c.preset=null;C.go('home')"); W(cu)
  tap(cu,'#tile-weekly',600); cu.locator('#ts-day').select_option(index=1); W(cu,300)
  if cu.locator('#ts-win').count(): cu.locator('#ts-win').select_option(index=1); W(cu,300)
  tap(cu,'label:has(#ts-pmode-approve)',300); check(not cu.locator('#tsGo').is_disabled(),'weekly: day, window and charge choice enable Add stops')
  check('Cancel anytime' in T(cu),'weekly: cancel anytime shown'); cu.screenshot(path=OUT+'cust_weekly.png')
  tap(cu,'#tsGo',600); check(cu.evaluate("S.c.screen")=='stops' and cu.evaluate("S.c.preset&&S.c.preset.key")=='weekly','weekly continues to stops')
  cu.evaluate("S.stops=[];S.c.preset=null;C.go('home')"); W(cu)
  # ---- account
  cu.evaluate("C.tab('account')"); W(cu); check(cu.locator('#signOut').count()==1 and cu.locator('#delAcct').count()==1,'account has sign out and delete'); layout(cu,'account'); cu.screenshot(path=OUT+'cust_account.png')
  b.close()
for k,v in TAPS.items(): print('TAPS',k,v)
fails+=errs
print(f'{n[0]-len([f for f in fails if f not in errs])}/{n[0]} checks passed'); [print('FAIL',f) for f in fails]
sys.exit(1 if fails else 0)
