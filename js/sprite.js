"use strict";
/* ============================================================
   ПІКСЕЛЬНИЙ КОНВЕЄР СПРАЙТІВ
   Модель малюється векторно на маленьке полотно в масштабі
   «1 арт-піксель = 1 піксель цілі», потім: поріг альфи → квантизація
   в палітру сету → 1px контур → (спалах / дизер-прозорість).
   Ціль (низькороздільний світ або прев'ю) розтягується nearest-neighbour.
   ============================================================ */
const PIX=2; // логічних пікселів на арт-піксель: бійці ~100 арт-пікселів заввишки — місце для деталей у бою
const BAYER4=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
const SPR_BOUNDS={L:-130,R:130,T:-205,B:45};

// палітра моделі → таблиця швидкого пошуку найближчого кольору (15-біт ключ)
// таблиці спільні для моделей з однаковою палітрою: у меню кожне перемикання бійця створює нову модель того ж скіну
const LUT_CACHE=new Map();
const lutSig=m=>(m._cutPal?'F':'L')+[...new Set(Object.values(m.pal))].join('');
function modelLUT(m){
  if(m._lut) return m._lut;
  const cols=[...new Set(Object.values(m.pal))].map(hexToRgb);
  m._cols=cols;
  m._outline=hexToRgb(m.pal.outline);
  const sig=lutSig(m), hit=LUT_CACHE.get(sig);
  if(hit) return m._lut=hit;
  // растрові деталі мають плавні переходи: щокадру з'являються нові відтінки й лінива таблиця весь час добудовується
  // (перебір ~120 кольорів на піксель, ~15 мс на бійця) — тож для них рахуємо всю таблицю одразу (~10 мс)
  if(m._cutPal){ const b=lutBuilder(cols); b.step(32); m._lut=b.lut; } else m._lut=new Int32Array(32768).fill(-1);
  LUT_CACHE.set(sig,m._lut);
  return m._lut;
}
// уся таблиця 32×32×32 → найближчий колір палітри (та сама метрика, що й nearestCol). Будується зрізами за G —
// step(n) додає n зрізів (прогрів меню розтягує побудову на кілька вільних проміжків, ui.js selPrewarm).
// Палітра відсортована за G (найбільша вага): від найближчого за G кольору йдемо вгору й униз, доки сама різниця G
// не перевищить найкращу відстань
function lutBuilder(cols){
  const n=cols.length, ord=cols.map((c,i)=>i).sort((a,b)=>cols[a][1]-cols[b][1]);
  const R=new Float64Array(n), G=new Float64Array(n), B=new Float64Array(n), P=new Int32Array(n);
  ord.forEach((k,i)=>{ const c=cols[k]; R[i]=c[0]; G[i]=c[1]; B[i]=c[2]; P[i]=(c[0]<<16)|(c[1]<<8)|c[2]; });
  const lut=new Int32Array(32768); let gi=0;
  return {lut, done:()=>gi>=32, step(k){
    for(const end=Math.min(32,gi+k);gi<end;gi++){ const g=(gi<<3)|4;
      let p0=0; while(p0<n-1&&G[p0]<g) p0++;                 // перший колір з G ≥ g
      for(let ri=0;ri<32;ri++){ const r=(ri<<3)|4;
        for(let bi=0;bi<32;bi++){ const b=(bi<<3)|4;
          let best=p0, bd=1e18;
          for(let i=p0;i<n;i++){ const dg=G[i]-g, dg2=dg*dg*0.59; if(dg2>=bd) break;
            const dr=R[i]-r, db=B[i]-b, d=dr*dr*0.3+dg2+db*db*0.11; if(d<bd){ bd=d; best=i; } }
          for(let i=p0-1;i>=0;i--){ const dg=G[i]-g, dg2=dg*dg*0.59; if(dg2>=bd) break;
            const dr=R[i]-r, db=B[i]-b, d=dr*dr*0.3+dg2+db*db*0.11; if(d<bd){ bd=d; best=i; } }
          lut[(ri<<10)|(gi<<5)|bi]=P[best];
        } } }
    return gi>=32; }};
}
function nearestCol(m,r,g,b){
  let best=0, bd=1e9;
  const cols=m._cols;
  for(let i=0;i<cols.length;i++){
    const c=cols[i], dr=c[0]-r, dg=c[1]-g, db=c[2]-b;
    const d=dr*dr*0.3+dg*dg*0.59+db*db*0.11;
    if(d<bd){ bd=d; best=i; }
  }
  const c=cols[best];
  return (c[0]<<16)|(c[1]<<8)|c[2];
}

