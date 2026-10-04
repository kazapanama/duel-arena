"use strict";
/* ============================================================
   БІЙЦІ З РАСТРОВИХ ДЕТАЛЕЙ
   Кожен скін (skin.cutout у SPEC_SKINS) — набір деталей, нарізаних з аркуша
   GPT (tools/setsheets: gen.py → assemble.py) і запакованих у img/cutout/<id>.js.
   Набір вантажиться, коли скін уперше потрібен; доки не готовий — малюється
   процедурна модель. Кожна деталь кріпиться до кісток рига двома точками
   «пікселі PNG → кістка» (CUTOUT_AUTO), тож усі анімації працюють без змін.
   Риг для таких бійців — у напівоберті 3/4 (так намальовані деталі).
   ?cutout=off — показати процедурну модель (для порівняння).
   ============================================================ */
const CUTOUT_OFF=typeof location!=='undefined'&&/[?&]cutout=off(?![\w])/.test(location.search||'');

const CUTOUT_IMGS={}, CUTOUT_LOAD={};
// набір деталей вантажиться скриптом (а не fetch): так працює й через file://
function cutoutRequest(name){
  if(typeof CUTOUT_IMG!=='undefined'&&CUTOUT_IMG[name]) return true;
  if(CUTOUT_LOAD[name]||typeof document==='undefined') return false;
  CUTOUT_LOAD[name]=1;
  const s=document.createElement('script'); s.src='img/cutout/'+name+'.js';
  s.onload=()=>cutoutImgs(name);
  s.onerror=()=>{ CUTOUT_LOAD[name]='err'; console.warn('немає набору деталей',name); };
  document.head.appendChild(s);
  return false;
}
// деталь у пакунку зменшена (pack_cutout.py) — малюємо її в оригінальних піксельних координатах аркуша.
// Дальні кінцівки — затемнена копія, зроблена один раз (canvas filter щокадру на програмному полотні коштує ~9 мс на бійця)
let CUT_DIM=false;
function dimOf(img){
  if(img._dim) return img._dim;
  const cv=document.createElement('canvas'); cv.width=img.width; cv.height=img.height;
  const g=cv.getContext('2d'); g.filter='brightness(0.8)'; g.drawImage(img,0,0);
  return img._dim=cv;
}
function cutDraw(c,img){ const [k,pad]=img._k||[1,0]; c.drawImage(CUT_DIM?dimOf(img):img,-pad,-pad,img.width*k,img.height*k); }
// після завантаження кожна картинка копіюється в полотно — уже розкодовані пікселі (усі набори разом ~21 МБ):
// інакше браузер витісняє розкодовані PNG зі свого кешу й перерозкодовує їх під час растеризації спрайта,
// і в кадрах після зміни бійця в меню вітрини малювалися в кілька разів довше
const CUTOUT_DONE={};
function cutoutImgs(name){
  if(CUTOUT_IMGS[name]) return CUTOUT_IMGS[name];
  const src=(typeof CUTOUT_IMG!=='undefined')&&CUTOUT_IMG[name];
  if(!src) return null;
  const set={}; let left=0;
  for(const k in src){ const im=new Image(); left++;
    const sc=(typeof CUTOUT_SCALE!=='undefined'&&CUTOUT_SCALE[name]&&CUTOUT_SCALE[name][k])||[1,0];
    im.onload=()=>{
      const cv=document.createElement('canvas'); cv.width=im.naturalWidth; cv.height=im.naturalHeight;
      cv.getContext('2d',{willReadFrequently:true}).drawImage(im,0,0); cv._k=sc; set[k]=cv;   // willReadFrequently — полотно в пам'яті, без GPU
      if(--left===0){ CUTOUT_DONE[name]=true; if(typeof onCutoutReady==='function') onCutoutReady(name); }   // галерея перемальовується
    };
    im.src=src[k]; set[k]=im; }
  return CUTOUT_IMGS[name]=set;
}
const cutDef=name=>(typeof CUTOUT_AUTO!=='undefined'&&CUTOUT_AUTO[name])||null;
function cutoutReady(name){
  return !!(cutoutImgs(name)&&CUTOUT_DONE[name]&&cutDef(name));
}
// набір деталей моделі, якщо він уже готовий (і заодно — кольори деталей у палітру квантизації)
function cutoutKey(m){
  const k=m&&m.cutout;
  if(!k||CUTOUT_OFF||typeof k!=='string'||!cutoutRequest(k)||!cutoutReady(k)) return null;
  if(m._cutPal!==k){
    const pal=typeof CUTOUT_PAL!=='undefined'&&CUTOUT_PAL[k];
    if(pal) pal.forEach((col,i)=>{ m.pal['cut'+i]=col; });
    m._cutPal=k; m._lut=null;    // таблицю найближчих кольорів перебудувати з новою палітрою
  }
  return k;
}

