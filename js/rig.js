"use strict";
/* ============================================================
   РИГ ТА АНІМАЦІЇ
   Локальна система: боєць дивиться вправо (+x), початок координат —
   між ступнями на землі, y — вниз. Поза — це набір «каналів»:
   зсув таза, нахил торса, цілі ступнів і кистей (кінцівки розв'язує
   2-кістковий IK) та кути зброї (0 — вістрям угору, π/2 — вперед).
   ============================================================ */
const RIG={THIGH:25,SHIN:24,TORSO:40,NECK:7,HEAD:10.5,UPPER:19,FORE:18,PELVIS:-47};

const POSE0={
  px:0,py:0,lean:0.06,head:0,     // зсув таза, нахил торса й голови
  rot:0,ox:0,oy:0,flip:1,         // обертання всього тіла навколо таза, зсув, дзеркало (спін)
  bfx:-9,bfy:0,ffx:10,ffy:0,      // ступні: задня (b) і передня (f), від землі
  bhx:-4,bhy:-52,fhx:12,fhy:-56,  // кисті: відносно таза у стійці (рухаються разом з px/py)
  wb:0.6,wf:0.3,                  // кути зброї в задній і передній руці
  bow:0,glow:0,fade:1,cape:0,     // натяг тятиви, заряд у долоні, видимість (дизер), підйом плаща
};
const POSE_CH=Object.keys(POSE0);
const DIRECT_CH=new Set(['rot','ox','oy','flip','fade']); // ці канали не згладжуються

/* Стійки за стилем зброї (передня рука — ближча до глядача) */
const STANCE={
  staff:{lean:0.03,bfx:-8,ffx:9,fhx:15,fhy:-60,wf:0.06,bhx:-3,bhy:-51,wb:0.3},
  '2h':{lean:0.12,py:4,bfx:-14,ffx:14,fhx:15,fhy:-58,wf:0.55},
  dual:{lean:0.16,py:3,bfx:-14,ffx:13,fhx:17,fhy:-60,wf:1.2,bhx:7,bhy:-66,wb:0.9},
  shield:{lean:0.08,py:3,bfx:-12,ffx:12,fhx:17,fhy:-64,wf:0.15,bhx:-15,bhy:-75,wb:-0.85}, // зброя відведена за плече — видно з-за спини
  bow:{lean:0.04,bfx:-11,ffx:11,fhx:15,fhy:-58,wf:0.2,bhx:-4,bhy:-53},
  spear:{lean:0.12,py:4,bfx:-14,ffx:14,fhx:16,fhy:-62,wf:1.15},
  claw:{lean:0.32,py:9,bfx:-16,ffx:14,fhx:20,fhy:-58,wf:1.6,bhx:10,bhy:-64,wb:1.5},
  golem:{lean:0.14,py:6,bfx:-15,ffx:15,fhx:-7,fhy:-49,wf:0,bhx:16,bhy:-50,wb:0}, // інфернал: кулаки-брили звисають
  owl:{lean:0.06,py:11,bfx:-15,ffx:15,fhx:24,fhy:-52,wf:0,bhx:-18,bhy:-56,wb:0}, // мункін: крила-руки трохи розведені
};
// стійки бійців із растрових деталей (напівоберт 3/4): посох — навскіс уперед, щоб не закривав обличчя;
// одноручна зброя в дальній руці — перед тілом, а не за плечем чи спиною (models.js: m.stance)
const STANCE34={
  staff:{fhx:22,fhy:-54,wf:0.45},
  shield:{fhx:1,fhy:-55,wf:0.1,bhx:24,bhy:-84,wb:0.4},   // щит — ближньою рукою перед своєю половиною тіла, зброя — дальньою, піднята вперед: руки не перехрещуються
  dual:{fhx:12,fhy:-50,wf:1.0,bhx:24,bhy:-72,wb:0.6},   // ближня рука нижче — паралельно дальній, а не навхрест
};
const TWO_HAND={'2h':10,spear:14}; // задня кисть лягає на руків'я на цій відстані

/* ---------- Кінематика ---------- */
// 2-кістковий IK: bend=+1 — суглоб уперед (коліно), -1 — назад/вниз (лікоть)
function ik2(ax,ay,tx,ty,l1,l2,bend){
  let dx=tx-ax, dy=ty-ay, d=Math.hypot(dx,dy);
  const max=l1+l2-0.05;
  if(d>max){ dx*=max/d; dy*=max/d; d=max; }
  if(d<0.5) d=0.5;
  const th=Math.atan2(dy,dx);
  const al=Math.acos(clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1));
  const a=th-bend*al;
  return {jx:ax+Math.cos(a)*l1, jy:ay+Math.sin(a)*l1, ex:ax+dx, ey:ay+dy};
}