/* Бійці з растрових деталей мають удвічі дрібніший арт-піксель (≈160 замість 80 по висоті): якщо задано
   SPR_HD.ctx — шар у k разів більшої роздільності за поточну ціль, — такий спрайт малюється туди
   (бій: шар 1280×720 між світом і ефектами, game.js; вітрини меню: PixelView.hd, ui.js) */
const SPR_HD={ctx:null,k:2};
/* Чернетки для спрайтів — пул полотен за розміром. Раніше кожен об'єкт мав власне полотно: у меню кожне перемикання
   бійця створювало нове, і перше getImageData на свіжому willReadFrequently-полотні коштувало до ~100 мс (виділення
   буфера) — помітний ривок. Одне спільне полотно на всіх теж погано: після drawImage у ціль наступне читання з нього
   чекає синхронізації. Тож у межах кадру (поточного завдання) кожен виклик бере наступне полотно свого розміру;
   порядок малювання стабільний — та сама вітрина щокадру отримує те саме полотно. */
const SPR_POOL=new Map(); let sprUsed=null;
function sprScratch(w,h){
  if(!sprUsed){ sprUsed=new Map(); queueMicrotask(()=>{ sprUsed=null; }); }   // кінець кадру — пул знову з початку
  const key=w*4096+h, i=sprUsed.get(key)||0; sprUsed.set(key,i+1);
  let list=SPR_POOL.get(key);
  if(!list){ if(SPR_POOL.size>=16) SPR_POOL.delete(SPR_POOL.keys().next().value); SPR_POOL.set(key,list=[]); }   // розмірів небагато (масштаби вітрин і бою)
  if(!list[i]){ const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
    list[i]={cv,c:cv.getContext('2d',SPR_GL?undefined:{willReadFrequently:true})}; }   // для WebGL — звичайне (GPU) полотно
  return list[i];
}
/* obj: {model, pose, facing, x, y, flash, outline:[r,g,b]?, alpha, time}
   Малює в поточний ctx з його трансформацією (світ → пікселі цілі). */
