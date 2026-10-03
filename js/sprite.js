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
function modelLUT(m){
  if(m._lut) return m._lut;
  const cols=[...new Set(Object.values(m.pal))].map(hexToRgb);
  m._cols=cols;
  m._lut=new Int32Array(32768).fill(-1);
  m._outline=hexToRgb(m.pal.outline);
  // растрові деталі мають плавні переходи: щокадру з'являються нові відтінки й лінива таблиця весь час добудовується
  // (перебір ~120 кольорів на піксель, ~15 мс на бійця) — тож для них рахуємо всю таблицю одразу (~20 мс раз на модель)
  if(m._cutPal){ const lut=m._lut; for(let k=0;k<32768;k++) lut[k]=nearestCol(m,((k>>10)<<3)|4,(((k>>5)&31)<<3)|4,((k&31)<<3)|4); }
  return m._lut;
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
/* obj: {model, pose, facing, x, y, flash, outline:[r,g,b]?, alpha, time}
   Малює в поточний ctx з його трансформацією (світ → пікселі цілі). */
function drawSprite(obj,out){
  const hd=SPR_HD.ctx&&obj.model&&typeof cutoutKey==='function'&&cutoutKey(obj.model);
  const dst=hd?SPR_HD.ctx:ctx;
  const T=hd?new DOMMatrix().scale(SPR_HD.k).multiply(ctx.getTransform()):ctx.getTransform();
  const s=Math.hypot(T.a,T.b);               // пікселів цілі на світову одиницю
  const B=SPR_BOUNDS;
  const w=Math.ceil((B.R-B.L)*s)+4, h=Math.ceil((B.B-B.T)*s)+4;
  let cv=obj._cv;
  if(!cv||cv.width!==w||cv.height!==h){
    cv=obj._cv=document.createElement('canvas'); cv.width=w; cv.height=h;
    obj._cx=cv.getContext('2d',{willReadFrequently:true});
  }
  const c=obj._cx;
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
