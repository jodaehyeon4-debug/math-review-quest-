/* 수학 복습 퀘스트 · 앱 본체 (학생 게임 + 교사 기록장)
   구역 표시는 '===== 이름 =====' 형태의 주석으로 되어 있어요. 구조 설명은 docs/HANDOFF.md 참고. */
(()=>{'use strict';
/* ================= utilities ================= */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const R=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const clone=o=>JSON.parse(JSON.stringify(o));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const LS={get(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},keys(){try{return Object.keys(localStorage)}catch(e){return[]}}};
const swapD=n=>(n>=10&&n<100)?(n%10)*10+Math.floor(n/10):-1;
const RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================= storage ================= */
const Store={db:null,ready:false,cbs:[],
  kind:'local',
  async init(){try{if(window.MRQ_DB){this.db=await window.MRQ_DB;if(this.db)this.kind='custom'}else if(window.claude&&typeof window.claude.use==='function'){this.db=await window.claude.use('db');if(this.db)this.kind='claude'}}catch(e){this.db=null}
    this.ready=true;this.cbs.forEach(f=>f());},
  onReady(f){this.ready?f():this.cbs.push(f)}};
function storeReady(ms){return new Promise(r=>{if(Store.ready)return r();const t=setTimeout(r,ms);Store.onReady(()=>{clearTimeout(t);r()})})}

let CFG=Object.assign({pw:'2106',count:8,roster:{},mulTaught:5,dailyGoal:30,classGoal:150,focus:{add:'',sub:'',mul:[]},updatedAt:0},LS.get('dsm:cfg')||{});
async function loadCfg(){if(!Store.db)return;try{const s=await Store.db.doc('config/class').get();if(s.exists){const d=clone(s.data());if((d.updatedAt||0)>=(CFG.updatedAt||0)){CFG=Object.assign(CFG,d);LS.set('dsm:cfg',CFG)}}}catch(e){}}
async function saveCfg(){CFG.updatedAt=Date.now();LS.set('dsm:cfg',CFG);if(!Store.db)return 'local';try{await Store.db.doc('config/class').set(clone(CFG));return 'ok'}catch(e){return 'fail'}}

const UNITS=['add','sub','mul'];
const UNAME={add:'덧셈',sub:'뺄셈',mul:'곱셈'};
const GNAME={add:'덧셈 레이스',sub:'뺄셈 두더지',mul:'곱셈 던전'};
const sid=no=>'s'+String(no).padStart(2,'0');
function newUnit(){return{phase:0,step:null,game:{},stats:{kn:0,kc:0,kt:0,cn:0,cc:0},skills:{},errs:{},recent:[],sessions:[],daily:{}}}
function newStudent(no){return{id:sid(no),no,updatedAt:Date.now(),units:{add:newUnit(),sub:newUnit(),mul:newUnit()}}}
function normalize(d,no){if(!d||!d.units)return newStudent(no);d=clone(d);for(const u of UNITS)d.units[u]=Object.assign(newUnit(),d.units[u]||{});d.no=no;d.id=sid(no);return d}
async function loadStudent(no){
  await storeReady(3000);
  const id=sid(no);let local=LS.get('dsm:'+id),remote=null;
  if(Store.db){try{const s=await Store.db.doc('students/'+id).get();if(s.exists)remote=clone(s.data())}catch(e){}}
  const d=(remote&&(!local||(remote.updatedAt||0)>=(local.updatedAt||0)))?remote:local;
  return normalize(d,no);
}
let cur=null,dirty=false,saveT=null,chain=Promise.resolve();
function setSave(s){const el=$('#saveState');el.className='save '+s;el.querySelector('b').textContent={ok:'기록장에 저장됨',busy:'저장 중',local:'이 기기에 저장됨',err:'저장 실패'}[s]||''}
function touch(){if(!cur)return;cur.updatedAt=Date.now();LS.set('dsm:'+cur.id,cur);dirty=true;setSave('busy');clearTimeout(saveT);saveT=setTimeout(flush,1500)}
function flush(){clearTimeout(saveT);if(!dirty||!cur)return chain;dirty=false;const snap=clone(cur);
  chain=chain.then(async()=>{if(!Store.db){setSave('local');return}
    const ref=Store.db.doc('students/'+snap.id);
    try{await ref.set(snap);setSave('ok')}catch(e){
      if(e&&e.code==='unavailable'){await new Promise(r=>setTimeout(r,700+Math.random()*900));try{await ref.set(snap);setSave('ok');return}catch(e2){}}
      setSave('local')}});
  return chain}
document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});
window.addEventListener('pagehide',()=>flush());

/* ================= sound ================= */
let AC=null,soundOn=!!LS.get('dsm:sound');
function beep(f,d=.08,type='square',v=.05){if(!soundOn)return;try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.value=f;g.gain.value=v;g.gain.exponentialRampToValueAtTime(.0001,AC.currentTime+d);o.connect(g).connect(AC.destination);o.start();o.stop(AC.currentTime+d)}catch(e){}}
const SFX={ok(){beep(660,.08);setTimeout(()=>beep(990,.12),80)},no(){beep(170,.22,'sawtooth',.04)},hit(){beep(260,.07)},tap(){beep(520,.03,'square',.03)},win(){[523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,.13),i*110))}};
let readOn=!!LS.get('dsm:read');
const jong=n=>{n=Math.abs(n);const d=n%10;if(d)return[1,3,6,7,8].includes(d);return n===0||n%100!==0||n>=100};
function sayText(p){const op={'+':'더하기','−':'빼기','×':'곱하기'}[p.op],pt=v=>jong(v)?'은':'는';
  if(p.fmt==='m')return p.miss==='a'?`네모 ${op} ${p.b}${pt(p.b)} ${p.c}`:`${p.a} ${op} 네모는 ${p.c}`;return`${p.a} ${op} ${p.b}${pt(p.b)}?`}
function speak(t,force){if(!(readOn||force))return;try{const S=window.speechSynthesis;if(!S||!window.SpeechSynthesisUtterance)return;S.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='ko-KR';u.rate=.9;const v=(S.getVoices()||[]).find(x=>/^ko/i.test(x.lang));if(v)u.voice=v;S.speak(u)}catch(e){}}
const speakP=(p,force)=>{if(p)speak(sayText(p),force)};
function renderReadBtn(){$('#btnRead').textContent=readOn?'읽어 주기 끄기':'읽어 주기 켜기'}
$('#btnRead').onclick=()=>{readOn=!readOn;LS.set('dsm:read',readOn);renderReadBtn();if(readOn)speak('문제를 읽어 줄게요',true)};
renderReadBtn();
function renderSoundBtn(){$('#btnSound').textContent=soundOn?'소리 끄기':'소리 켜기'}
$('#btnSound').onclick=()=>{soundOn=!soundOn;LS.set('dsm:sound',soundOn);renderSoundBtn();SFX.tap()};
renderSoundBtn();

/* ================= pixel art ================= */
const PAL={k:'#1d1938',w:'#ffffff',y:'#ffc93c',f:'#ffd9b0',b:'#4f7cff',g:'#58b45a',r:'#ff4f5e',s:'#c9d2e3',p:'#ff9fb8',o:'#ff8a3c',t:'#7a4a2a',n:'#2f7a3a',x:'#8f86b8'};
const SPR={
hero:["...kkkkkk...","..kyyyyyyk..",".kyyyyyyyyk.",".kkkkkkkkkk.",".kffffffffk.",".kfkffffkfk.",".kffffffffk.","..kkfppfkk..",".kbbbbbbbbk.","kfkbbyybbkfk",".k.kbbbbk.k.","...kbkkbk...","..kkk..kkk.."],
slime:["....kkkk....","..kkmmmmkk..",".kmmlmmmmmk.",".kmlmmmmmmk.","kmmwkmmwkmmk","kmmwkmmwkmmk","kmmmmmmmmmmk","kmmmmddmmmmk","kdmmmmmmmmdk",".kkkkkkkkkk."],
bat:["k............k","kk..k....k..kk","kmk.kmkkmk.kmk","kmmkmmmmmmkmmk","kmmmmwkkwmmmmk",".kmmmmmmmmmmk.","..kkmmddmmkk..","....kk..kk...."],
shroom:["....kkkk....","..kkmmmmkk..",".kmmwwmmmmk.","kmmmwwmmwwmk","kmmmmmmmwwmk","kkkkkkkkkkkk","..kllllllk..","..klkllklk..","..kllllllk..","..kllddllk..","...kllllk...","....kkkk...."],
ghost:["....kkkk....","..kkmmmmkk..",".kmmmmmmmmk.",".kmkkmmkkmk.","kmmkwmmkwmmk","kmmmmmmmmmmk","kmmmmddmmmmk","kmmmmmmmmmmk","kmmmmmmmmmmk","kmkmmkkmmkmk","kk.kk..kk.kk"],
golem:["..kkkkkkkk..",".kmmmmmmmmk.",".kmlmmmmmdk.",".kmwkmmwkdk.","kkmmmmmmmdkk","kmkmddddmkmk","kmkmmmmmmkmk","kmkmmmmmmkmk","kkkmmmmmmkkk","..kmmkkmmk..","..kddk.kddk.","..kkkk.kkkk."],
dragon:["..k........k..",".kmk......kmk.",".kmmkkkkkkmmk.","kmmmmmmmmmmmmk","kmmwkmmmmwkmmk","kmmmmmmmmmmmmk","kmmwwwwwwwwmmk",".kmmmmmmmmmmk.","kdkmmllllmmkdk","kddkmllllmkddk",".kk.kmmmmk.kk.","....kk..kk...."],
car:["..kkkkkk..",".kmmmmmmk.","kkmwwwwmkk","kkmwwwwmkk",".kmmmmmmk.",".kmmyymmk.",".kmmyymmk.",".kmmmmmmk.","kkmmmmmmkk","kkmwwwwmkk",".kmmmmmmk.","..kkkkkk.."],
mole:["...kkkkkk...","..kmmmmmmk..",".kmmmmmmmmk.",".kmwkmmwkmk.",".kmmmppmmmk.",".kmlmmmmlmk.","kmmmmwwmmmmk","kmmmmmmmmmmk","kmmmmmmmmmmk","kmmmmmmmmmmk","kmmmmmmmmmmk"],
heart:[".kk.kk.","krrkrrk","krwrrrk","krrrrrk",".krrrk.","..krk..","...k..."],
coin:[".kkkk.","kyyyyk","kywyyk","kyyyyk","kyyyyk",".kkkk."],
star:["...k...","..kyk..","kkkyykk","kyyyyyk",".kyyyk.",".kykyk.","kk...kk"],
tree:["...kkkk...","..knnnnk..",".knggnnnk.","knnngnnnnk","kngnnnngnk",".knnngnnk.","..kkkkkk..","....kt....","....kt....","...kkkk..."],
egg:["...kkkk...","..kwwwwk..",".kwwmwwwk.",".kwwwwwmk.","kwmwwwwwwk","kwwwwmwwwk","kwwwwwwmwk","kwmwwwwwwk",".kwwwmwwk.","..kkkkkk.."],
d0:["...kkkkkk...","..kmmmmmmk..",".kmwkmmwkmk.",".kmmkkkkmmk.","kmmk....kmmk","kmk......kmk","kmk......kmk","kmmk....kmmk",".kmmkkkkmmk.",".kmmmddmmmk.","..kmmmmmmk..","...kkkkkk..."],
d1:["....kkkk....","...kmmmmk...","..kmmmmmmk..","..kmwwwwmk..","..kmwkkwmk..","..kmwwwwmk..","..kmmmmmmk..","..kmmddmmk..","..kmmmmmmk..","..kmmmmmmk..","..kmk..kmk..","..kkk..kkk.."],
d2:[".....kk.....","....kgk.....","...kg.kk....","..kg....k...",".kkkk..kkkk.","kmmmmkkmmmmk","kmwkmkkmwkmk","kmmmmkkmmmmk","kmddmkkmddmk",".kmmk..kmmk.","..kk....kk.."],
d3:[".....kk.....","....kmmk....","....kmmk....","...kmmmmk...","...kmmmmk...","..kmwkwkmk..","..kmmmmmmk..",".kmmmddmmmk.",".kmmmmmmmmk.","kmmmmmmmmmmk","kkkkkkkkkkkk"],
d4:[".kk......kk.","kmmk....kmmk","kmmkkkkkkmmk",".kmmmmmmmmk.",".kmwkmmwkmk.",".kmmmllmmmk.",".kmmlkklmmk.","kmmmmmmmmmmk","kmmmmmmmmmmk","kmmmmmmmmmmk","kdkdk..kdkdk","kkkkk..kkkkk"],
d5:[".....kk.....","....kmmk....","....kmmk....","kkkkkmmkkkkk","kmmmmmmmmmmk",".kmwkmmwkmk.",".kmmmmmmmmk.","..kmmddmmk..","..kmmmmmmk..",".kmmkkkkmmk.",".kmk....kmk.",".kk......kk."],
d6:["..k......k..","...k....k...","...kkkkkk...","..kmmmmmmk..",".kmwkmmwkmk.","kmmmmmmmmmmk","kddddddddddk","kmmmmmmmmmmk","kddddddddddk",".kmmmmmmmmk.","..kmmmmmmk..","...kkkkkk..."],
d7:["......kkkk..",".....kAAAAk.",".....kAwkAk.","......kBBk..","....kkCCk...","...kDDDk....","..kEEk......","..kFFk......","...kGGGk....","....kkGGGk..",".......kkk.."],
d8:["...kkkkkk...","..kmmmmmmk..",".kmmllmmmmk.",".kmwkmmwkmk.",".kmmmmmmmmk.",".kmmmddmmmk.","kmmmmmmmmmmk","m.mm.mm.mm.m","m.mm.mm.mm.m","d.dd.dd.dd.d"],
d9:[".l.l.l.l.l..","..l.l.l.l...",".kmk....kmk.",".kmmkkkkmmk.",".kmmmmmmmmk.",".kmwkmmwkmk.",".kmmmmmmmmk.","..kmmllmmk..","...kmddmk...","....kkkk...."],
frog:[".kkk....kkk.","kwwkk..kkwwk","kwkgkkkkgkwk",".kggggggggk.","kggggggggggk","kgkggggggkgk","kgggkkkkgggk",".kggggggggk.","kgk.kggk.kgk","kk..kkkk..kk"],
torch:[".k.k.",".kok.","kyoyk",".kyk.","..k..",".ktk.",".ktk.",".ktk."],
};
const MPAL={
 slime:[{m:'#5fd38a',d:'#2f9a5a',l:'#b6f5cb'},{m:'#6ab8ff',d:'#3a74c9',l:'#c7e4ff'},{m:'#ff9bc4',d:'#d1588b',l:'#ffd6e8'},{m:'#ffc93c',d:'#c98a12',l:'#fff0b8'}],
 bat:[{m:'#8a6cff',d:'#5a3fc9'},{m:'#4a4370',d:'#2b2650'},{m:'#ff6f59',d:'#b53a28'},{m:'#2fd1c4',d:'#178a80'}],
 shroom:[{m:'#ff5e5e',d:'#a83a3a',l:'#fff1df'},{m:'#ff9f3c',d:'#b5621a',l:'#fff1df'},{m:'#a06cff',d:'#6a3fc9',l:'#efe6ff'},{m:'#3cc7ff',d:'#1a7fb5',l:'#e6f7ff'}],
 ghost:[{m:'#eef0ff',d:'#9aa2d6'},{m:'#c9f5e8',d:'#6cbfa5'},{m:'#ffe0f0',d:'#d58ab0'},{m:'#ffe9a8',d:'#c9a440'}],
 golem:[{m:'#9b95b8',d:'#5d5878',l:'#cdc8e3'},{m:'#b88d6a',d:'#7a5639',l:'#e3c7ad'},{m:'#6e9b8a',d:'#3f6356',l:'#a9d1c2'},{m:'#c95b4a',d:'#7d2f23',l:'#f0a597'}],
 dragon:[{m:'#4fbf6a',d:'#2a7a3c',l:'#c9f0b0'},{m:'#4f7cff',d:'#2a47b0',l:'#c7d6ff'},{m:'#ffb13c',d:'#b5701a',l:'#fff0b8'},{m:'#e0425a',d:'#8f1f30',l:'#ffc0c8'}],
};
const sprCache=new Map();
function sprite(name,pal){const key=name+'|'+(pal?JSON.stringify(pal):'');if(sprCache.has(key))return sprCache.get(key);
  const rows=SPR[name],h=rows.length,w=rows[0].length,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){const ch=rows[j][i];if(!ch||ch==='.')continue;x.fillStyle=(pal&&(pal[ch]||pal['*']))||PAL[ch]||'#f0f';x.fillRect(i,j,1,1)}
  sprCache.set(key,c);return c}
function drawSpr(ctx,name,x,y,s=1,pal,flip){const c=sprite(name,pal);ctx.save();ctx.imageSmoothingEnabled=false;
  if(flip){ctx.translate(Math.round(x)+c.width*s,Math.round(y));ctx.scale(-1,1);ctx.drawImage(c,0,0,c.width*s,c.height*s)}
  else ctx.drawImage(c,Math.round(x),Math.round(y),c.width*s,c.height*s);ctx.restore()}
const sprW=n=>SPR[n][0].length, sprH=n=>SPR[n].length;
const FONT={'0':['111','101','101','101','111'],'1':['010','110','010','010','111'],'2':['111','001','111','100','111'],'3':['111','001','111','001','111'],'4':['101','101','111','001','001'],'5':['111','100','111','001','111'],'6':['111','100','111','101','111'],'7':['111','001','010','010','010'],'8':['111','101','111','101','111'],'9':['111','101','111','001','111'],'+':['000','010','111','010','000'],'-':['000','000','111','000','000'],'x':['000','101','010','101','000'],'=':['000','111','000','111','000'],'?':['111','001','011','000','010'],'!':['010','010','010','000','010']};
const txtW=(s,sc)=>String(s).length*4*sc-sc;
function drawTxt(ctx,s,x,y,sc,col,sh){s=String(s);if(sh)drawTxt(ctx,s,x+sc,y+sc,sc,sh);ctx.fillStyle=col;let cx=Math.round(x);y=Math.round(y);
  for(const ch of s){const g=FONT[ch];if(g)for(let j=0;j<5;j++)for(let i=0;i<3;i++)if(g[j][i]==='1')ctx.fillRect(cx+i*sc,y+j*sc,sc,sc);cx+=4*sc}}
const ICON={heart:sprite('heart').toDataURL(),star:sprite('star').toDataURL(),coin:sprite('coin').toDataURL()};
const icon=(n,cls='')=>`<span class="icon ${cls}" style="background-image:url(${ICON[n]})"></span>`;

/* ================= problem engine ================= */
function build(u,k,tier,a,b,fmt){
  const op={add:'+',sub:'−',mul:'×'}[u];const c=u==='add'?a+b:u==='sub'?a-b:a*b;
  let ans=c,miss=null;
  if(fmt==='m'){miss=(u==='sub'&&Math.random()<.5)?'a':'b';ans=miss==='a'?a:b}
  const text=fmt==='m'?(miss==='a'?`□ ${op} ${b} = ${c}`:`${a} ${op} □ = ${c}`):`${a} ${op} ${b}`;
  const key=(fmt==='m'&&u!=='mul')?(u==='add'?'am':'sm'):k;
  return{u,k:key,tier,a,b,op,c,fmt,ans,miss,text}}
function genAdd(t){let a,b;
  switch(t){
    case 1:a=R(1,8);b=R(1,10-a);break;
    case 2:a=R(2,9);b=R(Math.max(2,11-a),9);break;
    case 3:{const ao=R(0,8);a=R(1,8)*10+ao;b=R(1,9-ao);break}
    case 4:{const ao=R(2,9);a=R(1,8)*10+ao;b=R(10-ao,9);break}
    case 5:{const at=R(1,8),bt=R(1,9-at),ao=R(0,9),bo=R(0,9-ao);a=at*10+ao;b=bt*10+bo;break}
    case 6:{const ao=R(1,9),bo=R(10-ao,9),at=R(1,7),bt=R(1,8-at);a=at*10+ao;b=bt*10+bo;break}
    default:{const at=R(2,9),bt=R(10-at,9);a=at*10+R(0,9);b=bt*10+R(0,9)}}
  if(t>=2&&t<=4&&Math.random()<.25)[a,b]=[b,a];
  return[a,b]}
function genSub(t){let a,b;
  switch(t){
    case 1:a=R(3,10);b=R(1,a-1);break;
    case 2:{a=R(11,18);b=R(a-10+1,9);break}
    case 3:{const ao=R(1,9);a=R(2,9)*10+ao;b=R(1,ao);break}
    case 4:{const ao=R(0,8);a=R(2,9)*10+ao;b=R(ao+1,9);break}
    case 5:{const at=R(2,9),ao=R(0,9),bt=R(1,at-1),bo=R(0,ao);a=at*10+ao;b=bt*10+bo;break}
    default:{const at=R(2,9),ao=R(0,8),bt=R(1,at-1),bo=R(ao+1,9);a=at*10+ao;b=bt*10+bo}}
  return[a,b]}
function genTier(u,t,fmt){
  if(u==='add'){const[a,b]=genAdd(t);return build('add','a'+t,t,a,b,fmt||'h')}
  const tt=Math.min(t,6);const[a,b]=genSub(tt);return build('sub','s'+tt,t,a,b,fmt||(t>=7?'m':'h'))}
