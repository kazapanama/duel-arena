"use strict";
/* ============================================================
   ГРА ПО МЕРЕЖІ: двоє пристроїв у локальній мережі.
   Сервер — tools/server.js (пересилає повідомлення між гравцями).
   Хост (Гравець 1) рахує бій як звичайно і щокадру шле знімок
   усього, що малюється; гість (Гравець 2) нічого не рахує — лише
   малює знімки й шле свій ввід. Розсинхрону бути не може,
   а гість грає із затримкою на один «туди-назад» по Wi-Fi.
   Повідомлення: sel — вибір бійця; vs, fight, end — етапи матчу;
   s — знімок стану; i/a/f/u — ввід гостя (утримання, здібність, форма, ультимейт);
   p — пауза; rematch, chars — дії з фінального екрана.
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
  ws.onmessage=e=>{ let m; try{ m=JSON.parse(e.data); }catch(x){ return; } netOnMsg(m); };
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
  NET.paired=false; NET.snap=null; NET.remoteSel=null; NET.sentSel=''; NET.vsPending=false; NET.rin=newVin(); NET.out=null;
  document.body.classList.remove('net');
  clearTimeout(VS.timer);
  if(state.game||UI.cur==='overlay'||state.paused){ closePause(); screens.overlay.classList.add('hidden'); state.game=null; }
}

function netOnMsg(m){
  switch(m.t){
    case 'welcome': NET.side=m.side; NET.urls=m.urls||[]; if(!NET.paired) netWaiting(); break;
    case 'full': netClose(); netLobby('Тут уже грають двоє.',[],'Зачекай, поки хтось вийде з мережевої гри.',true); break;
    case 'paired':
      NET.paired=true; NET.remoteSel=null; NET.sentSel=''; NET.vsPending=false; NET.rin=newVin(); NET.out=null;
      document.body.classList.add('net');
      state.mode='net'; sfx('ok'); openSelect();
      break;
    case 'peer-left': netDropPeer(); show('netLobby'); netWaiting('Суперник вийшов.'); sfx('tick'); break;
    case 'sel': netApplySel(m); break;
    case 'vs': if(NET.guest){ NET.vsPending=true; state.picks=m.p.map(netPick); setTimeout(()=>{ if(NET.on) openVersus(); },650); } break;
    case 'fight': if(NET.guest) netStartMirror(); break;
    case 's': if(NET.guest){ NET.snap=m; for(const k of m.sfx) sfx(k); } break;   // звуки — одразу, навіть якщо кадр знімка пропустимо
    case 'end': if(NET.guest&&state.game) showOverlay(state.game.f[m.w]); break;
    case 'i': if(NET.host){ const r=NET.rin, now=performance.now();
      if(m.j&&!r.jump) r.jumpUntil=now+70; if(m.b&&!r.block) r.blockUntil=now+70; // тап, що прийшов разом із відпусканням, не губиться
      r.mv=m.mv; r.jump=m.j; r.block=m.b; } break;
    case 'a': if(NET.host) NET.rin.ab[m.i]=performance.now(); break;
    case 'f': if(NET.host) NET.rin.form=performance.now(); break;
    case 'u': if(NET.host) NET.rin.ult=performance.now(); break;
    case 'p': if(NET.host) togglePause(); break;
    case 'rematch': if(NET.host&&state.game&&state.game.phase==='matchEnd') startFight(); break;
    case 'chars': if(UI.cur!=='select') toSelect(); break;
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
  NET.send({t:'vs',p:P});
  openVersus();
}

/* ---------- гість: дзеркальна гра без власної симуляції ---------- */
function netStartMirror(){
  clearTimeout(VS.timer);
  NET.vsPending=false; NET.snap=null; NET.out=null;
  const P=state.picks, m0=muted;
  muted=true;                               // звук раунду з конструктора пришле хост
  const p1=new Fighter(P[0].cls,P[0].spec,0,P[0].skin), p2=new Fighter(P[1].cls,P[1].spec,1,P[1].skin);
  state.game=new Game(p1,p2);
  muted=m0;
  closePause();
  show(null);
  state.screen='fight';
}

/* ---------- знімок стану (хост → гість) ---------- */
const r1=v=>Math.round(v*10)/10, r3=v=>Math.round(v*1000)/1000;
// числові поля бійця, що потрібні малюванню й HUD (порядок однаковий на обох кінцях)
const NF=['x','y','facing','hp','maxHp','shield','guard','gcd','formCd','hitT','shiftT','wingsT','wingsDur','stealthT','dispersT','rootT','rootDur','fearT','stunT','roundWins','knockT',
  'meter','combo','comboT','growT','ascT','dotLeft','hotLeft','pomT'];