// Поза → положення суглобів
// v34 — напівоберт для бійця з растрових деталей (js/cutout.js): ближнє плече й стегно назад, дальні вперед
function solvePose(p,style,v34){
  const pel={x:p.px, y:RIG.PELVIS+p.py};
  const cs=Math.cos(p.lean), sn=Math.sin(p.lean);
  const T=(lx,ly)=>({x:pel.x+lx*cs-ly*sn, y:pel.y+lx*sn+ly*cs});
  const neck=T(0,-RIG.TORSO);
  const shB=v34?T(8,-RIG.TORSO+8):T(-4,-RIG.TORSO+7), shF=v34?T(-7,-RIG.TORSO+7):T(4,-RIG.TORSO+7);
  const hipB=v34?{x:pel.x+4,y:pel.y}:{x:pel.x-4,y:pel.y}, hipF=v34?{x:pel.x-3,y:pel.y}:{x:pel.x+4,y:pel.y};
  // у напівоберті дальнє стегно попереду — дальня ступня теж ближче, інакше чобіт стирчить з-під поли позаду
  const lb=ik2(hipB.x,hipB.y,p.bfx+(v34?6:0),p.bfy,RIG.THIGH,RIG.SHIN,1);
  const lf=ik2(hipF.x,hipF.y,p.ffx,p.ffy,RIG.THIGH,RIG.SHIN,1);
  const fhx=p.fhx+p.px, fhy=p.fhy+p.py;
  let bhx=p.bhx+p.px, bhy=p.bhy+p.py;
  const grip=TWO_HAND[style];
  if(grip){ bhx=fhx-Math.sin(p.wf)*grip; bhy=fhy+Math.cos(p.wf)*grip; }
  const ab=ik2(shB.x,shB.y,bhx,bhy,RIG.UPPER,RIG.FORE,-1);
  const af=ik2(shF.x,shF.y,fhx,fhy,RIG.UPPER,RIG.FORE,-1);
  const ha=p.lean+p.head;
  const head={x:neck.x+Math.sin(ha)*(RIG.NECK+RIG.HEAD)*0.9, y:neck.y-Math.cos(ha)*(RIG.NECK+RIG.HEAD), a:ha};
  return {
    pel,neck,head,lean:p.lean,T,
    hipB,hipF,kneeB:{x:lb.jx,y:lb.jy},kneeF:{x:lf.jx,y:lf.jy},footB:{x:lb.ex,y:lb.ey},footF:{x:lf.ex,y:lf.ey},
    shB,shF,elB:{x:ab.jx,y:ab.jy},elF:{x:af.jx,y:af.jy},handB:{x:ab.ex,y:ab.ey},handF:{x:af.ex,y:af.ey},
  };
}

/* ---------- Ключові кадри ---------- */
const ease=t=>t*t*(3-2*t);
function mixPose(a,b,k,out){
  for(const ch of POSE_CH) out[ch]=a[ch]+(b[ch]-a[ch])*k;
  return out;
}
// keys: [[час, {канали}], ...]; відсутні канали беруться зі стійки
function sampleKeys(keys,t,base){
  const full=i=>Object.assign({},base,keys[i][1]);
  if(t<=keys[0][0]) return full(0);
  for(let i=0;i<keys.length-1;i++){
    const t0=keys[i][0], t1=keys[i+1][0];
    if(t<=t1) return mixPose(full(i),full(i+1),ease((t-t0)/((t1-t0)||1)),{});
  }
  return full(keys.length-1);
}

/* ---------- Бібліотека дій ----------
   Кожна дія: {dur, keys | fn(t,base), loop?, hold?, upper?}
   upper — лише верх тіла (ноги продовжують бігти) */