const ZONES=[{n:'초록 숲',wall:'#2e5d3a',brick:'#264d30',fl:'#4a3a2a'},{n:'얼음 동굴',wall:'#2f5577',brick:'#28496a',fl:'#1f3550'},{n:'유령 성',wall:'#3b3f66',brick:'#30345a',fl:'#25284a'},{n:'화산 탑',wall:'#5a2a3a',brick:'#4a2230',fl:'#2a1520'}];
const ALLD=[0,1,2,3,4,5,6,7,8,9],D29=[2,3,4,5,6,7,8,9];
const FLOORS=[
 [[2,5],'none','slime',0,'슬라임 대왕'],[[3,6],'none','bat',0,'박쥐 백작'],[[4,8],'none','shroom',0,'독버섯 마녀'],[[7,9],'none','ghost',0,'유령 기사'],[[1,0],'none','golem',0,'바위 거인'],
 [[2,3,5],'allow','slime',1,'얼음 슬라임'],[[4,6,8],'allow','bat',3,'눈보라 박쥐'],[[6,7],'allow','shroom',3,'서리 버섯'],[[8,9],'allow','ghost',1,'얼음 유령'],[D29,'allow','dragon',1,'얼음 용'],
 [[2,4,8],'heavy','ghost',2,'거울 유령'],[[3,6,9],'heavy','shroom',2,'보라 마법 버섯'],[[5,7],'heavy','bat',2,'붉은 박쥐 공작'],[[6,8,9],'heavy','golem',2,'이끼 골렘'],[ALLD,'heavy','dragon',2,'황금 용'],
 [[6,7],'allow','slime',2,'용암 슬라임'],[[7,8],'allow','golem',3,'용암 골렘'],[[8,9],'allow','ghost',3,'불꽃 유령'],[[6,7,8,9],'heavy','shroom',1,'화산 버섯'],[ALLD,'heavy','dragon',3,'구구 마왕']
].map(([d,fm,bs,bp,bn],i)=>{const z=ZONES[Math.floor(i/5)];return{n:z.n,d,fm,bs,bp,bn,wall:z.wall,brick:z.brick,fl:z.fl,mons:3+Math.floor(i/5),hp:3+Math.floor(i/7),bhp:6+Math.floor(i/3)}});
const GROUPS=[[2,5],[3,6],[4,8],[7,9],[1,0]];
const danLabel=d=>d.length>4?(d.includes(0)?'0~9단 모두':'2~9단 섞기'):d.map(x=>x===0?'0의 곱':x+'단').join('·');
function taughtDans(){const s=new Set();GROUPS.slice(0,Math.min(CFG.mulTaught||5,5)).forEach(g=>g.forEach(x=>s.add(x)));return[...s]}
function genMul(dans,U,avoid,fm){
  const C=[];const add=(a,b)=>{const k=a+'x'+b;if(avoid.includes(k))return;const s=U.skills[k];let w;
    if(!s)w=2.2;else{const acc=s.c/s.n,at=s.tn?s.t/s.tn:3500;w=1+(1-acc)*6+(at>4500?1.5:at>3000?.6:0)+(s.n<3?.8:0);if(acc>=.95&&s.n>=4&&at<2500)w=.35}
    if(CFG.focus&&Array.isArray(CFG.focus.mul)&&CFG.focus.mul.includes(a))w*=3;
    C.push([a,b,w])};
  for(const a of dans){if(a===0){for(let b=0;b<=9;b++)add(0,b);for(let b=1;b<=9;b++)add(b,0)}else if(a===1){for(let b=1;b<=9;b++)add(1,b);for(let b=2;b<=9;b++)add(b,1)}else for(let b=1;b<=9;b++)add(a,b)}
  if(!C.length)return genMul(dans,U,[],fm);
  let r=Math.random()*C.reduce((s,c)=>s+c[2],0),ch=C[0];for(const c of C){r-=c[2];if(r<=0){ch=c;break}}
  const[a,b]=ch;let fmt='h';if(a>0&&b>0&&(fm==='force'||(fm==='allow'&&Math.random()<.25)||(fm==='heavy'&&Math.random()<.5)))fmt='m';
  return build('mul',a+'x'+b,0,a,b,fmt)}
const STEP_N={1:4,2:6};
function stepList(u,n){
  if(u==='mul'){const U=cur.units.mul,av=[],out=[],N=STEP_N[n];const d1=CFG.mulTaught>=2?[2,5,3]:[2,5],d2=taughtDans();
    for(let i=0;i<N;i++){const p=genMul(n===1?d1:d2,U,av,(n===2&&i===N-1)?'force':'none');av.push(p.k);out.push(p)}return shuffle(out)}
  const T=u==='add'?(n===1?[2,3,4,6]:[5,6,6,'v6',7,'m6']):(n===1?[2,3,4,6]:[5,6,6,'v6','v4','m6']);
  const out=[],seen=new Set();
  for(const x of T){let p,tries=0;do{let fmt='h',t=x;if(typeof x==='string'){fmt=x[0];t=+x.slice(1)}p=genTier(u,t,fmt)}while(seen.has(p.text)&&++tries<20);seen.add(p.text);out.push(p)}
  if(n===2&&focusOf(u)){for(let i=0;i<2;i++){const q=focusGen(u);if(!seen.has(q.text)){seen.add(q.text);out[i]=q}}}
  return shuffle(out)}
/* runtime anti-repeat + spaced retry */
const RT={n:0,q:[],rt:[],rk:[]};
function rtReset(){RT.n=0;RT.q=[];RT.rt=[];RT.rk=[]}
function retryLater(p,d){if(!RT.q.some(x=>x.p.text===p.text))RT.q.push({p,due:RT.n+d})}
function nextProblem(u,gen){
  RT.n++;const qi=RT.q.findIndex(x=>x.due<=RT.n);let p=null;
  if(qi>=0){const o=RT.q.splice(qi,1)[0].p;p=u==='mul'?build('mul',o.k,0,o.a,o.b,(o.a&&o.b&&Math.random()<.5)?'m':'h'):genTier(u,o.tier,o.fmt==='v'?'h':o.fmt)}
  else{for(let i=0;i<30;i++){const c=gen();if(!RT.rt.includes(c.text)){p=c;break}}if(!p)p=gen()}
  RT.rt.push(p.text);if(RT.rt.length>16)RT.rt.shift();RT.rk.push(p.k);if(RT.rk.length>6)RT.rk.shift();return p}
/* 3·5단계(받아올림·받아내림 없음)에서 절반은 같은 자릿수의 받아올림·받아내림 유형(4·6단계)으로 */
const mixCarry=t=>(t===3||t===5)&&Math.random()<.5?t+1:t;
function genGame(u){if(focusOf(u)&&Math.random()<.4)return focusGen(u);const g=cur.units[u].game;let t=g.tier;const r=Math.random();if(r<.2&&t>1)t--;else if(r>.9&&t<7)t++;t=mixCarry(t);
  let fmt='h';if(t>=3&&t<=6&&Math.random()<.15)fmt='m';return genTier(u,t,fmt)}
/* diagnosis */
function classify(p,g){
  if(g==null||isNaN(g))return'etc';const{u,a,b,c,ans}=p;
  if(p.fmt==='m'){if(u==='add'&&g===a+c)return'rel';if(u==='sub'&&p.miss==='b'&&g===a+c)return'rel';if(u==='sub'&&p.miss==='a'&&g===c-b)return'rel';
    if(u==='mul'){if(g===c-a||g===c+a)return'addmix';if(Math.abs(g-ans)===1)return'neigh'}if(Math.abs(g-ans)<=2)return'count';return'etc'}
  if(u==='add'){if((a%10)+(b%10)>=10&&g===c-10)return'carry';if(Math.abs(g-c)===10||Math.abs(g-c)===100)return'place';if(g===Math.abs(a-b))return'opmix';if(swapD(g)===c)return'swap';if(Math.abs(g-c)<=2)return'count';return'etc'}
  if(u==='sub'){const ao=a%10,bo=b%10,brw=ao<bo,bug=(Math.floor(a/10)-Math.floor(b/10))*10+Math.abs(ao-bo);
    if(brw&&g===bug)return'borrow';if(brw&&g===c+10)return'noDec';if(g===a+b)return'opmix';if(Math.abs(g-c)===10)return'place';if(swapD(g)===c)return'swap';if(Math.abs(g-c)<=2)return'count';return'etc'}
  if((a===0||b===0)&&(g===a||g===b||g===a+b))return'zero';if(g===a+b)return'addmix';
  if([a*(b+1),a*(b-1),(a+1)*b,(a-1)*b].includes(g))return'neigh';if(swapD(g)===c)return'swap';return'etc'}
function distract(p){const{u,a,b,c,ans}=p;let pri=[];const gen=shuffle([ans+1,ans-1,ans+2,ans-2,ans+10,ans-10]);
  if(p.fmt==='m'){if(u==='add')pri=[a+c];else if(u==='sub')pri=[p.miss==='b'?a+c:c-b];else pri=[ans+1,ans-1]}
  else if(u==='add'){if((a%10)+(b%10)>=10)pri.push(c-10);pri.push(swapD(c))}
  else if(u==='sub'){if(a%10<b%10){pri.push((Math.floor(a/10)-Math.floor(b/10))*10+Math.abs(a%10-b%10));pri.push(c+10)}}
  else pri=shuffle([a*(b+1),a*(b-1),a+b]);
  return[...pri,...gen]}
function makeChoices(p,n){const set=new Set([p.ans]);for(const v of distract(p)){if(set.size>=n)break;if(Number.isInteger(v)&&v>=0&&v<=999)set.add(v)}
  let g=0;while(set.size<n&&g++<50){const v=p.ans+R(-6,6);if(v>=0)set.add(v)}return shuffle([...set])}

/* ================= recording ================= */
const sess=U=>U.sessions[U.sessions.length-1];
function newSession(U){U.sessions.push({d:today(),s1:null,s2:null,gc:0,gn:0});if(U.sessions.length>12)U.sessions.shift()}
function record(u,p,given,ok,ms,mode){
  const U=cur.units[u],st=U.stats;
  if(mode==='k'){st.kn++;if(ok)st.kc++;st.kt+=Math.min(ms,30000)}else{st.cn++;if(ok)st.cc++}
  const sk=U.skills[p.k]||(U.skills[p.k]={n:0,c:0,t:0,tn:0});sk.n++;if(ok)sk.c++;if(mode==='k'){sk.t+=Math.min(ms,30000);sk.tn++}
  let e=null;if(!ok){e=classify(p,given);U.errs[e]=(U.errs[e]||0)+1}
  U.recent.unshift({q:p.text,ans:p.ans,g:given,ok,t:Math.round(ms/100)/10,m:mode,e,at:Date.now(),k:p.k});if(U.recent.length>30)U.recent.length=30;
  const d=today(),dd=U.daily[d]||(U.daily[d]=[0,0]);dd[0]++;if(ok)dd[1]++;if(todayTotal()===(CFG.dailyGoal||30))setTimeout(()=>{toast(`${callName()}, 오늘의 미션 완료! 도장 쾅!`);SFX.win()},500);const ks=Object.keys(U.daily).sort();while(ks.length>20)delete U.daily[ks.shift()];
  if(U.phase===3){const s=sess(U);if(s){s.gn++;if(ok)s.gc++}}
  touch();return e}

/* ================= screens ================= */
let SCR='title';
function show(name){SCR=name;$$('.screen').forEach(s=>s.hidden=s.id!=='scr-'+name);
  $('#topbar').hidden=!cur||!['units','step','game','dlobby','pick','me'].includes(name);$('#btnSwitch').hidden=!['game','dlobby'].includes(name);
  document.body.classList.toggle('paper',name==='dash');$('#app').classList.toggle('wide',name==='dash');
  if(name!=='game'){stopLoop();G=null}
  name==='title'?startTitle():stopTitle();window.scrollTo(0,0)}
