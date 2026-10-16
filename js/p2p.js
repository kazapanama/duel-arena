"use strict";
/* ============================================================
   МУЛЬТИПЛЕЄР ЧЕРЕЗ GITHUB: гра двох пристроїв по інтернету без свого сервера.
   Гра лежить на GitHub Pages (статичний хостинг), а пристрої з'єднуються напряму — WebRTC (RTCDataChannel).
   Щоб два браузери знайшли один одного, треба один раз обмінятися «адресами» (SDP). Робимо це самі, без сервісів:
     1. Хост тисне «Створити гру» → отримує посилання й QR (#o=…) → надсилає другові.
     2. Гість відкриває посилання → отримує свою відповідь (#a=…) у вигляді посилання й QR → надсилає хосту.
     3. Хост вставляє відповідь (або сканує QR, або відповідь сама прилітає, якщо посилання відкрите
        в тому ж браузері) → канали відкриваються.
   SDP стискається до ~150 байтів (sdpPack), щоб влізти в QR.
   Бій рахує пристрій хоста — у Web Worker (js/simworker.js, кімната — js/room.js, та сама, що в tools/server.js).
   Решта гри (net.js) не відрізняє цей режим від мережі через сервер: хост і гість говорять із «сервером»
   тим самим протоколом, лише замість WebSocket — вхідна черга воркера (хост) чи RTCDataChannel (гість).
   Два канали: ctl — надійний (вибір бійців, ввід, події), snap — ненадійний без черги (знімки бою:
   запізнілий знімок нікому не потрібен, тож загублений просто пропускаємо).
   ============================================================ */

// Єдиний зовнішній сервіс — публічний STUN: лише підказує пристрою його зовнішню адресу, дані гри через нього не йдуть.
// Без нього з'єднаються тільки пристрої в одній мережі. Порожній масив [] — вимкнути.
const P2P_ICE=[{urls:'stun:stun.l.google.com:19302'}];

const P2P={role:'',dead:null,pc:null,ctl:null,snap:null,W:null,linked:false,link:'',lastRx:0,hb:0,joinT:0,bc:null,scan:null,canScan:false};

/* ---------- кодування SDP у короткий рядок ---------- */
const b64uEnc=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const b64uDec=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((s.length+3)%4)),c=>c.charCodeAt(0));
const CAND_TYPES=['host','srflx','prflx','relay'];
const UUID_RE=/^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\.local$/i;
function ip6bytes(s){
  const two=s.split('::');
  if(two.length>2) return null;
  const head=two[0]?two[0].split(':'):[], tail=two.length===2&&two[1]?two[1].split(':'):[];
  const groups=two.length===2?[...head,...Array(8-head.length-tail.length).fill('0'),...tail]:head;
  if(groups.length!==8||groups.some(g=>!/^[0-9a-f]{1,4}$/i.test(g))) return null;
  return groups.flatMap(g=>{ const v=parseInt(g,16); return [v>>8,v&255]; });
}
const hex=(b,i,n)=>[...b.slice(i,i+n)].map(x=>x.toString(16).padStart(2,'0')).join('');

/* SDP → байти: версія, ufrag, pwd, mid, відбиток DTLS (32 байти), до 6 кандидатів (тип, адреса, порт).
   Решта SDP (рядки каналу даних) завжди однакова — sdpUnpack відновлює її з шаблону */
