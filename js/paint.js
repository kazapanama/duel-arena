"use strict";
/* ============================================================
   МАЛЮВАННЯ МОДЕЛІ: частини тіла, броня, шоломи, наплічники, зброя.
   Усе в локальній системі «дивиться вправо». PU — розмір одного
   арт-пікселя у світових одиницях (для ліній рівно в 1 піксель).
   Кольори беруться лише з палітри моделі — її ж використовує
   квантизація, тож спрайт лишається «чистим» піксель-артом.
   ============================================================ */
let PU=3;
let OL='#0a0608'; // колір внутрішнього контуру поточної моделі
function pOut(c,k=1){ c.strokeStyle=OL; c.lineWidth=PU*k; c.lineJoin='round'; c.stroke(); }

/* ---------- примітиви ---------- */
function pLine(c,x1,y1,x2,y2,w,col){
  c.strokeStyle=col; c.lineWidth=w; c.lineCap='round';
  c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
}
function pPoly(c,pts,col){
  c.fillStyle=col; c.beginPath(); c.moveTo(pts[0],pts[1]);
  for(let i=2;i<pts.length;i+=2) c.lineTo(pts[i],pts[i+1]);
  c.closePath(); c.fill();
}
function pPath(c,pts){
  c.beginPath(); c.moveTo(pts[0],pts[1]);
  for(let i=2;i<pts.length;i+=2) c.lineTo(pts[i],pts[i+1]);
  c.closePath();
}
function pCirc(c,x,y,r,col){ c.fillStyle=col; c.beginPath(); c.arc(x,y,r,0,7); c.fill(); }
function pEll(c,x,y,rx,ry,col,rot=0){ c.fillStyle=col; c.beginPath(); c.ellipse(x,y,rx,ry,rot,0,7); c.fill(); }
function pDot(c,x,y,col,k=1.25){ c.fillStyle=col; const s=PU*k; c.fillRect(x-s/2,y-s/2,s,s); }
// сегмент кінцівки з об'ємом: темний край + основний колір + відблиск
function pLimb(c,a,b,w,col,dark,light){
  pLine(c,a.x,a.y,b.x,b.y,w+PU*1.6,OL);
  pLine(c,a.x,a.y,b.x,b.y,w,dark);
  const dx=b.x-a.x, dy=b.y-a.y, L=Math.hypot(dx,dy)||1;
  let nx=-dy/L, ny=dx/L;
  if(nx*0.4-ny<0){ nx=-nx; ny=-ny; } // нормаль — до світла (вгору-вперед)
  const o=w*0.16;
  pLine(c,a.x+nx*o,a.y+ny*o,b.x+nx*o,b.y+ny*o,w*0.62,col);
  if(light&&w>6){ const o2=w*0.3; pLine(c,a.x+nx*o2,a.y+ny*o2,b.x+nx*o2,b.y+ny*o2,PU*1.05,light); }
}
/* ---------- деталі (малюються, лише коли вистачає роздільності) ---------- */
const HD=()=>PU<2.4;
// точка вздовж сегмента a→b: t — частка довжини, off — зсув по нормалі (+ до світла)
function lp(a,b,t,off=0){
  const dx=b.x-a.x, dy=b.y-a.y, L=Math.hypot(dx,dy)||1;
  let nx=-dy/L, ny=dx/L; if(nx*0.4-ny<0){ nx=-nx; ny=-ny; }
  return {x:a.x+dx*t+nx*off, y:a.y+dy*t+ny*off};
}
// поперечна смуга на кінцівці (шов, край пластини, ремінець)
function pBand(c,a,b,t,w,col,lw){ const p1=lp(a,b,t,w/2), p2=lp(a,b,t,-w/2); pLine(c,p1.x,p1.y,p2.x,p2.y,lw||PU,col); }
// поздовжня лінія вздовж кінцівки (ребро поножі, шов)
function pAlong(c,a,b,t0,t1,off,col,lw){ const p1=lp(a,b,t0,off), p2=lp(a,b,t1,off); pLine(c,p1.x,p1.y,p2.x,p2.y,lw||PU,col); }
function pStitch(c,x1,y1,x2,y2,col){ if(!HD()) return; c.save(); c.setLineDash([PU*1.2,PU*1.3]); c.lineCap='butt'; pLine(c,x1,y1,x2,y2,PU*0.9,col); c.restore(); }
function pStitchAlong(c,a,b,t0,t1,off,col){ const p1=lp(a,b,t0,off), p2=lp(a,b,t1,off); pStitch(c,p1.x,p1.y,p2.x,p2.y,col); }
function pRivet(c,x,y,col,hl){ pDot(c,x,y,col,1.25); if(hl&&HD()) pDot(c,x-PU*0.25,y-PU*0.25,hl,0.7); }
// кільчаста фактура вздовж кінцівки: зсунуті ряди «кілець»
function pMailAlong(c,a,b,w,col){
  if(!HD()) return;
  c.save(); c.lineCap='butt';
  for(let k=-1;k<=1;k++){ c.setLineDash([PU,PU]); c.lineDashOffset=k*PU; const off=k*w*0.26; const p1=lp(a,b,0.08,off), p2=lp(a,b,0.92,off); pLine(c,p1.x,p1.y,p2.x,p2.y,PU*0.9,col); }
  c.restore();
}
// вишивка: ромбики вздовж лінії
function pEmbroider(c,x1,y1,x2,y2,col,step=4.5){
  if(!HD()) return;
  const L=Math.hypot(x2-x1,y2-y1), n=Math.max(1,Math.floor(L/step));
  for(let i=0;i<=n;i++){ const t=i/n, x=x1+(x2-x1)*t, y=y1+(y2-y1)*t; pPoly(c,[x,y-PU*0.9, x+PU*0.9,y, x,y+PU*0.9, x-PU*0.9,y],col); }
}
// світло для глоу-шару (у координатах спрайта)
function addLight(P,x,y,r,col,a=1){
  const t=P.c.getTransform(); const q=t.transformPoint(new DOMPoint(x,y));
  P.lights.push({x:q.x,y:q.y,r:r*Math.hypot(t.a,t.b),col,a});
}
// тонка вигнута «лопать»-фігура (роги, ікла, пір'я): від основи до кінчика з товщиною w
function pHorn(c,x0,y0,cx,cy,x1,y1,w,col){
  const nx=-(cy-y0), ny=(cx-x0), L=Math.hypot(nx,ny)||1;
  c.fillStyle=col; c.beginPath();
  c.moveTo(x0+nx/L*w/2,y0+ny/L*w/2);
  c.quadraticCurveTo(cx+nx/L*w/4,cy+ny/L*w/4,x1,y1);
  c.quadraticCurveTo(cx-nx/L*w/4,cy-ny/L*w/4,x0-nx/L*w/2,y0-ny/L*w/2);
  c.closePath(); c.fill();
}

/* ============================================================
   ГОЛОВНА ФУНКЦІЯ
   ============================================================ */
function paintModel(c,m,p,time,lights){
  if(m.kind==='cat') return paintCat(c,m,p,time,lights);
  const S=solvePose(p,m.style);
  const P={c,m,p,S,time,lights,pal:m.pal};
  OL=m.pal.outline;
  c.save();
  c.translate(p.ox,p.oy);
  if(p.rot){ c.translate(0,RIG.PELVIS); c.rotate(p.rot); c.translate(0,-RIG.PELVIS); }
  if(p.flip!==1){ const f=p.flip; c.scale((f<0?-1:1)*Math.max(0.4,Math.abs(f)),1); }
  if(m.kind==='moonkin'){ c.scale(1.12,1.12); paintMoonkin(P); c.restore(); return; }
  if(m.kind==='tree'){ c.scale(1.14,1.14); paintTree(P); c.restore(); return; }
  if(m.aura) drawAuraBack(P);
  if(m.wings>0) drawWing(P,true);
  if(m.cape) drawCape(P);
  if(m.wings>0) drawWing(P,false);
  drawArm(P,'b');
  drawShoulder(P,'b');
  if(m.tail) drawTail(P);
  drawLeg(P,'b');
  drawLeg(P,'f');
  drawLower(P);
  drawTorso(P);
  if(m.tabard) drawTabard(P);
  drawHead(P);
  drawArm(P,'f');
  drawShoulder(P,'f');
  if(m.race==='draenei') drawTendrils(P);   // вусики поверх наплічника, як на референсі
  c.restore();
}

/* ---------- вусики-щупальця дренея (звисають з підборіддя на груди) ---------- */
function drawTendrils(P){
  const {c,S,m,pal,time}=P, hd=S.head;
  c.save(); c.translate(hd.x,hd.y); c.rotate(hd.a); if(m.headScale) c.scale(m.headScale,m.headScale);
  const sw=Math.sin(time*2)*0.8;
  for(const [x0,y0,x1,y1,col] of [[0,6,-4+sw,25,'tendrilD'],[4,7,3+sw,28,'tendril'],[8,6,10+sw,24,'tendril']]){
    pHorn(c,x0,y0,(x0+x1)/2+2,(y0+y1)/2,x1,y1,2.8+PU*1.4,OL); pHorn(c,x0,y0,(x0+x1)/2+2,(y0+y1)/2,x1,y1,2.6,pal[col]);
  }
  c.restore();
}

/* ---------- крила Avenging Wrath: силует ангельського крила з трьома рядами пір'я ---------- */
// ряд пір'я: від кореня по «кістці» до кінчика, далі хвилястий край із заокругленими кінцями пір'я
function wingPath(c,edge,tips,notch){
  c.beginPath(); c.moveTo(0,0);
  for(const [x,y] of edge) c.lineTo(x,y);
  for(let i=0;i<tips.length;i++){
    const [x,y]=tips[i], [nx,ny]=tips[i+1]||[0,0];
    c.quadraticCurveTo(x-2,y+4,(x+nx)/2+notch,(y+ny)/2-notch*0.4); // закруглений кінчик → вирізка між пір'ям
  }
  c.closePath();
}
function drawWing(P,far){
  const {c,S,m,pal,time}=P;
  const k=m.wings;
  const root=S.T(far?-1:-7,-RIG.TORSO+9);
  const flap=Math.sin(time*3.2)*0.12;
  c.save();
  c.translate(root.x,root.y);
  c.rotate(S.lean*0.4+(far?0.42:0)+flap*(far?0.7:1));   // дальнє крило визирає вперед над плечем
  c.scale(k*(far?0.86:1),k*(far?0.9:1));
  if(m.wingKind==='bat'){ // демонічне крило: кістки-пальці й фестончаста перетинка
    const bones=[[-30,-78],[-52,-62],[-60,-38],[-50,-14]], root=[0,0], wr=[-14,-44];
    c.beginPath(); c.moveTo(0,-4); c.lineTo(wr[0],wr[1]); c.lineTo(bones[0][0],bones[0][1]);
    for(let i=1;i<bones.length;i++){ const [px,py]=bones[i-1],[x,y]=bones[i]; c.quadraticCurveTo((px+x)/2+6,(py+y)/2+6,x,y); }
    c.quadraticCurveTo(-26,-2,0,6); c.closePath();
    pOut(c,2); c.fillStyle=far?pal.wingD:pal.wing; c.fill();
    if(!far){ c.save(); c.clip(); c.fillStyle=pal.wingL; c.beginPath(); c.moveTo(wr[0],wr[1]); c.lineTo(bones[1][0],bones[1][1]); c.lineTo(bones[2][0],bones[2][1]); c.closePath(); c.globalAlpha=0.5; c.fill(); c.restore(); }
    c.lineCap='round';
    pLine(c,0,-4,wr[0],wr[1],3.2,pal.primDD);
    for(const [x,y] of bones) pLine(c,wr[0],wr[1],x,y,2,pal.primDD);
    pHorn(c,bones[0][0],bones[0][1],bones[0][0]+2,bones[0][1]-4,bones[0][0]+7,bones[0][1]-9,2.6,pal.primDD); // кіготь на згині
    c.restore(); return;
  }
  // махові: кістка вгору-назад до зап'ястя, далі назовні до кінчика
  const prim={edge:[[-8,-30],[-17,-56],[-32,-76],[-54,-90]],
    tips:[[-64,-82],[-67,-66],[-64,-50],[-58,-35],[-49,-21],[-37,-8],[-23,2],[-9,5]]};
  const sec={edge:[[-8,-28],[-15,-50],[-28,-66],[-42,-73]],
    tips:[[-48,-61],[-49,-46],[-44,-31],[-35,-17],[-23,-6],[-11,0]]};
  const cov={edge:[[-6,-24],[-12,-42],[-24,-54]],
    tips:[[-29,-44],[-27,-31],[-20,-19],[-10,-10]]};
  const fill=(L,col)=>{ wingPath(c,L.edge,L.tips,3); pOut(c,2); c.fillStyle=col; c.fill(); };
  if(far){ fill(prim,pal.wingD); fill(sec,pal.wingD); }
  else{
    fill(prim,pal.wingD);
    fill(sec,pal.wing);
    fill(cov,pal.wingL);
    if(HD()){ // лінії розділення пір'я: від кістки до вирізок
      c.strokeStyle=pal.wingD; c.lineWidth=PU; c.lineCap='round';
      prim.tips.forEach(([x,y],i)=>{ if(i%1===0&&i<prim.tips.length-1){ const e=prim.edge[Math.min(3,Math.floor(i/2)+1)]; c.beginPath(); c.moveTo(e[0]*0.8+x*0.2,e[1]*0.8+y*0.2); c.lineTo(x*0.94,y*0.94); c.stroke(); } });
      c.strokeStyle=pal.wingD; sec.tips.forEach(([x,y])=>{ c.beginPath(); c.moveTo(x*0.55,y*0.55-10); c.lineTo(x*0.95,y*0.95); c.stroke(); });
      pLine(c,-9,-30,-30,-72,PU*1.2,pal.white);   // відблиск на передньому краї
    }
    addLight(P,-32,-40,66,m.wingLight||'#ffe27a',(m.wingLight?0.35:0.75)*k);
  }
  c.restore();
}

/* ---------- хвіст дренея: гнучкий, з пензликом ---------- */
function drawTail(P){
  const {c,S,pal,time,p}=P;
  const a=S.T(-10,-3);
  const sw=Math.sin(time*2.2)*3+p.lean*-10;
  const pts=[[a.x,a.y],[a.x-9,a.y+8],[a.x-15+sw*0.3,a.y+19],[a.x-17+sw,a.y+30]];
  c.lineCap='round';
  for(let i=0;i<3;i++){ pLine(c,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],6-i*1.3+PU*1.6,OL); }
  for(let i=0;i<3;i++){ pLine(c,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],6-i*1.3,pal.skinD); }
  const t=pts[3]; pEll(c,t[0],t[1]+2,3.4,4.6,pal.tendrilD); pEll(c,t[0]+0.6,t[1]+1.4,2.3,3.4,pal.tendril);
}

/* ---------- аура за спиною (тір-сети з ефектом) ---------- */
function drawAuraBack(P){
  const {c,S,time,m}=P;
  addLight(P,S.pel.x,S.pel.y-18,58+Math.sin(time*3)*4,m.aura,0.55);
}

/* ---------- плащ: хвилястий ланцюжок від плечей ---------- */
function drawCape(P){
  const {c,S,p,pal,time,m}=P;
  const cp=m.cape;
  const a0=S.T(-7,-RIG.TORSO+3);
  const len=cp.len||40, n=5, seg=len/n;
  const lift=clamp(p.cape,-0.3,1.2);
  const pts=[a0];
  let x=a0.x, y=a0.y;
  for(let i=1;i<=n;i++){
    const ang=0.18+lift*1.05*(i/n)+Math.sin(time*7+i*0.9)*0.07*(0.4+lift)+p.lean*0.5;
    x-=Math.sin(ang)*seg; y+=Math.cos(ang)*seg;
    pts.push({x,y});
  }
  const L=[],R=[];
  for(let i=0;i<pts.length;i++){
    const q=pts[i], nq=pts[Math.min(i+1,pts.length-1)], pq=pts[Math.max(i-1,0)];
    const dx=nq.x-pq.x, dy=nq.y-pq.y, d=Math.hypot(dx,dy)||1;
    const w=(cp.w||7)+i*1.6;
    L.push(q.x-dy/d*w*0.25, q.y+dx/d*w*0.25); R.push(q.x+dy/d*w, q.y-dx/d*w);
  }
  c.beginPath(); c.moveTo(L[0],L[1]);
  for(let i=2;i<L.length;i+=2) c.lineTo(L[i],L[i+1]);
  // нижній край: рваний чи рівний
  const last=pts[pts.length-1];
  if(cp.t==='tatter'){
    const bx=R[R.length-2], by=R[R.length-1], ex=L[L.length-2], ey=L[L.length-1];
    for(let k=1;k<=4;k++){ const f=k/5; c.lineTo(ex+(bx-ex)*f+(k%2?0:2), ey+(by-ey)*f+(k%2?6:-1)); }
  }
  for(let i=R.length-2;i>=0;i-=2) c.lineTo(R[i],R[i+1]);
  c.closePath();
  pOut(c,2); c.fillStyle=pal.capeD; c.fill();
  c.save(); c.clip();
  c.fillStyle=pal.cape;
  c.beginPath(); c.moveTo(L[0],L[1]); for(let i=2;i<L.length;i+=2) c.lineTo(L[i]-3,L[i+1]); c.lineTo(last.x-12,last.y+10); c.lineTo(a0.x-12,a0.y); c.closePath(); c.fill();
  if(HD()){ // складки уздовж плаща і світла підкладка на внутрішньому краї
    for(const f of [0.35,0.7]){ c.strokeStyle=pal.capeD; c.lineWidth=PU; c.beginPath();
      for(let i=0;i<pts.length;i++){ const x=L[i*2]+(R[i*2]-L[i*2])*f, y=L[i*2+1]+(R[i*2+1]-L[i*2+1])*f; i?c.lineTo(x,y):c.moveTo(x,y); } c.stroke(); }
    c.strokeStyle=pal.capeL; c.lineWidth=PU; c.beginPath(); c.moveTo(L[0]+1,L[1]); for(let i=2;i<L.length;i+=2) c.lineTo(L[i]+1,L[i+1]); c.stroke();
  }
  if(cp.trim){ c.strokeStyle=pal.trim; c.lineWidth=PU*1.4; c.beginPath(); c.moveTo(R[0],R[1]); for(let i=2;i<R.length;i+=2) c.lineTo(R[i],R[i+1]); c.stroke(); }
  c.restore();
}