$$('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));
function toast(t){const el=document.createElement('div');el.className='toast';el.textContent=t;document.body.appendChild(el);setTimeout(()=>el.remove(),2600)}
function setUnitLabel(u){$('#tbUnit').textContent=u?UNAME[u]+' 복습':''}

/* ---------- title ---------- */
const tcv=$('#titleCv'),tctx=tcv.getContext('2d');let titleRAF=null;
function startTitle(){stopTitle();const t0=performance.now();
  const stars=Array.from({length:26},()=>[R(0,191),R(0,40)]);
  const frame=now=>{const t=(now-t0)/1000;tctx.fillStyle='#1b1844';tctx.fillRect(0,0,192,64);
    tctx.fillStyle='#5d55a8';stars.forEach(([x,y],i)=>{if((Math.floor(t*2)+i)%5)tctx.fillRect(x,y,1,1)});
    tctx.fillStyle='#3a6b3f';tctx.fillRect(0,52,192,12);tctx.fillStyle='#4e9f4f';tctx.fillRect(0,52,192,3);
    const off=(t*22)%240;const X=v=>((v+off)%240)-40;
    const bob=k=>Math.round(Math.sin(t*6+k)*1.2);
    drawSpr(tctx,'car',X(0),40+bob(0),1,{m:'#ff6f59'});
    drawSpr(tctx,'mole',X(40),41+bob(1),1,{m:'#9a6b4f',l:'#c99777'});
    drawSpr(tctx,'hero',X(90),39+bob(2),1);
    drawSpr(tctx,'slime',X(116),42+bob(3),1,MPAL.slime[0]);
    drawSpr(tctx,'bat',X(140),24+bob(4)*2,1,MPAL.bat[0]);
    drawSpr(tctx,'dragon',X(172),40+bob(5),1,MPAL.dragon[3]);
    drawTxt(tctx,'2x3=6',X(60)+2,10,1,'#ffc93c');drawTxt(tctx,'8+5',X(10),14,1,'#69bfff');drawTxt(tctx,'14-6',X(150),8,1,'#45c98f');
    if(!RM)titleRAF=requestAnimationFrame(frame)};
  titleRAF=requestAnimationFrame(frame)}
function stopTitle(){if(titleRAF)cancelAnimationFrame(titleRAF);titleRAF=null}
$('#btnStart').onclick=()=>{renderWho();show('who')};
$('#btnTeacher').onclick=()=>{pin='';renderPin();$('#pinErr').textContent='';show('login')};
function connText(){$('#conn').textContent=Store.db?'선생님 기록장과 연결되어 있어요. 기록이 자동으로 저장돼요.':'지금은 이 기기에만 기록이 저장돼요.'}

/* ---------- who ---------- */
function renderWho(){const g=$('#numGrid');g.innerHTML='';for(let i=1;i<=CFG.count;i++){const b=document.createElement('button');b.type='button';
  b.innerHTML=`<b>${i}</b><span>${esc((CFG.roster||{})[i]||'')}</span>`;b.onclick=()=>pickStudent(i);g.appendChild(b)}}
async function pickStudent(no){$('#numGrid').classList.add('busy');try{cur=await loadStudent(no)}finally{$('#numGrid').classList.remove('busy')}
  setSave(Store.db?'ok':'local');renderUnits();show('units')}

/* ---------- units ---------- */
function studentName(){return(CFG.roster||{})[cur.no]||''}
function callName(){const n=studentName();if(!n)return`${cur.no}번 친구`;const g=n.length>=3?n.slice(1):n;const c=g.charCodeAt(g.length-1);const jong=c>=0xAC00&&c<=0xD7A3?(c-0xAC00)%28:0;return g+(jong?'아':'야')}
function unitStatus(u){const U=cur.units[u],g=U.game;
  if(U.phase===1||U.phase===2){const S=U.step;return`STEP ${U.phase} 하는 중 · ${S?S.i:0}/${S?S.list.length:STEP_N[U.phase]}문제`}
  if(U.phase===3)return`STEP 3 · ${U.last?GAMES[U.last].n+' 하는 중':'게임 고르는 중'}`;
  return U.sessions.length?'새 모험을 시작할 수 있어요':'아직 시작하지 않았어요'}
function renderUnits(){
  $('#tbName').textContent=`${cur.no}번 ${studentName()}`.trim();setUnitLabel(null);
  $('#hello').textContent=`${callName()}, 오늘은 어떤 게임을 해볼래?`;
  renderMission();const box=$('#unitCards');box.innerHTML='';
  const order=['mul','add','sub'];
  const desc={mul:'곱셈 던전 · 구구 짝꿍 · 셈 비',add:'덧셈 레이스 · 합 블록 · 셈 비 · 개구리 수직선',sub:'뺄셈 두더지 · 셈 비 · 개구리 수직선'};
  for(const u of order){const U=cur.units[u];const c=document.createElement('div');c.className='pp ucard'+(u==='mul'?' feature':'');
    c.innerHTML=`<canvas class="ic pix" width="48" height="36"></canvas><div class="uinfo"><span class="tag">${u.toUpperCase()}</span><h3>${UNAME[u]} 복습</h3>${focusLabel(u)?`<span class="ftag">선생님 과제 · ${esc(focusLabel(u))}</span>`:''}<p class="st">${desc[u]}</p><p class="st"><b>${esc(unitStatus(u))}</b>${(U.daily||{})[today()]?` · 오늘 ${U.daily[today()][0]}문제`:''}</p><div class="bt"></div></div>`;
    const bt=c.querySelector('.bt');
    const mk=(t,cls,fn)=>{const b=document.createElement('button');b.type='button';b.className='pbtn '+cls;b.textContent=t;b.onclick=fn;bt.appendChild(b)};
    if(U.phase>0){mk('이어하기','mint',()=>resumeUnit(u));mk('처음부터','',()=>startUnit(u))}else mk('시작하기','mint',()=>startUnit(u));
    box.appendChild(c);drawUnitIcon(c.querySelector('canvas'),u)}
  const rv=reviewKeys().length,rc=document.createElement('div');rc.className='pp ucard review';
  rc.innerHTML=`<canvas class="ic pix" width="48" height="36"></canvas><div class="uinfo"><span class="tag">REVIEW</span><h3>복습 상자</h3><p class="st">${rv?`틀렸던 문제 ${rv}가지를 새 숫자로 다시 풀어요`:'아직 틀린 문제가 없어요. 문제를 풀다 틀리면 여기에 모여요'}</p><div class="bt"><button class="pbtn sky" type="button" ${rv?'':'disabled'}>복습 5문제 풀기</button></div></div>`;
  rc.querySelector('button').onclick=openReview;box.appendChild(rc);drawChest(rc.querySelector('canvas'))}
function drawChest(c){const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.fillStyle='#2c4a7a';x.fillRect(0,0,48,36);x.fillStyle='#1d1938';x.fillRect(11,11,26,20);x.fillStyle='#b8733a';x.fillRect(12,12,24,18);x.fillStyle='#8a5226';x.fillRect(12,19,24,2);x.fillStyle='#ffc93c';x.fillRect(22,18,4,5);x.fillStyle='#ffe27a';[[8,6],[38,8],[30,4],[16,5]].forEach(([a,b])=>x.fillRect(a,b,2,2))}
function todayTotal(){if(!cur)return 0;const d=today();return UNITS.reduce((s,u)=>s+(((cur.units[u].daily||{})[d]||[0])[0]),0)}
function dayMap(doc){const m={};UNITS.forEach(u=>Object.entries((doc.units[u]||{}).daily||{}).forEach(([d,v])=>{m[d]=(m[d]||0)+v[0]}));return m}
let classCache={t:0,v:null};
async function classToday(){if(Date.now()-classCache.t<20000&&classCache.v!=null)return classCache.v;const d=today(),docs={};
  for(const k of LS.keys())if(/^dsm:s\d+$/.test(k)){const x=LS.get(k);if(x&&x.id)docs[x.id]=x}
  if(Store.db){try{const sn=await Store.db.collection('students').get();sn.docs.forEach(doc=>{if(doc.exists){const x=doc.data();docs[doc.id]=(!docs[doc.id]||(x.updatedAt||0)>=(docs[doc.id].updatedAt||0))?x:docs[doc.id]}})}catch(e){}}
  if(cur)docs[cur.id]=cur;let sum=0;Object.values(docs).forEach(x=>UNITS.forEach(u=>{const dd=((x.units||{})[u]||{}).daily;if(dd&&dd[d])sum+=dd[d][1]}));classCache={t:Date.now(),v:sum};return sum}
function renderMission(){const goal=CFG.dailyGoal||30,tt=todayTotal(),m=dayMap(cur),t=today(),days=Object.keys(m).sort();if(!days.includes(t))days.push(t);
  const last=days.slice(-8),stamps=Object.values(m).filter(v=>v>=goal).length;
  $('#mission').innerHTML=`<div><h3>오늘의 미션 · ${goal}문제 풀기</h3><div class="mbar" role="img" aria-label="${tt} / ${goal}"><i style="width:${Math.min(100,tt/goal*100)}%"></i></div><p class="st">${tt>=goal?'미션 완료! 오늘 도장을 받았어요':`${tt} / ${goal} · ${goal-tt}문제 남았어요`} · 모은 도장 ${stamps}개</p><div class="stamps">${last.map(d=>`<span class="stamp ${(m[d]||0)>=goal?'on':''} ${d===t?'today':''}"><b>${+d.slice(5,7)}/${+d.slice(8)}</b>${(m[d]||0)>=goal?'도장':d===t?'오늘':''}</span>`).join('')}</div></div><div><h3>우리 반 보물상자</h3><div class="mbar gold"><i id="classBar" style="width:0%"></i></div><p class="st" id="classLine">우리 반 정답을 세고 있어요</p><p class="st">친구들과 함께 맞힌 정답이 모이면 보물상자가 열려요.</p></div>`;
  classToday().then(v=>{const cg=CFG.classGoal||150,b=$('#classBar');if(!b)return;b.style.width=Math.min(100,v/cg*100)+'%';$('#classLine').textContent=v>=cg?`오늘 우리 반 정답 ${v}개! 보물상자가 열렸어요`:`오늘 우리 반 정답 ${v} / ${cg}개`})}
/* ---------- focus (teacher task) ---------- */
function focusOf(u){const f=(CFG.focus||{})[u];return u==='mul'?(Array.isArray(f)?f:[]):(f||'')}
function focusGen(u){const f=focusOf(u);if(!f||u==='mul')return genGame(u);if(f==='am')return genTier('add',R(3,6),'m');if(f==='sm')return genTier('sub',R(3,6),'m');return genTier(u,+f.slice(1),'h')}
function focusLabel(u){const f=focusOf(u);if(u==='mul')return f.length?f.map(x=>x===0?'0의 곱':x+'단').join('·')+' 집중':'';return f?(SKL[u][f]||'')+' 집중':''}
/* ---------- review box ---------- */
function reviewKeys(){if(!cur)return[];const all=[];UNITS.forEach(u=>(cur.units[u].recent||[]).forEach(r=>{if(!r.ok&&r.k)all.push({u,k:r.k,at:r.at})}));all.sort((a,b)=>b.at-a.at);
  const seen=new Set(),out=[];for(const x of all){const id=x.u+'|'+x.k;if(!seen.has(id)){seen.add(id);out.push(x)}}return out}
function regen(u,k){if(u==='mul'){const[a,b]=k.split('x').map(Number);return build('mul',k,0,a,b,(a&&b&&Math.random()<.4)?'m':'h')}
  if(k==='am')return genTier('add',R(3,6),'m');if(k==='sm')return genTier('sub',R(3,6),'m');return genTier(u,+k.slice(1)||3,'h')}
function openReview(){const ks=reviewKeys();if(!ks.length)return;const list=[],seen=new Set();let i=0,g=0;
  while(list.length<5&&g++<40){const x=ks[i%ks.length];i++;const p=regen(x.u,x.k);if(!seen.has(p.text)){seen.add(p.text);list.push(p)}}
  ST={u:list[0].u,review:true,S:{n:'R',list,i:0,res:[]},input:'',t0:performance.now(),fb:null,done:false};$('#tbUnit').textContent='복습 상자';show('step');renderStep()}
/* ---------- my growth ---------- */
function openMe(){show('me');$('#tbUnit').textContent='내 기록';$('#meHello').textContent=`${callName()}의 성장 기록`;const box=$('#meGrid');box.innerHTML='';
  UNITS.forEach(u=>{const U=cur.units[u],days=Object.keys(U.daily||{}).sort().slice(-7),mx=Math.max(1,...days.map(d=>U.daily[d][0])),ses=(U.sessions||[]).filter(x=>x.s2).slice(-8),r=U.recent||[],acc=r.length?Math.round(r.filter(x=>x.ok).length/r.length*100):null;
    const games=UGAMES[u].map(id=>{const a=(U.arc||{})[id],g=U.game||{};const v=id==='dun'?`${g.best||0}층 클리어`:id==='race'?`트랙 ${g.track||1}`:id==='mole'?`라운드 ${g.round||1}`:`최고 ${a?a.best:0}점`;return`<span><b style="font-weight:400">${GAMES[id].n}</b><em style="font-style:normal">${v}</em></span>`}).join('');
    let pets='';if(u==='mul'){const st=[0,0,0,0,0];DAN_ORDER.forEach(d=>st[danInfo(U,d).stage]++);pets=`<h4>구구 펫</h4><p class="st" style="margin:0">완성 ${st[4]} · 어린이 ${st[3]} · 아기 ${st[2]} · 알 ${st[1]}</p>`}
    const c=document.createElement('div');c.className='pp mecard';
    c.innerHTML=`<h3>${UNAME[u]}</h3><p class="st" style="margin:0">최근 ${r.length}문제 정확도 <b>${acc==null?'—':acc+'%'}</b></p>
      <h4>날마다 푼 문제</h4>${days.length?`<div class="mebars">${days.map(d=>{const v=U.daily[d];return`<div><em>${v[0]}</em><i style="height:${Math.round(v[0]/mx*70)}px"></i><small>${+d.slice(8)}</small></div>`}).join('')}</div>`:'<p class="st" style="margin:0">아직 기록이 없어요</p>'}
      <h4>도전 문제 점수 변화</h4>${ses.length?`<div class="mebars">${ses.map(x=>`<div><em>${x.s2[0]}</em><i class="s2" style="height:${Math.round(x.s2[0]/(x.s2[1]||6)*70)}px"></i><small>${+x.d.slice(8)}</small></div>`).join('')}</div>`:'<p class="st" style="margin:0">STEP 2를 마치면 점수가 쌓여요</p>'}
      ${pets}<h4>게임 기록</h4><div class="melist">${games}</div>`;box.appendChild(c)})}
function drawUnitIcon(cv,u){const x=cv.getContext('2d');x.imageSmoothingEnabled=false;
  if(u==='add'){x.fillStyle='#4e9f4f';x.fillRect(0,0,48,36);x.fillStyle='#5a5672';x.fillRect(12,0,24,36);x.fillStyle='#e9e4ff';x.fillRect(23,2,2,6);x.fillRect(23,16,2,6);x.fillRect(23,30,2,6);drawSpr(x,'car',19,20,1,{m:'#ff6f59'});drawSpr(x,'tree',1,4,1)}
  else if(u==='sub'){x.fillStyle='#6cbf5a';x.fillRect(0,0,48,36);x.fillStyle='#8a5a3c';x.fillRect(10,28,28,6);x.fillStyle='#2a1c2e';x.fillRect(13,29,22,3);drawSpr(x,'mole',18,17,1,{m:'#9a6b4f',l:'#c99777'})}
  else{x.fillStyle='#3a335e';x.fillRect(0,0,48,36);x.fillStyle='#2a2440';x.fillRect(0,28,48,8);drawSpr(x,'hero',4,15,1);drawSpr(x,'dragon',28,16,1,MPAL.dragon[3]);drawSpr(x,'torch',22,3,1)}}
function startUnit(u){const U=cur.units[u];newSession(U);U.phase=1;U.step=null;touch();openStep(u)}
function resumeUnit(u){const U=cur.units[u];if(U.phase===3){if(U.last)launch(u,U.last);else showPicker(u)}else openStep(u)}

/* ---------- keypad ---------- */
function makeKeypad(el,onKey,okLabel){el.innerHTML='';['1','2','3','4','5','6','7','8','9','del','0','ok'].forEach(k=>{const b=document.createElement('button');b.type='button';
  b.className='key'+(k==='ok'?' ok':k==='del'?' del':'');b.textContent=k==='del'?'지우기':k==='ok'?(okLabel||'확인'):k;
  b.addEventListener('click',()=>{onKey(k);b.blur()});el.appendChild(b)})}

/* ---------- steps ---------- */
let ST=null;
makeKeypad($('#kpStep'),k=>stepKey(k));
function openStep(u){const U=cur.units[u],n=U.phase;if(!U.step||U.step.n!==n){U.step={n,list:stepList(u,n),i:0,res:[]};touch()}
  ST={u,input:'',t0:performance.now(),fb:null,done:false};setUnitLabel(u);show('step');renderStep()}
const curS=()=>ST.review?ST.S:cur.units[ST.u].step;
function renderPips(S){$('#pips').innerHTML=S.list.map((_,i)=>`<i class="${i<S.res.length?(S.res[i]?'ok':'no'):(i===S.i&&!ST.fb?'now':'')}"></i>`).join('')}
function renderStep(){const S=curS();
  $('#stepBadge').textContent=ST.review?'복습':'STEP '+S.n;$('#stepTitle').textContent=ST.review?`틀렸던 문제 다시 도전 ${S.list.length}문제`:S.n===1?`몸풀기 ${S.list.length}문제`:`도전 ${S.list.length}문제`;renderPips(S);
  const kp=$('#kpStep');
  if(ST.fb){const{p,ok,fast}=ST.fb;
    $('#stepBody').innerHTML=`<div class="qarea">${probHTML(p,String(ST.input),'')}${ok?`<div class="fb ok">${icon('star')}<b>정답!</b><span>${fast?'번개처럼 빨랐어요':'좋아요, 계속 가요'}</span></div>`:`<div class="fb no"><b>아쉬워요</b><span>정답은</span><em>${p.ans}</em></div>${hintHTML(p)}`}<button class="pbtn mint" type="button" id="fbNext">다음 문제</button></div>`;
    $('#fbNext').onclick=()=>stepKey('ok');kp.classList.add('off');kp.hidden=false;return}
  if(S.i>=S.list.length){renderStepResult();return}
  kp.classList.remove('off');kp.hidden=false;const p=S.list[S.i];
  $('#stepBody').innerHTML=`<div class="qarea">${probHTML(p,ST.input,'live')}<p class="gnote" style="color:#5a5478">${S.i+1}번째 문제 · 답을 누르고 확인!</p><button class="listen" type="button" id="btnListen">문제 듣기</button></div>`;
  $('#btnListen').onclick=()=>speakP(p,true);speakP(p)}
const OPN={'+':'plus','−':'minus','×':'times','=':'eq'},OPL={'+':'더하기','−':'빼기','×':'곱하기','=':'는'};
const opHTML=o=>`<span class="op op-${OPN[o]}" role="img" aria-label="${OPL[o]}"></span>`;
function eqHTML(p,slot){const S=v=>`<span>${v}</span>`,unk=slot==null?S(p.ans):slot;
  if(p.fmt==='m')return p.miss==='a'?unk+opHTML(p.op)+S(p.b)+opHTML('=')+S(p.c):S(p.a)+opHTML(p.op)+unk+opHTML('=')+S(p.c);
  return S(p.a)+opHTML(p.op)+S(p.b)+opHTML('=')+(slot==null?S(p.c):slot)}
function probHTML(p,inp,cls){const sl=`<span class="slot ${cls}" id="slot">${inp===''?'&nbsp;':esc(inp)}</span>`;
  if(p.fmt==='v'){const cells=n=>String(n).padStart(3,' ').split('').map(ch=>`<span>${ch===' '?'':ch}</span>`).join('');
    return`<div class="vert"><span></span>${cells(p.a)}<span>${opHTML(p.op)}</span>${cells(p.b)}<div class="vline"></div><div class="ans">${sl}</div></div>`}
  return`<div class="hz">${eqHTML(p,sl)}</div>`}
function hintHTML(p){const{u,a,b,c}=p;let L=[];
  if(u==='mul'){
    if(a===0||b===0)return`<div class="hint"><p>${a===0?'0을 여러 번 더해도 0이에요':'어떤 수에 0을 곱하면 0이에요'}</p><p>${a} × ${b} = 0</p></div>`;
    const skip=Array.from({length:p.fmt==='m'?9:b},(_,i)=>a*(i+1)).join(', ');
    return`<div class="hint"><p>${a}씩 ${b}줄이에요</p><div class="dots" style="--cols:${a}">${'<i></i>'.repeat(a*b)}</div><p>${a}씩 뛰어 세기: ${skip}</p>${p.fmt==='m'?`<p>${c}는 ${b}번째에 나와요 → □ = ${b}</p>`:''}</div>`}
  if(p.fmt==='m'){if(u==='add')L=[`□ = ${c} − ${a}`,`${c} − ${a} = ${b}`];else if(p.miss==='b')L=[`□ = ${a} − ${c}`,`${a} − ${c} = ${b}`];else L=[`□ = ${c} + ${b}`,`${c} + ${b} = ${a}`]}
  else if(u==='add'){const ao=a%10,bo=b%10;
    if(a<10&&b<10){if(a+b>10){const big=Math.max(a,b),sm=Math.min(a,b),need=10-big;L=[`10 만들기: ${big} + ${need} = 10`,`남은 ${sm-need}을(를) 더해요: 10 + ${sm-need} = ${c}`]}else L=[`${a}에서 ${b}만큼 이어 세어요 → ${c}`]}
    else{const on=ao+bo,at=Math.floor(a/10),bt=Math.floor(b/10);L.push(`일의 자리: ${ao} + ${bo} = ${on}${on>=10?' → 10은 십의 자리로 올려요':''}`);L.push(`십의 자리: ${at} + ${bt}${on>=10?' + 1':''} = ${at+bt+(on>=10?1:0)}`);L.push(`답: ${c}`)}}
  else{const ao=a%10,bo=b%10,at=Math.floor(a/10),bt=Math.floor(b/10);
    if(a>10&&a<20&&b<10&&ao<bo)L=[`${a}에서 ${ao}을(를) 먼저 빼면 10`,`10에서 ${b-ao}을(를) 더 빼면 ${c}`];
    else if(a<=10)L=[`${a}에서 ${b}만큼 거꾸로 세어요 → ${c}`];
    else{if(ao<bo){L.push(`일의 자리 ${ao}에서 ${bo}를 뺄 수 없어요. 십의 자리에서 10을 빌려요`);L.push(`일의 자리: ${ao+10} − ${bo} = ${ao+10-bo}`);L.push(`십의 자리: ${at} − 1 − ${bt} = ${at-1-bt}`)}
      else{L.push(`일의 자리: ${ao} − ${bo} = ${ao-bo}`);L.push(`십의 자리: ${at} − ${bt} = ${at-bt}`)}L.push(`답: ${c}`)}}
  return`<div class="hint">${L.map(l=>`<p>${esc(l)}</p>`).join('')}</div>`}
function stepKey(k){if(!ST)return;const S=curS();
  if(ST.done){if(k==='ok')stepContinue();return}
  if(ST.fb){if(k==='ok'){ST.fb=null;ST.input='';ST.t0=performance.now();renderStep()}return}
  if(S.i>=S.list.length)return;
  if(k==='del')ST.input=ST.input.slice(0,-1);
  else if(k==='ok'){if(ST.input!=='')stepSubmit();return}
  else if(ST.input.length<3){ST.input=(ST.input==='0'?'':ST.input)+k;SFX.tap()}
  const sl=$('#slot');if(sl)sl.innerHTML=ST.input===''?'&nbsp;':esc(ST.input)}
function stepSubmit(){const S=curS(),p=S.list[S.i],g=+ST.input,ok=g===p.ans,ms=performance.now()-ST.t0;
  record(p.u,p,g,ok,ms,'k');S.res.push(ok?1:0);S.i++;ST.fb={p,ok,fast:ms<(p.u==='mul'?3000:6000)};ok?SFX.ok():SFX.no();touch();renderStep()}
function renderStepResult(){const S=curS(),c=S.res.reduce((a,b)=>a+b,0),n=S.list.length;ST.done=true;
  if(!ST.review){const U=cur.units[ST.u],s=sess(U);if(s&&!S.logged){s['s'+S.n]=[c,n];S.logged=true;touch()}}
  const stars=n===3?c:Math.round(c/n*3);
  $('#kpStep').hidden=true;$('#pips').innerHTML=S.res.map(r=>`<i class="${r?'ok':'no'}"></i>`).join('');
  $('#stepBody').innerHTML=`<div class="result"><span class="big">${c} / ${n}</span><div class="stars">${[0,1,2].map(i=>icon('star',i<stars?'':'off')).join('')}</div><p style="margin:0;font-size:20px">${c===n?callName()+', 모두 맞혔어! 대단해':c>=n/2?callName()+', 잘했어! 다음도 해 볼까?':callName()+', 괜찮아. 하면서 점점 좋아질 거야'}</p><button class="pbtn mint big" type="button" id="btnNextPhase">${ST.review?'처음 화면으로':S.n===1?'STEP 2 도전하기':'STEP 3 게임 고르기!'}</button></div>`;
  $('#btnNextPhase').onclick=stepContinue;if(c===n)SFX.win()}
function stepContinue(){if(ST.review){ST=null;flush();renderUnits();show('units');return}const u=ST.u,U=cur.units[u],S=U.step;
  if(S.n===1){U.phase=2;U.step=null;touch();openStep(u);return}
  const s=sess(U),miss=s&&s.s2?s.s2[1]-s.s2[0]:2,s1=s&&s.s1?s.s1[0]:2;
  if(u!=='mul'){const g=U.game;const base=s1<=1?2:[6,5,4][miss]||3;g.tier=g.tier==null?base:(miss>=3?Math.min(g.tier,4):g.tier)}
  U.phase=3;U.step=null;touch();showPicker(u)}

/* ================= game shell ================= */
const cv=$('#gameCv'),ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;const W=192,H=144;
const ov=$('#ov');let G=null,paused=false,loopId=null;
function startLoop(fn){stopLoop();let last=performance.now();const tick=now=>{const dt=Math.min(.05,(now-last)/1000);last=now;fn(dt,now/1000);loopId=requestAnimationFrame(tick)};loopId=requestAnimationFrame(tick)}
function stopLoop(){if(loopId)cancelAnimationFrame(loopId);loopId=null}
function overlay(html,btns){paused=true;ov.innerHTML=`<div class="box pp panel">${html}<div class="row"></div></div>`;const row=ov.querySelector('.row');
  (btns||[]).forEach(([t,fn,cls])=>{const b=document.createElement('button');b.type='button';b.className='pbtn '+(cls||'mint');b.textContent=t;b.onclick=()=>{fn()};row.appendChild(b)});ov.hidden=false}
function closeOv(){ov.hidden=true;paused=false}
function heartsHTML(h,m){return`<span class="hearts">${Array.from({length:m},(_,i)=>`<i class="${i<h?'':'e'}" style="background-image:url(${ICON.heart})"></i>`).join('')}</span>`}
let lastSay=null;
function bannerProblem(p,extra){lastSay=p;$('#banner').innerHTML=`<div class="hz">${eqHTML(p,'<span class="slot">?</span>')}</div>${extra||''}<button class="listen" type="button" data-listen>듣기</button>`;speakP(p)}
$('#banner').addEventListener('click',e=>{if(e.target.closest('[data-listen]'))speakP(lastSay,true)});
const solved=p=>p.fmt==='m'?p.text.replace('□',String(p.ans)):`${p.text} = ${p.c}`;
function bannerMsg(html){$('#banner').innerHTML=html}
cv.addEventListener('pointerdown',e=>{if(!G||paused)return;const r=cv.getBoundingClientRect();const x=(e.clientX-r.left)/r.width*W,y=(e.clientY-r.top)/r.height*H;G.tap&&G.tap(x,y)});
/* particles */
function burst(fx,x,y,col,n=12){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=20+Math.random()*50;fx.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-20,life:.6+Math.random()*.3,col,sz:Math.random()<.5?2:1})}}
function floatTxt(fx,x,y,str,col){fx.push({x,y,vx:0,vy:-18,life:.9,txt:str,col})}
function stepFx(fx,dt){for(const p of fx){p.x+=p.vx*dt;p.y+=p.vy*dt;if(!p.txt)p.vy+=90*dt;p.life-=dt}for(let i=fx.length-1;i>=0;i--)if(fx[i].life<=0)fx.splice(i,1)}
function drawFx(fx){for(const p of fx){if(p.txt)drawTxt(ctx,p.txt,p.x-txtW(p.txt,2)/2,p.y,2,p.col,'#1d1938');else{ctx.fillStyle=p.col;ctx.fillRect(Math.round(p.x),Math.round(p.y),p.sz,p.sz)}}}