function drawSprite(obj,out){
  if(typeof cutoutPending==='function'&&cutoutPending(obj.model)){ if(out) out.cv=null; return; }   // деталі ще вантажаться — не підміняти процедурною моделлю
  const hd=SPR_HD.ctx&&obj.model&&typeof cutoutKey==='function'&&cutoutKey(obj.model);
  const dst=hd?SPR_HD.ctx:ctx;
  const T=hd?new DOMMatrix().scale(SPR_HD.k).multiply(ctx.getTransform()):ctx.getTransform();
  const s=Math.hypot(T.a,T.b);               // пікселів цілі на світову одиницю
  const B=SPR_BOUNDS;
  // розмір чернетки — з кроком 32: камера плавно зумить, і точний розмір щокадру давав нове полотно (а перший запис
  // у свіже полотно дорогий — виділення пам'яті); зайві поля по краях порожні й не читаються (pixelate читає рамку бійця)
  const w=Math.ceil((Math.ceil((B.R-B.L)*s)+4)/32)*32, h=Math.ceil((Math.ceil((B.B-B.T)*s)+4)/32)*32;
  const {cv,c}=sprScratch(w,h);
  c.setTransform(1,0,0,1,0,0); c.clearRect(0,0,w,h);
  const ox=Math.round(-B.L*s)+2, oy=Math.round(-B.T*s)+2;
  c.setTransform(s*obj.facing,0,0,s,ox,oy);
  PU=1/s;
  const lights=[];
  paintModel(c,obj.model,obj.pose,obj.time||0,lights);
  const spr=SPR_GL?glPixelate(cv,w,h,obj):(pixelate(c,w,h,obj,ox,oy,s),cv);
  // корінь моделі → ціле піксельне положення
  const p=T.transformPoint(new DOMPoint(obj.x,obj.y));
  const X=Math.round(p.x)-ox, Y=Math.round(p.y)-oy;
  const g=dst;
  g.save();
  g.setTransform(1,0,0,1,0,0);
  g.imageSmoothingEnabled=false;
  g.globalAlpha=obj.alpha??1;
  g.drawImage(spr,X,Y);
  // світіння — адитивно поверх спрайта
  g.globalCompositeOperation='lighter';
  const la=obj.fade??obj.pose.fade;
  for(const L of lights){
    const r=Math.max(2,L.r), gx=X+L.x, gy=Y+L.y;
    if(!isFinite(r+gx+gy)) continue;
    const gr=g.createRadialGradient(gx,gy,0,gx,gy,r);
    gr.addColorStop(0,L.col); gr.addColorStop(1,'rgba(0,0,0,0)');
    g.globalAlpha=0.4*L.a*la*(obj.alpha??1); // м'якше світіння — спрайт лишається чітким
    g.fillStyle=gr; g.fillRect(gx-r,gy-r,r*2,r*2);
  }
  g.restore();
  // out — у координатах поточного ctx (для HD-спрайта перераховуємо назад)
  if(out){ const k=hd?SPR_HD.k:1; out.X=X/k; out.Y=Y/k; out.ox=ox/k; out.oy=oy/k; out.s=s/k;
    out.cv=spr; out.dst=dst; out.dX=X; out.dY=Y; out.ds=s; }   // готовий спрайт і його місце в цілі — для копій (Mirror Image)
}

/* Боєць займає ~15% чернетки (решта — запас під замахи), а getImageData — найдорожче тут після растеризації,
   ще й щоразу виділяє новий буфер (сміття для збирача). Тож читаємо лише рамку бійця з минулого кадру із запасом
   (m._sprBB — у координатах моделі, без масштабу й розвороту). Деталі моделі суцільні: якщо боєць виріс за рамку,
   на її краю є намальовані пікселі — тоді, як і для порожньої рамки, читаємо всю чернетку */
const SPR_PAD=12;   // запас рамки, світових одиниць: стільки модель може зрушити за кадр без повторного читання
function pixelate(c,w,h,obj,ox,oy,s){
  const m=obj.model, bb=m._sprBB, k=s*obj.facing;
  c.setTransform(1,0,0,1,0,0);
  let rx=0, ry=0, rw=w, rh=h, img=null, q=null;
  if(bb){
    const pad=Math.ceil(SPR_PAD*s)+2, xa=ox+bb[0]*k, xb=ox+bb[2]*k;
    rx=Math.max(0,Math.floor(Math.min(xa,xb))-pad); ry=Math.max(0,Math.floor(oy+bb[1]*s)-pad);
    rw=Math.min(w,Math.ceil(Math.max(xa,xb))+pad)-rx; rh=Math.min(h,Math.ceil(oy+bb[3]*s)+pad)-ry;
    if(rw>0&&rh>0){
      img=c.getImageData(rx,ry,rw,rh);
      if(!edgeHit(new Uint32Array(img.data.buffer),rw,rh,rx>0,ry>0,rx+rw<w,ry+rh<h)) q=pixQuant(img,rx,ry,obj);
    }
  }
  if(!q&&(!img||rw<w||rh<h)){ rx=0; ry=0; rw=w; rh=h; img=c.getImageData(0,0,w,h); q=pixQuant(img,0,0,obj); }
  c.clearRect(0,0,w,h);   // напівпрозора облямівка за межами бійця теж зникає
  if(!q){ m._sprBB=null; return; }
  const [x0,y0,x1,y1]=q, ax=(rx+x0-ox)/k, bx=(rx+x1+1-ox)/k;
  m._sprBB=[Math.min(ax,bx),(ry+y0-oy)/s,Math.max(ax,bx),(ry+y1+1-oy)/s];
  // контур займає ще піксель довкола
  const qx0=Math.max(0,x0-1), qy0=Math.max(0,y0-1);
  c.putImageData(img,rx,ry,qx0,qy0,Math.min(rw-1,x1+1)-qx0+1,Math.min(rh-1,y1+1)-qy0+1);
}
// чи є намальоване на краях рамки (лише тих, що не збігаються з краями чернетки)
function edgeHit(px,w,h,L,T,R,B){
  const n=w*h;
  if(T) for(let i=0;i<w;i++) if(px[i]) return true;
  if(B) for(let i=n-w;i<n;i++) if(px[i]) return true;
  if(L) for(let i=0;i<n;i+=w) if(px[i]) return true;
  if(R) for(let i=w-1;i<n;i+=w) if(px[i]) return true;
  return false;
}
/* Поріг альфи, квантизація й контур у буфері img (його лівий верхній кут — (rx,ry) у чернетці).
   Пікселі — словами Uint32 (0xAABBGGRR: порядок байтів little-endian, як на всіх ARM і x86).
   Повертає рамку непрозорих пікселів [x0,y0,x1,y1] у координатах буфера або null, якщо їх нема.
   Маска — спільний буфер: нова на кожен спрайт щокадру давала зайву роботу збирачу сміття */