/* ---------- кольори частин за типом броні ---------- */
function armCols(m,side){
  const P=m.pal, d=side==='b';
  const pick=(n)=>d?(P[n+'D']||P[n]):P[n];
  switch(m.armor){
    case 'plate': return {up:pick('prim'),upD:d?P.primDD:P.primD,upL:d?null:P.primL, fo:pick('prim'),foD:d?P.primDD:P.primD, cuff:pick('trim'), hand:P.glove?(d?P.gloveD:P.glove):pick('metal'),handD:P.glove?P.gloveD:P.metalD};
    case 'mail': return {up:pick('prim'),upD:d?P.primDD:P.primD,upL:d?null:P.primL, fo:pick('leath'),foD:P.leathD, cuff:pick('trim'), hand:pick('leath'),handD:P.leathD};
    case 'leather': return m.bands?{up:pick('prim'),upD:d?P.primDD:P.primD,upL:d?null:P.primL, fo:pick('prim'),foD:d?P.primDD:P.primD, cuff:pick(m.bands), hand:pick('leath'),handD:P.leathD}
      :{up:pick('prim'),upD:d?P.primDD:P.primD,upL:null, fo:pick('sec'),foD:P.secD, cuff:pick('trim'), hand:pick('leath'),handD:P.leathD};
    default: return {up:pick('prim'),upD:d?P.primDD:P.primD,upL:null, fo:pick('prim'),foD:d?P.primDD:P.primD, cuff:pick('trim'), hand:pick('skin'),handD:P.skinD, sleeve:true};
  }
}

/* ---------- руки + зброя ---------- */
function drawArm(P,side){
  const {c,S,m,pal}=P;
  const d=side==='b';
  const sh=d?S.shB:S.shF, el=d?S.elB:S.elF, hd=d?S.handB:S.handF;
  const col=armCols(m,side);
  const wt=(m.armor==='plate'?11:10)*(m.bulk||1);
  const wpn=d?m.back:m.front;
  const ang=d?P.p.wb:P.p.wf;
  const hd2=HD()&&!d;
  pLimb(c,sh,el,wt,col.up,col.upD,col.upL);
  if(m.bands) drawBand(c,sh,el,0.72,wt*1.3,5.2,pal,m.bands,d);   // товсте кільце над ліктем
  // плече: деталі за типом броні
  if(hd2){
    if(m.armor==='plate'){ pBand(c,sh,el,0.55,wt*0.9,pal.primDD); pBand(c,sh,el,0.6,wt*0.8,pal.primL); const q=lp(sh,el,0.3,wt*0.28); pDot(c,q.x,q.y,pal.white,1); }
    else if(m.armor==='mail') pMailAlong(c,sh,el,wt,pal.primD);
    else if(m.armor==='leather') pStitchAlong(c,sh,el,0.15,0.85,wt*0.18,pal.primDD);
    else pAlong(c,sh,el,0.2,0.9,-wt*0.15,pal.primDD);
  }
  if(col.sleeve){ // широкий рукав мантії
    const dx=hd.x-el.x, dy=hd.y-el.y, L=Math.hypot(dx,dy)||1, nx=-dy/L, ny=dx/L;
    const wx=el.x+dx*0.82, wy=el.y+dy*0.82;
    pPath(c,[el.x+nx*4.6,el.y+ny*4.6, wx+nx*7.2,wy+ny*7.2, wx-nx*7.2,wy-ny*7.2, el.x-nx*4.6,el.y-ny*4.6]); pOut(c,1.6);
    pPoly(c,[el.x+nx*4,el.y+ny*4, wx+nx*6.5,wy+ny*6.5, wx-nx*6.5,wy-ny*6.5, el.x-nx*4,el.y-ny*4],col.upD);
    pPoly(c,[el.x+nx*3.5,el.y+ny*3.5, wx+nx*5.5,wy+ny*5.5, wx-nx*3,wy-ny*3, el.x-nx*2,el.y-ny*2],col.up);
    if(hd2){ pLine(c,el.x+nx*1,el.y+ny*1,wx-nx*1.5,wy-ny*1.5,PU,pal.primD); pLine(c,el.x+nx*3,el.y+ny*3,wx+nx*4.6,wy+ny*4.6,PU,pal.primL); }
    // манжет із вишивкою
    pLine(c,wx+nx*6.2,wy+ny*6.2,wx-nx*6.2,wy-ny*6.2,PU*2.2,col.cuff);
    if(hd2) pEmbroider(c,wx+nx*5,wy+ny*5,wx-nx*5,wy-ny*5,pal.acc,3.2);
    // кисть із пальцями
    pCirc(c,hd.x,hd.y,3.5,pal.skinD); pCirc(c,hd.x+0.4,hd.y-0.5,2.7,pal.skin);
  } else {
    pLimb(c,el,hd,wt-1,col.fo,col.foD);
    const k=m.plates?0.4:(m.bands?0.58:0.62);
    const cuff=m.plates?(d?pal[m.plates+'D']:pal[m.plates]):col.cuff;
    if(m.bands){ drawBand(c,el,hd,0.72,wt*1.35,6.5,pal,m.bands,d); }
    else {
    if(m.armor==='plate'){
      // латний наруч: пластини + розширений манжет рукавиці
      if(hd2){ pBand(c,el,hd,0.3,wt*0.9,pal.primDD); pBand(c,el,hd,0.34,wt*0.8,pal.primL); pAlong(c,el,hd,0.1,0.7,wt*0.25,pal.primL); }
      const c1=lp(el,hd,0.72,wt*0.72), c2=lp(el,hd,0.72,-wt*0.72), c3=lp(el,hd,0.92,-wt*0.45), c4=lp(el,hd,0.92,wt*0.45);
      pPath(c,[c1.x,c1.y,c2.x,c2.y,c3.x,c3.y,c4.x,c4.y]); pOut(c,1.6); c.fillStyle=cuff; c.fill();
      if(hd2){ const r=lp(el,hd,0.76,wt*0.3); pRivet(c,r.x,r.y,pal.trimD,pal.trimL); pLine(c,c1.x,c1.y,c4.x,c4.y,PU,pal.trimL); }
      // налокітник із «крильцем»
      pCirc(c,el.x,el.y,3.6,d?pal.primDD:pal.primD); pCirc(c,el.x+0.3,el.y-0.4,2.6,d?pal.primD:pal.primL);
      if(hd2){ const w1=lp(sh,el,0.92,-6), w2=lp(el,hd,0.12,-6.5); pPoly(c,[el.x,el.y,w1.x,w1.y,w2.x,w2.y],pal.primD); pDot(c,el.x+0.4,el.y-0.6,pal.white,0.9); }
    } else {
      // наруч: основа + ремінці / шнурівка
      pLine(c,lp(el,hd,k).x,lp(el,hd,k).y,lp(el,hd,0.95).x,lp(el,hd,0.95).y,wt+(m.plates?1.5:0.5),cuff);
      if(m.plates&&!d) pLine(c,lp(el,hd,k,2).x,lp(el,hd,k,2).y,lp(el,hd,0.9,2).x,lp(el,hd,0.9,2).y,PU,pal[m.plates+'L']);
      if(hd2){
        pBand(c,el,hd,k+0.08,wt+0.5,pal.trimD); pBand(c,el,hd,0.88,wt+0.5,pal.trimD);
        if(m.armor==='leather'||m.armor==='mail'){ for(const t of [0.7,0.78]){ const a1=lp(el,hd,t,-wt*0.25), a2=lp(el,hd,t+0.06,wt*0.25); pLine(c,a1.x,a1.y,a2.x,a2.y,PU*0.9,pal.leathD); } }
        const b=lp(el,hd,k+0.08,wt*0.1); pRivet(c,b.x,b.y,pal.trim,pal.trimL);
      }
      if(hd2&&m.armor==='mail') pMailAlong(c,el,{x:el.x+(hd.x-el.x)*0.6,y:el.y+(hd.y-el.y)*0.6},wt-1,pal.leathD);
    }
    }
  }
  if(wpn && wpn.t!=='shield') drawWeapon(P,wpn,hd,ang,side);
  if(m.wings>0&&wpn&&wpn.t!=='shield'&&!d){ const tip={x:hd.x+Math.sin(ang)*38,y:hd.y-Math.cos(ang)*38}; addLight(P,tip.x,tip.y,26,'#fff2b0',0.9*m.wings); addLight(P,hd.x,hd.y,14,'#ffe27a',0.6*m.wings); }
  if(!col.sleeve){
    // кулак: рукавиця з пальцями й великим пальцем
    pCirc(c,hd.x,hd.y,3.9,col.handD);
    pCirc(c,hd.x+0.4,hd.y-0.5,3.0,col.hand);
    if(hd2){ const dx=Math.sign(hd.x-el.x)||1; pLine(c,hd.x-1.5,hd.y+1.4,hd.x+2.2,hd.y+1.4,PU*0.8,col.handD); pDot(c,hd.x+dx*1.8,hd.y-1.6,m.armor==='plate'?pal.white:(pal.leathL||col.hand),0.8); }
  }
  if(wpn && wpn.t==='shield') drawShield(P,wpn,hd,ang);
  // заряд у долоні (касти)
  if(P.p.glow>0.05 && side===(m.castSide||'b')){
    const r=2.5+P.p.glow*4+Math.sin(P.time*20)*0.8;
    pCirc(c,hd.x+3,hd.y-3,r,pal.accL);
    pCirc(c,hd.x+3,hd.y-3,r*0.55,pal.white);
    addLight(P,hd.x+3,hd.y-3,10+P.p.glow*14,m.castCol||pal.acc,0.9);
  }
}

/* ---------- ноги ---------- */
function drawLeg(P,side){
  const {c,S,m,pal}=P;
  const hip=side==='b'?S.hipB:S.hipF, kn=side==='b'?S.kneeB:S.kneeF, ft=side==='b'?S.footB:S.footF;
  const d=side==='b', hd2=HD()&&!d;
  let th,thD,sh,shD,boot,bootD,kneeCol=null;
  switch(m.armor){
    case 'plate': th=d?pal.primD:pal.prim; thD=pal.primDD; sh=th; shD=thD; boot=d?pal.primDD:pal.primD; bootD=pal.primDD; kneeCol=d?pal.trimD:pal.trim;
      if(m.legCol){ th=d?pal[m.legCol+'D']:pal[m.legCol]; thD=pal[m.legCol+'DD']||pal[m.legCol+'D']; sh=th; shD=thD; }
      break;
    case 'mail': th=d?pal.secD:pal.sec; thD=pal.secD; sh=d?pal.primD:pal.prim; shD=pal.primDD; boot=d?pal.leathD:pal.leath; bootD=pal.leathD; break;
    case 'leather': th=d?pal.primD:pal.prim; thD=pal.primDD; sh=th; shD=thD; boot=d?pal.secD:pal.sec; bootD=pal.secD; break;
    default: th=d?pal.secD:pal.sec; thD=pal.secD; sh=th; shD=thD; boot=d?pal.leathD:pal.leath; bootD=pal.leathD;
  }
  if(m.boot){ boot=d?pal[m.boot+'D']:pal[m.boot]; bootD=d?(pal[m.boot+'DD']||pal[m.boot+'D']):pal[m.boot+'D']; }
  const L=d?null:(m.armor==='plate'||m.bands?pal.primL:null);
  const tw=13*(m.bulk||1), sw=11.5*(m.bulk||1);
  if(m.legs==='hoof'){ // дреней: коліно вперед → скакальний суглоб назад → ратиця
    const hock={x:ft.x-6,y:ft.y-14};
    const r=ik2(hip.x,hip.y,hock.x,hock.y,18,16.5,1), kn2={x:r.jx,y:r.jy};  // коротші стегно й гомілка — ставний, не присідає
    pLimb(c,hip,kn2,tw,th,thD,L);
    if(hd2){ pBand(c,hip,kn2,0.5,tw*0.85,pal.primDD); pBand(c,hip,kn2,0.55,tw*0.75,pal.primL); }
    pCirc(c,kn2.x+1,kn2.y,3.6,d?pal.primDD:pal.primD); pCirc(c,kn2.x+1.3,kn2.y-0.4,2.6,d?pal.primD:pal.primL);
    const kn=kn2;
    pLimb(c,kn,hock,sw,sh,shD,L);
    pLimb(c,hock,{x:ft.x-1,y:ft.y-4},sw*0.72,sh,shD,L);
    if(hd2){ pBand(c,kn,hock,0.45,sw*0.9,pal.primDD); pAlong(c,kn,hock,0.1,0.8,sw*0.15,pal.primL); pDot(c,hock.x,hock.y,pal.trim,1.6); }
    c.save(); c.translate(ft.x,ft.y);
    pPath(c,[-7,-7, 5,-7, 9,0, -8,0]); pOut(c,2); c.fillStyle=d?pal.hoof:pal.hoof; c.fill();
    pPoly(c,[-6,-6, 4,-6, 7,-1, -6,-1],d?pal.hoof:pal.hoofL);
    if(hd2){ pLine(c,1,-6,2,0,PU,pal.hoof); pLine(c,-6,-6.5,4,-6.5,PU*1.4,pal.trim); }
    c.restore();
    return;
  }
  pLimb(c,hip,kn,tw,th,thD,L);
  pLimb(c,kn,ft,sw,sh,shD,L);
  if(hd2){
    if(m.armor==='plate'){
      pBand(c,hip,kn,0.5,tw*0.85,pal.primDD); pBand(c,hip,kn,0.55,tw*0.75,pal.primL);   // стегнова пластина
      if(m.panels){ const a1=lp(hip,kn,0.12,tw*0.22), a2=lp(hip,kn,0.46,tw*0.22), b1=lp(hip,kn,0.12,-tw*0.22), b2=lp(hip,kn,0.46,-tw*0.22); pPoly(c,[a1.x,a1.y,a2.x,a2.y,b2.x,b2.y,b1.x,b1.y],pal[m.panels]); }
      pAlong(c,kn,ft,0.15,0.75,sw*0.12,pal.primL); pAlong(c,kn,ft,0.15,0.75,sw*0.02,pal.primDD); // ребро поножі
      const q=lp(kn,ft,0.35,sw*0.3); pDot(c,q.x,q.y,pal.white,1);
    } else if(m.armor==='mail'){
      pMailAlong(c,hip,kn,tw,pal.secD);
      pBand(c,kn,ft,0.15,sw,pal.primDD); pMailAlong(c,kn,{x:kn.x+(ft.x-kn.x)*0.45,y:kn.y+(ft.y-kn.y)*0.45},sw,pal.primD);
    } else if(m.armor==='leather'){
      pStitchAlong(c,hip,kn,0.1,0.9,-tw*0.28,pal.primDD);
      if(!m.plates&&!m.bands){ const a1=lp(hip,kn,0.85,tw*0.4), a2=lp(kn,ft,0.18,-sw*0.4); pPoly(c,[a1.x,a1.y,lp(hip,kn,0.85,-tw*0.35).x,lp(hip,kn,0.85,-tw*0.35).y,a2.x,a2.y,lp(kn,ft,0.18,sw*0.4).x,lp(kn,ft,0.18,sw*0.4).y],pal.secD); }
    } else pAlong(c,hip,kn,0.2,0.9,0,pal.secD);
  }
  // чобіт: халява, підошва, носок
  const lifted=ft.y<-2;
  c.save(); c.translate(ft.x,ft.y); c.rotate(lifted?0.35:0);
  const pts=m.armor==='plate'?[-4.5,-8, 4,-8, 6,-4, 11,-1.5, 11,1, -4.5,1]:[-4,-8, 3.5,-8, 5,-4, 9.5,-1.5, 9.5,1, -4,1];
  pPath(c,pts); pOut(c,2); c.fillStyle=bootD; c.fill();
  pPoly(c,[-3.5,-7.5, 3.2,-7.5, 4.6,-4, 8.8,-1.6, 8.8,-0.3, -3.5,-0.3],boot);
  pLine(c,-4.5,-8,4.5,-8,PU*1.3,m.boot?(d?pal[m.boot+'DD']||pal.primDD:pal[m.boot+'D']):(d?pal.trimD:pal.trim));
  if(m.feet==='claws'){ // білі кігті на носку
    for(const [x,y,l] of [[7.5,-1.5,4.4],[10,0,3.6],[4.6,0.4,3.2]]){ pPath(c,[x-1.4,y-1.6, x+l,y+0.8, x-1,y+1.4]); pOut(c,1.2); pPoly(c,[x-1.4,y-1.6, x+l,y+0.8, x-1,y+1.4],d?pal.boneD:pal.white); }
  }
  if(hd2){
    pLine(c,-4,0.3,9.5,0.3,PU,pal.shadow);                                   // підошва
    if(m.armor==='plate'){ for(const x of [3.5,6,8.3]) pLine(c,x,-5.5+(x-3.5)*0.6,x-0.6,-0.8,PU*0.9,pal.primDD); pDot(c,1,-6,pal.white,0.9); } // сегменти сабатона
    else { pLine(c,-3,-5.2,3.5,-5.2,PU,bootD); pDot(c,1,-5.2,pal.trim,1.1); pLine(c,5.5,-3.2,8,-1.8,PU*0.9,m.armor==='cloth'?pal.leathL:bootD); } // ремінець із пряжкою
  }
  c.restore();
  if(m.plates){ const pc=d?pal[m.plates+'D']:pal[m.plates];
    pPath(c,[kn.x-3,kn.y-5, kn.x+5,kn.y-5, kn.x+6,kn.y+3, kn.x+1,kn.y+7, kn.x-3,kn.y+3]); pOut(c,2); c.fillStyle=pc; c.fill();
    if(!d) pLine(c,kn.x-1,kn.y-3.5,kn.x+4,kn.y-3.5,PU,pal[m.plates+'L']);
    if(hd2) pStitch(c,kn.x-1.5,kn.y+2,kn.x+4,kn.y+2,pal[m.plates+'D']||pal.primDD); }
  if(m.bands) drawBand(c,kn,ft,0.16,sw*1.35,5.6,pal,m.bands,d);   // червоне кільце під коліном
  if(kneeCol){ // наколінник із бічним «крильцем» і заклепкою
    if(hd2) pPoly(c,[kn.x-1,kn.y-1, kn.x-5.5,kn.y-4, kn.x-4.5,kn.y+3],pal.primD);
    pCirc(c,kn.x+1.5,kn.y,3.8,d?pal.primDD:pal.primD); pCirc(c,kn.x+1.9,kn.y-0.4,2.8,d?pal.primD:pal.primL);
    pRivet(c,kn.x+2,kn.y-0.5,kneeCol,hd2?pal.trimL:null);
  }
  if(m.glows&&m.glows.includes('knee')) glowGem(P,kn.x+2,kn.y-0.5,d);
}

