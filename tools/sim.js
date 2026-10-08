"use strict";
/* ============================================================
   СИМУЛЯТОР БАЛАНСУ: бот проти бота без рендеру.
   Підключається на index.html (через tools/balance.py або консоль):
     simTournament({rounds:2, skill:2}) → статистика по спеках
   ============================================================ */
function simMatch(A,B,opt={}){
  const skill=opt.skill??2;
  state.aiSkill=skill;
  const p1=new Fighter(A.cls,A.spec,0,A.spec.skins[0]);
  const p2=new Fighter(B.cls,B.spec,1,B.spec.skins[0]);
  p1.isAI=true; p2.isAI=true;
  const st=[p1,p2].map(()=>({uses:0,dmg:0,byAb:{},floats:0,time:0}));
  for(const [k,f] of [[0,p1],[1,p2]]){
    const use=f.useAbility.bind(f);
    f.useAbility=(i,g)=>{ const a=f.abilities[i]; const ok=use(i,g); if(ok){ st[k].uses++; } return ok; };
    const td=f.takeDamage.bind(f);
    f.takeDamage=(raw,src,g,o)=>{ const d=td(raw,src,g,o); const s=src===p1?0:(src===p2?1:(k===0?1:0)); st[s].dmg+=d; return d; };
  }
  const muted0=muted; muted=true;
  const g=new Game(p1,p2);
  g._ready=g.theme;   // без рендеру: картинки арени й деталей не чекаємо (Game.assetsReady)
  const origOverlay=window.showOverlay; window.showOverlay=()=>{};
  let t=0, roundT=0; const dt=1/60; const rounds=[];
  let floatsSeen=0;
  while(g.phase!=='matchEnd' && t<600){
    if(g.phase==='intro'||g.phase==='roundEnd'){ g.phaseT=Math.min(g.phaseT,dt); if(g.phase==='roundEnd'&&roundT>0){ rounds.push(roundT); roundT=0; } }
    const nf=g.floats.length;
    g.update(dt);
    floatsSeen+=Math.max(0,g.floats.length-nf);
    t+=dt; if(g.phase==='fight') roundT+=dt;
  }
  window.showOverlay=origOverlay; muted=muted0;
  const fightTime=rounds.reduce((a,b)=>a+b,0)||t;
  return {winner:g.winner===p1?0:(g.winner===p2?1:-1), rounds, fightTime,
    apm:[st[0].uses/fightTime*60, st[1].uses/fightTime*60], dmg:[st[0].dmg,st[1].dmg],
    floatsPerSec:floatsSeen/fightTime, timeouts:rounds.filter(r=>r>=89.5).length};
}

function allSpecs(){ const L=[]; for(const c of CLASSES) for(const s of c.specs) L.push({cls:c,spec:s,key:c.id+'/'+s.name}); return L; }

function simTournament(opt={}){
  const L=allSpecs(), n=opt.rounds||2;
  const S={}; for(const e of L) S[e.key]={w:0,l:0,d:0,apm:0,dps:0,games:0};
  let total=0, fsum=0, rsum=0, rcount=0, touts=0, apmSum=0;
  const only=opt.only&&opt.only.length?opt.only:null; // лише пари, де є хоч один із цих спеків
  for(let i=0;i<L.length;i++) for(let j=i+1;j<L.length;j++) for(let r=0;r<n;r++){
    if(only&&!only.some(k=>L[i].key.startsWith(k)||L[j].key.startsWith(k))) continue;
    const flip=r%2===1;
    const A=flip?L[j]:L[i], B=flip?L[i]:L[j];
    const res=simMatch(A,B,opt);
    const ka=A.key, kb=B.key;
    if(res.winner===0){ S[ka].w++; S[kb].l++; } else if(res.winner===1){ S[kb].w++; S[ka].l++; } else { S[ka].d++; S[kb].d++; }
    S[ka].apm+=res.apm[0]; S[kb].apm+=res.apm[1];
    S[ka].dps+=res.dmg[0]/res.fightTime; S[kb].dps+=res.dmg[1]/res.fightTime;
    S[ka].games++; S[kb].games++;
    total++; fsum+=res.floatsPerSec; touts+=res.timeouts;
    for(const x of res.rounds){ rsum+=x; rcount++; }
    apmSum+=res.apm[0]+res.apm[1];
  }
  const rows=Object.entries(S).filter(([k,v])=>v.games&&(!only||only.some(o=>k.startsWith(o)))).map(([k,v])=>({spec:k,win:+(v.w/(v.games)*100).toFixed(1),apm:+(v.apm/v.games).toFixed(1),dps:+(v.dps/v.games).toFixed(1)}))
    .sort((a,b)=>b.win-a.win);
  return {matches:total,avgRound:+(rsum/rcount).toFixed(1),timeoutRounds:touts,floatsPerSec:+(fsum/total).toFixed(2),avgApm:+(apmSum/total/2).toFixed(1),rows};
}
