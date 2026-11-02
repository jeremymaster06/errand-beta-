"""WebKit + iPhone 15: every screen of the customer, runner and owner apps is checked for dead controls.
A control is dead when it has no action that resolves, no click handler on it or a parent, or when a div is used
where iOS needs a real button. Also: manifest and service worker scope per app, 0 console errors, 0 CSP."""
import re, sys, os, json
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from authseed import SEED
ROOT='http://localhost:8776/errand-beta-/'; BASE='/workspace/errand-tiles/'
CFG=re.sub(r"(MAPS_API_KEY\s*=\s*)(['\"]).*?\2",r"\1''",open(BASE+'js/config.js').read())
APPS={a: open(f'{BASE}{a}/index.html').read().replace('; upgrade-insecure-requests','') for a in ['customer','runner','owner']}
fails=[]; errs=[]; n=[0]; seen=[]
def check(c,m):
  n[0]+=1
  if not c: fails.append(m)
MARK="(()=>{const o=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(t,f,x){if(t==='click'&&this.nodeType===1)this.__clk=1;return o.call(this,t,f,x)}})()"
SWEEP="""()=>{const bad=[];let k=0;const native=['BUTTON','A','LABEL','SUMMARY','INPUT','SELECT','TEXTAREA'];
 const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'};
 const ok=n=>{const[a,b]=String(n).split('.');const R=ACTION_ROOTS();return b?!!(R[a]&&typeof R[a][b]==='function'):typeof ACTION_FNS()[a]==='function'};
 const handled=e=>{for(let x=e;x&&x!==document.body;x=x.parentElement)if(x.__clk||x.onclick||x.dataset.act)return true;return false};
 for(const e of document.querySelectorAll('button,[data-act],.tap,[role=button],[role=option],summary,a[href],[data-change]')){if(!vis(e)||e.disabled)continue;k++;
  const id=e.id||e.className||e.tagName;
  if(e.dataset.act){if(!native.includes(e.tagName))bad.push(id+': div with action');if(!ok(e.dataset.act))bad.push(id+': action '+e.dataset.act+' missing')}
  else if(e.dataset.change){if(!ok(e.dataset.change))bad.push(id+': change '+e.dataset.change+' missing')}
  else if(e.tagName==='A'||e.tagName==='SUMMARY'||(e.tagName==='BUTTON'&&e.type==='submit'&&e.form)){}
  else if(!handled(e)&&!e.closest('label,summary'))bad.push(id+': no handler')}
 return {k,bad:bad.slice(0,8)}}"""
def ctx(b,p):
  c=b.new_context(**p.devices['iPhone 15']); c.add_init_script(SEED); c.add_init_script(MARK)
  c.add_init_script("document.addEventListener('securitypolicyviolation',e=>console.error('CSP '+e.violatedDirective))")
  c.route('**/js/config.js*',lambda r: r.fulfill(content_type='text/javascript',body=CFG))
  for a,H in APPS.items(): c.route(ROOT+a+'/',(lambda H: lambda r: r.fulfill(content_type='text/html',body=H))(H))
  return c
def page(c,a):
  pg=c.new_page(); pg.on('console',lambda m: m.type=='error' and errs.append(a+' console: '+m.text)); pg.on('pageerror',lambda e: errs.append(f'{a} page: {e}'))
  pg.goto(ROOT+a+'/'); pg.wait_for_timeout(900); return pg
W=lambda pg,ms=450: pg.wait_for_timeout(ms)
def sweep(pg,tag,js=None,ms=500):
  if js: pg.evaluate(js); W(pg,ms)
  r=pg.evaluate(SWEEP); seen.append((tag,r['k'])); check(r['k']>0,tag+': no controls found'); check(not r['bad'],tag+': '+str(r['bad']))