let PX_MASK=new Uint8Array(0);
const LUT32=new WeakMap();   // таблиця кольорів моделі → ті самі кольори готовими словами з альфою 255
function pixQuant(img,rx,ry,obj){
  const m=obj.model, lut=modelLUT(m);
  let l32=LUT32.get(lut); if(!l32){ l32=new Uint32Array(32768); LUT32.set(lut,l32); }   // 0 — ще не пораховано
  const w=img.width, h=img.height, px=new Uint32Array(img.data.buffer), n=w*h;
  if(PX_MASK.length<n) PX_MASK=new Uint8Array(n); else PX_MASK.fill(0,0,n);
  const mask=PX_MASK;
  const fade=obj.fade??obj.pose.fade, flash=obj.flash||0;
  const dith=fade<1, thr=fade*16;
  let x0=w, x1=-1, y0=h, y1=-1;
  for(let y=0,i=0;y<h;y++){
    const by=((y+ry)&3)<<2;   // візерунок дизеру — у координатах чернетки, щоб не «плив» разом із рамкою
    for(let x=0;x<w;x++,i++){
      const p=px[i];
      if(p>>>24<96||(dith&&BAYER4[by|((x+rx)&3)]>=thr)){ px[i]=0; continue; }
      const r=p&255, g=(p>>8)&255, b=(p>>16)&255, key=((r>>3)<<10)|((g>>3)<<5)|(b>>3);
      let v=l32[key];
      if(!v){ let col=lut[key]; if(col<0){ col=nearestCol(m,r,g,b); lut[key]=col; }
        v=l32[key]=(0xff000000|((col&255)<<16)|(col&0xff00)|((col>>16)&255))>>>0; }
      if(flash>0){ const R=v&255, G=(v>>8)&255, B=(v>>16)&255;
        v=(0xff000000|(Math.round(B+(255-B)*flash)<<16)|(Math.round(G+(255-G)*flash)<<8)|Math.round(R+(255-R)*flash))>>>0; }
      px[i]=v; mask[i]=1;
      if(x<x0) x0=x; if(x>x1) x1=x; if(y0===h) y0=y; y1=y;
    }
  }
  if(x1<0) return null;
  // контур: прозорі пікселі поруч із непрозорими — лише в рамці бійця +1 піксель
  const oc=obj.outline||m._outline, ov=(0xff000000|(oc[2]<<16)|(oc[1]<<8)|oc[0])>>>0;
  for(let y=Math.max(0,y0-1),ye=Math.min(h-1,y1+1);y<=ye;y++){
    const row=y*w;
    for(let x=Math.max(0,x0-1),xe=Math.min(w-1,x1+1);x<=xe;x++){
      const i=row+x;
      if(mask[i]) continue;
      if((x>0&&mask[i-1])||(x<w-1&&mask[i+1])||(y>0&&mask[i-w])||(y<h-1&&mask[i+w])) px[i]=ov;
    }
  }
  return [x0,y0,x1,y1];
}

