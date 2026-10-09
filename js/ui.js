"use strict";
/* ============================================================
   ІНТЕРФЕЙС: титул і меню, керування, вибір бійця, VS, пауза, фінал.
   Навігація однакова для миші, клавіатури й геймпада:
   UI.key(code) і UI.pad(button) — точки входу з input.js.
   ============================================================ */
const $=id=>document.getElementById(id);
const screens={arenaSel:$('arenaSel'),title:$('title'),settings:$('settings'),controls:$('controls'),netLobby:$('netLobby'),select:$('select'),versus:$('versus'),pauseMenu:$('pauseMenu'),overlay:$('overlay')};
// картинка, якої нема (набір іконок не в репозиторії), просто ховається — не лишає «битої» рамки
addEventListener('error',e=>{ if(e.target instanceof HTMLImageElement) e.target.classList.add('broken'); },true);
for(const im of document.images) if(im.complete&&!im.naturalWidth&&im.getAttribute('src')) im.classList.add('broken'); // ті, що впали до цього рядка

/* ---------- збережені налаштування і вибір скінів ---------- */
const store=(k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)||'null')??d; }catch(e){ return d; } };
const save=(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} };
const SKIN_PREF=store('aa_skins',{});
if(SKIN_PREF['rogue/Outlaw']&&!SKIN_PREF['rogue/Combat']) SKIN_PREF['rogue/Combat']=SKIN_PREF['rogue/Outlaw']; // спек перейменовано
const PREFS=store('aa_prefs',{aiSkill:1,muted:false});
state.aiSkill=PREFS.aiSkill??1; muted=!!PREFS.muted;
if(['auto','high','fast'].includes(PREFS.gfx)) GFX.mode=PREFS.gfx; GFX.autoFast=!!PREFS.gfxAutoFast;
function skinKey(cls,spec){ return cls.id+'/'+spec.name; }
// вибір пам'ятаємо за назвою сету (сети на спеку можуть переставлятися); старі збереження — номер, де 0 був «Класичний»
function preferredSkin(cls,spec){
  const v=SKIN_PREF[skinKey(cls,spec)];
  const k=typeof v==='string'?spec.skins.find(s=>s.name===v):(typeof v==='number'?spec.skins[v-1]:null);
  return k||spec.skins[0];
}
function rememberSkin(cls,spec,skin){ SKIN_PREF[skinKey(cls,spec)]=skin.name; save('aa_skins',SKIN_PREF); }
function savePrefs(){ save('aa_prefs',{aiSkill:state.aiSkill,muted,gfx:GFX.mode,gfxAutoFast:GFX.autoFast}); }
const GFX_MODES=['auto','high','fast'], GFX_NAMES={auto:'авто',high:'висока',fast:'швидка'};
const DIFF_NAMES=['Легко','Нормально','Важко'];

/* ---------- показ екранів ---------- */
const UI={cur:null,focusEl:null,awake:false,t:0};
function show(name){
  for(const k in screens) screens[k].classList.add('hidden');
  if(name&&screens[name]) screens[name].classList.remove('hidden');
  UI.cur=name||null;
  state.screen=name&&name!=='overlay'&&name!=='pauseMenu'?name:'fight';
  if(name==='title'||name==='settings'||name==='controls'||name==='netLobby'||name==='overlay'||name==='pauseMenu') focusFirst(name);
}
function listItems(scr){ return [...screens[scr].querySelectorAll('[data-nav]')].filter(el=>el.offsetParent!==null); }
function setFocus(el,quiet){
  if(UI.focusEl===el) return;
  document.querySelectorAll('.focus').forEach(x=>x.classList.remove('focus'));
  UI.focusEl=el; if(el){ el.classList.add('focus'); if(!quiet) sfx('tick'); }
}
function focusFirst(scr){ setFocus(listItems(scr)[0]||null,true); }
function listMove(scr,d){
  const it=listItems(scr); if(!it.length) return;
  let i=it.indexOf(UI.focusEl); i=i<0?0:(i+d+it.length)%it.length; setFocus(it[i]);
}
// наведення мишею = фокус; клік = дія
for(const k in screens){
  screens[k].addEventListener('pointerover',e=>{ const el=e.target.closest('[data-nav]'); if(el) setFocus(el); });
  screens[k].addEventListener('click',e=>{ const el=e.target.closest('[data-act]'); if(el) act(el.dataset.act,1,el); });
}

/* ---------- підказки: клавіатура чи геймпад (за останнім вводом) ---------- */
UI.device='kb';
const KB=(...ks)=>ks.map(x=>`<kbd class="mini">${x}</kbd>`).join('');
const ARR=d=>`<i class="arr ${d}"></i>`;
const PB=b=>b==='dpad'?'<i class="pb dp"></i>':`<i class="pb${'XYBA'.includes(b)&&b.length===1?' pb-'+b.toLowerCase():''}">${b}</i>`;
const HINTS={
  hintTitle:{kb:[[KB(ARR('u'),ARR('d')),'вибір'],[KB('Enter'),'обрати']], pad:[[PB('dpad'),'вибір'],[PB('A'),'обрати']]},
  hintSettings:{kb:[[KB(ARR('l'),ARR('r')),'змінити'],[KB('Esc'),'назад']], pad:[[PB('dpad'),'змінити'],[PB('B'),'назад']]},
  hintControls:{kb:[[KB('Esc'),'пауза або назад'],[KB('M'),'звук']], pad:[[PB('B'),'назад'],[PB('▶'),'пауза в бою']]},
  selKeys:{kb:[[KB(ARR('l'),ARR('r'),ARR('u'),ARR('d')),'клас'],[KB('Q','E'),'спеціалізація'],[KB('Z','C'),'скін'],[KB('R'),'випадково'],[KB('Enter'),'готово'],[KB('Esc'),'назад']],
           pad:[[PB('dpad'),'клас'],[PB('L1')+PB('R1'),'спеціалізація'],[PB('L2')+PB('R2'),'скін'],[PB('Y'),'випадково'],[PB('A'),'готово'],[PB('B'),'назад']]},
};
function renderHints(){
  for(const id in HINTS){ const el=$(id); if(!el) continue;
    el.innerHTML=HINTS[id][UI.device].map(([k,t])=>`<span class="hk">${k} ${t}</span>`).join(''); }
}
function setDevice(d){
  if(UI.device===d) return;
  UI.device=d; renderHints();
  if(UI.cur==='select'&&SEL.sides[0]) renderSelect();   // позначки здібностей: J K L… ↔ X Y B…
}