/* ---------- низ: мантія / тасети / кілт ---------- */
function drawLower(P){
  const {c,S,m,pal,time}=P;
  const pel=S.pel;
  if(m.straps) drawStraps(P);
  if(m.lower==='robe'){
    const wB=S.T(-10,-4), wF=S.T(10,-4);
    const xs=[S.kneeB.x,S.kneeF.x,S.footB.x,S.footF.x];
    const back=Math.min(...xs,pel.x-11)-4, front=Math.max(...xs,pel.x+11)+4;
    const hem=Math.min(pel.y+44,Math.max(S.footB.y,S.footF.y)-3);
    const wave=Math.sin(time*4)*1.2;
    const path=()=>{ c.beginPath(); c.moveTo(wB.x,wB.y);
      c.quadraticCurveTo(back+2,(wB.y+hem)/2,back,hem-1+wave);
      c.quadraticCurveTo((back+front)/2,hem+3,front,hem-wave);
      c.quadraticCurveTo(front-2,(wF.y+hem)/2,wF.x,wF.y); c.closePath(); };
    path(); pOut(c,2); c.fillStyle=pal.primD; c.fill();
    c.save(); path(); c.clip();
    c.fillStyle=pal.prim; c.fillRect(pel.x-3,wB.y-5,front-pel.x+10,hem-wB.y+12);
    // центральна панель з облямівкою
    const cx=pel.x+5;
    pPoly(c,[cx-2,wF.y, cx+3,wF.y, cx+7,hem+4, cx-5,hem+4],pal.sec);
    pLine(c,cx-2,wF.y,cx-5,hem+4,PU*1.3,pal.trim);
    pLine(c,cx+3,wF.y,cx+7,hem+4,PU*1.3,pal.trim);
    // складки
    pLine(c,pel.x-6,wB.y+6,back+5,hem,PU,pal.primDD);
    pLine(c,pel.x+12,wF.y+8,front-4,hem,PU,pal.primD);
    if(HD()){
      pLine(c,pel.x-1,wB.y+8,(back+pel.x)/2,hem,PU,pal.primD);
      pLine(c,pel.x+15,wF.y+4,front-1,hem-4,PU,pal.primL);
      // шахова тінь на затіненому боці
      c.fillStyle=pal.primDD; for(let y=wB.y+6;y<hem;y+=PU*2) for(let x=back;x<pel.x-8;x+=PU*2) c.fillRect(x+((y/PU|0)%2?PU:0),y,PU,PU);
      pEmbroider(c,cx-0.5,wF.y+4,cx+1,hem-2,pal.accL,5);     // візерунок центральної панелі
    }
    // поділ
    c.strokeStyle=pal.trim; c.lineWidth=PU*2.6;
    c.beginPath(); c.moveTo(back,hem-1+wave); c.quadraticCurveTo((back+front)/2,hem+3,front,hem-wave); c.stroke();
    if(HD()){ // вишитий поділ: ромбики вздовж облямівки
      for(let i=1;i<10;i++){ const t=i/10, x=(1-t)*(1-t)*back+2*t*(1-t)*((back+front)/2)+t*t*front, y=(1-t)*(1-t)*(hem-1+wave)+2*t*(1-t)*(hem+3)+t*t*(hem-wave)-PU*0.2;
        pPoly(c,[x,y-PU, x+PU,y, x,y+PU, x-PU,y],pal.acc); }
    }
    c.restore();
  } else if(m.lower==='tassets'||m.lower==='kilt'){
    const kilt=m.lower==='kilt';
    const plate=(hip,kn,dim,len)=>{
      const dx=kn.x-hip.x, dy=kn.y-hip.y, L=Math.hypot(dx,dy)||1, ux=dx/L, uy=dy/L, nx=-uy, ny=ux;
      const a={x:hip.x-ux*2,y:hip.y-uy*2}, b={x:hip.x+ux*len,y:hip.y+uy*len};
      const w=kilt?7:8;
      const col=kilt?(dim?pal.secD:pal.sec):(dim?pal.primD:pal.prim);
      pPoly(c,[a.x+nx*w,a.y+ny*w, b.x+nx*(w+1),b.y+ny*(w+1), b.x-nx*(w+1),b.y-ny*(w+1), a.x-nx*w,a.y-ny*w],kilt?pal.secD:pal.primDD);
      pPoly(c,[a.x+nx*(w-1.5),a.y+ny*(w-1.5), b.x+nx*(w-0.5),b.y+ny*(w-0.5), b.x-nx*(w-2),b.y-ny*(w-2), a.x-nx*(w-2),a.y-ny*(w-2)],col);
      pLine(c,b.x+nx*(w+0.5),b.y+ny*(w+0.5),b.x-nx*(w+0.5),b.y-ny*(w+0.5),PU*1.5,kilt?(m.fur?pal.hair:pal.trim):(dim?pal.trimD:pal.trim));
      if(HD()&&!dim){
        const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
        if(kilt){ pStitch(c,a.x,a.y,b.x,b.y,pal.secD); if(m.fur) for(let k=-1;k<=1;k++) pLine(c,b.x+nx*k*w*0.6,b.y+ny*k*w*0.6,b.x+nx*k*w*0.6+ux*2.5,b.y+ny*k*w*0.6+uy*2.5,PU,pal.hairD); }
        else { pLine(c,mid.x+nx*(w-1),mid.y+ny*(w-1),mid.x-nx*(w-1),mid.y-ny*(w-1),PU,pal.primDD); pRivet(c,a.x+nx*(w-2.5)+ux*2,a.y+ny*(w-2.5)+uy*2,pal.trim,pal.trimL); pRivet(c,a.x-nx*(w-3)+ux*2,a.y-ny*(w-3)+uy*2,pal.trim,pal.trimL); }
      }
    };
    plate(S.hipB,S.kneeB,true,kilt?17:14);
    plate(S.hipF,S.kneeF,false,kilt?17:14);
  }
}

/* ---------- торс ---------- */
const TORSO_SHAPE={
  plate:[-12.5, 1, -11.4, -14, -16, -30, -16, -38, -6.8, -43, 6.8, -43, 16, -37, 18.2, -27, 13.7, -14, 12.5, 1],
  mail:[-11.4, 1, -10.3, -14, -14.8, -30, -14.8, -38, -5.7, -42, 5.7, -42, 14.8, -37, 16, -27, 12.5, -14, 11.4, 1],
  leather:[-10.3, 1, -9.1, -14, -13.7, -30, -13.7, -38, -5.7, -41, 5.7, -41, 13.7, -37, 14.8, -27, 11.4, -14, 10.3, 1],
  cloth:[-10.3, 1, -9.1, -14, -13.7, -31, -12.5, -38, -5.7, -41, 5.7, -41, 12.5, -37, 13.7, -28, 10.3, -14, 10.3, 1],
};
function drawTorso(P){
  const {c,S,m,pal}=P;
  const shp=TORSO_SHAPE[m.armor];
  c.save();
  c.translate(S.pel.x,S.pel.y); c.rotate(S.lean);
  if(m.chest) c.scale(m.chest,1);   // кремезніший тулуб
  pPath(c,shp); pOut(c,2); c.fillStyle=pal.primD; c.fill();
  c.save(); pPath(c,shp); c.clip();
  pPoly(c,[-4,-44, 20,-44, 20,2, -2,2],pal.prim);
  switch(m.armor){
    case 'plate':
      pEll(c,8,-31,6,5.5,pal.primL);
      if(HD()){
        pLine(c,6,-40,5,-17,PU,pal.primL); pLine(c,4.6,-40,3.6,-17,PU,pal.primD);   // центральне ребро нагрудника
        pLine(c,15.5,-35,12.5,-17,PU,pal.trim);                                   // гравійований край
        pDot(c,10,-33,pal.white,1.1); pDot(c,11.2,-32,pal.white,0.8);             // відблиск металу
        for(const y of [-15,-10]){ pRivet(c,-8,y+1.2,pal.trimD,pal.trimL); pRivet(c,11,y+1.2,pal.trimD,pal.trimL); pLine(c,-10,y+1,12,y+1,PU,pal.primL); }
      }
      c.strokeStyle=pal.primDD; c.lineWidth=PU;
      c.beginPath(); c.moveTo(-14,-24); c.quadraticCurveTo(2,-18,17,-24); c.stroke();
      c.strokeStyle=pal.trim; c.lineWidth=PU*1.2;
      c.beginPath(); c.moveTo(-14,-22.5); c.quadraticCurveTo(2,-16.5,17,-22.5); c.stroke();
      pLine(c,-10,-15,13,-15,PU,pal.primDD);
      pLine(c,-10,-10,12,-10,PU,pal.primDD);
      pPoly(c,[-7,-44, 8,-44, 10,-39, -8,-39],pal.trim);
      pPoly(c,[-6,-43, 7,-43, 8,-40.5, -7,-40.5],pal.trimL);
      break;
    case 'mail':
      if(HD()){ const st=PU*2; c.fillStyle=pal.primD; for(let y=-37,r=0;y<-6;y+=st,r++) for(let x=-13+(r%2?PU:0);x<16;x+=st) c.fillRect(x,y,PU,PU); } // кільчаста фактура
      else for(let y=-37;y<-6;y+=3.2) for(let x=-12+((y|0)%2?1.6:0);x<15;x+=3.2) pDot(c,x,y,pal.primD,0.9);
      pEll(c,8,-30,4,4,pal.primL);
      pPoly(c,[-9,-43, 8,-43, 11,-37, -10,-37],pal.leath);
      pLine(c,-9,-37,11,-37,PU*1.2,pal.trim);
      break;
    case 'leather':
      if(m.plain){ drawDarkChest(P); break; }
      pLine(c,12,-38,-10,-8,4.5,pal.secD);
      pLine(c,12,-38,-10,-8,2.2,pal.sec);
      pDot(c,1,-23,pal.trim,1.6);
      if(HD()){
        pStitch(c,7.5,-37,6.5,-9,pal.primDD);                                   // центральний шов
        pStitch(c,-11,-33,-8,-12,pal.primDD);
        for(const t of [0.15,0.45,0.78]){ const x=12-22*t, y=-38+30*t; pRivet(c,x,y,pal.trim,pal.trimL); } // заклепки на ремені
        pLine(c,-1,-24,3,-22,PU,pal.trimL);
      }
      pPoly(c,[-7,-42, 7,-42, 9,-37, -8,-37],pal.sec);
      pLine(c,9,-34,9,-8,PU,pal.primDD);
      break;
    default: // тканина
      pPoly(c,[-2,-42, 10,-42, 5,-28],pal.sec);
      pLine(c,-2,-42,5,-28,PU*1.3,pal.trim);
      pLine(c,10,-42,5,-28,PU*1.3,pal.trim);
      pLine(c,5,-28,5,0,3.4,pal.trim);
      pLine(c,5,-28,5,0,PU,pal.trimL);
      pLine(c,-6,-30,-7,-4,PU,pal.primDD);
      if(HD()){
        pEmbroider(c,5,-26,5,-2,pal.acc,4);                                      // вишита центральна смуга
        pEmbroider(c,0,-40,4.5,-30,pal.acc,3.5); pEmbroider(c,9,-40,5.5,-30,pal.acc,3.5);
        pLine(c,11,-34,9,-10,PU,pal.primL); pLine(c,-2,-36,-3,-10,PU,pal.primD);  // складки
      }
  }
  if(m.plates){ // нагрудна пластина
    // V-подібна накладка під коміром + ремінь-перев'язь
    pPath(c,[0,-42, 14,-40, 9,-30]); pOut(c,2);
    pPoly(c,[0,-42, 14,-40, 9,-30],pal[m.plates]);
    pLine(c,2,-41,11,-39.5,PU,pal[m.plates+'L']);
    pLine(c,14,-36,-8,-10,3,pal[m.plates+'D']);
    pDot(c,4,-22,pal.trim,1.6);
  }
  if(m.panels&&m.armor==='plate'){ // центральна вставка нагрудника іншого кольору
    pPoly(c,[1,-38, 11,-38, 12,-27, 6,-19, 0,-27],pal[m.panels]); pLine(c,1.5,-37,10.5,-37,PU,pal[m.panels+'L']);
    if(HD()) pLine(c,6,-35,6,-22,PU,pal[m.panels+'D']); }
  if(m.glows&&m.glows.includes('chest')) glowGem(P,7,-28,false,2.6);
  if(m.sash){ pLine(c,14,-38,-9,-8,4,pal[m.sash+'D']); pLine(c,14,-38,-9,-8,2.4,pal[m.sash]); }
  if(m.collar) drawCollar(P);
  if(m.gem){ pCirc(c,8,-29,2.6,pal.trimD); pCirc(c,8,-29,1.8,pal.acc); addLight(P,8,-29,6,pal.acc,0.6); }
  c.restore();
  // пояс
  const beltCol=m.belt?pal[m.belt]:m.plates?pal[m.plates]:(m.armor==='cloth'?pal.sec:(m.armor==='plate'?pal.primDD:pal.leath));
  pPath(c,[-11,-7, 12,-7, 12,-1, -11,-1]); pOut(c,1.2);
  pPoly(c,[-11,-7, 12,-7, 12,-1, -11,-1],beltCol);
  pLine(c,-11,-6.5,12,-6.5,PU,m.belt?pal[m.belt+'L']:(m.armor==='cloth'?pal.trim:pal.leathD));
  if(m.belt) pLine(c,-11,-1.6,12,-1.6,PU,pal[m.belt+'D']);
  if(HD()&&m.armor!=='cloth'&&!m.belt){ pStitch(c,-10,-2.2,3,-2.2,pal.leathD); pPoly(c,[-9,-6, -4,-6, -4,1, -9,1],pal.leathD); pPoly(c,[-8.5,-6, -4.5,-6, -4.5,-3.5, -8.5,-3.5],pal.leath); pDot(c,-6.5,-4,pal.trim,1); } // підсумок
  pPath(c,[4,-8, 10,-8, 10,0, 4,0]); pOut(c,1.2);
  pPoly(c,[4,-8, 10,-8, 10,0, 4,0],pal.trim);
  pPoly(c,[5.5,-6.5, 8.5,-6.5, 8.5,-1.5, 5.5,-1.5],pal.trimD);
  if(HD()){ pLine(c,4.6,-7.4,9.4,-7.4,PU,pal.trimL); pDot(c,7,-4,pal.trimL,1); }
  if(m.armor==='cloth'){ pLine(c,-6,-2,-9,10,2.4,pal.secD); } // кінець пояса
  c.restore();
}

/* ---------- табард ---------- */
function drawTabard(P){
  const {c,S,m,pal}=P;
  const tb=m.tabard;
  const a=S.T(3,-3), b=S.T(14,-3);
  const kn=S.kneeF, bottom=S.pel.y+30;
  const sway=(kn.x-S.pel.x)*0.25;
  pPath(c,[a.x,a.y, b.x,b.y, b.x+sway+1,bottom, a.x+sway-1,bottom+2]); pOut(c,1.6);
  pPoly(c,[a.x,a.y, b.x,b.y, b.x+sway+1,bottom, a.x+sway-1,bottom+2],pal.tabD);
  pPoly(c,[a.x+1.2,a.y, b.x-1.2,b.y, b.x+sway,bottom-1.2, a.x+sway,bottom+0.8],pal.tab);
  if(tb.full){ // світліші фіолетові смуги по краях панелі
    pLine(c,a.x+1.8,a.y+1,a.x+sway+0.8,bottom-0.5,2.2,pal.tabM); pLine(c,b.x-1.8,b.y+1,b.x+sway-1,bottom-1.5,2.2,pal.tabM);
  }
  pLine(c,a.x+sway,bottom+1,b.x+sway,bottom,PU*1.2,pal.trim);
  const ex=(a.x+b.x)/2+sway*0.5, ey=(a.y+bottom)/2;
  drawEmblem(c,tb.emblem,ex,ey,3.6,pal.trim,pal.tabD);
  // емблема і на грудях
  c.save(); c.translate(S.pel.x,S.pel.y); c.rotate(S.lean);
  if(tb.full){ // табард на всю грудь, як у референсі
    pPath(c,[-3,-41, 16,-38, 16,-6, -3,-6]); pOut(c,1.6);
    pPoly(c,[-3,-41, 16,-38, 16,-6, -3,-6],pal.tab);
    pPoly(c,[-3,-41, 2,-41, 1,-6, -3,-6],pal.tabD);
    pLine(c,15,-37,15,-7,2,pal.tabM);
    drawEmblem(c,tb.emblem,8,-24,6.2,pal.trim,pal.trimD);
  } else {
    pPoly(c,[2,-38, 14,-36, 13,-17, 2,-17],pal.tab);
    pLine(c,2,-17,13,-17,PU*1.2,pal.trim);
    drawEmblem(c,tb.emblem,8,-27,3.4,pal.trim,pal.tabD);
  }
  c.restore();
}
function drawEmblem(c,kind,x,y,r,col,dark){
  switch(kind){
    case 'sun': pCirc(c,x,y,r*0.6,col); for(let i=0;i<8;i++){ const a=i*Math.PI/4; pLine(c,x+Math.cos(a)*r*0.7,y+Math.sin(a)*r*0.7,x+Math.cos(a)*r*1.25,y+Math.sin(a)*r*1.25,PU*0.9,col);} break;
    case 'cross': pPoly(c,[x-r*0.3,y-r*1.1, x+r*0.3,y-r*1.1, x+r*0.3,y+r*1.1, x-r*0.3,y+r*1.1],col); pPoly(c,[x-r,y-r*0.45, x+r,y-r*0.45, x+r,y+r*0.15, x-r,y+r*0.15],col); break;
    case 'lion': pCirc(c,x,y,r,col); pCirc(c,x+r*0.3,y+r*0.1,r*0.55,dark); pDot(c,x+r*0.45,y-r*0.2,col); break;
    case 'skull': pCirc(c,x,y-r*0.2,r*0.8,col); pPoly(c,[x-r*0.5,y+r*0.3, x+r*0.5,y+r*0.3, x+r*0.3,y+r, x-r*0.3,y+r],col); pDot(c,x-r*0.3,y-r*0.2,dark); pDot(c,x+r*0.35,y-r*0.2,dark); break;
    case 'horde': pPoly(c,[x,y-r, x+r*0.8,y+r, x,y+r*0.4, x-r*0.8,y+r],col); break;
    case 'eye': pEll(c,x,y,r,r*0.55,col); pCirc(c,x,y,r*0.35,dark); break;
    case 'palasym': // емблема паладина: меч вістрям донизу з крилами-дугами
      pPoly(c,[x-r*0.2,y-r*1.15, x+r*0.2,y-r*1.15, x+r*0.2,y+r*0.55, x,y+r*1.25, x-r*0.2,y+r*0.55],col);
      pHorn(c,x,y-r*0.55,x-r*0.8,y-r*0.45,x-r*1.25,y-r*1.05,r*0.34,col);
      pHorn(c,x,y-r*0.55,x+r*0.8,y-r*0.45,x+r*1.25,y-r*1.05,r*0.34,col);
      pHorn(c,x,y+r*0.1,x-r*0.55,y+r*0.2,x-r*0.8,y-r*0.2,r*0.24,col);
      pHorn(c,x,y+r*0.1,x+r*0.55,y+r*0.2,x+r*0.8,y-r*0.2,r*0.24,col);
      pDot(c,x,y-r*0.55,dark,1.2);
      break;
    default: pPoly(c,[x,y-r, x+r*0.8,y, x,y+r, x-r*0.8,y],col);
  }
}