/* ---------- низькороздільний шар світу (640×360 → ×2) ---------- */
const LOW={cv:document.createElement('canvas')};
LOW.cv.width=Math.ceil(W/PIX); LOW.cv.height=Math.ceil(H/PIX);
LOW.ctx=LOW.cv.getContext('2d');
// бій: бійці з растрових деталей — у шарі повної роздільності, ефекти після них — у ще одному низькому шарі поверх (game.js)
const HDL={cv:document.createElement('canvas')};
HDL.cv.width=W; HDL.cv.height=H; HDL.ctx=HDL.cv.getContext('2d');
const POST={cv:document.createElement('canvas')};
POST.cv.width=LOW.cv.width; POST.cv.height=LOW.cv.height; POST.ctx=POST.cv.getContext('2d');

/* ---------- те саме на відеокарті (WebGL2) ----------
   Деталі малює звичайне (GPU) 2D-полотно, а поріг альфи, палітру, дизер, спалах і контур рахує шейдер; результат
   іде в ціль напряму, без getImageData. На телефонах з Android растеризація й попіксельна обробка на CPU — головна
   вартість кадру, а зчитування з GPU ще й зупиняє конвеєр. Safari (iOS) лишається на CPU-шляху: там він швидкий,
   а передачу 2D-полотна в WebGL WebKit робить не завжди без копії. ?gl=1 / ?gl=0 — примусово увімкнути / вимкнути */