/* ---------- дії ---------- */
function act(a,dir=1,el){
  switch(a){
    case 'ai': sfx('ok'); state.mode='ai'; openSelect(); break;
    case 'pvp': sfx('ok'); state.mode='pvp'; openSelect(); break;
    case 'net': sfx('ok'); netOpen(); break;
    case 'netRetry': sfx('tick'); netOpen(); break;
    case 'diff': state.aiSkill=(state.aiSkill+dir+3)%3; savePrefs(); renderMenuVals(); sfx('tick'); break;
    case 'sound': muted=!muted; savePrefs(); renderMenuVals(); sfx('tick'); break;
    case 'gfx': GFX.mode=GFX_MODES[(GFX_MODES.indexOf(GFX.mode)+dir+3)%3]; GFX.autoFast=false; savePrefs(); renderMenuVals(); sfx('tick'); break;   // «авто» — заново оцінює пристрій
    case 'controls': sfx('ok'); show('controls'); break;
    case 'settings': sfx('ok'); show('settings'); break;
    case 'gallery': location.href='gallery.html'; break;
    case 'back': sfx('tick'); if(UI.cur==='select') selBack(); else { if(UI.cur==='netLobby') netLeave(); backToTitle(); } break;
    case 'random': selRandom(); break;
    case 'lock': selLock(); break;
    case 'resume': togglePause(); break;
    case 'restart': closePause(); startFight(); break;
    case 'chars': if(NET.on) NET.send({t:'chars'}); toSelect(); break;
    case 'menu': closePause(); state.game=null; if(NET.ws) netLeave(); show('title'); break;
    case 'rematch': if(NET.guest) NET.send({t:'rematch'}); else startFight(); break;
  }
}
function backToTitle(){
  const from=UI.cur==='netLobby'?'net':UI.cur; show('title');
  const el=screens.title.querySelector(`[data-act="${from}"]`); if(el) setFocus(el,true);
}
// «Інші бійці»: з паузи чи фіналу — назад до вибору (у мережі — обидва гравці разом)
function toSelect(){
  closePause(); screens.overlay.classList.add('hidden'); state.game=null;
  NET.remoteSel=null; openSelect();
}
function renderMenuVals(){ $('diffVal').textContent=DIFF_NAMES[state.aiSkill]; $('soundVal').textContent=muted?'вимкнено':'увімкнено';
  $('gfxVal').textContent=GFX_NAMES[GFX.mode]+(GFX.mode==='auto'&&GFX.autoFast?' (швидка)':''); }
renderMenuVals();
renderHints();

/* ---------- титул: «натисни будь-яку клавішу» → вибух порталу і меню ---------- */
function wake(){
  if(UI.awake) return;
  UI.awake=true; ac(); sfx('big');
  if(typeof MBG!=='undefined') MBG.surge=1;
  screens.title.classList.add('awake');
  focusFirst('title');
}
screens.title.addEventListener('pointerdown',()=>{ if(!UI.awake) wake(); });

/* ============================================================
   ПІКСЕЛЬНА ВІТРИНА: низькороздільне полотно, що масштабується
   цілим множником (чіткі пікселі на будь-якому екрані)
   ============================================================ */