/* ================= RACER (addition) ================= */
const LANES=[60,96,132];
const Racer={
  start(){const U=cur.units.add,g=U.game;g.tier=g.tier||3;g.prog=g.prog||0;g.hearts=g.hearts||3;g.coins=g.coins||0;g.track=g.track||1;
    Object.assign(this,{U,g,lane:1,cx:LANES[1],row:null,fx:[],crash:0,dist:0,streak:0,tn:0,tc:0,wait:.4});
    setMode(false,false);
    $('#ctrl').innerHTML=`<div class="steer three"><button class="key" type="button" id="stL" aria-label="왼쪽으로">◀</button><button class="key boost" type="button" id="stB">질주! ▲</button><button class="key" type="button" id="stR" aria-label="오른쪽으로">▶</button></div><p class="gnote">정답 차선으로 옮겨요. 답이 확실하면 질주! 보너스 코인을 받아요. (키보드: ← → 와 ↑)</p>`;
    $('#stL').onclick=()=>this.steer(-1);$('#stR').onclick=()=>this.steer(1);$('#stB').onclick=()=>this.boost();
    this.hud();bannerMsg('<span class="msg">출발 준비!</span>');this.draw();
    overlay(`<h3>덧셈 레이스</h3><p>트랙 ${g.track} · 정답 10개면 완주!</p><p>위에 나오는 덧셈의 답이 적힌 차선으로 달려요.</p>`,[['출발!',()=>{closeOv();startLoop(dt=>{this.update(dt);this.draw()})}]])},
  steer(d){const r=this.row;if(r&&r.boost&&!r.res)return;this.lane=Math.max(0,Math.min(2,this.lane+d));SFX.tap()},
  boost(){const r=this.row;if(!r||r.res||r.boost||paused)return;r.boost=true;r.tb=performance.now();this.cx=LANES[this.lane];beep(220,.25,'sawtooth',.03)},
  onKey(e){if(e.key==='ArrowLeft'||e.key==='ArrowRight'){this.steer(e.key==='ArrowLeft'?-1:1);return true}if(e.key==='ArrowUp'||e.key===' '){this.boost();return true}return false},
  tap(x){const r=this.row;if(r&&r.boost&&!r.res)return;let best=0;LANES.forEach((l,i)=>{if(Math.abs(x-l)<Math.abs(x-LANES[best]))best=i});this.lane=best;SFX.tap()},
  hud(){const g=this.g;$('#hud').innerHTML=`<div class="hl">${heartsHTML(g.hearts,3)}<span class="num">${icon('coin')}${g.coins}</span></div><div class="hl"><span class="lbl">트랙 ${g.track}</span><span class="bar"><i style="width:${g.prog*10}%"></i></span><span class="num">${g.prog}/10</span></div>`},
  spawn(){const p=nextProblem('add',()=>genGame('add'));this.row={p,vals:makeChoices(p,3),y:-16,t0:performance.now(),res:null,ch:-1};bannerProblem(p)},
  speed(){const r=this.row;const base=r&&r.p.tier>=5?11:16;return Math.min(32,base+(this.g.track-1)*.6+Math.min(this.streak,8)*1)*(this.crash>0?.45:1)},
  update(dt){if(paused)return;const sp=this.speed(),bo=this.row&&this.row.boost&&!this.row.res;this.dist+=sp*dt*(bo?9:3);if(this.crash>0)this.crash-=dt;
    const tx=LANES[this.lane];this.cx+=Math.sign(tx-this.cx)*Math.min(Math.abs(tx-this.cx),150*dt);
    if(!this.row){this.wait-=dt;if(this.wait<=0)this.spawn()}
    else{const r=this.row;r.y+=sp*dt*(r.res?3:r.boost?8:1);if(!r.res&&r.y>=98)this.resolve();if(r.res&&r.y>160){this.row=null;this.wait=.35}}
    stepFx(this.fx,dt)},
  resolve(){const r=this.row,g=this.g;let ln=0;LANES.forEach((l,i)=>{if(Math.abs(this.cx-l)<Math.abs(this.cx-LANES[ln]))ln=i});
    r.ch=ln;const v=r.vals[ln],ok=v===r.p.ans;record('add',r.p,v,ok,(r.tb||performance.now())-r.t0,'c');r.res=ok?'ok':'no';this.tn++;if(ok)this.tc++;
    if(ok){this.streak++;const gain=1+Math.floor(this.streak/3)+(r.boost?1:0);g.coins+=gain;g.prog++;burst(this.fx,this.cx,110,'#ffc93c',14);floatTxt(this.fx,this.cx,96,'+'+gain,'#ffc93c');SFX.ok();
      bannerMsg(`<div class="hz">${eqHTML(r.p,null)}</div><span class="msg">${r.boost?'질주 성공! ':'정답! '}${this.streak>=3?this.streak+'번 연속!':''}</span>`);
      if(g.prog>=10)setTimeout(()=>this.trackClear(),700)}
    else{this.streak=0;g.hearts--;this.crash=.9;SFX.no();retryLater(r.p,2);burst(this.fx,this.cx,118,'#ff6f59',10);
      bannerMsg(`<div class="hz">${eqHTML(r.p,'<span class="slot">?</span>')}</div><span class="msg">앗! 정답은 <b style="font-family:var(--f-px)">${r.p.ans}</b>이었어요</span>`);
      if(g.hearts<=0)setTimeout(()=>this.pit(),900)}
    this.hud();touch()},
  trackClear(){const g=this.g,acc=this.tn?this.tc/this.tn:0,up=acc>=.8&&g.tier<7;g.track++;g.prog=0;g.hearts=3;if(up)g.tier++;this.tn=this.tc=0;this.row=null;this.hud();touch();SFX.win();
    overlay(`<h3>트랙 ${g.track-1} 완주!</h3><p>${icon('coin')} 코인 ${g.coins}개</p><p>${up?'다음 트랙은 조금 더 어려운 길이에요':'같은 길을 한 번 더 달리며 연습해요'}</p>`,[['다음 트랙 출발',()=>closeOv()]])},
  pit(){const g=this.g;g.hearts=3;g.tier=Math.max(1,g.tier-1);g.prog=Math.max(0,g.prog-3);this.row=null;this.streak=0;this.hud();touch();
    overlay('<h3>피트 스톱</h3><p>자동차를 고쳤어요. 조금 쉬운 길부터 다시 달려요.</p>',[['다시 출발',()=>closeOv()]])},
  draw(){const s=this.dist;ctx.fillStyle='#4e9f4f';ctx.fillRect(0,0,W,H);ctx.fillStyle='#478f48';for(let y=-32+(s%32);y<H;y+=32)ctx.fillRect(0,Math.round(y),W,16);
    ctx.fillStyle='#5a5672';ctx.fillRect(40,0,112,H);
    for(let y=-16+(s%16),i=Math.floor(s/16);y<H;y+=8,i++){ctx.fillStyle=(i%2)?'#ff6f59':'#f7efd8';ctx.fillRect(36,Math.round(y),4,8);ctx.fillRect(152,Math.round(y),4,8)}
    ctx.fillStyle='#e9e4ff';for(let y=-16+(s%16);y<H;y+=16){ctx.fillRect(77,Math.round(y),2,8);ctx.fillRect(113,Math.round(y),2,8)}
    [[6,0],[176,50],[10,96],[172,140],[2,180]].forEach(([tx,ty])=>{const y=((ty+s*.9)%200)-24;drawSpr(ctx,'tree',tx,Math.round(y),1.5)});
    const r=this.row;if(r){r.vals.forEach((v,i)=>{const x=LANES[i]-15,y=Math.round(r.y);let bg='#ffffff';
        if(r.res){if(v===r.p.ans)bg='#9ef0c4';else if(i===r.ch)bg='#ffb3a6'}
        ctx.fillStyle='#1d1938';ctx.fillRect(x-1,y-1,32,16);ctx.fillStyle=bg;ctx.fillRect(x,y,30,14);ctx.fillStyle='#1d1938';ctx.fillRect(x+14,y+15,2,4);
        const t=String(v);drawTxt(ctx,t,LANES[i]-txtW(t,2)/2,y+2,2,'#1d1938')})}
    let cx=this.cx-10;if(this.crash>0)cx+=Math.round(Math.sin(this.crash*40)*3);
    if(r&&r.boost&&!r.res){ctx.fillStyle='rgba(255,255,255,.7)';for(let i=0;i<10;i++){const lx=(i*37+Math.floor(this.dist*2))%180+6,ly=(i*53+Math.floor(this.dist*7))%H;ctx.fillRect(lx,ly,1,10)}
      ctx.fillStyle=Math.floor(this.dist)%2?'#ffc93c':'#ff8a3c';ctx.fillRect(this.cx-6,138,4,5);ctx.fillRect(this.cx+2,138,4,5)}
    if(!(this.crash>0&&Math.floor(this.crash*12)%2))drawSpr(ctx,'car',cx,114,2,{m:'#ff6f59'});
    drawFx(this.fx)}
};

/* ================= MOLE (subtraction) ================= */
const HOLES=[[38,78],[96,78],[154,78],[38,128],[96,128],[154,128]];
const Mole={
  start(){const U=cur.units.sub,g=U.game;g.tier=g.tier||3;g.prog=g.prog||0;g.hearts=g.hearts||3;g.score=g.score||0;g.round=g.round||1;
    Object.assign(this,{U,g,moles:[],fx:[],streak:0,state:'idle',tn:0,tc:0,left:0,dur:1,wait:0});
    setMode(false,false);$('#ctrl').innerHTML=`<p class="gnote">맞는 답을 들고 있는 두더지를 눌러요. 황금 두더지는 점수 두 배!</p>`;
    this.hud();bannerMsg('<span class="msg">두더지가 나올 준비 중</span>');this.draw();
    overlay(`<h3>뺄셈 두더지</h3><p>라운드 ${g.round} · 정답 10번이면 통과!</p><p>답이 적힌 두더지를 콩 눌러요.</p>`,[['시작!',()=>{closeOv();this.newRound();startLoop(dt=>{this.update(dt);this.draw()})}]])},
  hud(){const g=this.g;$('#hud').innerHTML=`<div class="hl">${heartsHTML(g.hearts,3)}<span class="num">${icon('star')}${g.score}</span></div><div class="hl"><span class="lbl">라운드 ${g.round}</span><span class="bar"><i style="width:${g.prog*10}%"></i></span><span class="num">${g.prog}/10</span></div>`},
  newRound(){const g=this.g,p=nextProblem('sub',()=>genGame('sub'));const k=g.tier>=5?4:3;const vals=makeChoices(p,k);const hs=shuffle([0,1,2,3,4,5]).slice(0,k);
    const gold=Math.random()<.1;this.moles=vals.map((v,i)=>({h:hs[i],v,rise:0,st:'up',t:0,gold:gold&&v===p.ans}));
    this.p=p;this.first=true;this.firstOk=false;this.dur=Math.max(6,(p.tier>=5?13:10)-(g.round-1)*.3-Math.min(this.streak,6)*.4);this.left=this.dur;this.t0=performance.now();this.state='play';bannerProblem(p)},
  update(dt){if(paused)return;for(const m of this.moles){if(m.st==='up')m.rise=Math.min(1,m.rise+dt*5);else m.rise=Math.max(0,m.rise-dt*(m.st==='hit'?2.2:4));if(m.st==='wrong'){m.t-=dt;if(m.t<=0)m.st='down'}}
    if(this.state==='play'){this.left-=dt;if(this.left<=0)this.timeout()}
    else if(this.state==='after'){this.wait-=dt;if(this.wait<=0){if(this.g.prog>=10)this.roundClear();else if(this.g.hearts<=0)this.pit();else this.newRound()}}
    stepFx(this.fx,dt)},
  timeout(){this.moles.forEach(m=>{if(m.st==='up')m.st='down'});this.streak=0;this.state='after';this.wait=1.8;retryLater(this.p,2);
    bannerMsg(`<div class="hz">${eqHTML(this.p,'<span class="slot">?</span>')}</div><span class="msg">두더지가 숨었어요. 정답은 <b style="font-family:var(--f-px)">${this.p.ans}</b></span>`)},
  tap(x,y){if(this.state!=='play')return;let hit=null;
    for(const m of this.moles){const[hx,hy]=HOLES[m.h];if(m.st==='up'&&m.rise>.5&&Math.abs(x-hx)<=17&&y>=hy-36&&y<=hy+6)hit=m}
    if(!hit)return;const p=this.p,ok=hit.v===p.ans,g=this.g;
    if(this.first){this.first=false;record('sub',p,hit.v,ok,performance.now()-this.t0,'c');this.tn++;if(ok)this.tc++;else{g.hearts--;retryLater(p,2)}this.firstOk=ok}
    const[hx,hy]=HOLES[hit.h];
    if(ok){hit.st='hit';this.moles.forEach(m=>{if(m!==hit&&m.st==='up')m.st='down'});
      let pts=this.firstOk?(10+this.streak*2):3;if(hit.gold)pts*=2;g.score+=pts;
      if(this.firstOk){this.streak++;g.prog++}else this.streak=0;
      burst(this.fx,hx,hy-20,hit.gold?'#ffc93c':'#fff1a8',16);floatTxt(this.fx,hx,hy-40,'+'+pts,'#ffc93c');SFX.ok();
      bannerMsg(`<div class="hz">${eqHTML(p,null)}</div><span class="msg">${this.firstOk?(this.streak>=3?this.streak+'번 연속 콩!':'콩! 정답!'):'찾았어요!'}</span>`);
      this.state='after';this.wait=1}
    else{hit.st='wrong';hit.t=.7;SFX.no();this.streak=0;burst(this.fx,hx,hy-18,'#ff6f59',8);
      if(g.hearts<=0){this.state='after';this.wait=1;this.moles.forEach(m=>{if(m.st==='up')m.st='down'});bannerMsg(`<span class="msg">정답은 <b style="font-family:var(--f-px)">${p.ans}</b>이었어요</span>`)}
      else bannerProblem(p,'<span class="msg">다른 두더지를 찾아봐요</span>')}
    this.hud();touch()},
  roundClear(){const g=this.g,acc=this.tn?this.tc/this.tn:0,up=acc>=.8&&g.tier<7;g.round++;g.prog=0;g.hearts=3;if(up)g.tier++;this.tn=this.tc=0;this.state='idle';this.moles=[];this.hud();touch();SFX.win();
    overlay(`<h3>라운드 ${g.round-1} 통과!</h3><p>${icon('star')} 점수 ${g.score}</p><p>${up?'다음 라운드는 두더지가 더 똑똑해져요':'같은 수준으로 한 번 더 연습해요'}</p>`,[['다음 라운드',()=>{closeOv();this.newRound()}]])},
  pit(){const g=this.g;g.hearts=3;g.tier=Math.max(1,g.tier-1);g.prog=Math.max(0,g.prog-3);this.state='idle';this.moles=[];this.hud();touch();
    overlay('<h3>잠깐 쉬어요</h3><p>망치를 고쳤어요. 조금 쉬운 문제로 다시 해 봐요.</p>',[['다시 시작',()=>{closeOv();this.newRound()}]])},
  draw(){ctx.fillStyle='#6cbf5a';ctx.fillRect(0,0,W,H);ctx.fillStyle='#62b151';for(let i=0;i<40;i++){ctx.fillRect((i*37)%W,(i*23)%H,2,1)}
    ctx.fillStyle='#3a6b3f';ctx.fillRect(0,0,W,12);
    if(this.state==='play'){const w=Math.max(0,this.left/this.dur);ctx.fillStyle='#1d1938';ctx.fillRect(8,3,176,6);ctx.fillStyle=w>.3?'#ffc93c':'#ff6f59';ctx.fillRect(9,4,Math.round(174*w),4)}
    for(let i=0;i<6;i++){const[hx,hy]=HOLES[i];ctx.fillStyle='#8a5a3c';ctx.fillRect(hx-19,hy-3,38,9);ctx.fillRect(hx-16,hy-5,32,2);ctx.fillStyle='#2a1c2e';ctx.fillRect(hx-14,hy-3,28,5)}
    for(const m of this.moles){const[hx,hy]=HOLES[m.h];if(m.rise<=0)continue;ctx.save();ctx.beginPath();ctx.rect(hx-20,hy-48,40,48);ctx.clip();
      let y=hy-Math.round(32*m.rise);let x=hx-12;if(m.st==='wrong')x+=Math.round(Math.sin(m.t*50)*2);
      const pal=m.gold?{m:'#ffc93c',l:'#fff0b8'}:{m:'#9a6b4f',l:'#c99777'};
      drawSpr(ctx,'mole',x,y,2,m.st==='hit'?{m:'#ffffff',l:'#ffffff'}:pal);
      ctx.fillStyle='#1d1938';ctx.fillRect(hx-15,y+11,30,13);ctx.fillStyle=m.st==='wrong'?'#ffb3a6':'#ffffff';ctx.fillRect(hx-14,y+12,28,11);
      const t=String(m.v);drawTxt(ctx,t,hx-txtW(t,2)/2,y+13,2,'#1d1938');ctx.restore();
      ctx.fillStyle='#8a5a3c';ctx.fillRect(hx-16,hy+1,32,4)}
    drawFx(this.fx)}
};

/* ================= DUNGEON (multiplication) ================= */
const DAN=[
  {n:'텅텅몽',s:'d0',pal:{m:'#b7a8ff',d:'#7a6ad1'}},
  {n:'하나몽',s:'d1',pal:{m:'#69bfff',d:'#3a74c9'}},
  {n:'둘둘체리',s:'d2',pal:{m:'#ff5e6e',d:'#b52a3c'}},
  {n:'세모돌이',s:'d3',pal:{m:'#ffb13c',d:'#b5701a'}},
  {n:'네발곰',s:'d4',pal:{m:'#a8784f',d:'#6e4a2c',l:'#e0c09a'}},
  {n:'다섯별',s:'d5',pal:{m:'#ffd23c',d:'#c99512'}},
  {n:'육각벌',s:'d6',pal:{m:'#ffcf3c',d:'#3a2f20'}},
  {n:'칠색뱀',s:'d7',pal:{m:'#ff5e5e',A:'#ff5e5e',B:'#ff9f3c',C:'#ffd23c',D:'#5fd38a',E:'#3cb6ff',F:'#4f6cff',G:'#a06cff'}},
  {n:'여덟문어',s:'d8',pal:{m:'#ff8fb1',d:'#c9557a',l:'#ffd0de'}},
  {n:'아홉꼬리',s:'d9',pal:{m:'#ff9a3c',d:'#b5621a',l:'#fff1df'}}];
const STAGE=['미발견','알','아기','어린이','완성'];
const DAN_ORDER=[2,5,3,6,4,8,7,9,1,0];
const MASTER_MS=5000;
const factMastered=s=>!!s&&s.n>=2&&s.c/s.n>=.8&&(s.tn?s.t/s.tn:9e9)<=MASTER_MS;
const danFacts=d=>Array.from({length:9},(_,i)=>d+'x'+(i+1));
function danInfo(U,d){const sk=U.skills||{},fs=danFacts(d),met=fs.some(k=>sk[k]),m=fs.filter(k=>factMastered(sk[k])).length;return{met,m,fs,stage:!met?0:m<3?1:m<6?2:m<9?3:4}}
const nextNeed=I=>I.stage>=4?0:(I.stage<=1?3:I.stage===2?6:9)-I.m;
function drawPet(c,d,stage){const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.clearRect(0,0,c.width,c.height);const S=c.width/28,D=DAN[d];
  if(stage<=1){drawSpr(x,'egg',9*S,14*S,S,stage===0?{'*':'#4a4580'}:{m:D.pal.m});return}
  const sc=stage===2?1:2,w=sprW(D.s)*sc*S,h=sprH(D.s)*sc*S;
  drawSpr(x,D.s,Math.round((c.width-w)/2),c.height-h-(stage===2?3*S:0),sc*S,D.pal);
  if(stage===4){const cx=c.width/2;x.fillStyle='#ffc93c';x.fillRect(cx-4*S,2*S,8*S,2*S);x.fillRect(cx-4*S,0,2*S,2*S);x.fillRect(cx-1*S,0,2*S,2*S);x.fillRect(cx+2*S,0,2*S,2*S)}}
function dunG(){const g=cur.units.mul.game;
  if(g.ver!==2){g.ver=2;g.unlocked=Math.min(g.unlocked||0,5);g.floor=Math.min(g.floor||0,g.unlocked);g.mi=0;g.mhp=null;g.wd=null}
  g.unlocked=g.unlocked||0;g.floor=g.floor||0;g.mi=g.mi||0;if(g.mhp===undefined)g.mhp=null;if(g.wd===undefined)g.wd=null;g.hp=g.hp||5;g.best=g.best||0;return g}
function floorTaught(f){const t=taughtDans();return FLOORS[f].d.every(x=>t.includes(x))}
function floorOpen(f){return f<=dunG().unlocked&&floorTaught(f)}
const floorQ=F=>F.mons*F.hp+F.bhp;
let petSel=null,lobbyF=null;
function openLobby(){const g=dunG(),U=cur.units.mul;PU='mul';$('#tbUnit').textContent='곱셈 던전';show('dlobby');
  if(lobbyF==null||!floorOpen(lobbyF))lobbyF=floorOpen(g.floor)?g.floor:0;
  const tw=$('#tower');tw.innerHTML='';
  for(let z=3;z>=0;z--){const box=document.createElement('div');box.className='zone';box.innerHTML=`<b>${ZONES[z].n} <small>${z*5+1}~${z*5+5}층</small></b><div class="ztiles"></div>`;const zt=box.querySelector('.ztiles');
    for(let f=z*5;f<z*5+5;f++){const open=floorOpen(f),clear=f<g.unlocked||g.best>f;const b=document.createElement('button');b.type='button';
      b.className='ftile'+(clear?' clear':'')+(f===g.floor&&open?' now':'')+(open?'':' lock')+(f===lobbyF?' sel':'');b.textContent=f+1;
      b.setAttribute('aria-label',`${f+1}층${open?'':' 잠김'}`);if(open)b.onclick=()=>{lobbyF=f;openLobby()};else b.disabled=true;zt.appendChild(b)}
    tw.appendChild(box)}
  const F=FLOORS[lobbyF];
  $('#floorInfo').innerHTML=`<b>${lobbyF+1}층 · ${F.n}</b><span>${danLabel(F.d)} · 야생 펫 ${F.mons}마리, 보스 ${F.bn}</span><span>문제 약 ${floorQ(F)}개${F.fm==='heavy'?' · □ 문제가 많아요':F.fm==='allow'?' · □ 문제도 나와요':''}</span>${g.unlocked<19&&!floorTaught(Math.min(19,g.unlocked+1))&&g.unlocked>=lobbyF?'<span class="lockmsg">다음 층은 아직 배우지 않은 단이 나와서 잠겨 있어요</span>':''}`;
  $('#btnDunGo').textContent=lobbyF===g.floor&&(g.mi>0||g.mhp)?`${lobbyF+1}층 이어서 싸우기`:`${lobbyF+1}층 도전하기`;
  $('#btnDunGo').onclick=()=>{if(g.floor!==lobbyF){g.floor=lobbyF;g.mi=0;g.mhp=null;g.wd=null;touch()}Dun.open()};
  const dex=$('#dex');dex.innerHTML='';let done=0,grown=0;const sk=U.skills||{};
  if(petSel==null)petSel=DAN_ORDER.find(d=>danInfo(U,d).met)??2;
  for(const d of DAN_ORDER){const I=danInfo(U,d);if(I.stage===4)done++;if(I.stage>=2)grown++;
    const b=document.createElement('button');b.type='button';b.className='pet st'+I.stage+(petSel===d?' on':'');
    b.innerHTML=`<canvas class="pix" width="28" height="28"></canvas><b>${d}단</b><span>${I.met?DAN[d].n:'???'}</span><em>${STAGE[I.stage]}</em><span class="fbar">${I.fs.map(k=>`<i class="${factMastered(sk[k])?'on':sk[k]?'seen':''}"></i>`).join('')}</span>`;
    b.onclick=()=>{petSel=d;openLobby()};dex.appendChild(b);drawPet(b.querySelector('canvas'),d,I.stage)}
  $('#dexCount').textContent=`자란 펫 ${grown} · 완성 ${done}/10`;renderPetDetail(petSel)}