const poseOf=pose=>{ const po={}; for(const k in pose){ const v=pose[k]; po[k]=typeof v==='number'?r3(v):v; } return po; };
function snapFighter(f){
  const po=poseOf(f.anim.pose);
  const c=f.casting, p=f.pet;
  return {n:NF.map(k=>r3(+f[k]||0)), fm:f.form, bl:f.blocking?1:0, ko:f.ko?1:0, rk:f.rootKind,
    cd:f.cds.map(r3), bf:[r3(f.buffs.dmg.t),r3(f.buffs.spd.t),r3(f.buffs.dr.t)],
    cs:c?[c.i,r3(c.t),r3(c.total),c.chan?1:0]:0, cc:f.model.castCol||'', po,
    pt:p?{k:p.kind,x:r1(p.x),f:p.facing,t:r3(p.t),T:p.T,h:r3(p.hitT),po:poseOf(p.anim.pose)}:0};
}
function netSnap(g){
  return {t:'s', tm:r3(g.time), sh:r1(g.shake), cam:[r3(g.cam.scale),r1(g.cam.x),r1(g.cam.offX),r1(g.cam.offY)],
    ph:g.phase, pT:r3(g.phaseT), bn:g.banner, rd:g.round, rt:r3(g.roundTimer), th:THEMES.indexOf(g.theme), ko:r3(g.koFlash||0), pa:state.paused?1:0,
    f:g.f.map(snapFighter),
    P:g.particles.map(p=>[r1(p.x),r1(p.y),r3(p.t),r1(p.size),p.color]),
    fl:g.floats.map(f=>[r1(f.x),r1(f.y),f.txt,f.color,f.size,r3(f.t)]),
    pr:g.projectiles.map(p=>[r1(p.x),r1(p.y),r1(p.vx),p.color,p.size,p.kind,p.school||0]),
    sl:g.slashes.map(s=>[r1(s.x),r1(s.y),s.dir,r3(s.t),s.T,s.color,s.kind]),
    be:g.beams.map(b=>[r1(b.x1),r1(b.y1),r1(b.x2),r1(b.y2),r3(b.t),b.color]),
    ri:g.rings.map(r=>[r1(r.x),r1(r.y),r1(r.r),r3(r.t),r.color]),
    tr:g.trails.map(t=>[r1(t.x1),r1(t.x2),r1(t.y),r3(t.t),t.color]),
    te:(g.tells||[]).map(t=>[r1(t.x),r1(t.y),r3(t.t),r3(t.T)]),
    zo:g.zones.map(z=>[r1(z.x),z.r,z.color,z.kind||0]),
    mk:g.marks.map(m=>[r1(m.x),m.r,r3(m.t),m.T,m.color]),
    fa:g.fallers.map(f=>[f.kind,r1(f.x),r1(f.y),r1(f.x0),r1(f.y0),r1(f.x1)]),
    er:g.erupts.map(e=>[r1(e.x),r3(e.t),e.T]),
    po:g.portals.map(q=>[r1(q.x),r1(q.y),r3(q.t),q.T,q.color]),
    uf:g.ultFx?[r3(g.ultFx.t),g.ultFx.T,g.ultFx.side,g.ultFx.name,g.ultFx.color,g.ultFx.em]:0,
    sfx:NET.sfxQ.splice(0)};
}
function applyFighter(f,d){
  if(f.form!==d.fm) f.setForm(d.fm);
  NF.forEach((k,i)=>{ f[k]=d.n[i]; });
  f.blocking=!!d.bl; f.ko=!!d.ko; f.rootKind=d.rk;
  for(let i=0;i<4;i++) f.cds[i]=d.cd[i];
  f.buffs.dmg.t=d.bf[0]; f.buffs.spd.t=d.bf[1]; f.buffs.dr.t=d.bf[2];
  f.casting=d.cs?{i:d.cs[0],t:d.cs[1],total:d.cs[2],chan:!!d.cs[3]}:null;
  if(d.pt){ // пет: модель і кеш спрайта переживають кадри, оновлюються лише числа
    const q=d.pt; let p=f.pet;
    if(!p||p.kind!==q.k) p=f.pet={kind:q.k,y:GROUND,anim:{pose:{}}};
    p.x=q.x; p.facing=q.f; p.t=q.t; p.T=q.T; p.hitT=q.h; Object.assign(p.anim.pose,q.po);
  } else f.pet=null;
  f.model.castCol=d.cc||f.accent;
  Object.assign(f.anim.pose,d.po);
}
function applySnap(g,s){
  g.time=s.tm; g.shake=s.sh;
  g.cam.scale=s.cam[0]; g.cam.x=s.cam[1]; g.cam.offX=s.cam[2]; g.cam.offY=s.cam[3];
  g.phase=s.ph; g.phaseT=s.pT; g.banner=s.bn; g.round=s.rd; g.roundTimer=s.rt; g.koFlash=s.ko;
  if(THEMES[s.th]) g.theme=THEMES[s.th];
  s.f.forEach((d,i)=>applyFighter(g.f[i],d));
  g.particles=s.P.map(a=>({x:a[0],y:a[1],t:a[2],size:a[3],color:a[4]}));
  g.floats=s.fl.map(a=>({x:a[0],y:a[1],txt:a[2],color:a[3],size:a[4],t:a[5]}));
  g.projectiles=s.pr.map(a=>({x:a[0],y:a[1],vx:a[2],color:a[3],size:a[4],kind:a[5],school:a[6]||null}));
  g.slashes=s.sl.map(a=>({x:a[0],y:a[1],dir:a[2],t:a[3],T:a[4],color:a[5],kind:a[6]}));
  g.beams=s.be.map(a=>({x1:a[0],y1:a[1],x2:a[2],y2:a[3],t:a[4],color:a[5]}));
  g.rings=s.ri.map(a=>({x:a[0],y:a[1],r:a[2],t:a[3],color:a[4]}));
  g.trails=s.tr.map(a=>({x1:a[0],x2:a[1],y:a[2],t:a[3],color:a[4]}));
  g.tells=s.te.map(a=>({x:a[0],y:a[1],t:a[2],T:a[3]}));
  g.zones=s.zo.map(a=>({x:a[0],r:a[1],color:a[2],kind:a[3]||null}));
  g.marks=s.mk.map(a=>({x:a[0],r:a[1],t:a[2],T:a[3],color:a[4]}));
  g.fallers=s.fa.map(a=>({kind:a[0],x:a[1],y:a[2],x0:a[3],y0:a[4],x1:a[5]}));
  g.erupts=s.er.map(a=>({x:a[0],t:a[1],T:a[2]}));
  g.portals=s.po.map(a=>({x:a[0],y:a[1],t:a[2],T:a[3],color:a[4]}));
  g.ultFx=s.uf?{t:s.uf[0],T:s.uf[1],side:s.uf[2],name:s.uf[3],color:s.uf[4],em:s.uf[5]}:null;
  // спільна пауза: показуємо/ховаємо меню паузи слідом за хостом
  if(!!s.pa!==state.paused&&UI.cur!=='overlay') setPaused(!!s.pa);
}

