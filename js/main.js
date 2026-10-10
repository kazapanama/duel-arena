"use strict";

/* ============================================================
   ГОЛОВНИЙ ЦИКЛ
   ============================================================ */
if(document.fonts) document.fonts.load('16px Tiny5'); // шрифт HUD для canvas
const PERF=/[?&]perf\b/.test(location.search);   // ?perf — лічильник кадрів і часу роботи в бою (перевірка на телефоні)
const PM={fps:60,upd:0,drw:0,work:0,slowT:0};      // згладжені виміри
let last=performance.now();
function loop(now){
  const raw=(now-last)/1000, dt=Math.min(0.1,raw);
  last=now;
  fitCanvas();
  ctx.setTransform(VIEW_K,0,0,VIEW_K,0,0); // кожен кадр — базова трансформація логічних 1280×720
  ctx.imageSmoothingEnabled=false;
  pollPads();
  if(state.screen==='fight' && state.game){
    const t0=performance.now();
    if(NET.on) netFrame();                      // у мережі бій рахує сервер — беремо його знімок і шлемо свій ввід
    else if(!state.paused){
      // довгий кадр — кілька кроків симуляції (кожен ≤ 34 мс): на повільному пристрої гра йде з реальною швидкістю,
      // а не сповільнюється «під водою»
      const n=Math.ceil(dt/0.034);
      for(let i=0;i<n;i++){ state.game.update(dt/n); if(!i) clearEdges(); }
    }
    const t1=performance.now();
    state.game.draw();
    const t2=performance.now();
    if(UI.cur==='overlay') UI.frame(dt); // переможець на фінальному екрані
    gfxAuto(t2-t0,dt);
    if(PERF){ PM.upd+=(t1-t0-PM.upd)*0.05; PM.drw+=(t2-t1-PM.drw)*0.05; drawPerf(); }
  } else {
    UI.frame(dt);
    // фон меню: анімований Темний Портал
    drawMenuBG(dt);
  }
  if(raw>0) PM.fps+=(1/raw-PM.fps)*0.05;
  TOUCH.frame();
  pressed.clear();
  requestAnimationFrame(loop);
}
// «Авто»: якщо бій кілька секунд поспіль не вкладається в кадр 60 Гц (робота кадру > 16 мс), бійців малюємо
// крупнішим пікселем (GFX.fast). Рішення запам'ятовуємо для пристрою; «Висока» в налаштуваннях повертає деталі
function gfxAuto(ms,dt){
  if(GFX.mode!=='auto'||GFX.autoFast||state.game.phase!=='fight') return;
  PM.work+=(ms-PM.work)*0.05;
  PM.slowT=PM.work>16?PM.slowT+dt:0;
  if(PM.slowT>2){ GFX.autoFast=true; savePrefs(); renderMenuVals(); }
}
function drawPerf(){
  const c=ctx, s=`${PM.fps.toFixed(0)} fps · рух ${PM.upd.toFixed(1)} · малювання ${PM.drw.toFixed(1)} мс · `+
    `${GFX.fast?'швидка':'висока'} · ${cv.width}×${cv.height}`+(NET.on?` · пінг ${Math.round(NET.rtt)} мс`:'');
  c.save(); c.setTransform(VIEW_K,0,0,VIEW_K,0,0);
  c.font='14px "Tiny5",monospace'; c.textAlign='left'; c.textBaseline='top';
  c.fillStyle='rgba(0,0,0,.7)'; c.fillRect(8,H-30,c.measureText(s).width+12,22);
  c.fillStyle='#9dff7a'; c.fillText(s,14,H-26);
  c.restore();
}
requestAnimationFrame(loop);