const MELEE_STYLES=new Set(['2h','dual','shield','claw','spear']);
function actionSpec(style,name){
  const S=STANCE[style];
  const A={};
  /* --- ближній бій --- */
  if(style==='2h'){
    A.atkA={dur:0.36,upper:true,keys:[[0,{fhx:-2,fhy:-92,wf:-1.0,lean:-0.04}],[0.1,{fhx:-6,fhy:-98,wf:-1.5,lean:-0.1}],[0.19,{fhx:28,fhy:-58,wf:2.3,lean:0.38,py:8,ffx:20}],[0.36,{}]]};
    A.atkB={dur:0.36,upper:true,keys:[[0,{fhx:-8,fhy:-76,wf:-1.6,lean:-0.06}],[0.1,{fhx:-12,fhy:-78,wf:-2.0,lean:-0.12}],[0.2,{fhx:30,fhy:-70,wf:1.75,lean:0.32,ffx:20}],[0.36,{}]]};
    A.heavy={dur:0.52,keys:[[0,{fhx:0,fhy:-100,wf:-0.6}],[0.16,{py:-8,fhx:-4,fhy:-112,wf:-1.4,lean:-0.14,bfy:-4}],[0.28,{py:14,fhx:32,fhy:-46,wf:2.55,lean:0.5,ffx:24,bfx:-20}],[0.52,{}]]};
  } else if(style==='dual'){
    A.atkA={dur:0.3,upper:true,keys:[[0,{fhx:4,fhy:-70,wf:0.9,lean:0.12}],[0.07,{fhx:0,fhy:-72,wf:0.8}],[0.14,{fhx:38,fhy:-70,wf:1.6,lean:0.38,ffx:20}],[0.3,{}]]};
    A.atkB={dur:0.3,upper:true,keys:[[0,{bhx:-2,bhy:-72,wb:0.7,lean:0.12}],[0.07,{bhx:-6,bhy:-74}],[0.14,{bhx:36,bhy:-66,wb:1.6,lean:0.38,fhx:4,fhy:-62,wf:1.0,ffx:20}],[0.3,{}]]};
    A.heavy={dur:0.46,keys:[[0,{fhx:2,fhy:-98,wf:-0.3,bhx:-6,bhy:-94,wb:-0.2,py:0}],[0.13,{fhx:-2,fhy:-104,wf:-0.6,bhx:-10,bhy:-100,wb:-0.5,py:-4,lean:-0.1}],[0.25,{fhx:32,fhy:-48,wf:2.5,bhx:24,bhy:-44,wb:2.7,lean:0.5,py:12,ffx:24}],[0.46,{}]]};
  } else if(style==='shield'){
    A.atkA={dur:0.34,upper:true,keys:[[0,{bhx:-6,bhy:-100,wb:-0.9}],[0.1,{bhx:-8,bhy:-104,wb:-1.2,lean:-0.06}],[0.2,{bhx:28,bhy:-62,wb:2.0,lean:0.32,ffx:18}],[0.34,{}]]};
    A.atkB={dur:0.34,upper:true,keys:[[0,{bhx:-12,bhy:-80,wb:-1.7}],[0.1,{bhx:-14,bhy:-80,wb:-1.9}],[0.2,{bhx:30,bhy:-72,wb:1.7,lean:0.3,ffx:18}],[0.34,{}]]};
    A.heavy={dur:0.46,keys:[[0,{bhx:-4,bhy:-104,wb:-0.6}],[0.14,{py:-6,bhx:-8,bhy:-112,wb:-1.3,lean:-0.12}],[0.26,{py:12,bhx:30,bhy:-52,wb:2.4,lean:0.45,ffx:22}],[0.46,{}]]};
    A.bash={dur:0.36,keys:[[0,{fhx:8,fhy:-66}],[0.09,{fhx:2,fhy:-68,lean:-0.1}],[0.18,{fhx:36,fhy:-70,lean:0.42,px:6,ffx:24}],[0.36,{}]]};
  } else if(style==='claw'){
    A.atkA={dur:0.3,upper:true,keys:[[0,{fhx:4,fhy:-92,wf:0.3}],[0.07,{fhx:0,fhy:-96,wf:0.1}],[0.15,{fhx:34,fhy:-50,wf:2.4,lean:0.55}],[0.3,{}]]};
    A.atkB={dur:0.3,upper:true,keys:[[0,{bhx:-4,bhy:-94,wb:0.3}],[0.07,{bhx:-8,bhy:-98}],[0.15,{bhx:32,bhy:-50,wb:2.4,lean:0.55,fhx:10,fhy:-60}],[0.3,{}]]};
    A.heavy={dur:0.48,keys:[[0,{py:12,lean:0.5}],[0.12,{py:14,lean:0.55}],[0.24,{py:-18,px:14,lean:0.7,bfy:-16,ffy:-22,bfx:-18,ffx:22,fhx:40,fhy:-80,wf:1.7,bhx:34,bhy:-84,wb:1.7}],[0.36,{py:6,px:10,lean:0.6,fhx:38,fhy:-46,wf:2.4,bhx:30,bhy:-44,wb:2.5}],[0.48,{}]]};
  } else if(style==='spear'){
    A.atkA={dur:0.32,upper:true,keys:[[0,{fhx:2,fhy:-64,wf:1.5,lean:0.02}],[0.08,{fhx:-6,fhy:-64,wf:1.52}],[0.17,{fhx:40,fhy:-66,wf:1.55,lean:0.38,ffx:22}],[0.32,{}]]};
    A.atkB={dur:0.34,upper:true,keys:[[0,{fhx:-4,fhy:-96,wf:-0.6}],[0.1,{fhx:-6,fhy:-100,wf:-0.9}],[0.2,{fhx:30,fhy:-58,wf:2.2,lean:0.35,ffx:20}],[0.34,{}]]};
    A.heavy=A.atkB;
  }
  // мункін: б'є крилами-руками, касти — обома крилами (руки довгі, тож кисті тримаємо на рівні грудей, не перед обличчям)
  if(style==='owl'){
    A.atkA={dur:0.32,upper:true,keys:[[0,{fhx:-16,fhy:-82,lean:-0.06}],[0.09,{fhx:-20,fhy:-86,lean:-0.1}],[0.18,{fhx:30,fhy:-56,lean:0.28,ffx:18}],[0.32,{}]]};
    A.atkB={dur:0.32,upper:true,keys:[[0,{bhx:2,bhy:-90,lean:-0.06}],[0.09,{bhx:-2,bhy:-94,lean:-0.1}],[0.18,{bhx:38,bhy:-62,lean:0.3,fhx:6,fhy:-60,ffx:18}],[0.32,{}]]};
    A.heavy={dur:0.5,keys:[[0,{}],[0.16,{py:4,fhx:-14,fhy:-104,bhx:16,bhy:-106,lean:-0.14,head:-0.2}],[0.28,{py:16,fhx:28,fhy:-46,bhx:34,bhy:-50,lean:0.42,ffx:20,head:0.1}],[0.5,{}]]};
  }
  // інфернал: розмашисті удари кулаками-брилами, важкий — обома кулаками згори
  if(style==='golem'){
    A.atkA={dur:0.4,upper:true,keys:[[0,{fhx:-18,fhy:-92,lean:-0.06}],[0.14,{fhx:-22,fhy:-96,lean:-0.12}],[0.24,{fhx:36,fhy:-62,lean:0.38,ffx:20}],[0.4,{}]]};
    A.atkB={dur:0.4,upper:true,keys:[[0,{bhx:0,bhy:-96,lean:-0.06}],[0.14,{bhx:-4,bhy:-100,lean:-0.12}],[0.24,{bhx:42,bhy:-60,lean:0.4,fhx:2,fhy:-58,ffx:20}],[0.4,{}]]};
    A.heavy={dur:0.56,keys:[[0,{}],[0.2,{py:0,fhx:-10,fhy:-114,bhx:14,bhy:-116,lean:-0.16,head:-0.2}],[0.32,{py:16,fhx:30,fhy:-34,bhx:36,bhy:-36,lean:0.5,ffx:20}],[0.56,{}]]};
  }
  // у стилях без ближнього бою (посох/лук) — удар посохом/луком
  if(!A.atkA){
    A.atkA={dur:0.32,upper:true,keys:[[0,{fhx:0,fhy:-90,wf:-0.5}],[0.1,{fhx:-4,fhy:-94,wf:-0.8}],[0.2,{fhx:30,fhy:-62,wf:1.9,lean:0.3,ffx:18}],[0.32,{}]]};
    A.atkB=A.atkA; A.heavy=A.atkA;
  }
  /* --- дальній бій і касти --- */
  const castHand=style==='staff'||style==='bow'?'b':(style==='shield'||style==='dual'||style==='claw'?'b':'f');
  const H=(x,y,o={})=>castHand==='b'?{bhx:x,bhy:y,...o}:{fhx:x,fhy:y,...o};
  A.channel={dur:1,loop:true,fn:(t,b)=>{
    const s=Math.sin(t*Math.PI*2*1.5);
    const o={...b,lean:-0.05,py:(b.py||0)+1+s*0.8};
    if(style==='staff'){ o.fhx=18; o.fhy=-74; o.wf=0.22; o.bhx=22; o.bhy=-80+s; }
    else if(style==='bow'){ o.fhx=30; o.fhy=-82; o.wf=0.02; o.bhx=4; o.bhy=-82; o.bow=1; }
    else if(castHand==='b'){ o.bhx=20; o.bhy=-86+s; o.wb=b.wb; }
    else { o.fhx=16; o.fhy=-98+s; o.wf=-0.1; }
    o.glow=1; return o; }};
  if(style==='owl'){   // крила вгору «V», заряд над плечима; викид — поштовх ближнім крилом уперед
    A.channel={dur:1,loop:true,fn:(t,b)=>{ const s=Math.sin(t*Math.PI*2*1.5);
      return {...b,lean:-0.08,head:-0.12,py:(b.py||0)+1+s*0.8,fhx:-17,fhy:-106+s*2,bhx:20,bhy:-110-s*2,glow:1}; }};
    A.release={dur:0.36,upper:true,keys:[[0,{fhx:-13,fhy:-106,bhx:20,bhy:-108,lean:-0.08,glow:1}],[0.08,{fhx:-16,fhy:-100,bhx:16,bhy:-104,lean:-0.12,glow:1}],
      [0.17,{fhx:34,fhy:-70,bhx:30,bhy:-74,lean:0.24,ffx:16,glow:0.4}],[0.36,{}]]};
  } else
  A.release={dur:0.34,upper:true,keys:[[0,H(8,-80,{glow:1})],[0.07,H(2,-84,{lean:-0.08,glow:1})],[0.15,H(38,-80,{lean:0.22,ffx:16,glow:0.4,...(style==='staff'?{fhx:22,fhy:-68,wf:0.5}:{})})],[0.34,{}]]};
  A.shoot={dur:0.4,upper:true,keys:[[0,{fhx:30,fhy:-82,wf:0.02,bhx:26,bhy:-82,bow:0}],[0.14,{fhx:30,fhy:-82,wf:0.02,bhx:4,bhy:-82,bow:1}],[0.18,{fhx:31,fhy:-82,wf:0.02,bhx:-6,bhy:-86,bow:0,lean:-0.04}],[0.4,{}]]};
  A.pistol={dur:0.34,upper:true,keys:[[0,{bhx:34,bhy:-80,wb:1.57}],[0.06,{bhx:36,bhy:-80,wb:1.57}],[0.11,{bhx:28,bhy:-86,wb:1.1,lean:-0.06}],[0.34,{}]]};
  A.throw={dur:0.36,upper:true,keys:[[0,H(-10,-86,{lean:-0.12})],[0.1,H(-12,-88,{lean:-0.14})],[0.18,H(38,-78,{lean:0.34,ffx:20})],[0.36,{}]]};
  A.heal={dur:0.55,keys:[[0,{}],[0.14,{bhx:6,bhy:-114,fhx:20,fhy:-100,wf:-0.1,head:-0.35,lean:-0.12,glow:1}],[0.42,{bhx:8,bhy:-116,fhx:21,fhy:-102,wf:-0.1,head:-0.35,lean:-0.12,glow:1}],[0.55,{}]]};
  A.ward={dur:0.48,keys:[[0,{}],[0.13,{bhx:10,bhy:-76,fhx:12,fhy:-80,lean:0.1,py:(S.py||0)+3}],[0.3,{bhx:-22,bhy:-88,fhx:32,fhy:-90,lean:-0.08,glow:1}],[0.48,{}]]};
  A.nova={dur:0.48,keys:[[0,{py:(S.py||0)+6,bhx:6,bhy:-62,fhx:10,fhy:-62}],[0.12,{py:(S.py||0)+10,bhx:4,bhy:-60,fhx:8,fhy:-60,lean:0.2}],[0.22,{py:-4,bhx:-28,bhy:-98,fhx:32,fhy:-98,wf:0.5,lean:-0.12,glow:1}],[0.48,{}]]};
  A.summon={dur:0.55,keys:[[0,{}],[0.2,{fhx:10,fhy:-116,wf:0,bhx:-2,bhy:-112,wb:-0.2,head:-0.3,lean:-0.1,glow:1}],[0.32,{fhx:28,fhy:-70,wf:0.8,bhx:24,bhy:-74,lean:0.28,ffx:18}],[0.55,{}]]};
  A.slamGround={dur:0.5,keys:[[0,{}],[0.16,{py:-6,fhx:4,fhy:-108,wf:-0.3,bhx:0,bhy:-104,wb:-0.3,lean:-0.12}],[0.28,{py:14,fhx:26,fhy:-36,wf:2.6,bhx:20,bhy:-34,wb:2.6,lean:0.5,ffx:20}],[0.5,{}]]};
  A.roar={dur:0.55,keys:[[0,{py:(S.py||0)+6,lean:0.25,bhx:-2,bhy:-64,fhx:10,fhy:-64}],[0.14,{py:(S.py||0)+8,lean:0.3}],[0.28,{py:-2,lean:-0.18,head:-0.4,bhx:-26,bhy:-98,fhx:26,fhy:-102,cape:1}],[0.45,{py:-2,lean:-0.18,head:-0.4,bhx:-26,bhy:-98,fhx:26,fhy:-102,cape:1}],[0.55,{}]]};
  A.point={dur:0.4,upper:true,keys:[[0,{}],[0.1,H(38,-84,{lean:0.1,glow:1})],[0.3,H(36,-83,{glow:0.5})],[0.4,{}]]};
  A.grip={dur:0.45,upper:true,keys:[[0,{bhx:38,bhy:-86,lean:0.12}],[0.14,{bhx:40,bhy:-88,lean:0.14}],[0.26,{bhx:4,bhy:-80,lean:-0.18}],[0.45,{}]]};
  /* --- мобільність --- */
  A.lunge={dur:0.36,keys:[[0,{lean:0.6,px:6,py:10,bfx:-30,ffx:24,fhx:38,fhy:-64,wf:1.55,bhx:24,bhy:-62,wb:1.55,cape:1}],[0.18,{lean:0.5,px:4,py:8,bfx:-26,ffx:22,fhx:36,fhy:-62,cape:1}],[0.36,{}]]};
  A.dashFwd={dur:0.34,keys:[[0,{lean:0.5,py:6,bfx:-28,ffx:22,cape:1,fade:0.4}],[0.2,{lean:0.4,py:4,bfx:-24,ffx:20,cape:1,fade:1}],[0.34,{}]]};
  A.flip={dur:0.42,keys:[[0,{rot:0,py:-2}],[0.12,{rot:-1.6,py:-26,bfx:-4,bfy:-22,ffx:6,ffy:-26,lean:0.3}],[0.26,{rot:-4.7,py:-24,bfx:-4,bfy:-22,ffx:6,ffy:-26,lean:0.3}],[0.36,{rot:-6.283,py:8,bfx:-14,ffx:14}],[0.42,{rot:-6.283}]]};
  A.hop={dur:0.4,keys:[[0,{py:4}],[0.12,{py:-20,bfy:-14,ffy:-18,fhx:-2,fhy:-104,bhx:-24,bhy:-100,lean:-0.22,cape:1}],[0.26,{py:-8,fhx:20,fhy:-64,bhx:-18,bhy:-62,lean:-0.1}],[0.4,{}]]};
  A.blink={dur:0.32,keys:[[0,{fade:0,py:(S.py||0)+4}],[0.24,{fade:1}],[0.32,{fade:1}]]};
  A.vanish={dur:0.4,keys:[[0,{py:14,lean:0.4,fade:0.5}],[0.4,{py:12,lean:0.4}]]};
  A.spin={dur:0.7,fn:(t,b)=>{
    const o={...b,lean:0.1,py:(b.py||0)+6,bfx:-16,ffx:16};
    o.flip=Math.cos(t*Math.PI*2*3.2);
    o.fhx=34; o.fhy=-66; o.wf=1.6; o.bhx=26; o.bhy=-64; o.wb=1.7; o.cape=1;
    return o; }};
  A.slam={dur:0.5,keys:[[0,{py:(S.py||0)+4}],[0.15,{py:-18,bfy:-10,ffy:-14,fhx:4,fhy:-106,wf:-0.3,bhx:-4,bhy:-102,wb:-0.3,lean:-0.14}],[0.27,{py:14,fhx:30,fhy:-38,wf:2.6,bhx:22,bhy:-38,wb:2.6,lean:0.45,ffx:20,bfx:-18}],[0.5,{}]]};
  /* --- стани --- */
  A.tossed={dur:0.9,keys:[[0,{lean:-0.5,head:-0.5,rot:-0.35,py:-2,fhx:-2,fhy:-86,bhx:-22,bhy:-88,bfx:-2,bfy:-16,ffx:16,ffy:-8,cape:1}],[0.45,{lean:-0.35,head:-0.3,rot:-0.55,fhx:6,fhy:-92,bhx:-24,bhy:-78,bfx:-6,bfy:-12,ffx:12,ffy:-4,cape:1}],[0.9,{}]]};
  A.hurt={dur:0.26,keys:[[0,{lean:-0.32,head:-0.35,py:(S.py||0)+3,px:-4,fhx:6,fhy:-72,bhx:-16,bhy:-70}],[0.26,{}]]};
  A.land={dur:0.18,keys:[[0,{py:(S.py||0)+11,bfx:-15,ffx:15,lean:(S.lean||0)+0.15}],[0.18,{}]]};
  A.die={dur:0.95,hold:true,keys:[
    [0,{lean:-0.3,head:-0.3,px:-3}],
    [0.24,{py:18,lean:0.35,head:0.45,bfx:-12,ffx:10,bfy:0,fhx:16,fhy:-36,wf:1.9,bhx:0,bhy:-34,wb:1.9}],
    [0.34,{py:20,lean:0.1,head:0.1,bfx:-12,ffx:10,fhx:10,fhy:-40,wf:1.9,bhx:-2,bhy:-38}],
    [0.6,{rot:-1.62,ox:-26,oy:38,py:4,lean:0,head:0.2,bfx:-8,ffx:6,bfy:-4,ffy:-10,fhx:14,fhy:-72,wf:2.9,bhx:-10,bhy:-66,wb:2.9}],
    [0.7,{rot:-1.54,ox:-26,oy:35,py:4,lean:0,head:0.25,bfx:-8,ffx:6,bfy:-4,ffy:-10,fhx:14,fhy:-72,wf:2.95,bhx:-10,bhy:-66,wb:2.9}],
    [0.95,{rot:-1.57,ox:-26,oy:36,py:4,lean:0,head:0.3,bfx:-8,ffx:8,bfy:-4,ffy:-6,fhx:16,fhy:-70,wf:3.0,bhx:-12,bhy:-64,wb:2.9}]]};
  A.victory={dur:1.4,loop:true,fn:(t,b)=>{
    const s=Math.sin(t*Math.PI*2/1.4);
    const o={...b,lean:-0.06,head:-0.25,py:(b.py||0)-1+s,cape:0.4+s*0.3,glow:0.6};
    if(style==='staff'||style==='spear'||style==='2h'){ o.fhx=12; o.fhy=-116+s*2; o.wf=0.05; o.bhx=-10; o.bhy=-60; }
    else if(style==='shield'){ o.bhx=-4; o.bhy=-118+s*2; o.wb=0.1; o.fhx=18; o.fhy=-70; }
    else if(style==='bow'){ o.fhx=14; o.fhy=-114+s*2; o.wf=0.1; o.bhx=-6; o.bhy=-56; }
    else { o.fhx=14; o.fhy=-114+s*2; o.wf=0.1; o.bhx=-18; o.bhy=-96; o.wb=-0.3; }
    return o; }};
  return A[name]||null;
}
const ACT_CACHE={};
function getAction(style,name){
  const k=style+'/'+name;
  if(!(k in ACT_CACHE)) ACT_CACHE[k]=actionSpec(style,name);
  return ACT_CACHE[k];
}
function sampleAction(spec,t,base){
  const tt=spec.loop?t%spec.dur:Math.min(t,spec.dur);
  return spec.fn?spec.fn(tt,base):sampleKeys(spec.keys,tt,base);
}