/* ---------- голова та раса ---------- */
function drawHead(P){
  const {c,S,m,pal}=P;
  const hd=S.head;
  pLimb(c,S.neck,{x:hd.x-1,y:hd.y+6},7,pal.skin,pal.skinD);
  c.save(); c.translate(hd.x,hd.y); c.rotate(hd.a);
  if(m.headScale) c.scale(m.headScale,m.headScale);
  const helm=m.helm||{t:'none'};
  const race=m.race;
  const bald=race==='ghoul'||race==='infernal';
  const hidesHair=['helm','skull','hood','beast','hat','bandana'].includes(helm.t)||helm.t==='cowl'||race==='draenei'||bald;
  // волосся ззаду (довге — під капюшоном не видно)
  if(!hidesHair && m.longHair) pPoly(c,[-10,-6, -3,-10, -2,6, -8,16, -13,12],pal.hairD);
  // вуха (під шоломом ховаються, крім ельфів)
  if(race==='nelf'||race==='belf') pPoly(c,[-3,-1, -15,-15, -12,-2, -2,3],pal.skinD);
  if(race==='troll') pPoly(c,[-3,-2, -21,-9, -16,-1, -2,3],pal.skinD);                 // довгі вуха вбік
  if(race==='ghoul'||race==='demon') pPoly(c,[-3,-1, -14,-11, -10,-1, -2,3],pal.skinD); // гострі обдерті вуха
  if(race==='draenei'){ // гострі вуха назад і кістяний гребінь на потилиці
    pPath(c,[-2,-3, -15,-9, -12,-5, -3,3]); pOut(c,1.6); pPoly(c,[-2,-3, -15,-9, -12,-5, -3,3],pal.skinD); pLine(c,-4,-2,-12,-7,PU,pal.skinDD);
    pPoly(c,[-10,-6, -13,-11, -7,-10],pal.tendrilD); pPoly(c,[-5,-10, -7,-14, -1,-12],pal.tendrilD);
  }
  // обличчя
  c.beginPath(); c.ellipse(0,0,9,10.5,0,0,7); pOut(c,2);
  pEll(c,0,0,9,10.5,pal.skinD);
  pEll(c,1,-0.6,8.2,9.6,pal.skin);
  if(race==='tauren'){ pEll(c,8,3,7,5.5,pal.skinD); pEll(c,9,2.4,5.5,4.4,pal.skin); pDot(c,13,2,pal.shadow); }
  else if(race==='infernal'){ // кам'яна брила замість обличчя: надбрівний виступ і тріщини фелу
    pPoly(c,[1,-6, 10,-6.5, 9,-2.5, 1,-3],pal.skinD);
    for(const [x1,y1,x2,y2] of [[-6,-7,-1,1],[-1,1,4,7],[-7,3,-2,6]]) pLine(c,x1,y1,x2,y2,PU*1.2,pal.acc);
    addLight(P,-1,1,7,pal.acc,0.5);
  }
  else {
    pPoly(c,[2,4, 9,2.5, 8.5,7.5, 2,10],pal.skin);
    pPoly(c,[8.5,-2, 11.5,2.2, 8.5,3.2],pal.skinD); // ніс
  }
  if(race==='orc'){ pPoly(c,[6,5.5, 8,1.2, 9.2,5.8],pal.white); pPoly(c,[-1,-3, -9,-8, -6,-1],pal.skinD); }
  if(race==='demon') pPoly(c,[6,5.5, 8.5,0.2, 9.6,5.8],pal.bone);                     // ікла
  if(race==='troll'){ pPoly(c,[5,6, 9,-3, 10,6],pal.bone); pPoly(c,[8,6.5, 13,-1, 12.5,7],pal.white); } // великі бивні вгору
  if(race==='ghoul'||race==='undead'){ // оголена щелепа: темна щока й зуби
    pPoly(c,[3,4, 10,3.5, 9.5,8.5, 3,9],pal.skinDD); for(let i=0;i<4;i++) pDot(c,4.5+i*1.6,5.4,pal.bone,1);
    if(race==='ghoul') pLine(c,-5,-4,1,-7,PU,pal.skinDD);                                      // шов на черепі
  }
  if(race==='draenei'){
    pLine(c,2,-5.4,9.5,-4.8,PU*1.6,pal.skinD);                        // масивна надбрівна дуга
    pLine(c,-5,-9,3,-11,PU,pal.skinL);                                  // відблиск на черепі
  }
  // око, брова, рот, вухо
  if(m.glowEye){ pDot(c,5.5,-2,pal.eye,1.5); addLight(P,5.5,-2,5,pal.eye,0.8); }
  else if(HD()){ // око не менше 2×2 арт-пікселів, інакше зникає при квантизації
    const ew=Math.max(3.6,PU*2.6), eh=Math.max(2.2,PU*1.9);
    c.fillStyle=pal.white; c.fillRect(3.6,-2-eh/2,ew,eh);
    c.fillStyle=pal.shadow; c.fillRect(3.6+ew-Math.max(1.6,PU*1.3),-2-eh/2,Math.max(1.6,PU*1.3),eh);
    pLine(c,3.2,-2-eh/2-1.4,4+ew,-2-eh/2-1.2,Math.max(PU*1.1,1.2),pal.hairD); }
  else { pDot(c,5.5,-2,pal.shadow,1.25); pLine(c,3.5,-4.6,8,-4.2,PU*0.9,pal.hairD); }
  if(HD()&&race!=='tauren'&&race!=='infernal'&&race!=='ghoul'){
    pLine(c,6.2,6.2,9.2,5.8,PU,pal.skinDD);                                     // рот
    pLine(c,1,8.5,7,9,PU,pal.skinD);                                            // тінь підборіддя
    if(race!=='nelf'&&race!=='belf'){ pEll(c,-2.5,0.5,2,3,pal.skinD); pLine(c,-2.6,-1,-2.2,2,PU*0.8,pal.skinDD); } // вухо
    pDot(c,2,-6.5,pal.skinL,1);                                                  // відблиск на лобі
  }
  if(m.beard) pPoly(c,[0,4, 9,4, 7,13, 1,14, -3,8],pal.hair);
  // зачіска
  if(!hidesHair){
    if(race==='tauren'){ drawHornPair(c,pal.bone,pal.boneD); }
    else if(race==='demon'){ if(m.mohawk) pPoly(c,[-8,-6, -6,-12, 2,-14, 6,-11, 0,-9, -5,-4],pal.hair); drawHornPair(c,'#5a4a3a','#2e241c'); }
    else if(m.mohawk){ pPoly(c,[-8,-6, -6,-12, 2,-14, 6,-11, 0,-9, -5,-4],pal.hair); pPoly(c,[-4,-10, 0,-19, 3,-12],pal.hair); }
    else{
      pPoly(c,[-9.5,3, -10.5,-5, -6,-11, 2,-12.5, 9,-8.5, 8,-5.5, 1,-7.5, -3,-3, -6,4],pal.hair);
      if(HD()){ // пасма й відблиск
        pLine(c,-7,-8,-8,2,PU,pal.hairD); pLine(c,-3,-10,-5,-3,PU,pal.hairD); pLine(c,2,-11,-1,-7,PU,pal.hairD);
        pLine(c,-4,-11.3,4,-11.5,PU,pal.hairL);
      }
    }
  }
  drawHelm(P,helm);
  c.restore();
}
function drawHornPair(c,col,dark){
  pHorn(c,-5,-8,-12,-18,-4,-24,5,dark);
  pHorn(c,2,-9,-4,-19,6,-24,5.5,col);
}

/* ---------- шоломи/капюшони/капелюхи (система голови) ---------- */
function drawHelm(P,h){
  const {c,pal,m,time}=P;
  const hc=pal[h.col||'prim'], hcD=pal[(h.col||'prim')+'D']||pal.primD, hcL=pal[(h.col||'prim')+'L']||pal.primL;
  switch(h.t){
    case 'peakhood': drawPeakHood(P,h,hc,hcD,hcL); break;
    case 'hood': case 'cowl':{
      const deep=h.t==='hood';
      const outer=h.spiky
        ? ()=>{ c.moveTo(9,10); c.lineTo(12.5,3); c.quadraticCurveTo(14,-10,5,-17); c.lineTo(2,-24);
            c.lineTo(-3,-16); c.lineTo(-14,-22); c.lineTo(-11,-11); c.lineTo(-23,-10); c.lineTo(-15,-3);
            c.lineTo(-22,4); c.lineTo(-15,6); c.lineTo(-15,12); c.lineTo(-8,17); c.lineTo(4,15); c.closePath(); }
        : ()=>{ c.moveTo(9,10); c.lineTo(12,3); c.quadraticCurveTo(13,-10,3,-15);
            c.quadraticCurveTo(-8,-17,-13,-8); c.lineTo(-19,-4); c.lineTo(-15,2); c.lineTo(-15,12); c.lineTo(-8,17); c.lineTo(4,15); c.closePath(); };
      c.beginPath(); outer(); pOut(c,2);
      c.beginPath(); outer(); c.ellipse(6,1.5,deep?(h.fangs?6.6:5.6):6.6,deep?(h.fangs?9:8.2):9,0,0,7,true);
      c.fillStyle=hc; c.fill('evenodd');
      c.save(); c.beginPath(); outer(); c.clip();
      pPoly(c,[-20,-20, -4,-20, -6,20, -20,20],hcD);
      c.strokeStyle=hcL; c.lineWidth=PU; c.beginPath(); c.moveTo(-4,-14); c.quadraticCurveTo(6,-14,10,-6); c.stroke();
      if(HD()){ // складки тканини
        c.strokeStyle=hcD; c.beginPath(); c.moveTo(-2,-13); c.quadraticCurveTo(-8,-6,-7,8); c.stroke();
        c.beginPath(); c.moveTo(-9,-8); c.quadraticCurveTo(-13,0,-12,12); c.stroke();
      }
      c.restore();
      if(HD()){ c.strokeStyle=pal.secD; c.lineWidth=PU*1.2; c.beginPath(); c.ellipse(6,1.5,deep?(h.fangs?7.4:6.4):7.4,deep?(h.fangs?9.8:9):9.8,0,-1.6,1.9); c.stroke(); } // підкладка навколо обличчя
      if(deep){
        pEll(c,6,1.5,h.fangs?6.6:5.6,h.fangs?9:8.2,pal.shadow);
        if(h.mask){ c.save(); c.beginPath(); c.ellipse(6,1.5,5.6,8.2,0,0,7); c.clip(); pPoly(c,[0,3.6, 13,2.6, 13,12, 0,12],pal[h.mask]||pal.sec); pLine(c,0,4.2,13,3.2,PU,pal.trim); c.restore(); }
        if(h.fangs){ // білий іклистий оскал у чорноті каптура
          pPoly(c,[2.5,2, 4.2,6.5, 6,2.8, 7.8,7.5, 9.6,3, 11.2,6, 12,2, 7,0.6],pal.white);
        } else {
          pDot(c,7.5,-1,pal.eye,1.35); pDot(c,10.6,-1.2,pal.eye,1.1);
          addLight(P,9,-1,3.5,pal.eye,0.5);
        }
      }
      if(!deep){ c.strokeStyle=pal.trim; c.lineWidth=PU*1.1;
        c.beginPath(); c.ellipse(6,1.5,6.9,9.3,0,-1.9,2.1); c.stroke(); }
      if(h.horns) drawHornPair(c,pal.bone,pal.boneD);
      break;
    }
    case 'helm': case 'open':{
      const open=h.t==='open';
      if(open){
        pPath(c,[-11,4, -12,-5, -7,-13, 3,-14.5, 10,-10, 11.5,-4, 4,-5, 3,3, -3,5]); pOut(c,2);
        pPoly(c,[-11,4, -12,-5, -7,-13, 3,-14.5, 10,-10, 11.5,-4, 4,-5, 3,3, -3,5],hcD);
        pPoly(c,[-10,3, -11,-5, -6.5,-12, 3,-13.5, 9.5,-9.5, 10.5,-5, 4,-6, 2.5,2, -3,4],hc);
        pLine(c,-6,-12,8,-11,PU,hcL);
        pLine(c,10,-5,10.5,3,2.2,hcD); // наносник
        pLine(c,-10.5,-4,10.5,-5,PU*1.3,pal.trim);
        if(HD()){ pRivet(c,-7,-4.2,pal.trimD,pal.trimL); pRivet(c,0,-4.6,pal.trimD,pal.trimL); pLine(c,3.5,-4,5.5,3.5,PU,hcD); pDot(c,1,-10,pal.white,1); }
      } else {
        pPath(c,[-11.5,6, -12,-4, -8,-13, 2,-14.5, 11,-11, 13,-3, 12.5,8, 5,11, -4,11]); pOut(c,2); c.fillStyle=hcD; c.fill();
        pPath(c,[-10.5,5, -11,-4, -7.5,-12, 2,-13.5, 10.5,-10, 12,-3, 11.5,7.5, 5,10, -3,10]); c.fillStyle=hc; c.fill();
        c.save(); pPath(c,[-10.5,5, -11,-4, -7.5,-12, 2,-13.5, 10.5,-10, 12,-3, 11.5,7.5, 5,10, -3,10]); c.clip();
        pPoly(c,[-14,-16, -4,-16, -4,14, -14,14],hcD);
        c.restore();
        pLine(c,-6,-12,8,-11,PU,hcL);
        pLine(c,9,-12,10.5,8,PU,hcL);
        pPoly(c,[2.5,-3.4, 12.8,-3.8, 12.8,-1, 2.5,-0.8],pal.shadow);
        if(m.glowEye){ pDot(c,8,-2.2,pal.eye,1.3); addLight(P,8,-2,5,pal.eye,0.8); }
        if(HD()){ for(const [x,y] of [[8,3],[10,3.3],[12,3.6],[8.5,5.5],[10.5,5.8]]) pDot(c,x,y,pal.shadow,0.9); } // дихальна решітка
        else { pDot(c,9,4,pal.shadow,0.9); pDot(c,11,4.5,pal.shadow,0.9); }
        pLine(c,-11,3,12,5,PU*1.2,pal.trim);
        if(HD()){ for(const x of [-8,-3,2,7]) pRivet(c,x,3.5+(x+11)*0.087,pal.trimD,pal.trimL); pDot(c,5,-9,pal.white,1); pLine(c,-2,-13,-4,6,PU,hcD); }
      }
      drawCrest(P,h);
      break;
    }
    case 'skull':{
      pPath(c,[-12,6, -12.5,-5, -7,-13, 3,-14, 9,-10, 3,6]); pOut(c,2); c.fillStyle=hcD; c.fill();
      pPath(c,[-11,5, -11.5,-5, -6.5,-12, 3,-13, 8,-9.5, 2,5]); c.fillStyle=hc; c.fill();
      pEll(c,5,-2,7,8,pal.boneD); pEll(c,5.6,-2.6,6.2,7.2,pal.bone);
      pPoly(c,[3,5, 11,4.5, 10,10, 4,10.5],pal.bone);
      pEll(c,7,-3,2.4,2.2,pal.shadow); pDot(c,7.3,-3,pal.eye,1.3); addLight(P,7.3,-3,6,pal.eye,1);
      pPoly(c,[9.5,1, 11.5,3.5, 9,3.5],pal.shadow);
      for(let x=5;x<=10;x+=2.2) pLine(c,x,5.8,x,8.6,PU*0.8,pal.boneD);
      drawCrest(P,h);
      break;
    }
    case 'hat':{
      const sway=Math.sin(time*2.3)*1.5;
      pPoly(c,[-9,-8, 10,-9, 3,-24, -8+sway,-34, -22+sway,-30, -12+sway,-27, -6,-22],hcD);
      pPoly(c,[-7,-8.5, 8.5,-9.5, 2.5,-23, -8+sway,-32.5, -19+sway,-30, -11+sway,-26.5, -5.5,-21],hc);
      pEll(c,0,-8,17,3.6,hcD); pEll(c,0.5,-8.8,16,2.6,hc);
      pPoly(c,[-8,-12, 9,-13, 8.5,-9.5, -7.5,-8.5],pal.trim);
      pDot(c,3,-17,pal.acc,1.6); addLight(P,3,-17,5,pal.acc,0.6);
      break;
    }
    case 'circlet': case 'crown':{
      pLine(c,-10,-4,10,-6.5,PU*1.8,pal.trim);
      if(h.t==='crown') for(const x of [-7,-2,3,8]) pPoly(c,[x-2,-5.5, x,-12-(x===3?3:0), x+2,-6],pal.trim);
      pDot(c,9.5,-6.5,pal.acc,1.8); addLight(P,9.5,-6.5,5,pal.acc,0.7);
      break;
    }
    case 'ranger':{
      pEll(c,-1,-8,16,3.4,hcD);
      pPoly(c,[-9,-8, -7,-16, 4,-17, 9,-9],hc);
      pLine(c,-8.5,-9.5,8.5,-10,PU*1.6,pal.leath);
      pHorn(c,-6,-12,-14,-24,-24,-22,3.5,pal.acc);
      break;
    }
    case 'beast':{
      // шкура з головою звіра зверху
      pPath(c,[8,-6, 6,-13, -4,-16, -12,-10, -16,0, -15,14, -8,16, -6,4, 0,-4]); c.fillStyle=pal[h.fur||'sec']; c.fill();
      pPoly(c,[-14,2, -16,14, -9,16, -7,6],pal[(h.fur||'sec')+'D']||pal.secD);
      const sk=pal[h.skull||'bone'], skD=pal[(h.skull||'bone')+'D']||pal.boneD;
      // масивна голова звіра: широкий череп, важка морда з носом, ікла — щоб на малому масштабі читався вовк/ведмідь, а не пташка
      const head=[-9,-7, -10,-15, -4,-20, 6,-21, 13,-17, 24,-14, 26,-9, 24,-5, 13,-4, 4,-5, -4,-5];
      if(!h.horns){ for(const e of [[-9,-15, -10,-25, -3,-19],[-3,-19, 1,-27, 5,-20]]){ pPath(c,e); pOut(c,1.8); pPoly(c,e,skD); } }
      pPath(c,head); pOut(c,2); pPoly(c,head,skD);
      pPoly(c,[-8,-8, -9,-15, -4,-19, 6,-20, 12,-16.5, 23,-13, 24.5,-9.5, 13,-8.5, 4,-8.5, -4,-8],sk);
      pLine(c,-4,-18,10,-18.5,PU,pal.white);                          // відблиск на черепі
      pLine(c,13,-15.5,23,-12.5,PU,pal.white);                        // відблиск на морді
      pPoly(c,[2,-15, 10,-16, 9,-12.5, 2,-12.5],skD);                  // надбрівна дуга
      pEll(c,7,-12,2.6,2,pal.shadow); pDot(c,7.6,-12,m.glowEye?pal.eye:pal.shadow,1.4); if(m.glowEye) addLight(P,7.6,-12,6,pal.eye,0.9);
      pEll(c,24.5,-11.5,2.2,1.8,pal.shadow);                           // ніс
      for(const x of [14,20]) pPoly(c,[x,-5, x+1.4,-0.5, x+2.8,-5],pal.white); // ікла
      pLine(c,13,-6.5,23.5,-6,PU,skD);
      if(h.horns) { pHorn(c,-3,-17,-11,-29,-2,-35,5,pal.bone); }
      break;
    }
    case 'antlers':{
      pLine(c,-8,-10,-12,-26,2.6,pal.woodD);
      pLine(c,-10.5,-19,-19,-22,2.2,pal.woodD);
      pLine(c,-2,-11,-3,-29,2.8,pal.wood);
      pLine(c,-2.6,-21,-10,-27,2.3,pal.wood);
      pLine(c,-2.7,-24,4,-31,2.2,pal.wood);
      pEll(c,-5,-10,4,2.4,pal.acc,-0.4); pEll(c,2,-11,3.4,2,pal.accD,0.3);
      break;
    }
    case 'feathers':{
      pLine(c,-10,-4,10,-6.5,PU*1.8,pal.trim);
      pHorn(c,-7,-6,-12,-16,-20,-22,3.6,pal.white);
      pHorn(c,-5,-7,-8,-18,-12,-27,3.6,pal.acc);
      pDot(c,-8,-5,pal.acc,1.8);
      break;
    }
    case 'horns':{
      if(h.hood){ drawHelm(P,{t:'hood',col:h.col}); }
      pHorn(c,-4,-9,-18,-14,-14,-1,5.5,pal.boneD);
      pHorn(c,1,-10,-10,-24,-19,-15,6,pal.bone);
      if(!h.hood){ pDot(c,5.5,-2,pal.eye,1.5); addLight(P,5.5,-2,5,pal.eye,0.8); }
      break;
    }
    case 'bandana':{
      pPoly(c,[-10,-1, -10.5,-7, -5,-12.5, 3,-13.5, 10,-9, 10.5,-5, -2,-4],hc);
      pPoly(c,[-9,-5, -18,-2+Math.sin(time*6), -16,2, -8,0],hcD);
      pPoly(c,[1,2.4, 12,1.2, 11.5,9, 3,11],pal[h.mask||'sec']);
      break;
    }
  }
  if(h.halo){
    c.strokeStyle=pal.accL; c.lineWidth=PU*1.1;
    c.beginPath(); c.ellipse(-3,-19,7,2.2,-0.15,0,7); c.stroke();
    addLight(P,-3,-19,9,pal.acc,0.6);
  }
}
function drawCrest(P,h){
  const {c,pal,time}=P;
  const cc=pal[h.crestCol||'trim'], ccD=pal[(h.crestCol||'trim')+'D']||pal.trimD;
  switch(h.crest){
    case 'plume':
      pHorn(c,0,-13,-10,-24,-22,-6+Math.sin(time*5),5.5,ccD);
      pHorn(c,1,-14,-9,-23,-20,-8+Math.sin(time*5),4,cc);
      break;
    case 'horns':
      pHorn(c,-6,-9,-16,-14,-15,-27,5,pal.boneD);
      pHorn(c,-2,-10,-8,-20,4,-26,5.5,pal.bone);
      break;
    case 'bighorns':
      pHorn(c,-6,-9,-24,-12,-24,-30,6.5,pal.boneD);
      pHorn(c,-1,-10,-16,-20,-8,-34,7,pal.bone);
      break;
    case 'wings':{ // крило збоку шолома: пір'я віялом назад-угору
      const wc=pal.trimL, wd=pal.trim;
      pPoly(c,[-4,-6, -10,-18, -18,-26, -17,-19, -24,-20, -18,-12, -22,-10, -12,-4],wd);
      pPoly(c,[-4,-7, -10,-17, -16,-23, -15,-17, -20,-17, -15,-11, -18,-9, -11,-5],wc);
      pLine(c,-6,-8,-15,-20,PU,wd);
      break;
    }
    case 'spikes':
      for(const [x,y,a] of [[-8,-11,-2.4],[-2,-14,-1.9],[5,-13,-1.4]]) pPoly(c,[x-2.5,y+1, x+Math.cos(a)*10,y+Math.sin(a)*10, x+2.5,y+1],cc);
      break;
    case 'crown':
      pLine(c,-11,-7,11,-9,PU*1.8,cc);
      for(const x of [-8,-3,2,7]) pPoly(c,[x-2,-8, x,-15-(x===2?3:0), x+2,-8.5],cc);
      pDot(c,2,-9,pal.acc,1.6);
      break;
    case 'fin':
      pPoly(c,[9,-10, 4,-24, -10,-26, -18,-16, -8,-13],ccD);
      pPoly(c,[8,-11, 4,-22, -9,-24, -15,-16, -7,-13.5],cc);
      break;
    case 'blade':{ // високий гребінь-лезо посередині (Wrath)
      pPath(c,[-3,-12, -1,-30, 3,-36, 5,-24, 4,-12]); pOut(c,1.6);
      pPoly(c,[-3,-12, -1,-30, 3,-36, 5,-24, 4,-12],ccD); pPoly(c,[-1.5,-12, 0,-28, 3,-33, 3.5,-24, 2.8,-12],cc);
      pHorn(c,-6,-9,-12,-16,-11,-27,4,ccD); break; }
    case 'ramhorns': // закручені роги барана збоку шолома
      c.lineCap='round'; c.strokeStyle=OL; c.lineWidth=6+PU*1.6; c.beginPath(); c.moveTo(-3,-10); c.quadraticCurveTo(-14,-18,-15,-6); c.quadraticCurveTo(-15,3,-8,1); c.stroke();
      c.strokeStyle=cc; c.lineWidth=6; c.stroke();
      c.strokeStyle=ccD; c.lineWidth=PU; c.beginPath(); c.moveTo(-6,-14); c.lineTo(-9,-11); c.moveTo(-12,-13); c.lineTo(-11,-9); c.moveTo(-14,-6); c.lineTo(-11,-5); c.stroke();
      break;
    case 'tusks':
      pHorn(c,6,6,14,8,16,-2,3.8,pal.bone);
      pHorn(c,2,7,8,12,10,4,3.2,pal.boneD);
      break;
    case 'mohawk':
      for(let i=0;i<4;i++) pPoly(c,[-8+i*4,-12, -10+i*4,-21-i%2*3, -5+i*4,-13],cc);
      break;
  }
}

