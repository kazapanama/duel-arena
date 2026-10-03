"use strict";
/* ============================================================
   ГАЛЕРЕЯ: спрайт-шит скіну (як референс) і сітка всіх скінів.
   Параметри URL: ?skin=rogue/Assassination/2  ?mode=all  ?mode=parts (анатомія)
   ============================================================ */
const $=id=>document.getElementById(id);
const Q=new URLSearchParams(location.search);
const G_SCALE=+(Q.get('scale')||1.4);   // арт-пікселів на світову одиницю: 1.4 — як бійці з растрових деталей у бою (процедурні — 0.7)
const CELL_W=Math.round(84*G_SCALE/0.38), CELL_H=Math.round(100*G_SCALE/0.38); // клітинка кадру в арт-пікселях
const ZOOM=+(Q.get('zoom')||1);                // збільшення на сторінці
const LABEL_W=150;

let mode=Q.get('mode')||'sheet';
let sel={cls:CLASSES[0],spec:CLASSES[0].specs[0],skin:null};
if(Q.get('skin')){
  const [ci,sn,ki]=Q.get('skin').split('/');
  const c=CLASSES.find(x=>x.id===ci);
  if(c){ const s=c.specs.find(x=>x.name===sn)||c.specs[0]; sel={cls:c,spec:s,skin:s.skins[+ki||0]}; }
}
if(!sel.skin) sel.skin=sel.spec.skins[0];
sel.form=Q.get('form')==='alt'?'alt':'base';
const modelOf=(c,s,k,form)=>form==='alt'&&s.form?resolveFormModel(c,s,k,s.form.id):resolveModel(c,s,k);
const abilitiesOf=(c,s,form)=>form==='alt'&&s.form?[...s.form.abilities,s.form.classAb]:[...s.abilities,s.classAb||c.classAb];

/* ---------- кадр: поза → маленьке полотно ---------- */
const cellCv=document.createElement('canvas'); cellCv.width=CELL_W; cellCv.height=CELL_H;
const cellCtx=cellCv.getContext('2d');
const puppetFor=(m)=>({model:m,pose:null,facing:1,x:0,y:0,time:0});
function renderCell(pup,pose,time,groundY=CELL_H-12){
  pup.pose=pose; pup.time=time;
  const main=ctx; ctx=cellCtx;
  ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,CELL_W,CELL_H);
  // тінь
  ctx.fillStyle='rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(CELL_W/2,groundY+2,14,3,0,0,7); ctx.fill();
  ctx.setTransform(G_SCALE,0,0,G_SCALE,CELL_W/2,groundY);
  drawSprite(pup);
  ctx=main;
  return cellCv;
}

function baseOf(style,m){ return {...POSE0,...STANCE[style],...((m&&m.stance)||{})}; }
function framesLoco(m,modeName,n,extra={}){
  const base=baseOf(m.style,m), out=[];
  for(let i=0;i<n;i++){
    const ph=i/n*Math.PI*2;
    out.push({pose:locoPose(m.style,{mode:modeName,phase:modeName==='back'?-ph:ph,vy:extra.vy?extra.vy(i,n):0},base,i/n*2.6),t:i/n*2.6});
  }
  return out;
}
function framesAct(m,name,n,lift=0){
  const spec=getAction(m.style,name); if(!spec) return [];
  const base=baseOf(m.style,m), out=[];
  for(let i=0;i<n;i++){
    const t=spec.dur*(i/(n-1||1));
    out.push({pose:sampleAction(spec,t,base),t,lift});
  }
  return out;
}
// які спец-анімації показати: з набору здібностей спеку
function specialsFor(cls,spec,m){
  const f={model:m||null,cls,spec,abilities:abilitiesOf(cls,spec,sel.form)};
  const set=new Set();
  f.abilities.forEach((a,i)=>{ const n=actionForAbility(f,a,i); if(n&&!['atkA','atkB','heavy','release'].includes(n)) set.add(n); });
  return [...set];
}

