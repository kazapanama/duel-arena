"use strict";
/* ============================================================
   РЕЖИМИ ГРИ З БОТАМИ: аркада, виживання, тренування — і статистика перемог.
   Звичайний бій (state.mode 'ai') і дуель удвох ('pvp') ходять тим самим шляхом: вибір → арена → VS → бій → фінал.
   Аркада й виживання — «забіг» (state.run): гравець обирає бійця один раз, а суперників, арени й складність
   добирає забіг; між боями показується фінальний екран із кнопкою «Далі».
   Бій налаштовує modeFightOpts (кличе startFight), підсумок і статистику — modeResult (кличе showOverlay).
   Правила на боці Game/Fighter: opts.toWin, opts.label, opts.train; Fighter.power, .skill, .tag, .dummy.
   ============================================================ */

/* ---------- аркада: драбина з семи суперників, останній — бос ---------- */
// sk — складність бота за замовчуванням (0–2, зсувається налаштуванням «Складність бота»), hp й power — множники здоров'я й шкоди
const ARC_STEPS=[{sk:0},{sk:0},{sk:1},{sk:1},{sk:2},{sk:2},{sk:2,hp:1.5,power:1.15,boss:true}];
const SURV_HEAL=300, SURV_MIN_HP=350;    // виживання: після перемоги +300 здоров'я (але не менше 350 на старті наступного бою)
const skillShift=base=>clamp(base+state.aiSkill-1,0,2);

