const MOCK=`(function(){const store={};const subs=[];const snap=(p)=>({id:p.split('/').pop(),exists:p in store,data:()=>store[p]?JSON.parse(JSON.stringify(store[p])):undefined});
const notify=()=>subs.forEach(([c,f])=>f(qs(c)));
const qs=c=>{const docs=Object.keys(store).filter(p=>p.startsWith(c+'/')&&p.split('/').length===c.split('/').length+1).map(snap);return{docs,size:docs.length,empty:!docs.length}};
const doc=p=>({get:async()=>snap(p),set:async v=>{store[p]=JSON.parse(JSON.stringify(v));notify()}});
window.__MOCK_STORE=store;
window.MRQ_DB={doc,collection:c=>({get:async()=>qs(c),onSnapshot:(f,e)=>{subs.push([c,f]);setTimeout(()=>f(qs(c)),0);return()=>{}},doc:id=>doc(c+'/'+id)})};})();`;
// 스모크 테스트: 가상 브라우저(jsdom)에서 학생 흐름, 게임 7종, 교사 기록장을 실제로 실행해요.
// 실행: npm test   (저장소 연결 경로까지 보려면 MOCK_DB=1 npm test)
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
let html=read('index.html')
  .replace(/<link[^>]+fonts\.g[^>]*>/g,'')
  .replace('<link rel="stylesheet" href="css/style.css">',()=>'<style>'+read('css/style.css')+'</style>')
  .replace('<script src="js/storage-config.js"></script>',()=>'<script>'+(process.env.MOCK_DB?MOCK:read('js/storage-config.js'))+'</script>')
  .replace('<script src="js/app.js"></script>',()=>'<script>'+read('js/app.js')+'</script>');
const errors=[];
const vc=new VirtualConsole();
vc.on('jsdomError',e=>errors.push('jsdomError: '+(e.stack||e.message)));
vc.on('error',e=>errors.push('console.error: '+e));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.test/',virtualConsole:vc,
  beforeParse(w){
    const noop=()=>{};const ctx=new Proxy({},{get:(t,k)=>k in t?t[k]:(k==='measureText'?()=>({width:10}):noop),set:(t,k,v)=>{t[k]=v;return true}});
    w.HTMLCanvasElement.prototype.getContext=function(){return ctx};
    w.HTMLCanvasElement.prototype.toDataURL=()=>'data:image/png;base64,';
    w.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({left:0,top:0,width:576,height:432,right:576,bottom:432});
    w.scrollTo=noop;w.matchMedia=(()=>({matches:false,addListener:noop,removeListener:noop}));
    w.speechSynthesis={speak:noop,cancel:noop,getVoices:()=>[]};w.SpeechSynthesisUtterance=function(t){this.text=t};
    w.addEventListener('error',e=>errors.push('window.error: '+e.message));
  }});
const w=dom.window,d=w.document;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const $=s=>d.querySelector(s);
const click=el=>{if(!el)throw new Error('missing element');el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}))};
const btnByText=(t,root=d)=>[...root.querySelectorAll('button')].find(b=>b.textContent.includes(t)&&!b.closest('[hidden]'));
const visible=id=>!d.getElementById(id).hidden;
const key=k=>d.dispatchEvent(new w.KeyboardEvent('keydown',{key:k,bubbles:true}));
const tapCanvas=(x,y)=>$('#gameCv').dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true,clientX:x*3,clientY:y*3}));
const ovBtn=()=>[...d.querySelectorAll('#ov .row button')][0];
const log=m=>console.log('·',m);
async function pressOv(n=1){for(let i=0;i<n;i++){if(!$('#ov').hidden&&ovBtn())click(ovBtn());await sleep(30)}}
async function doStep(){for(let i=0;i<16;i++){if(!visible('scr-step'))return;if($('#btnNextPhase')){click($('#btnNextPhase'));await sleep(50);return}
  if($('#fbNext')){click($('#fbNext'));await sleep(20);continue}key('1');key('Enter');await sleep(20)}}