function catRows(m){
  const base={...CAT0}, R=[];
  const loco=(mode,n,vy)=>{ const o=[]; for(let i=0;i<n;i++){ const ph=i/n*Math.PI*2; o.push({pose:catLoco({mode,phase:mode==='back'?-ph:ph,vy:vy?vy(i,n):0},base,i/n*2.6),t:i/n*2.6}); } return o; };
  const act=(name,n)=>{ const sp=CAT_ACT[name], o=[]; for(let i=0;i<n;i++){ const t=sp.dur*(i/(n-1)); o.push({pose:catSample(sp,t,base),t}); } return o; };
  R.push(['IDLE',loco('idle',6)]);
  R.push(['WALK (рись)',loco('walk',8)]);
  R.push(['RUN (галоп)',loco('run',8)]);
  R.push(['BACKPEDAL',loco('back',6)]);
  R.push(['JUMP / FALL',loco('air',6,(i,n)=>-640+i/(n-1)*1240).map((f,i)=>({...f,lift:[26,40,46,40,24,6][i]}))]);
  R.push(['LAND',act('land',3)]);
  R.push(['SHRED (лапа A)',act('atkA',6)]);
  R.push(['SHRED (лапа B)',act('atkB',6)]);
  R.push(['BITE (укус)',act('heavy',7)]);
  R.push(["TIGER'S FURY",act('roar',6)]);
  R.push(['POUNCE',act('lunge',6)]);
  R.push(['BLOCK / STUN',[...loco('block',2),...loco('stun',4)]]);
  R.push(['HURT',act('hurt',4)]);
  R.push(['DIE',act('die',7)]);
  R.push(['VICTORY',act('victory',5)]);
  return R;
}

function sheetRows(m,cls,spec){
  if(m.kind==='cat') return catRows(m);
  const R=[];
  R.push(['IDLE',framesLoco(m,'idle',6)]);
  R.push(['WALK',framesLoco(m,'walk',8)]);
  R.push(['RUN',framesLoco(m,'run',8)]);
  R.push(['BACKPEDAL',framesLoco(m,'back',6)]);
  R.push(['JUMP / FALL',framesLoco(m,'air',6,{vy:(i,n)=>-640+i/(n-1)*1240}).map((f,i)=>({...f,lift:[26,40,46,40,24,6][i]}))]);
  R.push(['LAND',framesAct(m,'land',3)]);
  R.push(['ATTACK A',framesAct(m,'atkA',6)]);
  R.push(['ATTACK B',framesAct(m,'atkB',6)]);
  R.push(['HEAVY',framesAct(m,'heavy',7)]);
  const ch=getAction(m.style,'channel');
  R.push(['CAST',[...[0,0.25,0.5].map(t=>({pose:sampleAction(ch,t,baseOf(m.style,m)),t})),...framesAct(m,'release',5)]]);
  for(const sp of specialsFor(cls,spec,m)) R.push([sp.toUpperCase(),framesAct(m,sp,sp==='spin'||sp==='flip'?8:6)]);
  R.push(['BLOCK / STUN',[...framesLoco(m,'block',2),...framesLoco(m,'stun',4)]]);
  R.push(['HURT',framesAct(m,'hurt',4)]);
  R.push(['DIE',framesAct(m,'die',7)]);
  R.push(['VICTORY',framesAct(m,'victory',5)]);
  return R;
}

function drawSheet(){
  const {cls,spec,skin}=sel;
  const m=modelOf(cls,spec,skin,sel.form);
  const pup=puppetFor(m);
  const rows=sheetRows(m,cls,spec);
  const maxN=Math.max(...rows.map(r=>r[1].length));
  const cv=$('sheet');
  cv.width=LABEL_W+maxN*CELL_W*ZOOM; cv.height=rows.length*CELL_H*ZOOM+40;
  cv.style.width=cv.width+'px';
  const g=cv.getContext('2d');
  g.fillStyle='#121826'; g.fillRect(0,0,cv.width,cv.height);
  g.fillStyle='#f4c430'; g.font='bold 16px "Segoe UI"';
  g.fillText(`${cls.name} · ${spec.name} · ${skin.name}${skin.tier?' ('+skin.tier+')':''}${sel.form==='alt'?' · '+spec.form.name:''}`,12,26);
  g.imageSmoothingEnabled=false;
  rows.forEach(([label,frames],r)=>{
    const y0=40+r*CELL_H*ZOOM;
    g.fillStyle=r%2?'#151c2c':'#18202f'; g.fillRect(0,y0,cv.width,CELL_H*ZOOM);
    g.fillStyle='#9fb0cc'; g.font='bold 13px Consolas,monospace';
    g.fillText(label,12,y0+22);
    frames.forEach((f,i)=>{
      renderCell(pup,f.pose,f.t,CELL_H-12-(f.lift||0)*G_SCALE/0.38);
      g.drawImage(cellCv,LABEL_W+i*CELL_W*ZOOM,y0,CELL_W*ZOOM,CELL_H*ZOOM);
    });
  });
}