function shuffled(a){ a=[...a]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
const randSkin=spec=>spec.skins[Math.floor(Math.random()*spec.skins.length)];
// суперники аркади — сім різних класів, не клас гравця; бос у найрідкіснішому (останньому) скіні
function buildLadder(player){
  return shuffled(CLASSES.filter(c=>c!==player.cls)).slice(0,ARC_STEPS.length).map((cls,i)=>{
    const spec=cls.specs[Math.floor(Math.random()*cls.specs.length)];
    return {cls,spec,skin:ARC_STEPS[i].boss?spec.skins[spec.skins.length-1]:randSkin(spec)};
  });
}
// виживання: довільний боєць, але не той самий спек, що в гравця, і не той, кого щойно перемогли
function randomFoe(player,last){
  let cls,spec;
  do{ cls=CLASSES[Math.floor(Math.random()*CLASSES.length)]; spec=cls.specs[Math.floor(Math.random()*cls.specs.length)]; }
  while(spec===player.spec||(last&&spec===last.spec));
  return {cls,spec,skin:randSkin(spec)};
}

function runStart(){
  const kind=state.mode, player=state.picks[0];
  state.run={kind,player,step:0,wins:0,cont:0,time:0,carry:null,foe:null,bout:null,after:'retry',lastTheme:-1,
    foes:kind==='arcade'?buildLadder(player):[]};
  runNext();
}
// наступний бій забігу: суперник, арена, правила — і екран VS
function runNext(){
  const R=state.run, n=ARC_STEPS.length;
  if(R.kind==='arcade'){
    const st=ARC_STEPS[R.step]; R.foe=R.foes[R.step];
    R.bout={label:st.boss?'Фінальний бос':`Бій ${R.step+1} з ${n}`,tag:st.boss?'БОС':'Бій '+(R.step+1)+'/'+n,
      sk:skillShift(st.boss?Math.max(1,st.sk):st.sk),hp:st.hp||1,power:st.power||1,boss:!!st.boss,toWin:2};
  } else {
    const w=R.wins+1; R.foe=randomFoe(R.player,R.foe);
    R.bout={label:`Хвиля ${w}`,tag:'Хвиля '+w,sk:skillShift(w<=2?0:(w<=5?1:2)),hp:Math.min(2.2,1+0.08*Math.max(0,w-3)),
      power:Math.min(1.5,1+0.05*Math.max(0,w-5)),boss:false,toWin:1};
  }
  state.picks=[R.player,R.foe];
  let i; do{ i=Math.floor(Math.random()*THEMES.length); }while(THEMES.length>1&&i===R.lastTheme);
  R.lastTheme=i; state.arena=THEMES[i];
  openVersus();
}
// «Продовжити» (аркада, поразка) — той самий бій ще раз; «Нова аркада» / «Нова серія» — з початку
function runRematch(){
  const R=state.run;
  if(R.after==='again'){ runStart(); return; }
  R.cont++; runNext();
}

// підпис над правим бійцем на екрані VS
function vsTagR(){
  const R=state.run;
  if(soloRun()&&R&&R.bout) return R.bout.tag;
  return state.mode==='train'?'Манекен':'Бот';
}

/* ---------- налаштування бою за режимом (кличе startFight) ---------- */
function modeFightOpts(p1,p2){
  switch(state.mode){
    case 'ai': p2.isAI=true; return {};
    case 'arcade': case 'survival': {
      const R=state.run, B=R.bout;
      p2.isAI=true; p2.skill=B.sk; p2.power=B.power;
      if(B.hp!==1){ p2.maxHp=Math.round(1000*B.hp); p2.hp=p2.maxHp; }
      if(B.boss) p2.tag='БОС';
      if(R.carry){ p1.hp=R.carry.hp; p1.meter=R.carry.meter; }   // виживання: здоров'я й ульта переходять у наступний бій
      return {toWin:B.toWin,label:B.label};
    }
    case 'train': { p2.isAI=true; trainReset(state.train); return {train:state.train}; }
  }
  return {};
}

/* ---------- підсумок матчу: статистика і (для забігу) що далі. null — звичайний фінальний екран ---------- */
function modeResult(winner){
  const g=state.game, loser=g&&g.other?g.other(winner):null;
  if(loser) statsRecord(winner,loser);
  const R=state.run;
  if(!soloRun()||!R||!g) return null;
  const res=runResult(R,g,winner);
  R.after=res.after||R.after;   // що робить кнопка «Продовжити»: той самий бій ще раз чи забіг з початку
  return res;
}
function runResult(R,g,winner){
  const me=g.f[0], won=winner===me;
  R.time+=g.time;
  if(R.kind==='arcade'){
    const last=R.step>=ARC_STEPS.length-1;
    if(!won) return {title:'Поразка',sub:`${R.bout.label}${R.cont?` · продовжень: ${R.cont}`:''}`,sting:'lose',rematch:'Продовжити',chars:true,after:'retry'};
    if(!last){
      R.step++;
      const nx=R.foes[R.step];
      return {title:'Перемога!',sub:`Далі: ${nx.cls.name}, ${nx.spec.name}${ARC_STEPS[R.step].boss?' — фінальний бос':''}`,sting:'win',next:'Далі'};
    }
    arcadeClear(R);
    return {title:'Аркаду пройдено!',sub:`Час ${fmtTime(R.time)} · продовжень: ${R.cont}`,sting:'win',rematch:'Нова аркада',chars:true,after:'again'};
  }
  // виживання
  if(won){
    R.wins++;
    const hp=clamp(me.hp+SURV_HEAL,SURV_MIN_HP,me.maxHp);
    R.carry={hp,meter:me.meter};
    return {title:'Хвилю пройдено!',sub:`Перемог поспіль: ${R.wins} · здоров'я ${Math.round(hp)}`,sting:'win',next:'Далі'};
  }
  const S=STATS.survival, record=R.wins>S.best;
  if(record){ S.best=R.wins; S.spec=specKey(R.player); saveStats(); }
  return {title:'Кінець серії',sub:`Перемог поспіль: ${R.wins}${record&&R.wins?' · новий рекорд!':''}`,sting:'lose',rematch:'Нова серія',chars:true,after:'again'};
}
function arcadeClear(R){
  const A=STATS.arcade, r=statRow(R.player);
  A.clears++; r.a=1;
  if(!A.bestTime||R.time<A.bestTime) A.bestTime=R.time;
  if(A.fewest==null||R.cont<A.fewest) A.fewest=R.cont;
  saveStats();
}
const fmtTime=t=>{ t=Math.round(t); return `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`; };

/* ---------- тренування ---------- */
const DUMMY_MODES=['stand','block','fight'], DUMMY_NAMES={stand:'стоїть',block:'блокує',fight:'б\'є у відповідь'};
const RES_MODES=['normal','cd','god'], RES_NAMES={normal:'звичайні',cd:'без відкатів',god:'без відкатів і шкоди'};
function trainReset(T){ T.rows={}; T.total=0; T.hits=0; T.maxHit=0; T.t0=-1; T.last=-1; T.combo=0; }
function trainBegin(){
  const P=store('aa_train',{});
  const T=state.train={dummy:DUMMY_MODES.includes(P.dummy)?P.dummy:'stand',res:RES_MODES.includes(P.res)?P.res:'cd'};
  trainReset(T);
}
function trainCycle(key,list,dir){
  const T=state.train; if(!T) return;
  T[key]=list[(list.indexOf(T[key])+dir+list.length)%list.length];
  save('aa_train',{dummy:T.dummy,res:T.res});
  renderTrainVals();
}
function renderTrainVals(){
  const T=state.train; if(!T) return;
  $('dummyVal').textContent=DUMMY_NAMES[T.dummy]; $('resVal').textContent=RES_NAMES[T.res];
}

/* ---------- статистика: перемоги й поразки за спеками, рекорди аркади й виживання ---------- */
const STATS=Object.assign({specs:{},arcade:{clears:0,bestTime:0,fewest:null},survival:{best:0,spec:''}},store('aa_stats',{}));
const saveStats=()=>save('aa_stats',STATS);
const specKey=p=>p.cls.id+'/'+p.spec.name;
const statRow=p=>STATS.specs[specKey(p)]||(STATS.specs[specKey(p)]={w:0,l:0,a:0});   // w — перемоги, l — поразки, a — аркаду пройдено
function statsRecord(winner,loser){
  const add=(f,won)=>{ statRow(f)[won?'w':'l']++; };
  switch(state.mode){
    case 'ai': case 'arcade': case 'survival': { const me=winner.idx===0?winner:loser; add(me,winner===me); break; }   // свій боєць — завжди перший
    case 'pvp': add(winner,true); add(loser,false); break;
    case 'net': { const me=winner.idx===NET.side?winner:loser; add(me,winner===me); break; }
    default: return;
  }
  saveStats();
}
function renderStats(){
  let w=0,l=0;
  const grid=$('statsGrid'); grid.innerHTML='';
  for(const c of CLASSES){
    const card=document.createElement('article'); card.className='pf stat-card'; card.style.setProperty('--cc',c.color);
    card.innerHTML=`<h3>${iconHtml(c.img,c.em)}<span>${c.name}</span></h3>`+c.specs.map(sp=>{
      const r=STATS.specs[c.id+'/'+sp.name]||{w:0,l:0,a:0}; w+=r.w; l+=r.l;
      return `<div class="stat-row${r.w+r.l?'':' none'}"><span class="sn">${sp.name}</span><span class="sw">${r.w}<i>:</i>${r.l}</span><span class="sa${r.a?' on':''}">★</span></div>`;
    }).join('');
    grid.appendChild(card);
  }
  const A=STATS.arcade, S=STATS.survival, sp=S.spec&&S.spec.split('/');
  const sc=sp&&CLASSES.find(c=>c.id===sp[0]);
  $('statsSum').innerHTML=`<span>Боїв: <b>${w+l}</b></span><span>Перемог: <b>${w}</b>${w+l?` (${Math.round(w/(w+l)*100)}%)`:''}</span>`
    +`<span>Аркада: <b>${A.clears?`пройдено ${A.clears}`:'ще ні'}</b>${A.clears?` · найшвидше ${fmtTime(A.bestTime)} · мінімум продовжень ${A.fewest}`:''}</span>`
    +`<span>Виживання: <b>${S.best?`${S.best} поспіль`:'—'}</b>${sc?` · ${sc.name}, ${sp[1]}`:''}</span>`;
}