/* ============================================================
   ДЕТАЛІ СЕТІВ ЗА РЕФЕРЕНСАМИ (перевикористовуються різними сетами)
   ============================================================ */
// товсте кільце-браслет поперек кінцівки a→b на частці t (w — ширина поперек, th — товщина вздовж)
function drawBand(c,a,b,t,w,th,pal,col,dim){
  const p1=lp(a,b,t-th/2/Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)),0), p2=lp(a,b,t+th/2/Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)),0);
  const dx=p2.x-p1.x, dy=p2.y-p1.y, L=Math.hypot(dx,dy)||1, nx=-dy/L*w/2, ny=dx/L*w/2;
  const q=[p1.x+nx,p1.y+ny, p2.x+nx,p2.y+ny, p2.x-nx,p2.y-ny, p1.x-nx,p1.y-ny];
  pPath(c,q); pOut(c,1.4); c.fillStyle=dim?pal[col+'D']:pal[col]; c.fill();
  if(!dim){
    // світла грань угорі й темна знизу — кільце виглядає опуклим
    const L1=lp(a,b,t,w*0.36), L2=lp(a,b,t,-w*0.1);
    pLine(c,p1.x+nx*0.85,p1.y+ny*0.85,p2.x+nx*0.85,p2.y+ny*0.85,PU*1.2,pal[col+'L']);
    pLine(c,p1.x-nx*0.8,p1.y-ny*0.8,p2.x-nx*0.8,p2.y-ny*0.8,PU,pal[col+'D']);
    if(HD()) pLine(c,p1.x,p1.y,p2.x,p2.y,PU*0.9,pal[col+'D']);
    void L1; void L2;
  }
}
// рвані клапті-шлейф (за заднім плечем): кольорові язики з темними кінчиками
function drawFlaps(c,pal,col,s,time){
  const sw=Math.sin(time*3)*1.2;
  const flaps=[[-6,-6,-30,-17],[-8,-2,-33,-6],[-8,2,-31,5],[-6,5,-25,13]];
  flaps.forEach(([x0,y0,x1,y1],i)=>{
    const tx=(x1+(i%2?sw:-sw))*s, ty=(y1+sw*0.5)*s, bx=x0*s, by=y0*s;
    const nx=-(ty-by), ny=tx-bx, L=Math.hypot(nx,ny)||1, w=(4.2-i*0.4)*s;
    const q=[bx+nx/L*w,by+ny/L*w, tx,ty, bx-nx/L*w,by-ny/L*w];
    pPath(c,q); pOut(c,1.6); c.fillStyle=pal[col+'D']; c.fill();
    const q2=[bx+nx/L*w*0.6,by+ny/L*w*0.6, bx+(tx-bx)*0.8,by+(ty-by)*0.8, bx-nx/L*w*0.2,by-ny/L*w*0.2];
    pPoly(c,q2,pal[col]);
    if(HD()) pLine(c,bx,by,bx+(tx-bx)*0.7,by+(ty-by)*0.7,PU,pal[col+'L']);
  });
}
// високий гострий каптур: вістря загнуте назад, щитоподібна пройма в яскравій облямівці, зубчастий оскал
function drawPeakHood(P,h,hc,hcD,hcL){
  const {c,pal,time}=P;
  const sway=Math.sin(time*2.4)*0.7;
  const tipX=-13+sway, tipY=-26;
  // рвані клапті на потилиці (за каптуром): віялом назад-униз
  if(h.flaps){
    const FAN=[[-5,-2.35,20,4],[0,-2.7,25,4.2],[5,-3.02,22,3.8],[10,-3.3,16,3.4]]; // [висота, кут, довжина, ширина]
    for(let i=0;i<Math.min(h.flaps,FAN.length);i++){
      const [y0,a0,l,w]=FAN[i], a=a0+Math.sin(time*3+i)*0.05;
      const bx=-13, tx=bx+Math.cos(a)*l, ty=y0+Math.sin(a)*l;
      const nx=-Math.sin(a)*w, ny=Math.cos(a)*w, mx=bx+(tx-bx)*0.55, my=y0+(ty-y0)*0.55;
      const q=[bx+nx,y0+ny, mx+nx*0.7,my+ny*0.7+1, tx,ty, mx-nx*0.5,my-ny*0.5, bx-nx,y0-ny];
      pPath(c,q); pOut(c,1.6); pPoly(c,q,hcD);
      pPoly(c,[bx+nx*0.6,y0+ny*0.6, mx+nx*0.4,my+ny*0.4, bx+(tx-bx)*0.8,y0+(ty-y0)*0.8, bx-nx*0.2,y0-ny*0.2],i===1&&HD()?pal.primL:hc); // один клапоть потертий, як на референсі
    }
  }
  // широкий округлий каптур, коротке вістря загнуте назад
  const outer=()=>{ c.moveTo(10,14); c.quadraticCurveTo(16.5,5,16,-5); c.quadraticCurveTo(14.5,-14,6,-18.5);
    c.quadraticCurveTo(-2,-22,tipX,tipY); c.quadraticCurveTo(-10,-18,-15,-13);
    c.quadraticCurveTo(-18.5,-4,-17.5,7); c.lineTo(-15,15); c.quadraticCurveTo(-4,20,10,14); c.closePath(); };
  c.beginPath(); outer(); pOut(c,2);
  c.beginPath(); outer(); c.fillStyle=hc; c.fill();
  c.save(); c.beginPath(); outer(); c.clip();
  c.fillStyle=hcD; c.beginPath(); c.moveTo(-22,-40); c.lineTo(-7,-40); c.quadraticCurveTo(-9,-12,-5,22); c.lineTo(-22,22); c.closePath(); c.fill();
  c.strokeStyle=hcL; c.lineWidth=PU*1.3; c.beginPath(); c.moveTo(tipX+3,tipY+2); c.quadraticCurveTo(3,-19,12,-12); c.stroke();
  if(HD()){ c.strokeStyle=pal.secDD||hcD; c.lineWidth=PU; c.beginPath(); c.moveTo(-9,-15); c.quadraticCurveTo(-13,-4,-12,13); c.stroke(); }
  c.restore();
  // пройма: великий щит, загострений донизу майже до підборіддя
  const hole=(k)=>{ const cx=7.6, cy=1.4; c.beginPath();
    c.moveTo(cx-7*k,cy-6.5*k); c.quadraticCurveTo(cx-0.5*k,cy-13*k,cx+6.8*k,cy-6.8*k);
    c.lineTo(cx+7*k,cy+1.5*k); c.quadraticCurveTo(cx+5.4*k,cy+8*k,cx+0.4*k,cy+12.5*k);
    c.quadraticCurveTo(cx-4.8*k,cy+8*k,cx-6.8*k,cy+1.5*k); c.closePath(); };
  hole(1.26); c.fillStyle=pal[h.rim]||hcL; c.fill();                               // яскрава облямівка
  hole(1.26); c.save(); c.clip(); c.fillStyle=hc; c.fillRect(-4,-20,5,40); c.restore(); // потиличний бік облямівки в тіні
  hole(1); c.fillStyle=pal.shadow; c.fill();                                        // чорнота
  if(h.grin){ // білий зубчастий «^»
    const wx=7.8, wy=-2.4;
    c.strokeStyle=pal.white; c.lineWidth=Math.max(PU*1.4,1.3); c.lineJoin='miter'; c.lineCap='butt';
    c.beginPath(); c.moveTo(wx-5,wy+3); c.lineTo(wx,wy-2); c.lineTo(wx+5,wy+3); c.stroke();
    if(HD()){ pPoly(c,[wx-3,wy+1, wx-2.2,wy+3.6, wx-1.3,wy],pal.white); pPoly(c,[wx+1.3,wy, wx+2.2,wy+3.6, wx+3,wy+1],pal.white); }
  }
}
// V-комір каптура на грудях (система торса)
function drawCollar(P){
  const {c,m,pal}=P, k=m.collar;
  pPath(c,[-9,-44, 17,-42, 14,-35, 6,-27, 1,-33, -8,-37]); pOut(c,1.6);
  pPoly(c,[-9,-44, 17,-42, 14,-35, 6,-27, 1,-33, -8,-37],pal[k+'D']);
  pPoly(c,[-8,-43.5, 16,-41.5, 13.5,-36, 6,-29.5, 1.5,-34.5, -7,-38],pal[k]);
  pLine(c,-6,-42.5,15,-40.8,PU,pal[k+'L']);
  if(HD()) pLine(c,1.5,-34,6,-29.5,PU,pal[k+'L']);
}
// гладкий темний нагрудник (замість шкіряної перев'язі): пластини преса, відблиски
function drawDarkChest(P){
  const {c,pal}=P;
  pEll(c,8,-31,6.5,6,pal.primL);
  pEll(c,7,-30,5,4.6,pal.prim);
  if(HD()){
    pLine(c,5,-26,5,-9,PU,pal.primDD);                                // центральна лінія
    for(const y of [-20,-14]) pLine(c,-9,y,14,y+0.5,PU,pal.primDD);   // пластини преса
    for(const y of [-19,-13]) pLine(c,-8,y,13,y+0.5,PU,pal.primL);
    pDot(c,10,-33,pal.white,1); pLine(c,13,-36,11,-22,PU,pal.primL);
  }
}
// ремінці-китиці з пояса поверх темної набедреної пов'язки
function drawStraps(P){
  const {c,S,m,pal,time}=P;
  const k=m.straps, pel=S.pel, kn=S.kneeF;
  const sway=(kn.x-pel.x)*0.3, fl=Math.sin(time*5)*0.6;
  // темна пов'язка
  const a=S.T(0,-3), b=S.T(15,-3);
  pPath(c,[a.x,a.y, b.x,b.y, b.x+sway+1,pel.y+17, a.x+sway,pel.y+19]); pOut(c,1.4);
  pPoly(c,[a.x,a.y, b.x,b.y, b.x+sway+1,pel.y+17, a.x+sway,pel.y+19],pal.primDD);
  // китиці
  for(const [ox,len,w] of [[2,17,2.4],[6.5,20,2.8],[11,16,2.4],[-4,13,2.2]]){
    const x0=S.T(ox,-2), x1={x:x0.x+sway*(len/18)+fl,y:x0.y+len};
    pLine(c,x0.x,x0.y,x1.x,x1.y,w+PU*1.6,OL); pLine(c,x0.x,x0.y,x1.x,x1.y,w,ox<0?pal[k+'D']:pal[k]);
    if(ox>=0&&HD()) pLine(c,x0.x-0.6,x0.y+2,x1.x-0.6,x1.y-3,PU*0.8,pal[k+'L']);
    pLine(c,x1.x,x1.y-2.4,x1.x,x1.y,w+0.4,pal.trim);                 // золотий наконечник
  }
}
// широкий чорний кинджал: вогняно-золоте зазубрене лезо, золоті прожилки, червона гарда
function drawBfDagger(P,d){
  const {c,pal,time}=P;
  pLine(c,0,8,0,0,3.4+PU*1.6,OL); pLine(c,0,8,0,0,3.4,pal.leath);
  if(HD()) for(let y=1.5;y<7;y+=2.2) pLine(c,-1.6,y,1.6,y+1,PU,pal.primD);
  pCirc(c,0,9.5,2.4,pal.trim);
  // гарда: червона, кінці загнуті, золоті кульки
  pPath(c,[-8,-1, -6,-4, 6,-4, 8,-1, 5,0.5, -5,0.5]); pOut(c,1.4);
  pPoly(c,[-8,-1, -6,-4, 6,-4, 8,-1, 5,0.5, -5,0.5],d?pal.secD:pal.sec);
  if(!d) pLine(c,-5.5,-3.4,5.5,-3.4,PU,pal.secL);
  pDot(c,-8,-1.4,pal.trim,1.6); pDot(c,8,-1.4,pal.trim,1.6);
  // клинок-лист: найширший посередині, зубці на передньому краї
  const blade=[-3,-4, 3.2,-4, 5,-9, 6.2,-14, 5,-16, 5.8,-20, 4.4,-22, 4.6,-26, 2.8,-29, 0.3,-37, -2.4,-30, -4.4,-22, -4.8,-14, -4.2,-8];
  pPath(c,blade); pOut(c,2); c.fillStyle=d?pal.shadow:pal.primDD; c.fill();
  c.save(); pPath(c,blade); c.clip();
  // вогняна кромка по всьому контуру: помаранчева зовні, золота всередині
  c.lineJoin='miter';
  c.strokeStyle=d?pal.accD:pal.acc; c.lineWidth=2.8; pPath(c,blade); c.stroke();
  if(!d){
    c.strokeStyle=pal.trim; c.lineWidth=1.4;
    c.beginPath(); c.moveTo(5,-9); c.lineTo(6.2,-14); c.lineTo(5,-16); c.lineTo(5.8,-20); c.lineTo(4.4,-22); c.lineTo(4.6,-26); c.lineTo(2.8,-29); c.lineTo(0.3,-37); c.stroke();
    c.beginPath(); c.moveTo(-4.2,-8); c.lineTo(-4.8,-14); c.lineTo(-4.4,-22); c.lineTo(-2.4,-30); c.stroke();
    // золоті прожилки-тріщини: розгалужене «Y» від гарди до вістря
    c.strokeStyle=pal.trim; c.lineWidth=PU*1.1; c.lineJoin='round';
    c.beginPath(); c.moveTo(0,-5); c.lineTo(0.3,-13); c.lineTo(-2,-18); c.moveTo(0.3,-13); c.lineTo(2.6,-18.5); c.lineTo(1.6,-26); c.moveTo(-2,-18); c.lineTo(-1.2,-24);
    c.moveTo(2,-26); c.lineTo(0.6,-31); c.stroke();
    pDot(c,0.4,-13,pal.accL,1);
  }
  c.restore();
  if(!d){ const f=0.7+Math.sin(time*9)*0.15; addLight(P,1,-20,13,pal.acc,0.75*f); }
}