RUN="S.runners={'test-runner':{id:'test-runner',name:'Test runner',pricing:'own',rates:{base:22,extraStop:6,bigShop:null,asap:8,lineHourly:30,lineMin:1},area:'gnp',online:true,sub:{tier:'starter',status:'active',since:Date.now(),day:1,consent:{}},rating:[9,2],jobs:2,jobLog:[],earn:[]}};S.prefs.home={addr:'25 Grace Ave, Great Neck',lat:40.7887,lng:-73.7280};Store.save();"
with sync_playwright() as p:
  b=p.webkit.launch(); c=ctx(b,p); ru=page(c,'runner'); cu=page(c,'customer'); ow=page(c,'owner')
  for a,pg in (('customer',cu),('runner',ru),('owner',ow)):
    m=pg.evaluate("document.querySelector('link[rel=manifest]')&&document.querySelector('link[rel=manifest]').getAttribute('href')")
    check(bool(m),a+' has a manifest link')
    if m:
      mf=json.load(open(os.path.normpath(os.path.join(BASE,a,m.split('?')[0]))))
      check(mf.get('start_url') and mf.get('display')=='standalone' and mf.get('name'),a+' manifest start_url, name, standalone')
    reg=pg.evaluate("navigator.serviceWorker?navigator.serviceWorker.getRegistration().then(r=>r?r.scope:null):null")
    check(reg is None or reg.startswith(ROOT),a+' service worker scope inside the app: '+str(reg))
  # customer, empty
  sweep(cu,'c home empty'); sweep(cu,'c activity empty',"C.tab('activity')"); sweep(cu,'c account',"C.tab('account')")
  sweep(cu,'c notifications',"C.go('notes')"); sweep(cu,'c help',"C.go('help')")
  sweep(cu,'c line',"C.go('home');LN.open()"); sweep(cu,'c add stop',"C.go('home');C.start()",700)
  sweep(cu,'c add payment',"C.go('addPayment')")
  # with a runner
  cu.evaluate(RUN); ru.reload(); cu.reload(); W(cu,900); W(ru,300)
  sweep(ru,'r jobs available'); sweep(ru,'r earnings',"RN.tab('earn')"); sweep(ru,'r account',"RN.tab('acct')")
  sweep(ru,'r pricing',"RN.sc('rates')"); sweep(ru,'r plan',"RN.sc('plan')"); sweep(ru,'r plan picked',"S.runners['test-runner'].sub=null;Store.save();RN.sc('plan');document.getElementById('tier-pro').click()"); sweep(ru,'r plan consent checked',"document.querySelector('label[for=subConsent]').click()"); ru.evaluate("S.r.plan=null;"+RUN+"R()"); sweep(ru,'r pro earnings',"const r=S.runners['test-runner'];r.sub={tier:'pro',status:'active',since:Date.now()-30*864e5,consent:{}};r.since=r.sub.since;RN.sc('');RN.tab('earn')"); sweep(ru,'r over limit',"const r=S.runners['test-runner'];r.sub={tier:'starter',status:'active',since:Date.now()-60*864e5,consent:{}};r.trialFrom=r.sub.since;r.jobLog=Array.from({length:30},(_,i)=>r.trialFrom+i).concat(Array.from({length:16},(_,i)=>Date.now()-i*1000));RN.sc('plan')"); ru.evaluate("S.r.plan=null;"+RUN+"R()"); ru.evaluate("S.r.plan=null;"+RUN+"R()"); sweep(ru,'r notifications',"RN.sc('notes')"); ru.evaluate("RN.sc('');RN.tab('drive')")
  sweep(cu,'c stops',"S.stops=[mkStop('Groceries','stopshop',{items:[{n:'Milk',p:4,q:1}]}),mkStop('Pharmacy','cvs')];C.go('stops')",700)
  sweep(cu,'c review',"C.go('review')",800); sweep(cu,'c review picked',"C.pick('test-runner')",500)
  cu.evaluate("C.useTestMethod()"); W(cu); cu.locator('label[for=ckConsent]').tap(); W(cu,300); cu.locator('#payBtn').tap(); W(cu,900)
  check(cu.evaluate("S.trip&&S.trip.status")=='matching','order requested')
  sweep(cu,'c tracking waiting'); W(ru,500); sweep(ru,'r offer')
  ru.locator('#acceptTrip').tap(); W(ru,700); W(cu,300); check(cu.evaluate("S.trip.status")=='accepted','runner accepted')
  sweep(ru,'r active job'); sweep(cu,'c tracking accepted',"R()")
  sweep(cu,'c chat',"C.go('chat')"); cu.evaluate("C.go('tracking')"); W(cu)
  sweep(ru,'r chat',"RN.sc('chat')"); ru.evaluate("RN.sc('')"); W(ru)
  ru.evaluate("S.trip.status='delivered';S.trip.deliveredAt=Date.now();Store.save();R()"); W(ru); cu.reload(); W(cu,900)
  sweep(cu,'c rate',"C.go('rate')")
  sweep(cu,'c home after',"C.go('home')"); sweep(cu,'c activity',"C.tab('activity')")
  # line sitting
  sweep(cu,'c line with runner',"C.tab('home');LN.open()",700)
  # tiles
  if cu.evaluate("typeof TL!=='undefined'"): [sweep(cu,'c tile '+k,"C.go('home');TL.open('%s')"%k,700) for k in ['post','cleaning','grocery','weekly']]
  # owner
  ow.reload(); W(ow,900)
  for t in ['overview','subs','runners','support']: sweep(ow,'o '+t,"OW.tab('%s')"%t)
  b.close()
fails+=errs
print('screens swept:',len(seen),'controls checked:',sum(k for _,k in seen))
print(f'{n[0]-len([f for f in fails if f not in errs])}/{n[0]} checks passed'); [print('FAIL',f) for f in fails]
sys.exit(1 if fails else 0)