class PixelView{
  constructor(cv,w,h){ this.cv=cv; this.low=document.createElement('canvas'); this.low.width=w; this.low.height=h; this.g=this.low.getContext('2d');
    // бійці з растрових деталей — у шарі вдвічі більшої роздільності поверх низького (SPR_HD, sprite.js)
    this.hd=document.createElement('canvas'); this.hd.width=w*2; this.hd.height=h*2; this.hg=this.hd.getContext('2d'); }
  present(align='bottom'){
    const r=this.cv.getBoundingClientRect(); if(!r.width) return;
    const dpr=window.devicePixelRatio||1, W=Math.round(r.width*dpr), H=Math.round(r.height*dpr);
    if(this.cv.width!==W||this.cv.height!==H){ this.cv.width=W; this.cv.height=H; }
    const k=Math.max(1,Math.floor(Math.min(W/this.low.width,H/this.low.height)));
    const g=this.cv.getContext('2d'); g.imageSmoothingEnabled=false; g.clearRect(0,0,W,H);
    const dw=this.low.width*k, dh=this.low.height*k;
    const x=Math.round((W-dw)/2), y=align==='bottom'?H-dh:Math.round((H-dh)/2);
    g.drawImage(this.low,x,y,dw,dh); g.drawImage(this.hd,x,y,dw,dh);
  }
}
// рунний п'єдестал кольору класу (у низькій роздільності — пікселізується сам)
function drawPedestal(g,cx,gy,col,t){
  g.save();
  g.fillStyle='#120b09'; g.beginPath(); g.ellipse(cx,gy+5,46,11,0,0,7); g.fill();
  g.fillStyle='#2e211b'; g.beginPath(); g.ellipse(cx,gy+3,44,9,0,0,7); g.fill();
  g.fillStyle='#46332a'; g.beginPath(); g.ellipse(cx,gy+2,40,7,0,0,7); g.fill();
  g.strokeStyle=col; g.lineWidth=1; g.globalAlpha=.9;
  g.beginPath(); g.ellipse(cx,gy+2,34,5.5,0,0,7); g.stroke();
  for(let i=0;i<14;i++){ const a=t*.5+i/14*Math.PI*2; g.fillStyle=i%2?col:'#fff6d0'; g.fillRect(Math.round(cx+Math.cos(a)*34)-1,Math.round(gy+2+Math.sin(a)*5.5),2,1); }
  g.globalCompositeOperation='lighter'; g.globalAlpha=.55;
  const gr=g.createRadialGradient(cx,gy,2,cx,gy,50); gr.addColorStop(0,col); gr.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=gr; g.fillRect(cx-50,gy-30,100,40);
  g.restore();
}
// колір класу → rgba з прозорістю
function rgbaOf(hex,a){ const n=parseInt(hex.slice(1),16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; }
// частинки вітрини: іскри піднімаються від п'єдесталу, при зміні/фіксації — вибух
function fxBurst(fx,cx,gy,col,n,power){
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, v=(20+Math.random()*60)*power;
    fx.parts.push({x:cx+Math.cos(a)*10,y:gy-4-Math.random()*50,vx:Math.cos(a)*v,vy:Math.sin(a)*v*.6-25*power,life:0,max:.5+Math.random()*.6,col:Math.random()<.3?'#fff6d0':col,sz:Math.random()<.25?2:1});
  }
}
function fxDraw(g,fx,cx,gy,col,dt,t,W,H){
  // фонові іскри
  fx.acc+=dt*22;
  while(fx.acc>1){ fx.acc--; fx.parts.push({x:cx+(Math.random()-.5)*70,y:gy+(Math.random()-.5)*6,vx:(Math.random()-.5)*6,vy:-(12+Math.random()*26),life:0,max:1.6+Math.random()*1.8,col:Math.random()<.2?'#fff6d0':col,sz:Math.random()<.3?2:1,wob:Math.random()*6}); }
  fx.flash=Math.max(0,fx.flash-dt*2.2);
  g.save(); g.globalCompositeOperation='lighter';
  // світловий стовп згори на п'єдестал
  // смуги, як у піксель-арті: широка тьмяна, вужча яскравіша, ядро
  const pw=36+fx.flash*30, pulse=.34+Math.sin(t*2.1)*.06+fx.flash*.5;
  for(const [wk,ak,c] of [[1,.45,col],[.62,.7,col],[.3,1,fx.flash>.05?'#fff8e0':col]]){
    const w=Math.round(pw*wk/2)*2, gr=g.createLinearGradient(0,0,0,gy);
    gr.addColorStop(0,rgbaOf(c,0)); gr.addColorStop(.6,rgbaOf(c,pulse*ak*.45)); gr.addColorStop(1,rgbaOf(c,pulse*ak));
    g.fillStyle=gr; g.fillRect(Math.round(cx-w/2),0,w,gy);
  }
  // кільце при фіксації
  if(fx.ring>=0){
    fx.ring+=dt*1.6; const r=fx.ring*90, a=Math.max(0,1-fx.ring);
    g.strokeStyle=rgbaOf(col,a); g.lineWidth=2; g.beginPath(); g.ellipse(cx,gy+2,r,r*.22,0,0,7); g.stroke();
    g.strokeStyle=`rgba(255,250,225,${a*.8})`; g.lineWidth=1; g.beginPath(); g.ellipse(cx,gy+2,r*.8,r*.18,0,0,7); g.stroke();
    if(fx.ring>1) fx.ring=-1;
  }
  g.restore();
  // оновлення й малювання частинок (після бійця — поверх)
  fx.draw=()=>{
    g.save(); g.globalCompositeOperation='lighter';
    fx.parts=fx.parts.filter(q=>(q.life+=dt)<q.max&&q.y>-4&&q.x>-4&&q.x<W+4);
    for(const q of fx.parts){
      q.x+=(q.vx+(q.wob?Math.sin(t*3+q.wob)*6:0))*dt; q.y+=q.vy*dt; q.vx*=1-dt*1.5; if(!q.wob) q.vy+=40*dt;
      const k=1-q.life/q.max; g.globalAlpha=Math.min(1,k*1.6)*(.6+.4*Math.sin(t*20+q.x));
      g.fillStyle=q.col; g.fillRect(Math.round(q.x),Math.round(q.y),q.sz,q.sz);
    }
    g.restore();
  };
}
// малюємо бійця в низькороздільну вітрину (тимчасово підміняючи глобальний ctx)
function renderFighterTo(view,f,scale,gx,gy,t){
  const main=ctx; ctx=view.g;
  view.hg.setTransform(1,0,0,1,0,0); view.hg.clearRect(0,0,view.hd.width,view.hd.height);
  SPR_HD.ctx=view.hg; SPR_HD.k=2;
  ctx.setTransform(scale,0,0,scale,gx,gy);
  drawSprite(f.spriteState(t));
  SPR_HD.ctx=null;
  ctx=main;
}

/* ============================================================
   ВИБІР БІЙЦЯ
   ============================================================ */
const SEL={side:0,sides:[null,null],shows:[],thumbs:[],t:0,fx:[null,null]};
const newFx=()=>({parts:[],acc:0,flash:0,ring:-1});
function specIconOf(spec){ return spec.img||spec.abilities[1].img||spec.abilities[0].img; }
// іконка з набору або, якщо набору нема, емодзі на її місці
const iconHtml=(src,em,alt='')=>src?`<img src="${encodeURI(src)}" alt="${alt}">`:`<b class="ico-fb">${em||''}</b>`;
const KEYS_PAD=['X','Y','B','A','R1'];
function keyLabels(side){
  if(state.mode==='ai'&&side===1) return null;              // бот — без клавіш
  if(TOUCH.on) return null;                                 // на телефоні клавіш нема
  if(UI.device==='pad') return KEYS_PAD;
  return side===0?['J','K','L','U','I']:['1','2','3','4','5'];
}