// світний самоцвіт (колір акценту): оправа + серце + світло
function glowGem(P,x,y,dim,r=2.2){
  const {c,pal}=P;
  pCirc(c,x,y,r+0.9,pal.trimD); pCirc(c,x,y,r,dim?pal.accD:pal.acc);
  if(!dim){ pDot(c,x-r*0.3,y-r*0.3,pal.accL,1); addLight(P,x,y,r*4.5,pal.acc,0.8); }
}

/* ---------- наплічники (система плеча, повернута з торсом) ---------- */
function drawShoulder(P,side){
  const {c,S,m,pal,time}=P;
  const sd=m.sh; if(!sd) return;
  const sh=side==='b'?S.shB:S.shF;
  const d=side==='b';
  const s=(sd.s||1)*0.8*(d?0.9:(sd.t==='rimmed'?0.82:0.86));   // передній — менший: не ховає нагрудник
  const bc=sd.col||'prim';
  const col=d?pal[bc+'D']:pal[bc], colD=d?(pal[bc+'DD']||pal[bc+'D']):pal[bc+'D'], colL=d?pal[bc+'D']:pal[bc+'L'];
  const tr=d?pal.trimD:pal.trim;
  const shx=sd.t==='rimmed'?(d?-7:9):(d?-3:7), shy=sd.t==='rimmed'&&!d?6:(d?0:-2);   // передній — на верху руки, ближче до краю
  c.save(); c.translate(sh.x+shx,sh.y+shy); c.rotate(S.lean);
  const dome=(cc=col,ccD=colD,ccL=colL,rim=tr)=>{
    pPath(c,[-11*s,5*s, -12*s,-3*s, -8*s,-9*s, 1*s,-10.5*s, 10*s,-8*s, 13*s,-2*s, 12*s,5*s, 1*s,8*s]); pOut(c,2); c.fillStyle=ccD; c.fill();
    pPath(c,[-10*s,4*s, -11*s,-3*s, -7.5*s,-8.5*s, 1*s,-9.5*s, 9.5*s,-7.5*s, 12*s,-2*s, 11*s,3.5*s, 1*s,6.5*s]); c.fillStyle=cc; c.fill();
    if(ccL) pLine(c,-4*s,-7*s,7*s,-6.5*s,PU,ccL);
    if(HD()&&!d){
      c.strokeStyle=ccD; c.lineWidth=PU; c.beginPath(); c.moveTo(-10*s,0); c.quadraticCurveTo(1*s,5*s,11.5*s,0); c.stroke(); // внутрішня ламела
      const metal=m.armor==='plate'||m.armor==='mail';
      if(metal) pDot(c,4*s,-6*s,pal.white,1.1);
    }
    c.strokeStyle=rim; c.lineWidth=PU*1.6;
    c.beginPath(); c.moveTo(-11*s,4.5*s); c.quadraticCurveTo(1*s,10*s,12*s,4.5*s); c.stroke();
    if(HD()&&!d) for(const t of [0.2,0.5,0.8]){ const x=(-11+23*t)*s, y=(4.5+11*t*(1-t)*2)*s; pRivet(c,x,y,pal.trimD,pal.trimL); }
  };
  const sp=(x,y,a,len,w,cc)=>pPoly(c,[x-Math.sin(a)*w,y+Math.cos(a)*w, x+Math.cos(a)*len,y+Math.sin(a)*len, x+Math.sin(a)*w,y-Math.cos(a)*w],cc);
  switch(sd.t){
    case 'round': dome(); pDot(c,-5*s,1*s,tr); pDot(c,6*s,1*s,tr); if(sd.gem) glowGem(P,1*s,-3*s,d); break;
    case 'bowl':{ // велика чаша, що розкривається вгору, зі світлою підкладкою (Wrath)
      const inn=pal[sd.inner||'pale'];
      // світлий «диск»-мушля позаду чаші (як на скріншоті Wrath)
      pEll(c,1*s,-9*s,15*s,9*s,d?pal.metalD:inn); c.beginPath(); c.ellipse(1*s,-9*s,15*s,9*s,0,0,7); pOut(c,1.4); pEll(c,1*s,-9*s,15*s,9*s,d?pal.metalD:inn);
      if(!d){ c.strokeStyle=tr; c.lineWidth=PU*1.4; c.beginPath(); c.ellipse(1*s,-9*s,11*s,6*s,0,3.3,6.1); c.stroke(); }
      pPath(c,[-15*s,-12*s, -6*s,-8*s, 8*s,-9*s, 16*s,-15*s, 14*s,2*s, 5*s,8*s, -8*s,7*s, -14*s,0]); pOut(c,2); c.fillStyle=colD; c.fill();
      pPoly(c,[-14*s,-11*s, -6*s,-7*s, 8*s,-8*s, 15*s,-14*s, 13*s,1*s, 5*s,6.5*s, -8*s,5.5*s, -13*s,-0.5*s],col);
      pPoly(c,[-14*s,-11*s, -6*s,-7*s, 8*s,-8*s, 15*s,-14*s, 10*s,-4*s, -8*s,-3*s],d?pal.metalD:inn);   // підкладка
      c.strokeStyle=tr; c.lineWidth=PU*1.6; c.beginPath(); c.moveTo(-14*s,-11*s); c.lineTo(-6*s,-7*s); c.lineTo(8*s,-8*s); c.lineTo(15*s,-14*s); c.stroke();
      c.beginPath(); c.moveTo(-13*s,0); c.quadraticCurveTo(0,9*s,13*s,1*s); c.stroke();
      if(HD()&&!d){ c.strokeStyle=tr; c.lineWidth=PU; c.beginPath(); c.arc(1*s,1*s,4*s,3.4,6); c.stroke(); }
      if(sd.gem) glowGem(P,1*s,1*s,d);
      break; }
    case 'bat':{ // крило кажана: три ребра й фестончаста перетинка (Destroyer); заднє — назад, переднє — вперед
      const f=d?-1:1, P2=(x,y)=>[x*f*s,y*s];
      const tips=[P2(4,-27),P2(15,-22),P2(21,-11)];
      const pts=[...P2(-2,-6),...tips[0],...P2(8,-17),...tips[1],...P2(13,-10),...tips[2],...P2(6,-4)];
      pPath(c,pts); pOut(c,2); pPoly(c,pts,d?pal.primDD:colD);
      if(!d) pPoly(c,[...P2(-1,-6),...tips[0],...P2(8,-17),...P2(6,-7)],col);
      for(const t of tips) pLine(c,-1*f*s,-5*s,t[0],t[1],PU*(d?1:1.3),d?pal.trimD:tr);   // розжарені ребра
      dome(); if(!d){ pLine(c,-9*s,-4*s,9*s,-5*s,PU*1.4,tr); } if(sd.gem) glowGem(P,1*s,-2*s,d);
      break; }
    case 'slab':{ // високі прямокутні плити вгору (Wrynn — нефрит)
      const sc=pal[sd.slab||'pale'], scD=hexShade(sc,-0.3);
      for(const [x,a,h] of [[-6,-0.28,24],[2,-0.08,28]]){ c.save(); c.translate(x*s,-6*s); c.rotate(a);
        pPath(c,[-4.5*s,0, -5*s,-h*s, 5*s,-(h+5)*s, 5*s,0]); pOut(c,1.8); c.fillStyle=d?scD:sc; c.fill();
        if(!d){ pPoly(c,[1*s,0, 1*s,-(h+2)*s, 5*s,-(h+5)*s, 5*s,0],scD); pLine(c,-3.5*s,-2*s,-3.8*s,-(h-2)*s,PU,pal.white); }
        c.restore(); }
      dome(); if(sd.gem) glowGem(P,1*s,-2*s,d); break; }
    case 'spikes':{ // кластер довгих шипів (Might): колір, кількість, довжина
      const spc=pal[sd.spc||'bone'], spd=pal[(sd.spc||'bone')+'D']||pal.boneD, n=sd.n||4;
      for(let i=0;i<n;i++){ const a=-2.7+i*(1.7/(n-1||1)), l=(sd.len||16)*(i%2?0.8:1)*s;
        const bx=Math.cos(a)*7*s, by=Math.sin(a)*5*s-2*s;
        pHorn(c,bx,by,bx+Math.cos(a)*l*0.5,by+Math.sin(a)*l*0.5,bx+Math.cos(a)*l,by+Math.sin(a)*l,4.6*s,OL);
        pHorn(c,bx,by,bx+Math.cos(a)*l*0.5,by+Math.sin(a)*l*0.5,bx+Math.cos(a)*l,by+Math.sin(a)*l,3.4*s,d?spd:spc); }
      dome(); if(sd.gem) glowGem(P,1*s,-2*s,d); break; }
    case 'rimmed':{ // кругла темна чаша з товстим кольоровим ободом (Bloodfang)
      const rc=pal[sd.rim], rcD=pal[sd.rim+'D'], rcL=pal[sd.rim+'L'];
      if(sd.flaps&&d) drawFlaps(c,pal,sd.flaps,s,time);
      dome(col,colD,colL,d?rcD:rc);
      // обід: широка смуга по нижньому краю + верхній кант
      c.strokeStyle=d?rcD:rc; c.lineWidth=3.2*s; c.beginPath(); c.moveTo(-11*s,3.5*s); c.quadraticCurveTo(1*s,10*s,12*s,3.5*s); c.stroke();
      if(!d){ c.strokeStyle=rcL; c.lineWidth=PU; c.beginPath(); c.moveTo(-9*s,2.2*s); c.quadraticCurveTo(1*s,7.8*s,10*s,2.2*s); c.stroke(); }
      if(HD()&&!d){ for(const [x,y] of [[-4,-3],[3,-6],[6,-1],[-1,1]]) pDot(c,x*s,y*s,pal.primL,1); pDot(c,4*s,-5*s,pal.white,0.9); } // потерта поверхня
      break; }
    case 'regal':{
      // фіолетові кристалічні вістря за наплічником
      for(const [a,l] of [[-2.35,11],[-1.95,14]]){ const bx=Math.cos(a)*7*s, by=Math.sin(a)*6*s, tx=bx+Math.cos(a)*l*s, ty=by+Math.sin(a)*l*s, nx=-Math.sin(a)*2.6*s, ny=Math.cos(a)*2.6*s;
        pPoly(c,[bx+nx,by+ny, tx,ty, bx-nx,by-ny],d?pal.crystD:pal.cryst); pPoly(c,[bx,by, tx,ty, bx-nx,by-ny],d?pal.crystD:pal.crystL); }
      dome();
      // загнутий угору золотий край-фланець, як у референсі
      pPath(c,[-12*s,-2*s, -15*s,-12*s, -8*s,-11*s, 2*s,-12.5*s, 11*s,-10*s, 14*s,-4*s, 8*s,-6*s, -6*s,-6*s]); pOut(c,1.6);
      pPoly(c,[-12*s,-2*s, -15*s,-12*s, -8*s,-11*s, 2*s,-12.5*s, 11*s,-10*s, 14*s,-4*s, 8*s,-6*s, -6*s,-6*s],d?pal.trimD:pal.trim);
      if(!d) pLine(c,-14*s,-11.5*s,10*s,-10*s,PU,pal.trimL);
      // бліда пластина й фіолетовий кристал у центрі
      pEll(c,1*s,-1*s,7*s,4.5*s,d?pal.metalD:pal.pale,-0.15);
      pPoly(c,[1*s,-4*s, 3.5*s,-1*s, 1*s,2*s, -1.5*s,-1*s],d?pal.crystD:pal.cryst);
      if(!d){ pDot(c,0.5*s,-2.4*s,pal.crystL,1.2); addLight(P,1*s,-2*s,15*s,'#b070ff',0.8); }
      break;
    }
    case 'spiked':
      for(const a of [-2.5,-1.9,-1.3]) sp(Math.cos(a)*8*s,Math.sin(a)*6*s,a,12*s,2.8*s,d?pal.metalD:pal.metalL);
      dome(); break;
    case 'bigspikes':{
      const bc2=sd.spc?pal[sd.spc]:pal.trim, bd2=sd.spc?(pal[sd.spc+'D']||bc2):pal.trimD;
      sp(-6*s,-6*s,-2.2,20*s,4*s,d?bd2:bc2);
      sp(3*s,-8*s,-1.7,16*s,3.5*s,d?bd2:bc2);
      dome(); if(sd.gem) glowGem(P,1*s,-2*s,d); break; }
    case 'layered':
      c.save(); c.translate(-1,7*s); dome(colD,pal.primDD,null,tr); c.restore();
      c.save(); c.translate(-0.5,3.5*s); dome(col,colD,null,tr); c.restore();
      dome(); break;
    case 'fang':
      pHorn(c,-5*s,-5*s,-12*s,-16*s,-23*s,-15*s,5*s,d?pal.boneD:pal.bone);
      pHorn(c,1*s,-8*s,-3*s,-18*s,-13*s,-21*s,4.5*s,d?pal.boneD:pal.bone);
      dome(col,colD,null,pal.trim);
      pLine(c,-8*s,-1*s,10*s,-2*s,PU*1.4,d?pal.trimD:pal.trim);
      break;
    case 'skull':
      dome();
      pCirc(c,3*s,-6*s,6*s,d?pal.boneD:pal.bone);
      pPoly(c,[0,-2*s, 7*s,-2*s, 6*s,2*s, 1*s,2*s],d?pal.boneD:pal.bone);
      pDot(c,2*s,-6*s,pal.shadow,1.4); pDot(c,5.6*s,-6*s,m.glowEye?pal.eye:pal.shadow,1.4);
      if(m.glowEye&&!d) addLight(P,5.6*s,-6*s,5,pal.eye,0.7);
      break;
    case 'winged':
      for(let i=0;i<4;i++) pHorn(c,-3*s,-5*s,(-10-i*3)*s,(-16+i*2)*s,(-16-i*4)*s,(-26+i*6)*s,4*s,i%2?(d?pal.trimD:pal.trimL):tr);
      dome(); break;
    case 'mantle':
      pPath(c,[-9*s,-6*s, 2*s,-9*s, 11*s,-4*s, 13*s,6*s, 9*s,11*s, 5*s,8*s, 1*s,12*s, -3*s,8*s, -8*s,10*s]); pOut(c,2); c.fillStyle=colD; c.fill();
      pPath(c,[-8*s,-5.5*s, 2*s,-8*s, 10*s,-3.5*s, 12*s,5*s, 9*s,9.5*s, 5*s,7*s, 1*s,10.5*s, -3*s,7*s, -7*s,8.5*s]); c.fillStyle=col; c.fill();
      c.strokeStyle=tr; c.lineWidth=PU*1.3; c.beginPath(); c.moveTo(12*s,5*s); c.lineTo(9*s,9.5*s); c.lineTo(5*s,7*s); c.lineTo(1*s,10.5*s); c.lineTo(-3*s,7*s); c.lineTo(-7*s,8.5*s); c.stroke();
      if(sd.gem){ pDot(c,3*s,-2*s,pal.acc,1.8); }
      break;
    case 'orb':{
      dome();
      const fy=-15*s+Math.sin(time*3+(d?1:0))*1.5;
      pLine(c,-3*s,-9*s,-4*s,fy+3,PU*1.2,tr); pLine(c,5*s,-9*s,6*s,fy+3,PU*1.2,tr);
      pCirc(c,1*s,fy,4.8*s,d?pal.accD:pal.acc); pCirc(c,0,fy-1.4*s,2*s,pal.accL);
      if(!d) addLight(P,1*s,fy,10*s,pal.acc,0.8);
      break;
    }
    case 'crystal':
      dome();
      for(const [a,l] of [[-2.3,13],[-1.75,17],[-1.2,12]]){
        const bx=Math.cos(a)*6*s, by=Math.sin(a)*5*s, tx=bx+Math.cos(a)*l*s, ty=by+Math.sin(a)*l*s;
        const nx=-Math.sin(a)*3*s, ny=Math.cos(a)*3*s;
        pPoly(c,[bx+nx,by+ny, tx,ty, bx-nx,by-ny],d?pal.accD:pal.acc);
        pPoly(c,[bx+nx*0.2,by+ny*0.2, tx,ty, bx-nx,by-ny],d?pal.accD:pal.accL);
      }
      if(!d) addLight(P,0,-12*s,10*s,pal.acc,0.6);
      break;
    case 'fur':
      for(const [x,y,r] of [[-8,-1,5.5],[-3,-6,6],[4,-6,6],[9,-1,5.5],[0,1,6]]) pCirc(c,x*s,y*s,r*s,d?pal.hairD:pal.hair);
      for(const [x,y] of [[-6,-4],[1,-8],[7,-4]]) pLine(c,x*s,y*s,(x-1)*s,(y+4)*s,PU,pal.hairD);
      break;
    case 'feathers':
      for(let i=0;i<5;i++){ const a=2.6-i*0.35; pHorn(c,0,-2*s,Math.cos(a)*8*s,Math.sin(a)*6*s-6*s,Math.cos(a)*16*s,Math.sin(a)*10*s+2*s,3.6*s,i%2?pal.white:(d?pal.accD:pal.acc)); }
      dome(col,colD,null,tr);
      break;
    case 'beast':
      dome(pal.hair,pal.hairD,null,tr);
      pEll(c,4*s,-7*s,7*s,5.5*s,d?pal.hairD:pal.hair);
      pPoly(c,[7*s,-10*s, 16*s,-7*s, 16*s,-4*s, 8*s,-4*s],d?pal.hairD:pal.hair);
      pPoly(c,[-1*s,-10*s, 0,-16*s, 3*s,-11*s],pal.hairD);
      pDot(c,8*s,-8.5*s,pal.eye,1.3); if(!d) addLight(P,8*s,-8.5*s,4,pal.eye,0.6);
      for(let x=10;x<=15;x+=2.5) pPoly(c,[x*s,-4*s, (x+0.8)*s,-2*s, (x+1.6)*s,-4*s],pal.white);
      break;
    case 'leaf':
      for(const [a,l] of [[-2.6,12],[-2.0,14],[-1.4,12],[-0.9,9]]){
        c.save(); c.rotate(a); pEll(c,l*0.55*s,0,l*0.55*s,3.2*s,d?pal.accD:pal.acc); pLine(c,0,0,l*s,0,PU*0.9,pal.accD); c.restore();
      }
      dome(pal.wood,pal.woodD,null,pal.accD);
      break;
    case 'horn':
      dome();
      pHorn(c,-2*s,-8*s,-14*s,-18*s,-8*s,-26*s,6*s,d?pal.boneD:pal.bone);
      break;
    case 'flame':{
      dome();
      for(let i=0;i<3;i++){
        const x=(-6+i*6)*s, fl=Math.sin(time*14+i*2)*2;
        pPoly(c,[x-3.5*s,-6*s, x+fl-1,(-18-i%2*4)*s+fl, x+3.5*s,-6*s],d?pal.accD:pal.acc);
        pPoly(c,[x-1.8*s,-7*s, x+fl*0.6,(-13-i%2*3)*s, x+1.8*s,-7*s],pal.accL);
      }
      if(!d) addLight(P,0,-12*s,12*s,pal.acc,0.8);
      break;
    }
    case 'blades':
      sp(-4*s,-5*s,-2.7,15*s,2.6*s,d?pal.metalD:pal.metalL);
      sp(1*s,-7*s,-2.35,13*s,2.4*s,d?pal.metalD:pal.metal);
      dome(); break;
    case 'totem':
      pPoly(c,[-8*s,6*s, -9*s,-14*s, 9*s,-14*s, 8*s,6*s],d?pal.woodD:pal.wood);
      pPoly(c,[-9*s,-14*s, -11*s,-18*s, 11*s,-18*s, 9*s,-14*s],pal.woodD);
      pLine(c,-6*s,-8*s,6*s,-8*s,PU*1.4,d?pal.accD:pal.acc);
      pDot(c,-3*s,-3*s,pal.shadow,1.4); pDot(c,3*s,-3*s,pal.shadow,1.4);
      pLine(c,-4*s,2*s,4*s,2*s,PU*1.2,pal.trim);
      pHorn(c,-6*s,-17*s,-12*s,-24*s,-18*s,-28*s,3*s,pal.white);
      break;
    case 'disc':
      pCirc(c,1*s,-3*s,12*s,colD); pCirc(c,1*s,-3*s,10.5*s,col);
      for(let i=0;i<8;i++){ const a=i*Math.PI/4; pLine(c,1*s+Math.cos(a)*4*s,-3*s+Math.sin(a)*4*s,1*s+Math.cos(a)*9*s,-3*s+Math.sin(a)*9*s,PU,tr); }
      pCirc(c,1*s,-3*s,3*s,d?pal.accD:pal.acc);
      if(!d) addLight(P,1*s,-3*s,8*s,pal.acc,0.5);
      break;
    case 'spider':
      for(const [a,k] of [[-2.6,1],[-2.1,1.2],[-1.6,1]]){
        const bx=Math.cos(a)*7*s, by=Math.sin(a)*5*s;
        const jx=bx+Math.cos(a)*9*s*k, jy=by+Math.sin(a)*9*s*k-4*s;
        pLine(c,bx,by,jx,jy,2.4*s,d?pal.primDD:pal.primD); pLine(c,jx,jy,jx+Math.cos(a+1)*8*s,jy+8*s,2*s,d?pal.primDD:pal.primD);
      }
      dome(); break;
    default: dome();
  }
  c.restore();
}