// точку sA зображення кладемо в A, sB — у B; поперек кістки масштаб k (null — такий самий, як уздовж)
function cutPiece(c,img,sA,sB,A,B,k,clip){
  const sdx=sB[0]-sA[0], sdy=sB[1]-sA[1], sl=Math.hypot(sdx,sdy)||1;
  const dx=B.x-A.x, dy=B.y-A.y, L=Math.hypot(dx,dy)||1;
  c.save();
  c.translate(A.x,A.y); c.rotate(Math.atan2(dy,dx)); c.scale(L/sl,k==null?L/sl:k); c.rotate(-Math.atan2(sdy,sdx)); c.translate(-sA[0],-sA[1]);
  if(clip){ c.beginPath(); c.rect(clip[0],clip[1],clip[2]-clip[0],clip[3]-clip[1]); c.clip(); }
  cutDraw(c,img);
  c.restore();
}
// та сама мапа для точки (світло на світне ядро чи очі)
function cutMap(sA,sB,A,B,pt){
  const sdx=sB[0]-sA[0], sdy=sB[1]-sA[1], sl=Math.hypot(sdx,sdy)||1, dx=B.x-A.x, dy=B.y-A.y, L=Math.hypot(dx,dy)||1;
  const a1=Math.atan2(sdy,sdx), a2=Math.atan2(dy,dx), px=pt[0]-sA[0], py=pt[1]-sA[1];
  const u=(px*Math.cos(-a1)-py*Math.sin(-a1))*L/sl, v=(px*Math.sin(-a1)+py*Math.cos(-a1))*L/sl;
  return {x:A.x+u*Math.cos(a2)-v*Math.sin(a2), y:A.y+u*Math.sin(a2)+v*Math.cos(a2)};
}
const P2=(a)=>({x:a[0],y:a[1]});