/* ---------- Процедурні цикли руху ---------- */
function locoPose(style,m,base,t){
  const o={...base};
  const S=STANCE[style];
  switch(m.mode){
    case 'idle':{
      const s=Math.sin(t*2.4);
      o.py=(base.py||0)+s*1.1;
      o.fhy=base.fhy+Math.sin(t*2.4+0.6)*1.2; o.bhy=base.bhy+Math.sin(t*2.4+0.9)*1.2;
      o.wf=base.wf+Math.sin(t*1.2)*0.03;
      o.cape=0.1+s*0.06;
      break;
    }
    case 'run': case 'walk': case 'back':{
      const run=m.mode==='run', back=m.mode==='back';
      const A=run?22:(back?13:15), L=run?15:(back?7:8), ph=m.phase;
      const foot=(phi)=>{ const c=Math.cos(phi), s=Math.sin(phi); return [A*c, s<0?L*s:0]; };
      const [bx,by]=foot(ph+Math.PI), [fx,fy]=foot(ph);
      o.bfx=bx-2; o.bfy=by; o.ffx=fx+2; o.ffy=fy;
      o.py=(run?4:2)-(run?2.2:1.2)*Math.cos(2*ph)+(S.py||0)*0.5;
      o.lean=run?(style==='claw'?0.5:0.24):(back?-0.06:0.08)+(S.lean||0)*0.5;
      const sw=run?1:0.6;
      // руки махають протилежно ногам (для зброї — стриманіше)
      const armF=Math.cos(ph+Math.PI)*sw, armB=Math.cos(ph)*sw;
      if(style==='staff'){ o.fhx=16+armF*4; o.fhy=-62+Math.abs(armF)*2; o.wf=run?0.55:0.2; o.bhx=-4+armB*12; o.bhy=-54+Math.abs(armB)*4; }
      else if(style==='bow'){ o.fhx=12+armF*6; o.fhy=-58; o.wf=0.5; o.bhx=-4+armB*12; o.bhy=-54+Math.abs(armB)*4; }
      else if(style==='2h'||style==='spear'){ o.fhx=base.fhx+armF*4; o.fhy=base.fhy-2; o.wf=run?(style==='spear'?1.3:0.9):base.wf; }
      else { o.fhx=base.fhx+armF*10; o.fhy=base.fhy+Math.abs(armF)*3; o.bhx=base.bhx+armB*10; o.bhy=base.bhy+Math.abs(armB)*3; }
      o.cape=run?0.9:(back?0.05:0.4);
      break;
    }
    case 'air':{
      const k=clamp((m.vy+420)/760,0,1); // 0 — зліт, 1 — падіння
      const up={py:-4,bfx:-8,bfy:-16,ffx:12,ffy:-24,lean:0.14,cape:-0.2};
      const dn={py:0,bfx:-12,bfy:-4,ffx:12,ffy:-9,lean:0.02,cape:0.9};
      for(const ch in up) o[ch]=up[ch]+(dn[ch]-up[ch])*k;
      if(style==='staff'){ o.fhx=18; o.fhy=-70+k*6; o.wf=0.3; o.bhx=-16-k*4; o.bhy=-80+k*10; }
      else if(style==='bow'){ o.fhx=20; o.fhy=-68; o.wf=0.5; o.bhx=-14; o.bhy=-80+k*10; }
      else { o.fhx=base.fhx+4; o.fhy=base.fhy-8+k*6; o.bhx=base.bhx-8; o.bhy=base.bhy-10+k*8; }
      break;
    }
    case 'block':{
      Object.assign(o,{py:(S.py||0)+5,lean:-0.04,bfx:-15,ffx:12});
      if(style==='shield'){ o.fhx=24; o.fhy=-74; o.bhx=-10; o.bhy=-86; o.wb=-0.5; }
      else if(style==='staff'){ o.fhx=20; o.fhy=-76; o.wf=0.9; o.bhx=16; o.bhy=-86; }
      else if(style==='dual'||style==='claw'){ o.fhx=18; o.fhy=-82; o.wf=0.2; o.bhx=16; o.bhy=-76; o.wb=-0.35; }
      else if(style==='bow'){ o.fhx=22; o.fhy=-78; o.wf=0.1; o.bhx=14; o.bhy=-70; }
      else { o.fhx=18; o.fhy=-84; o.wf=1.25; }
      break;
    }
    case 'stun':{
      o.py=(base.py||0)+7; o.lean=0.05+Math.sin(t*6)*0.12; o.head=0.35+Math.sin(t*5)*0.2;
      o.fhx=base.fhx-4; o.fhy=-48; o.bhx=base.bhx-2; o.bhy=-46; o.wf=base.wf+0.6;
      break;
    }
  }
  if(m.sneak){ o.py=(o.py||0)+12; o.lean=(o.lean||0)+0.3; o.fhy+=8; o.bhy+=8; }
  return o;
}