function makeSide(side,ci,si,ki){
  const cls=CLASSES[ci], spec=cls.specs[si], skin=spec.skins[ki];
  const f=new Fighter(cls,spec,side,skin);
  f.preview=true; f.facing=side===0?1:-1; f.x=0; f.y=0;
  return {ci,si,ki,locked:false,stage:'spec',f,nextT:2.5+Math.random()};   // stage: 'spec' — клас і спек, 'skin' — вигляд
}
function pickDefaults(side){
  const p=state.picks[side];
  if(p){ const ci=CLASSES.indexOf(p.cls), si=p.cls.specs.indexOf(p.spec); return [ci,si,p.spec.skins.indexOf(p.skin)]; }
  const ci=side===0?0:Math.floor(Math.random()*CLASSES.length), si=side===0?0:Math.floor(Math.random()*3);
  const spec=CLASSES[ci].specs[si]; return [ci,si,spec.skins.indexOf(preferredSkin(CLASSES[ci],spec))];
}
function openSelect(){
  SEL.side=NET.on?NET.side:0; SEL.fx=[newFx(),newFx()];   // у мережі кожен обирає свого бійця одночасно
  for(const s of [0,1]){ const [ci,si,ki]=pickDefaults(s); SEL.sides[s]=makeSide(s,ci,si,ki); }
  buildSelectDom();
  show('select');
  selPrewarm();
  if(NET.on&&NET.remoteSel) netApplySel(NET.remoteSel);   // суперник міг обрати раніше, ніж відкрився екран
  renderSelect();
}
// очікування своєї черги (лише гра на одному пристрої: праву вітрину «гасимо», поки обирає перший)
const selWaiting=side=>!NET.on&&side===1&&SEL.side===0;
function buildSelectDom(){
  // вітрини
  SEL.shows=[['showL',0],['showR',1]].map(([id])=>{ const el=$(id);
    return {el,view:new PixelView(el.querySelector('.sc-cv'),124,184)}; });
  // ростер класів
  const ro=$('roster'); ro.innerHTML='';
  CLASSES.forEach((c,ci)=>{
    const b=document.createElement('button'); b.className='pf rtile'; b.style.setProperty('--cc',c.color);
    b.title=c.name; b.innerHTML=iconHtml(c.img,c.em,c.name);
    b.addEventListener('pointerenter',()=>selSetClass(ci));
    b.addEventListener('click',()=>{ selSetClass(ci); sfx('ok'); });
    ro.appendChild(b);
  });
  renderHints();
}
function curSide(){ return SEL.sides[SEL.side]; }
function rebuildFighter(side){
  const s=SEL.sides[side]; const n=makeSide(side,s.ci,s.si,s.ki); n.locked=s.locked; n.stage=s.stage; SEL.sides[side]=n;
  n.f.shiftT=0.35; // спалах при зміні
  const fx=SEL.fx[side]; fx.flash=Math.max(fx.flash,.7); fxBurst(fx,62,168,CLASSES[n.ci].color,18,1);
}
function selSetClass(ci){
  const s=curSide(); if(s.locked||s.stage!=='spec'||s.ci===ci) return;
  s.ci=ci; s.si=0; const cls=CLASSES[ci]; s.ki=cls.specs[0].skins.indexOf(preferredSkin(cls,cls.specs[0]));
  rebuildFighter(SEL.side); sfx('tick'); renderSelect();
}
function selSetSpec(si){
  const s=curSide(); if(s.locked||s.stage!=='spec') return; const cls=CLASSES[s.ci];
  si=(si+3)%3; if(si===s.si) return;
  s.si=si; s.ki=cls.specs[si].skins.indexOf(preferredSkin(cls,cls.specs[si]));
  rebuildFighter(SEL.side); sfx('tick'); renderSelect();
}
function selSetSkin(ki){
  const s=curSide(); if(s.locked) return; const n=CLASSES[s.ci].specs[s.si].skins.length;
  ki=(ki+n)%n; if(ki===s.ki) return;
  s.ki=ki; rebuildFighter(SEL.side); sfx('tick'); renderSelect();
}
function selMoveClass(dx,dy){
  const s=curSide(); if(s.locked) return;
  if(s.stage==='skin'){ if(dx) selSetSkin(s.ki+dx); return; }   // на кроці вигляду стрілки гортають скіни
  let c=s.ci%5, r=Math.floor(s.ci/5);
  c=(c+dx+5)%5; r=(r+dy+2)%2; selSetClass(r*5+c);
}
function selRandom(){
  const s=curSide(); if(s.locked) return;
  const ci=Math.floor(Math.random()*CLASSES.length), si=Math.floor(Math.random()*3);
  s.ci=ci; s.si=si; s.ki=Math.floor(Math.random()*CLASSES[ci].specs[si].skins.length);
  rebuildFighter(SEL.side); sfx('ok'); renderSelect();
}
// фіксація вибору: спалах, кільце, трус екрана (для свого боку і для суперника по мережі)
function lockSide(side){
  const s=SEL.sides[side];
  s.locked=true; const cls=CLASSES[s.ci], spec=cls.specs[s.si], skin=spec.skins[s.ki];
  state.picks[side]={cls,spec,skin};
  s.f.anim.play('victory'); s.f.shiftT=0.35; sfx('lock');
  const fx=SEL.fx[side]; fx.flash=1.3; fx.ring=0; fxBurst(fx,62,168,cls.color,60,1.7);
  const se=screens.select; se.classList.remove('shake'); void se.offsetWidth; se.classList.add('shake');
}
function selLock(){
  const s=curSide(); if(s.locked) return;
  if(s.stage==='spec'){ s.stage='skin'; sfx('ok'); renderSelect(); return; }   // клас і спек обрано — далі вигляд
  const spec=CLASSES[s.ci].specs[s.si];
  rememberSkin(CLASSES[s.ci],spec,spec.skins[s.ki]);
  lockSide(SEL.side);
  if(NET.on){ renderSelect(); netCheckVersus(); return; }
  if(SEL.side===0){ SEL.side=1; }
  else { setTimeout(openArenaSel,650); }
  renderSelect();
}
function selBack(){
  { const s=curSide(); if(!s.locked&&s.stage==='skin'){ s.stage='spec'; sfx('tick'); renderSelect(); return; } }   // з вигляду — назад до спеку
  if(NET.on){ // у мережі «назад» знімає свою фіксацію, а без неї — вихід із мережевої гри
    const s=curSide();
    if(NET.vsPending) return;               // обидва вже готові — летимо на VS
    if(s.locked){ s.locked=false; s.f.anim.stop(); renderSelect(); }
    else { netLeave(); show('title'); }
    return;
  }
  if(SEL.side===1&&!SEL.sides[1].locked){ SEL.side=0; SEL.sides[0].locked=false; SEL.sides[0].stage='skin'; SEL.sides[0].f.anim.stop(); renderSelect(); }
  else if(SEL.side===0){ show('title'); }
}
// розмітка рядків списку здібностей і вкладок спеків (спільна для екрана й прогріву selPrewarm)
const abilRowHtml=(a,i,keys)=>`<i class="slot s${i}">${keys?keys[i]:''}</i>${iconHtml(a.img,a.icon)}<div><b>${a.name}</b><span>${descr(a)}</span></div>`;
const ultRowHtml=(cls,spec,keys,side)=>{ const U=ULTS[cls.id+'/'+spec.name];
  return `<i class="slot su">${keys?(keys===KEYS_PAD?'RT':(side===0?'O':'6')):'★'}</i>${iconHtml(U.img,U.icon)}<div><b>${U.ua} <small>ультимейт</small></b><span>${U.d}</span></div>`; };
const formRowHtml=(spec,keys)=>`<i class="slot s4">${keys?keys[4]:''}</i>${iconHtml(spec.form.img,spec.form.em)}<div><b>${spec.form.name}</b><span>${spec.form.abilities.map(a=>a.name).join(', ')}, ${spec.form.classAb.name}. ${spec.form.note}</span></div>`;
const specTabHtml=sp=>`${iconHtml(specIconOf(sp),sp.em)}<div><b>${sp.name}</b><span>${sp.role}</span></div>`;

