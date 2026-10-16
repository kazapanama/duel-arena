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
// Той самий список у js/simworker.js — міняти разом
const FILES=['arenas_data','core','audio','data','input','rig','paint','cutout','cat','models','sprite','pets','projectiles','arena','fighter','game','snap','simapi'];

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
  return vm.runInContext('sandboxApi()',g);
}

module.exports={createSim};
