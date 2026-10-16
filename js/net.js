"use strict";
/* ============================================================
   ГРА ПО МЕРЕЖІ: двоє пристроїв у локальній мережі.
   Бій рахує сервер — tools/server.js (tools/netsim.js) на комп'ютері.
   Телефони нічого не рахують: щокадру отримують знімок усього, що
   малюється (js/snap.js), малюють його й шлють свій ввід. Тож слабкий
   телефон гальмує лише сам себе, а не суперника, і розсинхрону бути не може.
   Хост (Гравець 1) лише обирає арену; обидва грають із затримкою
   на один «туди-назад» по Wi-Fi.
   Повідомлення: sel — вибір бійця (сервер пересилає суперникові);
   vs — хост оголосив пару й арену; start — VS скінчився; fight, end — етапи матчу від сервера;
   ready — мої картинки завантажились; s — знімок стану; x — звуки бою;
   i/a/f/u — ввід (утримання, здібність, форма, ультимейт); p — пауза;
   rematch, chars — дії з фінального екрана; ping/pong — затримка мережі (?perf).
   ============================================================ */
NET.send=function(o){ const ws=this.ws; if(ws&&ws.readyState===1) ws.send(JSON.stringify(o)); };

/* ---------- лобі ---------- */
function netOpen(){
  state.mode='net';
  show('netLobby');
  if(location.protocol==='file:'){
    netLobby('Гру відкрито як файл — мережа недоступна.',[],'Запусти на комп\'ютері <code>node tools/server.js</code> і відкрий адресу, яку він покаже.',true);
    return;
  }
  if(location.hostname.endsWith('github.io')){ // статичний хостинг: сервера-ретранслятора тут нема
    netLobby('На сайті гра по мережі недоступна.',[],'Вона працює в домашній Wi-Fi: завантаж гру з GitHub, запусти на комп\'ютері <code>node tools/server.js</code> і відкрий адресу, яку він покаже, на обох пристроях.',false);
    return;
  }
  netLobby('Підключення до сервера…');
  netConnect();
}
function netLobby(status,urls,note,retry){
  $('netStatus').textContent=status;
  $('netUrls').innerHTML=(urls||[]).map(u=>`<b>${u}</b>`).join('');
  $('netNote').innerHTML=note||'';
  $('netRetry').classList.toggle('hidden',!retry);
  if(UI.cur==='netLobby'&&!listItems('netLobby').includes(UI.focusEl)) focusFirst('netLobby');
}
function netWaiting(prefix){
  const urls=NET.urls.length?NET.urls:[location.origin];
  netLobby((prefix?prefix+' ':'')+'Чекаємо суперника…',urls,
    'На другому телефоні (у тій самій Wi-Fi мережі) відкрий цю адресу й обери <b>Гра по мережі</b>.');
}
function netConnect(){
  netClose();
  let ws;
  try{ ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`); }
  catch(e){ netLobby('Не вдалося підключитися.',[],'',true); return; }
  NET.ws=ws;
  ws.onmessage=e=>{
    // знімок (~60 на секунду) лише запам'ятовуємо: розбираємо останній, коли малюємо кадр (netFrame).
    // Слабкий телефон малює менше кадрів, ніж приходить знімків, — розбирати кожен для нього марна робота
    if(e.data.startsWith('{"t":"s"')){ NET.snap=e.data; return; }
    let m; try{ m=JSON.parse(e.data); }catch(x){ return; }
    netOnMsg(m);
  };
  ws.onclose=()=>{
    if(NET.ws!==ws) return;                 // це старе з'єднання, ми вже перепідключились
    const was=NET.paired;
    NET.ws=null; netDropPeer();
    show('netLobby');
    netLobby(was?'Зв\'язок із сервером обірвався.':'Сервер недоступний.',[],
      'Перевір, що на комп\'ютері працює <code>node tools/server.js</code>, а телефон у тій самій мережі.',true);
  };
}
function netClose(){ const ws=NET.ws; NET.ws=null; if(ws){ ws.onclose=null; try{ ws.close(); }catch(e){} } }
function netLeave(){ netClose(); netDropPeer(); NET.side=-1; state.mode='ai'; }
// суперник зник: прибрати все, що трималося на ньому
function netDropPeer(){
  NET.paired=false; NET.snap=null; NET.remoteSel=null; NET.sentSel=''; NET.vsPending=false; NET.out=null; NET.rtt=0;
  document.body.classList.remove('net');
  clearTimeout(VS.timer);
  if(state.game||UI.cur==='overlay'||state.paused){ closePause(); screens.overlay.classList.add('hidden'); state.game=null; }
}

function netOnMsg(m){
  switch(m.t){
    case 'welcome': NET.side=m.side; NET.urls=m.urls||[]; if(!NET.paired) netWaiting(); break;
    case 'full': netClose(); netLobby('Тут уже грають двоє.',[],'Зачекай, поки хтось вийде з мережевої гри.',true); break;
    case 'paired':
      NET.paired=true; NET.remoteSel=null; NET.sentSel=''; NET.vsPending=false; NET.out=null;
      document.body.classList.add('net');
      state.mode='net'; sfx('ok'); openSelect();
      break;
    case 'peer-left': netDropPeer(); show('netLobby'); netWaiting('Суперник вийшов.'); sfx('tick'); break;
    case 'sel': netApplySel(m); break;
    case 'vs': if(NET.guest){ NET.vsPending=true; state.picks=m.p.map(netPick); state.arena=THEMES[m.a]||null; setTimeout(()=>{ if(NET.on&&NET.vsPending) openVersus(); },650); } break;   // vsPending — бій ще не почався (хост міг пропустити VS)
    case 'fight': netStartMirror(m.a); break;
    case 'x': for(const k of m.k) sfx(k); break;   // звуки бою — одразу, навіть якщо кадр знімка пропустимо
    case 'end': if(state.game) showOverlay(state.game.f[m.w]); break;
    case 'chars': if(UI.cur!=='select') toSelect(); break;
    case 'pong': NET.rtt=performance.now()-m.c; break;
    case 'err': netDropPeer(); show('netLobby'); netLobby('Сервер не зміг почати бій.',[],m.msg||'',true); break;
  }
}

/* ---------- вибір бійця: кожен обирає свого, суперника видно наживо ---------- */
const netPick=([ci,si,ki])=>{ const cls=CLASSES[ci], spec=cls.specs[si]; return {cls,spec,skin:spec.skins[ki]}; };
function netSendSel(){
  const s=SEL.sides[NET.side]; if(!s) return;
  const msg=JSON.stringify({t:'sel',ci:s.ci,si:s.si,ki:s.ki,locked:s.locked});
  if(msg===NET.sentSel) return;
  NET.sentSel=msg; if(NET.ws&&NET.ws.readyState===1) NET.ws.send(msg);
}
function netApplySel(m){
  NET.remoteSel=m;
  if(UI.cur!=='select') return;
  const side=1-NET.side;
  let s=SEL.sides[side];
  if(s.ci!==m.ci||s.si!==m.si||s.ki!==m.ki){ s.ci=m.ci; s.si=m.si; s.ki=m.ki; rebuildFighter(side); s=SEL.sides[side]; }
  if(m.locked&&!s.locked) lockSide(side);
  else if(!m.locked&&s.locked){ s.locked=false; s.f.anim.stop(); }
  renderSelect();
  netCheckVersus();
}
// обидва готові → хост оголошує VS, і обидва пристрої показують його одночасно
function netCheckVersus(){
  if(!NET.host||NET.vsPending||UI.cur!=='select'||!SEL.sides[0].locked||!SEL.sides[1].locked) return;
  setTimeout(()=>{ if(NET.on&&UI.cur==='select'&&SEL.sides[0].locked&&SEL.sides[1].locked) openArenaSel(); },650);   // хост обирає арену
}
function netAnnounceVersus(){
  if(!NET.host||NET.vsPending) return;
  NET.vsPending=true;
  const P=SEL.sides.map(s=>[s.ci,s.si,s.ki]);
  state.picks=P.map(netPick);
  if(!state.arena) state.nextArena=THEMES[Math.floor(Math.random()*THEMES.length)];   // випадкову — вже тут: гість почне вантажити ту саму картинку
  NET.send({t:'vs',p:P,a:THEMES.indexOf(state.arena||state.nextArena),r:state.arena?0:1});   // r — випадкова: на реванш сервер обере нову
  openVersus();
}

/* ---------- дзеркальна гра: лише малює знімки сервера ---------- */
function netStartMirror(a){
  clearTimeout(VS.timer);
  NET.vsPending=false; NET.snap=null; NET.out=null; NET.ready=false;
  if(THEMES[a]){ state.arena=null; state.nextArena=THEMES[a]; }   // арена — від сервера (реванш на випадковій — уже інша)
  const P=state.picks, m0=muted;
  muted=true;                               // звуки бою пришле сервер
  const p1=new Fighter(P[0].cls,P[0].spec,0,P[0].skin), p2=new Fighter(P[1].cls,P[1].spec,1,P[1].skin);
  state.game=new Game(p1,p2);
  state.game.waitPeer=true;                 // до першого знімка — екран завантаження (сервер чекає обох гравців)
  muted=m0;
  closePause();
  show(null);
  state.screen='fight';
}

/* ---------- щокадровий крок (з main.js) ---------- */
function netFrame(){
  const g=state.game, now=performance.now();
  let s=null;
  if(NET.snap&&g){ try{ s=JSON.parse(NET.snap); }catch(e){} NET.snap=null; }
  if(s){
    applySnap(g,s); g.waitPeer=false;
    if(!!s.pa!==state.paused&&UI.cur!=='overlay') setPaused(!!s.pa);   // пауза спільна: меню паузи — слідом за сервером
  }
  // мої картинки готові — сервер почне відлік, щойно готові обидва
  if(g&&!NET.ready&&g.assetsReady()){ NET.ready=true; NET.send({t:'ready'}); }
  if(now-(NET.pingT||0)>1000){ NET.pingT=now; NET.send({t:'ping',c:now}); }
  netInput();
}
/* Ввід: клавіатура (обидві розкладки), перший геймпад, сенсорне керування. Кличеться щокадру й одразу з подій
   клавіш і дотиків (input.js, touch.js): на повільному телефоні натискання не чекає наступного кадру */
function netInput(){
  if(!state.game||state.screen!=='fight'||state.paused||UI.cur) return;
  const now=performance.now(), pad=padInputs[0];
  let mv=0;
  if(keys.has('KeyA')||keys.has('ArrowLeft')) mv-=1;
  if(keys.has('KeyD')||keys.has('ArrowRight')) mv+=1;
  if(pad&&pad.mv) mv=pad.mv;
  if(TIN.mv) mv=TIN.mv;
  const j=keys.has('KeyW')||keys.has('ArrowUp')||!!(pad&&pad.jump)||TIN.jump||now<TIN.jumpUntil;
  const b=keys.has('KeyS')||keys.has('ArrowDown')||!!(pad&&pad.block)||TIN.block||now<TIN.blockUntil;
  const o=NET.out||{};
  if(mv!==o.mv||j!==o.j||b!==o.b){ NET.out={mv,j,b}; NET.send({t:'i',mv,j,b}); }
  // натискання — один раз: відправлене прибираємо, щоб наступний виклик у тому ж кадрі не послав його вдруге
  const hit=kk=>{ const on=kk.some(c=>pressed.has(c)); for(const c of kk) pressed.delete(c); return on; };
  for(let i=0;i<4;i++){
    const k=hit([P1KEYS.ab[i]].concat(P2KEYS.ab[i])), p=pad&&pad.ab[i], t=TIN.ab[i];
    if(k||p||t){ TIN.ab[i]=0; if(pad) pad.ab[i]=false; NET.send({t:'a',i}); }
  }
  if(hit(P1KEYS.form.concat(P2KEYS.form))||(pad&&pad.form)||TIN.form){ TIN.form=0; if(pad) pad.form=false; NET.send({t:'f'}); }
  if(hit(P1KEYS.ult.concat(P2KEYS.ult))||(pad&&pad.ult)||TIN.ult){ TIN.ult=0; if(pad) pad.ult=false; NET.send({t:'u'}); }
}
