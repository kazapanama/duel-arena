"use strict";
/* ============================================================
   КЕРУВАННЯ БОЄМ БЕЗ МАЛЮВАННЯ — спільне для сервера (tools/netsim.js, Node vm)
   і для «Мультиплеєра через GitHub» (js/simworker.js, Web Worker у браузері хоста).
   Вантажиться ПІСЛЯ файлів гри в той самий глобальний простір і бачить CLASSES,
   THEMES, Game, state, NET… як у браузері. sandboxApi() повертає керування для кімнати (js/room.js).
   ============================================================ */
/* Код, що виконується всередині пісочниці: бачить глобальні CLASSES, THEMES, Game, state, NET… як у браузері */
function sandboxApi(){
  let game=null;
  const pickOf=([ci,si,ki])=>{
    const cls=CLASSES[ci], spec=cls&&cls.specs[si], skin=spec&&spec.skins[ki];
    if(!skin) throw new Error(`немає бійця ${ci}/${si}/${ki}`);
    return {cls,spec,skin};
  };
  return {
    // новий матч: picks — [[клас, спек, скін]×2], arena — індекс у THEMES
    start(picks,arena){
      const P=picks.map(pickOf);
      state.arena=THEMES[arena]||THEMES[0]; state.nextArena=null; state.paused=false;
      NET.sfxQ.length=0;
      const f=P.map((p,i)=>{ const x=new Fighter(p.cls,p.spec,i,p.skin); x.vin=newVin(); return x; });
      game=state.game=new Game(f[0],f[1]);
      return {arena:THEMES.indexOf(game.theme),title:P.map(p=>`${p.cls.name} ${p.spec.name}`).join(' vs ')+` · ${game.theme.name}`};
    },
    stop(){ game=state.game=null; state.paused=false; },
    // dt — скільки минуло насправді; кроки ≤ 1/60 с, як у браузері (main.js)
    step(dt){
      if(!game||state.paused) return;
      const n=Math.ceil(dt/0.017);
      for(let i=0;i<n;i++) game.update(dt/n);
    },
    snap(){ return JSON.stringify(netSnap(game)); },
    sfx(){ return NET.sfxQ.splice(0); },   // звуки, що пролунали з минулого виклику
    // ввід гравця side: i — утримання (рух, стрибок, блок), a — здібність, f — форма, u — ультимейт
    input(side,m){
      const f=game&&game.f[side]; if(!f) return;
      const r=f.vin, now=performance.now();
      switch(m.t){
        case 'i':
          if(m.j&&!r.jump) r.jumpUntil=now+70; if(m.b&&!r.block) r.blockUntil=now+70; // тап, що прийшов разом із відпусканням, не губиться
          r.mv=clamp(+m.mv||0,-1,1); r.jump=!!m.j; r.block=!!m.b; break;
        case 'a': if(m.i>=0&&m.i<4) r.ab[m.i|0]=now; break;
        case 'f': r.form=now; break;
        case 'u': r.ult=now; break;
      }
    },
    pause(){ if(game&&game.phase!=='matchEnd') state.paused=!state.paused; },
    get phase(){ return game?game.phase:null; },
    get themes(){ return THEMES.length; },
  };
}
