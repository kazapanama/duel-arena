"use strict";
/* ============================================================
   СЕНСОРНЕ КЕРУВАННЯ (телефон)
   Ліва половина екрана — плаваючий стік: де торкнувся, там і центр.
     вбік — рух, вгору — стрибок, вниз — блок.
   Справа — кнопки: 4 здібності (як J K L U / X Y B A), блок
   (тап у мить удару — парирування) і форма друїда.
   Усе пишеться в TIN (input.js): на хості його читає боєць,
   на гостьовому пристрої — net.js, що шле ввід хосту.
   ============================================================ */
const TOUCH={on:matchMedia('(hover:none) and (pointer:coarse)').matches||/[?&]touch=1/.test(location.search), // ?touch=1 — перевірити з ПК
  shown:false, el:document.getElementById('touch'), stick:null, held:new Map(), R:0, fsTried:false};
/* Розкладка кнопок (екран «Кнопки на екрані» в налаштуваннях і паузі): розмір k, прозорість a, лівша і власні місця кнопок.
   Місце кнопки — відстань центра від нижнього кута з боку великого пальця (--r вбік, --b вгору) в одиницях --ub (див. style.css) */
const TDEF={s0:[15,16],s1:[36,11],s2:[33,30],s3:[15,37],blk:[54,10],form:[50,28],ult:[33,50]};
const TK=[0.7,0.85,1,1.15,1.3], TA=[0.5,0.65,0.85,1];
const TCFG=(()=>{
  let c={}; try{ c=JSON.parse(localStorage.getItem('aa_touch')||'{}')||{}; }catch(e){}
  const near=(v,list,d)=>list.reduce((a,x)=>Math.abs(x-v)<Math.abs(a-v)?x:a,list.includes(d)?d:list[0]);
  return {k:near(+c.k||1,TK,1),a:near(+c.a||0.85,TA,0.85),left:!!c.left,pos:c.pos&&typeof c.pos==='object'?c.pos:{}};
})();
const tcfgSave=()=>{ try{ localStorage.setItem('aa_touch',JSON.stringify(TCFG)); }catch(e){} };
(()=>{
  const el=TOUCH.el, stick=document.getElementById('tStick'), knob=document.getElementById('tKnob');
  const btns=[...el.querySelectorAll('[data-ab]')];
  TOUCH.btns=btns; TOUCH.blk=el.querySelector('[data-blk]'); TOUCH.form=el.querySelector('[data-form]'); TOUCH.ult=el.querySelector('[data-ult]');
  const byId={s0:btns[0],s1:btns[1],s2:btns[2],s3:btns[3],blk:TOUCH.blk,form:TOUCH.form,ult:TOUCH.ult};
  for(const id in byId) byId[id]._id=id;
  const ub=()=>Math.min(.85*Math.min(innerWidth,innerHeight)/100,4.7);   // 1 одиниця --ub у пікселях (style.css)
  // у спокої стік — блідий натяк із боку лівого пальця (у лівші — справа)
  function stickIdle(){
    const u=ub(); stick.style.left=(TCFG.left?innerWidth-17*u:17*u)+'px'; stick.style.top=(innerHeight-17*u)+'px';
  }
  // розкладку — у CSS-змінні й клас
  TOUCH.apply=()=>{
    el.style.setProperty('--k',TCFG.k); el.style.setProperty('--ta',TCFG.a);
    el.classList.toggle('lefty',TCFG.left);
    for(const id in byId){ const p=TCFG.pos[id]||TDEF[id]; byId[id].style.setProperty('--r',p[0]); byId[id].style.setProperty('--b',p[1]); }
    if(!TOUCH.stick) stickIdle();
  };
  TOUCH.resetPos=()=>{ TCFG.pos={}; tcfgSave(); TOUCH.apply(); };
  addEventListener('resize',()=>TOUCH.apply());
  // перетягування кнопок у режимі налаштування (палець чи миша)
  let drag=null;
  function editDown(b,x,y){
    const r=b.getBoundingClientRect(); drag={id:b._id,b,dx:x-(r.left+r.width/2),dy:y-(r.top+r.height/2)}; b.classList.add('drag');
  }
  function editMove(x,y){
    if(!drag) return;
    const u=ub()*TCFG.k, s=drag.b.offsetWidth/u/2+1;
    const cx=x-drag.dx, cy=y-drag.dy;
    const r=clamp((TCFG.left?cx:innerWidth-cx)/u,s,innerWidth/u-s), b=clamp((innerHeight-cy)/u,s,innerHeight/u-s);
    TCFG.pos[drag.id]=[+r.toFixed(1),+b.toFixed(1)]; drag.b.style.setProperty('--r',r.toFixed(1)); drag.b.style.setProperty('--b',b.toFixed(1));
  }
  function editEnd(){ if(drag){ drag.b.classList.remove('drag'); drag=null; tcfgSave(); } }
  const editBtn=t=>t&&t.closest&&t.closest('.t-btn');
  addEventListener('mousedown',e=>{ if(!TOUCH.edit) return; const b=editBtn(e.target); if(b) editDown(b,e.clientX,e.clientY); });
  addEventListener('mousemove',e=>editMove(e.clientX,e.clientY));
  addEventListener('mouseup',editEnd);

  // перший дотик: вмикаємо сенсорний режим, на телефоні — повний екран і альбомна орієнтація
  addEventListener('touchstart',()=>{
    if(!TOUCH.on){ TOUCH.on=true; touchLabels(); }
  },{capture:true,passive:true});
  addEventListener('touchend',()=>{
    if(TOUCH.fsTried||document.fullscreenElement||!document.documentElement.requestFullscreen) return;
    TOUCH.fsTried=true; // лише раз: якщо гравець вийде з повного екрана сам — не нав'язуємось
    document.documentElement.requestFullscreen({navigationUI:'hide'})
      .then(()=>screen.orientation&&screen.orientation.lock&&screen.orientation.lock('landscape')).catch(()=>{});
  },{capture:true,passive:true});
  addEventListener('contextmenu',e=>{ if(TOUCH.on) e.preventDefault(); }); // довге натискання не відкриває меню

  const unit=()=>Math.min(innerWidth,innerHeight)/100;
  function stickSet(t){
    const s=TOUCH.stick, R=TOUCH.R;
    let dx=t.clientX-s.x, dy=t.clientY-s.y;
    const d=Math.hypot(dx,dy);
    if(d>R){ // палець вийшов за коло — центр тягнеться за ним, щоб розворот був миттєвим
      const k=(d-R)/d; s.x+=dx*k; s.y+=dy*k; dx=t.clientX-s.x; dy=t.clientY-s.y;
      stick.style.left=s.x+'px'; stick.style.top=s.y+'px';
    }
    knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
    const ax=Math.abs(dx);
    TIN.mv=dx>R*0.3?1:(dx<-R*0.3?-1:0);
    const up=-dy>R*0.5&&-dy>ax*0.5, down=dy>R*0.5&&dy>ax*0.5;
    if(up&&!TIN.jump) TIN.jumpUntil=performance.now()+70;
    if(down&&!s.block) TIN.blockUntil=performance.now()+70;
    TIN.jump=up; s.block=down; syncBlock();
  }
  function stickEnd(){
    TOUCH.stick=null; TIN.mv=0; TIN.jump=false; syncBlock();
    stick.classList.remove('on'); stickIdle(); knob.style.transform='';
  }
  // блок тримають і стік (униз), і кнопка
  function syncBlock(){
    let b=!!(TOUCH.stick&&TOUCH.stick.block);
    for(const h of TOUCH.held.values()) if(h.kind==='blk') b=true;
    TIN.block=b;
  }
  const buzz=ms=>haptic(ms);   // audio.js: Android — вібрація; налаштування «Вібрація» її вимикає
  const net=()=>{ if(NET.on) netInput(); };   // гра по мережі: дотик — на сервер одразу, не чекаючи кадру (net.js)

  el.addEventListener('touchstart',e=>{
    e.preventDefault();
    if(TOUCH.edit){ for(const t of e.changedTouches){ const b=editBtn(t.target); if(b&&!drag){ editDown(b,t.clientX,t.clientY); drag.tid=t.identifier; } } return; }
    for(const t of e.changedTouches){
      const b=t.target.closest&&t.target.closest('[data-ab],[data-blk],[data-form],[data-ult],[data-pause]');
      if(b){
        const now=performance.now();
        let kind='ab';
        if(b.hasAttribute('data-blk')){ kind='blk'; TIN.blockUntil=now+70; }
        else if(b.hasAttribute('data-form')){ kind='form'; TIN.form=now; }
        else if(b.hasAttribute('data-ult')){ kind='ult'; TIN.ult=now; }
        else if(b.hasAttribute('data-pause')){ kind='pause'; togglePause(); }
        else TIN.ab[+b.dataset.ab]=now;
        TOUCH.held.set(t.identifier,{kind,el:b}); b.classList.add('on'); buzz(kind==='blk'?6:10);
        syncBlock();
      } else if(!TOUCH.stick&&(TCFG.left?t.clientX>innerWidth*0.45:t.clientX<innerWidth*0.55)){
        const R=TOUCH.R=unit()*13, m=R*1.15;
        const x=clamp(t.clientX,m,innerWidth-m), y=clamp(t.clientY,m,innerHeight-m);
        TOUCH.stick={id:t.identifier,x,y,block:false};
        stick.classList.add('on'); stick.style.left=x+'px'; stick.style.top=y+'px';
        stickSet(t);
      }
    }
    net();
  },{passive:false});
  el.addEventListener('touchmove',e=>{
    e.preventDefault();
    if(TOUCH.edit){ for(const t of e.changedTouches) if(drag&&t.identifier===drag.tid) editMove(t.clientX,t.clientY); return; }
    for(const t of e.changedTouches) if(TOUCH.stick&&t.identifier===TOUCH.stick.id) stickSet(t);
    net();
  },{passive:false});
  const end=e=>{
    e.preventDefault();
    if(TOUCH.edit){ editEnd(); return; }
    for(const t of e.changedTouches){
      if(TOUCH.stick&&t.identifier===TOUCH.stick.id) stickEnd();
      const h=TOUCH.held.get(t.identifier);
      if(h){ h.el.classList.remove('on'); TOUCH.held.delete(t.identifier); syncBlock(); }
    }
    net();
  };
  el.addEventListener('touchend',end,{passive:false});
  el.addEventListener('touchcancel',end,{passive:false});
  // мишею (перевірка на комп'ютері): кнопки клікаються
  el.addEventListener('mousedown',e=>{
    const b=e.target.closest('[data-ab],[data-form],[data-ult],[data-pause]'); if(!b) return;
    if(b.hasAttribute('data-form')) TIN.form=performance.now();
    else if(b.hasAttribute('data-ult')) TIN.ult=performance.now();
    else if(b.hasAttribute('data-pause')) togglePause();
    else TIN.ab[+b.dataset.ab]=performance.now();
    net();
  });

  TOUCH.releaseAll=()=>{
    if(TOUCH.stick) stickEnd();
    for(const h of TOUCH.held.values()) h.el.classList.remove('on');
    TOUCH.held.clear();
    TIN.mv=0; TIN.jump=false; TIN.block=false; TIN.ab.fill(0); TIN.form=0; TIN.ult=0;
  };
  TOUCH.apply();
})();

