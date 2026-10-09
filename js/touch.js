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
(()=>{
  const el=TOUCH.el, stick=document.getElementById('tStick'), knob=document.getElementById('tKnob');
  const btns=[...el.querySelectorAll('[data-ab]')];
  TOUCH.btns=btns; TOUCH.blk=el.querySelector('[data-blk]'); TOUCH.form=el.querySelector('[data-form]'); TOUCH.ult=el.querySelector('[data-ult]');

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
    stick.classList.remove('on'); stick.style.left=''; stick.style.top=''; knob.style.transform='';
  }
  // блок тримають і стік (униз), і кнопка
  function syncBlock(){
    let b=!!(TOUCH.stick&&TOUCH.stick.block);
    for(const h of TOUCH.held.values()) if(h.kind==='blk') b=true;
    TIN.block=b;
  }
  const buzz=ms=>{ if(navigator.vibrate) try{ navigator.vibrate(ms); }catch(e){} };

  el.addEventListener('touchstart',e=>{
    e.preventDefault();
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
      } else if(!TOUCH.stick&&t.clientX<innerWidth*0.55){
        const R=TOUCH.R=unit()*13, m=R*1.15;
        const x=clamp(t.clientX,m,innerWidth-m), y=clamp(t.clientY,m,innerHeight-m);
        TOUCH.stick={id:t.identifier,x,y,block:false};
        stick.classList.add('on'); stick.style.left=x+'px'; stick.style.top=y+'px';
        stickSet(t);
      }
    }
  },{passive:false});
  el.addEventListener('touchmove',e=>{
    e.preventDefault();
    for(const t of e.changedTouches) if(TOUCH.stick&&t.identifier===TOUCH.stick.id) stickSet(t);
  },{passive:false});
  const end=e=>{
    e.preventDefault();
    for(const t of e.changedTouches){
      if(TOUCH.stick&&t.identifier===TOUCH.stick.id) stickEnd();
      const h=TOUCH.held.get(t.identifier);
      if(h){ h.el.classList.remove('on'); TOUCH.held.delete(t.identifier); syncBlock(); }
    }
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
  });

  TOUCH.releaseAll=()=>{
    if(TOUCH.stick) stickEnd();
    for(const h of TOUCH.held.values()) h.el.classList.remove('on');
    TOUCH.held.clear();
    TIN.mv=0; TIN.jump=false; TIN.block=false; TIN.ab.fill(0); TIN.form=0; TIN.ult=0;
  };
})();

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
TOUCH.frame=function(){
  const g=state.game;
  const show=TOUCH.on&&state.screen==='fight'&&!!g&&!UI.cur;
  if(show!==TOUCH.shown){ TOUCH.shown=show; TOUCH.el.classList.toggle('hidden',!show); if(!show) TOUCH.releaseAll(); }
  if(!show) return;
  const f=g.f[NET.on?NET.side:0];
  for(let k=0;k<4;k++){
    const b=TOUCH.btns[k], a=f.abilities[k], cd=f.cds[k];
    setIcon(b,a);
    setCd(b,cd>0?(cd/a.cd).toFixed(3):'0');
    setTxt(b._n||(b._n=b.querySelector('.t-n')),cd>0?(cd>=1?cd.toFixed(0):cd.toFixed(1)):'');
    b.classList.toggle('gcd',cd<=0&&f.gcd>0);
  }
  TOUCH.blk.classList.toggle('lit',!!f.blocking);
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