function renderPetDetail(d){const U=cur.units.mul,I=danInfo(U,d),D=DAN[d],sk=U.skills||{},taught=taughtDans().includes(d);
  const note=!I.met?'아직 만나지 못했어요. 던전이나 훈련에서 만나요':I.stage===4?'모든 곱을 익혀 완성됐어요!':`${nextNeed(I)}개 더 익히면 ${STAGE[I.stage+1]}(으)로 자라요`;
  $('#petDetail').innerHTML=`<canvas class="pix" id="petBig" width="56" height="56"></canvas><div class="pdi"><b>${d}단 ${I.met?D.n:'???'} · ${STAGE[I.stage]}</b><span>${note}</span><div class="facts">${I.fs.map(k=>{const s=sk[k];return`<span class="${factMastered(s)?'on':s?'seen':''}">${k.replace('x','×')}</span>`}).join('')}</div><span class="lockmsg">초록 칸은 5초 안에 정확히 답하는 곱이에요</span>${taught?`<button class="pbtn sky sm" type="button" id="btnTrain">${d}단 훈련하기</button>`:'<span class="lockmsg">아직 배우지 않은 단이에요</span>'}</div>`;
  drawPet($('#petBig'),d,I.stage);if(taught)$('#btnTrain').onclick=()=>Dun.open({train:d})}
const Dun={
  open(opt){const g=dunG(),train=opt&&opt.train!=null?opt.train:null;
    if(train==null){let f=Math.min(g.floor,g.unlocked);while(f>0&&!floorOpen(f))f--;if(f!==g.floor){g.floor=f;g.mi=0;g.mhp=null;g.wd=null}}
    const f=train==null?g.floor:Math.max(0,FLOORS.findIndex(F=>F.d.includes(train)));
    Object.assign(this,{g,train,f,F:FLOORS[f],M:train==null?g:{mi:0,mhp:null,wd:train},fx:[],anim:null,hOff:0,mOff:0,flashM:0,flashH:0,shake:0,mAlpha:1,inp:'',p:null,busy:false,t:0,combo:0,slash:0});
    PU='mul';$('#tbUnit').textContent='곱셈 던전';show('game');setMode(true,false);G=this;rtReset();
    $('#ctrl').innerHTML=`<div class="keypad" id="kpDun"></div><p class="gnote">빨리 맞히면 치명타! 5번 연속이면 필살기!</p><div style="display:flex;justify-content:center;margin-top:8px"><button class="pbtn sm ghost" type="button" id="btnMap">던전 지도와 도감</button></div>`;
    makeKeypad($('#kpDun'),k=>this.key(k),'공격!');$('#btnMap').onclick=()=>{stopLoop();G=null;flush();openLobby()};
    this.spawn();this.hud();bannerMsg(`<span class="msg">${train!=null?train+'단 훈련장':(f+1)+'층 '+this.F.n}</span>`);this.draw();
    const F=this.F,intro=train!=null?`<h3>${train}단 훈련</h3><p>상대: ${DAN[train].n}</p><p>${train}단 곱만 나와요. 맞힐수록 ${train}단 펫이 자라요.</p>`:`<h3>${f+1}층 · ${F.n}</h3><p>${danLabel(F.d)} · 야생 펫 ${F.mons}마리와 보스 ${F.bn}</p><p>문제 약 ${floorQ(F)}개를 풀면 클리어!</p>`;
    overlay(intro+'<p>답을 쓰고 공격 버튼을 눌러요.</p>',[['싸우기!',()=>{closeOv();this.newQ();startLoop((dt,t)=>{this.t=t;this.update(dt);this.draw()})}]])},
  boss(){return this.train==null&&this.M.mi>=this.F.mons},
  spawn(){const M=this.M,F=this.F;
    if(this.boss())this.maxHp=F.bhp;
    else{if(M.wd==null){const pool=F.d.filter(x=>taughtDans().includes(x));M.wd=pool.length<=2?pool[M.mi%pool.length]:pool[R(0,pool.length-1)]}this.maxHp=this.train!=null?5:F.hp}
    if(M.mhp==null||M.mhp<=0)M.mhp=this.maxHp;this.mAlpha=1;this.metBefore=this.boss()?true:danInfo(cur.units.mul,M.wd).met},
  spr(){if(this.boss())return{s:this.F.bs,pal:MPAL[this.F.bs][this.F.bp],sc:4};const D=DAN[this.M.wd];return{s:D.s,pal:D.pal,sc:3}},
  label(){if(this.train!=null)return`${this.train}단 훈련 · ${DAN[this.train].n}`;if(this.boss())return`${this.f+1}층 보스 · ${this.F.bn}`;return`${this.f+1}층 · 야생 ${this.M.wd}단 ${DAN[this.M.wd].n} · ${this.M.mi+1}/${this.F.mons}`},
  hud(){$('#hud').innerHTML=`<div class="hl">${heartsHTML(this.g.hp,5)}${this.combo>=2?`<span class="num">${this.combo} 콤보</span>`:''}</div><div class="hl"><span class="lbl">${esc(this.label())}</span></div>`},
  newQ(){const F=this.F,M=this.M;const dans=this.boss()?F.d.filter(x=>taughtDans().includes(x)):[M.wd];
    const fm=this.train!=null?'allow':(F.fm==='none'&&(this.g.unlocked>this.f||this.boss())?'allow':F.fm);
    this.p=nextProblem('mul',()=>genMul(dans,cur.units.mul,RT.rk.slice(-4),fm));this.inp='';this.t0=performance.now();this.busy=false;this.renderQ()},
  renderQ(){const sl=`<span class="slot live" id="dslot">${this.inp===''?'&nbsp;':esc(this.inp)}</span>`;
    lastSay=this.p;$('#banner').innerHTML=`<div class="hz">${eqHTML(this.p,sl)}</div><i class="crit ${RM?'':'run'}"></i><button class="listen" type="button" data-listen>듣기</button>`;speakP(this.p)},
  key(k){if(!this.p||this.busy||paused)return;
    if(k==='del')this.inp=this.inp.slice(0,-1);else if(k==='ok'){if(this.inp!=='')this.submit();return}else if(this.inp.length<2){this.inp=(this.inp==='0'?'':this.inp)+k;SFX.tap()}
    const s=$('#dslot');if(s)s.innerHTML=this.inp===''?'&nbsp;':esc(this.inp)},
  onKey(e,k){if(k){this.key(k);return true}return false},
  submit(){const p=this.p,v=+this.inp,ok=v===p.ans,ms=performance.now()-this.t0,U=cur.units.mul;this.busy=true;
    const before=p.a<=9?danInfo(U,p.a).stage:0;record('mul',p,v,ok,ms,'k');const after=p.a<=9?danInfo(U,p.a).stage:0;
    const cb=$('#banner .crit');if(cb)cb.classList.remove('run');
    if(ok){this.combo++;let dmg=1,lab='';if(ms<3000){dmg++;lab='치명타!'}if(this.combo%5===0){dmg++;lab='필살기!'}
      this.anim={type:'atk',t:0,dur:.5,dmg,lab,hit:false};SFX.ok();
      let msg=`${lab||'명중!'} ${p.fmt==='m'?`${p.a} × ${p.b} = ${p.c}`:''}`;
      if(after>before&&after>=2){msg=`${p.a}단 펫 ${DAN[p.a].n}이(가) ${STAGE[after]}(으)로 자랐어요!`;setTimeout(()=>SFX.win(),300)}
      $('#banner').insertAdjacentHTML('beforeend',`<span class="msg">${msg}</span>`)}
    else{this.combo=0;this.anim={type:'matk',t:0,dur:.55,hit:false};SFX.no();retryLater(p,2)}
    this.hud();touch()},
  update(dt){if(paused)return;stepFx(this.fx,dt);if(this.flashM>0)this.flashM-=dt;if(this.flashH>0)this.flashH-=dt;if(this.shake>0)this.shake-=dt;if(this.slash>0)this.slash-=dt;
    const a=this.anim;if(!a)return;a.t+=dt;const k=a.t/a.dur,M=this.M;
    if(a.type==='atk'){this.hOff=Math.round(Math.sin(Math.min(1,k)*Math.PI)*56);
      if(!a.hit&&k>=.45){a.hit=true;M.mhp-=a.dmg;this.flashM=.25;SFX.hit();const mx=this.mx()+this.mw()/2;burst(this.fx,mx,this.my()+10,'#ffffff',10);floatTxt(this.fx,mx,this.my()-6,String(a.dmg)+(a.lab?'!':''),a.lab?'#ffc93c':'#ffffff');this.slash=.2}
      if(k>=1){this.hOff=0;this.anim=null;if(M.mhp<=0)this.defeat();else{touch();this.newQ()}}}
    else if(a.type==='matk'){this.mOff=-Math.round(Math.sin(Math.min(1,k)*Math.PI)*60);
      if(!a.hit&&k>=.5){a.hit=true;this.g.hp--;this.flashH=.35;if(!RM)this.shake=.25;this.hud()}
      if(k>=1){this.mOff=0;this.anim=null;this.hint()}}
    else if(a.type==='die'){this.mAlpha=Math.max(0,1-k);if(k>=1){this.anim=null;this.afterDie()}}},
  hint(){const p=this.p;
    overlay(`<h3>앗, 반격을 받았어요!</h3><p>정답은 <b style="font-family:var(--f-px)">${p.ans}</b></p>${hintHTML(p)}`,[['알겠어!',()=>{closeOv();if(this.g.hp<=0)this.rest();else this.newQ()}]])},
  rest(){this.g.hp=5;this.M.mhp=this.maxHp;this.combo=0;this.hud();touch();
    overlay('<h3>여관에서 쉬어요</h3><p>하트가 모두 찼어요. 상대도 기운을 되찾았대요. 다시 도전!</p>',[['다시 싸우기',()=>{closeOv();this.newQ()}]])},
  defeat(){const sp=this.spr();burst(this.fx,this.mx()+this.mw()/2,this.my()+12,sp.pal.m||'#ffffff',24);this.anim={type:'die',t:0,dur:.6};SFX.win();touch()},
  petLine(d){const I=danInfo(cur.units.mul,d);return`${d}단 펫 ${DAN[d].n}: <b>${STAGE[I.stage]}</b> · 9개 중 ${I.m}개 익힘`},
  afterDie(){const g=this.g,M=this.M,f=this.f,F=this.F;
    if(this.train!=null){const d=this.train;M.mhp=null;this.spawn();this.hud();
      overlay(`<h3>훈련 완료!</h3><p>${this.petLine(d)}</p>`,[['한 번 더',()=>{closeOv();this.newQ()}],['도감 보기',()=>{closeOv();stopLoop();G=null;petSel=d;openLobby()},'ghost']]);return}
    if(this.boss()){g.mi=0;g.mhp=null;g.wd=null;const nf=f+1;let msg='';g.best=Math.max(g.best,f+1);
      if(f===19)msg='구구 마왕을 물리쳤어요! 던전 정복!';
      else if(g.unlocked<nf){g.unlocked=nf;msg=floorTaught(nf)?`${nf+1}층이 열렸어요!`:'다음 층은 선생님과 더 배운 뒤에 열려요.'}
      else msg='보스를 또 이겼어요! 실력이 쑥쑥.';
      this.spawn();touch();this.hud();
      const btns=[];if(nf<=19&&floorOpen(nf))btns.push([`${nf+1}층으로`,()=>{g.floor=nf;touch();closeOv();stopLoop();this.open()}]);
      btns.push(['이 층 다시',()=>{closeOv();this.newQ()}],['던전 지도',()=>{closeOv();stopLoop();G=null;lobbyF=null;openLobby()},'ghost']);
      overlay(`<h3>${f+1}층 클리어!</h3><p>${F.bn}을(를) 물리쳤어요.</p><p>${msg}</p>`,btns);return}
    const old=M.wd,first=!this.metBefore;g.mi++;g.mhp=null;g.wd=null;this.spawn();this.hud();touch();
    overlay(`<h3>${DAN[old].n} 격파!</h3>${first?`<p>도감에 ${old}단 펫이 새로 등록됐어요!</p>`:''}<p>${this.petLine(old)}</p><p>${this.boss()?`이제 보스 ${F.bn} 차례예요!`:`다음 상대가 다가와요 (${g.mi+1}/${F.mons})`}</p>`,[['계속',()=>{closeOv();this.newQ()}]])},
  mw(){const s=this.spr();return sprW(s.s)*s.sc},
  mx(){return 168-this.mw()+this.mOff},
  my(){const s=this.spr(),h=sprH(s.s)*s.sc;return s.s==='bat'?40+Math.round(Math.sin(this.t*4)*4):100-h+Math.round(Math.sin(this.t*3)*1)},
  draw(){const F=this.F,M=this.M;ctx.save();if(this.shake>0)ctx.translate(Math.round(Math.random()*4-2),Math.round(Math.random()*4-2));
    ctx.fillStyle=F.wall;ctx.fillRect(-4,-4,W+8,H+8);ctx.fillStyle=F.brick;
    for(let y=0;y<100;y+=8){ctx.fillRect(0,y,W,1);for(let x=((y/8)%2)*8;x<W;x+=16)ctx.fillRect(x,y,1,8)}
    ctx.fillStyle=F.fl;ctx.fillRect(0,100,W,44);ctx.fillStyle='rgba(0,0,0,.25)';for(let x=0;x<W;x+=16)ctx.fillRect(x,100,1,44);ctx.fillRect(0,100,W,2);
    [[18,26],[168,26]].forEach(([x,y],i)=>{drawSpr(ctx,'torch',x,y,2);const fl=Math.floor((this.t||0)*8+i)%3;ctx.fillStyle=['#ffc93c','#ff8a3c','#fff1a8'][fl];ctx.fillRect(x+4,y-4-fl,2,3)});
    if(this.train==null)drawTxt(ctx,(this.f+1)+'F',90,4,1,'#f7efd8','#1d1938');
    const hy=60+Math.round(Math.sin((this.t||0)*3)*1);
    drawSpr(ctx,'hero',16+this.hOff,hy,3,this.flashH>0&&Math.floor(this.flashH*20)%2?{'*':'#ff6f59'}:null);
    ctx.fillStyle='#c9d2e3';ctx.fillRect(16+this.hOff+36,hy+18,12,3);ctx.fillStyle='#7a4a2a';ctx.fillRect(16+this.hOff+33,hy+17,3,5);
    if(this.mAlpha>0){ctx.globalAlpha=this.mAlpha;const sp=this.spr();
      drawSpr(ctx,sp.s,this.mx(),this.my(),sp.sc,this.flashM>0?{'*':'#ffffff'}:sp.pal);
      if(this.boss()){ctx.fillStyle='#ffc93c';const cx=this.mx()+this.mw()/2,ty=this.my();ctx.fillRect(cx-8,ty-8,16,4);ctx.fillRect(cx-8,ty-12,4,4);ctx.fillRect(cx-2,ty-12,4,4);ctx.fillRect(cx+4,ty-12,4,4)}
      else{const t=String(M.wd)+'x';drawTxt(ctx,t,this.mx()+this.mw()/2-txtW(t,1)/2,this.my()-8,1,'#ffc93c','#1d1938')}
      ctx.globalAlpha=1;
      const bw=56,bx=Math.round(168-bw),by=12,hp=Math.max(0,M.mhp||0)/this.maxHp;
      ctx.fillStyle='#1d1938';ctx.fillRect(bx-2,by-2,bw+4,10);ctx.fillStyle='#4a2330';ctx.fillRect(bx,by,bw,6);ctx.fillStyle='#ff6f59';ctx.fillRect(bx,by,Math.round(bw*hp),6);
      drawTxt(ctx,'HP',bx-14,by,1,'#f7efd8')}
    if(this.slash>0){ctx.fillStyle='#ffffff';const sx=this.mx()+4,sy=this.my()+2;for(let i=0;i<14;i++)ctx.fillRect(sx+i*2,sy+i*2,3,2)}
    drawFx(this.fx);ctx.restore()}
};

/* ================= GAME PICKER ================= */
const GAMES={
  race:{n:'덧셈 레이스',d:'정답 차선으로 운전해요. 확신이 들면 질주!'},
  block:{n:'합 블록',d:'떨어지는 수를 쌓아 목표 합을 만들면 블록이 사라져요'},
  frog:{n:'개구리 수직선',d:'수직선 위 연잎으로 개구리를 점프시켜요'},
  mole:{n:'뺄셈 두더지',d:'정답을 들고 나온 두더지를 콩!'},
  dun:{n:'곱셈 던전',d:'20층 던전을 오르며 구구 펫을 키워요'},
  pair:{n:'구구 짝꿍',d:'곱셈 카드와 답 카드를 빨리 짝지어요'},
  rain:{n:'셈 비',d:'떨어지는 문제의 답을 써서 빗방울을 터뜨려요'}};
const UGAMES={add:['race','block','rain','frog'],sub:['mole','rain','frog'],mul:['dun','pair','rain']};
function arc(u,id){const U=cur.units[u];U.arc=U.arc||{};return U.arc[id]||(U.arc[id]={best:0,plays:0})}
function arcEnd(u,id,score){const a=arc(u,id);a.plays++;const nb=score>a.best;if(nb)a.best=score;touch();return nb}
let PU=null;
function showPicker(u){PU=u;const U=cur.units[u];setUnitLabel(u);show('pick');
  $('#pickHello').textContent=`${callName()}, 어떤 게임으로 연습할래?`;
  const box=$('#pickCards');box.innerHTML='';
  UGAMES[u].forEach((id,i)=>{const G0=GAMES[id],a=(U.arc||{})[id],g=U.game||{};const c=document.createElement('div');c.className='pp ucard'+(i===0?' feature':'');
    const extra=id==='dun'?`${(g.best||0)}층까지 클리어`:id==='race'?`트랙 ${g.track||1}`:id==='mole'?`라운드 ${g.round||1}`:a&&a.best?`최고 점수 ${a.best}`:'처음 도전';
    c.innerHTML=`<canvas class="ic pix" width="48" height="36"></canvas><div class="uinfo"><span class="tag">STEP 3${U.last===id?' · 지난번에 한 게임':''}</span><h3>${G0.n}</h3><p class="st">${G0.d}</p><p class="st"><b>${extra}</b></p><div class="bt"><button class="pbtn mint" type="button">${U.last===id?'이어서 하기':'시작하기'}</button></div></div>`;
    c.querySelector('button').onclick=()=>launch(u,id);box.appendChild(c);drawGameIcon(c.querySelector('canvas'),id)})}
function launch(u,id){const U=cur.units[u];U.last=id;PU=u;touch();rtReset();paused=false;ov.hidden=true;
  if(id==='dun'){openLobby();return}
  show('game');$('#tbUnit').textContent=GAMES[id].n;G={race:Racer,mole:Mole,rain:Rain,block:Block,frog:Frog,pair:Pair}[id];G.start(u)}
function setMode(pad,dom){$('#scr-game').classList.toggle('withpad',!!pad);cv.hidden=!!dom;$('#board').hidden=!dom;if(!dom)$('#board').innerHTML=''}
function backToPicker(u){closeOv();stopLoop();G=null;flush();showPicker(u)}
const BLOCKC=['#000','#ff6f59','#ff9f3c','#ffd23c','#45c98f','#3cb6ff','#8f9bff','#c39bff','#ff8fb1','#d9b48f'];
function drawGameIcon(c,id){if(id==='race')return drawUnitIcon(c,'add');if(id==='mole')return drawUnitIcon(c,'sub');if(id==='dun')return drawUnitIcon(c,'mul');
  const x=c.getContext('2d');x.imageSmoothingEnabled=false;
  if(id==='rain'){x.fillStyle='#2b3a6b';x.fillRect(0,0,48,36);x.fillStyle='#9fd8ff';[[6,4],[42,12],[4,22],[40,26]].forEach(([a,b])=>x.fillRect(a,b,1,4));x.fillStyle='#3a6b3f';x.fillRect(0,31,48,5);x.fillStyle='#1d1938';x.fillRect(11,9,26,11);x.fillStyle='#d9f0ff';x.fillRect(12,10,24,9);drawTxt(x,'6x7',14,12,1,'#1d1938')}
  else if(id==='block'){x.fillStyle='#1f1b45';x.fillRect(0,0,48,36);[[1,3,7],[2,3,4],[2,2,6],[3,3,9],[4,3,2],[4,1,8]].forEach(([cc,r,n])=>{x.fillStyle='#1d1938';x.fillRect(4+cc*8,4+r*8,8,8);x.fillStyle=BLOCKC[n];x.fillRect(5+cc*8,5+r*8,6,6)})}
  else if(id==='frog'){x.fillStyle='#2f6fb0';x.fillRect(0,0,48,36);x.fillStyle='#f7efd8';x.fillRect(2,26,44,1);x.fillStyle='#58b45a';[4,20,36].forEach(a=>x.fillRect(a,27,9,3));drawSpr(x,'frog',18,13,1,{g:'#7ed957'})}
  else if(id==='pair'){x.fillStyle='#3a335e';x.fillRect(0,0,48,36);x.fillStyle='#1d1938';x.fillRect(3,5,20,26);x.fillRect(25,5,20,26);x.fillStyle='#f7efd8';x.fillRect(4,6,18,24);x.fillStyle='#bfe4ff';x.fillRect(26,6,18,24);drawTxt(x,'7x8',6,15,1,'#1d1938');drawTxt(x,'56',31,15,1,'#1d1938')}}

