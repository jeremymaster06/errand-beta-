import sys, asyncio
from playwright.sync_api import sync_playwright
OUT='/workspace/errand-redesign/screens/'
errs=[]
def run(w,h,mobile,tag):
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome')
    c=b.new_context(color_scheme='dark' if tag=='dark' else 'light',viewport={'width':w,'height':h},device_scale_factor=2 if mobile else 1,is_mobile=mobile,has_touch=mobile)
    pg=c.new_page()
    pg.on('console',lambda m: m.type=='error' and errs.append(tag+' console: '+m.text))
    pg.on('pageerror',lambda e: errs.append(tag+' page: '+str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(600)
    def shot(n): pg.wait_for_timeout(500); pg.screenshot(path=OUT+tag+'_'+n+'.png')
    ev=lambda js: (pg.evaluate(js), pg.wait_for_timeout(350))
    shot('01_customer_home')
    ev("C.go('stops')"); shot('02_stops_upsells')
    ev("document.querySelector('[data-sheet=stops] .sh-body').scrollTop=900"); shot('02b_stops_upsells_more')
    ev("C.toggle(S.stops[0].id)"); shot('02c_stop_edit'); ev("C.toggle(S.stops[0].id)")
    ev("C.go('route')"); shot('03_optimized_route')
    ev("C.go('options')"); ev("C.fav('priya')"); shot('04_options')
    ev("C.go('price')"); shot('05_upfront_price'); ev("C.weekly()"); ev("document.querySelector('[data-sheet=price] .sh-body').scrollTop=2000"); shot('05b_price_repeat_weekly')
    ev("C.confirm()"); shot('06_matching')
    pg.wait_for_timeout(2700); ev("C.step()"); ev("C.step()"); shot('07_tracking')
    ev("C.go('chat')"); shot('07b_chat'); ev("C.go('tracking')")
    for i in range(3): ev("C.step()")
    ev("C.go('rate')"); ev("C.rate(5)"); ev("C.tipSet(5)"); ev("C.star(S.trip.runner)"); shot('08_rate_tip_favorite'); ev("document.querySelector('.page').scrollTop=2000"); shot('08f_rate_receipt_tip')
    ev("C.finish()"); ev("C.tab('favorites')"); shot('08b_favorites')
    ev("C.tab('activity')"); shot('08c_activity'); ev("C.tab('account')"); shot('08d_account'); ev("document.querySelector('.page').scrollTop=820"); shot('08e_account_referral')
    ev("setView('r')"); shot('09_runner_offline')
    ev("RN.online()"); shot('10_runner_pro_offer')
    ev("RN.accept()"); ev("RN.next()"); ev("RN.next()"); shot('11_runner_route_carrying')
    ev("RN.tab('earn')"); shot('11b_runner_earnings_pro_progress')
    ev("RN.me('luis')"); ev("RN.tab('earn')"); shot('11c_runner_std_pro_progress')
    ev("setView('o')"); shot('12_owner_overview')
    for t in ['tiers','pricing','revenue','jobs','runners','support','comp']:
      ev(f"OW.tab('{t}')"); shot('13_owner_'+t)
    # real click on a few controls
    ev("setView('c')"); ev("C.tab('home')")
    g=pg.locator('.sheet .grabber').bounding_box(); pg.mouse.move(g['x']+g['width']/2,g['y']+5); pg.mouse.down(); pg.mouse.move(g['x']+g['width']/2,g['y']-250,steps=8); pg.mouse.up(); pg.wait_for_timeout(500); shot('14_sheet_dragged_large')
    pg.click('.where'); pg.wait_for_timeout(400)
    pg.fill('#acq','stop'); pg.wait_for_timeout(500); assert pg.locator('#acList [role=option]').count()>0
    b.close()
run(390,844,True,'iphone')
run(1440,900,False,'desktop')
run(390,844,True,'dark')
print('\n'.join(errs) or 'NO ERRORS')