/* ---------- щокадрові кроки (з main.js) ---------- */
function netHostFrame(){
  const ws=NET.ws;
  if(!state.game||!ws||ws.readyState!==1) return;
  if(ws.bufferedAmount>256*1024) return;    // гість не встигає приймати — пропускаємо кадр, а не копимо затримку
  ws.send(JSON.stringify(netSnap(state.game)));
}
function netGuestFrame(){
  if(NET.snap&&state.game){ applySnap(state.game,NET.snap); NET.snap=null; }
  if(state.paused||UI.cur) return;
  // ввід гостя: клавіатура (обидві розкладки), перший геймпад, сенсорне керування
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
  for(let i=0;i<4;i++){
    const kk=[P1KEYS.ab[i]].concat(P2KEYS.ab[i]);
    if(kk.some(c=>pressed.has(c))||(pad&&pad.ab[i])||TIN.ab[i]){ TIN.ab[i]=0; NET.send({t:'a',i}); }
  }
  if(P1KEYS.form.concat(P2KEYS.form).some(c=>pressed.has(c))||(pad&&pad.form)||TIN.form){ TIN.form=0; NET.send({t:'f'}); }
  if(P1KEYS.ult.concat(P2KEYS.ult).some(c=>pressed.has(c))||(pad&&pad.ult)||TIN.ult){ TIN.ult=0; NET.send({t:'u'}); }
}