/* ---------- зброя (система кисті: вістря вгору по -y) ---------- */
function drawWeapon(P,w,hd,ang,side){
  const {c,pal,m,time}=P;
  const d=side==='b';
  const bl=d?pal.metalD:pal.metal, blL=d?pal.metal:pal.metalL, blD=pal.metalD;
  const wood=d?pal.woodD:pal.wood;
  const edge=w.edge?(d?pal.accD:pal.acc):null;
  c.save(); c.translate(hd.x,hd.y); c.rotate(ang);
  switch(w.t){
    case 'staff':{
      pLine(c,0,44,0,-52,3.6+PU*1.4,OL);
      pLine(c,0,44,0,-52,3.6,pal.woodD); pLine(c,-0.4,44,-0.4,-52,2,wood);
      pLine(c,0,-8,0,-2,4.4,pal.trim); pLine(c,0,36,0,40,4.4,pal.trim);
      if(HD()){ for(const y of [-40,-26,14,26]) pLine(c,0,y,0,y+1.6,4,pal.trimD); for(let y=-1;y<6;y+=2) pLine(c,-1.8,y,1.8,y+1,PU,pal.leathD); pLine(c,-0.8,-48,-0.8,-10,PU,d?pal.wood:pal.leathL||pal.wood); }
      drawStaffHead(P,w.head||'orb',d);
      break;
    }
    case 'sword2h':
      pLine(c,0,14,0,0,3.4,pal.leathD); pCirc(c,0,15,2.4,pal.trim);
      if(HD()){ for(let y=2;y<13;y+=2.4) pLine(c,-1.7,y,1.7,y+1.2,PU,pal.leath); pDot(c,0,15,pal.acc,1.2); }
      pLine(c,-9,-1,9,-1,3.4,pal.trim);
      pPoly(c,[-3.6,-2, 3.6,-2, 3,-54, 0,-60, -3,-54],blD);
      pPoly(c,[-2.6,-2, 2.2,-2, 1.8,-53, 0,-58, -2.2,-53],bl);
      pLine(c,-0.6,-4,-0.6,-52,PU,blL);
      if(w.rune){ pLine(c,0.5,-8,0.5,-44,PU*1.2,pal.acc); addLight(P,0,-26,14,pal.acc,0.55); }
      break;
    case 'axe2h':
      pLine(c,0,18,0,-52,3.4+PU*1.6,OL);
      pLine(c,0,18,0,-52,3.4,pal.woodD); pLine(c,-0.3,18,-0.3,-52,1.8,wood);
      pPath(c,[1,-54, 12,-64, 23,-58, 25,-42, 18,-30, 1,-38]); pOut(c,2); c.fillStyle=blD; c.fill();
      pPoly(c,[1.5,-53, 11.5,-62, 21.5,-57, 23.5,-42.5, 17.5,-32, 1.5,-39],bl);
      pLine(c,22.5,-56,23.5,-42.5,PU*1.6,edge||blL);
      pLine(c,4,-50,14,-54,PU,blL);
      pPoly(c,[-1,-50, -9,-45, -1,-41],blD);
      pLine(c,-2,-56,2,-56,3.4,pal.trim);
      break;
    case 'crystalhammer':{
      // довге темне кручене руків'я
      pLine(c,0,26,0,-58,4+PU*1.6,OL);
      pLine(c,0,26,0,-58,4,'#3a3848'); pLine(c,-0.6,26,-0.6,-58,1.6,'#5a5870');
      if(HD()) for(let y=-54;y<22;y+=5) pLine(c,-2,y,2,y+2.5,PU,'#24222e');
      // шип-навершшя
      pPoly(c,[-2.6,24, 2.6,24, 0,34],'#3a3848'); pDot(c,0,27,pal.cryst,1.4);
      // муфта й кристалічна голова, поперек руків'я
      pLine(c,-5,-54,5,-54,3.4,'#3a3848'); pLine(c,-4,-58,4,-58,2.4,'#5a5870');
      const hy=-68, cr=[-16,hy-4, -12,hy-12, 6,hy-12, 17,hy-3, 13,hy+9, -8,hy+9, -17,hy+3];
      pPath(c,cr); pOut(c,2); c.fillStyle=d?pal.crystD:pal.cryst; c.fill();
      if(!d){
        pPoly(c,[-12,hy-11, 6,hy-11, 2,hy-3, -9,hy-2],pal.crystL);          // верхня грань
        pPoly(c,[6,hy-11, 16,hy-3, 12,hy+8, 2,hy-3],pal.crystD);            // бокова тіньова грань
        pLine(c,-15,hy+2,-8,hy+8,PU,pal.crystL); pDot(c,-6,hy-8,pal.white,1.3);
        addLight(P,0,hy,30,'#b070ff',0.85);
      }
      break;
    }
    case 'hammer2h':
      pLine(c,0,18,0,-44,3.4,pal.woodD); pLine(c,-0.3,18,-0.3,-44,1.8,wood);
      pPoly(c,[-11,-56, 11,-56, 11,-40, -11,-40],blD);
      pPoly(c,[-10,-55, 10,-55, 10,-41, -10,-41],bl);
      pPoly(c,[-2,-56, 3,-56, 3,-40, -2,-40],pal.trim);
      pLine(c,-9,-53,9,-53,PU,blL);
      if(w.rune){ pDot(c,0.5,-48,pal.acc,2); addLight(P,0,-48,10,pal.acc,0.7); }
      break;
    case 'axe1h':
      pLine(c,0,8,0,-30,3,pal.woodD); pLine(c,-0.3,8,-0.3,-30,1.6,wood);
      pPoly(c,[1,-28, 9,-33, 14,-27, 13,-18, 1,-21],blD);
      pPoly(c,[1.5,-27.5, 8.5,-32, 12.8,-26.5, 12,-19, 1.5,-21.8],bl);
      pLine(c,13.5,-27,12.8,-19,PU*1.3,edge||blL);
      break;
    case 'sword1h':
      pLine(c,0,8,0,0,3,pal.leathD); pCirc(c,0,9,2,pal.trim);
      if(HD()){ for(let y=1.5;y<7;y+=2.2) pLine(c,-1.5,y,1.5,y+1,PU,pal.leath); pDot(c,0,9,pal.acc,1); }
      pLine(c,-7,-1,7,-1,3,pal.trim);
      pPoly(c,[-3,-2, 3,-2, 2.6,-34, 0,-39, -2.6,-34],blD);
      pPoly(c,[-2.2,-2, 1.8,-2, 1.6,-33.5, 0,-37.5, -1.8,-33.5],bl);
      pLine(c,-0.4,-4,-0.4,-33,PU,blL);
      if(w.rune){ pLine(c,0.4,-6,0.4,-30,PU*1.1,pal.acc); addLight(P,0,-18,10,pal.acc,0.5); }
      break;
    case 'mace1h': case 'hammer1h':
      pLine(c,0,8,0,-24,3,pal.woodD); pLine(c,-0.3,8,-0.3,-24,1.6,wood);
      if(w.t==='mace1h'){
        pCirc(c,0,-28,7,blD); pCirc(c,-0.5,-28.5,5.6,bl);
        for(const a of [0,1.57,3.14,4.71,0.8,2.4,3.9,5.5]) pDot(c,Math.cos(a)*7.5,-28+Math.sin(a)*7.5,pal.trim,1.3);
      } else {
        pPoly(c,[-8,-34, 8,-34, 8,-22, -8,-22],blD);
        pPoly(c,[-7,-33, 7,-33, 7,-23, -7,-23],bl);
        pLine(c,-7,-31,7,-31,PU,blL);
      }
      break;
    case 'dagger':
      pLine(c,0,6,0,0,2.8,pal.leathD);
      pLine(c,-4.5,-0.5,4.5,-0.5,2.4,pal.trim);
      if(w.curve){ pPoly(c,[-2.4,-1, 2.4,-1, 5,-12, 3,-22, 0,-12],blD); pPoly(c,[-1.6,-1, 1.6,-1, 4,-12, 2.8,-20, 0.4,-12],bl); }
      else { pPoly(c,[-2.6,-1, 2.6,-1, 2,-19, 0,-23, -2,-19],blD); pPoly(c,[-1.8,-1, 1.6,-1, 1.3,-18.5, 0,-21.5, -1.4,-18.5],bl); }
      if(edge){ pLine(c,1.8,-3,1.4,-18,PU*1.1,edge); addLight(P,0,-12,6,pal.acc,0.45); }
      break;
    case 'bfdagger': drawBfDagger(P,d); break;
    case 'fangblade':{ // вигнутий клинок: чорна серцевина, розпечене лезо
      pLine(c,0,7,0,0,3.2+PU*1.6,OL); pLine(c,0,7,0,0,3.2,pal.leathD);
      pLine(c,-5,-0.5,5,-0.5,2.8,pal.trim);
      const bladeP=[-2.6,-1, 2.8,-1, 6,-12, 7,-24, 3,-34, 2.5,-22, -1,-11];
      pPath(c,bladeP); pOut(c,2); c.fillStyle=pal.primDD; c.fill();
      c.strokeStyle=d?pal.accD:pal.acc; c.lineWidth=PU*1.8; c.lineJoin='round';
      c.beginPath(); c.moveTo(2.8,-1); c.lineTo(6,-12); c.lineTo(7,-24); c.lineTo(3,-34); c.stroke();
      c.strokeStyle=pal.accL; c.lineWidth=PU*1.1;
      c.beginPath(); c.moveTo(6.4,-18); c.lineTo(6.6,-25); c.lineTo(3.4,-32); c.stroke();
      pLine(c,1,-6,3.4,-22,PU,d?pal.accD:pal.acc);
      if(!d){ addLight(P,5,-20,11,pal.acc,0.75); }
      break;
    }
    case 'claws':
      for(let i=-1;i<=1;i++) pHorn(c,i*3,1,i*3.6+7,-13,i*4.2+3,-27,4.6,OL);
      for(let i=-1;i<=1;i++) pHorn(c,i*3,0,i*3.6+7,-13,i*4.2+3,-26,3.4,d?pal.boneD:pal.white);
      if(edge){ for(let i=-1;i<=1;i++) pLine(c,i*3.6+6,-13,i*4.2+3.4,-24,PU,d?pal.accD:pal.acc); addLight(P,3,-14,9,pal.acc,0.6); }
      break;
    case 'spear':
      pLine(c,0,44,0,-52,3,pal.woodD); pLine(c,-0.3,44,-0.3,-52,1.6,wood);
      pPoly(c,[-3.8,-52, 0,-72, 3.8,-52, 0,-47],blD);
      pPoly(c,[-2.8,-52, 0,-70, 2.6,-52, 0,-48.5],bl);
      pLine(c,-3,-50,3,-50,2.6,pal.trim);
      pHorn(c,0,-46,-4,-40,-3,-32+Math.sin(time*6),3,pal.acc);
      break;
    case 'bow':{
      const pull=P.p.bow;
      const tipT={x:-3,y:-34}, tipB={x:-3,y:34};
      c.strokeStyle=pal.woodD; c.lineWidth=4; c.lineCap='round';
      c.beginPath(); c.moveTo(tipT.x,tipT.y); c.quadraticCurveTo(14,-20,2,0); c.quadraticCurveTo(14,20,tipB.x,tipB.y); c.stroke();
      c.strokeStyle=d?pal.woodD:pal.wood; c.lineWidth=2.2;
      c.beginPath(); c.moveTo(tipT.x,tipT.y); c.quadraticCurveTo(14,-20,2,0); c.quadraticCurveTo(14,20,tipB.x,tipB.y); c.stroke();
      pLine(c,1,-5,1,5,4,pal.trim);
      if(w.gem){ pDot(c,4,0,pal.acc,1.6); }
      // тятива: до задньої кисті, якщо натягнута
      let sx=-3,sy=0;
      if(pull>0.05){
        // координати задньої кисті в системі лука
        const q=localPoint(P,P.S.handB,hd,ang); sx=-3+(q.x+3)*pull; sy=q.y*pull;
        // стріла
        pLine(c,sx,sy,sx+44,sy*0.2,PU*1.2,pal.woodD);
        pPoly(c,[sx+44,sy*0.2-2.2, sx+50,sy*0.2, sx+44,sy*0.2+2.2],pal.metalL);
      }
      c.strokeStyle=pal.white; c.lineWidth=PU*0.9;
      c.beginPath(); c.moveTo(tipT.x,tipT.y); c.lineTo(sx,sy); c.lineTo(tipB.x,tipB.y); c.stroke();
      break;
    }
    case 'pistol':
      pPoly(c,[-2,6, 2,6, 3,-2, -2,-1],pal.woodD);
      pPoly(c,[-2.5,-4, 16,-5, 16,-1, -2,-0.5],pal.metalD);
      pLine(c,0,-3.2,15,-3.8,PU,pal.metalL);
      pDot(c,1,-1,pal.trim,1.6);
      break;
  }
  c.restore();
}
// точка з простору моделі → у систему зброї (кисть hd, кут ang)
function localPoint(P,pt,hd,ang){
  const dx=pt.x-hd.x, dy=pt.y-hd.y, cs=Math.cos(-ang), sn=Math.sin(-ang);
  return {x:dx*cs-dy*sn, y:dx*sn+dy*cs};
}
function drawStaffHead(P,kind,d){
  const {c,pal,time,m}=P;
  const acc=d?pal.accD:pal.acc;
  const pulse=1+Math.sin(time*4)*0.08+(P.p.glow||0)*0.3;
  switch(kind){
    case 'claw': // золоті пазурі зі сферою (Тірісфаль)
      pHorn(c,0,-50,-9,-58,-5,-68,3.4,pal.trimD);
      pHorn(c,0,-50,9,-58,5,-68,3.4,pal.trim);
      pCirc(c,0,-60,5.4*pulse,acc); pCirc(c,-1.4,-61.6,2.2,pal.accL);
      addLight(P,0,-60,14*pulse,pal.acc,0.9);
      break;
    case 'crystal':
      pPoly(c,[0,-76, 5,-62, 0,-52, -5,-62],acc); pPoly(c,[0,-76, 5,-62, 0,-58],pal.accL);
      pLine(c,-5,-52,5,-52,3,pal.trim);
      addLight(P,0,-64,13*pulse,pal.acc,0.8);
      break;
    case 'skull':
      pCirc(c,0,-58,6.2,pal.boneD); pCirc(c,0.6,-58.6,5.2,pal.bone);
      pPoly(c,[-2.5,-53, 4.5,-53, 3.5,-49, -1.5,-49],pal.bone);
      pDot(c,-1,-58,pal.eye,1.4); pDot(c,3,-58,pal.eye,1.4);
      addLight(P,1,-58,10*pulse,pal.eye,0.8);
      pHorn(c,-4,-62,-10,-66,-8,-72,2.6,pal.boneD);
      break;
    case 'moon':
      c.fillStyle=acc; c.beginPath(); c.arc(0,-62,8,0,7); c.arc(3.5,-64,6.5,0,7,true); c.fill('evenodd');
      pDot(c,1,-62,pal.white,1.4);
      addLight(P,0,-62,12*pulse,pal.acc,0.7);
      break;
    case 'crook':
      c.strokeStyle=pal.woodD; c.lineWidth=3.6; c.beginPath(); c.moveTo(0,-52); c.quadraticCurveTo(0,-72,-12,-66); c.quadraticCurveTo(-14,-58,-7,-58); c.stroke();
      pEll(c,-4,-54,3.5,2,pal.acc,0.4); pEll(c,3,-56,3,1.8,pal.accD,-0.4);
      pCirc(c,-6,-62,3,acc); addLight(P,-6,-62,9*pulse,pal.acc,0.6);
      break;
    case 'sun':
      pCirc(c,0,-60,5*pulse,acc);
      for(let i=0;i<8;i++){ const a=i*Math.PI/4+time; pLine(c,Math.cos(a)*6.5,-60+Math.sin(a)*6.5,Math.cos(a)*10,-60+Math.sin(a)*10,PU*1.1,pal.trim); }
      addLight(P,0,-60,15*pulse,pal.acc,0.9);
      break;
    case 'totem':
      pPoly(c,[-6,-52, 6,-52, 5,-68, -5,-68],pal.woodD);
      pPoly(c,[-5,-53, 5,-53, 4,-67, -4,-67],pal.wood);
      pDot(c,-2,-62,pal.eye,1.3); pDot(c,2,-62,pal.eye,1.3); pLine(c,-3,-57,3,-57,PU*1.2,pal.acc);
      pHorn(c,-5,-66,-11,-72,-14,-80,3,pal.white);
      addLight(P,0,-62,10*pulse,pal.acc,0.5);
      break;
    case 'void':
      pHorn(c,0,-50,-8,-60,-3,-70,3,pal.primDD);
      pHorn(c,0,-50,8,-60,3,-70,3,pal.primD);
      pCirc(c,0,-61,5*pulse,pal.shadow); pCirc(c,0,-61,3.4,acc);
      addLight(P,0,-61,12*pulse,pal.acc,0.8);
      break;
    case 'flame':{
      pLine(c,-5,-52,5,-52,3,pal.trim);
      const f=Math.sin(time*16)*1.5;
      pPoly(c,[-5,-53, -2+f,-70, 0,-62, 3-f,-74, 5,-53],acc);
      pPoly(c,[-2.5,-53, 0+f,-64, 2.5,-53],pal.accL);
      addLight(P,0,-60,15*pulse,pal.acc,0.9);
      break;
    }
    case 'leaf':
      c.strokeStyle=pal.woodD; c.lineWidth=3; c.beginPath(); c.moveTo(0,-52); c.quadraticCurveTo(8,-60,2,-70); c.stroke();
      c.beginPath(); c.moveTo(0,-52); c.quadraticCurveTo(-8,-62,-3,-70); c.stroke();
      pCirc(c,0,-63,4*pulse,acc); for(const [x,y,r] of [[6,-68,0.6],[-6,-66,-0.5],[2,-72,0]]) pEll(c,x,y,3.4,1.8,pal.accD,r);
      addLight(P,0,-63,10*pulse,pal.acc,0.6);
      break;
    case 'rune':
      pPoly(c,[-4,-52, 4,-52, 6,-66, 0,-74, -6,-66],pal.metalD);
      pPoly(c,[-3,-53, 3,-53, 5,-65, 0,-72, -5,-65],pal.metal);
      pLine(c,0,-56,0,-68,PU*1.4,acc); pLine(c,-3,-62,3,-62,PU*1.4,acc);
      addLight(P,0,-63,10*pulse,pal.acc,0.6);
      break;
    default: // сфера
      pLine(c,-5,-52,5,-52,3,pal.trim);
      pCirc(c,0,-58,5*pulse,acc); pCirc(c,-1.3,-59.5,2,pal.accL);
      addLight(P,0,-58,13*pulse,pal.acc,0.8);
  }
}