/* ПРОГРІВ ЕКРАНА ВИБОРУ. Перше перемикання на кожен клас смикалося: (1) холодний шейпінг нових слів шрифтом
   (перекомпоновка 50–130 мс замість ~5), (2) завантаження набору деталей, (3) таблиця найближчих кольорів моделі
   (sprite.js modelLUT). Прогрів починається ще на титулці (там рендер легкий і є вільний час) і йде дрібними
   завданнями в requestIdleCallback: тексти — по рядку в прихованій копії розмітки екрана вибору (той самий #wrap,
   отже ті самі шрифти й розміри cqw, хоч сам екран ще не показано), моделі — один кадр у чернетку.
   Порядок: перший спек кожного класу (на нього стає вибір при зміні класу), далі інші спеки, наостанок — інші скіни. */
const WARM={q:null,host:null};
const warmIdle=window.requestIdleCallback?cb=>requestIdleCallback(cb,{timeout:150}):cb=>setTimeout(()=>cb({timeRemaining:()=>6,didTimeout:false}),40);
function selPrewarm(){
  if(WARM.q) return;
  const q=WARM.q=[], later=[];
  for(const si of [0,1,2]) CLASSES.forEach(cls=>{ const spec=cls.specs[si]; if(!spec) return;
    for(const html of warmTexts(cls,spec,si)) q.push({text:html});
    const pref=preferredSkin(cls,spec);
    q.push({model:[cls,spec,pref],tries:0});
    spec.skins.forEach(sk=>{ if(sk!==pref) later.push({model:[cls,spec,sk],tries:0}); });
  });
  q.push(...later);
  const step=dl=>{
    const t0=performance.now();
    do {   // щонайменше одне завдання (без вільного часу — по тайм-ауту, до ~8 мс)
      const t=q.shift();
      if(t.text){ warmText(t.text); continue; }
      const r=warmModel(...t.model,t);
      if(r===null){   // черга завантажень зайнята — модель чекає, а поки прогріваємо тексти
        q.unshift(t); const j=q.findIndex(x=>x.text); if(j<0) break;
        warmText(q.splice(j,1)[0].text); continue;
      }
      if(!r&&(t._b||++t.tries<80)) q.splice(t._b?0:Math.min(2,q.length),0,t);   // таблиця добудовується — далі зразу; набір ще вантажиться — за кілька завдань
    } while(q.length&&(dl.didTimeout?performance.now()-t0<8:dl.timeRemaining()>3));
    if(q.length) warmIdle(step);
    else if(WARM.host){ WARM.host.remove(); WARM.host=null; }
  };
  warmIdle(step);
}
// тексти спеку порціями: [куди (селектор у копії), клас блока, розмітка, класи контейнера]
function warmTexts(cls,spec,si){
  const keys=['J','K','L','U','I'], out=[], ab=spec.form?'pf abil five six':'pf abil five';   // як у renderSelect (розмір шрифту залежить від five/six)
  [...spec.abilities,spec.classAb||cls.classAb].forEach((a,i)=>out.push(['.abil','arow',abilRowHtml(a,i,keys),ab]));
  out.push(['.abil','arow ult',ultRowHtml(cls,spec,keys,0),ab]);
  if(spec.form) out.push(['.abil','arow form',formRowHtml(spec,keys),ab]);
  if(si===0) out.push(['.specs','pf stab',cls.specs.map(specTabHtml).join('')]);
  out.push(['.sc-plate',cls.name.length>9?'sc-class long':'sc-class',cls.name]);
  for(const sk of spec.skins) out.push(['.sc-plate','sc-spec',sk.tier?`${spec.name}, ${sk.name}`:spec.name]);
  out.push(['.sc-plate','sc-tags',`<i>${spec.role}</i><i>Дальній бій</i><i>Ближній бій</i>`]);
  return out;
}
function warmText([sel,cn,html,boxCls]){
  if(!WARM.host){   // копія розмітки екрана вибору без id; невидима, але компонується
    const h=WARM.host=screens.select.cloneNode(true);
    h.removeAttribute('id'); h.classList.remove('hidden'); h.setAttribute('aria-hidden','true');
    h.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));
    h.querySelectorAll('canvas,.roster,.skins').forEach(e=>e.remove());
    Object.assign(h.style,{visibility:'hidden',pointerEvents:'none',zIndex:'-1'});
    WRAP.appendChild(h);
  }
  const box=WARM.host.querySelector(sel); if(!box) return;
  if(boxCls) box.className=boxCls;
  box.innerHTML=`<div class="${cn}">${html}</div>`;
  void box.offsetHeight;   // компонування (і шейпінг нових слів) — тут, у вільний час
}
// модель скіну: набір деталей завантажено, затемнені копії дальніх кінцівок готові, таблиця кольорів — у кеші.
// Таблицю будуємо зрізами (sprite.js lutBuilder), щоб жодне завдання не з'їдало кадр. false — ще не готово (повторити)
// Набори прогріву вантажаться не більше двох одночасно й не тоді, коли бій чекає своїх (VS, Game.assetsReady):
// раніше титулка замовляла всі ~90 наборів (~9 МБ) разом, і картинка арени з деталями бійців стояли в черзі за ними.
// null — не зараз (набір не замовлено, черга зайнята)
function warmModel(cls,spec,skin,t){
  const m=t._m||(t._m=resolveModel(cls,spec,skin));
  if(m.cutout&&!CUTOUT_LOAD[m.cutout]&&!(typeof CUTOUT_IMG!=='undefined'&&CUTOUT_IMG[m.cutout])&&!CUTOUT_OFF
    &&(UI.cur==='versus'||(state.game&&state.game._ready!==state.game.theme)||cutoutInflight()>=2)) return null;
  return warmLUT(m,t);
}
// затемнені копії й таблиця кольорів уже створеної моделі (t — стан прогріву між викликами)
function warmLUT(m,t){
  if(m.cutout&&!cutoutKey(m)) return CUTOUT_LOAD[m.cutout]==='err';
  if(!t._b){
    if(m.cutout) for(const im of Object.values(cutoutImgs(m.cutout))) dimOf(im);
    const sig=lutSig(m); if(!m._cutPal||LUT_CACHE.has(sig)) return true;
    t._b=lutBuilder([...new Set(Object.values(m.pal))].map(hexToRgb)); t._sig=sig;
  }
  if(!t._b.step(6)) return false;
  if(!LUT_CACHE.has(t._sig)) LUT_CACHE.set(t._sig,t._b.lut);
  return true;
}