function drawAll(){
  const cv=$('sheet');
  const list=[];
  for(const c of CLASSES) for(const s of c.specs) for(const k of s.skins){ list.push({c,s,k,form:'base'}); if(s.form) list.push({c,s,k,form:'alt'}); }
  const cols=12, cw=CELL_W, ch=CELL_H+14;
  cv.width=cols*cw*ZOOM; cv.height=Math.ceil(list.length/cols)*ch*ZOOM;
  cv.style.width=cv.width+'px';
  const g=cv.getContext('2d');
  g.fillStyle='#121826'; g.fillRect(0,0,cv.width,cv.height);
  g.imageSmoothingEnabled=false;
  list.forEach((e,i)=>{
    const x=(i%cols)*cw*ZOOM, y=Math.floor(i/cols)*ch*ZOOM;
    const m=modelOf(e.c,e.s,e.k,e.form), pup=puppetFor(m);
    const pose=m.kind==='cat'?catLoco({mode:'idle'},{...CAT0},0.3):locoPose(m.style,{mode:'idle'},baseOf(m.style,m),0.3);
    g.fillStyle=(Math.floor(i/3))%2?'#151c2c':'#1a2233'; g.fillRect(x,y,cw*ZOOM,ch*ZOOM);
    renderCell(pup,pose,0.3);
    g.drawImage(cellCv,x,y,cw*ZOOM,CELL_H*ZOOM);
    g.fillStyle=e.k.tier?'#dfe6f3':'#8b95a8'; g.font='11px "Segoe UI"'; g.textAlign='center';
    g.fillText((e.form==='alt'?e.s.form.em+' ':'')+(e.k.tier?e.k.tier+' ':'')+e.k.name,x+cw*ZOOM/2,y+CELL_H*ZOOM+14);
    g.textAlign='left';
  });
}

/* ---------- анатомія: з чого складається модель ----------
   Кожна частина в paint.js — окрема функція. Обгортки нижче малюють «вимкнені» частини
   на порожнє полотно, тож можна показати будь-яку частину окремо або шари по черзі. */
const PART_FN=[['drawAuraBack','aura'],['drawWing','wings'],['drawCape','cape'],['drawArm','arm'],['drawShoulder','shoulder'],
  ['drawTail','tail'],['drawLeg','leg'],['drawLower','lower'],['drawTorso','torso'],['drawTabard','tabard'],['drawHead','head'],
  ['drawHelm','helm'],['drawTendrils','tendrils'],['drawWeapon','weapon'],['drawShield','weapon']];
