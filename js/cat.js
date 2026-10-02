"use strict";
/* ============================================================
   ФОРМА КОТА: чотирилапий риг, анімації та малювання.
   Локальна система та сама: дивиться вправо, початок — на землі.
   Канали: центр тіла (bx,by), нахил (tilt, + — носом донизу),
   розтяг хребта (stretch), голова (head, hy), паща (jaw), вуха (ears),
   хвіст (tail) і цілі чотирьох лап: передня ближня (fn), передня
   дальня (ff), задня ближня (hn), задня дальня (hf).
   ============================================================ */
const CAT={BODY_Y:-42,FORE1:17,FORE2:20,HIND1:19,HIND2:15};
const CAT0={bx:0,by:0,tilt:0,stretch:0,head:0,hy:0,jaw:0,ears:0,tail:0.5,
  fnx:24,fny:0,ffx:30,ffy:0,hnx:-22,hny:0,hfx:-16,hfy:0,
  rot:0,ox:0,oy:0,flip:1,fade:1,glow:0};
const CAT_CH=Object.keys(CAT0);

function catMix(a,b,k){ const o={}; for(const ch of CAT_CH) o[ch]=a[ch]+(b[ch]-a[ch])*k; return o; }
function catKeys(keys,t,base){
  const full=i=>Object.assign({},base,keys[i][1]);
  if(t<=keys[0][0]) return full(0);
  for(let i=0;i<keys.length-1;i++){
    const t0=keys[i][0], t1=keys[i+1][0];
    if(t<=t1) return catMix(full(i),full(i+1),ease((t-t0)/((t1-t0)||1)));
  }
  return full(keys.length-1);
}

/* ---------- дії кота ---------- */
const CAT_ACT={
  atkA:{dur:0.3,keys:[[0,{fnx:30,fny:-26,tilt:-0.16,by:-3,head:-0.1}],[0.08,{fnx:30,fny:-36,tilt:-0.24,by:-6}],[0.16,{fnx:52,fny:-6,tilt:0.1,stretch:6,head:0.15}],[0.3,{}]]},
  atkB:{dur:0.3,keys:[[0,{ffx:34,ffy:-26,tilt:-0.16,by:-3,head:-0.1}],[0.08,{ffx:34,ffy:-36,tilt:-0.24,by:-6}],[0.16,{ffx:56,ffy:-6,tilt:0.1,stretch:6,head:0.15}],[0.3,{}]]},
  heavy:{dur:0.46,keys:[[0,{by:4,tilt:0.08,head:0.1}],[0.12,{by:7,stretch:-4,head:0.25,jaw:0.3,ears:0.6}],
    [0.22,{bx:14,stretch:10,tilt:0.14,head:0.3,jaw:1,ears:1,fnx:42,ffx:48,hnx:-14,hfx:-8}],
    [0.3,{bx:14,stretch:8,jaw:0,head:0.35,fnx:42,ffx:48,hnx:-14,hfx:-8}],[0.46,{}]]},
  roar:{dur:0.6,keys:[[0,{by:3}],[0.15,{tilt:-0.28,by:-7,head:-0.6,jaw:1,fnx:34,fny:-16,tail:1.2}],[0.45,{tilt:-0.28,by:-7,head:-0.6,jaw:1,fnx:34,fny:-16,tail:1.2}],[0.6,{}]]},
  lunge:{dur:0.44,keys:[[0,{stretch:12,tilt:-0.12,by:-22,fnx:54,fny:-22,ffx:58,ffy:-20,hnx:-46,hny:-8,hfx:-42,hfy:-6,jaw:1,ears:1,tail:0}],
    [0.22,{stretch:6,by:-4,fnx:46,fny:-3,ffx:50,ffy:-3,jaw:0.6}],[0.44,{}]]},
  tossed:{dur:0.9,keys:[[0,{tilt:-0.45,by:-4,head:-0.4,ears:1,fnx:34,fny:-20,ffx:38,ffy:-18,hnx:-30,hny:-12,hfx:-26,hfy:-10,tail:1.2}],[0.9,{}]]},
  hurt:{dur:0.26,keys:[[0,{bx:-6,head:-0.35,ears:1,tilt:-0.1,jaw:0.5}],[0.26,{}]]},
  land:{dur:0.18,keys:[[0,{by:9,stretch:-3}],[0.18,{}]]},
  vanish:{dur:0.4,keys:[[0,{by:10,fade:0.5,ears:1}],[0.4,{by:8}]]},
  die:{dur:0.9,hold:true,keys:[[0,{head:-0.3,bx:-4,ears:1}],[0.3,{by:14,head:0.5,fnx:30,ffx:34,hnx:-26,hfx:-20,ears:1}],
    [0.6,{by:27,tilt:0.04,head:0.9,ears:1,stretch:4,fnx:46,fny:0,ffx:52,ffy:0,hnx:-46,hny:0,hfx:-40,hfy:0,tail:1.6}],
    [0.9,{by:27,tilt:0.04,head:0.95,ears:1,stretch:4,fnx:46,fny:0,ffx:52,ffy:0,hnx:-46,hny:0,hfx:-40,hfy:0,tail:1.6}]]},
  victory:{dur:1.4,loop:true,fn:(t,b)=>{
    const s=Math.sin(t*Math.PI*2/1.4);
    return {...b,tilt:-0.22,by:-5,head:-0.45+s*0.08,jaw:0.5+s*0.5,fnx:30,fny:-10+s*3,tail:1.3,glow:0.5}; }},
};
function catSample(spec,t,base){
  const tt=spec.loop?t%spec.dur:Math.min(t,spec.dur);
  return spec.fn?spec.fn(tt,base):catKeys(spec.keys,tt,base);
}

