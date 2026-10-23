// 문제 생성기 검사: 단계마다 3,000문제씩 만들어 조건(받아올림·받아내림·음수 없음·보기 중복 없음)을 확인해요.
const fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','js','app.js'),'utf8');
const cut=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b));
const code=cut('const R=','const LS=')+cut('/* ================= problem engine','/* ================= recording')+`
let CFG={mulTaught:5,focus:{}};const swapD=n=>(n>=10&&n<100)?(n%10)*10+Math.floor(n/10):-1;
const fails=[];const F=(m)=>{if(fails.length<20)fails.push(m)};
for(let t=1;t<=7;t++)for(let i=0;i<3000;i++){const[a,b]=genAdd(t);const carry=(a%10)+(b%10)>=10;
  if(a<1||b<1)F('add<1 '+t+' '+a+' '+b);
  if([2,4,6].includes(t)&&!carry)F('받아올림 없음 '+t+': '+a+'+'+b);
  if([3,5].includes(t)&&carry)F('받아올림 있음 '+t+': '+a+'+'+b);
  if(t===7&&a+b<100)F('합 100 미만: '+a+'+'+b);
  if(t===1&&a+b>10)F('10 초과: '+a+'+'+b)}
for(let t=1;t<=6;t++)for(let i=0;i<3000;i++){const[a,b]=genSub(t);const brw=a%10<b%10;
  if(a-b<0||b<1)F('음수/0 '+t+': '+a+'-'+b);
  if([2,4,6].includes(t)&&!brw)F('받아내림 없음 '+t+': '+a+'-'+b);
  if([3,5].includes(t)&&brw)F('받아내림 있음 '+t+': '+a+'-'+b)}
const U={skills:{}};
for(let i=0;i<3000;i++){const p=genMul([0,1,2,3,4,5,6,7,8,9],U,[],'heavy');if(p.fmt==='m'&&(p.a===0||p.b===0))F('0이 있는 □문제');if(p.ans!==(p.fmt==='m'?p.b:p.a*p.b))F('곱셈 답 오류 '+p.text)}
for(let i=0;i<1000;i++)for(const u of['add','sub']){const p=genTier(u,R(3,7),'m');
  const ok=p.miss==='a'?(u==='add'?p.ans+p.b:p.ans-p.b)===p.c:(u==='add'?p.a+p.ans:p.a-p.ans)===p.c;if(!ok)F('□ 답 오류 '+p.text);
  const ch=makeChoices(p,4);if(new Set(ch).size!==4||!ch.includes(p.ans)||ch.some(v=>v<0))F('보기 오류 '+p.text+' '+ch)}
let cur={units:{mul:{skills:{}},add:{game:{}},sub:{game:{}}}};const focusOf=()=>'';
for(const u of['add','sub'])for(const t of[3,5]){cur.units[u].game.tier=t;let h=0;for(let i=0;i<4000;i++){const p=genGame(u);if(p.fmt!=='m'&&(u==='add'?(p.a%10)+(p.b%10)>=10:p.a%10<p.b%10))h++}if(h/4000<.4)F('게임 '+u+' '+t+'단계 받아올림/내림 '+Math.round(h/40)+'%')}

for(let i=0;i<500;i++)for(const u of['add','sub','mul'])for(const n of[1,2]){const L=stepList(u,n),want=n===1?4:6;
  if(L.length!==want)F('STEP '+n+' '+u+' 문제 수 '+L.length);if(new Set(L.map(p=>p.text)).size!==L.length)F('STEP '+n+' '+u+' 중복');
  if(u==='mul'&&L.some(p=>p.u!=='mul'))F('곱셈 STEP에 다른 단원');
  if(u==='mul'&&n===2&&!L.some(p=>p.fmt==='m'||p.a===0||p.b===0))F('곱셈 STEP 2 □ 없음');
  if(u!=='mul'){const hard=L.filter(p=>p.fmt!=='m'&&(u==='add'?(p.a%10)+(p.b%10)>=10||p.a+p.b>=100:p.a%10<p.b%10)).length;if(hard<(n===1?3:4))F('STEP '+n+' '+u+' 받아올림/내림 '+hard+'문제')}}
if(fails.length){console.log('실패',fails.length);fails.forEach(f=>console.log(' -',f));process.exit(1)}
console.log('생성기 검사 통과');`;
new Function(code)();