function renderSelect(){
  const ai=state.mode==='ai';
  $('selTagL').textContent=NET.on?(NET.side===0?'Ти':'Суперник'):'Гравець 1';
  $('selTagR').textContent=ai?`Бот, ${DIFF_NAMES[state.aiSkill].toLowerCase()}`:(NET.on?(NET.side===1?'Ти':'Суперник'):'Гравець 2');
  $('selTagL').classList.toggle('active',SEL.side===0); $('selTagR').classList.toggle('active',SEL.side===1);
  const stg=curSide().stage;
  $('selTitle').textContent=NET.on?(curSide().locked?(SEL.sides[0].locked&&SEL.sides[1].locked?'Хост обирає арену…':'Чекаємо суперника…'):(stg==='skin'?'Обери вигляд':'Обери бійця'))
    :(stg==='skin'?(SEL.side===0||!ai?'Обери вигляд':'Вигляд суперника'):(SEL.side===0?'Обери бійця':(ai?'Обери суперника':'Гравець 2 обирає')));
  document.querySelector('.sel-center').classList.toggle('stage-skin',stg==='skin');
  // вітрини
  SEL.shows.forEach((sh,side)=>{
    const s=SEL.sides[side], cls=CLASSES[s.ci], spec=cls.specs[s.si], skin=spec.skins[s.ki];
    sh.el.style.setProperty('--cc',cls.color);
    screens.select.style.setProperty('--c'+side,selWaiting(side)?'#555':cls.color);
    const cn=sh.el.querySelector('.sc-class'); cn.textContent=cls.name; cn.classList.toggle('long',cls.name.length>9);
    sh.el.querySelector('.sc-spec').textContent=skin.tier?`${spec.name}, ${skin.name}`:spec.name;
    const ranged=spec.abilities[0].type!=='melee';
    sh.el.querySelector('.sc-tags').innerHTML=`<i>${spec.role}</i><i>${ranged?'Дальній бій':'Ближній бій'}</i>`;
    sh.el.classList.toggle('active',SEL.side===side&&!s.locked);
    sh.el.classList.toggle('waiting',selWaiting(side));
    sh.el.classList.toggle('locked',s.locked);
  });
  // ростер: позначки гравців
  const tiles=[...$('roster').children];
  tiles.forEach((t,ci)=>{
    const show1=(SEL.side===1||NET.on)&&SEL.sides[1].ci===ci;
    t.classList.toggle('sel0',SEL.sides[0].ci===ci); t.classList.toggle('sel1',show1);
    t.querySelectorAll('.mk').forEach(m=>m.remove());
    if(SEL.sides[0].ci===ci) t.insertAdjacentHTML('beforeend','<i class="mk m0">1</i>');
    if(show1) t.insertAdjacentHTML('beforeend',`<i class="mk m1">${state.mode==='ai'?'Б':'2'}</i>`);
  });
  // спеки
  const s=curSide(), cls=CLASSES[s.ci];
  const st=$('specTabs'); st.innerHTML='';
  cls.specs.forEach((sp,si)=>{
    const b=document.createElement('button'); b.className='pf stab'+(si===s.si?' on':'');
    b.innerHTML=specTabHtml(sp);
    b.addEventListener('click',()=>selSetSpec(si));
    st.appendChild(b);
  });
  // здібності (наведення — анімація на бійці)
  const spec=cls.specs[s.si], keys=keyLabels(SEL.side);
  const list=[...spec.abilities,spec.classAb||cls.classAb];
  const al=$('abilList'); al.innerHTML=''; al.classList.toggle('five',true); al.classList.toggle('six',!!spec.form);
  list.forEach((a,i)=>{
    const row=document.createElement('div'); row.className='arow';
    row.innerHTML=abilRowHtml(a,i,keys);
    row.addEventListener('pointerenter',()=>{ const f=curSide().f; const an=actionForAbility(f,a,i); if(an) f.anim.play(an); });
    al.appendChild(row);
  });
  { const row=document.createElement('div'); row.className='arow ult';
    row.innerHTML=ultRowHtml(cls,spec,keys,SEL.side);
    row.addEventListener('pointerenter',()=>{ const f=curSide().f; f.anim.play('roar'); });
    al.appendChild(row); }
  if(spec.form){
    const row=document.createElement('div'); row.className='arow form';
    row.innerHTML=formRowHtml(spec,keys);
    row.addEventListener('pointerenter',()=>{ const f=curSide().f; f.setForm(f.form==='base'?'alt':'base'); f.shiftT=0.35; });
    al.appendChild(row);
  }
  // скіни
  const ss=$('skinStrip'); ss.innerHTML=''; SEL.thumbs=[];
  if(stg==='skin') spec.skins.forEach((sk,ki)=>{   // великі картки скінів — лише на кроці вигляду
    const b=document.createElement('button'); b.className='pf skin'+(ki===s.ki?' on':'');
    b.innerHTML=`<canvas></canvas><span><b>${sk.tier}</b> ${sk.name}</span>`; b.title=sk.name;
    b.addEventListener('click',()=>{ if(s.ki===ki) selLock(); else selSetSkin(ki); });   // повторний тап — підтвердити
    ss.appendChild(b);
    const f=new Fighter(cls,spec,SEL.side,sk); f.preview=true; f.facing=1; f.x=0; f.y=0;
    SEL.thumbs.push({view:new PixelView(b.querySelector('canvas'),72,112),f,w:72,h:112,k:0.8});
  });
  $('selLock').textContent=stg==='spec'?'Далі':'Готово';
  if(NET.on) netSendSel();   // суперник бачить мій вибір наживо (дублікати не шлються)
}
function frameSelect(dt){
  SEL.t+=dt;
  SEL.shows.forEach((sh,side)=>{
    const s=SEL.sides[side], f=s.f;
    // сам собою час від часу показує прийом
    s.nextT-=dt;
    if(s.nextT<=0&&!f.anim.act&&!s.locked){ s.nextT=3+Math.random()*2; const i=Math.floor(Math.random()*4); const an=actionForAbility(f,f.abilities[i],i); if(an) f.anim.play(an); }
    f.shiftT=Math.max(0,f.shiftT-dt);
    f.anim.update(dt,{mode:'idle',speed:0,vy:0});
    const v=sh.view, g=v.g;
    g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,v.low.width,v.low.height);
    const col=CLASSES[s.ci].color, waiting=selWaiting(side), fx=SEL.fx[side];
    if(!waiting) fxDraw(g,fx,62,168,col,dt,SEL.t,124,184);
    drawPedestal(g,62,168,col,SEL.t*(side?-1:1));
    renderFighterTo(v,f,0.9,62,168,SEL.t);
    if(!waiting&&fx.draw) fx.draw();
    v.present();
  });
  for(const th of SEL.thumbs){
    th.f.anim.update(dt,{mode:'idle',speed:0,vy:0});
    const g=th.view.g; g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,th.w,th.h);
    renderFighterTo(th.view,th.f,th.k,th.w/2,th.h-3,SEL.t);
    th.view.present('center');
  }
}

