"use strict";
/* ============================================================
   ЗНІМОК СТАНУ БОЮ — спільний для сервера й браузера.
   Сервер (tools/netsim.js) рахує бій і щокадру шле netSnap обом гравцям
   (звуки — окремим повідомленням x, бо проміжні знімки телефон пропускає);
   браузер накладає останній знімок на свою «дзеркальну» гру (applySnap) і лише малює.
   Нове поле, яке читає малювання чи HUD, треба додати і в snap*, і в apply*,
   інакше гравці його не побачать.
   ============================================================ */
const r1=v=>Math.round(v*10)/10, r3=v=>Math.round(v*1000)/1000;
// числові поля бійця, що потрібні малюванню й HUD (порядок однаковий на обох кінцях)
const NF=['x','y','facing','hp','maxHp','shield','guard','gcd','formCd','hitT','shiftT','wingsT','wingsDur','stealthT','dispersT','rootT','rootDur','fearT','stunT','roundWins','knockT',
  'meter','combo','comboT','growT','dotLeft','hotLeft','pomT',
  // стани ультимейтів (малювання: купол, брила, жаба, копії, клинок, крила демона…)
  'growDur','ccImmT','stormT','invulnT','untargT','healRedT','silenceT','mcT','hexT','freezeT','freezeDur','bombT','hauntT',
  'dwT','metaT','immoT','berserkT','lustT','bwT','hasteT','guardT','drwT','drwSwing','mirrorT','tranqT','sleepT'];