let partOnly=null;                       // Set ключів частин ('arm:f', 'helm', 'weapon:b'…) або null — уся модель
const NULL_C=document.createElement('canvas').getContext('2d');
for(const [fn,part] of PART_FN){
  const orig=window[fn];
  window[fn]=function(P,...a){
    if(!partOnly) return orig(P,...a);
    if(!P._real){ P._real=P.c; P._lights=P.lights; }
    if(part==='arm') P._side=a[0];
    const side=part==='weapon'?P._side:(a[0]==='b'||a[0]==='f'?a[0]:null);
    const on=partOnly.has(part)||(side&&partOnly.has(part+':'+side));
    const cur=P.c, l0=P.lights, tgt=on?P._real:NULL_C;
    if(tgt!==cur){ tgt.save(); tgt.setTransform(cur.getTransform()); }  // вкладена частина (шолом у голові) — у тих самих координатах
    P.c=tgt; P.lights=on?P._lights:[];
    try{ return orig(P,...a); }
    finally{ if(tgt!==cur) tgt.restore(); P.c=cur; P.lights=l0; }
  };
}
const PARTS=[['Аура','aura'],['Крила (задні)','wings'],['Плащ','cape'],['Задня рука','arm:b'],['Зброя в задній руці','weapon:b'],
  ['Задній наплічник','shoulder:b'],['Хвіст','tail'],['Задня нога','leg:b'],['Передня нога','leg:f'],['Низ броні','lower'],
  ['Тулуб','torso'],['Табард','tabard'],['Голова','head'],['Шолом','helm'],['Передня рука','arm:f'],['Зброя в передній руці','weapon:f'],
  ['Передній наплічник','shoulder:f'],['Вусики','tendrils']];
const cellCopy=()=>{ const c=document.createElement('canvas'); c.width=CELL_W; c.height=CELL_H; c.getContext('2d').drawImage(cellCv,0,0); return c; };
const cellEmpty=()=>{ const d=cellCtx.getImageData(0,0,CELL_W,CELL_H).data; for(let i=3;i<d.length;i+=4) if(d[i]>200) return false; return true; };
const BONES=[['pel','neck','#f6f2e8'],['neck','head','#f6f2e8'],['hipB','kneeB','#5aa8ff'],['kneeB','footB','#5aa8ff'],['hipF','kneeF','#9fd0ff'],['kneeF','footF','#9fd0ff'],
  ['shB','elB','#ff9440'],['elB','handB','#ff9440'],['shF','elF','#ffd23a'],['elF','handF','#ffd23a'],['hipB','hipF','#f6f2e8'],['shB','shF','#f6f2e8']];
