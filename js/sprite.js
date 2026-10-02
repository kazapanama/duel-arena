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

/* obj: {model, pose, facing, x, y, flash, outline:[r,g,b]?, alpha, time}
   Малює в поточний ctx з його трансформацією (світ → пікселі цілі). */
function drawSprite(obj,out){
  const T=ctx.getTransform();
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
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.imageSmoothingEnabled=false;
  ctx.globalAlpha=obj.alpha??1;
  ctx.drawImage(cv,X,Y);
  // світіння — адитивно поверх спрайта
  ctx.globalCompositeOperation='lighter';
  const la=obj.fade??obj.pose.fade;
  for(const L of lights){
    const r=Math.max(2,L.r), gx=X+L.x, gy=Y+L.y;
    if(!isFinite(r+gx+gy)) continue;
    const gr=ctx.createRadialGradient(gx,gy,0,gx,gy,r);
    gr.addColorStop(0,L.col); gr.addColorStop(1,'rgba(0,0,0,0)');
    ctx.globalAlpha=0.4*L.a*la*(obj.alpha??1); // м'якше світіння — спрайт лишається чітким
    ctx.fillStyle=gr; ctx.fillRect(gx-r,gy-r,r*2,r*2);
  }
  ctx.restore();
  if(out){ out.X=X; out.Y=Y; out.ox=ox; out.oy=oy; out.s=s; }
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