const SPR_GL=(()=>{
  const q=typeof location!=='undefined'&&/[?&]gl=([01])/.exec(location.search||'');
  const want=q?q[1]==='1':(typeof navigator!=='undefined'&&/Chrome\/|Firefox\//.test(navigator.userAgent));
  if(!want||typeof document==='undefined') return null;
  // OffscreenCanvas: готовий кадр забираємо transferToImageBitmap — без копії буфера (звичайне полотно копіювалося б
  // при кожному drawImage у ціль, ~0.5 мс на спрайт)
  const off=typeof OffscreenCanvas!=='undefined'&&typeof OffscreenCanvas.prototype.transferToImageBitmap==='function';
  const cv=off?new OffscreenCanvas(1,1):document.createElement('canvas');
  const gl=cv.getContext('webgl2',{premultipliedAlpha:true,preserveDrawingBuffer:!off,antialias:false,depth:false,stencil:false});
  if(!gl) return null;
  const sh=(type,src)=>{ const o=gl.createShader(type); gl.shaderSource(o,src); gl.compileShader(o);
    if(!gl.getShaderParameter(o,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  let prog;
  try{
    prog=gl.createProgram();
    gl.attachShader(prog,sh(gl.VERTEX_SHADER,`#version 300 es
in vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }`));
    // src — чернетка (рядок 0 — верх), lut — 1024×32: x=(g5<<5)|b5, y=r5. Пікселі з альфою < 96 і вибиті дизером — прозорі,
    // прозорий поруч із непрозорим — контур. Дизер — у координатах чернетки, як у pixQuant
    gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,`#version 300 es
precision highp float; precision highp int;
uniform sampler2D src, lut; uniform vec3 oc; uniform float flash, thr; uniform int dith, top; uniform ivec2 size;
out vec4 o;
const int B[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
bool on(ivec2 q){
  if(q.x<0||q.y<0||q.x>=size.x||q.y>=size.y) return false;
  if(texelFetch(src,q,0).a*255.<95.5) return false;
  return dith==0||float(B[((q.y&3)<<2)|(q.x&3)])<thr;
}
void main(){
  ivec2 q=ivec2(int(gl_FragCoord.x),top-1-int(gl_FragCoord.y));   // рядок 0 — верх полотна
  if(on(q)){
    ivec3 k=ivec3(floor(texelFetch(src,q,0).rgb*255.+.5))>>3;
    vec3 v=texelFetch(lut,ivec2((k.g<<5)|k.b,k.r),0).rgb;
    o=vec4(v+(1.-v)*flash,1.);
  } else if(on(q+ivec2(1,0))||on(q-ivec2(1,0))||on(q+ivec2(0,1))||on(q-ivec2(0,1))) o=vec4(oc,1.);
  else o=vec4(0.);
}`));
    gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  }catch(e){ console.warn('WebGL-спрайти недоступні, працює CPU-шлях',e); return null; }
  gl.useProgram(prog);
  const buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);   // один трикутник на весь екран
  const loc=gl.getAttribLocation(prog,'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  const U={}; for(const n of ['src','lut','oc','flash','thr','dith','top','size']) U[n]=gl.getUniformLocation(prog,n);
  gl.uniform1i(U.src,0); gl.uniform1i(U.lut,1);
  const tex=()=>{ const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
    for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D,k,v);
    return t; };
  gl.activeTexture(gl.TEXTURE0); const srcTex=tex();
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  return {cv,gl,U,srcTex,tex,luts:new WeakMap(),off,bm:null};
})();
// повна таблиця кольорів (шейдеру потрібні всі 32768 клітинок; лінива таблиця процедурних моделей добудовується на CPU)
const LUT_FULL=new Map();
function fullLUT(m){
  const lut=modelLUT(m);
  if(m._cutPal) return lut;
  const sig=lutSig(m); let f=LUT_FULL.get(sig);
  if(!f){ const b=lutBuilder(m._cols); b.step(32); f=b.lut; LUT_FULL.set(sig,f); }
  return f;
}
function glPixelate(cv,w,h,obj){
  const G=SPR_GL, gl=G.gl, m=obj.model, lut=fullLUT(m);
  // полотно лише росте: у бойця, пета й вітрин різні розміри, і зміна розміру щоразу перевиділяла б буфер.
  // Спрайт — у лівому верхньому куті, решта прозора (її бачать копії Mirror Image, що малюють полотно цілим)
  if(G.cv.width<w||G.cv.height<h){ G.cv.width=Math.max(w,G.cv.width); G.cv.height=Math.max(h,G.cv.height); }
  const H=G.cv.height;
  gl.viewport(0,0,G.cv.width,H); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.viewport(0,H-h,w,h); gl.uniform1i(G.U.top,H);
  gl.activeTexture(gl.TEXTURE1);
  let lt=G.luts.get(lut);
  if(!lt){ lt=G.tex(); const d=new Uint8Array(32768*4);
    for(let i=0;i<32768;i++){ const c=lut[i]; d[i*4]=c>>16&255; d[i*4+1]=c>>8&255; d[i*4+2]=c&255; d[i*4+3]=255; }
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1024,32,0,gl.RGBA,gl.UNSIGNED_BYTE,d); G.luts.set(lut,lt); }
  else gl.bindTexture(gl.TEXTURE_2D,lt);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,G.srcTex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,cv);
  const fade=obj.fade??obj.pose.fade, oc=obj.outline||m._outline;
  gl.uniform3f(G.U.oc,oc[0]/255,oc[1]/255,oc[2]/255);
  gl.uniform1f(G.U.flash,obj.flash||0); gl.uniform1i(G.U.dith,fade<1?1:0); gl.uniform1f(G.U.thr,fade*16);
  gl.uniform2i(G.U.size,w,h);
  gl.drawArrays(gl.TRIANGLES,0,3);
  if(!G.off) return G.cv;
  if(G.bm) G.bm.close();   // попередній кадр уже записаний у ціль (і в копії Mirror Image) — звільняємо пам'ять відеокарти
  return G.bm=G.cv.transferToImageBitmap();
}