function paintCutout(P){
  const {c,S}=P;
  const D=cutDef(P.ck), I=cutoutImgs(P.ck);
  c.imageSmoothingEnabled=true; c.imageSmoothingQuality='low';
  if(BULK_LAYOUT[D.kind]) return paintBulkCutout(P);   // сова, дерево, інфернал
  if(D.whole&&I.full) return paintWhole(P,D.whole,I.full);   // деталі вже зменшені пакувальником — білінійного досить, а вище коштує ~2 мс на бійця
  const dim=on=>{ CUT_DIM=on; };   // дальні кінцівки — у тіні
  if(I.cape&&D.cape) cutCape(P,D,I);
  // одноручна зброя в дальній руці (щит+зброя, дві зброї) має бути перед тілом — таку руку малюємо поверх тулуба
  const wb=handWeapon(D,I,'b'), farFront=!!(wb&&wb.def.t!=='shield'&&wb.def.t!=='pistol'&&wb.def.t!=='bow');
  dim(true); if(!farFront) cutArm(P,D,I,'b'); cutShoulder(P,D,I,'b'); cutLeg(P,D,I,'b'); dim(false);
  cutLeg(P,D,I,'f');
  // низ броні й тулуб — у системі таза, нахилені разом із торсом
  c.save(); c.translate(S.pel.x,S.pel.y); c.rotate(S.lean);
  const L=D.lower; if(L&&I.lower) cutPiece(c,I.lower,L.top,L.bot,P2(L.to[0]),P2(L.to[1]),null);
  const T=D.torso; if(T&&I.torso){
    cutPiece(c,I.torso,T.neck,T.bot,P2(T.to[0]),P2(T.to[1]),null);
    if(T.core){ const q=cutMap(T.neck,T.bot,P2(T.to[0]),P2(T.to[1]),T.core); addLight(P,q.x,q.y,14,P.pal.acc,0.85); }
  }
  c.restore();
  // шолом — у системі голови
  const hd=S.head, H=D.helm;
  if(H&&I.helm){
    c.save(); c.translate(hd.x,hd.y); c.rotate(hd.a);
    cutPiece(c,I.helm,H.c,H.top,P2(H.to[0]),P2(H.to[1]),null);
    if(H.eye){ const q=cutMap(H.c,H.top,P2(H.to[0]),P2(H.to[1]),H.eye); addLight(P,q.x,q.y,9,P.pal.eye,0.9); }
    c.restore();
  }
  if(farFront){ dim(true); cutArm(P,D,I,'b'); dim(false); }
  cutArm(P,D,I,'f'); cutShoulder(P,D,I,'f');
}
// що в якій руці: щит — на ближній руці перед тілом (як у стійці shield), інакше основна зброя — у ближній, друга — у дальній
function handWeapon(D,I,side){
  const w1=D.weapon&&I.weapon?{img:I.weapon,def:D.weapon}:null, w2=D.weapon2&&I.weapon2?{img:I.weapon2,def:D.weapon2}:null;
  if(w2&&w2.def.t==='shield') return side==='f'?w2:w1;
  return side==='f'?w1:w2;
}
function cutArm(P,D,I,side){
  const {c,S,p}=P, A=D.arm, d=side==='b';
  const sh=d?S.shB:S.shF, el=d?S.elB:S.elF, hd=d?S.handB:S.handF;
  const ang=d?p.wb:p.wf, w=handWeapon(D,I,side);
  if(A&&I.arm) cutPiece(c,I.arm,A.sh,A.el,sh,el,A.k,[-999,-999,999,A.cut+6]);
  if(w&&w.def.t!=='shield') drawCutWeapon(P,w,hd,ang);
  if(A&&I.arm) cutPiece(c,I.arm,A.el,A.hand,el,hd,A.k,[-999,A.cut-6,999,999]);   // передпліччя з кулаком — поверх руків'я
  if(w&&w.def.t==='shield'){ // щит на кисті, трохи нахилений за кутом руки (як drawShield)
    const W=w.def, k=44/W.h;
    c.save(); c.translate(hd.x+2,hd.y-1); c.rotate(ang*0.25); c.scale(k,k); c.translate(-W.c[0],-W.c[1]); cutDraw(c,w.img); c.restore();
  }
}
// зброя в системі кисті: руків'я й вістря — у ті ж точки, що й у процедурної зброї (pack_cutout.py WEAPON_AXIS)
function drawCutWeapon(P,w,hd,ang){
  const {c,p,S}=P, W=w.def;
  c.save(); c.translate(hd.x,hd.y); c.rotate(ang);
  cutPiece(c,w.img,W.pommel,W.head,P2(W.to[0]),P2(W.to[1]),null);
  if(W.t==='bow'){ // тятива від кінців лука до задньої кисті, коли натягнута, і стріла
    const pull=p.bow||0; let sx=-3, sy=0;
    if(pull>0.05){
      const q=localPoint(P,S.handB,hd,ang); sx=-3+(q.x+3)*pull; sy=q.y*pull;
      pLine(c,sx,sy,sx+44,sy*0.2,PU*1.2,P.pal.woodD);
      pPoly(c,[sx+44,sy*0.2-2.2, sx+50,sy*0.2, sx+44,sy*0.2+2.2],P.pal.metalL);
    }
    c.strokeStyle='#e8e4d8'; c.lineWidth=PU*0.9; c.beginPath(); c.moveTo(-3,-34); c.lineTo(sx,sy); c.lineTo(-3,34); c.stroke();
  }
  c.restore();
}
function cutLeg(P,D,I,side){
  const {c,S}=P, G=D.leg, d=side==='b';
  if(!G||!I.leg) return;
  const hip=d?S.hipB:S.hipF, kn=d?S.kneeB:S.kneeF, ft=d?S.footB:S.footF;
  const ank={x:ft.x-1,y:ft.y-(G.ah||9)};   // щиколотка над ступнею (у мункіна — вища: великі пазурі)
  cutPiece(c,I.leg,G.hip,G.kn,hip,kn,G.k,[-999,-999,999,G.cut1]);
  cutPiece(c,I.leg,G.kn,G.ank,kn,ank,G.k,[-999,G.cut1-8,999,G.cut2]);
  // чобіт стоїть рівно на землі (у повітрі трохи нахилений), щиколотка — над ступнею
  const lifted=ft.y<-2, k=G.k;
  c.save(); c.translate(ft.x,ft.y); c.rotate(lifted?0.35:0); c.scale(k,k);
  c.translate(-G.sole[0],-G.sole[1]);
  c.beginPath(); c.rect(-999,G.cut2-10,1999,999); c.clip(); cutDraw(c,I.leg);
  c.restore();
}
function cutShoulder(P,D,I,side){
  const {c,S}=P, Sh=D.shoulder, d=side==='b';
  if(!Sh||!I.shoulder) return;
  const sh=d?S.shB:S.shF, k=d?Sh.far:Sh.near;
  c.save(); c.translate(sh.x+(d?5:-6),sh.y+(d?-3:-1)); c.rotate(S.lean);   // ближній — трохи назад, щоб висока плита не закривала шолом
  if(d) c.scale(-1,1);
  c.scale(k,k); c.translate(-Sh.c[0],-Sh.c[1]); cutDraw(c,I.shoulder);
  c.restore();
}
function cutCape(P,D,I){
  const {c,S,p}=P, C=D.cape;
  const a0=S.T(-6,-RIG.TORSO+4);
  const lift=clamp(p.cape,-0.3,1.2);
  c.save(); c.translate(a0.x,a0.y); c.rotate(0.1+lift*0.7+p.lean*0.5+Math.sin(P.time*7)*0.03);
  c.scale(C.k*C.sx,C.k); c.translate(-C.top[0],-C.top[1]); cutDraw(c,I.cape);
  c.restore();
}

