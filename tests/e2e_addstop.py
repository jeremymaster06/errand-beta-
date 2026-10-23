# Add-a-stop flow: typing -> suggestions -> store browser -> search -> cart -> price. Light/dark, 320-430 + desktop.
# Also: no preset stops on the add screen, zero console errors (incl. CSP), stubbed google.maps Places path.
from playwright.sync_api import sync_playwright
OUT='/workspace/errand-redesign/screens/'; URL='http://localhost:8765/index.html'
errs=[]; fails=[]
def check(c,msg):
  if not c: fails.append(msg)
OVER="""()=>{const bad=[];const vis=e=>{const r=e.getBoundingClientRect();return r.width&&r.height?r:null};
const W=document.querySelector('#device').getBoundingClientRect();
for(const e of document.querySelectorAll('#screen .irow, #screen .acfield, #screen .cell.ac, #screen .cartbar.show .btn, #screen .sttabs, #screen .sthead > *')){const r=vis(e);if(!r)continue;
 if(r.left<W.left-1||r.right>W.right+1)bad.push('offscreen:'+e.className)}
for(const r of document.querySelectorAll('#screen .irow')){const a=r.querySelector('.iname'),b=r.querySelector(':scope>.addbtn,:scope>.qty,:scope>.iconbtn,:scope>.iprice');if(a&&b){const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();if(x.right>y.left+1&&b.classList.length)bad.push('row overlap '+a.textContent)}}
return bad}"""
def run(w,h,scheme,tag,shots,mobile=True):
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
    c=b.new_context(viewport={'width':w,'height':h},device_scale_factor=2 if mobile else 1,is_mobile=mobile,has_touch=mobile,color_scheme=scheme)
    pg=c.new_page()
    pg.on('console',lambda m: m.type in('error','warning') and 'Places' not in m.text and errs.append(f'{tag} {m.type}: {m.text}'))
    pg.on('pageerror',lambda e: errs.append(f'{tag} page: {e}'))
    pg.goto(URL); pg.wait_for_timeout(500)
    def shot(n):
      if shots: pg.wait_for_timeout(350); pg.screenshot(path=f'{OUT}{tag}_{n}.png')
    def ov(n):
      o=pg.evaluate(OVER); check(not o,f'{tag} {n} overlaps {o}')
    # start a trip from home: Where to? opens the search page, with NO preset stops/tiles
    pg.click('.where'); pg.wait_for_timeout(400)
    check(pg.evaluate("S.c.screen")=='add',f'{tag} where-to did not open search')
    check(pg.locator('#acList .cell').count()==0 and pg.locator('.tile').count()==0,f'{tag} presets shown on empty add screen')
    shot('add_stop_empty')
    pg.keyboard.type('st',delay=60); pg.wait_for_timeout(450)
    check(pg.locator('#acList .cell.ac').count()==0,f'{tag} suggestions before 3 letters')
    shot('add_stop_typing')
    pg.keyboard.type('op',delay=60); pg.wait_for_timeout(500)
    n=pg.locator('#acList .cell.ac').count(); check(n>=2,f'{tag} no suggestions for "stop" ({n})')
    check('Stop & Shop' in pg.locator('#ac0 .acp').inner_text(),f'{tag} first suggestion not Stop & Shop')
    check(pg.locator('#ac0 .acp b').count()>=1,f'{tag} no highlighted match')
    pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(100); check(pg.locator('#ac0.sel').count()==1,f'{tag} keyboard nav')
    ov('suggestions'); shot('add_stop_suggestions')
    pg.locator('#ac0').click(); pg.wait_for_timeout(600)
    check(pg.evaluate("S.c.screen")=='store',f'{tag} store browser not opened')
    check(pg.locator('.stsec').count()>=5,f'{tag} categories missing')
    ov('store'); shot('store_browse')
    pg.locator('[data-item="grocery.produce.0"] .addbtn').click()
    pg.locator('[data-item="grocery.produce.0"] button[aria-label^="Add one more"]').click()
    pg.locator('#stTabs .chip:has-text("Pantry")').click(); pg.wait_for_timeout(700)
    check(pg.evaluate("S.c.store.cat")=='pantry',f'{tag} tab jump')
    pg.fill('#stq','milk'); pg.wait_for_timeout(400)
    check(pg.locator('#stList .irow').count()==3,f'{tag} search milk count {pg.locator("#stList .irow").count()}')
    pg.locator('#stList .irow:has-text("Whole milk") .addbtn').click(); pg.wait_for_timeout(200)
    check(pg.locator('#stList .irow.oos:has-text("Oat milk") .addbtn').count()==0,f'{tag} out-of-stock addable')
    ov('search'); shot('store_search')
    pg.fill('#stq','birthday candles'); pg.wait_for_timeout(400); check('no results' in pg.inner_text('#stList').lower(),f'{tag} no-results state')
    pg.fill('#cuP','3.50'); pg.click('[aria-label="Add item not listed"]'); pg.wait_for_timeout(200)
    pg.fill('#stq',''); pg.wait_for_timeout(300)
    exp=1.89*2+4.49+3.50
    sub=pg.evaluate("ST.sum().sub"); check(abs(sub-exp)<.001,f'{tag} subtotal {sub} != {exp}')
    check(pg.locator('#viewCart').inner_text().count('4')>=1,f'{tag} cart count')
    pg.click('#viewCart'); pg.wait_for_timeout(500); ov('cart'); shot('store_cart')
    q=pg.evaluate("(()=>{const q=ST.tripQuote();return {cap:q.cap,total:q.total,fee:q.f.service,goods:q.goods}})()")
    g0=pg.evaluate("quote().goods")
    check(abs(q['goods']-(g0+exp))<.001,f'{tag} goods not fed to quote')
    import math
    check(abs(q['cap']-math.ceil(q['goods']*1.2/5)*5)<.001,f'{tag} cap != goods+20% rounded')
    pg.click('#cartDone'); pg.wait_for_timeout(500)
    check(pg.evaluate("S.c.screen")=='stops',f'{tag} commit did not return to trip')
    after=pg.evaluate("(()=>{const q=quote();return {total:q.total,goods:q.goods,n:S.stops.length}})()")
    check(abs(after['total']-q['total'])<.001,f'{tag} upfront price {after["total"]} != cart preview {q["total"]}')
    last=pg.evaluate("S.stops[S.stops.length-1]"); check(last['type']=='Groceries' and len(last['items'])==3,f'{tag} stop items {last["items"]}')
    shot('trip_with_store')
    # edit the store stop again: cart restores
    pg.evaluate("ST.edit(S.stops[S.stops.length-1].id)"); pg.wait_for_timeout(500)
    check(abs(pg.evaluate("ST.sum().sub")-exp)<.001,f'{tag} edit restore')
    pg.evaluate("C.go('stops')"); pg.wait_for_timeout(300)
    # personal address via free text + suggestion
    pg.click('.addsearch'); pg.wait_for_timeout(300); pg.keyboard.type('12 elm',delay=40); pg.wait_for_timeout(500)
    pg.locator('#acList .cell.ac:has-text("Grandma"), #acList .cell.ac:has-text("12 Elm")').first.click(); pg.wait_for_timeout(400)
    check(pg.evaluate("S.c.screen")=='place',f'{tag} address did not open stop details')
    pg.click('.seg button:has-text("Drop off")'); pg.fill('#plWhat','<img src=x onerror=alert(1)> casserole'); shot('add_personal_stop')
    pg.click('text=Add stop'); pg.wait_for_timeout(300)
    check(pg.locator('img[src=x]').count()==0,f'{tag} HTML injection rendered')
    check(pg.evaluate("S.stops[S.stops.length-1].type")=='Drop-off',f'{tag} personal type')
    pg.click('.addsearch'); pg.wait_for_timeout(300); pg.keyboard.type('77 Nowhere Lane',delay=20); pg.wait_for_timeout(500)
    check('Use “77 Nowhere Lane”' in pg.inner_text('#acList'),f'{tag} free text row'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    check(pg.evaluate("S.c.place && S.c.place.pl.approx")==True,f'{tag} free text place')
    b.close()
for scheme,tag in [('light','iphone'),('dark','dark')]: run(390,844,scheme,tag,True)
for w in [320,375,430]:
  for scheme in ['light','dark']: run(w,844,scheme,f'w{w}_{scheme}',False)
run(1440,900,'light','desktop',True,False)
# stubbed Google Places path (no real key available)
STUB="""window.__calls={s:0,f:0};window.google={maps:{places:{AutocompleteSessionToken:function(){this.t=1},
AutocompleteSuggestion:{fetchAutocompleteSuggestions:async(r)=>{__calls.s++;__calls.req=r;return{suggestions:[{placePrediction:{placeId:'ChIJx',types:['grocery_store','store'],distanceMeters:1609,
 mainText:{text:'Stop & Shop',matches:[{startOffset:0,endOffset:4}]},secondaryText:{text:'Cutter Mill Rd, Great Neck, NY, USA',matches:[]},text:{text:'Stop & Shop'},
 toPlace(){return{id:'ChIJx',displayName:'Stop & Shop',formattedAddress:'65 Cutter Mill Rd, Great Neck, NY 11021, USA',types:['grocery_store'],location:{lat:()=>40.78,lng:()=>-73.73},fetchFields:async(o)=>{__calls.f++;__calls.fields=o.fields}}}}}]}}}}}};"""
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg=b.new_page(viewport={'width':390,'height':844})
  pg.on('pageerror',lambda e: errs.append('stub page: '+str(e)))
  pg.add_init_script(STUB); pg.goto(URL); pg.wait_for_timeout(400)
  check(pg.evaluate("Places.mode")=='google','stub: not google mode')
  pg.click('.where'); pg.keyboard.type('stop',delay=30); pg.wait_for_timeout(600)
  calls=pg.evaluate("__calls"); check(calls['s']==1,f'stub: debounce/min-chars broken, calls={calls["s"]}')
  check(calls['req']['locationBias']['center']['lat']>40.7 and calls['req']['sessionToken'],'stub: no bias/session token')
  check('powered by Google' in pg.inner_text('#acList'),'stub: attribution missing')
  pg.locator('#ac0').click(); pg.wait_for_timeout(500)
  calls=pg.evaluate("__calls"); check(calls['f']==1 and sorted(calls['fields'])==sorted(['displayName','formattedAddress','location','types']),f'stub: field mask {calls}')
  check(pg.evaluate("S.c.screen")=='store','stub: store not opened from google result')
  pg.evaluate("C.go('stops')"); pg.click('.addsearch'); pg.keyboard.type('stop',delay=30); pg.wait_for_timeout(600)
  check(pg.evaluate("__calls.s")==1,'stub: cache miss on repeated query')
  b.close()
print('ERRORS:', errs or 'none'); print('FAILS:', fails or 'none')