/* ---------- Контролер анімації бійця ---------- */
class AnimCtl{
  constructor(style,stance){
    this.style=style;
    this.base={...POSE0,...STANCE[style],...(stance||{})};   // сет може мати власну стійку
    this.pose={...this.base};
    this.act=null; this.t=0; this.phase=0; this.dead=false;
  }
  play(name,opts){
    const spec=getAction(this.style,name);
    if(!spec) return;
    if(this.act&&this.act.spec.hold&&name!=='die') return;
    this.act={name,spec,t:0,...(opts||{})};
  }
  stop(){ this.act=null; }
  // m: {mode, speed, vy, channel, sneak}
  update(dt,m){
    this.t+=dt;
    if(m.mode==='run'||m.mode==='walk') this.phase+=dt*Math.PI*m.speed/(2*(m.mode==='run'?22:15));
    else if(m.mode==='back') this.phase-=dt*Math.PI*m.speed/26;
    m.phase=this.phase;
    let target=locoPose(this.style,m,this.base,this.t);
    let rate=18;
    if(m.channel){ target=sampleAction(getAction(this.style,'channel'),this.t,target); target.glow=0.4+m.channel*0.6; }
    const a=this.act;
    if(a){
      a.t+=dt;
      const spec=a.spec;
      if(!spec.loop && !spec.hold && a.t>=spec.dur){ this.act=null; }
      else{
        const actBase=spec.upper&&m.mode!=='idle'?target:{...this.base,...(m.sneak?{py:target.py,lean:target.lean}:{})};
        const ap=sampleAction(spec,a.t,actBase);
        if(spec.upper&&(m.mode==='run'||m.mode==='walk'||m.mode==='back'||m.mode==='air')){
          for(const ch of ['lean','head','fhx','fhy','bhx','bhy','wf','wb','bow','glow']) target[ch]=ap[ch];
        } else target=ap;
        rate=34;
      }
    }
    const k=1-Math.exp(-rate*dt);
    for(const ch of POSE_CH){
      if(DIRECT_CH.has(ch)) this.pose[ch]=target[ch];
      else this.pose[ch]+=(target[ch]-this.pose[ch])*k;
    }
    return this.pose;
  }
}