/* Відгук на події бою (audio.js sfx «~kind[H]індекс», game.js emit): вібрація й спалах по краях кадра, лише для мого бійця.
   Пальці закривають бійця, тож парирування, блок і удар видно ще й з краю */
const FEEL={parry:[[14,30,26],'#ffe27a',.55],block:[12,'#8fd0ff',.3],hurt:[24,'#ff3a2a',.3],hurtH:[[50,30,50],'#ff3a2a',.5],hit:[7],hitH:[16],
  break:[[40,30,60],'#ff6a5a',.5],ko:[[80,40,160],'#ff3a2a',.6],rdy:[[20,40,20],'#ffe27a',.25],ult:[[30,30,70],'#ffd23a',.4]};
function feelEvt(k){
  const m=/^~([a-z]+)(H?)(\d)$/.exec(k); if(!m||!TOUCH.on) return;
  const g=state.game; if(!g||+m[3]!==(NET.on?NET.side:0)) return;
  const f=FEEL[m[1]+m[2]]||FEEL[m[1]]; if(!f) return;
  haptic(f[0]);
  if(f[1]) g.edge={c:f[1],a:f[2],t:.28,T:.28};
}

// підписи «натисни клавішу» → «торкнись»
function touchLabels(){
  const p=document.getElementById('press'); if(p) p.textContent='Торкнись екрана';
  document.body.classList.add('touch');   // ховає підказки клавіш (style.css)
  if(typeof UI!=='undefined'&&UI.cur==='select'&&typeof renderSelect==='function') renderSelect();
}
if(TOUCH.on) touchLabels();