/* ---------- цикли руху ---------- */
function catLoco(m,base,t){
  const o={...base};
  switch(m.mode){
    case 'idle':{
      const s=Math.sin(t*2.2);
      o.by=s*1; o.head=Math.sin(t*1.1)*0.05; o.tilt=-0.02;
      break;
    }
    case 'run': case 'walk': case 'back':{
      const run=m.mode==='run', ph=m.phase;
      const A=run?20:12, L=run?14:6;
      const paw=(x0,phi)=>{ const c=Math.cos(phi), s=Math.sin(phi); return [x0+A*c, s<0?L*s:0]; };
      if(run){ // галоп: передні парою, задні парою в протифазі
        [o.fnx,o.fny]=paw(24,ph); [o.ffx,o.ffy]=paw(30,ph+0.55);
        [o.hnx,o.hny]=paw(-22,ph+Math.PI); [o.hfx,o.hfy]=paw(-16,ph+Math.PI+0.55);
        o.stretch=5*Math.cos(ph); o.tilt=0.07*Math.sin(ph); o.by=-3*Math.abs(Math.cos(ph))+2;
        o.head=0.12; o.ears=0.3; o.tail=0.2;
      } else { // рись: діагональні пари разом
        [o.fnx,o.fny]=paw(24,ph); [o.hfx,o.hfy]=paw(-16,ph);
        [o.ffx,o.ffy]=paw(30,ph+Math.PI); [o.hnx,o.hny]=paw(-22,ph+Math.PI);
        o.by=1-Math.abs(Math.sin(ph))*1.2; o.head=m.mode==='back'?-0.1:0.05;
        if(m.mode==='back'){ o.ears=0.8; o.by+=3; }
      }
      break;
    }
    case 'air':{
      const k=clamp((m.vy+420)/760,0,1);
      const up={stretch:9,tilt:-0.14,fnx:46,fny:-12,ffx:50,ffy:-10,hnx:-42,hny:-4,hfx:-38,hfy:-2,tail:0.1};
      const dn={stretch:2,tilt:0.1,fnx:36,fny:-2,ffx:40,ffy:-3,hnx:-18,hny:-14,hfx:-14,hfy:-12,tail:0.9};
      for(const ch in up) o[ch]=up[ch]+(dn[ch]-up[ch])*k;
      break;
    }
    case 'block': Object.assign(o,{by:9,head:0.25,ears:1,jaw:0.45,fnx:32,ffx:36,hnx:-26,hfx:-20,tilt:0.05}); break;
    case 'stun': Object.assign(o,{by:6,head:0.45+Math.sin(t*5)*0.15,tilt:Math.sin(t*6)*0.08,ears:1}); break;
  }
  if(m.sneak){ o.by+=8; o.head+=0.12; o.ears=Math.max(o.ears,0.5); }
  return o;
}