function sdpPack(sdp){
  const lines=sdp.split(/\r?\n/);
  const val=p=>{ const l=lines.find(x=>x.startsWith(p)); return l?l.slice(p.length).trim():''; };
  const ufrag=val('a=ice-ufrag:'), pwd=val('a=ice-pwd:'), mid=val('a=mid:')||'0';
  const fp=val('a=fingerprint:sha-256 ').split(':').map(h=>parseInt(h,16));
  if(fp.length!==32||fp.some(isNaN)||!ufrag||!pwd) throw new Error('Браузер повернув незвичний SDP');
  const cands=[];
  for(const l of lines){
    if(!l.startsWith('a=candidate:')) continue;
    const t=l.slice(12).split(' ');   // foundation component protocol priority address port typ type …
    const type=CAND_TYPES.indexOf(t[7]), port=+t[5];
    if((t[2]||'').toLowerCase()!=='udp'||t[1]!=='1'||t[6]!=='typ'||type<0||!(port>0)) continue;
    const ad=t[4]; let kind, addr;
    if(/^\d+\.\d+\.\d+\.\d+$/.test(ad)){ if(ad.startsWith('169.254.')) continue; kind=0; addr=ad.split('.').map(Number); }
    else if(ad.includes(':')){ addr=ip6bytes(ad); if(!addr||(addr[0]===0xfe&&(addr[1]&0xc0)===0x80)) continue; kind=1; }   // fe80:: поза мережею марний
    else { const m=ad.match(UUID_RE); if(!m) continue; kind=2; addr=m.slice(1).join('').match(/../g).map(h=>parseInt(h,16)); }   // mDNS-імʼя замість локальної адреси
    cands.push({kind,type,addr,port,w:type===1?0:type===3?1:type===2?2:(kind===0?3:kind===2?4:5)});
  }
  cands.sort((a,b)=>a.w-b.w);
  const ascii=s=>[...s].map(c=>c.charCodeAt(0)&127);
  const out=[1,ufrag.length,...ascii(ufrag),pwd.length,...ascii(pwd),mid.length,...ascii(mid),...fp];
  const use=cands.slice(0,6);
  out.push(use.length);
  for(const c of use) out.push((c.kind<<2)|c.type,...c.addr,c.port>>8,c.port&255);
  return Uint8Array.from(out);
}
// байти → SDP; role: 'offer' (setup:actpass) чи 'answer' (setup:active)
function sdpUnpack(b,role){
  let i=0;
  const byte=()=>{ if(i>=b.length) throw new Error('обірваний код'); return b[i++]; };
  const str=()=>{ const n=byte(); let s=''; for(let k=0;k<n;k++) s+=String.fromCharCode(byte()); return s; };
  if(byte()!==1) throw new Error('невідома версія коду');
  const ufrag=str(), pwd=str(), mid=str(), fp=[];
  for(let k=0;k<32;k++) fp.push(byte().toString(16).toUpperCase().padStart(2,'0'));
  const n=byte(), cl=[];
  for(let k=0;k<n;k++){
    const h=byte(), kind=h>>2, type=CAND_TYPES[h&3];
    const len=kind===0?4:16, a=[]; for(let j=0;j<len;j++) a.push(byte());
    const port=(byte()<<8)|byte();
    let ad;
    if(kind===0) ad=a.join('.');
    else if(kind===1){ const g=[]; for(let j=0;j<16;j+=2) g.push(((a[j]<<8)|a[j+1]).toString(16)); ad=g.join(':'); }
    else { const s=hex(a,0,16); ad=`${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}.local`; }
    const pref=({host:126,prflx:110,srflx:100,relay:0})[type];
    cl.push(`a=candidate:${k+1} 1 udp ${(pref<<24)+(65535<<8)+255-k} ${ad} ${port} typ ${type}`+(type==='host'?'':' raddr 0.0.0.0 rport 0'));
  }
  return ['v=0','o=- 4611731400430051336 2 IN IP4 127.0.0.1','s=-','t=0 0',`a=group:BUNDLE ${mid}`,'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel','c=IN IP4 0.0.0.0',
    `a=ice-ufrag:${ufrag}`,`a=ice-pwd:${pwd}`,`a=fingerprint:sha-256 ${fp.join(':')}`,
    `a=setup:${role==='offer'?'actpass':'active'}`,`a=mid:${mid}`,'a=sctp-port:5000','a=max-message-size:262144',
    ...cl,'a=end-of-candidates',''].join('\r\n');
}
const p2pBase=()=>location.href.split('#')[0];
// з вставленого тексту (посилання чи голий код) → {type:'o'|'a', sdp}; want — що очікуємо, якщо вставлено голий код
function p2pParse(text,want){
  text=String(text||'').trim();
  const m=text.match(/[#?&]([oa])=([A-Za-z0-9_-]+)/);
  let type, code;
  if(m){ type=m[1]; code=m[2]; }
  else if(/^[A-Za-z0-9_-]{60,}$/.test(text)){ type=want; code=text; }
  else return null;
  try{ return {type,sdp:sdpUnpack(b64uDec(code),type==='o'?'offer':'answer')}; }catch(e){ return null; }
}

/* ---------- екран ---------- */
const p2pEl=id=>document.getElementById(id);
const P2P_BTNS=['p2pHost','p2pJoin','p2pCopy','p2pPaste','p2pScan','p2pScanStop'];
const P2P_VIEWS={          // що видно: кнопки, QR, камера, поле вставки
  start:{btns:['p2pHost','p2pJoin']},
  host:{btns:['p2pCopy','p2pPaste','p2pScan'],qr:1,input:1},
  join:{btns:['p2pPaste','p2pScan'],input:1},
  guest:{btns:['p2pCopy'],qr:1},
  scan:{btns:['p2pScanStop'],video:1},
  wait:{btns:[]},
};
function p2pView(name,status,note){
  const v=P2P_VIEWS[name]||P2P_VIEWS.start;
  for(const id of P2P_BTNS){
    const el=document.querySelector(`#p2pLobby [data-act="${id}"]`);
    el.classList.toggle('hidden',!v.btns.includes(id)||(id==='p2pScan'&&!P2P.canScan));
  }
  p2pEl('p2pQr').classList.toggle('hidden',!v.qr);
  p2pEl('p2pQr').classList.remove('big');
  p2pEl('p2pVideo').classList.toggle('hidden',!v.video);
  p2pEl('p2pIn').classList.toggle('hidden',!v.input);
  if(status!==undefined) p2pEl('p2pStatus').textContent=status;
  if(note!==undefined) p2pEl('p2pNote').textContent=note;
  P2P.view=name;
  if(UI.cur==='p2pLobby') focusFirst('p2pLobby');
}
function p2pOpen(){
  state.mode='net';
  show('p2pLobby');
  if(typeof RTCPeerConnection==='undefined'){ p2pView('wait','Цей браузер не вміє WebRTC.','Спробуй свіжий Chrome, Safari чи Firefox.'); return; }
  P2P.canScan=false;
  if('BarcodeDetector' in window&&navigator.mediaDevices&&navigator.mediaDevices.getUserMedia){
    BarcodeDetector.getSupportedFormats().then(f=>{ P2P.canScan=f.includes('qr_code'); if(P2P.view) p2pView(P2P.view); }).catch(()=>{});
  }
  p2pView('start','Гра через інтернет',
    'Без серверів: пристрої з\'єднуються напряму. Один створює гру й надсилає другому посилання чи QR, другий відповідає своїм кодом. Бій рахує пристрій того, хто створив гру.');
}
function p2pSay(status,note){ p2pEl('p2pStatus').textContent=status; if(note!==undefined) p2pEl('p2pNote').textContent=note; }

/* ---------- зʼєднання ---------- */
function p2pGather(pc){   // чекаємо адреси: вони вкладаються в посилання разом з SDP (без «тріклу»)
  return new Promise(res=>{
    let n=0, timer; const t0=performance.now();
    const fin=()=>{ clearTimeout(timer); pc.removeEventListener('icecandidate',onc); pc.removeEventListener('icegatheringstatechange',ongs); res(); };
    const onc=e=>{ if(e.candidate) n++; else fin(); };
    const ongs=()=>{ if(pc.iceGatheringState==='complete') fin(); };
    pc.addEventListener('icecandidate',onc); pc.addEventListener('icegatheringstatechange',ongs);
    const check=()=>{ const dt=performance.now()-t0; if((n>0&&dt>3500)||dt>12000) fin(); else timer=setTimeout(check,200); };
    if(pc.iceGatheringState==='complete') fin(); else check();
  });
}
function p2pNewPc(){
  const pc=new RTCPeerConnection({iceServers:P2P_ICE});
  P2P.pc=pc; P2P.linked=false;
  // обидва кінці створюють однакові канали за номерами (negotiated) — без очікування ondatachannel
  const ctl=P2P.ctl=pc.createDataChannel('ctl',{negotiated:true,id:0});
  const snap=P2P.snap=pc.createDataChannel('snap',{negotiated:true,id:1,ordered:false,maxRetransmits:0});
  const open=()=>{ if(P2P.pc===pc&&!P2P.linked&&ctl.readyState==='open'&&snap.readyState==='open'){ P2P.linked=true; p2pLinked(); } };
  ctl.onopen=snap.onopen=open;
  ctl.onmessage=snap.onmessage=e=>p2pRx(e.data);
  ctl.onclose=()=>p2pDown(pc);
  pc.onconnectionstatechange=()=>{ if(pc.connectionState==='failed'||pc.connectionState==='closed') p2pDown(pc); };
  return pc;
}
function p2pCloseConn(){
  clearInterval(P2P.hb); clearTimeout(P2P.joinT); P2P.hb=0;
  const pc=P2P.pc; P2P.pc=null; P2P.linked=false;
  for(const d of [P2P.ctl,P2P.snap]) if(d){ d.onopen=d.onmessage=d.onclose=null; try{ d.close(); }catch(e){} }
  P2P.ctl=P2P.snap=null;
  if(pc){ pc.onconnectionstatechange=null; try{ pc.close(); }catch(e){} }
}
function p2pStopAll(){
  p2pStopScan();
  if(P2P.bc){ P2P.bc.close(); P2P.bc=null; }
  p2pCloseConn();
  if(P2P.W){ P2P.W.onmessage=P2P.W.onerror=null; P2P.W.terminate(); P2P.W=null; }
  NET.p2p=false; P2P.role=''; P2P.link='';
}
// вихід у меню (action back на екрані лобі)
function p2pLeave(){ netLeave(); }
function p2pFail(msg,note){
  netClose(); netDropPeer(); p2pStopAll();
  show('p2pLobby'); p2pView('start',msg,note||'');
}

/* ---------- хост ---------- */
function p2pHost(){
  if(location.protocol==='file:'){ p2pView('wait','Гру відкрито як файл.','Мультиплеєр працює лише з сайту (GitHub Pages) чи локального сервера.'); return; }
  p2pStopAll(); netClose();
  NET.p2p=true; P2P.role='host'; state.mode='net';
  let W;
  try{ W=P2P.W=new Worker('js/simworker.js'); }
  catch(e){ p2pFail('Не вдалося запустити бій у цьому браузері.',String(e.message||e)); return; }
  W.onmessage=e=>{
    const d=e.data;
    if(d.k==='to'){ if(d.id===0){ const ws=NET.ws; if(ws&&ws.onmessage) ws.onmessage({data:d.m}); } else p2pToGuest(d.m); }
    else if(d.k==='close'){ if(d.id===1) p2pDown(P2P.pc); }
    else if(d.k==='log') console.log('[бій]',d.m);
    else if(d.k==='fail') p2pFail('Не вдалося завантажити бій.',d.m);
  };
  W.onerror=()=>p2pFail('Не вдалося запустити бій у цьому браузері.');
  // хост говорить із воркером через «сокет» із тим самим інтерфейсом, що в WebSocket (net.js)
  const ws={readyState:1,onmessage:e=>netOnRaw(e.data),onclose:null,send(m){ W.postMessage({k:'msg',id:0,m}); },close(){}};
  NET.ws=ws;
  W.postMessage({k:'join',id:0});
  p2pNewOffer();
}
async function p2pNewOffer(msg){
  p2pCloseConn();
  p2pView('wait','Готуємо посилання…','');
  const pc=p2pNewPc();
  try{
    await pc.setLocalDescription(await pc.createOffer());
    await p2pGather(pc);
    if(P2P.pc!==pc) return;                  // тим часом вийшли
    P2P.link=p2pBase()+'#o='+b64uEnc(sdpPack(pc.localDescription.sdp));
  }catch(e){ if(P2P.pc===pc) p2pFail('Не вдалося створити гру.',String(e.message||e)); return; }
  QR.paint(p2pEl('p2pQr'),P2P.link,4);
  p2pEl('p2pIn').value='';
  p2pView('host',msg||'Надішли другові посилання або покажи QR',
    'Друг відкриває його на своєму пристрої й отримує код-відповідь. Встав цей код нижче (або скануй його QR). Торкнись QR, щоб збільшити.');
  p2pListenAnswer();
}
function p2pListenAnswer(){   // відповідь могла відкритися в сусідній вкладці цього ж браузера (p2pBoot) — тоді вона прилетить сюди
  if(P2P.bc||!window.BroadcastChannel) return;
  const bc=P2P.bc=new BroadcastChannel('azeroth-p2p');
  bc.onmessage=e=>{
    const d=e.data;
    if(d&&d.a&&P2P.role==='host'&&P2P.pc&&P2P.pc.signalingState==='have-local-offer'){ bc.postMessage({ack:1}); p2pAccept('#a='+d.a); }
  };
}
async function p2pAccept(text){
  const pc=P2P.pc;
  if(P2P.role!=='host'||!pc||pc.signalingState!=='have-local-offer') return;
  const p=p2pParse(text,'a');
  if(!p){ p2pSay('Не схоже на відповідь друга.','Перевір, що скопійовано все посилання повністю.'); sfx('tick'); return; }
  if(p.type!=='a'){ p2pSay('Це запрошення, а не відповідь.','Тут потрібен код, який отримав друг після відкриття твого посилання.'); sfx('tick'); return; }
  try{ await pc.setRemoteDescription({type:'answer',sdp:p.sdp}); }
  catch(e){ p2pSay('Відповідь не підійшла.','Мабуть, вона від іншого запрошення. Обидва мають користуватись останнім посиланням.'); sfx('tick'); return; }
  p2pStopScan();
  p2pView('wait','З\'єднуємось…','');
  clearTimeout(P2P.joinT);
  P2P.joinT=setTimeout(()=>{ if(P2P.pc===pc&&!P2P.linked) p2pNewOffer('Не вдалося з\'єднатись. Спробуйте ще раз з новим посиланням.'); },25000);
}

/* ---------- гість ---------- */
async function p2pJoinWith(sdp){
  p2pStopAll(); netClose();
  NET.p2p=true; P2P.role='guest'; state.mode='net';
  p2pView('wait','Готуємо відповідь…','');
  const pc=p2pNewPc();
  try{
    await pc.setRemoteDescription({type:'offer',sdp});
    await pc.setLocalDescription(await pc.createAnswer());
    await p2pGather(pc);
    if(P2P.pc!==pc) return;
    P2P.link=p2pBase()+'#a='+b64uEnc(sdpPack(pc.localDescription.sdp));
  }catch(e){ if(P2P.pc===pc) p2pFail('Не вдалося прийняти запрошення.',String(e.message||e)); return; }
  QR.paint(p2pEl('p2pQr'),P2P.link,4);
  p2pView('guest','Надішли цю відповідь тому, хто створив гру',
    'Він вставляє її у себе (або сканує цей QR) — і ви з\'єднуєтесь. Торкнись QR, щоб збільшити.');
}

/* ---------- обмін повідомленнями між каналами й грою ---------- */
function p2pRx(m){
  P2P.lastRx=performance.now();
  if(typeof m!=='string'||m==='{"t":"hb"}') return;
  if(P2P.role==='host'){ if(P2P.W) P2P.W.postMessage({k:'msg',id:1,m}); }
  else { const ws=NET.ws; if(ws&&ws.onmessage) ws.onmessage({data:m}); }
}
function p2pToGuest(m){   // від кімнати гостю: знімки — по ненадійному каналу, решта — по надійному
  if(!P2P.linked) return;
  const snap=m.startsWith('{"t":"s"');
  const d=snap?P2P.snap:P2P.ctl;
  if(d&&d.readyState==='open'&&(!snap||d.bufferedAmount<256*1024)) d.send(m);   // повільний канал: знімок пропускаємо
}
function p2pLinked(){
  clearTimeout(P2P.joinT);
  p2pStopScan();
  if(P2P.bc){ P2P.bc.close(); P2P.bc=null; }
  P2P.lastRx=performance.now();
  const pc=P2P.pc, ctl=P2P.ctl;
  // живий зв'язок: кожні 2 с «hb»; тиша понад 9 с — суперника нема (вкладку закрито, зник Wi-Fi)
  P2P.hb=setInterval(()=>{
    if(ctl.readyState==='open') ctl.send('{"t":"hb"}');
    if(performance.now()-P2P.lastRx>9000) p2pDown(pc);
  },2000);
  if(P2P.role==='host'){ P2P.W.postMessage({k:'join',id:1}); }
  else {
    const ws={readyState:1,onmessage:e=>netOnRaw(e.data),onclose:null,
      send(m){ if(ctl.readyState==='open') ctl.send(m); },
      close(){ p2pCloseConn(); }};
    NET.ws=ws;
    p2pView('wait','З\'єднано!','Чекаємо хоста…');
  }
}
// зв'язок із суперником пропав (повідомити можуть кілька подій поспіль — реагуємо раз)
function p2pDown(pc){
  if(!pc||P2P.pc!==pc||P2P.dead===pc) return;
  P2P.dead=pc;
  const was=P2P.linked;
  if(P2P.role==='host'){
    if(was){ P2P.linked=false; clearInterval(P2P.hb); P2P.hb=0; if(P2P.W) P2P.W.postMessage({k:'leave',id:1}); }   // кімната сама покличе peer-left → p2pPeerLeft
    else p2pNewOffer('Не вдалося з\'єднатись. Спробуйте ще раз з новим посиланням.');
  } else {
    netDropPeer(); netClose(); p2pStopAll();
    show('p2pLobby');
    p2pView('start',was?'Зв\'язок із хостом обірвався.':'Не вдалося з\'єднатись.',
      was?'':'Спробуйте ще раз. Якщо не виходить — ви в різних мережах із суворим роутером: спробуйте одну Wi-Fi.');
  }
}
// хост: гість вийшов (з net.js за повідомленням кімнати) — готуємо нове запрошення
function p2pPeerLeft(){
  show('p2pLobby');
  p2pNewOffer('Друг вийшов. Нове посилання для наступного гостя');
}

/* ---------- вставлення, QR-камера, відкриття за посиланням ---------- */
function p2pCopy(){
  const t=P2P.link; if(!t) return;
  const done=()=>{ sfx('ok'); const el=document.querySelector('#p2pLobby [data-act="p2pCopy"]'); const was=el.textContent; el.textContent='Скопійовано!'; setTimeout(()=>{ el.textContent=was; },1500); };
  const fallback=()=>{ const i=p2pEl('p2pIn'); i.classList.remove('hidden'); i.value=t; i.focus(); i.select(); try{ document.execCommand('copy'); done(); }catch(e){} };
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done,fallback); else fallback();
}
function p2pPaste(){
  const inp=p2pEl('p2pIn');
  if(navigator.clipboard&&navigator.clipboard.readText) navigator.clipboard.readText().then(t=>{ inp.value=t; p2pText(t); },()=>inp.focus());
  else inp.focus();
}
// текст, отриманий вставкою чи QR: хост чекає відповідь (a), гість — запрошення (o)
function p2pText(text){
  if(P2P.role==='host') return p2pAccept(text);
  const p=p2pParse(text,'o');
  if(!p){ p2pSay('Не схоже на запрошення.','Встав усе посилання, яке надіслав друг.'); sfx('tick'); return; }
  if(p.type!=='o'){ p2pSay('Це відповідь, а не запрошення.','Її має вставити той, хто створив гру.'); sfx('tick'); return; }
  p2pJoinWith(p.sdp);
}
async function p2pScan(){
  if(!P2P.canScan) return;
  const video=p2pEl('p2pVideo');
  try{
    const det=new BarcodeDetector({formats:['qr_code']});
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});
    video.srcObject=stream; await video.play();
    const sc=P2P.scan={stream,t:0,back:P2P.view,status:p2pEl('p2pStatus').textContent,note:p2pEl('p2pNote').textContent};
    p2pView('scan','Наведи камеру на QR','');
    const loop=async()=>{
      if(P2P.scan!==sc) return;
      try{ for(const b of await det.detect(video)){ if(p2pParse(b.rawValue,P2P.role==='host'?'a':'o')){ p2pStopScan(); p2pText(b.rawValue); return; } } }catch(e){}
      sc.t=setTimeout(loop,200);
    };
    loop();
  }catch(e){ p2pStopScan(); p2pSay('Камера недоступна.','Дозволь доступ до камери або встав код вручну.'); }
}
function p2pStopScan(){
  const sc=P2P.scan; if(!sc) return;
  P2P.scan=null; clearTimeout(sc.t);
  sc.stream.getTracks().forEach(t=>t.stop());
  const v=p2pEl('p2pVideo'); v.srcObject=null;
  if(P2P.view==='scan') p2pView(sc.back||'start',sc.status,sc.note);
}
p2pEl('p2pIn').addEventListener('input',e=>{ const t=e.target.value.trim(); if(t.length>40) p2pText(t); });
p2pEl('p2pQr').addEventListener('click',e=>e.currentTarget.classList.toggle('big'));