/* ---------- форма кота: деталі на чотирилапому скелеті js/cat.js (solveCat) ---------- */
function paintCatCutout(c,m,p,time,lights,ck){
  const S=solveCat(p), D=cutDef(ck), I=cutoutImgs(ck);
  const P={c,m,p,S,time,lights,pal:m.pal};
  OL=m.pal.outline;
  c.save();
  c.translate(p.ox,p.oy);
  if(p.flip!==1){ const f=p.flip; c.scale((f<0?-1:1)*Math.max(0.4,Math.abs(f)),1); }
  c.imageSmoothingEnabled=true; c.imageSmoothingQuality='low';
  catTailCut(P,D,I);
  CUT_DIM=true; catLegCut(P,D.front,I.front,S.ff); catLegCut(P,D.hind,I.hind,S.hf); CUT_DIM=false;
  // тулуб — у системі тіла: крижі й груди в точки силуету procedural catBody (розтяг хребта — теж)
  const st=p.stretch;
  c.save(); c.translate(S.C.x,S.C.y); c.rotate(p.tilt);
  cutPiece(c,I.body,D.body.rear,D.body.front,{x:-37-st,y:-2},{x:38+st,y:-2},null);
  c.restore();
  catLegCut(P,D.hind,I.hind,S.hn); catLegCut(P,D.front,I.front,S.fn);
  // голова: потилиця → ніс уздовж осі голови (кут — з пози)
  const H=S.head, Hd=D.head;
  c.save(); c.translate(H.x,H.y); c.rotate(H.a);
  cutPiece(c,I.head,Hd.back,Hd.nose,{x:-14,y:-3},{x:19,y:-3},null);
  if(Hd.eye){ const q=cutMap(Hd.back,Hd.nose,{x:-14,y:-3},{x:19,y:-3},Hd.eye); addLight(P,q.x,q.y,6,m.pal.eye,0.8); }
  c.restore();
  c.restore();
}
// лапа: передня — корінь → лікоть → лапа, задня — корінь → коліно → скакальний суглоб → лапа (сегменти обрізаємо за висотою)
function catLegCut(P,G,img,L){
  if(!G||!img) return;
  const c=P.c, q=G.pts, joints=L.hock?[L.root,L.j,L.hock,{x:L.paw.x+1,y:L.paw.y-2}]:[L.root,L.j,{x:L.paw.x+2,y:L.paw.y-3}];
  for(let i=0;i<joints.length-1;i++){
    const y0=i?(q[i][1]-6):-999, y1=i<joints.length-2?q[i+1][1]+6:999;
    cutPiece(c,img,q[i],q[i+1],joints[i],joints[i+1],G.k,[-999,y0,999,y1]);
  }
}
// хвіст: той самий ланцюжок, що й у procedural catTail; зображення ріжемо на три смуги від основи до кінчика
function catTailCut(P,D,I){
  const T=D.tail; if(!T||!I.tail) return;
  const {c,S,p,time}=P;
  const base=S.T(-30-p.stretch,-6);
  let x=base.x, y=base.y, a=Math.PI+0.35-p.tail*0.5;
  const pts=[{x,y}];
  for(let i=0;i<7;i++){ a+=-0.12*p.tail+Math.sin(time*2.6+i*0.7)*0.12+(i>3?-0.18:0); x+=Math.cos(a)*7; y+=Math.sin(a)*7; pts.push({x,y}); }
  const idx=[0,2,4,7], bx=T.base[0], tx=T.tip[0], by=T.base[1], ty=T.tip[1], k=49/Math.abs(tx-bx);
  for(let s=0;s<3;s++){
    const f0=idx[s]/7, f1=idx[s+1]/7;
    const a0=[bx+(tx-bx)*f0, by+(ty-by)*f0], a1=[bx+(tx-bx)*f1, by+(ty-by)*f1];
    const lo=Math.min(a0[0],a1[0])-(s?2:30), hi=Math.max(a0[0],a1[0])+(s<2?2:30);
    cutPiece(c,I.tail,a0,a1,pts[idx[s]],pts[idx[s+1]],k,[lo,-999,hi,999]);
  }
}