/* ============================================================
   ВИБІР АРЕНИ: після обох бійців (у мережі — обирає хост); перша плитка — випадкова
   ============================================================ */
const AS={i:0};
function openArenaSel(){
  const g=$('arenaGrid'); g.innerHTML='';
  const items=[{name:'Випадкова',rnd:true},...THEMES];
  items.forEach((th,i)=>{
    const b=document.createElement('button'); b.className='pf atile'+(th.rnd?' rnd':'');
    b.innerHTML=(th.rnd?'<b class="q">?</b>':`<img src="${th.thumb||th.img||''}" alt="" loading="lazy">`)+`<span>${th.name}</span>`;
    b.addEventListener('click',()=>{ if(AS.i===i) arenaGo(); else { AS.i=i; renderArenaSel(); sfx('tick'); } });
    g.appendChild(b);
  });
  if(AS.i>=items.length) AS.i=0;
  show('arenaSel'); renderArenaSel();
}
function renderArenaSel(){
  [...$('arenaGrid').children].forEach((t,i)=>t.classList.toggle('on',i===AS.i));
  $('arenaName').textContent=AS.i?THEMES[AS.i-1].name:'Випадкова арена';
  const t=$('arenaGrid').children[AS.i]; if(t&&t.scrollIntoView) t.scrollIntoView({block:'nearest'});
  clearTimeout(AS.pre); if(AS.i){ const th=THEMES[AS.i-1]; AS.pre=setTimeout(()=>arenaImg(th),250); }   // картинка арени, на якій затрималися, — завчасно
}
function arenaMove(d){ const n=THEMES.length+1; AS.i=(AS.i+d+n)%n; renderArenaSel(); sfx('tick'); }
function arenaGo(){
  state.arena=AS.i?THEMES[AS.i-1]:null; sfx('lock');
  if(NET.on){ netAnnounceVersus(); return; }
  openVersus();
}
function arenaBack(){
  const side=NET.on?NET.side:1; SEL.side=side;
  const s=SEL.sides[side]; s.locked=false; s.stage='skin'; s.f.anim.stop(); show('select'); renderSelect();
}
$('arenaBack').addEventListener('click',arenaBack);
$('arenaGo').addEventListener('click',arenaGo);

/* ============================================================
   VS — двоє бійців навпроти, вибух «VS», потім бій
   ============================================================ */
const VS={views:[],fs:[],t:0,timer:null};
function openVersus(){
  const [a,b]=state.picks;
  const el=screens.versus;
  el.style.setProperty('--c1',a.cls.color); el.style.setProperty('--c2',b.cls.color);
  $('vsNameL').innerHTML=`${a.cls.name}<small>${a.spec.name}</small>`;
  $('vsNameR').innerHTML=`${b.cls.name}<small>${b.spec.name}</small>`;
  VS.views=[new PixelView($('vsL'),120,120),new PixelView($('vsR'),120,120)];
  VS.fs=[a,b].map((p,i)=>{ const f=new Fighter(p.cls,p.spec,i,p.skin); f.preview=true; f.x=0; f.y=0; f.facing=i?-1:1; f.anim.play('roar'); return f; });
  $('vsWhoL').textContent=NET.on?(NET.side===0?'Ти':'Суперник'):'Гравець 1';
  $('vsWhoR').textContent=state.mode==='ai'?'Бот':(NET.on?(NET.side===1?'Ти':'Суперник'):'Гравець 2');
  VS.t=0; VS.warm=null;
  preloadFight();
  // перезапуск CSS-анімацій
  el.classList.add('hidden'); void el.offsetWidth;
  show('versus');
  sting('vs');   // акорд припадає на падіння «VS» (0.7 с)
  clearTimeout(VS.timer); VS.timer=setTimeout(()=>{ if(UI.cur==='versus') startFight(); },2700); // гостю startFight нічого не робить — бій почне хост
}
// поки йде VS (2.7 с) — вантажимо картинку арени й деталі обох бійців, щоб бій почався одразу (Game.assetsReady)
function preloadFight(){
  if(!state.arena&&!state.nextArena) state.nextArena=THEMES[Math.floor(Math.random()*THEMES.length)];   // випадкову обираємо вже тут
  arenaImg(state.arena||state.nextArena);
  cutoutSetsReady(VS.fs.flatMap(f=>f.cutoutSets()));
}
function frameVersus(dt){
  VS.t+=dt;
  VS.fs.forEach((f,i)=>{
    f.anim.update(dt,{mode:'idle',speed:0,vy:0});
    const v=VS.views[i], g=v.g; g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,120,120);
    renderFighterTo(v,f,0.72,60,114,VS.t);
    v.present();
  });
  // форми й пети з'являються лише посеред бою: їхні таблиці кольорів і затемнені деталі готуємо тут, зрізами по кадрах,
  // інакше перша поява вовка чи кота — ривок (~12 мс на ПК, на телефоні в рази більше)
  if(!VS.warm) VS.warm=VS.fs.flatMap(f=>{ const sets=new Set(f.cutoutSets()), ms=Object.values(f.forms).map(F=>({m:F.model}));
    for(const k in PET_CUTOUT) if(sets.has(PET_CUTOUT[k])) ms.push({m:petModel(k)});
    return ms; });
  if(VS.warm.length&&warmLUT(VS.warm[0].m,VS.warm[0])!==false) VS.warm.shift();
}

/* ============================================================
   БІЙ, ПАУЗА, ФІНАЛ
   ============================================================ */