/* ---------- яка анімація грає для здібності ---------- */
function actionForAbility(f,a,i){
  const st=(f.model&&f.model.style)||SPEC_LOOK[f.cls.id+'/'+f.spec.name].style;
  switch(a.type){
    case 'melee':
      if(a.name==='Shield Slam') return 'bash';
      if(i===1) return 'heavy';
      f.swing=((f.swing|0)+1)%2;
      return f.swing?'atkA':'atkB';
    case 'proj': case 'multi':
      if(st==='bow') return 'shoot';
      if(a.name==="Avenger's Shield"||a.name==='Wildfire Bomb'||a.name==='Deadly Throw') return 'throw';
      if(MELEE_STYLES.has(st)) return 'point';
      return 'release';
    case 'drain': return MELEE_STYLES.has(st)?'point':'release';
    case 'heal': return 'heal';
    case 'shield': return 'ward';
    case 'buff': return a.disperse?'heal':(a.feather?'ward':'roar');
    case 'aoe':
      if(a.name==='Bladestorm') return 'spin';
      if(a.name==='Thunder Clap') return 'slam';
      return 'nova';
    case 'zone': return a.at==='self'?'slamGround':'summon';
    case 'knock': return a.front?'release':'nova';
    case 'leap': return 'slam';
    case 'dash': return a.back?(st==='owl'?'hop':'flip'):(a.toEnemy?'lunge':'dashFwd');
    case 'tele': return 'blink';
    case 'pull': return 'grip';
    case 'stealth': return 'vanish';
    case 'curse': return 'point';
    case 'pet': return 'summon';
  }
  return null;
}