function drawBones(g,pose,style,cx,gy,k,m){
  const S=solvePose(pose,style,!!(m&&typeof cutoutKey==='function'&&cutoutKey(m)));
  g.save(); g.setTransform(k,0,0,k,cx,gy); g.translate(pose.ox,pose.oy);
  g.lineCap='round';
  for(const [a,b,col] of BONES){
    g.beginPath(); g.moveTo(S[a].x,S[a].y); g.lineTo(S[b].x,S[b].y);
    g.strokeStyle='rgba(0,0,0,.6)'; g.lineWidth=5/k; g.stroke();
    g.strokeStyle=col; g.lineWidth=2.5/k; g.stroke();
  }
  for(const j of ['pel','neck','hipB','hipF','kneeB','kneeF','footB','footF','shB','shF','elB','elF','handB','handF']){
    g.fillStyle='#ff4a6a'; g.beginPath(); g.arc(S[j].x,S[j].y,4/k,0,7); g.fill();
  }
  g.strokeStyle='#f6f2e8'; g.lineWidth=2.5/k; g.beginPath(); g.arc(S.head.x,S.head.y,RIG.HEAD,0,7); g.stroke();
  g.restore();
}
function drawParts(){
  const {cls,spec,skin}=sel;
  const m=modelOf(cls,spec,skin,sel.form);
  const cv=$('sheet'), g=cv.getContext('2d');
  if(m.kind==='cat'){
    cv.width=640; cv.height=60; cv.style.width='640px';
    g.fillStyle='#121826'; g.fillRect(0,0,640,60); g.fillStyle='#dfe6f3'; g.font='14px "Segoe UI"';
    g.fillText('Форма кота малюється окремо (js/cat.js): анатомія — лише для гуманоїда',12,34); return;
  }
  const pup=puppetFor(m), base=baseOf(m.style,m);
  const idle=locoPose(m.style,{mode:'idle'},base,0.3);
  // 1. частини окремо
  const singles=[];
  for(const [label,key] of PARTS){
    partOnly=new Set([key]); renderCell(pup,idle,0.3);
    if(!cellEmpty()) singles.push({label,key,img:cellCopy()});
  }
  // 2. збирання шарами в порядку малювання
  const steps=[], acc=new Set();
  for(const s of singles){ acc.add(s.key); partOnly=new Set(acc); renderCell(pup,idle,0.3); steps.push({label:'+ '+s.label,img:cellCopy()}); }
  partOnly=null;
  // 3. кістяк: поза → суглоби → модель
  const heavy=getAction(m.style,'heavy'), atk=heavy?sampleAction(heavy,heavy.dur*0.45,base):idle;
  const run=locoPose(m.style,{mode:'run',phase:1.2},base,0.5);
  const bones=[{label:'Кістяк (IDLE)',pose:idle},{label:'Кістяк + модель',pose:idle,withM:1},
    {label:'HEAVY: кістяк + модель',pose:atk,withM:1},{label:'RUN: кістяк + модель',pose:run,withM:1}];
  // 4. палітра: базові кольори сету та їхні похідні (D — тінь, DD — глибока тінь, L — відблиск)
  const P_=m.pal, PAL_BASE=[['prim','броня'],['sec','друга тканина'],['trim','оздоблення'],['acc','світні акценти'],['metal','метал'],
    ['leath','шкіра / ремені'],['skin','обличчя'],['hair','волосся'],['eye','очі'],
    ...(m.cape?[['cape','плащ']]:[]),...(m.tabard?[['tab','табард']]:[]),...(m.style==='shield'?[['shieldCol','щит']]:[]),['outline','контур']];
  const pal=PAL_BASE.map(([k,label])=>({k,label,cols:[k,k+'L',k+'D',k+'DD'].filter(x=>P_[x])}));
  // 5. підсумковий опис моделі
  const DESC=['style','armor','race','bulk','helm','sh','lower','cape','tabard','main','off','glows','fx','aura','plates','panels','bands'];
  const desc=DESC.filter(k=>m[k]!==undefined&&m[k]!==null&&m[k]!==false).map(k=>`${k}: ${JSON.stringify(m[k])}`);

  // клітинки анатомії — обрізаний центр кадру, збільшений удвічі (ціле ×4 — пікселі рівні)
  const PER=6, cw=CELL_W*ZOOM, ch=CELL_H*ZOOM, lab=22, secH=36, Z2=ZOOM*2;
  const SX=Math.round(CELL_W*0.33), SY=Math.round(CELL_H*0.47), GY=CELL_H-12;
  const zc=(img,x,yy)=>g.drawImage(img,SX,SY,CELL_W/2,CELL_H/2,x,yy,cw,ch);
  const rowsOf=n=>Math.ceil(n/PER);
  const palCols=2, palRowH=34, palRows=Math.ceil(pal.length/palCols);
  cv.width=PER*cw+24;
  cv.height=50+secH*5+(rowsOf(singles.length)+rowsOf(steps.length)+rowsOf(bones.length))*(ch+lab)+palRows*palRowH+desc.length*20+30;
  cv.style.width=cv.width+'px';
  g.fillStyle='#121826'; g.fillRect(0,0,cv.width,cv.height);
  g.imageSmoothingEnabled=false;
  g.fillStyle='#f4c430'; g.font='bold 18px "Segoe UI"';
  g.fillText(`Анатомія: ${cls.name} · ${spec.name} · ${skin.name}${skin.tier?' ('+skin.tier+')':''}`,12,30);
  let y=50;
  const section=(t,hint)=>{
    g.fillStyle='#f4c430'; g.font='bold 15px "Segoe UI"'; g.fillText(t,12,y+22);
    const w=g.measureText(t).width;
    if(hint){ g.fillStyle='#8b95a8'; g.font='12px "Segoe UI"'; g.fillText(hint,24+w,y+22); }
    y+=secH;
  };
  const grid=(items,draw)=>{
    items.forEach((it,i)=>{
      const x=12+(i%PER)*cw, yy=y+Math.floor(i/PER)*(ch+lab);
      g.fillStyle=(i%2)?'#151c2c':'#1a2233'; g.fillRect(x,yy,cw-4,ch+lab-4);
      draw(it,x,yy);
      g.fillStyle='#dfe6f3'; g.font='13px "Segoe UI"'; g.textAlign='center'; g.fillText(it.label,x+cw/2-2,yy+ch+10); g.textAlign='left';
    });
    y+=rowsOf(items.length)*(ch+lab);
  };
  section('1. ДЕТАЛІ ОКРЕМО','кожна — окрема функція в js/paint.js; форма й кольори — з SET_LOOK / SPEC_LOOK / CLASS_LOOK');
  grid(singles,(it,x,yy)=>zc(it.img,x,yy));
  section('2. ЗБИРАННЯ ПО ШАРАХ','порядок малювання в paintModel(): задній план → тіло → передня рука поверх усього');
  grid(steps,(it,x,yy)=>zc(it.img,x,yy));
  section('3. КІСТЯК','js/rig.js: поза — набір чисел (нахил, ступні, кисті); solvePose() рахує лікті й коліна (IK)');
  grid(bones,(it,x,yy)=>{
    if(it.withM){ renderCell(pup,it.pose,0.3); g.globalAlpha=0.5; zc(cellCv,x,yy); g.globalAlpha=1; }
    g.save(); g.beginPath(); g.rect(x,yy,cw-4,ch); g.clip();
    drawBones(g,it.pose,m.style,x+(CELL_W/2-SX)*Z2,yy+(GY-SY)*Z2,G_SCALE*Z2,m);
    g.restore();
  });
  section('4. ПАЛІТРА','у сеті задаєш лише базу (prim, sec, trim, acc…); L — відблиск, D/DD — тіні рахуються самі');
  const pw=Math.floor((cv.width-24)/palCols);
  pal.forEach((e,i)=>{
    const x=12+(i%palCols)*pw, yy=y+Math.floor(i/palCols)*palRowH;
    g.fillStyle='#dfe6f3'; g.font='13px Consolas,monospace'; g.fillText(e.k,x,yy+19);
    g.fillStyle='#8b95a8'; g.font='12px "Segoe UI"'; g.fillText(e.label,x+90,yy+19);
    e.cols.forEach((k,j)=>{ const sx=x+230+j*150;
      g.fillStyle=P_[k]; g.fillRect(sx,yy+4,30,22); g.strokeStyle='#26324a'; g.strokeRect(sx+0.5,yy+4.5,29,21);
      g.fillStyle=j?'#8b95a8':'#dfe6f3'; g.font='12px Consolas,monospace'; g.fillText(`${k.slice(e.k.length)||'база'} ${P_[k]}`,sx+36,yy+19); });
  });
  y+=palRows*palRowH;
  section('5. ОПИС МОДЕЛІ','CLASS_LOOK → SPEC_LOOK → SET_LOOK після злиття (resolveModel у js/models.js)');
  g.font='13px Consolas,monospace'; g.fillStyle='#9fb0cc';
  desc.forEach((l,i)=>g.fillText(l,12,y+14+i*20));
}