(async()=>{
  await sleep(200);
  click($('#btnStart'));await sleep(50);
  click(d.querySelector('#numGrid button'));await sleep(3300);
  log('units visible '+visible('scr-units')+' hello="'+$('#hello').textContent+'"');
  for(const u of ['mul','add','sub']){
    const cards=[...d.querySelectorAll('#unitCards .ucard')];const card=cards.find(c=>c.querySelector('.tag').textContent===u.toUpperCase());
    click(btnByText('시작하기',card)||btnByText('처음부터',card));await sleep(50);
    await doStep();await doStep();await doStep();
    log(u+' picker visible '+visible('scr-pick'));
    const n=d.querySelectorAll('#pickCards .ucard').length;
    for(let gi=0;gi<n;gi++){
      if(!visible('scr-pick')){click($('#btnSwitch'));await sleep(60)}
      const gc=d.querySelectorAll('#pickCards .ucard')[gi];const name=gc.querySelector('h3').textContent;
      click(gc.querySelector('button'));await sleep(60);
      if(visible('scr-dlobby')){click($('#btnDunGo'));await sleep(60)}
      await pressOv();await sleep(400);
      for(let r=0;r<40;r++){
        if(!$('#ov').hidden){await pressOv();continue}
        ['3','2','Enter','ArrowLeft','ArrowUp','ArrowRight','ArrowDown',' '].forEach(key);
        tapCanvas(R(0,191),R(60,130));
        const pc=$('#board').hidden?[]:[...d.querySelectorAll('#board .pcard')].filter(b=>!b.disabled);if(pc.length)click(pc[r%pc.length]);
        await sleep(120)}
      log(`${u}/${name}: G-banner="${$('#banner').textContent.replace(/\s+/g,' ').slice(0,40)}" ran, hud="${$('#hud').textContent.replace(/\s+/g,' ').slice(0,60)}"`);
      click($('#btnSwitch'));await sleep(80);
    }
    click($('#btnQuit'));await sleep(80);
  }
  // dungeon lobby + training + pet detail
  const mc=[...d.querySelectorAll('#unitCards .ucard')].find(c=>c.querySelector('.tag').textContent==='MUL');click(btnByText('이어하기',mc));await sleep(80);
  if(visible('scr-game')){click($('#btnSwitch'));await sleep(60);click(d.querySelector('#pickCards .ucard button'));await sleep(60)}
  log('lobby '+visible('scr-dlobby')+' tiles='+d.querySelectorAll('.ftile').length+' pets='+d.querySelectorAll('.pet').length);
  click(d.querySelectorAll('.pet')[0]);await sleep(30);if($('#btnTrain')){click($('#btnTrain'));await sleep(60);await pressOv();await sleep(300);log('train mode game '+visible('scr-game'))}
  click($('#btnQuit'));await sleep(60);click($('#btnQuit'));await sleep(60);
  // teacher
  log('screen before teacher: '+[...d.querySelectorAll('.screen')].filter(x=>!x.hidden).map(x=>x.id));click($('#btnTeacher'));await sleep(30);['2','1','0','6'].forEach(k=>click([...d.querySelectorAll("#kpLogin .key")].find(b=>b.textContent===k)));await sleep(300);
  log('dash '+visible('scr-dash'));
  for(const t of ['class','student','mulmap','set']){click(d.querySelector(`#tabs [data-tab="${t}"]`));await sleep(40);log('tab '+t+' len='+$('#dashBody').innerHTML.length)}

  // settings with focus
  $('#setFAdd').value='a6';$('#setFSub').value='sm';d.querySelector('#setFMul input[value="7"]').checked=true;$('#setGoal').value='10';click($('#btnSaveSet'));await sleep(100);log('setMsg='+$('#setMsg').textContent);
  click(d.querySelector('#tabs [data-tab="student"]'));await sleep(30);log('sidebar buttons='+d.querySelectorAll('[data-stu]').length+' three='+!!d.querySelector('.dgrid2.three'));
  click($('#btnLogout'));await sleep(30);click($('#btnStart'));await sleep(30);click(d.querySelector('#numGrid button'));await sleep(3300);
  log('mission="'+$('#mission').textContent.replace(/\s+/g,' ').slice(0,90)+'"');
  log('ftag='+[...d.querySelectorAll('.ftag')].map(x=>x.textContent).join('|'));
  const rb=d.querySelector('.ucard.review button');log('review disabled='+rb.disabled);
  if(!rb.disabled){click(rb);await sleep(50);log('step badge='+$('#stepBadge').textContent);for(let i=0;i<12;i++){if($('#btnNextPhase')){click($('#btnNextPhase'));break}if($('#fbNext')){click($('#fbNext'));await sleep(10);continue}if($('#btnListen'))click($('#btnListen'));key('4');key('Enter');await sleep(10)}await sleep(40);log('after review units='+visible('scr-units'))}
  click($('#btnRead'));log('read btn='+$('#btnRead').textContent);
  click($('#btnMe'));await sleep(40);log('me cards='+d.querySelectorAll('#meGrid .mecard').length);click($('#btnMeBack'));await sleep(30);
  const ac=[...d.querySelectorAll('#unitCards .ucard')].find(c=>c.querySelector('.tag').textContent==='ADD');click(btnByText('처음부터',ac));await sleep(30);
  for(let j=0;j<30;j++){if(visible('scr-pick'))break;if($('#btnNextPhase')){click($('#btnNextPhase'));await sleep(30);continue}if($('#fbNext')){click($('#fbNext'));await sleep(10);continue}key('9');key('Enter');await sleep(10)}
  log('focus step done, picker='+visible('scr-pick'));click(d.querySelector('#pickCards .ucard button'));await sleep(50);await pressOv();await sleep(600);
  const lb=d.querySelector('#banner [data-listen]');if(lb)click(lb);log('race banner='+$('#banner').textContent.replace(/\s+/g,' ').slice(0,40));
  if(globalThis.EXTRA)await globalThis.EXTRA({w,d,$,click,sleep,key,log,visible,btnByText,pressOv});
  if(process.env.MOCK_DB){const st=w.__MOCK_STORE;const ks=Object.keys(st);log('mock db docs='+ks.join(','));if(!ks.some(k=>k.startsWith('students/')))errors.push('저장소에 학생 기록이 저장되지 않음')}
  console.log('ERRORS:',errors.length);errors.slice(0,15).forEach(e=>console.log(e.split('\n').slice(0,4).join('\n')));
  process.exit(errors.length?1:0);
})().catch(e=>{console.log('HARNESS FAIL',e.stack);errors.slice(0,10).forEach(x=>console.log(x.split('\n').slice(0,4).join('\n')));process.exit(1)});
function R(a,b){return a+Math.floor(Math.random()*(b-a+1))}
