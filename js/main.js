"use strict";

/* ============================================================
   ГОЛОВНИЙ ЦИКЛ
   ============================================================ */
if(document.fonts) document.fonts.load('16px Tiny5'); // шрифт HUD для canvas
let last=performance.now();
function loop(now){
  const dt=Math.min(0.033,(now-last)/1000);
  last=now;
  fitCanvas();
  ctx.setTransform(VIEW_K,0,0,VIEW_K,0,0); // кожен кадр — базова трансформація логічних 1280×720
  ctx.imageSmoothingEnabled=false;
  pollPads();
  if(state.screen==='fight' && state.game){
    if(NET.guest) netGuestFrame();              // гість не рахує бій — бере знімок від хоста й шле свій ввід
    else if(!state.paused) state.game.update(dt);
    state.game.draw();
    if(NET.host) netHostFrame();
    if(UI.cur==='overlay') UI.frame(dt); // переможець на фінальному екрані
  } else {
    UI.frame(dt);
    // фон меню: анімований Темний Портал
    drawMenuBG(dt);
  }
  TOUCH.frame();
  pressed.clear();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