/* ================= RAIN (typing, any unit) ================= */
const Rain={
  start(u){const U=cur.units[u];Object.assign(this,{u,U,drops:[],fx:[],score:0,lvl:1,pops:0,hp:5,inp:'',spawnT:.6,tier:u==='mul'?0:(U.game.tier||3),win:[],flash:0,t:0});
    setMode(true,false);
    $('#ctrl').innerHTML=`<div class="keypad" id="kpRain"></div><p class="gnote">빗방울의 답을 쓰고 터뜨리기! 같은 답의 빗방울이 터져요.</p>`;
    makeKeypad($('#kpRain'),k=>this.key(k),'펑!');
    this.hud();this.renderIn();this.draw();
    overlay(`<h3>셈 비</h3><p>${UNAME[u]} 문제가 빗방울로 떨어져요.</p><p>땅에 닿기 전에 답을 써서 터뜨려요. 꽃 5송이를 지켜요!</p><p>최고 점수 ${arc(u,'rain').best}</p>`,[['시작!',()=>{closeOv();startLoop((dt,t)=>{this.t=t;this.update(dt);this.draw()})}]])},
  gen(){const u=this.u;if(u==='mul')return nextProblem('mul',()=>genMul(taughtDans(),cur.units.mul,RT.rk.slice(-4),'none'));
    return nextProblem(u,()=>{const f=focusOf(u);if(f&&f.length===2&&Math.random()<.4)return genTier(u,+f.slice(1),'h');return genTier(u,mixCarry(Math.max(1,Math.min(u==='sub'?6:7,this.tier-(Math.random()<.25?1:0)))),'h')})},
  spawn(){const p=this.gen(),s=`${p.a}${p.op==='×'?'x':p.op==='−'?'-':'+'}${p.b}`,w=txtW(s,2)+8;let x=4;
    for(let i=0;i<14;i++){x=R(4,188-w);if(!this.drops.some(d=>d.y<44&&Math.abs(d.x-x)<w+6))break}
    this.drops.push({p,s,w,x,y:-14,t0:performance.now(),gold:Math.random()<.06})},
  hud(){$('#hud').innerHTML=`<div class="hl">${heartsHTML(this.hp,5)}<span class="num">${icon('star')}${this.score}</span></div><div class="hl"><span class="lbl">비 ${this.lvl}단계 · 터뜨림 ${this.pops}</span></div>`},
  renderIn(msg){$('#banner').innerHTML=`<div class="hz"><span style="font-family:var(--f-kr)">답</span><span class="slot live" id="rslot">${this.inp===''?'&nbsp;':esc(this.inp)}</span></div><span class="msg">${esc(msg||'떨어지는 문제의 답을 써요')}</span>`},
  key(k){if(paused)return;if(k==='del')this.inp=this.inp.slice(0,-1);else if(k==='ok'){if(this.inp!=='')this.submit();return}else if(this.inp.length<3){this.inp=(this.inp==='0'?'':this.inp)+k;SFX.tap()}
    const s=$('#rslot');if(s)s.innerHTML=this.inp===''?'&nbsp;':esc(this.inp)},
  onKey(e,k){if(k){this.key(k);return true}return false},
  submit(){const v=+this.inp;this.inp='';const hits=this.drops.filter(d=>d.p.ans===v);
    if(hits.length){const d=hits.reduce((a,b)=>b.y>a.y?b:a);this.pop(d,v);
      if(d.gold){this.drops.forEach(o=>{burst(this.fx,o.x+o.w/2,o.y+6,'#ffc93c',8);this.score+=5});this.drops=[];this.renderIn('무지개 빗방울! 모두 터졌어요')}
      else this.renderIn(this.pops%8===0?'비가 더 세게 내려요!':'펑! 정답')}
    else{const d=this.drops.reduce((a,b)=>!a||b.y>a.y?b:a,null);if(d){record(this.u,d.p,v,false,performance.now()-d.t0,'c');this.adapt(false);retryLater(d.p,3)}
      this.flash=.3;SFX.no();this.renderIn(`${v}이(가) 답인 빗방울은 없어요`)}
    this.hud()},
  pop(d,v){this.drops.splice(this.drops.indexOf(d),1);record(this.u,d.p,v,true,performance.now()-d.t0,'c');this.adapt(true);this.pops++;
    const pts=10+this.lvl*2+Math.max(0,Math.round((112-d.y)/12));this.score+=pts;burst(this.fx,d.x+d.w/2,d.y+6,d.gold?'#ffc93c':'#9fd8ff',14);floatTxt(this.fx,d.x+d.w/2,d.y-4,'+'+pts,'#ffc93c');SFX.ok();
    if(this.pops%8===0)this.lvl++},
  adapt(ok){if(this.u==='mul')return;this.win.push(ok?1:0);if(this.win.length>=10){const a=this.win.reduce((s,x)=>s+x,0)/10;if(a>=.9&&this.tier<7)this.tier++;else if(a<.6&&this.tier>1)this.tier--;this.win=[]}},
  update(dt){if(paused)return;stepFx(this.fx,dt);if(this.flash>0)this.flash-=dt;
    const v=4.5+this.lvl*.9,every=Math.max(1.7,4.8-this.lvl*.3),maxD=Math.min(6,3+Math.floor(this.lvl/2));
    this.spawnT-=dt;if(this.spawnT<=0&&this.drops.length<maxD){this.spawn();this.spawnT=every}
    for(const d of this.drops.slice()){d.y+=v*dt;if(d.y>=112){this.drops.splice(this.drops.indexOf(d),1);this.hp--;retryLater(d.p,2);burst(this.fx,d.x+d.w/2,120,'#69bfff',10);SFX.no();
      this.renderIn(`앗! ${d.s.replace('x','×')}의 답은 ${d.p.ans}이었어요`);this.hud();if(this.hp<=0){this.over();return}}}},
  over(){stopLoop();const nb=arcEnd(this.u,'rain',this.score);
    overlay(`<h3>비가 그쳤어요</h3><p>${icon('star')} 점수 ${this.score}${nb?' · 최고 기록!':''}</p><p>터뜨린 빗방울 ${this.pops}개</p>`,[['다시 하기',()=>{closeOv();this.start(this.u)}],['게임 고르기',()=>backToPicker(this.u),'ghost']])},
  draw(){const t=this.t||0;ctx.fillStyle='#2b3a6b';ctx.fillRect(0,0,W,H);ctx.fillStyle='#31437a';ctx.fillRect(0,44,W,40);ctx.fillStyle='#384c86';ctx.fillRect(0,84,W,40);
    ctx.fillStyle='#5a72b0';for(let i=0;i<30;i++){const x=(i*53+Math.floor(t*30))%W,y=(i*37+Math.floor(t*95))%124;ctx.fillRect(x,y,1,4)}
    ctx.fillStyle='#232a52';[[0,98,18,26],[20,90,14,34],[152,94,16,30],[170,86,22,38]].forEach(r=>ctx.fillRect(r[0],r[1],r[2],r[3]));
    ctx.fillStyle='#ffe27a';[[4,102],[10,110],[24,96],[156,100],[176,92],[182,104]].forEach(([a,b])=>ctx.fillRect(a,b,2,2));
    ctx.fillStyle='#3a6b3f';ctx.fillRect(0,124,W,20);ctx.fillStyle='#4e9f4f';ctx.fillRect(0,124,W,2);
    for(let i=0;i<5;i++){const x=36+i*30;if(i<this.hp){ctx.fillStyle='#2f7a3a';ctx.fillRect(x+3,116,2,8);ctx.fillStyle=['#ff6f59','#ffc93c','#ff8fb1','#a98cff','#69bfff'][i];ctx.fillRect(x,110,8,5);ctx.fillRect(x+2,108,4,9);ctx.fillStyle='#fff1a8';ctx.fillRect(x+3,111,2,2)}else{ctx.fillStyle='#6b5a3a';ctx.fillRect(x+2,121,4,3)}}
    for(const d of this.drops){const y=Math.round(d.y);ctx.fillStyle='#1d1938';ctx.fillRect(d.x-1,y-1,d.w+2,16);ctx.fillRect(d.x+d.w/2-3,y-5,6,5);
      ctx.fillStyle=d.gold?'#ffe27a':'#d9f0ff';ctx.fillRect(d.x,y,d.w,14);ctx.fillRect(d.x+d.w/2-2,y-4,4,4);ctx.fillStyle=d.gold?'#ffc93c':'#9fd8ff';ctx.fillRect(d.x,y+11,d.w,3);
      drawTxt(ctx,d.s,d.x+4,y+2,2,'#1d1938')}
    if(this.flash>0){ctx.fillStyle='rgba(255,111,89,.25)';ctx.fillRect(0,0,W,H)}
    drawFx(this.fx)}
};

/* ================= SUM BLOCK (tetris-like, addition) ================= */
const Block={NC:6,NR:8,CS:16,X0:48,Y0:8,
  start(){const U=cur.units.add;Object.assign(this,{u:'add',U,cols:Array.from({length:6},()=>[]),fx:[],score:0,lvl:1,clears:0,combo:0,curB:null,wait:.5,fallT:0,flashC:-1,flashT:0,t:0,T:null});
    this.T=this.pickT();this.next=this.genN();setMode(false,false);
    $('#ctrl').innerHTML=`<div class="steer three"><button class="key" type="button" id="bkL" aria-label="왼쪽">◀</button><button class="key boost" type="button" id="bkD">빠르게 ▼</button><button class="key" type="button" id="bkR" aria-label="오른쪽">▶</button></div><p class="gnote">떨어지는 수와 바로 아래 블록을 더해 목표 합이 되면 둘 다 사라져요. 맨 위까지 쌓이면 끝!</p>`;
    $('#bkL').onclick=()=>this.move(-1);$('#bkR').onclick=()=>this.move(1);$('#bkD').onclick=()=>this.drop();
    this.hud();this.banner();this.draw();
    overlay(`<h3>합 블록</h3><p>목표 합 <b style="font-family:var(--f-px)">${this.T}</b></p><p>떨어지는 수를 알맞은 블록 위에 놓아요. 확신이 들면 빠르게 ▼!</p><p>최고 점수 ${arc('add','block').best}</p>`,[['시작!',()=>{closeOv();startLoop((dt,t)=>{this.t=t;this.update(dt);this.draw()})}]])},
  pickT(){const t=this.U.game.tier||3,pool=t<=1?[10]:t<=3?[10,10,11,12,13]:[11,12,13,14,15,16,17];let T;do{T=pool[R(0,pool.length-1)]}while(T===this.T&&pool.length>1);return T},
  genN(){const T=this.T,tops=this.cols.filter(c=>c.length).map(c=>c[c.length-1]).filter(t=>T-t>=1&&T-t<=9);if(tops.length&&Math.random()<.7)return T-tops[R(0,tops.length-1)];return R(Math.max(1,T-9),9)},
  hud(){$('#hud').innerHTML=`<div class="hl"><span class="num">${icon('star')}${this.score}</span>${this.combo>=2?`<span class="num">${this.combo} 콤보</span>`:''}</div><div class="hl"><span class="lbl">${this.lvl}단계 · 만든 짝 ${this.clears}</span></div>`},
  banner(msg){$('#banner').innerHTML=`<div class="hz"><span class="slot">?</span>${opHTML('+')}<span class="slot">?</span>${opHTML('=')}<span>${this.T}</span></div><span class="msg">${esc(msg||`더해서 ${this.T}이(가) 되는 짝을 만들어요`)}</span>`},
  landRow(c){return this.NR-1-this.cols[c].length},
  spawn(){const c=R(2,3);if(this.landRow(c)<0){this.over();return}this.curB={n:this.next,c,y:0};this.next=this.genN();this.fallT=0},
  move(d){const b=this.curB;if(!b||paused)return;const nc=b.c+d;if(nc<0||nc>=this.NC||this.landRow(nc)<b.y)return;b.c=nc;SFX.tap()},
  drop(){const b=this.curB;if(!b||paused)return;b.y=this.landRow(b.c);this.land(true)},
  tap(x){const b=this.curB;if(!b)return;const c=Math.floor((x-this.X0)/this.CS);if(c<0||c>=this.NC)return;const st=c>b.c?1:-1;while(b.c!==c){const pc=b.c;this.move(st);if(b.c===pc)break}},
  onKey(e){if(e.key==='ArrowLeft'){this.move(-1);return true}if(e.key==='ArrowRight'){this.move(1);return true}if(e.key==='ArrowDown'||e.key===' '){this.drop();return true}return false},
  update(dt){if(paused)return;stepFx(this.fx,dt);if(this.flashT>0)this.flashT-=dt;
    if(!this.curB){this.wait-=dt;if(this.wait<=0)this.spawn();return}
    this.fallT+=dt;const iv=Math.max(.3,1-this.lvl*.07);if(this.fallT>=iv){this.fallT=0;const b=this.curB;if(b.y>=this.landRow(b.c))this.land(false);else b.y++}},
  land(fast){const b=this.curB,col=this.cols[b.c],T=this.T,n=b.n;this.curB=null;this.wait=.25;
    const top=col.length?col[col.length-1]:null,matchCol=this.cols.findIndex(cc=>cc.length&&cc[cc.length-1]+n===T);
    const cx=this.X0+b.c*this.CS+8,cy=this.Y0+b.y*this.CS+8;
    if(top!==null&&top+n===T){col.pop();this.clears++;this.combo++;const pts=10*this.combo+(fast?5:0);this.score+=pts;
      record('add',build('add','am',0,top,n,'m'),n,true,0,'c');burst(this.fx,cx,cy,BLOCKC[n],16);floatTxt(this.fx,cx,cy-10,'+'+pts,'#ffc93c');SFX.ok();
      this.banner(`${top} + ${n} = ${T} 짝꿍!`);
      if(this.clears%6===0){this.lvl++;this.T=this.pickT();this.next=this.genN();this.banner(`새 목표 합은 ${this.T}! 더 빨라져요`);SFX.win()}}
    else{col.push(n);this.combo=0;SFX.hit();
      if(top!==null&&matchCol>=0){record('add',build('add','am',0,top,T-top,'m'),n,false,0,'c');const mt=this.cols[matchCol];this.banner(`${n}은(는) ${mt[mt.length-1]} 위에 놓으면 ${T}이 돼요`);this.flashC=matchCol;this.flashT=1.2}}
    this.hud()},
  over(){stopLoop();const nb=arcEnd('add','block',this.score);
    overlay(`<h3>블록이 꽉 찼어요</h3><p>${icon('star')} 점수 ${this.score}${nb?' · 최고 기록!':''}</p><p>만든 짝 ${this.clears}개</p>`,[['다시 하기',()=>{closeOv();this.start()}],['게임 고르기',()=>backToPicker('add'),'ghost']])},
  draw(){const X0=this.X0,Y0=this.Y0,CS=this.CS,NC=this.NC,NR=this.NR;ctx.fillStyle='#16132f';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#1f1b45';ctx.fillRect(X0,Y0,NC*CS,NR*CS);ctx.fillStyle='#2a2560';for(let c=1;c<NC;c++)ctx.fillRect(X0+c*CS,Y0,1,NR*CS);for(let r=1;r<NR;r++)ctx.fillRect(X0,Y0+r*CS,NC*CS,1);
    ctx.fillStyle='#f7efd8';ctx.fillRect(X0-2,Y0,2,NR*CS+2);ctx.fillRect(X0+NC*CS,Y0,2,NR*CS+2);ctx.fillRect(X0-2,Y0+NR*CS,NC*CS+4,2);
    ctx.fillStyle='#ff6f59';ctx.fillRect(X0,Y0,NC*CS,1);
    const cell=(c,r,n,ghost)=>{const x=X0+c*CS,y=Y0+r*CS;if(ghost){ctx.fillStyle='rgba(255,255,255,.16)';ctx.fillRect(x+1,y+1,CS-2,CS-2);return}
      ctx.fillStyle='#1d1938';ctx.fillRect(x,y,CS,CS);ctx.fillStyle=BLOCKC[n];ctx.fillRect(x+1,y+1,CS-2,CS-2);ctx.fillStyle='rgba(255,255,255,.35)';ctx.fillRect(x+1,y+1,CS-2,2);drawTxt(ctx,n,x+5,y+3,2,'#1d1938')};
    this.cols.forEach((col,c)=>col.forEach((n,i)=>cell(c,NR-1-i,n)));
    if(this.flashT>0&&this.flashC>=0){const col=this.cols[this.flashC];if(col.length&&Math.floor(this.flashT*8)%2){const x=X0+this.flashC*CS,y=Y0+(NR-col.length)*CS;ctx.fillStyle='#ffffff';ctx.fillRect(x,y,CS,2);ctx.fillRect(x,y+CS-2,CS,2);ctx.fillRect(x,y,2,CS);ctx.fillRect(x+CS-2,y,2,CS)}}
    const b=this.curB;if(b){if(this.landRow(b.c)>b.y)cell(b.c,this.landRow(b.c),0,true);cell(b.c,b.y,b.n)}
    drawTxt(ctx,'?+?',6,16,2,'#69bfff');drawTxt(ctx,'=',14,32,2,'#69bfff');drawTxt(ctx,this.T,6,46,3,'#ffc93c','#1d1938');
    ctx.fillStyle='#f7efd8';ctx.fillRect(152,14,30,30);ctx.fillStyle='#1d1938';ctx.fillRect(154,16,26,26);
    if(this.next){ctx.fillStyle=BLOCKC[this.next];ctx.fillRect(159,21,16,16);drawTxt(ctx,this.next,164,24,2,'#1d1938')}
    drawTxt(ctx,'NEXT',152,48,1,'#8f86b8');
    drawFx(this.fx)}
};

/* ================= FROG (number line, add/sub) ================= */
function jumpHint(p){const sg=p.op==='+'?1:-1,tn=Math.floor(p.b/10),on=p.b%10,pts=[p.a];let v=p.a;for(let i=0;i<tn;i++){v+=10*sg;pts.push(v)}if(on){v+=on*sg;pts.push(v)}
  return`${p.a}에서 ${tn?`10씩 ${tn}번, `:''}${on?`${on}만큼 `:''}${sg>0?'오른쪽':'왼쪽'}으로 뛰면: ${pts.join(' → ')}`}
