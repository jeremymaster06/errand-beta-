"""WebKit + iPhone 15: customer home tile grid, per-tile presets and Lex's requirements (draft copy),
global block list, Repeat weekly errands opt-in/confirm/skip/edit/cancel, 0 CSP. Writes screens/tiles_*.png."""
import re
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from authseed import SEED
ROOT='http://localhost:8776/errand-beta-/'; BASE=ROOT+'customer/'; OUT='/workspace/errand-tiles/screens/tiles_'
CFG=re.sub(r"(MAPS_API_KEY\s*=\s*)(['\"]).*?\2",r"\1''",open('/workspace/errand-tiles/js/config.js').read())
HTML=open('/workspace/errand-tiles/customer/index.html').read().replace('; upgrade-insecure-requests','')
fails=[]; errs=[]
def check(c,m):
  if not c: fails.append(m)
BLOCK="We can't buy or carry alcohol, tobacco, vapes, cannabis, prescriptions, age-restricted items, lottery tickets, firearms, cash or money orders."
with sync_playwright() as p:
  b=p.webkit.launch(); c=b.new_context(**p.devices['iPhone 15']); c.add_init_script(SEED); pg=c.new_page()
  pg.on('console',lambda m: m.type=='error' and errs.append('console: '+m.text)); pg.on('pageerror',lambda e: errs.append(f'page: {e}'))
  c.route('**/js/config.js*',lambda r: r.fulfill(content_type='text/javascript',body=CFG)); c.route(BASE,lambda r: r.fulfill(content_type='text/html',body=HTML))
  c.add_init_script("window.__csp=0;document.addEventListener('securitypolicyviolation',e=>{window.__csp++;console.error('CSP '+e.violatedDirective+' '+e.blockedURI)})")
  pg.goto(BASE); pg.wait_for_timeout(900)
  W=lambda ms=350: pg.wait_for_timeout(ms)
  def shot(n): W(450); pg.screenshot(path=OUT+n+'.png')
  def tap(sel): pg.locator(sel).first.tap(); W()
  txt=lambda: pg.inner_text('#screen')
  go_disabled=lambda: pg.locator('#tsGo').is_disabled()
  def home(): pg.evaluate("C.tab('home')"); W(400)
  # home: two big tiles + 6-tile grid, monoline violet SVGs, no emoji, empty state
  check(pg.locator('#newOrderBtn').inner_text().strip()=='Start a new order','new order button')
  check(pg.locator('#tileErrands').count()==1 and pg.locator('#tileLine').count()==1,'main tiles')
  keys=['groceries','returns','cleaning','weekly','post','gifts']
  check([pg.locator('#tile-'+k).count() for k in keys]==[1]*6,'grid tiles')
  labels=pg.evaluate("[...document.querySelectorAll('.gtile .gtile-t')].map(e=>e.textContent)")
  check(labels==['Groceries','Returns & drop-offs','Dry cleaning','Repeat weekly errands','Post office & packages','Gifts & flowers'],'labels '+str(labels))
  check(pg.evaluate("[...document.querySelectorAll('.gtile-ic svg')].every(s=>getComputedStyle(s).stroke.replace(/\\s/g,'')==='rgb(109,40,217)')"),'icons not violet monoline')
  check(not re.search('[\U0001F300-\U0001FAFF\u2600-\u27BF]',txt()),'emoji on home')
  check(pg.evaluate("S.stops.length===0 && !S.trip && !S.weekly"),'demo data')
  g=pg.locator('.sheet .grabber').bounding_box(); pg.mouse.move(g['x']+g['width']/2,g['y']+5); pg.mouse.down(); pg.mouse.move(g['x']+g['width']/2,g['y']-400,steps=10); pg.mouse.up(); W(600); pg.evaluate('getSelection().removeAllRanges()')
  check(pg.locator('#tile-gifts').bounding_box()['y']+40 < 852,'grid not visible at large detent'); check(pg.locator('#newOrderBtn').bounding_box()['y'] < pg.locator('h1.hello').bounding_box()['y'] < pg.locator('#tileErrands').bounding_box()['y'],'new order not above heading and tiles'); shot('customer_home')
  def start(k): home(); tap('#tile-'+k); check(pg.evaluate("S.c.screen")=='tileSetup' and pg.evaluate("S.c.tset.key")==k,'setup '+k); check(BLOCK in txt(),'block note on '+k)
  def cont(k, expect_q, expect_type):
    check(not go_disabled(),k+' continue still disabled'); tap('#tsGo'); W(900)
    check(pg.evaluate("S.c.screen")=='add' and pg.evaluate("S.c.add.q")==expect_q,f'{k} add preset {pg.evaluate("S.c.add.q")}')
    check(pg.evaluate("S.c.preset.key")==k,'preset key '+k); check(BLOCK in txt(),'block note in search '+k)
    tap('#ac0'); W(900); sc=pg.evaluate("S.c.screen")
    t=pg.evaluate("S.c.screen==='store' ? ST.draftStop().type : S.c.place.type")
    check(t==expect_type,f'{k} stop type {t} (screen {sc})'); return sc
  ENGINE=lambda t: pg.evaluate(f"engineStop({{type:'{t}',items:[]}}).type")
  # Groceries: substitution required, EBT note, item browser, blocked items filtered, custom blocked refused
  start('groceries'); check(go_disabled(),'grocery needs substitution'); check('EBT/SNAP not accepted.' in txt(),'EBT note')
  tap('#ts-sub-ask'); shot('groceries')
  sc=cont('groceries','grocery','Groceries'); check(sc=='store','grocery opens item browser'); check(ENGINE('Groceries')=='grocery','engine grocery')
  check(pg.evaluate("S.c.store.items.every(i=>!isBlocked(i.name))"),'blocked catalog item shown')
  shot('groceries_store')
  # Returns: proof choice required, ID + refund notes, no file/photo inputs
  start('returns'); check(go_disabled(),'returns needs proof'); T=txt()
  check("If the store needs your ID, you'll need to return it in person." in T and 'Refunds go to your original payment method.' in T,'returns notes')
  check(pg.locator('input[type=file]').count()==0,'file/photo input present'); tap('#ts-proof-qr'); shot('returns')
  cont('returns','UPS Store','Returns'); check(ENGINE('Returns')=='return','engine return')
  # Dry cleaning: cover/claims copy, over-max refused
  start('cleaning'); T=txt(); check('We cover loss while items are with us, up to $300.' in T and 'within 14 days' in T and 'placeholders' not in T and 'Normal wear and hidden defects are not covered.' in T and '$1,000 is the most a runner will buy per order' in T and 'Request a refund or credit under our Damage & Loss Policy (Terms §4.3–4.4) Submit within 14 days of delivery.' in T and 'guarantee' not in T.lower(),'cleaning copy')
  pg.locator('#tsTerms button.linkbtn').tap(); pg.wait_for_timeout(900); check(pg.locator('#auDoc').is_visible() and 'Reporting problems' in pg.inner_text('#auDoc'),'damage link opens Terms viewer')
  check(pg.evaluate("(()=>{const p=[...document.querySelectorAll('#auDoc p')].find(x=>x.textContent.startsWith('4.3 '));const r=p.getBoundingClientRect();return r.top>=0&&r.top<innerHeight})()"),'Terms viewer scrolled to 4.3')
  pg.locator('#auth .au-top button').tap(); pg.wait_for_timeout(400); check(pg.locator('#auth').is_hidden(),'Terms viewer back')
  pg.locator('#ts-value').fill('5000'); W(); check(go_disabled() and "can't be accepted" in pg.inner_text('#tsErr'),'cleaning over max')
  pg.locator('#ts-value').fill('400'); W(); shot('dry_cleaning')
  cont('cleaning','cleaners','Dry cleaning'); check(ENGINE('Dry cleaning')=='pickup','engine pickup (cleaning)')
  # Post office: mode, sealed tick, customs, held-mail authorization, max value
  start('post'); check(go_disabled(),'post needs mode'); tap('#ts-mode-held'); check(go_disabled(),'held mail needs auth'); tap('#ts-heldAuth'); check(not go_disabled(),'held ok')
  tap('#ts-mode-dropoff'); check(go_disabled(),'dropoff needs sealed tick'); tap('#ts-sealed'); tap('#ts-intl'); check(go_disabled(),'intl needs customs'); tap('#ts-customs')
  pg.locator('#ts-value').fill('900'); W(); check(go_disabled(),'over max declared value accepted'); pg.locator('#ts-value').fill('120'); W()
  T=txt(); check('never opens or repacks' in T and 'certified or registered' in T and "carrier's claims process" in T and 'liability is capped at $500' in T and 'buy insurance from the carrier' in T,'post notes'); shot('post_office')
  pg.locator('#tsClaimDays').scroll_into_view_if_needed(); check(pg.locator('#tsClaimDays').is_visible() and pg.inner_text('#tsClaimDays')=='Submit within 14 days of delivery.','post claim days'); shot('post_office_terms')
  cont('post','post office','Post office'); check(ENGINE('Post office')=='post_office','engine post_office')
  # Gifts: recipient required, privacy + price confirm, wine basket refused
  start('gifts'); check(go_disabled(),'gifts need recipient'); T=txt(); check('used only for this delivery' in T and 'we confirm the price with you before buying' in T and 'wine or champagne baskets' in T,'gifts notes')
  pg.locator('#ts-rName').fill('Sam'); pg.locator('#ts-rAddr').fill('12 Elm St, Great Neck'); pg.locator('#ts-rMsg').fill('Happy birthday, enjoy the wine basket'); W()
  check(go_disabled() and "isn't allowed" in pg.inner_text('#tsErr'),'wine basket accepted'); pg.locator('#ts-rMsg').fill('Happy birthday'); W(); shot('gifts_flowers')
  cont('gifts','florist','Personal pickup' if pg.evaluate("Places.mode")!='google' else 'Shopping')
  # global block list: catalog search, place search, custom item, stop note
  check(pg.evaluate("Places.suggest('liquor store').then(r=>r.length)")==0,'blocked place search')
  check(pg.evaluate("Catalog.getItems ? Promise.all(['pharmacy','grocery'].map(k=>Catalog.getStore({id:'x'+k,name:k,kind:k}).then(s=>Catalog.getItems(s.id)))).then(a=>a.flat().filter(i=>isBlocked(i.name)).length) : 0")==0,'blocked items in catalog')
  for w in ['beer','Marlboro cigarettes','vape pods','money order','lottery scratch-off','CBD gummies','9mm ammo','prescription refill']:
    check(pg.evaluate(f"isBlocked({w!r})"),'not blocked: '+w)
  for w in ['red wine vinegar','cashews','gum','ginger','rummage']: check(not pg.evaluate(f"isBlocked({w!r})"),'false positive: '+w)
  pg.evaluate("S.c.place={pl:{id:'a1',name:'25 Grace Ave',addr:'Great Neck',lat:40.79,lng:-73.73},type:'Personal pickup',what:'case of beer',note:'',from:''}; S.c.screen='place'; R()"); W(); n=pg.evaluate("S.stops.length"); pg.evaluate("PL.add()"); W()
  check(pg.evaluate("S.stops.length")==n,'blocked custom stop added')
  # Repeat weekly
  pg.evaluate("S.stops=[]; S.c.preset=null"); start('weekly'); check(go_disabled(),'weekly needs day/window/mode')
  pg.locator('#ts-day').select_option('Tuesday'); pg.locator('#ts-win').select_option('10 AM–12 PM'); tap('#ts-pmode-max'); check(go_disabled(),'max mode needs amount')
  pg.locator('#ts-max').fill('80'); W(); T=txt(); check('Repeats weekly, each trip priced by the engine at the time.' in T and 'Cancel anytime' in T and "7 days' notice of any price change" in T and 'skip or cancel with one tap before each charge' in T,'weekly copy'); shot('weekly_schedule')
  tap('#tsGo'); check(pg.evaluate("S.c.screen")=='stops','weekly -> stops')
  pg.evaluate("S.stops.push(mkStop('Post office','usps',{custom:{name:'US Post Office',addr:'1 Welwyn Rd',lat:40.7998,lng:-73.7290,kind:'post'}})); C.useTestMethod(); C.go('review')"); W(700)
  T=txt(); check(pg.locator('#wkOptIn').count()==1 and not pg.locator('#wkOptIn').is_checked(),'opt-in must start unchecked')
  check(pg.locator('#payBtn').is_disabled(),'pay enabled before opt-in'); check('Repeats weekly, each trip priced by the engine at the time.' in T and 'Tuesdays, 10 AM–12 PM' in T and 'Cancel anytime' in T and '$80.00' in T,'weekly review terms')
  pg.evaluate("document.querySelector('#wkTerms').scrollIntoView()"); shot('weekly_review')
  pg.evaluate("C.confirm()"); W(); check(not pg.evaluate("S.trip"),'confirm without opt-in')
  tap('#wkOptIn'); check(not pg.locator('#payBtn').is_disabled(),'pay not enabled after opt-in'); tap('#payBtn'); W(500)
  check(pg.evaluate("S.c.screen")=='weeklyDone' and pg.evaluate("S.weekly.active") and pg.evaluate("S.trip.recur.weekly"),'weekly confirmed'); T=txt()
  check('Cancel anytime' in T and pg.locator('#wkCancel').count()==1 and pg.locator('#wkSkip').count()==1 and pg.locator('#wkEdit').count()==1,'confirmation screen'); shot('weekly_confirmed')
  tap('#wkSkip'); check(pg.evaluate("S.weekly.skipNext"),'skip'); tap('#wkSkip'); check(not pg.evaluate("S.weekly.skipNext"),'unskip')
  tap('#wkEdit'); check(pg.evaluate("S.c.screen")=='stops' and pg.evaluate("S.c.preset.editOnly"),'edit week'); pg.evaluate("C.go('review')"); W(500)
  pg.evaluate("C.confirm()"); W(); check(pg.evaluate("S.c.screen")=='weeklyDone','edit saved')
  home(); check(pg.locator('#wkManageCell').count()==1,'manage cell on home'); tap('#wkManageCell')
  tap('#wkCancel'); check(pg.evaluate("S.weekly.active")==False,'one-tap cancel'); shot('weekly_cancelled')
  # errands tile still plain (no preset)
  home(); tap('#tileErrands'); check(pg.evaluate("S.c.preset")is None and pg.evaluate("S.c.add.q")=='','Errands tile preset leak')
  check(pg.locator('[onclick],[onchange],[oninput],[onkeydown]').count()==0,'inline handlers')
  v=pg.evaluate("window.__csp"); print('CSP violations:',v); check(v==0,'CSP '+str(v))
  b.close()
print('ERRORS:',errs or 'none'); print('FAILS:',fails or 'none')
