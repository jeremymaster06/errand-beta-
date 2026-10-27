# Existing flow suites test the apps behind sign-in: seed one signed-in test account per app, once per browser
# context (a later sign-out sticks). The auth flow itself is covered by e2e_auth_iphone.py.
SEED = """(()=>{try{if(localStorage.getItem('errand.auth.seeded'))return;localStorage.setItem('errand.auth.seeded','1');
const acks=[{doc:'pay',version:'test',at:'2026-10-25T00:00:00Z'},{doc:'gps',version:'test',at:'2026-10-25T00:00:00Z'}];
for(const a of ['customer','runner']){localStorage.setItem('errand.auth.'+a,JSON.stringify({accounts:[{id:'test-'+a,name:'Test '+a,contact:'test@example.com',createdAt:'2026-10-25T00:00:00Z',acks:a==='runner'?acks:[]}]}));localStorage.setItem('errand.session.'+a,JSON.stringify({id:'test-'+a}));}
localStorage.setItem('errand.session.owner',JSON.stringify({id:'demo-owner'}));}catch(e){}})()"""
