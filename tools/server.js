"use strict";
/* ============================================================
   ЛОКАЛЬНИЙ СЕРВЕР «АЗЕРОТ АРЕНИ» — без npm-залежностей.
   Запуск:  node tools/server.js [порт]      (типово 8080)
   - роздає гру всім пристроям у локальній мережі (слухає 0.0.0.0);
   - /ws — WebSocket-ретранслятор на двох гравців: перший, хто зайшов
     у «Гру по мережі», стає хостом (Гравець 1, рахує бій), другий —
     гостем (Гравець 2). Сервер нічого не рахує, лише пересилає
     повідомлення від одного гравця іншому.
   ============================================================ */
const http=require('http'), fs=require('fs'), path=require('path'), crypto=require('crypto'), os=require('os');

const ROOT=path.resolve(__dirname,'..');
const PORT=+(process.argv[2]||process.env.PORT||8080);
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.gif':'image/gif','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf',
  '.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};

/* адреси комп'ютера в локальній мережі (IPv4, без віртуальних адаптерів, якщо можна) */
function lanAddrs(){
  const out=[];
  for(const [name,list] of Object.entries(os.networkInterfaces())){
    for(const a of list||[]){
      if(a.family!=='IPv4'||a.internal||a.address.startsWith('169.254.')) continue;
      const virt=/vEthernet|VirtualBox|VMware|WSL|Hyper-V|Loopback|docker|Tailscale|ZeroTier/i.test(name);
      out.push({name,addr:a.address,virt});
    }
  }
  out.sort((a,b)=>a.virt-b.virt||(b.addr.startsWith('192.168.')-a.addr.startsWith('192.168.')));
  return out;
}
const urls=()=>lanAddrs().filter(a=>!a.virt).map(a=>`http://${a.addr}:${PORT}`);

/* ---------- обиралка сетів (sets-picker.html): вибір зберігається в tools/picker/picks.json ----------
   Лише з цього комп'ютера — сервер видно в локальній мережі, а писати на диск чужим не можна */
const PICKS=path.join(ROOT,'tools','picker','picks.json');
function picksApi(req,res){
  const local=/^(::1|127\.|::ffff:127\.)/.test(req.socket.remoteAddress||'');
  if(!local){ res.writeHead(403); return res.end(); }
  if(req.method==='GET'){
    fs.readFile(PICKS,'utf8',(err,txt)=>{ res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(err?'null':txt); });
    return;
  }
  if(req.method!=='POST'){ res.writeHead(405); return res.end(); }
  let body='';
  req.on('data',ch=>{ body+=ch; if(body.length>2e6) req.destroy(); });
  req.on('end',()=>{
    try{ JSON.parse(body); }catch(e){ res.writeHead(400); return res.end(); }
    fs.writeFile(PICKS,body,err=>{ res.writeHead(err?500:200); res.end(); });
  });
}

/* ---------- статика ---------- */
const server=http.createServer((req,res)=>{
  let p;
  try{ p=decodeURIComponent(new URL(req.url,'http://x').pathname); }catch(e){ res.writeHead(400); return res.end(); }
  if(p==='/net-info'){ res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({urls:urls()})); }
  if(p==='/api/picks') return picksApi(req,res);
  if(p.endsWith('/')) p+='index.html';
  const file=path.join(ROOT,path.normalize(p));
  if(!file.startsWith(ROOT)){ res.writeHead(403); return res.end(); }
  fs.stat(file,(err,st)=>{
    if(err||!st.isFile()){ res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}); return res.end('404'); }
    res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream',
      'Content-Length':st.size,'Cache-Control':'no-cache'}); // правки в коді видно після простого оновлення сторінки
    if(req.method==='HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
});