/* ---------- масивні форми: мункін, дерево життя, інфернал ----------
   Тулуб — центр мас у системі таза; голова втоплена між плечима й малюється останньою (крило чи кулак не закривають обличчя);
   суглоби беремо з рига (solvePose у напівоберті), але кріпимо до тіла форми: плечі — на боках тулуба, руки подовжені
   в armS разів (поза кисті та сама), стегна — під тулубом (ступні з рига, коліна — ik2).
   Масштаби деталей — у пакунку (pack_cutout.py BULK → D.k, D.rel); тут — розкладка в частках тулуба (tw — ширина, th — висота):
   bot — низ тулуба відносно таза; chin — підборіддя [x, частка th від верху]; shF/shB — плечі; hips — стегна [ближнє, дальнє];
   lower — «низ» позаду тулуба: keep — скільки згори лишити (частка висоти; у дерева й інфернала нижче — самі ноги),
   top — де його верх (частка th) або bot — де низ (частка th нижче низу тулуба); tuft — пучки на плечах; legs — розпрямленість лап у стійці */
const BULK_LAYOUT={
  moonkin:{bot:6,chin:[3,0.2],shF:[-0.3,0.24],shB:[0.28,0.2],hips:[-0.17,0.15],lower:{keep:1,bot:0.3},tuft:'f',legs:0.93,glow:'cast'},
  tree:{bot:4,chin:[3,0.13],shF:[-0.3,0.14],shB:[0.26,0.12],hips:[-0.16,0.14],lower:{keep:0.42,top:0.72},tuft:'f',legs:0.95,glow:'cast'},
  golem:{bot:8,chin:[5,0.26],shF:[-0.44,0.14],shB:[0.4,0.12],hips:[-0.22,0.2],lower:null,tuft:'both',legs:0.93,glow:'fel'},
};
function bulkGeom(D,py){
  if(D._g) return D._g;
  const k=D.k, R=D.rel||{}, d=(a,b,kk)=>Math.hypot(b[0]-a[0],b[1]-a[1])*kk;
  const th=(D.torso.bot[1]-D.torso.top[1])*k, tw=D.torso.w*k;
  const A=D.arm, G=D.leg, ka=A.k, kg=G.k;
  const thigh=d(G.hip,G.kn,kg), shin=d(G.kn,G.ank,kg), ah=(G.sole[1]-G.ank[1])*kg;
  const Lay=BULK_LAYOUT[D.kind], restPel=RIG.PELVIS+py;
  return D._g={th,tw,top:Lay.bot-th,Lay,R,
    armS:(d(A.sh,A.el,ka)+d(A.el,A.hand,ka))/(RIG.UPPER+RIG.FORE),
    thigh,shin,ah,hipY:(-ah-Lay.legs*(thigh+shin))-restPel,
    legDef:{...G,ah}};
}
function paintBulkCutout(P){
  const {c,S,p,time,pal,m}=P, D=cutDef(P.ck), I=cutoutImgs(P.ck), k=D.k, T=S.T;
  const g=bulkGeom(D,(m.stance&&m.stance.py!=null)?m.stance.py:(STANCE[m.style]||{}).py||0), Lay=g.Lay, rel=n=>k*(g.R[n]||1);
  c.imageSmoothingEnabled=true; c.imageSmoothingQuality='low';
  const shF=T(g.tw*Lay.shF[0],g.top+g.th*Lay.shF[1]), shB=T(g.tw*Lay.shB[0],g.top+g.th*Lay.shB[1]);
  const arm=(sh,rs,re,rh)=>({sh,el:{x:sh.x+(re.x-rs.x)*g.armS,y:sh.y+(re.y-rs.y)*g.armS},hd:{x:sh.x+(rh.x-rs.x)*g.armS,y:sh.y+(rh.y-rs.y)*g.armS}});
  const aF=arm(shF,S.shF,S.elF,S.handF), aB=arm(shB,S.shB,S.elB,S.handB);
  const leg=(hip,ft)=>{ const r=ik2(hip.x,hip.y,ft.x-1,ft.y-g.ah,g.thigh,g.shin,1); return {hip,kn:{x:r.jx,y:r.jy},ft}; };
  const lF=leg(T(g.tw*Lay.hips[0],g.hipY),S.footF), lB=leg(T(g.tw*Lay.hips[1],g.hipY),S.footB);
  const Q={shF:aF.sh,elF:aF.el,handF:aF.hd,shB:aB.sh,elB:aB.el,handB:aB.hd,
    hipF:lF.hip,kneeF:lF.kn,footF:lF.ft,hipB:lB.hip,kneeB:lB.kn,footB:lB.ft};
  const PQ={...P,S:Q}, DD={arm:D.arm,leg:g.legDef};
  // пучок на плечі (пір'я, листя, брила) трохи йде за плечовою кісткою руки
  const tuft=(a,far)=>{ if(!I.shoulder||!D.shoulder) return;
    const ua=Math.atan2(a.el.y-a.sh.y,a.el.x-a.sh.x)-Math.PI/2, s=rel('shoulder')*(far?0.9:1);
    c.save(); c.translate(a.sh.x+(far?-1:1),a.sh.y+3); c.rotate(S.lean*0.5+clamp(ua*0.5,-0.35,0.35)); c.scale(far?-s:s,s);
    c.translate(-D.shoulder.c[0],-D.shoulder.c[1]); cutDraw(c,I.shoulder); c.restore(); };
  CUT_DIM=true; cutArm(PQ,DD,I,'b'); if(Lay.tuft==='both') tuft(aB,true); cutLeg(PQ,DD,I,'b'); CUT_DIM=false;
  cutLeg(PQ,DD,I,'f');
  // тіло — у системі таза з нахилом торса; «низ»: черево сови позаду грудей або таз дерева над розвилкою коренів
  c.save(); c.translate(S.pel.x,S.pel.y); c.rotate(S.lean);
  const L=D.lower, LL=Lay.lower;
  if(L&&LL&&I.lower){
    const kl=rel('lower'), h=(L.bot[1]-L.top[1])*kl, y0=LL.top!=null?g.top+g.th*LL.top:Lay.bot+g.th*LL.bot-h;
    cutPiece(c,I.lower,L.top,L.bot,{x:0,y:y0},{x:0,y:y0+h},null,[-9999,-9999,9999,L.top[1]+(L.bot[1]-L.top[1])*LL.keep]);
  }
  cutPiece(c,I.torso,D.torso.top,D.torso.bot,{x:1,y:g.top},{x:1,y:Lay.bot},null);
  if(Lay.glow==='fel'){ const q=cutMap(D.torso.top,D.torso.bot,{x:1,y:g.top},{x:1,y:Lay.bot},D.torso.c);
    addLight(P,q.x,q.y,16+Math.sin(time*5)*2,pal.acc,0.7); }
  c.restore();
  cutArm(PQ,DD,I,'f');
  if(Lay.tuft) tuft(aF,false);
  // голова — втоплена в тулуб, хитається навколо підборіддя
  c.save(); c.translate(S.pel.x,S.pel.y); c.rotate(S.lean);
  const H=D.helm, kh=rel('helm');
  c.translate(Lay.chin[0],g.top+g.th*Lay.chin[1]); c.rotate(p.head);
  cutPiece(c,I.helm,H.c,H.top,{x:0,y:0},{x:0,y:-(H.c[1]-H.top[1])*kh},null);
  if(Lay.glow==='fel') addLight(P,3,-(H.c[1]-H.top[1])*kh*0.45,9,pal.acc,0.8);   // очі-вогні
  c.restore();
  // заряд у пазурах / гілках під час касту — в обох руках
  if(Lay.glow==='cast'&&p.glow>0.05){
    const col=m.castCol||pal.acc;
    for(const a of [aF,aB]){
      const h=a.hd, e=a.el, L2=Math.hypot(h.x-e.x,h.y-e.y)||1, gx=h.x+(h.x-e.x)/L2*3, gy=h.y+(h.y-e.y)/L2*3;
      const r=1.6+p.glow*2.2+Math.sin(time*20+gx)*0.5;
      pCirc(c,gx,gy,r,col); pCirc(c,gx,gy,r*0.55,lightOf(col,0.5)); pCirc(c,gx,gy,r*0.25,pal.white);
      addLight(P,gx,gy,10+p.glow*12,col,0.9);
    }
  }
}

/* ---------- запасний варіант: цільний спрайт, що рухається за тазом рига (присід, нахил, ривки) ---------- */
function paintWhole(P,W,img){
  const {c,S,p}=P;
  const bob=S.pel.y-RIG.PELVIS;                    // присід/стрибок
  c.save();
  c.translate(S.pel.x,bob);
  c.rotate(S.lean*0.6);                            // нахил від ступень
  c.scale(W.k*(1+Math.max(0,-bob)*0.002),W.k*(1-Math.max(0,bob)*0.004));   // легке стискання при присіданні
  c.translate(-W.feet[0],-W.feet[1]);
  cutDraw(c,img);
  c.restore();
  if(p.glow>0.05){ const hx=S.handF.x, hy=S.handF.y; addLight(P,hx,hy,10+p.glow*14,P.m.castCol||P.pal.acc,0.9); }
}
