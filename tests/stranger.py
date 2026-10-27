# Stranger test: a first-time user builds a 3-stop trip (store + store + personal pickup) and confirms.
# Counts taps, and interactive elements / words on each screen. Usage: stranger.py before|after
import sys, json
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from authseed import SEED
TAG=sys.argv[1]; ADD='.addsearch' if TAG=='before' else '.addstop'; FINAL='Confirm' if TAG=='before' else 'Pay'; OUT='/workspace/errand-tiles/screens/'
COUNT="""()=>{const v=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'};
const root=document.querySelector('#screen');const ctl=[...root.querySelectorAll('button,input,select,a,[onclick],[role=button],[role=tab],[role=switch]')].filter(v);
return {controls:ctl.length, words:(root.innerText||'').split(/\\s+/).filter(Boolean).length}}"""
log=[]; taps=0
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
  c=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,color_scheme='light'); c.add_init_script(SEED)
  pg=c.new_page(); errs=[]
  pg.route('**/js/config.js*', lambda rt: rt.fulfill(body=open('/workspace/errand-tiles/js/config.js').read().replace(open('/workspace/errand-tiles/js/config.js').read().split("MAPS_API_KEY = '")[1].split("'")[0],''), content_type='application/javascript'))
  pg.on('console',lambda m: m.type=='error' and errs.append(m.text[:200])); pg.on('pageerror',lambda e: errs.append(str(e)))
  pg.goto('http://localhost:8775/customer/index.html'); pg.wait_for_timeout(600)
  pg.evaluate("S.stops=[];S.c.screen='home';R()"); pg.wait_for_timeout(300)
  def snap(name):
    pg.wait_for_timeout(450); m=pg.evaluate(COUNT); m['screen']=name; log.append(m); pg.screenshot(path=f'{OUT}{TAG}_{name}.png')
  def tap(sel):
    global taps; taps+=1; pg.locator(sel).first.click(); pg.wait_for_timeout(500)
  def typ(t): pg.locator('#acq').press_sequentially(t,delay=40); pg.wait_for_timeout(600)
  snap('1_home')
  tap('#tileErrands'); snap('2_where')
  typ('stop & shop'); snap('3_suggestions'); tap('#ac0'); snap('4_store')
  tap('.irow .addbtn'); tap('.irow .addbtn'); snap('5_store_items')
  tap('#cartBar .btn'); snap('6_cart'); tap('#cartSheet .btn:has-text("trip")'); snap('7_trip_1stop')
  tap(ADD); typ('cvs'); tap('#ac0'); tap('.irow .addbtn'); tap('#cartBar .btn'); tap('#cartSheet .btn:has-text("trip")')
  tap(ADD); typ('12 elm'); tap('#ac0'); snap('8_personal')
  pg.locator('#plWhat').fill('Blue casserole dish'); tap('#plBody .btn:has-text("Add")'); snap('9_trip_3stops')
  NEXT=['Review','Choose options','Continue'] if TAG=='before' else ['Review']
  for i,t in enumerate(NEXT):
    tap(f'#screen .btn:has-text("{t}")'); snap(f'{10+i}_'+t.split()[0].lower())
  if TAG!='before': tap('#payBtn'); tap('#useTestMethod')
  tap(f'#screen .btn:has-text("{FINAL}")'); snap('99_confirmed')
  if TAG!='before':
    pg.wait_for_timeout(2600); snap('99b_tracking')
  b.close()
print(json.dumps({'taps':taps,'errors':errs,'screens':log}))