function startFight(){
  if(NET.guest) return;                       // бій у мережі рахує хост, гість лише дзеркалить його
  clearTimeout(VS.timer);
  NET.sfxQ.length=0; NET.rin=newVin(); NET.vsPending=false;
  const P=state.picks;
  const p1=new Fighter(P[0].cls,P[0].spec,0,P[0].skin);
  const p2=new Fighter(P[1].cls,P[1].spec,1,P[1].skin);
  if(state.mode==='ai') p2.isAI=true;
  state.game=new Game(p1,p2);
  closePause();
  show(null);
  state.screen='fight';
  if(NET.host) NET.send({t:'fight'});
}
function showOverlay(winner){
  const who=NET.on?(winner.idx===NET.side?'Перемога!':'Поразка'):(winner.isAI?'Бот перемагає':`Перемога гравця ${winner.idx+1}`);
  if(NET.host) NET.send({t:'end',w:winner.idx});
  sting(NET.on?(winner.idx===NET.side?'win':'lose'):(winner.isAI?'lose':'win'));
  $('winTitle').textContent=who;
  $('winSub').textContent=`${winner.cls.name}, ${winner.spec.name}. ${winner.skin.name}`;
  screens.overlay.classList.remove('hidden'); UI.cur='overlay';
  focusFirst('overlay');
  // переможець на п'єдесталі
  const f=new Fighter(winner.cls,winner.spec,winner.idx,winner.skin); f.preview=true; f.x=0; f.y=0; f.facing=1; f.anim.play('victory');
  WIN.view=new PixelView($('winCv'),124,112); WIN.f=f; WIN.t=0; WIN.fx=newFx(); WIN.fx.flash=1.2; WIN.fx.ring=0; WIN.nextT=2.2;
  fxBurst(WIN.fx,62,100,winner.cls.color,50,1.5);
}
const WIN={view:null,f:null,t:0,fx:null,nextT:0};
function frameWin(dt){
  if(!WIN.f) return;
  WIN.t+=dt; const f=WIN.f, v=WIN.view, g=v.g, col=f.cls.color;
  WIN.nextT-=dt; if(WIN.nextT<=0&&!f.anim.act){ WIN.nextT=3.2; f.anim.play('victory'); }
  f.anim.update(dt,{mode:'idle',speed:0,vy:0});
  g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,124,112);
  fxDraw(g,WIN.fx,62,100,col,dt,WIN.t,124,112);
  drawPedestal(g,62,100,col,WIN.t);
  renderFighterTo(v,f,0.62,62,100,WIN.t);
  if(WIN.fx.draw) WIN.fx.draw();
  v.present();
}
function togglePause(){
  if(!(state.screen==='fight'&&state.game&&state.game.phase!=='matchEnd')) return;
  if(NET.guest){ NET.send({t:'p'}); return; }   // пауза в мережі спільна: ставить її хост, гість бачить зі знімка
  setPaused(!state.paused);
}
function setPaused(on){
  state.paused=on;
  screens.pauseMenu.classList.toggle('hidden',!on);
  if(on){ UI.cur='pauseMenu'; focusFirst('pauseMenu'); }
  else if(UI.cur==='pauseMenu') UI.cur=null;
}
function closePause(){ state.paused=false; screens.pauseMenu.classList.add('hidden'); if(UI.cur==='pauseMenu') UI.cur=null; }

/* ============================================================
   ВВІД У МЕНЮ: клавіатура й геймпад
   ============================================================ */
const K_UP=['ArrowUp','KeyW'], K_DN=['ArrowDown','KeyS'], K_L=['ArrowLeft','KeyA'], K_R=['ArrowRight','KeyD'];
const K_OK=['Enter','NumpadEnter','Space','KeyJ','Numpad1'];
// повертає true, якщо клавіша оброблена інтерфейсом
UI.key=function(code){
  const cur=UI.cur;
  if(!cur) return false;
  if(cur==='title'&&!UI.awake){ wake(); return true; }
  if(cur==='versus'){ if(K_OK.includes(code)||code==='Escape') startFight(); return true; }
  if(cur==='arenaSel'){
    const t0=$('arenaGrid').children[0], cols=t0?Math.max(1,Math.round($('arenaGrid').clientWidth/t0.offsetWidth)):1;
    if(K_L.includes(code)) arenaMove(-1); else if(K_R.includes(code)) arenaMove(1);
    else if(K_UP.includes(code)) arenaMove(-cols); else if(K_DN.includes(code)) arenaMove(cols);
    else if(code==='KeyR'){ AS.i=1+Math.floor(Math.random()*THEMES.length); renderArenaSel(); }
    else if(K_OK.includes(code)) arenaGo();
    else if(code==='Escape'||code==='Backspace') arenaBack();
    return true;
  }
  if(cur==='select'){
    if(K_L.includes(code)) selMoveClass(-1,0); else if(K_R.includes(code)) selMoveClass(1,0);
    else if(K_UP.includes(code)) selMoveClass(0,-1); else if(K_DN.includes(code)) selMoveClass(0,1);
    else if(code==='KeyQ') selSetSpec(curSide().si-1); else if(code==='KeyE') selSetSpec(curSide().si+1);
    else if(code==='KeyZ') selSetSkin(curSide().ki-1); else if(code==='KeyC') selSetSkin(curSide().ki+1);
    else if(code==='KeyR') selRandom();
    else if(K_OK.includes(code)) selLock();
    else if(code==='Escape'||code==='Backspace') act('back');
    return true;
  }
  // списки: титул, керування, пауза, фінал
  if(K_UP.includes(code)) listMove(cur,-1);
  else if(K_DN.includes(code)) listMove(cur,1);
  else if(K_L.includes(code)||K_R.includes(code)){ const el=UI.focusEl; if(el&&el.hasAttribute('data-cycle')) act(el.dataset.act,K_L.includes(code)?-1:1,el); }
  else if(K_OK.includes(code)){ const el=UI.focusEl; if(el) act(el.dataset.act,1,el); }
  else if(code==='Escape'||code==='Backspace'){
    if(cur==='controls'||cur==='settings'||cur==='netLobby') act('back'); else if(cur==='pauseMenu') togglePause();
  }
  return true;
};
// кнопки геймпада: up down left right a b x y lb rb lt rt start
UI.pad=function(btn){
  const map={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',a:'Enter',b:'Escape',x:'KeyX',y:'KeyR',lb:'KeyQ',rb:'KeyE',lt:'KeyZ',rt:'KeyC',start:'Enter'};
  setDevice('pad');
  if(UI.cur==='title'&&!UI.awake){ wake(); return; }
  if(map[btn]) UI.key(map[btn]);
};
// щокадрово (поза боєм): вітрини вибору і VS
UI.frame=function(dt){
  UI.t+=dt;
  if(UI.cur==='select') frameSelect(dt);
  else if(UI.cur==='versus') frameVersus(dt);
  else if(UI.cur==='overlay') frameWin(dt);
};

show('title');
setTimeout(selPrewarm,1500);   // прогрів екрана вибору — поки гравець на титулці