class CatAnimCtl{
  constructor(){ this.base={...CAT0}; this.pose={...CAT0}; this.act=null; this.t=0; this.phase=0; }
  play(name){
    const spec=CAT_ACT[name]; if(!spec) return;
    if(this.act&&this.act.spec.hold&&name!=='die') return;
    this.act={name,spec,t:0};
  }
  stop(){ this.act=null; }
  update(dt,m){
    this.t+=dt;
    if(m.mode==='run') this.phase+=dt*Math.PI*m.speed/40;
    else if(m.mode==='walk') this.phase+=dt*Math.PI*m.speed/24;
    else if(m.mode==='back') this.phase-=dt*Math.PI*m.speed/24;
    m.phase=this.phase;
    let target=catLoco(m,this.base,this.t), rate=18;
    const a=this.act;
    if(a){
      a.t+=dt;
      if(!a.spec.loop&&!a.spec.hold&&a.t>=a.spec.dur) this.act=null;
      else { target=catSample(a.spec,a.t,this.base); rate=34; }
    }
    const k=1-Math.exp(-rate*dt);
    for(const ch of CAT_CH){
      if(DIRECT_CH.has(ch)) this.pose[ch]=target[ch];
      else this.pose[ch]+=(target[ch]-this.pose[ch])*k;
    }
    return this.pose;
  }
}

/* ---------- скелет кота ---------- */
function solveCat(p){
  const C={x:p.bx,y:CAT.BODY_Y+p.by};
  const cs=Math.cos(p.tilt), sn=Math.sin(p.tilt);
  const T=(lx,ly)=>({x:C.x+lx*cs-ly*sn, y:C.y+lx*sn+ly*cs});
  const sh=T(22+p.stretch,-2), hp=T(-22-p.stretch,0);
  const fr=T(22+p.stretch,6), hr=T(-22-p.stretch,5);
  const leg=(root,px,py,front)=>{
    if(front){ const r=ik2(root.x,root.y,px,py,CAT.FORE1,CAT.FORE2,-1); return {root,j:{x:r.jx,y:r.jy},paw:{x:r.ex,y:r.ey}}; }
    const hx=px-6, hy=py-10; // скакальний суглоб: задня лапа «на пальцях»
    const r=ik2(root.x,root.y,hx,hy,CAT.HIND1,CAT.HIND2,1);
    return {root,j:{x:r.jx,y:r.jy},hock:{x:r.ex,y:r.ey},paw:{x:r.ex+6,y:r.ey+10}};
  };
  const neck=T(30+p.stretch,-14);
  const ha=p.tilt+p.head;
  const head={x:neck.x+Math.cos(ha-0.75)*12, y:neck.y+Math.sin(ha-0.75)*12+p.hy, a:ha};
  return {C,T,sh,hp,neck,head,
    fn:leg(fr,p.fnx,p.fny,true), ff:leg(T(26+p.stretch,6),p.ffx,p.ffy,true),
    hn:leg(hr,p.hnx,p.hny,false), hf:leg(T(-18-p.stretch,5),p.hfx,p.hfy,false)};
}

