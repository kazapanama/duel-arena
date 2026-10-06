"use strict";
/* ============================================================
   ПЕТИ: піксельні моделі на тих самих скелетах, що й бійці.
   Вовки — чотирилапий риг кота (cat.js) з вовчою головою й хвостом;
   гуль, фелгард та інфернал — гуманоїдний риг (rig.js) з расами
   ghoul / demon / infernal (paint.js). Поведінка — Fighter.updatePet.
   ============================================================ */
const PET_DEFS={
  // spd — біг, reach — дистанція удару, hitAt — кадр удару після замаху, h — зріст (для іскор), scale — розмір спрайта, hp — здоровʼя
  wolf:      {col:'#e0b070',spd:330,reach:70, hitAt:0.14,h:70, claw:1,scale:0.95,hp:160},
  spiritwolf:{col:'#8fd0ff',spd:360,reach:70, hitAt:0.14,h:70, claw:1,scale:0.95,ghost:1,outline:[150,210,255],hp:160},
  ghoul:     {col:'#7cff6b',spd:260,reach:75, hitAt:0.16,h:95, claw:1,scale:0.85,hp:220},
  felguard:  {col:'#9dff70',spd:240,reach:95, hitAt:0.22,h:120,scale:1.0,hp:210},
  infernal:  {col:'#7cff6b',spd:150,reach:100,hitAt:0.26,h:140,scale:1.18,hp:300},
};

/* вовки: забарвлення для рига кота */
const WOLF_LOOK={
  wolf:{fur:'#6a5a4a',belly:'#b8a890',eye:'#ffd23a',pattern:'none',wolf:1},
  spiritwolf:{fur:'#4a7ab8',belly:'#cfe9ff',eye:'#ffffff',pattern:'none',wolf:1},
};
/* гуманоїди: стиль бою + опис «сету» поверх resolveModel */
const PET_LOOK={
  ghoul:{style:'claw',armor:'leather',L:{prim:'#4a4034',sec:'#2e2820',trim:'#5a5244',acc:'#7cff6b',skin:'#8a9a72',race:'ghoul',
    helm:{t:'none'},sh:null,cape:null,tabard:null,main:{t:'claws'},off:{t:'claws'},lower:'pants',bulk:0.92,fx:'poison',
    stance:{lean:0.5,py:15}}},
  felguard:{style:'2h',armor:'plate',L:{prim:'#3a2a30',sec:'#5a1e1e',trim:'#9a8a4a',acc:'#9dff70',skin:'#6a7a3a',race:'demon',
    helm:{t:'none'},sh:{t:'spiked',s:1.35},cape:null,tabard:null,main:{t:'axe2h',edge:1},lower:'tassets',bulk:1.22,mohawk:1,fx:'fel'}},
  infernal:{style:'golem',armor:'plate',L:{prim:'#3a3632',sec:'#26221e',trim:'#7cff6b',acc:'#7cff6b',skin:'#4a4440',race:'infernal',
    helm:{t:'none'},sh:{t:'bigspikes',s:1.2},cape:null,tabard:null,main:null,off:null,lower:'tassets',bulk:1.38,fx:'fel'}},
};

// растрові деталі петів (tools/setsheets/pet_jobs.py → img/cutout/pet_*.js, js/cutout.js); поки вантажаться — процедурна модель
const PET_CUTOUT={wolf:'pet_wolf',spiritwolf:'pet_spiritwolf',ghoul:'pet_ghoul',felguard:'pet_felguard',infernal:'pet_infernal'};
CLASS_LOOK.pet={armor:'cloth',helm:{t:'none'},sh:null,lower:'pants',hair:'#2a2420'};   // база для petModel
const PET_MODEL={};
function petModel(kind){
  if(PET_MODEL[kind]) return PET_MODEL[kind];
  let m;
  if(WOLF_LOOK[kind]){
    const L=WOLF_LOOK[kind], fur=L.fur, acc=PET_DEFS[kind].col;
    const pal={fur, furD:hexShade(fur,-0.32), furDD:hexShade(fur,-0.58), furL:lightOf(fur,0.3),
      belly:L.belly, bellyD:hexShade(L.belly,-0.25), eye:L.eye, acc, accD:hexShade(acc,-0.4), accL:lightOf(acc,0.55),
      bone:'#e4dcc4', boneD:'#a89c80', wood:'#7a5230', woodD:'#4a3018', shadow:'#0c0a10', white:'#f6f2e8', nose:'#1a1214',
      leaf:'#6ab04a', leafD:'#3a6a2a', stripe:hexShade(fur,-0.5)};
    pal.outline=hexMix(hexShade(fur,-0.8),'#0a0608',0.6);
    m={kind:'cat',style:'cat',pal,look:L,castCol:acc,castSide:'f',glowEye:true,
      fxKind:kind==='spiritwolf'?{cols:['#bfe6ff','#ffffff'],vy:-30,g:-20,rate:6}:null,name:kind,key:'pet/'+kind,cutout:PET_CUTOUT[kind]||null};
  } else {
    const D=PET_LOOK[kind];
    const cls={id:'pet',color:D.L.acc}, spec={name:kind}, skin={name:'#pet-'+kind,tier:1,body:D.L.prim,trim:D.L.trim,head:D.L.skin,eyes:D.L.acc,cutout:PET_CUTOUT[kind]};
    SET_LOOK[skin.name]=D.L;
    m=resolveModel(cls,spec,skin);
    m.style=D.style; m.armor=D.armor;
    if(D.style!=='shield'){ m.front=m.main; m.back=m.off; }
    m.glowEye=true;
  }
  return PET_MODEL[kind]=m;
}
function petAnim(kind){ return WOLF_LOOK[kind]?new CatAnimCtl():new AnimCtl(PET_LOOK[kind].style,PET_LOOK[kind].L.stance); }

// малюємо в низькороздільний шар світу (ctx — LOW), як бійця
function drawPet(p,time){
  const D=PET_DEFS[p.kind], m=petModel(p.kind);
  const sp=p._spr||(p._spr={});
  const life=Math.min(1,(p.T-p.t)/0.3,p.t/0.4);   // поява й зникнення — дизером
  sp.model=m; sp.pose=p.anim.pose; sp.facing=p.facing; sp.x=0; sp.y=0; sp.time=time;
  sp.flash=p.hitT>0?0.6:0; sp.alpha=1; sp.outline=p.rage>0?[255,80,50]:(D.outline||null);   // Bestial Wrath — червоний контур
  sp.fade=Math.min(p.anim.pose.fade??1,(D.ghost?0.62:1)*Math.max(0.05,life));
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,.32)';
  const sc=D.scale*(p.rage>0?1.3:1);   // у люті пет більший
  ctx.beginPath(); ctx.ellipse(p.x,GROUND+5,26*sc,6,0,0,7); ctx.fill();
  ctx.translate(p.x,p.y); ctx.scale(sc,sc);
  drawSprite(sp);
  ctx.restore();
  if(p.maxHp){ // смуга здоровʼя над петом — його можна вбити
    const w=40, x=Math.round(p.x-w/2), y=Math.round(GROUND-D.h*sc-16), f=clamp(p.hp/p.maxHp,0,1);
    ctx.save(); ctx.globalAlpha=0.85*Math.max(0.05,life);
    ctx.fillStyle='#0c0a10'; ctx.fillRect(x-1,y-1,w+2,6);
    ctx.fillStyle='#3a1010'; ctx.fillRect(x,y,w,4);
    ctx.fillStyle=f>0.35?'#5fd35f':'#e05545'; ctx.fillRect(x,y,Math.round(w*f),4);
    ctx.restore();
  }
}