// сторінку відкрито за посиланням з QR: #o=… — запрошення (стаємо гостем), #a=… — відповідь (передаємо хосту)
function p2pBoot(){
  const h=location.hash;
  if(!/^#[oa]=/.test(h)) return;
  try{ history.replaceState(null,'',p2pBase()); }catch(e){}
  const p=p2pParse(h,'o');
  show('p2pLobby');
  if(!p){ p2pView('start','Це посилання зіпсоване.','Попроси друга надіслати його ще раз цілим.'); return; }
  if(p.type==='o'){ p2pOpen(); p2pJoinWith(p.sdp); return; }
  // відповідь: якщо хост відкритий у сусідній вкладці цього браузера, віддаємо йому
  P2P.view='';
  p2pView('wait','Передаємо відповідь хосту…','');
  if(!window.BroadcastChannel){ p2pView('start','Це відповідь для хоста.','Відкрий її на пристрої, де створено гру, або встав у «Мультиплеєр через GitHub».'); return; }
  const bc=new BroadcastChannel('azeroth-p2p'); let ok=false;
  bc.onmessage=e=>{ if(e.data&&e.data.ack){ ok=true; p2pView('wait','Відповідь передано!','Повернись до вкладки з грою — вона вже з\'єднується. Цю можна закрити.'); try{ window.close(); }catch(x){} } };
  bc.postMessage({a:h.slice(3)});
  setTimeout(()=>{ if(!ok){ bc.close(); p2pView('start','Це відповідь для хоста.','Відкрий це посилання в тому ж браузері, де хост створив гру, або встав його в поле «Мультиплеєр через GitHub» на пристрої хоста.'); } },1200);
}
p2pBoot();
