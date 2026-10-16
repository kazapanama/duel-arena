"use strict";
/* ============================================================
   БІЙ У БРАУЗЕРІ ХОСТА для «Мультиплеєра через GitHub» (js/p2p.js).
   Те саме, що робить tools/netsim.js + tools/server.js на комп'ютері, але у Web Worker:
   вантажить файли гри (без малювання — полотна й картинки тут заглушки), тримає кімнату
   на двох (js/room.js) і рахує бій. Основний потік лише возить повідомлення між кімнатою
   та гравцями: хостом (id 0, цей же пристрій) і гостем (id 1, WebRTC).
     main → worker:  {k:'join',id} {k:'msg',id,m} {k:'leave',id}
     worker → main:  {k:'to',id,m} (повідомлення гравцю) {k:'close',id} {k:'log',m}
   ============================================================ */
(function(){
  // Той самий список у tools/netsim.js — міняти разом
  const FILES=['arenas_data','core','audio','data','input','rig','paint','cutout','cat','models','sprite','pets','projectiles','arena','fighter','game','snap','simapi','room'];

  /* Заглушка будь-чого з DOM (як у tools/netsim.js): властивості й виклики повертають нову заглушку,
     запис ігнорується, у числах — 0. Потрібна лише під час завантаження файлів гри */
  function stub(){
    return new Proxy(function(){},{
      get(t,k){ if(k===Symbol.toPrimitive) return ()=>0; if(typeof k==='symbol'||k==='then') return undefined; return stub(); },
      set(){ return true; },
      apply(){ return stub(); },
      construct(){ return stub(); },
    });
  }
  Object.assign(self,{window:self,document:stub(),Image:function(){ return stub(); },innerWidth:1280,innerHeight:720,devicePixelRatio:1});

  let room=null;
  try{
    importScripts(...FILES.map(f=>f+'.js'));
    self.__onEnd=w=>room.broadcast({t:'end',w});
    (0,eval)('Game.headless=true; NET.sim=true; muted=true; function showOverlay(w){ __onEnd(w.idx); }');
    room=createRoom({sim:sandboxApi(),log:m=>postMessage({k:'log',m})});
  }catch(e){
    postMessage({k:'fail',m:String(e&&e.message||e)});
    return;
  }

  const peers={};
  function makePeer(id){
    const p={side:-1,info:id?'гість':'хост',
      send(o){ postMessage({k:'to',id,m:typeof o==='string'?o:JSON.stringify(o)}); },
      sendRaw(s){ postMessage({k:'to',id,m:s}); },
      close(){ postMessage({k:'close',id}); }};
    return p;
  }
  onmessage=e=>{
    const d=e.data;
    if(d.k==='join'){ peers[d.id]=makePeer(d.id); room.join(peers[d.id]); }
    else if(d.k==='msg'){ if(peers[d.id]) room.message(peers[d.id],d.m); }
    else if(d.k==='leave'){ const p=peers[d.id]; if(p){ delete peers[d.id]; room.leave(p); } }
  };
  postMessage({k:'ready'});
})();
