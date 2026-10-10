"use strict";
/* ============================================================
   БІЙ НА СЕРВЕРІ для гри по мережі (його кличе tools/server.js).
   Вантажить ті самі файли гри, що й браузер, у пісочницю vm — без
   малювання: полотна, картинки й документ тут заглушки, бо бій їх
   лише створює, а малюють телефони. Сервер рахує бій і щокадру шле
   обом гравцям знімок (js/snap.js); телефони тільки малюють і шлють ввід.
   ============================================================ */
const vm=require('vm'), fs=require('fs'), path=require('path');

// порядок — як у index.html; ui/net/main/menubg/touch — інтерфейс браузера, серверу не потрібні
const FILES=['arenas_data','core','audio','data','input','rig','paint','cutout','cat','models','sprite','pets','projectiles','arena','fighter','game','snap'];

/* Заглушка будь-чого з DOM: властивості й виклики повертають нову заглушку, запис ігнорується,
   у числах — 0. Потрібна лише під час завантаження файлів (полотна шарів, getContext…) */
function stub(){
  return new Proxy(function(){},{
    get(t,k){ if(k===Symbol.toPrimitive) return ()=>0; if(typeof k==='symbol'||k==='then') return undefined; return stub(); },
    set(){ return true; },
    apply(){ return stub(); },
    construct(){ return stub(); },
  });
}

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

// onEnd(w) — матч скінчився, w — індекс переможця (у браузері тут показується екран переможця)
function createSim(root,onEnd){
  const g={console,Math,JSON,Date,performance,setTimeout,clearTimeout,setInterval,clearInterval,URL,URLSearchParams,
    document:stub(),Image:function(){ return stub(); },navigator:{userAgent:'node'},
    location:{search:'',protocol:'http:',hostname:'server',host:'server',href:''},
    addEventListener(){},innerWidth:1280,innerHeight:720,devicePixelRatio:1,__onEnd:onEnd};
  g.window=g; g.self=g;
  vm.createContext(g);
  for(const f of FILES){
    const file=path.join(root,'js',f+'.js');
    vm.runInContext(fs.readFileSync(file,'utf8'),g,{filename:file});
  }
  vm.runInContext('Game.headless=true; NET.sim=true; muted=true; function showOverlay(w){ __onEnd(w.idx); }',g);
  return vm.runInContext(`(${sandboxApi})()`,g);
}

module.exports={createSim};