/* ---------- мінімальний WebSocket (RFC 6455): лише текстові кадри ---------- */
function frame(str){
  const data=Buffer.from(str,'utf8'), n=data.length;
  let head;
  if(n<126){ head=Buffer.from([0x81,n]); }
  else if(n<65536){ head=Buffer.alloc(4); head[0]=0x81; head[1]=126; head.writeUInt16BE(n,2); }
  else { head=Buffer.alloc(10); head[0]=0x81; head[1]=127; head.writeBigUInt64BE(BigInt(n),2); }
  return Buffer.concat([head,data]);
}
class Peer{
  constructor(sock){
    this.sock=sock; this.buf=Buffer.alloc(0); this.parts=[]; this.side=-1; this.open=true;
    sock.setNoDelay(true); // без затримки Nagle — ввід іде одразу
    sock.on('data',d=>this.onData(d));
    sock.on('close',()=>this.gone());
    sock.on('error',()=>this.gone());
  }
  send(obj){ this.sendRaw(typeof obj==='string'?obj:JSON.stringify(obj)); }
  sendRaw(str){
    if(!this.open) return;
    // повільний клієнт: знімки бою можна пропустити, решту — ні
    if(this.sock.writableLength>512*1024&&str.startsWith('{"t":"s"')) return;
    this.sock.write(frame(str));
  }
  onData(d){
    this.buf=Buffer.concat([this.buf,d]);
    for(;;){
      const b=this.buf; if(b.length<2) return;
      const fin=b[0]&0x80, op=b[0]&0x0f, masked=b[1]&0x80;
      let len=b[1]&0x7f, off=2;
      if(len===126){ if(b.length<4) return; len=b.readUInt16BE(2); off=4; }
      else if(len===127){ if(b.length<10) return; len=Number(b.readBigUInt64BE(2)); off=10; }
      const mOff=off; if(masked) off+=4;
      if(b.length<off+len) return;
      const payload=Buffer.from(b.subarray(off,off+len));
      if(masked) for(let i=0;i<len;i++) payload[i]^=b[mOff+(i&3)];
      this.buf=b.subarray(off+len);
      if(op===0x8){ try{ this.sock.end(Buffer.from([0x88,0])); }catch(e){} this.gone(); return; }
      if(op===0x9){ this.sock.write(Buffer.concat([Buffer.from([0x8a,payload.length]),payload])); continue; } // ping → pong
      if(op===0xA) continue;
      if(op===0x1||op===0x0){
        this.parts.push(payload);
        if(fin){ const msg=Buffer.concat(this.parts).toString('utf8'); this.parts=[]; onMessage(this,msg); }
      }
    }
  }
  gone(){ if(!this.open) return; this.open=false; try{ this.sock.destroy(); }catch(e){} onLeave(this); }
}

/* ---------- кімната на двох ---------- */
const room=[null,null];
const other=p=>room[p.side===0?1:0];
function welcome(p){ p.send({t:'welcome',side:p.side,urls:urls()}); }
function onJoin(p){
  const slot=room[0]?(room[1]?-1:1):0;
  if(slot<0){ p.send({t:'full'}); setTimeout(()=>p.gone(),200); return; }
  p.side=slot; room[slot]=p; welcome(p);
  log(`гравець ${slot+1} підключився (${p.sock.remoteAddress})`);
  if(room[0]&&room[1]){ room[0].send({t:'paired'}); room[1].send({t:'paired'}); log('пара зібрана — бій можна починати'); }
}
function onLeave(p){
  if(p.side<0||room[p.side]!==p) return;
  log(`гравець ${p.side+1} відключився`);
  room[p.side]=null;
  const o=room[0]||room[1];
  if(o){
    // хто лишився — стає хостом і чекає нового суперника
    room[0]=o; room[1]=null; o.side=0;
    o.send({t:'peer-left'}); welcome(o);
  }
}
function onMessage(p,msg){ const o=other(p); if(o) o.sendRaw(msg); }

server.on('upgrade',(req,sock)=>{
  if(new URL(req.url,'http://x').pathname!=='/ws'){ sock.destroy(); return; }
  const key=req.headers['sec-websocket-key'];
  if(!key){ sock.destroy(); return; }
  const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'+
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  onJoin(new Peer(sock));
});

const log=m=>console.log(`[${new Date().toLocaleTimeString('uk-UA')}] ${m}`);
server.on('error',e=>{
  if(e.code==='EADDRINUSE') console.error(`Порт ${PORT} зайнятий. Запусти з іншим: node tools/server.js 8081`);
  else console.error(e);
  process.exit(1);
});
server.listen(PORT,'0.0.0.0',()=>{
  console.log('\n  Азерот Арена — сервер у локальній мережі\n');
  console.log(`  На цьому комп'ютері:  http://localhost:${PORT}`);
  const L=lanAddrs();
  for(const a of L) console.log(`  ${a.virt?'(віртуальний) ':'З телефона:          '}http://${a.addr}:${PORT}   [${a.name}]`);
  if(!L.length) console.log('  Мережевих адрес не знайдено — під\'єднай комп\'ютер до Wi-Fi/LAN.');
  console.log('\n  Телефон має бути в тій самій Wi-Fi мережі. Зупинити — Ctrl+C.\n');
});