const Frog={
  start(u){const U=cur.units[u];Object.assign(this,{u,U,fx:[],prog:0,hp:3,score:0,tier:U.game.tier||3,tn:0,tc:0,state:'idle',pads:[],start0:null,fr:{x:u==='add'?22:170,y:0},jump:null,t:0,sink:0,sinking:false,wait:0});
    setMode(false,false);$('#ctrl').innerHTML=`<p class="gnote">개구리가 도착할 연잎을 눌러요. 수직선은 왼쪽이 작은 수, 오른쪽이 큰 수예요.</p>`;
    this.hud();bannerMsg('<span class="msg">개구리가 준비 중이에요</span>');this.draw();
    overlay(`<h3>개구리 수직선</h3><p>${u==='add'?'더하면 오른쪽으로':'빼면 왼쪽으로'} 점프해요.</p><p>정답 연잎 10번이면 다음 연못!</p><p>최고 점수 ${arc(u,'frog').best}</p>`,[['시작!',()=>{closeOv();this.newQ();startLoop((dt,t)=>{this.t=t;this.update(dt);this.draw()})}]])},
  hud(){$('#hud').innerHTML=`<div class="hl">${heartsHTML(this.hp,3)}<span class="num">${icon('star')}${this.score}</span></div><div class="hl"><span class="lbl">연못 ${this.tier}단계</span><span class="bar"><i style="width:${this.prog*10}%"></i></span><span class="num">${this.prog}/10</span></div>`},
  choices(p){const add=this.u==='add',side=v=>add?v>p.a:(v<p.a&&v>=0);const set=new Set([p.ans]);
    for(const v of distract(p)){if(set.size>=4)break;if(Number.isInteger(v)&&side(v))set.add(v)}let g=0;while(set.size<4&&g++<80){const v=p.ans+R(-5,5);if(side(v))set.add(v)}return[...set].sort((a,b)=>a-b)},
  newQ(){const u=this.u,t=mixCarry(Math.max(1,Math.min(u==='sub'?6:7,this.tier-(Math.random()<.2?1:0)))),p=nextProblem(u,()=>genTier(u,t,'h'));this.p=p;
    const vals=this.choices(p),add=u==='add',xs=add?[64,100,136,172]:[20,56,92,128];
    this.start0={x:add?22:170,v:p.a};this.pads=vals.map((v,i)=>({v,x:xs[i]}));this.fr={x:this.start0.x,y:0};this.state='wait';this.t0=performance.now();this.sink=0;this.sinking=false;bannerProblem(p)},
  tap(x,y){if(this.state!=='wait'||paused)return;const pad=this.pads.find(pd=>Math.abs(x-pd.x)<=17&&y>=70&&y<=130);if(!pad)return;this.state='jump';this.jump={from:this.fr.x,to:pad.x,t:0,pad};SFX.tap()},
  update(dt){if(paused)return;stepFx(this.fx,dt);const j=this.jump;
    if(this.state==='jump'&&j){j.t+=dt/.6;const k=Math.min(1,j.t);this.fr.x=j.from+(j.to-j.from)*k;this.fr.y=-Math.sin(k*Math.PI)*34;if(k>=1){this.fr.y=0;this.landed(j.pad)}}
    else if(this.state==='after'){this.wait-=dt;if(this.sinking)this.sink=Math.min(1,this.sink+dt*2);if(this.wait<=0){if(this.hp<=0)this.rest();else if(this.prog>=10)this.clear();else this.newQ()}}},
  landed(pad){const p=this.p,ok=pad.v===p.ans;record(this.u,p,pad.v,ok,performance.now()-this.t0,'c');this.tn++;
    if(ok){this.tc++;this.prog++;this.score+=10;burst(this.fx,pad.x,98,'#9ef0c4',14);SFX.ok();bannerMsg(`<div class="hz">${eqHTML(p,null)}</div><span class="msg">폴짝! 정답</span>`);this.wait=.9}
    else{this.hp--;this.sinking=true;pad.bad=true;burst(this.fx,pad.x,102,'#9fd8ff',12);SFX.no();retryLater(p,2);bannerMsg(`<div class="hz">${eqHTML(p,null)}</div><span class="msg">${esc(jumpHint(p))}</span>`);this.wait=3}
    this.state='after';this.hud()},
  clear(){const up=this.tn&&this.tc/this.tn>=.8;if(up&&this.tier<7)this.tier++;this.prog=0;this.tn=this.tc=0;this.hp=3;arcEnd(this.u,'frog',this.score);this.state='idle';this.hud();SFX.win();
    overlay(`<h3>연못 통과!</h3><p>${icon('star')} 점수 ${this.score}</p><p>${up?'다음 연못은 더 넓어요':'같은 연못에서 한 번 더 연습해요'}</p>`,[['다음 연못',()=>{closeOv();this.newQ()}],['게임 고르기',()=>backToPicker(this.u),'ghost']])},
  rest(){this.hp=3;this.prog=Math.max(0,this.prog-3);this.tier=Math.max(1,this.tier-1);arcEnd(this.u,'frog',this.score);this.state='idle';this.hud();
    overlay('<h3>개구리가 쉬어요</h3><p>젖은 몸을 말렸어요. 조금 쉬운 연못부터 다시!</p>',[['다시 점프',()=>{closeOv();this.newQ()}]])},
  draw(){const t=this.t||0,add=this.u==='add';ctx.fillStyle='#2f6fb0';ctx.fillRect(0,0,W,H);ctx.fillStyle='#3a80c4';for(let i=0;i<16;i++){const x=(i*41+Math.floor(t*6))%W,y=(i*29)%70+14;ctx.fillRect(x,y,8,1)}
    ctx.fillStyle='#4e9f4f';ctx.fillRect(0,0,W,10);ctx.fillStyle='#3a6b3f';ctx.fillRect(0,8,W,2);ctx.fillStyle='#2a5a9a';ctx.fillRect(0,124,W,20);
    ctx.fillStyle='#f7efd8';ctx.fillRect(4,92,184,2);if(add){ctx.fillRect(184,89,2,8);ctx.fillRect(186,91,2,4)}else{ctx.fillRect(6,89,2,8);ctx.fillRect(4,91,2,4)}
    const pad=(x,v,col,bad)=>{ctx.fillStyle='#1d1938';ctx.fillRect(x-15,96,30,8);ctx.fillStyle=bad?'#6f7f55':col;ctx.fillRect(x-14,97,28,6);ctx.fillRect(x-11,95,22,2);ctx.fillStyle='#f7efd8';ctx.fillRect(x,90,1,6);
      const s=String(v);drawTxt(ctx,s,x-txtW(s,2)/2,110,2,'#f7efd8','#1d1938')};
    if(this.start0)pad(this.start0.x,this.start0.v,'#c9a440');
    this.pads.forEach(pd=>pad(pd.x,pd.v,(this.state==='after'&&this.sinking&&pd.v===this.p.ans)?(Math.floor(t*6)%2?'#ffc93c':'#58b45a'):'#58b45a',pd.bad));
    if(this.state==='jump'&&this.jump){const j=this.jump;ctx.fillStyle='rgba(255,255,255,.6)';for(let i=0;i<=12;i++){const k=i/12;ctx.fillRect(Math.round(j.from+(j.to-j.from)*k),Math.round(82-Math.sin(k*Math.PI)*34),1,1)}}
    if(this.sink<1){const fy=76+Math.round(this.fr.y)+Math.round(this.sink*14);ctx.save();ctx.beginPath();ctx.rect(0,0,W,97);ctx.clip();drawSpr(ctx,'frog',this.fr.x-12,fy,2,{g:'#7ed957'},!add);ctx.restore()}
    drawFx(this.fx)}
};

/* ================= PAIR (multiplication matching, DOM) ================= */
const Pair={
  start(){const U=cur.units.mul;Object.assign(this,{U,score:0,boards:0,sel:null,left:60,total:60,cards:[],matched:0,t0:0});setMode(false,true);
    $('#ctrl').innerHTML=`<p class="gnote">곱셈 카드와 답 카드를 차례로 눌러 짝지어요. 틀리면 시간이 3초 줄어요.</p>`;
    this.hud();bannerMsg('<span class="msg">카드를 섞는 중</span>');$('#board').innerHTML='';
    overlay(`<h3>구구 짝꿍</h3><p>시간 안에 6쌍을 모두 짝지어요.</p><p>최고 점수 ${arc('mul','pair').best}</p>`,[['시작!',()=>{closeOv();this.newBoard();startLoop(dt=>this.update(dt))}]])},
  newBoard(){const U=this.U,d1=taughtDans().filter(x=>x>1),pool=d1.length?d1:taughtDans(),facts=[],used=new Set();let tries=0;
    while(facts.length<6&&tries++<400){const p=genMul(pool,U,facts.map(f=>f.k),'none');if(used.has(p.c))continue;used.add(p.c);facts.push(p)}
    this.cards=shuffle([...facts.map(p=>({t:'q',p})),...facts.map(p=>({t:'a',p,v:p.c}))]);this.matched=0;this.sel=null;this.total=this.left=Math.max(30,60-this.boards*5);this.t0=performance.now();this.render();
    bannerMsg(`<span class="msg">${this.boards+1}번째 판 · 6쌍을 찾아요</span><div class="tbar"><i id="pairBar"></i></div>`);this.hud()},
  render(){const b=$('#board');b.innerHTML='';this.cards.forEach(c=>{const el=document.createElement('button');el.type='button';el.className='pcard '+c.t;
    el.innerHTML=c.t==='q'?`<span>${c.p.a}</span>${opHTML('×')}<span>${c.p.b}</span>`:`<span>${c.v}</span>`;el.onclick=()=>this.pick(c);c.el=el;b.appendChild(el)})},
  pick(c){if(paused||c.done)return;SFX.tap();
    if(!this.sel||this.sel.t===c.t){if(this.sel)this.sel.el.classList.remove('sel');if(this.sel===c){this.sel=null;return}this.sel=c;c.el.classList.add('sel');return}
    const q=c.t==='q'?c:this.sel,a=c.t==='a'?c:this.sel,ok=q.p.c===a.v;record('mul',q.p,a.v,ok,performance.now()-this.t0,'c');this.t0=performance.now();this.sel.el.classList.remove('sel');this.sel=null;
    if(ok){q.done=a.done=true;q.el.classList.add('done');a.el.classList.add('done');q.el.disabled=a.el.disabled=true;this.matched++;this.score+=10;SFX.ok();if(this.matched===6)this.cleared()}
    else{this.left=Math.max(0,this.left-3);[q.el,a.el].forEach(e=>{e.classList.remove('shake');void e.offsetWidth;e.classList.add('shake')});SFX.no();retryLater(q.p,2);
      bannerMsg(`<span class="msg">${q.p.a} × ${q.p.b}의 답은 ${a.v}이(가) 아니에요</span><div class="tbar"><i id="pairBar"></i></div>`)}
    this.hud()},
  cleared(){const bonus=Math.round(this.left)*2;this.score+=bonus;this.boards++;SFX.win();this.hud();
    overlay(`<h3>${this.boards}번째 판 완성!</h3><p>남은 시간 보너스 +${bonus}</p><p>다음 판은 시간이 조금 줄어요</p>`,[['다음 판',()=>{closeOv();this.newBoard()}]])},
  hud(){$('#hud').innerHTML=`<div class="hl"><span class="num">${icon('star')}${this.score}</span></div><div class="hl"><span class="lbl">${this.boards+1}번째 판 · ${this.matched}/6쌍</span></div>`},
  update(dt){if(paused)return;this.left-=dt;const bar=$('#pairBar');if(bar)bar.style.width=Math.max(0,this.left/this.total*100)+'%';if(this.left<=0)this.over()},
  over(){stopLoop();const nb=arcEnd('mul','pair',this.score);
    overlay(`<h3>시간이 다 됐어요</h3><p>${icon('star')} 점수 ${this.score}${nb?' · 최고 기록!':''}</p><p>완성한 판 ${this.boards}개</p>`,[['다시 하기',()=>{closeOv();this.start()}],['게임 고르기',()=>backToPicker('mul'),'ghost']])}
};

/* ================= quitting ================= */
$('#btnQuit').onclick=async()=>{stopLoop();ov.hidden=true;paused=false;G=null;
  if(SCR==='units'){await flush();cur=null;show('title');return}
  await flush();const tn=UNITS.reduce((s,u)=>s+(((cur.units[u].daily||{})[today()]||[0])[0]),0);toast(tn?`오늘 ${tn}문제를 풀었어요. 저장했으니 다음에 이어서 해요!`:'저장했어요! 다음에 이어서 할 수 있어요');renderUnits();show('units')};

/* ================= keyboard ================= */
document.addEventListener('keydown',e=>{
  if(SCR==='dash'||e.metaKey||e.ctrlKey||e.altKey)return;
  const k=/^[0-9]$/.test(e.key)?e.key:e.key==='Backspace'?'del':e.key==='Enter'?'ok':null;
  if(SCR==='step'&&k){e.preventDefault();stepKey(k)}
  else if(SCR==='login'&&k){e.preventDefault();loginKey(k)}
  else if(SCR==='game'&&G){
    if(!ov.hidden){if(e.key==='Enter'){const b=ov.querySelector('.row button');if(b){e.preventDefault();b.click()}}return}
    if(G.onKey&&G.onKey(e,k))e.preventDefault()}});
$('#btnSwitch').onclick=async()=>{stopLoop();ov.hidden=true;paused=false;G=null;await flush();if(PU)showPicker(PU);else{renderUnits();show('units')}};

/* ================= teacher login ================= */
let pin='';
makeKeypad($('#kpLogin'),k=>loginKey(k),'열기');
function renderPin(){$$('#pinDots i').forEach((d,i)=>d.classList.toggle('on',i<pin.length))}
async function loginKey(k){if(k==='del')pin=pin.slice(0,-1);else if(k==='ok'){}else if(pin.length<4)pin+=k;renderPin();
  if(pin.length===4){const tried=pin;await storeReady(2500);await loadCfg();
    if(tried===String(CFG.pw||'2106')){pin='';renderPin();openDash()}else{$('#pinErr').textContent='비밀번호가 달라요. 다시 눌러 주세요.';pin='';setTimeout(renderPin,250)}}}

/* ================= dashboard ================= */
const SKL={add:{a1:'10까지 더하기',a2:'한 자리+한 자리 (받아올림)',a3:'두 자리+한 자리',a4:'두 자리+한 자리 (받아올림)',a5:'두 자리+두 자리',a6:'두 자리+두 자리 (받아올림)',a7:'합이 100 이상',am:'□가 있는 덧셈'},
  sub:{s1:'10까지 빼기',s2:'십몇−몇 (받아내림)',s3:'두 자리−한 자리',s4:'두 자리−한 자리 (받아내림)',s5:'두 자리−두 자리',s6:'두 자리−두 자리 (받아내림)',sm:'□가 있는 뺄셈'}};
const SKLT={a1:'10 이하의 덧셈',a2:'받아올림이 있는 한 자리 수의 덧셈',a3:'두 자리 수와 한 자리 수의 덧셈',a4:'받아올림이 있는 두 자리 수와 한 자리 수의 덧셈',a5:'두 자리 수끼리의 덧셈',a6:'받아올림이 있는 두 자리 수끼리의 덧셈',a7:'합이 100 이상인 두 자리 수의 덧셈',
  s1:'10 이하의 뺄셈',s2:'받아내림이 있는 십몇 빼기 몇',s3:'두 자리 수 빼기 한 자리 수',s4:'받아내림이 있는 두 자리 수 빼기 한 자리 수',s5:'두 자리 수끼리의 뺄셈',s6:'받아내림이 있는 두 자리 수끼리의 뺄셈'};
const ERRS={carry:'받아올림 빠뜨림',place:'자릿값 혼동',count:'1~2 차이 세기 실수',swap:'숫자 자리 바뀜',opmix:'연산 기호 혼동',rel:'덧셈·뺄셈 관계 혼동',borrow:'거꾸로 빼기 (받아내림 오류)',noDec:'받아내림 후 십의 자리 그대로',neigh:'이웃 곱과 혼동',addmix:'곱셈을 덧셈으로 계산',zero:'0의 곱 오류',etc:'기타'};
const ERRL={carry:'받아올림을 빠뜨리는',place:'자릿값을 혼동하는',count:'답을 1~2만큼 틀리게 세는',swap:'십의 자리와 일의 자리를 바꿔 쓰는',opmix:'연산 기호를 혼동하는',rel:'덧셈과 뺄셈의 관계를 혼동하는',borrow:'일의 자리에서 큰 수에서 작은 수를 거꾸로 빼는',noDec:'받아내림 후 십의 자리를 줄이지 않는',neigh:'이웃한 곱과 혼동하는',addmix:'곱셈을 덧셈으로 계산하는',zero:'0의 곱을 잘못 계산하는',etc:'여러 형태의'};
const ADV={carry:'일의 자리 합이 10 이상일 때 받아올림을 표시하는 연습',place:'자릿값에 맞춰 수를 쓰는 연습',count:'답을 구한 뒤 거꾸로 확인하는 습관',swap:'자리를 확인하며 수를 쓰는 연습',opmix:'계산 전에 연산 기호를 확인하는 습관',rel:'덧셈과 뺄셈의 관계를 그림으로 확인하는 활동',borrow:'받아내림 과정을 수 모형으로 확인하는 활동',noDec:'빌려 준 십의 자리를 표시하는 연습',neigh:'뛰어 세기로 곱을 확인하는 연습',addmix:'묶어 세기로 곱셈의 의미를 확인하는 활동',zero:'0의 곱이 가지는 의미를 확인하는 활동',etc:'틀린 문제를 함께 다시 풀어 보는 지도'};
const DASH={docs:{},unsub:null,tab:'class',sel:null,resetArm:false};
const newer=(a,b)=>(!a||(b&&(b.updatedAt||0)>=(a.updatedAt||0)))?b:a;
function openDash(){show('dash');DASH.tab=DASH.tab||'class';
  for(const k of LS.keys())if(/^dsm:s\d+$/.test(k)){const d=LS.get(k);if(d&&d.id)DASH.docs[d.id]=newer(DASH.docs[d.id],d)}
  $('#dashConn').textContent=Store.db?'학생 기기의 기록이 실시간으로 모여요':'기록장 연결이 없어 이 기기에 저장된 기록만 보여요';
  if(Store.db&&!DASH.unsub){try{DASH.unsub=Store.db.collection('students').onSnapshot(snap=>{snap.docs.forEach(d=>{if(d.exists)DASH.docs[d.id]=newer(DASH.docs[d.id],clone(d.data()))});if(SCR==='dash'&&DASH.tab!=='set')renderDash()},
    err=>{$('#dashConn').textContent='기록을 불러오지 못했어요. 페이지를 새로 열어 주세요.';DASH.unsub=null})}catch(e){}}
  renderDash()}
$('#btnLogout').onclick=()=>{if(DASH.unsub){DASH.unsub();DASH.unsub=null}show('title')};
$$('#tabs button').forEach(b=>b.onclick=()=>{DASH.tab=b.dataset.tab;DASH.resetArm=false;renderDash()});
const studentsList=()=>Object.values(DASH.docs).filter(d=>d&&d.units).sort((a,b)=>a.no-b.no);
const nm=no=>(CFG.roster||{})[no]||'';
const pct=x=>x==null?'—':Math.round(x*100)+'%';
function gradeOf(u,U){const r=U.recent||[];if(r.length<10)return{key:'na',label:'자료 부족',acc:r.length?r.filter(x=>x.ok).length/r.length:null,kt:null};
  const acc=r.filter(x=>x.ok).length/r.length,kr=r.filter(x=>x.m==='k'),kt=kr.length?kr.reduce((s,x)=>s+x.t,0)/kr.length:null,lim=u==='mul'?4:8;
  if(acc>=.9&&(kt==null||kt<=lim))return{key:'top',label:'잘함',acc,kt};if(acc>=.7)return{key:'mid',label:'보통',acc,kt};return{key:'low',label:'노력 필요',acc,kt}}
