"use strict";
/* ============================================================
   КІМНАТА НА ДВОХ І ЦИКЛ БОЮ — спільні для локального сервера (tools/server.js, Node)
   і для «Мультиплеєра через GitHub» (js/simworker.js, Web Worker у браузері хоста).
   Не знає ні про сокети, ні про WebRTC: гравець — це peer з методами
     send(obj|str) / sendRaw(str) — надіслати йому повідомлення; close() — відключити;
   а поле side (0 — хост, 1 — гість) виставляє сама кімната. Транспорт кличе
     join(peer), message(peer,text), leave(peer).
   sim — бій (js/simapi.js): start / stop / step / snap / sfx / input / pause.
   ============================================================ */
(function(root){
function createRoom({sim,log=()=>{},urls=()=>[]}){
  const room=[null,null];
  const other=p=>room[p.side===0?1:0];
  const broadcast=obj=>{ const s=JSON.stringify(obj); for(const q of room) if(q) q.sendRaw(s); };
  const welcome=p=>p.send({t:'welcome',side:p.side,urls:urls()});

  function join(p){
    const slot=room[0]?(room[1]?-1:1):0;
    if(slot<0){ p.send({t:'full'}); setTimeout(()=>p.close(),200); return; }
    p.side=slot; room[slot]=p; welcome(p);
    log(`гравець ${slot+1} підключився${p.info?' ('+p.info+')':''}`);
    if(room[0]&&room[1]){ room[0].send({t:'paired'}); room[1].send({t:'paired'}); log('пара зібрана — бій можна починати'); }
  }
  function leave(p){
    if(p.side<0||room[p.side]!==p) return;
    log(`гравець ${p.side+1} відключився`);
    room[p.side]=null;
    stopMatch();
    const o=room[0]||room[1];
    if(o){
      // хто лишився — стає хостом і чекає нового суперника
      room[0]=o; room[1]=null; o.side=0;
      o.send({t:'peer-left'}); welcome(o);
    }
  }

  /* ---------- бій ---------- */
  // picks/arena/random — з оголошення VS (хост); ready — чиї картинки вже завантажились
  const M={on:false,pending:false,picks:null,arena:0,random:false,ready:[false,false],t0:0,started:false,last:0,timer:null};
  function startMatch(arena){
    stopMatch();
    if(!sim){ broadcast({t:'err',msg:'Не вдалося завантажити гру для бою — подивись повідомлення в консолі.'}); return; }
    let r;
    try{ r=sim.start(M.picks,arena); }
    catch(e){ log('не вдалося почати бій: '+e.message); broadcast({t:'err',msg:e.message}); return; }
    Object.assign(M,{on:true,ready:[false,false],t0:Date.now(),started:false,last:performance.now()});
    broadcast({t:'fight',a:r.arena});
    log('бій: '+r.title);
    tick();
  }
  function stopMatch(){ M.on=false; M.pending=false; clearTimeout(M.timer); M.timer=null; if(sim) sim.stop(); }
  /* Крок бою й знімок обом — за таймером (~64 разів/с) і одразу після вводу гравця. Таймери Windows мають крок ~15.6 мс,
     а кожне вхідне повідомлення ще й відсуває найближчий на цілий крок — тож ввід, що чекав таймера, запізнювався на 16 мс.
     dt — реальний, як у браузері */
  function tick(){
    clearTimeout(M.timer); M.timer=null;
    if(!M.on) return;
    const now=performance.now(), dt=Math.min(0.1,(now-M.last)/1000);
    M.last=now;
    // відлік раунду — коли обидва телефони завантажили картинки (або минуло 12 с)
    if(!M.started&&((M.ready[0]&&M.ready[1])||Date.now()-M.t0>12000)) M.started=true;
    if(M.started){
      try{ sim.step(dt); }
      catch(e){ console.error('Помилка в бою:',e); broadcast({t:'err',msg:'Помилка в бою: '+e.message}); stopMatch(); return; }
      if(!M.on) return;                       // матч міг скінчитися посеред кроку
      const k=sim.sfx(); if(k.length) broadcast({t:'x',k});   // звуки окремо: телефон розбирає лише останній знімок, а звуки потрібні всі
      const s=sim.snap();
      for(const q of room) if(q) q.sendRaw(s);
    }
    M.timer=setTimeout(tick,Math.max(1,15-(performance.now()-now)));
  }

  function message(p,msg){
    let m; try{ m=JSON.parse(msg); }catch(e){ return; }
    switch(m.t){
      case 'i': case 'a': case 'f': case 'u': if(M.on){ sim.input(p.side,m); if(M.started) tick(); } return;
      case 'p': if(M.on) sim.pause(); return;
      case 'ready': if(M.on) M.ready[p.side]=true; return;
      case 'ping': p.send({t:'pong',c:m.c}); return;
      case 'start': if(p.side===0&&M.pending) startMatch(M.arena); return;   // хост: VS скінчився
      case 'rematch': if(M.on&&M.picks&&sim.phase==='matchEnd') startMatch(M.random?Math.floor(Math.random()*sim.themes):M.arena); return;
      case 'vs':                                 // хост оголосив пару й арену — пересилаємо гостю нижче
        if(p.side!==0||!Array.isArray(m.p)) return;
        stopMatch(); Object.assign(M,{pending:true,picks:m.p,arena:m.a|0,random:!!m.r});
        break;
      case 'chars': stopMatch(); break;          // «Змінити бійців» — бій скасовано, суперник теж іде до вибору
    }
    const o=other(p); if(o) o.sendRaw(msg);
  }

  return {join,leave,message,broadcast,stop:stopMatch};
}
if(typeof module!=='undefined'&&module.exports) module.exports={createRoom};
else root.createRoom=createRoom;
})(typeof self!=='undefined'?self:globalThis);