/* ---------- малювання ---------- */
function paintCat(c,m,p,time,lights){
  const S=solveCat(p);
  const P={c,m,p,S,time,lights,pal:m.pal};
  OL=m.pal.outline;
  c.save();
  c.translate(p.ox,p.oy);
  if(p.flip!==1){ const f=p.flip; c.scale((f<0?-1:1)*Math.max(0.4,Math.abs(f)),1); }
  catTail(P);
  catLeg(P,S.ff,true,true); catLeg(P,S.hf,false,true);
  catBody(P);
  catLeg(P,S.hn,false,false); catLeg(P,S.fn,true,false);
  catHead(P);
  c.restore();
}
function catTail(P){
  const {c,S,p,pal,time}=P;
  const base=S.T(-30-p.stretch,-6);
  let x=base.x, y=base.y, a=Math.PI+0.35-p.tail*0.5;
  const pts=[{x,y}];
  for(let i=0;i<7;i++){
    a+=-0.12*p.tail+Math.sin(time*2.6+i*0.7)*0.12+(i>3?-0.18:0);
    x+=Math.cos(a)*7; y+=Math.sin(a)*7;
    pts.push({x,y});
  }
  for(let i=0;i<pts.length-1;i++) pLine(c,pts[i].x,pts[i].y,pts[i+1].x,pts[i+1].y,7-i*0.5+PU*1.6,OL);
  for(let i=0;i<pts.length-1;i++) pLine(c,pts[i].x,pts[i].y,pts[i+1].x,pts[i+1].y,7-i*0.5,i>4&&m_stripe(P)?pal.stripe:pal.fur);
  if(P.m.look.pattern==='thorns') for(let i=1;i<pts.length-1;i+=2) pPoly(c,[pts[i].x-2,pts[i].y-2,pts[i].x,pts[i].y-8,pts[i].x+2,pts[i].y-2],pal.leaf);
}
function m_stripe(P){ return P.m.look.pattern==='tiger'||P.m.look.pattern==='none'; }
function catLeg(P,L,front,far){
  const {c,pal}=P;
  const col=far?pal.furD:pal.fur, dk=far?pal.furDD:pal.furD;
  if(front){
    pLimb(c,L.root,L.j,far?14:16,col,dk);
    pLimb(c,L.j,L.paw,far?10:11.5,col,dk);
  } else {
    pLimb(c,L.root,L.j,far?18:20,col,dk);   // стегно
    pLimb(c,L.j,L.hock,far?11:12,col,dk);   // гомілка
    pLimb(c,L.hock,L.paw,far?8:9,col,dk);   // плесна
  }
  // лапа
  c.beginPath(); c.ellipse(L.paw.x+2,L.paw.y-2.5,7,4.2,0,0,7); pOut(c,2);
  pEll(c,L.paw.x+2,L.paw.y-2.5,7,4.2,far?pal.furDD:pal.furD);
  pEll(c,L.paw.x+2.5,L.paw.y-3.1,5.4,3,far?pal.furD:pal.fur);
  if(!far&&front&&L.paw.y<-8){ for(let i=0;i<3;i++) pLine(c,L.paw.x+6,L.paw.y-4+i*1.8,L.paw.x+9.5,L.paw.y-3+i*2.2,PU,pal.white); }
}
function catBody(P){
  const {c,S,p,pal,m}=P;
  const st=p.stretch;
  c.save(); c.translate(S.C.x,S.C.y); c.rotate(p.tilt);
  const shape=()=>{ c.beginPath();
    c.moveTo(-37-st,-2);
    c.quadraticCurveTo(-36-st,-19,-22-st,-19);   // крижі
    c.quadraticCurveTo(0,-14,20+st,-21);          // спина з легким прогином
    c.quadraticCurveTo(38+st,-21,38+st,-2);        // загривок і груди
    c.quadraticCurveTo(37+st,17,22+st,16);
    c.quadraticCurveTo(0,17,-24-st,13);            // підтягнуте черево
    c.quadraticCurveTo(-39-st,11,-37-st,-2); c.closePath(); };
  shape(); pOut(c,2); c.fillStyle=pal.furD; c.fill();
  c.save(); shape(); c.clip();
  pPoly(c,[-40-st,-20, 40+st,-20, 40+st,6, -40-st,6],pal.fur);
  pPoly(c,[-30-st,10, 32+st,9, 34+st,22, -30-st,22],pal.belly);
  pLine(c,-26-st,-17,24+st,-19,PU*1.2,pal.furL);  // відблиск уздовж спини
  // лопатка і стегно — м'язи
  pEll(c,22+st,0,12,11,pal.fur); pLine(c,15+st,-8,25+st,-11,PU,pal.furL);
  pEll(c,-23-st,-2,13,12,pal.fur); pLine(c,-30-st,-9,-18-st,-12,PU,pal.furL);
  const pat=m.look.pattern;
  if(pat==='tiger'){ for(let x=-28;x<=26;x+=7){ const xx=x*(1+st/40); pHorn(c,xx,-19,xx-2,-9,xx+1,2,3.2,pal.stripe); } }
  else if(pat==='spots'){ for(let i=0;i<14;i++){ const x=-28+(i*9)%56, y=-10+((i*7)%3)*5; pDot(c,x,y,pal.stripe,1.4); } }
  else if(pat==='thorns'){ pLine(c,-30-st,-12,28+st,-13,PU*1.4,pal.leafD); }
  c.restore();
  if(pat==='thorns') for(let x=-26;x<=24;x+=8) pPoly(c,[x-2.5,-16, x-1,-26, x+2.5,-16],pal.leaf);
  if(m.look.collar==='leaf') for(const [x,y,r] of [[30+st,-10,0.6],[34+st,-4,1.2],[27+st,-15,-0.2]]) pEll(c,x,y,5,2.4,pal.leaf,r);
  c.restore();
}
function catHead(P){
  const {c,S,p,pal,m}=P;
  const H=S.head;
  // шия
  pLimb(c,S.T(26+p.stretch,-8),{x:H.x-2,y:H.y+3},19,pal.fur,pal.furD);
  c.save(); c.translate(H.x,H.y); c.rotate(H.a); c.scale(1.3,1.3);
  const ear=p.ears*0.9;
  // дальнє вухо
  pPath(c,[-8,-4, -9-ear*4,-13+ear*6, -2,-8]); pOut(c,2); c.fillStyle=pal.furDD; c.fill();
  // голова
  c.beginPath(); c.ellipse(0,0,10.5,9,0,0,7); pOut(c,2);
  pEll(c,0,0,10.5,9,pal.furD); pEll(c,0.5,-0.8,9.6,8,pal.fur);
  pLine(c,-5,-6,4,-7,PU,pal.furL);
  // ближнє вухо
  pPath(c,[-3,-6, -2-ear*5,-16+ear*7, 4,-7]); pOut(c,2); c.fillStyle=pal.fur; c.fill();
  pPoly(c,[-1.5,-7, -1.5-ear*4,-13+ear*6, 2.5,-7.5],pal.furDD);
  // нижня щелепа (відкривається)
  c.save(); c.translate(4,4); c.rotate(p.jaw*0.55);
  pPath(c,[0,0, 10,1, 9,5, 0,5]); pOut(c,2); c.fillStyle=pal.bellyD; c.fill();
  if(p.jaw>0.2){ pPoly(c,[1,0.5, 9,1, 8.5,2.5, 1,2.5],pal.shadow); pPoly(c,[7.5,1, 8.5,-1.5, 9,1.2],pal.white); }
  c.restore();
  // морда
  c.beginPath(); c.ellipse(8,2.5,6.5,4.6,0,0,7); pOut(c,2);
  pEll(c,8,2.5,6.5,4.6,pal.belly);
  if(p.jaw>0.2){ pPoly(c,[9,5.5, 10,9, 11,5.5],pal.white); pPoly(c,[5,5.5, 6,8.5, 7,5.5],pal.white); }
  pDot(c,14,0.8,pal.nose,1.5);
  pLine(c,11,4.5,16,5.5,PU*0.8,pal.bellyD); // вуса
  // очі
  pDot(c,4.5,-2.5,pal.eye,1.5); pDot(c,6.2,-2.8,pal.eye,1.1);
  addLight(P,5,-2.6,5,pal.eye,0.8);
  if(m.look.pattern==='tiger'){ pLine(c,-6,-5,-2,-3,PU*1.2,pal.stripe); pLine(c,-7,-1,-3,0,PU*1.2,pal.stripe); }
  c.restore();
}