const poseOf=pose=>{ const po={}; for(const k in pose){ const v=pose[k]; po[k]=typeof v==='number'?r3(v):v; } return po; };
function snapFighter(f){
  const po=poseOf(f.anim.pose);
  const c=f.casting, p=f.pet;
  return {n:NF.map(k=>r3(+f[k]||0)), fm:f.form, bl:f.blocking?1:0, ko:f.ko?1:0, rk:f.rootKind,
    cd:f.cds.map(r3), bf:[r3(f.buffs.dmg.t),r3(f.buffs.spd.t),r3(f.buffs.dr.t)],
    cs:c?[c.i,r3(c.t),r3(c.total),c.chan?1:0]:0, cc:f.model.castCol||'', po,
    pt:p?{k:p.kind,x:r1(p.x),f:p.facing,t:r3(p.t),T:p.T,h:r3(p.hitT),r:r3(p.rage||0),hp:Math.round(p.hp||0),mh:p.maxHp||0,po:poseOf(p.anim.pose)}:0};
}
function netSnap(g){
  return {t:'s', tm:r3(g.time), sh:r1(g.shake), cam:[r3(g.cam.scale),r1(g.cam.x),r1(g.cam.offX),r1(g.cam.offY)],
    ph:g.phase, pT:r3(g.phaseT), bn:g.banner, rd:g.round, rt:r3(g.roundTimer), th:THEMES.indexOf(g.theme), ko:r3(g.koFlash||0), pa:state.paused?1:0,
    f:g.f.map(snapFighter),
    P:g.particles.map(p=>[r1(p.x),r1(p.y),r3(p.t),r1(p.size),p.color]),
    fl:g.floats.map(f=>[r1(f.x),r1(f.y),f.txt,f.color,f.size,r3(f.t)]),
    pr:g.projectiles.map(p=>[r1(p.x),r1(p.y),r1(p.vx),p.color,p.size,p.kind,p.school||0]),
    sl:g.slashes.map(s=>[r1(s.x),r1(s.y),s.dir,r3(s.t),s.T,s.color,s.kind]),
    be:g.beams.map(b=>[r1(b.x1),r1(b.y1),r1(b.x2),r1(b.y2),r3(b.t),b.color]),
    ri:g.rings.map(r=>[r1(r.x),r1(r.y),r1(r.r),r3(r.t),r.color]),
    tr:g.trails.map(t=>[r1(t.x1),r1(t.x2),r1(t.y),r3(t.t),t.color]),
    te:(g.tells||[]).map(t=>[r1(t.x),r1(t.y),r3(t.t),r3(t.T)]),
    zo:g.zones.map(z=>[r1(z.x),z.r,z.color,z.kind||0]),
    mk:g.marks.map(m=>[r1(m.x),m.r,r3(m.t),m.T,m.color]),
    fa:g.fallers.map(f=>[f.kind,r1(f.x),r1(f.y),r1(f.x0),r1(f.y0),r1(f.x1)]),
    er:g.erupts.map(e=>[r1(e.x),r3(e.t),e.T]),
    po:g.portals.map(q=>[r1(q.x),r1(q.y),r3(q.t),q.T,q.color]),
    tp:g.traps.map(q=>[r1(q.x),r3(q.arm),q.r]),
    zp:g.zaps.map(z=>[r1(z.x1),r1(z.y1),r1(z.x2),r1(z.y2),r3(z.t),z.T,z.color,z.seed]),
    uf:g.ultFx?[r3(g.ultFx.t),g.ultFx.T,g.ultFx.side,g.ultFx.name,g.ultFx.color,g.ultFx.em]:0};
}
function applyFighter(f,d){
  if(f.form!==d.fm) f.setForm(d.fm);
  NF.forEach((k,i)=>{ f[k]=d.n[i]; });
  f.blocking=!!d.bl; f.ko=!!d.ko; f.rootKind=d.rk;
  for(let i=0;i<4;i++) f.cds[i]=d.cd[i];
  f.buffs.dmg.t=d.bf[0]; f.buffs.spd.t=d.bf[1]; f.buffs.dr.t=d.bf[2];
  f.casting=d.cs?{i:d.cs[0],t:d.cs[1],total:d.cs[2],chan:!!d.cs[3]}:null;
  if(d.pt){ // пет: модель і кеш спрайта переживають кадри, оновлюються лише числа
    const q=d.pt; let p=f.pet;
    if(!p||p.kind!==q.k) p=f.pet={kind:q.k,y:GROUND,anim:{pose:{}}};
    p.x=q.x; p.facing=q.f; p.t=q.t; p.T=q.T; p.hitT=q.h; p.rage=q.r||0; p.hp=q.hp; p.maxHp=q.mh; Object.assign(p.anim.pose,q.po);
  } else f.pet=null;
  f.model.castCol=d.cc||f.accent;
  Object.assign(f.anim.pose,d.po);
}
function applySnap(g,s){
  g.time=s.tm; g.shake=s.sh;
  g.cam.scale=s.cam[0]; g.cam.x=s.cam[1]; g.cam.offX=s.cam[2]; g.cam.offY=s.cam[3];
  g.phase=s.ph; g.phaseT=s.pT; g.banner=s.bn; g.round=s.rd; g.roundTimer=s.rt; g.koFlash=s.ko;
  if(THEMES[s.th]) g.theme=THEMES[s.th];
  s.f.forEach((d,i)=>applyFighter(g.f[i],d));
  g.particles=s.P.map(a=>({x:a[0],y:a[1],t:a[2],size:a[3],color:a[4]}));
  g.floats=s.fl.map(a=>({x:a[0],y:a[1],txt:a[2],color:a[3],size:a[4],t:a[5]}));
  g.projectiles=s.pr.map(a=>({x:a[0],y:a[1],vx:a[2],color:a[3],size:a[4],kind:a[5],school:a[6]||null}));
  g.slashes=s.sl.map(a=>({x:a[0],y:a[1],dir:a[2],t:a[3],T:a[4],color:a[5],kind:a[6]}));
  g.beams=s.be.map(a=>({x1:a[0],y1:a[1],x2:a[2],y2:a[3],t:a[4],color:a[5]}));
  g.rings=s.ri.map(a=>({x:a[0],y:a[1],r:a[2],t:a[3],color:a[4]}));
  g.trails=s.tr.map(a=>({x1:a[0],x2:a[1],y:a[2],t:a[3],color:a[4]}));
  g.tells=s.te.map(a=>({x:a[0],y:a[1],t:a[2],T:a[3]}));
  g.zones=s.zo.map(a=>({x:a[0],r:a[1],color:a[2],kind:a[3]||null}));
  g.marks=s.mk.map(a=>({x:a[0],r:a[1],t:a[2],T:a[3],color:a[4]}));
  g.fallers=s.fa.map(a=>({kind:a[0],x:a[1],y:a[2],x0:a[3],y0:a[4],x1:a[5]}));
  g.erupts=s.er.map(a=>({x:a[0],t:a[1],T:a[2]}));
  g.portals=s.po.map(a=>({x:a[0],y:a[1],t:a[2],T:a[3],color:a[4]}));
  g.traps=(s.tp||[]).map(a=>({x:a[0],arm:a[1],r:a[2],t:1}));
  g.zaps=(s.zp||[]).map(a=>({x1:a[0],y1:a[1],x2:a[2],y2:a[3],t:a[4],T:a[5],color:a[6],seed:a[7]}));
  g.ultFx=s.uf?{t:s.uf[0],T:s.uf[1],side:s.uf[2],name:s.uf[3],color:s.uf[4],em:s.uf[5]}:null;
}
