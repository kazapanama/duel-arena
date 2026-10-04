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
  if(!list[i]){ const cv=document.createElement('canvas'); cv.width=w; cv.height=h; list[i]={cv,c:cv.getContext('2d',{willReadFrequently:true})}; }
  return list[i];
}
/* obj: {model, pose, facing, x, y, flash, outline:[r,g,b]?, alpha, time}
   Малює в поточний ctx з його трансформацією (світ → пікселі цілі). */
function drawSprite(obj,out){
  const hd=SPR_HD.ctx&&obj.model&&typeof cutoutKey==='function'&&cutoutKey(obj.model);
  const dst=hd?SPR_HD.ctx:ctx;
  const T=hd?new DOMMatrix().scale(SPR_HD.k).multiply(ctx.getTransform()):ctx.getTransform();
  const s=Math.hypot(T.a,T.b);               // пікселів цілі на світову одиницю
  const B=SPR_BOUNDS;
  const w=Math.ceil((B.R-B.L)*s)+4, h=Math.ceil((B.B-B.T)*s)+4;
  const {cv,c}=sprScratch(w,h);
  c.setTransform(1,0,0,1,0,0); c.clearRect(0,0,w,h);
  const ox=Math.round(-B.L*s)+2, oy=Math.round(-B.T*s)+2;
  c.setTransform(s*obj.facing,0,0,s,ox,oy);
  PU=1/s;
  const lights=[];
  paintModel(c,obj.model,obj.pose,obj.time||0,lights);
  pixelate(c,w,h,obj);
  // корінь моделі → ціле піксельне положення
  const p=T.transformPoint(new DOMPoint(obj.x,obj.y));
  const X=Math.round(p.x)-ox, Y=Math.round(p.y)-oy;
  const g=dst;
  g.save();
  g.setTransform(1,0,0,1,0,0);
  g.imageSmoothingEnabled=false;
  g.globalAlpha=obj.alpha??1;
  g.drawImage(cv,X,Y);
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
  if(out){ const k=hd?SPR_HD.k:1; out.X=X/k; out.Y=Y/k; out.ox=ox/k; out.oy=oy/k; out.s=s/k; }
}

function pixelate(c,w,h,obj){
  const m=obj.model;
  const lut=modelLUT(m);
  const img=c.getImageData(0,0,w,h), d=img.data, n=w*h;
  const mask=new Uint8Array(n);
  const fade=obj.fade??obj.pose.fade, flash=obj.flash||0;
  const thr=fade<1?fade*16:99;
  for(let i=0,j=0;i<n;i++,j+=4){
    if(d[j+3]<96){ d[j+3]=0; continue; }
    if(fade<1){ const x=i%w, y=(i/w)|0; if(BAYER4[((y&3)<<2)|(x&3)]>=thr){ d[j+3]=0; continue; } }
    const key=((d[j]>>3)<<10)|((d[j+1]>>3)<<5)|(d[j+2]>>3);
    let v=lut[key];
    if(v<0){ v=nearestCol(m,d[j],d[j+1],d[j+2]); lut[key]=v; }
    let r=v>>16, g=(v>>8)&255, b=v&255;
    if(flash>0){ r+=(255-r)*flash; g+=(255-g)*flash; b+=(255-b)*flash; }
    d[j]=r; d[j+1]=g; d[j+2]=b; d[j+3]=255; mask[i]=1;
  }
  const oc=obj.outline||m._outline;
  for(let y=0;y<h;y++){
    const row=y*w;
    for(let x=0;x<w;x++){
      const i=row+x;
      if(mask[i]) continue;
      if((x>0&&mask[i-1])||(x<w-1&&mask[i+1])||(y>0&&mask[i-w])||(y<h-1&&mask[i+w])){
        const j=i*4; d[j]=oc[0]; d[j+1]=oc[1]; d[j+2]=oc[2]; d[j+3]=255;
      }
    }
  }
  c.putImageData(img,0,0);
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