/* ---------- щит (передня рука) ---------- */
function drawShield(P,w,hd,ang){
  const {c,pal}=P;
  c.save(); c.translate(hd.x+2,hd.y-1); c.rotate(ang*0.25); c.scale(1.3,1.3);
  const sx=0.82;
  const shape=w.shape==='round'?null:[-12*sx,-15, 12*sx,-15, 12.5*sx,2, 0,17, -12.5*sx,2];
  if(shape){ pPath(c,[-14*sx,-16, 13*sx,-16, 13.5*sx,2, 0,18.5, -2,18, -15*sx,2]); pOut(c,2/1.3); pPoly(c,[-14*sx,-16, -12*sx,-16, -12.5*sx,2, 0,18, -2,18, -15*sx,2],pal.metalD); }
  const fill=(pts,col)=>{ if(pts) pPoly(c,pts,col); else pCirc(c,0,0,col===pal.trim?14:12.2,col); };
  fill(shape?[-13*sx,-16, 13*sx,-16, 13.5*sx,2, 0,18.5, -13.5*sx,2]:null,pal.trim);
  fill(shape,pal.shieldCol);
  c.save(); if(shape) pPath(c,shape); else { c.beginPath(); c.arc(0,0,12.2,0,7); } c.clip();
  pPoly(c,[-20,-20, -3,-20, -3,20, -20,20],pal.shieldD);
  c.restore();
  drawEmblem(c,w.emblem,0.5,-1,5,pal.trim,pal.shieldD);
  c.restore();
}

/* ============================================================
   МУНКІН (форма сови): гуманоїдний скелет, пернате тіло
   ============================================================ */
/* ---------- Дерево життя (Restoration): стовбур, гілки-руки, коріння-ноги, крона ---------- */
function paintTree(P){
  treeArm(P,'b');
  treeLeg(P,'b'); treeLeg(P,'f');
  treeTrunk(P);
  treeCrown(P);
  treeArm(P,'f');
}
function treeLeg(P,side){
  const {c,S,pal}=P, d=side==='b';
  const hip=d?S.hipB:S.hipF, kn=d?S.kneeB:S.kneeF, ft=d?S.footB:S.footF;
  pLimb(c,hip,kn,17,d?pal.furD:pal.fur,pal.furDD);
  pLimb(c,kn,ft,14,d?pal.furD:pal.fur,pal.furDD);
  // коріння розходиться від стопи
  for(const [dx,dy,w] of [[13,2,4.5],[6,3,4],[-8,2,4]]){ pHorn(c,ft.x,ft.y-3,ft.x+dx*0.6,ft.y-1,ft.x+dx,ft.y+dy,w+PU*1.4,OL); pHorn(c,ft.x,ft.y-3,ft.x+dx*0.6,ft.y-1,ft.x+dx,ft.y+dy,w,d?pal.furDD:pal.furD); }
}
function treeTrunk(P){
  const {c,S,pal}=P;
  c.save(); c.translate(S.pel.x,S.pel.y); c.rotate(S.lean);
  const shape=()=>{ c.beginPath(); c.moveTo(-15,4); c.quadraticCurveTo(-20,-26,-13,-52); c.quadraticCurveTo(2,-60,16,-52);
    c.quadraticCurveTo(22,-26,17,4); c.quadraticCurveTo(1,9,-15,4); c.closePath(); };
  shape(); pOut(c,2); c.fillStyle=pal.furD; c.fill();
  c.save(); shape(); c.clip();
  pPoly(c,[-8,-58, 22,-58, 22,8, -6,8],pal.fur);
  pEll(c,8,-22,8,16,pal.belly);                                   // світліша молода кора спереду
  for(const [x,y0,y1] of [[-9,0,-48],[-2,2,-54],[5,-6,-50],[13,0,-44]]) pLine(c,x,y0,x+Math.sin(y0)*1.5,y1,PU*1.2,pal.furDD); // борозни кори
  pEll(c,-3,-26,3,4.5,pal.furDD); pEll(c,-3,-26,1.6,2.8,pal.shadow);   // дупло
  pLine(c,-12,-40,-6,-50,PU,pal.furL);
  c.restore();
  // обличчя в корі: очі під наростом і рот
  pPoly(c,[2,-46, 15,-47, 14,-43, 2,-43],pal.furDD);
  pDot(c,6,-41,pal.eye,1.6); pDot(c,12,-41,pal.eye,1.4); addLight(P,9,-41,8,pal.eye,0.9);
  pLine(c,6,-33,13,-34,PU*1.2,pal.furDD);
  // мох і квіти на плечах
  for(const [x,y] of [[-12,-50],[14,-50]]){ pEll(c,x,y,6,3,pal.leafD); pEll(c,x,y-1,4.5,2.2,pal.leaf); }
  c.restore();
}
function treeCrown(P){
  const {c,S,pal,time}=P;
  const cs=Math.cos(S.lean), sn=Math.sin(S.lean);
  const bx=S.pel.x-(-66)*sn+2*cs, by=S.pel.y+(-66)*cs+2*sn;
  c.save(); c.translate(bx,by); c.rotate(S.lean+P.p.head*0.5);
  const sway=Math.sin(time*1.6)*1.2;
  const blobs=[[-16,4,12],[16,4,12],[-8,-10,14],[10,-10,14],[0,-20,13],[0,2,15],[-20,-8,9],[21,-7,9]];
  for(const [x,y,r] of blobs){ c.beginPath(); c.arc(x+sway*(y<-5?1:0.4),y,r,0,7); pOut(c,2.2); }
  for(const [x,y,r] of blobs) pCirc(c,x+sway*(y<-5?1:0.4),y,r,pal.leafD);
  for(const [x,y,r] of blobs) pCirc(c,x+sway*(y<-5?1:0.4)+1,y-1.5,r*0.78,pal.leaf);
  for(const [x,y] of [[-9,-14],[8,-15],[1,-24],[-17,0],[16,0],[3,-4]]) pEll(c,x+sway,y,3.6,1.8,pal.leafL,-0.5);
  for(const [x,y] of [[-12,-6],[11,-3],[-2,-17],[18,-12],[-19,-11],[5,6]]){
    const tw=0.8+Math.sin(time*3+x)*0.2;
    pDot(c,x+sway,y,pal.flower,1.8*tw); pDot(c,x+sway+0.3,y-0.3,pal.flowerL,0.9);
  }
  c.restore();
}
function treeArm(P,side){
  const {c,S,pal,p,m,time}=P, d=side==='b';
  const sh=d?S.shB:S.shF, el=d?S.elB:S.elF, hd=d?S.handB:S.handF;
  pLimb(c,sh,el,12,d?pal.furD:pal.fur,pal.furDD);
  pLimb(c,el,hd,9,d?pal.furD:pal.fur,pal.furDD);
  // пальці-гілочки з листям
  for(const [ax,ay] of [[7,-5],[9,0],[6,5]]){ pLine(c,hd.x,hd.y,hd.x+ax,hd.y+ay,2.2,d?pal.furDD:pal.furD); pEll(c,hd.x+ax+1.5,hd.y+ay,2.6,1.4,d?pal.leafD:pal.leaf,ay*0.1); }
  const mid=lp(sh,el,0.5,-3); pEll(c,mid.x,mid.y-2,4,2,d?pal.leafD:pal.leaf,-0.6);   // листок на гілці
  if(p.glow>0.05 && side===(m.castSide||'f')){
    const r=3+p.glow*4+Math.sin(time*20)*0.8;
    pCirc(c,hd.x+5,hd.y-3,r,pal.accL); pCirc(c,hd.x+5,hd.y-3,r*0.55,pal.white);
    addLight(P,hd.x+5,hd.y-3,10+p.glow*14,m.castCol||pal.acc,0.9);
  }
}
function paintMoonkin(P){
  owlArm(P,'b');
  owlLeg(P,'b'); owlLeg(P,'f');
  owlBody(P);
  owlHead(P);
  owlArm(P,'f');
}
function owlLeg(P,side){
  const {c,S,pal}=P, d=side==='b';
  const hip=d?S.hipB:S.hipF, kn=d?S.kneeB:S.kneeF, ft=d?S.footB:S.footF;
  pLimb(c,hip,kn,24,d?pal.furD:pal.fur,pal.furDD);          // пухнасте стегно-«штанці»
  pLimb(c,kn,ft,6,d?pal.beakD:pal.beak,pal.beakD);          // луската гомілка
  for(const [dx,dy] of [[9,1],[7,-1.5],[-5,0.5]]) pLine(c,ft.x,ft.y-1.5,ft.x+dx,ft.y+dy,2.4,d?pal.boneD:pal.bone); // кігті
  for(let i=0;i<3;i++) pHorn(c,kn.x-6+i*5,kn.y-2,kn.x-7+i*5,kn.y+5,kn.x-6+i*5,kn.y+11,5,d?pal.furDD:(i%2?pal.furD:pal.fur)); // пір'яна бахрома
}
function owlBody(P){
  const {c,S,pal,m,time}=P;
  c.save(); c.translate(S.pel.x,S.pel.y); c.rotate(S.lean);
  c.beginPath(); c.ellipse(1,-17,26,30,0,0,7); pOut(c,2);
  pEll(c,1,-17,26,30,pal.furD);
  c.save(); c.beginPath(); c.ellipse(1,-17,26,30,0,0,7); c.clip();
  pEll(c,4,-19,24,28,pal.fur);
  // світле черевце з «ялинкою» пір'я
  pEll(c,10,-13,14,22,pal.belly);
  for(let r=0;r<6;r++){ const y=-28+r*6; c.strokeStyle=pal.bellyD; c.lineWidth=PU; c.beginPath(); c.moveTo(4,y); c.lineTo(10,y+3.5); c.lineTo(16,y); c.stroke(); }
  pLine(c,-12,-40,-4,-44,PU,pal.furL);
  // пір'я на боках
  for(let i=0;i<5;i++) pHorn(c,-18,-34+i*8,-24,-27+i*8,-19,-20+i*8,4.5,pal.furDD);
  c.restore();
  const mk=m.look.mark;
  if(mk==='gold'){ c.strokeStyle=pal.gold; c.lineWidth=PU*1.6; c.beginPath(); c.ellipse(4,-36,13,4,0,0.2,3); c.stroke(); pDot(c,9,-33,pal.acc,1.8); }
  if(mk==='leaf') for(const [x,y,r] of [[-8,-42,0.5],[-2,-45,-0.3],[5,-44,0.2]]) pEll(c,x,y,5,2.2,pal.leaf,r);
  if(mk==='stars'){ for(const [x,y] of [[6,-24],[11,-12],[4,-6],[-6,-30]]){ const tw=0.6+Math.sin(time*4+x)*0.4; pDot(c,x,y,pal.accL,1.2+tw*0.6); } addLight(P,6,-16,16,pal.acc,0.5); }
  c.restore();
}
function owlHead(P){
  const {c,S,pal,p,time}=P;
  const cs=Math.cos(S.lean), sn=Math.sin(S.lean);
  const bx=S.pel.x-(-46)*sn+7*cs, by=S.pel.y+(-46)*cs+7*sn; // голова сидить низько на тулубі
  c.save(); c.translate(bx,by); c.rotate(S.lean+p.head); c.scale(1.25,1.25);
  // роги мункіна
  pLine(c,-6,-9,-13,-24,3,pal.woodD); pLine(c,-10,-17,-19,-19,2.4,pal.woodD);
  pLine(c,-1,-11,-2,-27,3.2,pal.wood); pLine(c,-2,-20,-9,-25,2.4,pal.wood); pLine(c,-2,-23,4,-29,2.2,pal.wood);
  c.beginPath(); c.ellipse(0,0,13,12,0,0,7); pOut(c,2);
  pEll(c,0,0,13,12,pal.furD); pEll(c,0.5,-0.8,12,11,pal.fur);
  // вушні пучки
  pHorn(c,-6,-9,-9,-14,-12,-17,4,pal.furD);
  // лицевий диск
  pEll(c,5,1,9,9.5,pal.bellyD); pEll(c,5.5,0.5,8,8.6,pal.belly);
  // очі: ближнє велике, дальнє менше
  const bl=Math.sin(time*0.9)>0.97?0.3:1; // рідкісне кліпання
  pCirc(c,8,-1,3.4*bl,pal.shadow); pDot(c,8.2,-1.2,pal.eye,2*bl);
  pCirc(c,2,-1.5,2.4*bl,pal.shadow); pDot(c,2.2,-1.6,pal.eye,1.4*bl);
  addLight(P,6,-1,8,pal.eye,0.9);
  // дзьоб
  pPath(c,[9,2, 16,4, 11,9]); pOut(c,2); c.fillStyle=pal.beak; c.fill();
  pPoly(c,[11,6, 15.5,4.4, 11,8.6],pal.beakD);
  c.restore();
}
function owlArm(P,side){
  const {c,S,pal,p,m,time}=P, d=side==='b';
  const sh=d?S.shB:S.shF, el=d?S.elB:S.elF, hd=d?S.handB:S.handF;
  const col=d?pal.furD:pal.fur, dk=d?pal.furDD:pal.furD;
  // махове пір'я звисає з руки-крила (малюємо під рукою)
  const dx=hd.x-el.x, dy=hd.y-el.y;
  for(let i=0;i<5;i++){
    const k=-0.3+i*0.3, x=el.x+dx*k, y=el.y+dy*k;
    pHorn(c,x,y+2,x-5,y+12,x-8-i,y+22+i*1.5,6,OL);
    pHorn(c,x,y+2,x-5,y+11,x-7.5-i,y+21+i*1.5,5,i%2?(d?pal.furDD:pal.furD):(d?pal.furD:pal.furL));
  }
  pLimb(c,sh,el,16,col,dk);
  pLimb(c,el,hd,13,col,dk);
  for(const [ax,ay] of [[4,-2],[5,1],[3,3]]) pLine(c,hd.x,hd.y,hd.x+ax,hd.y+ay,2,d?pal.boneD:pal.bone); // кігті
  if(p.glow>0.05 && side===(m.castSide||'f')){
    const r=3+p.glow*4+Math.sin(time*20)*0.8;
    pCirc(c,hd.x+4,hd.y-3,r,pal.accL); pCirc(c,hd.x+4,hd.y-3,r*0.55,pal.white);
    addLight(P,hd.x+4,hd.y-3,10+p.glow*14,m.castCol||pal.acc,0.9);
  }
}