function avgK(U){const r=(U.recent||[]).filter(x=>x.m==='k');return r.length?r.reduce((s,x)=>s+x.t,0)/r.length:null}
function reachedKey(u,U){const order=u==='add'?['a1','a2','a3','a4','a5','a6','a7']:['s1','s2','s3','s4','s5','s6'];let best=null;for(const k of order){const s=U.skills[k];if(s&&s.n>=4&&s.c/s.n>=.8)best=k}return best}
function masteredMul(U){let m=0;for(const[k,s]of Object.entries(U.skills||{})){if(/x/.test(k)&&factMastered(s))m++}return m}
function reachedText(u,U){if(u==='mul'){const g=U.game||{};const fl=Math.max(g.best||0,g.ver===2?(g.unlocked||0):0);return(fl>0?`${fl}층 통과`:'1층 도전 중')+` · 숙달 ${masteredMul(U)}개`}const k=reachedKey(u,U);return k?SKL[u][k]:'—'}
function topErr(U){const e=Object.entries(U.errs||{}).sort((a,b)=>b[1]-a[1]);return e[0]||null}
function lastAt(d){let t=0;UNITS.forEach(u=>{const r=d.units[u].recent;if(r&&r[0])t=Math.max(t,r[0].at)});return t}
const fmtDate=t=>{if(!t)return'—';const d=new Date(t);return`${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};
function evalText(u,U){const r=U.recent||[];if(!r.length)return'';const n=r.length,c=r.filter(x=>x.ok).length,p=Math.round(c/n*100),P=[];
  if(u==='mul'){P.push(`곱셈구구 문제를 해결하며 최근 ${n}문제 중 ${c}문제를 맞혀 ${p}%의 정확도를 보임.`);const m=masteredMul(U);if(m>=3)P.push(`곱셈구구 ${m}개를 5초 안에 정확하게 답함.`)}
  else{const k=reachedKey(u,U);P.push(`${k?SKLT[k]+'까지 안정적으로 해결하며 ':''}최근 ${n}문제 중 ${c}문제를 맞혀 ${p}%의 정확도를 보임.`)}
  const kt=avgK(U);if(kt!=null&&r.filter(x=>x.m==='k').length>=3)P.push(`답을 직접 쓰는 문제의 평균 응답 시간은 ${kt.toFixed(1)}초임.`);
  const te=topErr(U);if(te&&te[1]>=2&&te[0]!=='etc')P.push(`${ERRL[te[0]]} 실수가 ${te[1]}회 나타나 ${ADV[te[0]]}이 필요함.`);else if(p>=85)P.push('계산 실수가 적고 꾸준히 문제를 해결함.');else P.push(`${ADV.etc}가 도움이 될 것으로 보임.`);
  return P.join(' ')}
function gchip(g){return`<span class="gchip g-${g.key}">${g.label}</span>`}
function renderDash(){$$('#tabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===DASH.tab)));const body=$('#dashBody');
  if(DASH.tab==='class')body.innerHTML=dashClass();else if(DASH.tab==='student')body.innerHTML=dashStudent();else if(DASH.tab==='mulmap')body.innerHTML=dashMul();else{body.innerHTML=dashSet();bindSet()}
  body.querySelectorAll('[data-stu]').forEach(b=>b.onclick=()=>{DASH.sel=b.dataset.stu;renderDash()});
  body.querySelectorAll('tr[data-sid]').forEach(tr=>tr.onclick=()=>{DASH.sel=tr.dataset.sid;DASH.tab='student';renderDash()});
  const sel=$('#stuSel');if(sel)sel.onchange=()=>{DASH.sel=sel.value;renderDash()};
  body.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{const ta=document.getElementById(b.dataset.copy);try{await navigator.clipboard.writeText(ta.value);b.textContent='복사됨'}catch(e){ta.select();b.textContent='선택됨, Ctrl+C로 복사'}setTimeout(()=>b.textContent='복사',1800)})}
const EMPTY='<div class="empty">아직 기록이 없어요.<br>학생이 시작 화면에서 번호를 고르고 문제를 풀면 여기에 바로 나타나요.</div>';
function dashClass(){const L=studentsList();const legend=`<div class="legend"><span>등급 기준 (최근 30문제)</span>${gchip({key:'top',label:'잘함'})} 정확도 90% 이상, 직접 쓰는 문제 평균 덧셈·뺄셈 8초 이하 / 곱셈 4초 이하 ${gchip({key:'mid',label:'보통'})} 70% 이상 ${gchip({key:'low',label:'노력 필요'})} 70% 미만 ${gchip({key:'na',label:'자료 부족'})} 10문제 미만</div>`;
  if(!L.length)return EMPTY;
  const t=today();let todayN=0;L.forEach(d=>UNITS.forEach(u=>{const x=(d.units[u].daily||{})[t];if(x)todayN+=x[0]}));
  const kp=UNITS.map(u=>{const gs=L.map(d=>gradeOf(u,d.units[u])).filter(g=>g.key!=='na');const a=gs.length?gs.reduce((s,g)=>s+g.acc,0)/gs.length:null;
    return`<div class="kpi"><span>${UNAME[u]} 학급 정확도</span><b>${pct(a)}</b><small>평가 가능 ${gs.length}명 · 노력 필요 ${gs.filter(g=>g.key==='low').length}명</small></div>`}).join('');
  const goal=CFG.dailyGoal||30,todayOf=d=>dayMap(d)[t]||0,stampsOf=d=>Object.values(dayMap(d)).filter(v=>v>=goal).length,doneN=L.filter(d=>todayOf(d)>=goal).length;
  const rows=L.map(d=>`<tr class="click" data-sid="${d.id}"><td>${d.no}</td><td>${esc(nm(d.no))}</td><td><div class="ucell"><span>${todayOf(d)}문제 ${todayOf(d)>=goal?'<span class="gchip g-top">미션 달성</span>':''}</span><small>도장 ${stampsOf(d)}개</small></div></td>${UNITS.map(u=>{const U=d.units[u],g=gradeOf(u,U),te=topErr(U),kt=avgK(U);
      return`<td><div class="ucell"><span>${gchip(g)} ${pct(g.acc)}</span><small>${esc(reachedText(u,U))}</small><small>${kt!=null?'평균 '+kt.toFixed(1)+'초':''}${te?' · '+ERRS[te[0]]:''}</small></div></td>`}).join('')}<td>${fmtDate(lastAt(d))}</td></tr>`).join('');
  return`<div class="kpis"><div class="kpi"><span>기록이 있는 학생</span><b>${L.length}명</b><small>전체 ${CFG.count}명</small></div><div class="kpi"><span>오늘 푼 문제</span><b>${todayN}</b><small>${t}</small></div><div class="kpi"><span>오늘 미션 달성</span><b>${doneN}명</b><small>하루 ${goal}문제 기준</small></div>${kp}</div>
  ${legend}<div class="tblwrap"><table><thead><tr><th>번호</th><th>이름</th><th>오늘</th><th>덧셈</th><th>뺄셈</th><th>곱셈</th><th>최근 활동</th></tr></thead><tbody>${rows}</tbody></table></div><p class="dnote">줄을 누르면 학생별 상세 기록으로 이동해요. 도달 수준은 4문제 이상 풀고 80% 이상 맞힌 가장 높은 단계예요.</p>`}
function skillBars(u,U){let items;
  if(u==='mul'){const by={};for(const[k,s]of Object.entries(U.skills||{})){if(!/x/.test(k))continue;const a=+k.split('x')[0];const key=a<=1?(a===0||k.endsWith('x0')?'0의 곱':'1단'):a+'단';const o=by[key]||(by[key]={n:0,c:0});o.n+=s.n;o.c+=s.c}
    items=Object.entries(by).sort((a,b)=>parseInt(a[0])-parseInt(b[0])||0).map(([k,s])=>[k,s])}
  else items=Object.entries(SKL[u]).filter(([k])=>U.skills[k]).map(([k,l])=>[l,U.skills[k]]);
  if(!items.length)return'<p class="dnote">아직 기록이 없어요</p>';
  return`<div class="bars">${items.map(([l,s])=>{const a=s.c/s.n,col=a>=.9?'#45c98f':a>=.7?'#f0b429':'#ff6f59';return`<div class="brow"><span>${esc(l)}</span><span class="bt"><i style="width:${a*100}%;background:${col}"></i></span><em>${Math.round(a*100)}% · ${s.n}</em></div>`}).join('')}</div>`}
function heatHTML(skills){const cell=(a,b)=>{const s=skills[a+'x'+b];if(!s)return`<span class="hc h0">·</span>`;const r=s.c/s.n;return`<span class="hc ${r>=.9?'h3':r>=.7?'h2':'h1'}" title="${a}×${b} ${s.c}/${s.n}">${Math.round(r*100)}</span>`};
  let h=`<div class="heat" style="grid-template-columns:30px repeat(10,minmax(30px,1fr))"><span class="hh">×</span>${[1,2,3,4,5,6,7,8,9,0].map(b=>`<span class="hh">${b}</span>`).join('')}`;
  for(const a of[2,3,4,5,6,7,8,9,1,0]){h+=`<span class="hh">${a}</span>`+[1,2,3,4,5,6,7,8,9,0].map(b=>cell(a,b)).join('')}return h+'</div>'}
function dashStudent(){const L=studentsList();if(!L.length)return EMPTY;if(!DASH.sel||!DASH.docs[DASH.sel])DASH.sel=L[0].id;const d=DASH.docs[DASH.sel];
  const goal=CFG.dailyGoal||30,dm=dayMap(d),tN=dm[today()]||0,stamps=Object.values(dm).filter(v=>v>=goal).length;
  const side=`<nav class="stulist" aria-label="학생 목록">${L.map(x=>`<button type="button" data-stu="${x.id}" aria-current="${x.id===d.id}"><span>${x.no}. ${esc(nm(x.no))}</span><small>오늘 ${dayMap(x)[today()]||0}</small></button>`).join('')}</nav>`;
  const cards=UNITS.map(u=>{const U=d.units[u],g=gradeOf(u,U),kt=avgK(U),tot=(U.stats.kn||0)+(U.stats.cn||0),totc=(U.stats.kc||0)+(U.stats.cc||0);const td=(U.daily||{})[today()];
    const ses=(U.sessions||[]).slice().reverse().slice(0,6).map(s=>`<tr><td>${s.d.slice(5)}</td><td>${s.s1?s.s1[0]+'/'+s.s1[1]:'—'}</td><td>${s.s2?s.s2[0]+'/'+s.s2[1]:'—'}</td><td>${s.gn?s.gc+'/'+s.gn:'—'}</td></tr>`).join('');
    const errs=Object.entries(U.errs||{}).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span>${ERRS[k]} ${v}회</span>`).join('')||'<span>아직 없음</span>';
    const rec=(U.recent||[]).slice(0,10).map(r=>`<div><span class="${r.ok?'o':'x'}">${r.ok?'O':'X'}</span><span>${esc(r.q)}${r.q.includes('□')?'':' = '+r.ans}${r.ok?'':` <small>입력 ${r.g}${r.e?' · '+ERRS[r.e]:''}</small>`}</span><small>${r.m==='k'?r.t+'초':'게임'}</small></div>`).join('')||'<p class="dnote">아직 기록이 없어요</p>';
    const ev=evalText(u,U),tid='ev-'+u;
    return`<div class="dcard ucardd"><div class="uh"><h2>${UNAME[u]}</h2>${gchip(g)}</div>
      <div class="minis"><div class="mini"><span>최근 정확도</span><b>${pct(g.acc)}</b></div><div class="mini"><span>쓰기 평균 시간</span><b>${kt!=null?kt.toFixed(1)+'초':'—'}</b></div><div class="mini"><span>누적 문제</span><b>${tot}</b></div><div class="mini"><span>오늘</span><b>${td?td[1]+'/'+td[0]:'—'}</b></div></div>
      <p class="dnote">도달 수준: <b>${esc(reachedText(u,U))}</b> · 누적 정확도 ${tot?Math.round(totc/tot*100)+'%':'—'} · 현재 위치: ${U.phase===0?'대기':U.phase<3?'STEP '+U.phase:'게임'}</p>
      <p class="dnote">게임 기록: ${UGAMES[u].map(id=>{const a=(U.arc||{})[id],g=U.game||{};return GAMES[id].n+' '+(id==='dun'?(g.best||0)+'층':id==='race'?'트랙 '+(g.track||1):id==='mole'?'라운드 '+(g.round||1):(a?a.best:0)+'점')}).join(' · ')}</p>
      <h3>단계 평가 기록</h3><div class="tblwrap"><table><thead><tr><th>날짜</th><th>STEP 1 (4문제)</th><th>STEP 2 (6문제)</th><th>게임 정답</th></tr></thead><tbody>${ses||'<tr><td colspan="4">기록 없음</td></tr>'}</tbody></table></div>
      <h3>${u==='mul'?'단별 정확도':'유형별 정확도'}</h3>${skillBars(u,U)}
      ${u==='mul'?`<h3>곱셈구구 표 (정확도 %)</h3><div style="overflow-x:auto">${heatHTML(U.skills||{})}</div>`:''}
      <h3>오류 유형</h3><div class="errs">${errs}</div>
      <h3>최근 문제</h3><div class="rec">${rec}</div>
      ${ev?`<div class="evalbox"><h3>평가 문장 초안</h3><textarea id="${tid}">${esc(ev)}</textarea><div><button class="dbtn" type="button" data-copy="${tid}">복사</button></div></div>`:''}</div>`}).join('');
  return`<div class="stuwrap">${side}<div style="display:flex;flex-direction:column;gap:14px;min-width:0"><div class="kpis"><div class="kpi"><span>${d.no}번</span><b>${esc(nm(d.no))||'—'}</b><small>마지막 기록 ${fmtDate(lastAt(d))}</small></div><div class="kpi"><span>오늘 푼 문제</span><b>${tN}</b><small>${tN>=goal?'미션 달성':'미션 '+goal+'문제'}</small></div><div class="kpi"><span>모은 도장</span><b>${stamps}개</b><small>최근 20일 기록 기준</small></div><div class="kpi"><span>복습 상자</span><b>${(()=>{const set=new Set();UNITS.forEach(u=>(d.units[u].recent||[]).forEach(r=>{if(!r.ok)set.add(u+r.k)}));return set.size})()}가지</b><small>최근 틀린 유형</small></div></div><div class="dgrid2 three">${cards}</div>
  <p class="dnote">평가 문장은 기록된 숫자로만 만든 초안이에요. 수업 관찰과 함께 다듬어 쓰세요.</p></div></div>`}
function dashMul(){const L=studentsList();if(!L.length)return EMPTY;const agg={};
  L.forEach(d=>{for(const[k,s]of Object.entries(d.units.mul.skills||{})){if(!/x/.test(k))continue;const o=agg[k]||(agg[k]={n:0,c:0,t:0,tn:0});o.n+=s.n;o.c+=s.c;o.t+=s.t;o.tn+=s.tn}});
  const hard=Object.entries(agg).filter(([,s])=>s.n>=3).map(([k,s])=>[k,s.c/s.n,s]).sort((a,b)=>a[1]-b[1]).slice(0,6);
  const slow=Object.entries(agg).filter(([,s])=>s.tn>=3).map(([k,s])=>[k,s.t/s.tn/1000]).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const floors=FLOORS.map((F,f)=>{const n=L.filter(d=>{const g=d.units.mul.game||{};return Math.max(g.best||0,g.ver===2?(g.unlocked||0):0)>f}).length;return`<div class="brow"><span>${f+1}층 ${F.n} (${danLabel(F.d)})</span><span class="bt"><i style="width:${L.length?n/L.length*100:0}%;background:#8a6cff"></i></span><em>${n}명</em></div>`}).join('');
  return`<div class="dgrid2"><div class="dcard"><h2>학급 곱셈구구 표</h2><p class="dnote">칸의 숫자는 학급 전체 정답률(%)이에요. 빨간 칸부터 다시 다뤄 보세요.</p><div style="overflow-x:auto">${heatHTML(agg)}</div></div>
  <div class="dcard"><h2>함께 다시 볼 곱</h2><h3>정답률이 낮은 곱</h3>${hard.length?`<div class="bars">${hard.map(([k,a,s])=>`<div class="brow"><span>${k.replace('x',' × ')}</span><span class="bt"><i style="width:${a*100}%;background:#ff6f59"></i></span><em>${Math.round(a*100)}% · ${s.n}</em></div>`).join('')}</div>`:'<p class="dnote">3번 이상 나온 곱이 아직 없어요</p>'}
  <h3>답하는 데 오래 걸리는 곱</h3>${slow.length?`<div class="errs">${slow.map(([k,t])=>`<span>${k.replace('x',' × ')} · ${t.toFixed(1)}초</span>`).join('')}</div>`:'<p class="dnote">자료가 더 쌓이면 보여요</p>'}
  <h3>던전 진행</h3><div class="bars">${floors}</div></div></div>`}
function dashSet(){const L=studentsList();const roster=Array.from({length:CFG.count},(_,i)=>`${i+1} ${(CFG.roster||{})[i+1]||''}`.trim()).join('\n');
  return`<div class="dgrid2"><div class="dcard"><h2>학급 설정</h2><div class="form">
    <label for="setCount">학생 수</label><input id="setCount" type="number" min="1" max="40" value="${CFG.count}">
    <label for="setRoster">이름 명단</label><div><textarea id="setRoster" spellcheck="false">${esc(roster)}</textarea><p class="dnote">한 줄에 "번호 이름" 형식으로 써요. 이름은 학생 번호 화면에 함께 보여요. 비워 두면 번호만 보여요.</p></div>
    <label for="setMul">곱셈 진도</label><select id="setMul">${GROUPS.map((g0,i)=>`<option value="${i+1}" ${Math.min(CFG.mulTaught||5,5)===i+1?'selected':''}>${g0.map(x=>x===0?'0의 곱':x+'단').join('·')}까지 배움</option>`).join('')}</select>
    <label for="setGoal">하루 미션</label><div><input id="setGoal" type="number" min="5" max="300" value="${CFG.dailyGoal||30}"> 문제<p class="dnote">학생 한 명이 하루에 풀 문제 수예요. 채우면 출석 도장을 받아요.</p></div>
    <label for="setCGoal">학급 보물상자</label><div><input id="setCGoal" type="number" min="10" max="5000" value="${CFG.classGoal||150}"> 개<p class="dnote">반 전체가 하루에 함께 맞힐 정답 수예요. 순위는 보여 주지 않아요.</p></div>
    <label for="setFAdd">덧셈 집중 과제</label><select id="setFAdd"><option value="">없음</option>${Object.entries(SKL.add).map(([k,l])=>`<option value="${k}" ${focusOf('add')===k?'selected':''}>${l}</option>`).join('')}</select>
    <label for="setFSub">뺄셈 집중 과제</label><select id="setFSub"><option value="">없음</option>${Object.entries(SKL.sub).map(([k,l])=>`<option value="${k}" ${focusOf('sub')===k?'selected':''}>${l}</option>`).join('')}</select>
    <label>곱셈 집중 과제</label><div><div class="chks" id="setFMul">${[2,3,4,5,6,7,8,9,1,0].map(x=>`<label class="chk"><input type="checkbox" value="${x}" ${focusOf('mul').includes(x)?'checked':''}> ${x===0?'0의 곱':x+'단'}</label>`).join('')}</div><p class="dnote">집중 과제는 도전 문제와 게임에서 더 자주 나와요. 학생 화면 단원 카드에도 표시돼요.</p></div>
    <label for="setPw">비밀번호</label><div><input id="setPw" type="text" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" value="${esc(CFG.pw)}"><p class="dnote">숫자 4자리. 교실용 잠금이라 학생이 실수로 들어오는 것을 막는 정도예요.</p></div>
    </div><div><button class="dbtn pri" type="button" id="btnSaveSet">설정 저장</button> <span class="okmsg" id="setMsg"></span></div></div>
    <div class="dcard"><h2>학생 기록 초기화</h2><p class="dnote">선택한 학생의 세 단원 기록과 게임 진행이 모두 지워져요. 되돌릴 수 없어요.</p>
    <div class="sel"><select id="resetSel">${L.map(d=>`<option value="${d.no}">${d.no}번 ${esc(nm(d.no))}</option>`).join('')||'<option value="">기록 있는 학생 없음</option>'}</select>
    <button class="dbtn warn" type="button" id="btnReset" ${L.length?'':'disabled'}>초기화</button></div><span class="okmsg" id="resetMsg"></span>
    <h2 style="margin-top:12px">기록 저장 방식</h2><p class="dnote">${Store.db?'학생 기록은 이 페이지의 기록장에 모여서 선생님 화면에 실시간으로 보여요. 학생 기기가 같은 페이지를 열고 있어야 해요.':'지금은 기록장 연결이 없어 각 기기에만 저장돼요. 다른 기기의 기록은 이 화면에 나타나지 않아요.'}</p>${fbUid()?`<p class="dnote">이 PC의 Firebase UID: <b style="user-select:all">${esc(fbUid())}</b><br>firestore.rules 의 TEACHER_UID 를 이 값으로 바꿔 올리면 이 PC에서만 학급 설정을 저장할 수 있어요.</p>`:''}</div></div>`}
function fbUid(){try{const u=Store.kind==='custom'&&window.firebase&&firebase.auth().currentUser;return u?u.uid:''}catch(e){return''}}
function bindSet(){
  $('#btnSaveSet').onclick=async()=>{const pw=$('#setPw').value.trim();if(!/^\d{4}$/.test(pw)){$('#setMsg').textContent='비밀번호는 숫자 4자리로 써 주세요';return}
    const cnt=Math.max(1,Math.min(40,parseInt($('#setCount').value)||25));const roster={};$('#setRoster').value.split('\n').forEach(l=>{const m=l.trim().match(/^(\d+)[\s.,)]+(.+)$/);if(m&&+m[1]>=1&&+m[1]<=40)roster[+m[1]]=m[2].trim().slice(0,12)});
    CFG.pw=pw;CFG.count=cnt;CFG.roster=roster;CFG.mulTaught=+$('#setMul').value;CFG.dailyGoal=Math.max(5,Math.min(300,parseInt($('#setGoal').value)||30));CFG.classGoal=Math.max(10,Math.min(5000,parseInt($('#setCGoal').value)||150));CFG.focus={add:$('#setFAdd').value,sub:$('#setFSub').value,mul:[...document.querySelectorAll('#setFMul input:checked')].map(i=>+i.value)};const r=await saveCfg();
    $('#setMsg').textContent=r==='ok'?'저장했어요. 모든 기기에 적용돼요':r==='local'?'이 기기에 저장했어요':'기록장 저장에 실패했어요. 잠시 후 다시 눌러 주세요'};
  $('#btnReset').onclick=async()=>{const no=+$('#resetSel').value;if(!no)return;const b=$('#btnReset');
    if(!DASH.resetArm){DASH.resetArm=true;b.classList.add('arm');b.textContent=`${no}번 정말 초기화`;return}
    DASH.resetArm=false;b.classList.remove('arm');b.textContent='초기화';const fresh=newStudent(no);LS.set('dsm:'+fresh.id,fresh);DASH.docs[fresh.id]=fresh;let ok=true;
    if(Store.db){try{await Store.db.doc('students/'+fresh.id).set(fresh)}catch(e){ok=false}}
    $('#resetMsg').textContent=ok?`${no}번 기록을 초기화했어요`:'초기화를 저장하지 못했어요. 다시 시도해 주세요'};
  $('#resetSel').onchange=()=>{DASH.resetArm=false;const b=$('#btnReset');b.classList.remove('arm');b.textContent='초기화'}}
function csv(){const L=studentsList();const head=['번호','이름'];UNITS.forEach(u=>head.push(`${UNAME[u]}_등급`,`${UNAME[u]}_최근정확도`,`${UNAME[u]}_도달수준`,`${UNAME[u]}_쓰기평균초`,`${UNAME[u]}_누적문제`,`${UNAME[u]}_주요오류`,`${UNAME[u]}_평가문장`));head.push('최근활동');
  const q=v=>`"${String(v==null?'':v).replace(/"/g,'""')}"`;
  const rows=L.map(d=>{const r=[d.no,nm(d.no)];UNITS.forEach(u=>{const U=d.units[u],g=gradeOf(u,U),kt=avgK(U),te=topErr(U);r.push(g.label,g.acc==null?'':Math.round(g.acc*100),reachedText(u,U),kt==null?'':kt.toFixed(1),(U.stats.kn||0)+(U.stats.cn||0),te?ERRS[te[0]]:'',evalText(u,U))});r.push(fmtDate(lastAt(d)));return r.map(q).join(',')});
  return'﻿'+[head.map(q).join(','),...rows].join('\r\n')}
$('#btnCsv').onclick=async()=>{const b=$('#btnCsv'),data=csv();let dl=null;try{dl=await window.claude?.use?.('downloads')}catch(e){}
  if(dl){try{await dl.save({filename:`연산기록_${today()}.csv`,data});return}catch(e){if(e&&e.code&&e.code!=='unavailable')return}}
  try{const url=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`연산기록_${today()}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);return}catch(e){}
  try{await navigator.clipboard.writeText(data);b.textContent='표 내용을 복사했어요'}catch(e){b.textContent='내려받기를 쓸 수 없어요'}setTimeout(()=>b.textContent='CSV 내려받기',2200)};

/* ================= boot ================= */
$('#btnMe').onclick=()=>openMe();$('#btnMeBack').onclick=()=>{renderUnits();show('units')};
show('title');connText();
Store.init().then(async()=>{connText();await loadCfg();if(SCR==='who')renderWho()});
})();