/* ---------- живе прев'ю: цикл по всіх анімаціях ---------- */
const live={t:0,idx:0,ctl:null,m:null,pup:null,seq:[]};
function setupLive(){
  const {cls,spec,skin}=sel;
  live.m=modelOf(cls,spec,skin,sel.form); live.pup=puppetFor(live.m);
  const cat=live.m.kind==='cat';
  live.ctl=cat?new CatAnimCtl():new AnimCtl(live.m.style,live.m.stance);
  live.seq=cat?['idle','run','atkA','atkB','heavy','roar','lunge','hurt','block','idle']
    :['idle','run','atkA','atkB','heavy','channel','release',...specialsFor(cls,spec,live.m),'hurt','block','idle'];
  live.idx=0; live.t=0;
}
function liveStep(dt){
  const L=live; if(!L.ctl) return;
  L.t+=dt;
  const cur=L.seq[L.idx];
  const loco={mode:'idle',speed:260,vy:0};
  let dur=1.2;
  if(cur==='run'){ loco.mode='run'; dur=1.4; }
  else if(cur==='block'){ loco.mode='block'; dur=0.8; }
  else if(cur==='channel'){ loco.channel=Math.min(1,L.t/1.0); dur=1.0; }
  if(L.t>=dur){
    L.t=0; L.idx=(L.idx+1)%L.seq.length;
    const nx=L.seq[L.idx];
    if(!['idle','run','block','channel'].includes(nx)) L.ctl.play(nx);
  }
  const pose=L.ctl.update(dt,loco);
  const cv=$('live'), g=cv.getContext('2d');
  const main=ctx; ctx=g;
  ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,cv.width,cv.height);
  ctx.fillStyle='rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(60,104,16,3.5,0,0,7); ctx.fill();
  ctx.setTransform(0.5,0,0,0.5,60,102);
  L.pup.pose=pose; L.pup.time=performance.now()/1000;
  drawSprite(L.pup);
  ctx=main;
}

