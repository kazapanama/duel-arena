"use strict";
/* ============================================================
   ГАЛЕРЕЯ: спрайт-шит скіну (як референс) і сітка всіх скінів.
   Параметри URL: ?skin=rogue/Assassination/2  ?mode=all
   ============================================================ */
const $=id=>document.getElementById(id);
const Q=new URLSearchParams(location.search);
const G_SCALE=+(Q.get('scale')||0.7);  // як у бою: камера ~1.4 / піксель 2          // арт-пікселів на світову одиницю (як у бою при макс. наближенні)
const CELL_W=Math.round(84*G_SCALE/0.38), CELL_H=Math.round(100*G_SCALE/0.38); // клітинка кадру в арт-пікселях
const ZOOM=+(Q.get('zoom')||2);                // збільшення на сторінці
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
  g.fillText(`${cls.name} · ${spec.name} · ${skin.name}${skin.tier?' (T'+skin.tier+')':''}${sel.form==='alt'?' · '+spec.form.name:''}`,12,26);
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
    g.fillText((e.form==='alt'?e.s.form.em+' ':'')+(e.k.tier?'T'+e.k.tier+' ':'')+e.k.name,x+cw*ZOOM/2,y+CELL_H*ZOOM+14);
    g.textAlign='left';
  });
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
  sk.innerHTML=sel.spec.skins.map((k,i)=>`<option value="${i}" ${k===sel.skin?'selected':''}>${k.tier?'T'+k.tier+' ':''}${k.name}</option>`).join('');
}
function refresh(){
  fillSelects();
  $('bSheet').classList.toggle('on',mode==='sheet'); $('bAll').classList.toggle('on',mode==='all');
  if(!sel.spec.form) sel.form='base';
  $('bForm').style.display=sel.spec.form?'':'none';
  $('bForm').classList.toggle('on',sel.form==='alt');
  $('bForm').textContent=sel.spec.form?(sel.form==='alt'?'🧝 Гуманоїд':sel.spec.form.em+' '+sel.spec.form.name):'';
  if(mode==='sheet') drawSheet(); else drawAll();
  setupLive();
}
$('selCls').onchange=e=>{ sel.cls=CLASSES[+e.target.value]; sel.spec=sel.cls.specs[0]; sel.skin=sel.spec.skins[0]; refresh(); };
$('selSpec').onchange=e=>{ sel.spec=sel.cls.specs[+e.target.value]; sel.skin=sel.spec.skins[0]; refresh(); };
$('selSkin').onchange=e=>{ sel.skin=sel.spec.skins[+e.target.value]; refresh(); };
$('bSheet').onclick=()=>{ mode='sheet'; refresh(); };
$('bAll').onclick=()=>{ mode='all'; refresh(); };
$('bForm').onclick=()=>{ if(!sel.spec.form) return; sel.form=sel.form==='alt'?'base':'alt'; refresh(); };
refresh();
let lastT=performance.now();
(function tick(now){ liveStep(Math.min(0.05,(now-lastT)/1000)); lastT=now; requestAnimationFrame(tick); })(lastT);
