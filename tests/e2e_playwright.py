import sys, asyncio
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from authseed import SEED
OUT='/workspace/errand-tiles/screens/'
errs=[]
def run(w,h,mobile,tag):
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
    c=b.new_context(color_scheme='dark' if tag=='dark' else 'light',viewport={'width':w,'height':h},device_scale_factor=2 if mobile else 1,is_mobile=mobile,has_touch=mobile); c.add_init_script(SEED)
    pg=c.new_page()
    pg.on('console',lambda m: m.type=='error' and errs.append(tag+' console: '+m.text))
    pg.on('pageerror',lambda e: errs.append(tag+' page: '+str(e)))
    pg.route('**/js/config.js*',lambda r: r.fulfill(content_type='text/javascript',body=__import__('re').sub(r"(MAPS_API_KEY\s*=\s*)(['\"]).*?\2",r"\1''",open('/workspace/errand-tiles/js/config.js').read())));pg.goto('http://localhost:8775/customer/index.html'); pg.wait_for_timeout(600)
    def shot(n): pg.wait_for_timeout(500); pg.screenshot(path=OUT+tag+'_'+n+'.png')
    ev=lambda js: (pg.evaluate(js), pg.wait_for_timeout(350))
    shot('01_customer_home')
    def chk(c,m):
      if not c: errs.append(tag+' FAIL: '+m)
    chk(pg.evaluate("S.stops.length")==0 and pg.locator('#tileErrands').count()==1 and pg.locator('#tileLine').count()==1,'clean start / tiles')
    ev("C.go('stops')"); shot('02_trip_empty'); chk('No stops yet' in pg.inner_text('#screen'),'empty trip')
    for t in ['activity','favorites','account']:
      ev(f"C.tab('{t}')"); shot('08_'+t); chk(pg.locator('#screen .estate').count()>=1 or t=='account','empty '+t)
    ev("C.tab('home')"); ev("LN.open()"); shot('20_line_book')
    pg.goto('http://localhost:8775/runner/index.html'); pg.wait_for_timeout(700); shot('09_runner_offline'); ev("RN.online()"); shot('10_runner_online_empty'); chk('No requests right now' in pg.inner_text('#screen'),'runner empty')
    ev("RN.tab('earn')"); shot('11b_runner_earnings'); chk('Clocked in since' in pg.inner_text('#screen') and '$0.00' in pg.inner_text('#screen'),'timesheet clean start')
    pg.goto('http://localhost:8775/owner/index.html'); pg.wait_for_timeout(700); shot('12_owner_overview'); chk('$4,812' not in pg.inner_text('#desk'),'owner demo numbers')
    for t in ['pricing','promos','jobs','runners','support']:
      ev(f"OW.tab('{t}')"); shot('13_owner_'+t)
    # real click on a few controls
    pg.goto('http://localhost:8775/customer/index.html'); pg.wait_for_timeout(700); ev("C.tab('home')")
    g=pg.locator('.sheet .grabber').bounding_box(); pg.mouse.move(g['x']+g['width']/2,g['y']+5); pg.mouse.down(); pg.mouse.move(g['x']+g['width']/2,g['y']-250,steps=8); pg.mouse.up(); pg.wait_for_timeout(500); shot('14_sheet_dragged_large')
    pg.click('#tileErrands'); pg.wait_for_timeout(400)
    pg.fill('#acq','stop'); pg.wait_for_timeout(500); assert pg.locator('#acList [role=option]').count()>0
    b.close()
run(390,844,True,'iphone')
run(1440,900,False,'desktop')
run(390,844,True,'dark')
print('\n'.join(errs) or 'NO ERRORS')