/* ---------- вибір ---------- */
function fillSelects(){
  const sc=$('selCls'), ss=$('selSpec'), sk=$('selSkin');
  sc.innerHTML=CLASSES.map((c,i)=>`<option value="${i}" ${c===sel.cls?'selected':''}>${c.em} ${c.name}</option>`).join('');
  ss.innerHTML=sel.cls.specs.map((s,i)=>`<option value="${i}" ${s===sel.spec?'selected':''}>${s.em} ${s.name}</option>`).join('');
  sk.innerHTML=sel.spec.skins.map((k,i)=>`<option value="${i}" ${k===sel.skin?'selected':''}>${k.tier?k.tier+' ':''}${k.name}</option>`).join('');
}
function refresh(){
  fillSelects();
  $('bSheet').classList.toggle('on',mode==='sheet'); $('bAll').classList.toggle('on',mode==='all'); $('bParts').classList.toggle('on',mode==='parts');
  if(!sel.spec.form) sel.form='base';
  $('bForm').style.display=sel.spec.form?'':'none';
  $('bProc').classList.toggle('on',CUTOUT_OFF);
  $('bForm').classList.toggle('on',sel.form==='alt');
  $('bForm').textContent=sel.spec.form?(sel.form==='alt'?'🧝 Гуманоїд':sel.spec.form.em+' '+sel.spec.form.name):'';
  if(mode==='sheet') drawSheet(); else if(mode==='parts') drawParts(); else drawAll();
  setupLive();
}
$('selCls').onchange=e=>{ sel.cls=CLASSES[+e.target.value]; sel.spec=sel.cls.specs[0]; sel.skin=sel.spec.skins[0]; refresh(); };
$('selSpec').onchange=e=>{ sel.spec=sel.cls.specs[+e.target.value]; sel.skin=sel.spec.skins[0]; refresh(); };
$('selSkin').onchange=e=>{ sel.skin=sel.spec.skins[+e.target.value]; refresh(); };
$('bSheet').onclick=()=>{ mode='sheet'; refresh(); };
$('bAll').onclick=()=>{ mode='all'; refresh(); };
$('bParts').onclick=()=>{ mode='parts'; refresh(); };
// процедурна модель замість растрових деталей (?cutout=off) задається при завантаженні — перемикач перезавантажує сторінку
$('bProc').onclick=()=>{ const q=new URLSearchParams(location.search);
  q.set('skin',`${sel.cls.id}/${sel.spec.name}/${sel.spec.skins.indexOf(sel.skin)}`); q.set('mode',mode);
  if(CUTOUT_OFF) q.delete('cutout'); else q.set('cutout','off');
  location.search=q.toString(); };
// набори деталей вантажаться за потреби — коли черговий готовий, перемальовуємо (не частіше раз на кадр)
let cutRedraw=0;
function onCutoutReady(){ if(!cutRedraw) cutRedraw=requestAnimationFrame(()=>{ cutRedraw=0; refresh(); }); }
$('bForm').onclick=()=>{ if(!sel.spec.form) return; sel.form=sel.form==='alt'?'base':'alt'; refresh(); };
refresh();
let lastT=performance.now();
(function tick(now){ liveStep(Math.min(0.05,(now-lastT)/1000)); lastT=now; requestAnimationFrame(tick); })(lastT);
