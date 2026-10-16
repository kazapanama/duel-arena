"use strict";
/* ============================================================
   ЛОКАЛЬНИЙ СЕРВЕР «АЗЕРОТ АРЕНИ» — без npm-залежностей.
   Запуск:  node tools/server.js [порт]      (типово 8080)
   - роздає гру всім пристроям у локальній мережі (слухає 0.0.0.0);
   - /ws — гра по мережі на двох: перший, хто зайшов у «Гру по мережі»,
     стає хостом (Гравець 1, обирає арену), другий — гостем (Гравець 2).
     Бій рахує сам сервер (tools/netsim.js) і ~60 разів на секунду шле
     обом знімок; телефони лише малюють і шлють ввід. Вибір бійців
     сервер пересилає від одного гравця іншому.
   ============================================================ */
const http=require('http'), fs=require('fs'), path=require('path'), crypto=require('crypto'), os=require('os'), zlib=require('zlib');
const {createSim}=require('./netsim');
const {createRoom}=require('../js/room');

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

/* ---------- статика ---------- */
// текст стискаємо gzip (код гри ~650 КБ → ~150 КБ); картинки й шрифти вже стиснені. Стиснене тримаємо в пам'яті до зміни файлу
const GZIP=/\.(html|js|css|json|svg|txt|md)$/i, GZ_CACHE=new Map();
const server=http.createServer((req,res)=>{
  let p;
  try{ p=decodeURIComponent(new URL(req.url,'http://x').pathname); }catch(e){ res.writeHead(400); return res.end(); }
  if(p==='/net-info'){ res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({urls:urls()})); }
  if(p.endsWith('/')) p+='index.html';
  const file=path.join(ROOT,path.normalize(p));
  if(!file.startsWith(ROOT)){ res.writeHead(403); return res.end(); }
  fs.stat(file,(err,st)=>{
    if(err||!st.isFile()){ res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}); return res.end('404'); }
    // no-cache + ETag: правки в коді видно після простого оновлення сторінки, а незмінене браузер бере з кешу (304)
    const etag=`W/"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
    const head={'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-cache','ETag':etag};
    if(req.headers['if-none-match']===etag){ res.writeHead(304,head); return res.end(); }
    if(!GZIP.test(file)||!/\bgzip\b/.test(req.headers['accept-encoding']||'')){
      head['Content-Length']=st.size; res.writeHead(200,head);
      if(req.method==='HEAD') return res.end();
      return fs.createReadStream(file).pipe(res);
    }
    head['Content-Encoding']='gzip'; head['Vary']='Accept-Encoding';
    const send=buf=>{ head['Content-Length']=buf.length; res.writeHead(200,head); res.end(req.method==='HEAD'?undefined:buf); };
    const hit=GZ_CACHE.get(file);
    if(hit&&hit.etag===etag) return send(hit.buf);
    fs.readFile(file,(e,data)=>{
      if(e){ res.writeHead(500); return res.end(); }
      zlib.gzip(data,(e2,buf)=>{ if(e2){ res.writeHead(500); return res.end(); } GZ_CACHE.set(file,{etag,buf}); send(buf); });
    });
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
    this.sock=sock; this.buf=Buffer.alloc(0); this.parts=[]; this.side=-1; this.open=true; this.info=sock.remoteAddress;
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
        if(fin){ const msg=Buffer.concat(this.parts).toString('utf8'); this.parts=[]; room.message(this,msg); }
      }
    }
  }
  close(){ this.gone(); }
  gone(){ if(!this.open) return; this.open=false; try{ this.sock.destroy(); }catch(e){} room.leave(this); }
}

/* ---------- кімната на двох і бій на сервері ---------- */
// кімната й цикл бою — js/room.js (ті самі, що у «Мультиплеєрі через GitHub»); сервер лише приймає сокети
const log=m=>console.log(`[${new Date().toLocaleTimeString('uk-UA')}] ${m}`);
let sim=null, room;
try{ sim=createSim(ROOT,w=>room.broadcast({t:'end',w})); }
catch(e){ console.error('Не вдалося завантажити гру для бою на сервері — гра по мережі не працюватиме:',e); }
room=createRoom({sim,log,urls});

server.on('upgrade',(req,sock)=>{
  if(new URL(req.url,'http://x').pathname!=='/ws'){ sock.destroy(); return; }
  const key=req.headers['sec-websocket-key'];
  if(!key){ sock.destroy(); return; }
  const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'+
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  room.join(new Peer(sock));
});

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