function setIcon(btn,a){
  const src=a.img||'';
  if(btn.dataset.src===src) return;
  btn.dataset.src=src;
  const im=btn.querySelector('img');
  if(src){ im.classList.remove('broken'); im.src=encodeURI(src); im.hidden=false; btn.querySelector('.t-em').textContent=''; }
  else { im.hidden=true; btn.querySelector('.t-em').textContent=a.icon||'?'; }
}
// щокадру: показати/сховати шар, оновити іконки й відкат. Пишемо в DOM лише зміни: навіть той самий textContent
// перебудовує вузол, а нове значення --cd перемальовує кнопку з тінями й conic-gradient — на телефоні це щокадрова робота
const setCd=(el,v)=>{ if(el._cd!==v){ el._cd=v; el.style.setProperty('--cd',v); } };
const setTxt=(el,v)=>{ if(el.textContent!==v) el.textContent=v; };
// заглушка бійця для екрана налаштування кнопок: іконки обраного (чи першого) спеку
function previewFighter(){
  const p=state.picks&&state.picks[0], cls=(p&&p.cls)||CLASSES[0], spec=(p&&p.spec)||cls.specs[0];
  return {cls,spec,abilities:[...spec.abilities,spec.classAb||cls.classAb].slice(0,4),cds:[0,0,0,0],gcd:0,blocking:false,meter:ULT_MAX,formDef:null};
}
TOUCH.frame=function(){
  const g=state.game;
  const show=TOUCH.on&&(TOUCH.edit||(state.screen==='fight'&&!!g&&!UI.cur));
  if(show!==TOUCH.shown){ TOUCH.shown=show; TOUCH.el.classList.toggle('hidden',!show); TOUCH.el.classList.toggle('edit',!!TOUCH.edit); if(!show) TOUCH.releaseAll(); }
  if(!show) return;
  if(TOUCH.el.classList.contains('edit')!==!!TOUCH.edit){ TOUCH.el.classList.toggle('edit',!!TOUCH.edit); TOUCH.releaseAll(); }
  const f=TOUCH.edit?previewFighter():g.f[NET.on?NET.side:0];
  for(let k=0;k<4;k++){
    const b=TOUCH.btns[k], a=f.abilities[k], cd=f.cds[k];
    setIcon(b,a);
    setCd(b,cd>0?(cd/a.cd).toFixed(3):'0');
    setTxt(b._n||(b._n=b.querySelector('.t-n')),cd>0?(cd>=1?cd.toFixed(0):cd.toFixed(1)):'');
    b.classList.toggle('gcd',cd<=0&&f.gcd>0);
  }
  TOUCH.blk.classList.toggle('lit',!!f.blocking);
  // підказка парирування: кнопка блоку пульсує, коли ворог замахнувся, і спалахує золотом, коли час натискати
  const cue=(state.parryHint||(g&&g.tut))&&!TOUCH.edit&&!NET.on?f.parryCue(g):null, go=!!cue&&cue.can&&!cue.turn&&!cue.no&&cue.t<=0.3;
  TOUCH.blk.classList.toggle('cue',!!cue&&!go); TOUCH.blk.classList.toggle('go',go);
  if(go&&!TOUCH._go) haptic(10);
  TOUCH._go=go;
  // ульта: кнопка заповнюється разом із супершкалою
  const U=ultOf(f), fr=clamp(f.meter/ULT_MAX,0,1);
  setIcon(TOUCH.ult,{img:U.img,icon:U.icon});
  setCd(TOUCH.ult,(1-fr).toFixed(3));
  TOUCH.ult.classList.toggle('ready',fr>=1);
  const fb=TOUCH.form;
  fb.classList.toggle('hidden',!f.formDef);
  if(f.formDef){
    setIcon(fb,{img:f.form==='base'?f.formDef.img:f.formDef.baseImg,icon:f.formDef.em});
    fb.classList.toggle('gcd',f.formCd>0);
    fb.classList.toggle('lit',f.form==='alt');
  }
};
