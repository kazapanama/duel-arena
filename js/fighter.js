"use strict";
/* ---------- Боєць ----------
   Бойова модель: кожна атака має замах (startup) — шкода приходить у кадрі удару,
   тож можна відскочити, заблокувати чи парирувати. Влучання дає хітстоп, стагер
   і відкидання; блок тримає шкалу захисту, яку ламають важкі удари. */
const GCD=0.65;          // глобальний КД: не частіше однієї дії на 0.65 с
const MOVE_SPEED=235;
const GUARD_MAX=100;
const PROJ_SPEED=0.62;   // снаряди повільніші — через них можна перестрибнути
const SPELL_RANGE=650;   // дальність проклять і притягування
const CHAN_GRACE=0.15;   // стільки секунд каналу рух ще не обриває
const ULT_MAX=100;      // супершкала: росте від завданої й отриманої шкоди, повна — ультимейт
const CANCEL_WIN=0.32;  // після влучного легкого удару стільки секунд важкий іде без глобального КД
// тривалість замаху: легкі удари 0.12 с, важкі 0.26 с, миттєві бафи/ривки — без замаху
function startupOf(a,i){
  if(a.cast) return 0;
  switch(a.type){
    case 'melee': return i===1?0.26:0.12;
    case 'proj': case 'multi': return i===1?0.2:0.13;
    case 'aoe': case 'zone': return 0.2;
    case 'knock': return 0.1;
    case 'curse': case 'pull': return 0.15;
    default: return 0;
  }
}
class Fighter{
  constructor(cls,spec,idx,skin){
    this.cls=cls; this.spec=spec; this.idx=idx;   // раса — частина скіну (race у SET_LOOK чи в SK)
    this.skin=skin||spec.skins[0]; // скін спеку (див. SPEC_SKINS у data.js)
    this.preview=false;            // true — малюємо лише модель без табличок (вибір скіну)
    // слоти: [X спам, Y сильна, B утиліта, A класова мобільність]
    this.abilities=[...spec.abilities, spec.classAb||cls.classAb]; // кнопка A: своя здібність спеку або класова
    this.maxHp=1000; this.hp=1000;
    this.w=56; this.h=110;
    this.reset(idx===0?WORLD_W/2-START_GAP:WORLD_W/2+START_GAP, idx===0?1:-1);
    this.cds=[0,0,0,0]; this.gcd=0;
    this.roundWins=0;
    this.color=this.skin.body;
    this.accent=this.skin.accent||SPEC_ACCENT[cls.id+'/'+spec.name]||'#ffffff';
    // форми друїда: base — гуманоїд, alt — кіт чи сова (свої здібності, КД, модель, аніматор)
    this.formDef=spec.form||null;
    const baseModel=resolveModel(cls,spec,this.skin);
    this.forms={base:{abilities:this.abilities,cds:this.cds,model:baseModel,h:110,
      mkAnim:()=>new AnimCtl(baseModel.style,baseModel.stance)}};
    if(this.formDef){
      const fm=resolveFormModel(cls,spec,this.skin,this.formDef.id);
      this.forms.alt={abilities:[...this.formDef.abilities,this.formDef.classAb],cds:[0,0,0,0],model:fm,h:this.formDef.h,
        mkAnim:()=>fm.kind==='cat'?new CatAnimCtl():new AnimCtl(fm.style,fm.stance)};
    }
    for(const F of Object.values(this.forms)){ F.anim=F.mkAnim(); F.pref=Fighter.rangeFor(F.abilities); }
    this.form='base'; this.formCd=0; this.shiftT=0;
    this.spr={model:baseModel,pose:null,facing:this.facing,x:0,y:0,time:0};
    this.setForm('base');
    this.fxT=0;
    this.isAI=false;
    this.aiT=0; this.aiMove=0; this.aiBlockT=0;
    this.meter=0;           // супершкала переходить з раунду в раунд
  }
  // дальник, якщо у наборі ≥2 снарядні/проклятні здібності
  static rangeFor(abs){
    const n=abs.filter(a=>['proj','multi','curse','zone','drain'].includes(a.type)).length;
    return n>=2?rnd(380,480):115;
  }
  setForm(id){
    const F=this.forms[id];
    this.form=id; this.abilities=F.abilities; this.cds=F.cds;
    this.model=F.model; this.anim=F.anim; this.h=F.h; this.preferRange=F.pref;
    this.spr.model=this.model;
  }
  get formPassive(){ return this.form==='alt'?this.formDef.passive:null; }
  // перетворення: окрема кнопка (I / Num5 / R1), знімає сповільнення
  shapeshift(game){
    if(!this.formDef||this.ko||this.stunT>0||this.casting||this.formCd>0) return false;
    if(game&&game.phase!=='fight') return false;
    const to=this.form==='base'?'alt':'base';
    this.setForm(to);
    this.formCd=1.5; this.gcd=Math.max(this.gcd,0.3); this.shiftT=0.35;
    this.slowT=0; this.rootT=0; this.blocking=false; // перетворення скидає сповільнення й кайдани
    this.anim.stop();
    if(game){
      const col=to==='base'?'#9dff9a':({cat:'#ffb03a',tree:'#7dff8a'}[this.formDef.id]||'#b8c8ff');
      game.burst(this.x,this.y-this.h/2,col,22);
      game.burst(this.x,this.y-this.h/2,'#e8f5d0',10);
      game.float(this.x,this.y-this.h-24,to==='base'?'🧝 Гуманоїд':`${this.formDef.em} ${this.formDef.name}`,'#c9f5c0',14);
      sfx('cast');
    }
    return true;
  }
  reset(x,facing){
    this.x=x; this.y=GROUND; this.vx=0; this.vy=0; this.facing=facing;
    this.hp=this.maxHp; this.shield=0; this.shieldT=0;
    this.stunT=0; this.slowT=0; this.slowMult=1; this.fearT=0; this.fearDmg=0; this.fearBrk=0; this.fearSrc=null; this.rootT=0; this.rootDur=0; this.rootKind='ice';
    this.dots=[]; this.hots=[]; this.dotLeft=0; this.hotLeft=0;
    this.buffs={dmg:{mult:1,t:0},spd:{mult:1,t:0},dr:{mult:1,t:0}};
    this.blocking=false; this.stealthT=0; this.stealthBonus=false;
    this.cds=[0,0,0,0]; this.gcd=0;
    this.animT=0; this.attackT=0; this.castT=0; this.hitT=0; this.runPhase=0;
    this.ko=false; this.pet=null; this.casting=null;
    this.wasAir=false; this.swing=0;
    this.windup=null; this.staggerT=0; this.kbV=0;
    this.guard=GUARD_MAX; this.guardDelay=0; this.parryT=0; this.parryCd=0; this.prevBlock=false;
    this.aiPending=null;
    this.tossed=false; this.tossT=0; this.knockT=0; this.wallHit=false; this.leap=null; this.inputDir=0;
    this.wingsT=0; this.wingsDur=0; this.dispersT=0; this.featherT=0;
    this.combo=0; this.comboT=0; this.cancelT=0; this.lastBlocked=false;
    this.growT=0; this.ascT=0;   // Avatar (боєць більшає) і Ascendance (сяйво блискавок)
    if(this.forms){ // новий раунд — знову гуманоїд, свіжі аніматори й КД
      for(const F of Object.values(this.forms)){ F.anim=F.mkAnim(); F.cds.fill(0); }
      this.formCd=0; this.shiftT=0;
      this.setForm('base');
    }
  }
  get alive(){ return !this.ko; }
  get onGround(){ return this.y>=GROUND-0.5; }
  dmgMult(){ return this.buffs.dmg.t>0?this.buffs.dmg.mult:1; }
  spdMult(){ const fp=this.formPassive; return (this.buffs.spd.t>0?this.buffs.spd.mult:1)*(this.slowT>0?this.slowMult:1)*(fp&&fp.spd||1); }
  drMult(){ const fp=this.formPassive; return (this.buffs.dr.t>0?this.buffs.dr.mult:1)*(fp&&fp.dr||1)*(this.stealthT>0?0.7:1); } // у тіні по тобі важче влучити

  addBuff(k,mult,dur){ this.buffs[k]={mult,t:dur}; }

  addMeter(n,game){
    if(n<=0||this.ko) return;
    const was=this.meter;
    this.meter=Math.min(ULT_MAX,this.meter+n);
    if(was<ULT_MAX&&this.meter>=ULT_MAX&&game&&!this.preview){
      game.float(this.x,this.y-this.h-40,'УЛЬТА ГОТОВА','#ffe27a',16); sfx('ok');
    }
  }
  takeDamage(raw,src,game,opts={}){
    if(this.ko) return 0;
    const tick=!!opts.dotTick;                       // тік DoT / зони — без реакції
    const heavy=!tick&&(opts.heavy||raw>=100);
    let dmg=raw*this.drMult();
    let blocked=false;
    this.lastBlocked=false;
    // комбо: удар, що влучив, поки ціль ще не оговталась від попереднього (стагер, оглушення, політ)
    const foeF=src instanceof Fighter&&src!==this&&!tick?src:null;
    const chain=!!foeF&&foeF.comboT>0&&(this.staggerT>0||this.stunT>0||this.tossed||this.knockT>0);
    if(chain&&foeF.combo>=2) dmg*=Math.max(0.6,1-0.1*(foeF.combo-1));   // довгі комбо слабшають
    const front=src&&!opts.unblockable&&!tick&&Math.sign(src.x-this.x)===this.facing;
    const unparry=src instanceof Fighter&&src.wingsT>0;   // Avenging Wrath: удари не парируються
    if(front&&this.parryT>0){
      if(unparry){ this.parryT=0; game.float(this.x,this.y-this.h-34,'Не парирується!','#ffe27a',16); }
      else { this.parry(src,game); return 0; }
    }
    if(front&&this.blocking){
      dmg*=heavy?0.55:0.25; blocked=true; this.lastBlocked=true;   // важкий удар пробиває блок частково
      this.guard-=Math.min(70,raw*(heavy?0.6:0.3)); this.guardDelay=1.2;   // не більше 70 за удар: злам — щонайменше з двох
      this.kbV=-this.facing*(heavy?280:110);
      if(this.guard<=0) this.guardBreak(game);
    }
    if(this.shield>0){
      const abs=Math.min(this.shield,dmg);
      this.shield-=abs; dmg-=abs;
      if(abs>0) game.float(this.x,this.y-this.h-26,`🛡${Math.round(abs)}`,'#9fd7ff',15);
    }
    dmg=Math.round(dmg);
    if(dmg>0&&this.fearT>0){ this.fearDmg+=dmg;
      if(this.fearDmg>=this.fearBrk){ this.fearT=0; game.float(this.x,this.y-this.h-34,'Страх минув','#c9a8ff',14); } }
    if(dmg>0){
      this.hp=Math.max(0,this.hp-dmg);
      this.hitT=0.18;
      this.addMeter(dmg*(blocked?0.04:0.06),game);
      if(foeF){
        foeF.addMeter(dmg*0.08,game);
        if(blocked) foeF.combo=0;
        else { foeF.combo=chain?foeF.combo+1:1; foeF.comboT=1.1; }
      }
      if(tick){ game.float(this.x+rnd(-20,20),this.y-this.h*0.6,`${dmg}`,'#c9a0ff',13); }
      else{
        game.dmgFloat(this,dmg,blocked?'#8fa4c0':(heavy?'#ff5a3a':'#ffdca0'),heavy&&!blocked);
        const dirOut=src?(Math.sign(this.x-src.x)||-this.facing):-this.facing;
        if(!blocked){
          // стагер: удар збиває замах, штовхає каст назад, важкий — перериває каст
          this.staggerT=Math.max(this.staggerT,heavy?0.38:0.2);
          this.windup=null;
          if(this.casting){
            if(heavy){ this.casting=null; game.float(this.x,this.y-this.h-34,'Перервано!','#ff8a7a',14); }
            else if(this.casting.chan) this.chanPushback(0.3);
            else this.casting.t=Math.min(this.casting.total,this.casting.t+0.35);
          }
          this.kbV=dirOut*(heavy?320:130);
          if(heavy&&this.onGround) this.vy=Math.min(this.vy,-170);
          if(this.anim&&!this.casting) this.anim.play('hurt');
          if(heavy){ game.shake=Math.max(game.shake,9); game.cam.punch=Math.max(game.cam.punch,0.05); }
        }
        game.hitstop=Math.max(game.hitstop,blocked?0.035:(heavy?0.1:0.05));
        game.spark(this.x-dirOut*18,this.y-this.h*0.58,-dirOut,blocked?'#9fd7ff':'#ffcf6a',heavy&&!blocked);
      }
      if(!opts.silent) sfx(heavy&&!blocked?'big':'hit');
    }
    if(!blocked && opts.stun) this.stunT=Math.max(this.stunT,opts.stun);
    if(opts.slow){ this.slowT=Math.max(this.slowT,opts.slow.dur); this.slowMult=opts.slow.mult; }
    if(opts.fear&&!this.ko){
      this.fearT=opts.fear.dur; this.fearDmg=0; this.fearBrk=opts.fear.brk||90; this.fearSrc=src;
      this.casting=null; this.windup=null; this.blocking=false;
      game.float(this.x,this.y-this.h-34,'Страх!','#c9a8ff',17);
    }
    if(opts.root&&!this.ko){
      if(this.rootT<=0) game.float(this.x,this.y-this.h-34,opts.root.kind==='ice'?'Заморожено!':'Скуто!',opts.root.kind==='ice'?'#aee8ff':'#9dff70',16);
      this.rootT=Math.max(this.rootT,opts.root.dur); this.rootDur=this.rootT; this.rootKind=opts.root.kind; this.kbV=0; this.leap=null;
    }
    if(opts.dot){
      const old=opts.dotName&&this.dots.find(d=>d.name===opts.dotName);
      if(old){ old.t=opts.dot.dur; old.dps=opts.dot.dps; }  // повторне накладання оновлює, а не множить
      else this.dots.push({dps:opts.dot.dps,t:opts.dot.dur,acc:0,tick:0,name:opts.dotName});
    }
    if(opts.toss) this.tossUp(opts.toss.dir,opts.toss.v,opts.toss.vy,opts.toss.wall,src);
    if(opts.knockback && !blocked){
      this.kbV=Math.sign(this.x-(src?src.x:this.x-1))*opts.knockback*4;
      this.vy=Math.min(this.vy,-200);
    }
    if(this.hp<=0 && !this.ko){ this.ko=true; this.casting=null; this.windup=null; this.anim.play('die'); sfx('ko'); game.onKO(this); }
    return dmg;
  }

  // вчасне натискання блоку перед ударом: шкода 0, нападник приголомшений
  parry(src,game){
    this.parryT=0; this.parryCd=0.25;
    this.addMeter(12,game); this.lastBlocked=true;
    if(src instanceof Fighter) src.combo=0;
    this.guard=Math.min(GUARD_MAX,this.guard+30);
    game.hitstop=Math.max(game.hitstop,0.15);
    game.float(this.x,this.y-this.h-34,'ПАРИРУВАННЯ!','#ffe27a',18);
    game.spark(this.x+this.facing*28,this.y-this.h*0.6,this.facing,'#fff2b0',true);
    sfx('big');
    if(src instanceof Fighter && Math.abs(src.x-this.x)<220){
      src.staggerT=Math.max(src.staggerT,0.8); src.windup=null;
      src.kbV=Math.sign(src.x-this.x)*300; src.anim.play('hurt');
    }
  }
  guardBreak(game){
    this.guard=GUARD_MAX; this.blocking=false;
    this.stunT=Math.max(this.stunT,1.1);
    game.float(this.x,this.y-this.h-34,'ЗАХИСТ ЗЛАМАНО!','#ff6a5a',17);
    game.hitstop=Math.max(game.hitstop,0.12);
    game.shake=Math.max(game.shake,8);
  }
  // підкинути й відкинути дугою: у польоті й на землі ~0.6 с після нього не може діяти
  tossUp(dir,v,vy,wall,src){
    this.tossed=true; this.tossT=0; this.wallHit=false; this.tossWall=wall||null; this.tossSrc=src||null;
    this.kbV=dir*v; this.vy=vy; this.y=Math.min(this.y,GROUND-2);
    this.casting=null; this.windup=null; this.blocking=false; this.leap=null;
    this.anim.play('tossed');
  }
  onBlockPress(){ if(this.parryCd<=0){ this.parryT=0.2; this.parryCd=0.9; } }

  healSelf(n,game,quiet){
    if(this.ko||n<=0) return;
    const before=this.hp;
    this.hp=Math.min(this.maxHp,this.hp+n);
    const got=Math.round(this.hp-before);
    if(got>0){ game.float(this.x,this.y-this.h-24,`+${got}`,'#7dff8a'); if(!quiet) sfx('heal'); }
  }

  useAbility(i,game){
    // скасування: важкий удар одразу після влучного легкого — без глобального КД і з коротким замахом
    const cancel=i===1&&this.cancelT>0&&this.gcd>0;
    if(this.ko||this.stunT>0||this.staggerT>0||(this.gcd>0&&!cancel)||this.cds[i]>0||this.casting||this.windup||game.phase!=='fight') return false;
    if(this.dispersT>0||this.fearT>0) return false; // у Dispersion жрець лише рухається; у страху — ніхто не б'є
    const a=this.abilities[i];
    if(this.rootT>0&&(a.type==='dash'||a.type==='leap')){
      game.float(this.x,this.y-this.h-30,this.rootKind==='ice'?'Заморожено':'Скуто','#9aa4b5',13); this.gcd=0.2; return false;
    }
    if((a.type==='curse'||a.type==='pull'||a.type==='drain')&&Math.abs(game.other(this).x-this.x)>(a.range||SPELL_RANGE)){
      game.float(this.x,this.y-this.h-30,'Задалеко','#9aa4b5',13); this.gcd=0.2; return false;
    }
    this.gcd=a.gcd??GCD;
    if(a.cast){ // кастований спел: КД піде після завершення касту
      this.casting={i,t:a.cast,total:a.cast};
      this.anim.stop();
      sfx('cast');
      return true;
    }
    this.cds[i]=a.cd;
    if(a.chan){ // канал: КД одразу, ефект тиками, поки стоїш
      const n=a.chan.ticks||a.count||1;
      this.casting={i,t:a.chan.dur,total:a.chan.dur,chan:true,n:0,ticks:n,every:a.chan.dur/n,beamT:0};
      this.anim.stop(); this.model.castCol=a.pcolor||this.accent; sfx('cast');
      return true;
    }
    let su=startupOf(a,i);
    if(cancel){ su=Math.min(su,0.12); this.cancelT=0; game.float(this.x,this.y-this.h-30,'СКАСУВАННЯ','#ffd23a',13); }
    this.playAbilityAnim(a,i);
    if(su>0){ this.windup={i,t:su,total:su}; this.attackT=su+0.08;
      if(this.wingsT>0&&game.tell) game.tell(this.x+this.facing*30,this.y-this.h*0.78,su); }
    else this.resolveAbility(i,game);
    return true;
  }

  playAbilityAnim(a,i){
    this.castT=0.22;
    const an=actionForAbility(this,a,i);
    if(an) this.anim.play(an);
    this.model.castCol=a.pcolor||this.accent;
  }
  // після касту: анімація + ефект одразу
  execAbility(i,game){ this.playAbilityAnim(this.abilities[i],i); return this.resolveAbility(i,game); }

  // тік каналу: промінь Penance або висмоктування Drain Life
  chanTick(a,game){
    const foe=game.other(this), dmgM=this.dmgMult();
    if(a.type==='multi'){ game.spawnProj(this,a,this.x+this.facing*34,this.y-this.h*0.62,this.facing,dmgM); sfx('cast'); return; }
    if(a.type==='drain'&&Math.abs(foe.x-this.x)<=SPELL_RANGE&&foe.alive){
      const dealt=foe.takeDamage(a.dmg*dmgM,this,game,{dotTick:true,silent:true});
      if(a.healFrac) this.healSelf(dealt*a.healFrac,game,true);
      game.burst(foe.x,foe.y-foe.h*0.55,a.pcolor||'#7cff4a',5);
    }
  }
  // легкий удар під час каналу: частина каналу пропадає разом із тіками, що мали на неї припасти
  chanPushback(s){
    const c=this.casting; c.t=Math.max(0,c.t-s);
    const el=c.total-c.t; c.n=Math.max(c.n,Math.min(c.ticks,Math.floor(el/c.every-0.3)+1));
  }
  // ефект здібності (кадр удару)
  resolveAbility(i,game){
    const a=this.abilities[i];
    const foe=game.other(this);
    if(a.type!=='melee') sfx('cast');
    const dir=this.facing;
    const px=this.x+dir*34, py=this.y-this.h*0.62;
    const dmgM=this.dmgMult();
    if(a.type!=='stealth' && this.stealthT>0 && a.type!=='melee') this.stealthT=0;

    switch(a.type){
      case 'melee':{
        this.attackT=0.22;
        let mult=dmgM;
        if(this.stealthT>0||this.stealthBonus){ mult*=2; this.stealthT=0; this.stealthBonus=false; }
        const st=this.model.style, an=this.anim.act?this.anim.act.name:'atkA';
        const kind=st==='cat'?(an==='heavy'?'heavy':'claw'):((st==='dual'||st==='spear')&&an!=='heavy'?'thrust':an);
        game.slash(this.x+dir*40,this.y-this.h*0.55,dir,this.wingsT>0?'#fff2b0':this.model.pal.acc,kind);
        const dx=foe.x-this.x, dy=(foe.y-foe.h/2)-(this.y-this.h/2);
        if(Math.abs(dx)<(a.range||95)+foe.w/2 && Math.abs(dy)<90 && Math.sign(dx||dir)===dir){
          const dealt=foe.takeDamage(a.dmg*mult,this,game,{stun:a.stun,slow:a.slow,dot:a.dot,dotName:a.name,knockback:a.knockback,heavy:i===1});
          if(i===0&&dealt>0&&!foe.lastBlocked) this.cancelT=CANCEL_WIN;
          if(a.selfHeal) this.healSelf(a.selfHeal,game,true);
          if(a.healFrac) this.healSelf(dealt*a.healFrac,game,true);
        }
        break;
      }
      case 'proj':
        game.spawnProj(this,a,px,py,dir,dmgM);
        break;
      case 'multi':
        for(let n=0;n<a.count;n++)
          game.after(n*0.09,()=>{ if(!this.ko) game.spawnProj(this,a,this.x+this.facing*34,this.y-this.h*0.62,this.facing,this.dmgMult()); });
        break;
      case 'heal':
        this.healSelf(a.amount,game);
        if(a.hot) this.hots.push({tick:a.hot.tick,t:a.hot.dur,acc:0});
        game.burst(this.x,this.y-this.h/2,'#7dff8a',14);
        break;
      case 'shield':
        this.shield=Math.max(this.shield,a.amount); this.shieldT=a.dur;
        game.burst(this.x,this.y-this.h/2,'#9fd7ff',14);
        break;
      case 'buff':
        if(a.dmgMult) this.addBuff('dmg',a.dmgMult,a.dur);
        if(a.spdMult) this.addBuff('spd',a.spdMult,a.dur);
        if(a.dmgTakenMult) this.addBuff('dr',a.dmgTakenMult,a.dur);
        if(a.selfHeal) this.healSelf(a.selfHeal,game,true);
        if(a.wings){ this.wingsT=a.dur; this.wingsDur=a.dur; game.burst(this.x,this.y-this.h*0.7,'#fff2b0',24); }
        if(a.disperse){ this.dispersT=a.dur; this.blocking=false; game.float(this.x,this.y-this.h-30,'Dispersion','#c9a8ff',15); }
        if(a.feather){ this.featherT=a.dur; }
        game.burst(this.x,this.y-this.h/2,a.disperse?'#a878ff':(a.feather?'#ffffff':(a.dmgTakenMult?'#9fd7ff':'#ffb03a')),16);
        break;
      case 'aoe':{
        game.ring(this.x,this.y-this.h/2,a.radius,this.color);
        const d=Math.hypot(foe.x-this.x,(foe.y-foe.h/2)-(this.y-this.h/2));
        if(d<a.radius+foe.w/2){
          foe.takeDamage(a.dmg*dmgM,this,game,{stun:a.stun,slow:a.slow,root:a.root,dot:a.dot,dotName:a.name,heavy:true,fear:a.fear});
        }
        if(a.selfHeal) this.healSelf(a.selfHeal,game,true);
        break;
      }
      case 'zone':{
        const zx=a.at==='self'?this.x+dir*60:foe.x;
        game.zones.push({x:zx,r:a.radius,dps:a.dps*dmgM,t:a.dur,owner:this,color:a.zcolor||this.color,slow:a.slow,acc:0});
        break;
      }
      case 'dash':{
        if(a.toEnemy){
          const stop=foe.x-Math.sign(foe.x-this.x)*80;
          game.trail(this.x,stop,this.y-this.h/2,this.color);
          this.x=clamp(stop,80,WORLD_W-80);
          if(Math.abs(foe.x-this.x)<130 && (a.dmg||a.slow)){
            if(a.slow) game.beam(this.x,this.y-this.h*0.6,foe.x,foe.y-foe.h*0.6,'#c8b890');
            foe.takeDamage((a.dmg||0)*dmgM,this,game,{stun:a.stun,slow:a.slow});
          }
        } else {
          const dd=a.move?(this.inputDir||dir):(a.back?-dir:dir); // Disengage — від ворога; Grappling Hook — куди біжиш
          const nx=clamp(this.x+dd*(a.dist||240),80,WORLD_W-80);
          game.trail(this.x,nx,this.y-this.h/2,this.color);
          this.x=nx;
        }
        break;
      }
      case 'tele':{
        let nx;
        if(a.mode==='behind') nx=foe.x-Math.sign(this.x-foe.x)*90;
        else if(a.mode==='away') nx=this.x-dir*(a.dist||260);
        else if(a.mode==='move') nx=this.x+(this.inputDir||-dir)*(a.dist||260); // Blink: куди біжиш, стоячи — назад
        else nx=this.x+dir*(a.dist||260);
        const tcol=a.mode==='behind'?'#6a5a8a':(a.name==='Demonic Circle'?'#7cff6b':'#c9a8ff');
        if(a.mode==='behind') game.smoke(this.x,this.y-this.h/2); else game.portal(this.x,this.y,tcol);
        this.x=clamp(nx,80,WORLD_W-80);
        if(a.mode==='behind') game.smoke(this.x,this.y-this.h/2); else game.portal(this.x,this.y,tcol);
        if(a.mode==='behind') this.stealthBonus=true; // засідка: наступний удар ×2
        this.rootT=0; // телепорт звільняє з криги й лоз
        break;
      }
      case 'pull':{
        game.beam(this.x,this.y-this.h*0.6,foe.x,foe.y-foe.h*0.6,'#b06aff');
        foe.x=clamp(this.x+dir*95,80,WORLD_W-80);
        foe.takeDamage((a.dmg||0)*dmgM,this,game,{stun:a.stun});
        break;
      }
      case 'knock':{
        if(a.front){ // Typhoon: вихор уперед, відкидає ворога від себе
          const ox=this.x+dir*40, oy=this.y-this.h*0.55;
          const fire=a.pcolor==='#ff9440', c1=fire?'#ffd23a':'#cfe9ff', c2=fire?'#ff5a1a':'#c9a8ff';
          for(let k=0;k<26;k++){ const sp=rnd(420,820)*(fire?0.45:1), yy=rnd(-55,45);
            game.particles.push({x:ox+rnd(-10,20)*dir,y:oy+yy*(fire?0.6:1),vx:dir*sp,vy:-yy*0.8+rnd(-40,40),t:rnd(0.3,0.5),color:k%3===0?'#ffffff':(k%3===1?c1:c2),size:rnd(3,6),g:fire?-60:0}); }
          game.slash(this.x+dir*70,oy,dir,c1,'heavy'); game.slash(this.x+dir*130,oy+10,dir,c2,'atkA');
          game.shake=Math.max(game.shake,5);
          const dx=(foe.x-this.x)*dir;
          if(dx>-20&&dx<a.range+foe.w/2&&Math.abs(foe.y-this.y)<150)
            foe.takeDamage(a.dmg*dmgM,this,game,{unblockable:true,slow:a.slow,knockback:a.push,stun:a.stun}); // поштовх без падіння
          break;
        }
        // громовий вибух: блискавки довкола і хвиля
        game.ring(this.x,this.y-this.h/2,a.radius,'#8fd0ff'); game.ring(this.x,this.y-this.h/2,a.radius*0.6,'#ffffff');
        for(let k=0;k<5;k++){ const ang=k/5*Math.PI*2+rnd(0,1); game.beam(this.x,this.y-this.h-30,this.x+Math.cos(ang)*a.radius*0.8,this.y-this.h/2+Math.sin(ang)*40,'#bfe6ff'); }
        game.shake=Math.max(game.shake,7);
        const d=Math.abs(foe.x-this.x);
        if(d<a.radius+foe.w/2 && Math.abs(foe.y-this.y)<140){
          const out=Math.sign(foe.x-this.x)||dir;
          foe.takeDamage(a.dmg*dmgM,this,game,{unblockable:true,toss:{dir:out,v:a.toss.v,vy:a.toss.vy,wall:a.wall}});
        }
        break;
      }
      case 'leap':{
        // дуга до ворога: приземлення поруч і удар довкола
        const air=2*720/1500, tx=clamp(foe.x-Math.sign(foe.x-this.x||dir)*70,80,WORLD_W-80);
        this.vy=-720; this.y=Math.min(this.y,GROUND-2);
        this.leap={vx:(tx-this.x)/air,a};
        game.dust(this.x,GROUND);
        break;
      }
      case 'stealth':
        this.stealthT=a.dur;
        if(a.dmgMult) this.addBuff('dmg',a.dmgMult,a.dur);
        game.burst(this.x,this.y-this.h/2,'#8a90b0',12);
        break;
      case 'curse':{
        if(Math.abs(foe.x-this.x)>(a.range||SPELL_RANGE)){ game.float(this.x,this.y-this.h-30,'Задалеко','#9aa4b5',13); break; } // утік, поки кастували
        game.beam(this.x,this.y-this.h*0.6,foe.x,foe.y-foe.h*0.6,a.stun?'#ffe27a':(a.slow&&!a.dot?'#aee8ff':'#a878ff'));
        foe.takeDamage((a.dmg||0)*dmgM,this,game,{dot:a.dot,dotName:a.name,slow:a.slow,root:a.root,fear:a.fear,stun:a.stun,unblockable:!!a.fear,silent:!a.dmg});
        if(!a.dmg && a.dot) game.float(foe.x,foe.y-foe.h-10,a.icon,'#c9a8ff',20);
        break;
      }
      case 'pet':
        this.summonPet(a.pkind||'wolf',this.x-dir*50,a.dur,a.pdmg||24,a.pcd||1.1,game);
        break;
    }
    return true;
  }

  // пет — окрема піксельна модель на землі (pets.js): біжить до ворога й кусає/б'є; удар зі спини не заблокуєш
  summonPet(kind,x,dur,dmg,cd,game){
    this.pet={kind,x:clamp(x,60,WORLD_W-60),y:GROUND,vx:0,facing:this.facing,t:dur,T:dur,dmg,cd,atkT:0.6,anim:petAnim(kind),hitT:0};
    game.portal(this.pet.x,GROUND,PET_DEFS[kind].col);
  }
  updatePet(dt,game){
    const p=this.pet, foe=game.other(this), D=PET_DEFS[p.kind];
    p.t-=dt; p.atkT-=dt; p.hitT=Math.max(0,p.hitT-dt);
    if(p.t<=0){ game.burst(p.x,GROUND-40,D.col,14); this.pet=null; return; }
    // тримається свого боку від ворога, на відстані удару
    const side=Math.sign(p.x-foe.x)||-this.facing;
    const tx=foe.alive&&game.phase==='fight'?foe.x+side*D.reach*0.95:this.x-this.facing*55;
    const d=tx-p.x, mv=Math.abs(d)>6?Math.sign(d)*Math.min(D.spd,Math.abs(d)*8):0;
    p.vx=mv; p.x=clamp(p.x+mv*dt,60,WORLD_W-60);
    p.facing=Math.sign((foe.alive?foe.x:this.x)-p.x)||p.facing;
    if(p.atkT<=0&&foe.alive&&game.phase==='fight'&&Math.abs(foe.x-p.x)<D.reach+20){
      p.atkT=p.cd; p.anim.play(Math.random()<0.5?'atkA':'atkB');
      game.after(D.hitAt,()=>{
        if(this.pet!==p||!foe.alive||Math.abs(foe.x-p.x)>D.reach+30) return;
        const dir=Math.sign(foe.x-p.x)||1;
        game.slash(p.x+dir*34,GROUND-D.h*0.5,dir,D.col,D.claw?'claw':'atkA');
        foe.takeDamage(p.dmg*this.dmgMult(),{x:p.x},game,{});
      });
    }
    p.anim.update(dt,{mode:Math.abs(p.vx)>20?'run':'idle',speed:Math.abs(p.vx),vy:0});
  }

  /* ---------- ультимейт (супершкала): кінопауза, банер і клас-специфічна дія ---------- */
  useUlt(game){
    if(this.meter<ULT_MAX||this.ko||this.stunT>0||this.staggerT>0||this.casting||this.windup||this.fearT>0||this.tossed||this.leap||this.dispersT>0) return false;
    if(game.phase!=='fight') return false;
    const U=ULTS[this.cls.id];
    this.meter=0; this.gcd=Math.max(this.gcd,0.4); this.blocking=false; this.stealthT=0;
    game.ultFx={t:1.15,T:1.15,side:this.idx,name:U.ua,color:this.cls.color,em:U.icon};
    game.hitstop=Math.max(game.hitstop,0.55); game.cam.punch=Math.max(game.cam.punch,0.1);
    sfx('ult');
    if(this.form!=='base'&&this.cls.id==='druid'&&this.formDef.id==='cat') this.setForm('base'); // Convoke — у гуманоїді
    this.runUlt(U,game);
    return true;
  }
  runUlt(U,game){
    const foe=game.other(this), dir=this.facing, dm=()=>this.dmgMult();
    const hit=(x,r,dmg,o={})=>{ if(foe.alive&&Math.abs(foe.x-x)<r+foe.w/2&&foe.y>GROUND-200) foe.takeDamage(dmg*dm(),this,game,{heavy:true,...o}); };
    const leapTo=(tx,L,vy=-760)=>{
      const air=2*-vy/1500;
      this.vy=vy; this.y=Math.min(this.y,GROUND-2);
      this.leap={vx:(clamp(tx,80,WORLD_W-80)-this.x)/air,a:L};
    };
    switch(this.cls.id){
      case 'warrior': // Avatar: росте, бафи, стрибок з ударом
        this.addBuff('dmg',1.3,8); this.addBuff('spd',1.2,8); this.growT=8;
        this.anim.play('roar');
        leapTo(foe.x-Math.sign(foe.x-this.x||dir)*70,{radius:150,dmg:150,stun:0.7,ring:'#ff5a3a',big:1});
        break;
      case 'paladin':{ // Final Reckoning: позначка, молот світла з неба
        const x=foe.x; game.mark(x,120,0.95,'#ffe27a');
        this.anim.play('point');
        game.fall('hammer',x,-260,x,0.95,'#ffe27a',()=>{
          game.ring(x,GROUND-30,150,'#ffe27a'); game.ring(x,GROUND-30,90,'#ffffff'); game.burst(x,GROUND-30,'#ffe27a',30);
          game.shake=Math.max(game.shake,14); game.cam.punch=Math.max(game.cam.punch,0.06); sfx('big');
          hit(x,120,230,{stun:1.0,unblockable:true});
        });
        break;
      }
      case 'hunter':{ // Volley: дощ стріл
        const x=foe.x; this.anim.play('shoot');
        game.zones.push({x,r:150,dps:55*dm(),t:4,owner:this,color:'#d8e8ff',slow:{mult:0.6,dur:1},acc:0,kind:'arrows'});
        break;
      }
      case 'rogue': // Death from Above: угору за кадр — і вниз на ворога
        this.anim.play('flip'); this.vy=-1250; this.y=Math.min(this.y,GROUND-2); this.leap={vx:0,a:null};
        game.smoke(this.x,this.y-this.h/2);
        game.after(0.55,()=>{
          if(this.ko) return;
          const x=clamp(foe.x,80,WORLD_W-80); game.mark(x,110,0.45,'#ffe27a');
          this.x=x; this.y=GROUND-560; this.vy=1100; this.facing=Math.sign(foe.x-x)||this.facing;
          this.leap={vx:0,a:{radius:110,dmg:210,stun:0.8,unblock:true,ring:'#ffe27a',big:1}};
          this.anim.play('slam');
        });
        break;
      case 'priest':{ // Halo: кільце на 420 — шкода ворогу й лікування собі
        const col=this.spec.name==='Shadow'?'#a878ff':'#ffe27a';
        this.anim.play('nova');
        for(const k of [0,0.12,0.24]) game.after(k,()=>{ game.ring(this.x,this.y-this.h/2,420*(0.5+k*2),col); });
        game.after(0.25,()=>{ if(this.ko) return; hit(this.x,420,170); this.healSelf(170,game); game.burst(this.x,this.y-this.h/2,col,30); });
        break;
      }
      case 'dk': // Army of the Dead: гулі виривають із землі під ворогом
        this.anim.play('summon');
        for(let n=0;n<4;n++) game.after(0.25+n*0.42,()=>{
          if(this.ko||!foe.alive) return;
          const x=foe.x; game.mark(x,70,0.32,'#7cff6b');
          game.after(0.32,()=>{ game.erupt(x); game.burst(x,GROUND-10,'#7cff6b',14); game.shake=Math.max(game.shake,5);
            hit(x,70,55,{slow:{mult:0.6,dur:1.2}}); });
        });
        break;
      case 'shaman': // Ascendance: блискавка з неба й 8 с сили
        this.addBuff('dmg',1.4,8); this.addBuff('dr',0.7,8); this.ascT=8;
        this.anim.play('roar');
        game.after(0.1,()=>{ if(!foe.alive) return;
          game.beam(foe.x+rnd(-30,30),-300,foe.x,foe.y-foe.h*0.5,'#ffffff'); game.beam(foe.x,-300,foe.x,foe.y-foe.h*0.5,'#8fd0ff');
          game.ring(foe.x,foe.y-foe.h*0.5,90,'#bfe6ff'); game.shake=Math.max(game.shake,10); sfx('big');
          foe.takeDamage(110*dm(),this,game,{heavy:true,unblockable:true,stun:0.3}); });
        break;
      case 'mage':{ // Meteor: позначка, метеор, вогняна зона
        const x=foe.x; game.mark(x,140,1.0,'#ff7733');
        this.anim.play('release');
        game.fall('meteor',x-dir*420,-320,x,1.0,'#ff7733',()=>{
          game.ring(x,GROUND-20,170,'#ff9440'); game.ring(x,GROUND-20,100,'#ffe27a'); game.burst(x,GROUND-20,'#ff7733',34); game.dust(x,GROUND);
          game.shake=Math.max(game.shake,15); game.cam.punch=Math.max(game.cam.punch,0.06); sfx('big');
          hit(x,140,240,{unblockable:true});
          game.zones.push({x,r:120,dps:30*dm(),t:3,owner:this,color:'#ff7733',acc:0});
        });
        break;
      }
      case 'warlock':{ // Infernal: падає з неба, оглушує, лишається битися
        const x=foe.x; game.mark(x,130,0.9,'#7cff6b');
        this.anim.play('summon');
        game.fall('infernal',x+dir*160,-300,x,0.9,'#7cff6b',()=>{
          game.ring(x,GROUND-20,160,'#7cff6b'); game.burst(x,GROUND-20,'#9dff70',30); game.dust(x,GROUND);
          game.shake=Math.max(game.shake,14); sfx('big');
          hit(x,130,170,{stun:1.2,unblockable:true});
          if(!this.ko){ this.summonPet('infernal',x,8,30,1.2,game); this.pet.atkT=1.3; this.pet.anim.play('land'); }   // присідає від удару об землю
        });
        break;
      }
      case 'druid': // Convoke the Spirits: шквал випадкових чарів
        this.anim.play('release');
        for(let n=0;n<12;n++) game.after(n*0.2,()=>{
          if(this.ko) return;
          const r=Math.random(), px=this.x+this.facing*34, py=this.y-this.h*0.62;
          if(r<0.45) game.spawnProj(this,CONVOKE.wrath,px,py+rnd(-10,10),this.facing,dm());
          else if(r<0.6) game.spawnProj(this,CONVOKE.starsurge,px,py,this.facing,dm());
          else if(r<0.85){ this.healSelf(45,game,true); game.burst(this.x,this.y-this.h/2,'#7dff8a',8); }
          else if(foe.alive){ game.beam(this.x,py,foe.x,foe.y-foe.h*0.6,'#b8c8ff'); foe.takeDamage(15*dm(),this,game,{dot:{dps:9,dur:6},dotName:'Moonfire',silent:true}); }
          this.playAbilityAnim(CONVOKE.wrath,0);
        });
        break;
    }
  }

  update(dt,game){
    // таймери
    for(const F of Object.values(this.forms)) for(let i=0;i<4;i++) F.cds[i]=Math.max(0,F.cds[i]-dt); // КД тікають в обох формах
    this.formCd=Math.max(0,this.formCd-dt); this.shiftT=Math.max(0,this.shiftT-dt);
    this.gcd=Math.max(0,this.gcd-dt);
    this.stunT=Math.max(0,this.stunT-dt);
    this.slowT=Math.max(0,this.slowT-dt);
    this.rootT=Math.max(0,this.rootT-dt);
    this.fearT=Math.max(0,this.fearT-dt);
    this.stealthT=Math.max(0,this.stealthT-dt);
    this.attackT=Math.max(0,this.attackT-dt);
    this.castT=Math.max(0,this.castT-dt);
    this.hitT=Math.max(0,this.hitT-dt);
    this.staggerT=Math.max(0,this.staggerT-dt);
    this.knockT=Math.max(0,this.knockT-dt); if(this.tossed) this.tossT+=dt;
    this.wingsT=Math.max(0,this.wingsT-dt);
    this.dispersT=Math.max(0,this.dispersT-dt); this.featherT=Math.max(0,this.featherT-dt);
    this.parryT=Math.max(0,this.parryT-dt); this.parryCd=Math.max(0,this.parryCd-dt);
    this.cancelT=Math.max(0,this.cancelT-dt); this.growT=Math.max(0,this.growT-dt); this.ascT=Math.max(0,this.ascT-dt);
    if(this.comboT>0){ this.comboT-=dt; if(this.comboT<=0) this.combo=0; }
    if(!this.blocking){ this.guardDelay-=dt; if(this.guardDelay<=0) this.guard=Math.min(GUARD_MAX,this.guard+35*dt); }
    for(const k in this.buffs) this.buffs[k].t=Math.max(0,this.buffs[k].t-dt);
    if(this.shieldT>0){ this.shieldT-=dt; if(this.shieldT<=0) this.shield=0; }

    // каст: оглушення перериває, завершення запускає ефект і КД
    if(this.casting){
      if(this.stunT>0){
        this.casting=null;
        game.float(this.x,this.y-this.h-34,'Перервано!','#ff8a7a',14);
      } else if(this.casting.chan){
        const c=this.casting, a=this.abilities[c.i];
        this.castT=0.1; c.t-=dt;
        const el=c.total-c.t;
        while(c.n<c.ticks&&el>=(c.n+0.3)*c.every){ c.n++; if(game.phase==='fight'&&!this.ko) this.chanTick(a,game); }
        // промінь висмоктування тримається весь канал
        if(a.type==='drain'){ c.beamT-=dt; const foe=game.other(this);
          if(c.beamT<=0&&Math.abs(foe.x-this.x)<=SPELL_RANGE){ c.beamT=0.08; game.beam(this.x+this.facing*30,this.y-this.h*0.62,foe.x,foe.y-foe.h*0.55,a.pcolor||'#7cff4a');
            if(game.particles) game.particles.push({x:foe.x+rnd(-8,8),y:foe.y-foe.h*0.55+rnd(-10,10),vx:(this.x-foe.x)*1.6,vy:rnd(-20,20),t:0.55,color:Math.random()<0.5?(a.pcolor||'#7cff4a'):'#d8ffc0',size:rnd(2,4),g:0}); } }
        if(c.t<=0) this.casting=null;
      } else {
        this.castT=0.1;
        this.casting.t-=dt;
        if(this.casting.t<=0){
          const ci=this.casting.i;
          this.casting=null;
          if(game.phase==='fight'&&!this.ko){
            this.cds[ci]=this.abilities[ci].cd;
            this.execAbility(ci,game);
          }
        }
      }
    }

    // замах: у кадрі удару — ефект; оглушення/стагер його збивають
    if(this.windup){
      if(this.stunT>0||this.staggerT>0) this.windup=null;
      else{
        this.windup.t-=dt;
        if(this.windup.t<=0){ const w=this.windup; this.windup=null; if(game.phase==='fight'&&!this.ko) this.resolveAbility(w.i,game); }
      }
    }

    // періодична шкода/лікування: тіки раз на секунду (менше цифр на екрані)
    for(const d of this.dots){
      d.t-=dt; d.acc+=d.dps*dt; d.tick+=dt;
      if(d.tick>=1||d.t<=0){ d.tick=0; const n=Math.round(d.acc); d.acc=0;
        if(n>0) this.takeDamage(n,null,game,{silent:true,dotTick:true}); }
    }
    this.dots=this.dots.filter(d=>d.t>0);
    for(const h of this.hots){
      h.t-=dt; h.acc+=h.tick*dt; h.tk=(h.tk||0)+dt;
      if(h.tk>=1||h.t<=0){ h.tk=0; const n=Math.round(h.acc); h.acc=0; if(n>0) this.healSelf(n,game,true); }
    }
    this.hots=this.hots.filter(h=>h.t>0);
    // скільки ще заберуть/відхілять активні DoT/HoT — для прогнозу на смузі HP (щит DoT з'їсть першим)
    this.dotLeft=Math.max(0,this.dots.reduce((s,d)=>s+d.dps*d.t+d.acc,0)*this.drMult()-this.shield);
    this.hotLeft=this.hots.reduce((s,h)=>s+h.tick*h.t+h.acc,0);

    // пет
    if(this.pet) this.updatePet(dt,game);

    if(this.ko){ this.vy+=1500*dt; this.y=Math.min(GROUND,this.y+this.vy*dt); this.updateAnim(dt,game); return; }

    // керування
    const foe=game.other(this);
    this.facing=Math.sign(foe.x-this.x)||this.facing;
    let mv=0, wantJump=false, wantBlock=false;
    const canAct=game.phase==='fight' && this.stunT<=0 && this.staggerT<=0 && !this.tossed && this.knockT<=0 && !this.leap && !state.paused && this.fearT<=0;
    if(canAct){
      if(this.isAI){ this.aiReact(dt,game); this.aiThink(dt,game); mv=this.aiMove; wantJump=this.aiJump; this.aiJump=false; wantBlock=this.aiBlockT>0; }
      else if(NET.on&&this.idx!==NET.side){ // суперник по мережі: лише його ввід, місцеві клавіші й пади не чіпають
        const st={mv:0,jump:false,block:false};
        vinApply(this,NET.rin,game,st);
        mv=st.mv; this.inputDir=mv; wantJump=st.jump; wantBlock=st.block;
      }
      else{
        const K=this.idx===0?P1KEYS:P2KEYS;
        if(keys.has(K.left)) mv-=1;
        if(keys.has(K.right)) mv+=1;
        const padMv=padInputs[this.idx]&&padInputs[this.idx].mv;
        this.inputDir=mv||padMv||0;          // куди затиснуто рух — для Blink
        wantJump=keys.has(K.jump);
        wantBlock=keys.has(K.block);
        const abKeys=K.ab;
        for(let i=0;i<4;i++){
          const kk=Array.isArray(abKeys[i])?abKeys[i]:[abKeys[i]];
          if(kk.some(c=>pressed.has(c))) this.useAbility(i,game);
        }
        if(K.form&&K.form.some(c=>pressed.has(c))) this.shapeshift(game);
        if(K.ult.some(c=>pressed.has(c))) this.useUlt(game);
        const pad=padInputs[this.idx];
        if(pad){
          if(pad.mv) mv=pad.mv;
          wantJump=wantJump||pad.jump;
          wantBlock=wantBlock||pad.block;
          for(let i=0;i<4;i++) if(pad.ab[i]) this.useAbility(i,game);
          if(pad.form) this.shapeshift(game);
          if(pad.ult) this.useUlt(game);
        }
        if(this.idx===(NET.on?NET.side:0)){ // сенсорне керування — за першим гравцем (у мережі — за своїм)
          const st={mv,jump:wantJump,block:wantBlock};
          vinApply(this,TIN,game,st);
          if(TIN.mv) this.inputDir=TIN.mv;
          mv=st.mv; wantJump=st.jump; wantBlock=st.block;
        }
      }
    }
    if(this.fearT>0&&game.phase==='fight'&&this.stunT<=0&&!this.tossed&&this.knockT<=0&&!state.paused){
      const from=this.fearSrc||foe; mv=Math.sign(this.x-from.x)||-this.facing;
      if((mv<0&&this.x<=81)||(mv>0&&this.x>=WORLD_W-81)) mv=0;   // уперся в стіну — тремтить на місці
      else this.facing=mv;
      wantJump=false; wantBlock=false;
    }
    const c=this.casting;
    if(c&&c.chan&&!this.isAI&&(mv||wantJump||wantBlock)&&c.total-c.t>CHAN_GRACE){ // канал — лише стоячи
      this.casting=null; game.float(this.x,this.y-this.h-34,'Канал перервано','#ff8a7a',14);
    }
    if(this.casting||this.windup){ mv=0; wantJump=false; wantBlock=false; } // каст і замах вкорінюють
    if(this.rootT>0){ mv=0; wantJump=false; }                              // крига/лози: стоїш, але можеш битися
    if(wantBlock&&!this.prevBlock&&canAct) this.onBlockPress();         // вчасне натискання = парирування
    this.prevBlock=wantBlock;
    this.blocking=wantBlock && this.onGround && canAct;
    if(this.blocking) mv*=0.4;                                            // у блоці можна повільно йти
    let spd=MOVE_SPEED*this.spdMult();
    if(mv&&Math.sign(mv)!==this.facing) spd*=0.72;                         // відступати повільніше, ніж наступати
    this.vx=mv*spd;
    if(wantJump && this.onGround && canAct && !this.blocking) this.vy=-640;

    // фізика (+ відкидання від ударів)
    this.vy+=1500*dt;
    this.kbV*=Math.exp(-(this.onGround?7:2)*dt);
    const xPrev=this.x;
    this.x=clamp(this.x+(this.vx+this.kbV+(this.leap?this.leap.vx:0))*dt,80,WORLD_W-80);
    // політ після Thunderstorm: удар об стіну, приземлення → коротко лежить
    if(this.tossed){
      const atWall=this.x<=80.01||this.x>=WORLD_W-80.01;
      if(atWall&&!this.wallHit&&Math.abs(this.kbV)>150&&this.tossWall){
        this.wallHit=true; this.kbV=-this.kbV*0.2;
        game.float(this.x,this.y-this.h-40,'Об стіну!','#8fd0ff',17);
        game.spark(this.x,this.y-this.h*0.5,this.x<WORLD_W/2?1:-1,'#bfe6ff',true);
        this.takeDamage(this.tossWall.dmg,null,game,{heavy:true,unblockable:true});
        this.stunT=Math.max(this.stunT,this.tossWall.stun);
        game.shake=Math.max(game.shake,10);
      }
    }
    this.y=Math.min(GROUND,this.y+this.vy*dt);
    if(this.onGround) this.vy=Math.min(this.vy,0);
    if(this.tossed&&this.onGround&&this.tossT>0.12){ this.tossed=false; this.knockT=0.75; this.anim.play('land'); game.dust(this.x,GROUND); }
    if(this.leap&&this.onGround&&this.vy>=0){
      const L=this.leap.a; this.leap=null;
      if(L){ // a=null — службовий «стрибок» (злет Death from Above), без удару
        game.dust(this.x,GROUND); game.ring(this.x,GROUND-20,L.radius,L.ring||'#ffb03a'); game.shake=Math.max(game.shake,L.big?14:9);
        if(L.big){ game.ring(this.x,GROUND-20,L.radius*0.6,'#ffffff'); game.cam.punch=Math.max(game.cam.punch,0.06); sfx('big'); }
        if(Math.abs(foe.x-this.x)<L.radius+foe.w/2&&Math.abs(foe.y-this.y)<120)
          foe.takeDamage(L.dmg*this.dmgMult(),this,game,{slow:L.slow,stun:L.stun,unblockable:L.unblock,heavy:true});
      }
    }
    if(mv!==0 && this.onGround) this.runPhase+=dt*10; else this.runPhase=0;
    this.animT+=dt;

    // м'яке розштовхування
    const dx=foe.x-this.x;
    if(Math.abs(dx)<52 && Math.abs(foe.y-this.y)<80 && this.dispersT<=0 && foe.dispersT<=0){
      const push=(52-Math.abs(dx))*0.5*Math.sign(dx||1);
      this.x=clamp(this.x-push,80,WORLD_W-80);
    }
    this.updateAnim(dt,game);
  }

  /* ---------- Анімація: стан бійця → поза ---------- */
  animInput(){
    const m={mode:'idle',speed:Math.abs(this.vx),vy:this.vy,channel:0,sneak:this.stealthT>0};
    if(this.ko) return m;
    if(!this.onGround) m.mode='air';
    else if(this.stunT>0||this.knockT>0) m.mode='stun';
    else if(this.blocking) m.mode='block';
    else if(Math.abs(this.vx)>1) m.mode=Math.sign(this.vx)===this.facing?(this.slowT>0?'walk':'run'):'back';
    if(this.casting) m.channel=1-this.casting.t/this.casting.total;
    return m;
  }
  updateAnim(dt,game){
    // приземлення: присід і пил
    const air=!this.onGround;
    if(this.wasAir && !air && !this.ko){
      if(!this.anim.act) this.anim.play('land');
      if(game.dust) game.dust(this.x,GROUND);
    }
    this.wasAir=air;
    if(this.casting){ const ca=this.abilities[this.casting.i]; this.model.castCol=ca.pcolor||this.accent; }
    this.anim.update(dt,this.animInput());
    // Ascendance: блискавки довкола
    if(this.ascT>0&&game.particles&&!this.preview&&Math.random()<dt*20)
      game.particles.push({x:this.x+rnd(-26,26),y:this.y-rnd(10,130),vx:rnd(-30,30),vy:rnd(-60,-20),t:rnd(0.2,0.45),color:Math.random()<0.5?'#bfe6ff':'#ffffff',size:rnd(2,4),g:0});
    // золоті іскри з крил
    if(this.wingsT>0&&game.particles&&!this.preview&&Math.random()<dt*14)
      game.particles.push({x:this.x-this.facing*rnd(20,70),y:this.y-rnd(80,150),vx:rnd(-20,20),vy:rnd(-40,-10),t:rnd(0.5,1),color:Math.random()<0.5?'#ffe9a3':'#ffffff',size:rnd(2,4),g:-20});
    if(!this.preview&&game.particles){
      if(this.dispersT>0&&Math.random()<dt*30)
        game.particles.push({x:this.x+rnd(-24,24),y:this.y-rnd(10,120),vx:rnd(-25,25),vy:rnd(-50,-15),t:rnd(0.4,0.9),color:Math.random()<0.6?'#7a4cc8':'#c9a8ff',size:rnd(3,6),g:-30});
      if(this.fearT>0&&Math.random()<dt*16)
        game.particles.push({x:this.x+rnd(-18,18),y:this.y-rnd(60,130),vx:rnd(-20,20),vy:rnd(-40,-10),t:rnd(0.3,0.6),color:Math.random()<0.5?'#8a5cff':'#2a1440',size:rnd(2,4),g:-20});
      if(this.featherT>0&&Math.random()<dt*12)
        game.particles.push({x:this.x-this.facing*rnd(10,40),y:this.y-rnd(40,110),vx:-this.vx*0.2+rnd(-15,15),vy:rnd(5,30),t:rnd(0.6,1.1),color:Math.random()<0.7?'#ffffff':'#ffe9a3',size:rnd(2,4),g:30});
    }
    // частинки ефекту сету
    const fx=this.model.fxKind;
    if(fx && !this.ko && game.particles && !this.preview){
      this.fxT-=dt;
      if(this.fxT<=0){
        this.fxT=1/fx.rate*rnd(0.6,1.4);
        const col=fx.cols[Math.random()<0.7?0:1];
        game.particles.push({x:this.x+rnd(-18,18),y:this.y-rnd(20,110),vx:rnd(-15,15),vy:fx.vy*rnd(0.6,1.3),t:rnd(0.5,1.1),color:col,size:rnd(2,4),g:fx.g});
      }
    }
  }

  /* ---------- ШІ ----------
     aiReact — щокадру: реакція на замах ворога і снаряди (блок, парирування, стрибок);
     aiThink — раз на 0.2–0.45 с: дистанція, вибір моменту й здібності.
     Складність = швидкість реакції, точність блоку й «терплячість» (не спамить). */
  aiReact(dt,game){
    const foe=game.other(this), sk=state.aiSkill;
    this.aiBlockT=Math.max(0,this.aiBlockT-dt);
    const dist=Math.abs(foe.x-this.x);
    // відкладене натискання блоку (імітація реакції / тайминг парирування)
    if(this.aiPending&&game.time>=this.aiPending.at){ this.aiBlockT=this.aiPending.dur; this.aiPending=null; }
    if(this.casting||this.windup) return;
    // новий замах ворога поруч
    const w=foe.windup;
    if(w&&w!==this._seenWindup){
      this._seenWindup=w;
      const a=foe.abilities[w.i];
      const reach=a.type==='melee'?(a.range||95)+80:(a.type==='aoe'?(a.radius||150)+40:0);
      if(reach&&dist<reach&&this.onGround){
        const heavy=w.total>0.2;
        const pB=heavy?[0.15,0.45,0.7][sk]:[0.05,0.18,0.35][sk];
        const react=[0.2,0.1,0.05][sk];
        if(Math.random()<pB){
          const parry=foe.wingsT<=0&&Math.random()<[0.04,0.15,0.3][sk];
          // парирування — натиснути за ~0.1 с до удару; звичайний блок — одразу після реакції
          const at=game.time+(parry?Math.max(0,w.t-0.1):react);
          if(parry||react<w.t) this.aiPending={at,dur:parry?0.25:0.5};
        }
      }
    }
    // снаряд летить у нас
    for(const p of game.projectiles){
      if(p.owner===this||p['seen'+this.idx]) continue;
      if(Math.sign(this.x-p.x)!==Math.sign(p.vx)||Math.abs(p.x-this.x)>300) continue;
      p['seen'+this.idx]=true;
      const r=Math.random();
      if(r<[0.12,0.3,0.45][sk]&&this.onGround) this.aiBlockT=Math.max(this.aiBlockT,0.5);
      else if(r<[0.25,0.5,0.7][sk]&&this.onGround) this.aiJump=true;
    }
  }

  aiThink(dt,game){
    const foe=game.other(this);
    const sk=state.aiSkill; // 0 легко, 1 норм, 2 важко
    this.aiT-=dt;
    if(this.aiT>0) return;
    this.aiT=[0.45,0.32,0.22][sk]+rnd(0,0.12);
    const dist=Math.abs(foe.x-this.x);
    const dir=Math.sign(foe.x-this.x)||1;
    const want=this.preferRange, melee=want<200;
    const hpF=this.hp/this.maxHp;
    const foeOpen=foe.stunT>0||foe.staggerT>0||!!foe.casting||foe.tossed||foe.knockT>0;   // вікно для покарання
    const incoming=game.projectiles.some(p=>p.owner===foe&&Math.sign(this.x-p.x)===Math.sign(p.vx)&&Math.abs(p.x-this.x)<420);

    // рух і дистанція
    let mv=0;
    if(melee){
      if(dist>want+15) mv=dir; else if(dist<55) mv=-dir; else mv=Math.random()<0.2?-dir:0;
      if(incoming&&dist>200&&Math.random()<[0.1,0.35,0.6][sk]) this.aiBlockT=Math.max(this.aiBlockT,0.45); // іти під обстрілом у блоці
    } else {
      if(dist>want+60) mv=dir; else if(dist<want-90) mv=-dir; else mv=Math.random()<0.3?(Math.random()<0.5?dir:-dir):0;
      if(mv===-dir&&(this.x<150||this.x>WORLD_W-150)) mv=Math.random()<0.5?0:dir; // не тиснутися в стіну
    }
    if(this.aiBlockT>0&&melee) mv=dir;
    // позначка ультимейта під ногами — тікати з кола
    const mk=game.marks&&game.marks.find(m=>Math.abs(m.x-this.x)<m.r+this.w/2+10);
    if(mk&&Math.random()<[0.35,0.7,0.95][sk]){ mv=Math.sign(this.x-mk.x)||-dir; if(this.x<200) mv=1; else if(this.x>WORLD_W-200) mv=-1; this.aiBlockT=0; }
    if(this.dispersT>0) mv=dist<220&&(this.x<300||this.x>WORLD_W-300)?dir:-dir; // біля стіни — крізь ворога на простір
    this.aiMove=mv;

    // форма друїда: лікуватися — у гуманоїді, битися — у формі
    if(this.formDef && this.formCd<=0 && !this.casting){
      const healReady=this.forms.base.cds[1]<=0;
      if(this.form==='alt'){
        if(hpF<0.4 && healReady && Math.random()<[0.25,0.55,0.85][sk]){ this.shapeshift(game); return; }
      } else if(!(hpF<0.5 && healReady) && Math.random()<[0.3,0.6,0.9][sk]){ this.shapeshift(game); return; }
    }

    // ультимейт: майже всі б'ють куди завгодно; жрецю й друїду треба бути ближче
    if(this.meter>=ULT_MAX&&Math.random()<[0.2,0.4,0.7][sk]){
      const near=this.cls.id==='priest'?dist<380:(this.cls.id==='druid'?dist<600:true);
      if(near&&this.useUlt(game)) return;
    }
    // скасування: після влучного легкого — одразу важкий
    if(this.cancelT>0&&this.cds[1]<=0&&Math.random()<[0.15,0.45,0.8][sk]&&this.useAbility(1,game)) return;
    // темп: бот не тисне все підряд; у вікно покарання — атакує завжди
    if(!foeOpen && Math.random()>[0.4,0.6,0.8][sk]) return;
    if(this.aiBlockT>0.2) return;
    const foeBlocking=foe.blocking&&Math.sign(this.x-foe.x)===foe.facing;
    const cand=[];
    this.abilities.forEach((a,i)=>{
      if(this.cds[i]>0||this.gcd>0) return;
      if(this.rootT>0&&(a.type==='dash'||a.type==='leap')) return;
      let s=0;
      const reach=(a.range||95)+foe.w/2;
      switch(a.type){
        case 'heal': s=hpF<0.5?90+(0.5-hpF)*200:0; if(melee===false&&dist<160) s*=0.5; break;
        case 'shield': s=hpF<0.75&&dist<400?65:0; break;
        case 'buff':
          if(a.disperse) s=(hpF<0.55?80:0)+(dist<130&&(this.x<280||this.x>WORLD_W-280)?70:0); // притиснули до стіни — пройти крізь
          else if(a.feather) s=!melee&&dist<200?75:(melee&&dist>320?50:0);
          else s=a.dmgTakenMult?(hpF<0.6?70:0):(dist<want+120?55:0);
          break;
        case 'stealth': s=dist>220?45:0; break;
        case 'melee':
          if(a.stun&&i===3){ s=dist<reach&&foe.stunT<=0?(foeBlocking?40:75):0; break; } // Kidney Shot
          if(dist<reach){
            s=i===1?(foeOpen||foe.guard<45?95:(foeBlocking?60:55)):(foeBlocking?30:70);
          }
          break;
        case 'aoe': s=dist<(a.radius||150)*0.85?(foeOpen?90:70):0; if(a.fear&&foe.fearT>0) s=0; break;
        case 'proj': case 'multi':
          if(a.cast) s=foeOpen?90:(dist>260?55:15);
          else if(a.chan) s=dist<170&&!foeOpen?8:(foeOpen||foe.rootT>0?85:60); // канал упритул — зіб'ють
          else s=dist>130?(foeBlocking?30:65):20;
          break;
        case 'curse': s=dist>(a.range||SPELL_RANGE)?0:(foe.dots.some(d=>d.name===a.name&&d.t>1.5)?0:(a.dmg?55:50));
          if(a.stun) s=foe.stunT>0?0:(dist<(a.range||SPELL_RANGE)?72:0);
          if(a.slow&&!a.dot) s=foe.slowT>0?0:(melee&&dist>180?70:(!melee&&dist<260?70:20));
          if(a.cast&&dist<150&&!foeOpen) s=10; // каст упритул зіб'ють
          if(a.root&&foe.rootT>0) s=0;
          if(a.fear) s=foe.fearT>0||dist>SPELL_RANGE?0:(dist<320?(dist<150&&!foeOpen?40:80):30);
          break;
        case 'zone': s=dist<700?50:0; break;
        case 'dash':
          if(a.move){ s=melee&&dist>260?70:(!melee&&dist<170?70:0); if(s) this.inputDir=melee?dir:-dir; }
          else if(a.toEnemy) s=melee&&dist>220?80:0;
          else if(a.back) s=!melee&&dist<170?80:0;
          else s=melee&&dist>260?50:(!melee&&dist<150?30:0);
          break;
        case 'tele':
          if(a.mode==='behind') s=melee&&dist>200?70:(foeBlocking&&dist<200?60:0);
          else if(a.mode==='away') s=!melee&&dist<170?80:0;
          else if(a.mode==='move'){ s=!melee&&dist<170?80:0; if(s) this.inputDir=-dir; }
          else s=dist>320?45:0;
          break;
        case 'pull': s=dist>240&&dist<SPELL_RANGE?75:0; break;
        case 'drain': s=dist>SPELL_RANGE?0:(foeOpen||foe.rootT>0?90:(dist>220?60:25))+(hpF<0.5?20:0); break;
        case 'pet': s=60; break;
        case 'knock': s=a.front?(dist<a.range*0.8?(melee?60:88):0):(dist<a.radius*0.85?88:0); break;
        case 'leap': s=melee&&dist>200?80:0; break;
      }
      if(s>0) cand.push({i,s:s+rnd(0,20)});
    });
    if(cand.length){
      cand.sort((a,b)=>b.s-a.s);
      this.useAbility(cand[0].i,game);
    }
  }

  /* ---------- Малювання (у світових координатах, ctx — низькороздільний шар) ---------- */
  spriteState(time){
    const sp=this.spr;
    sp.pose=this.anim.pose; sp.facing=this.facing; sp.x=this.x; sp.y=this.y; sp.time=time;
    sp.flash=this.shiftT>0?this.shiftT/0.35:(this.hitT>0.1?0.85:(this.hitT>0?0.35:0));
    sp.model=this.model;
    // крила Avenging Wrath: розкриваються за 0.35 с, згасають в останні 0.4 с
    this.model.wings=this.wingsT>0?Math.min(1,(this.wingsDur-this.wingsT)/0.35)*Math.min(1,this.wingsT/0.4):(this.model.permWings||0);
    sp.fade=this.stealthT>0?Math.min(this.anim.pose.fade,0.4):(this.dispersT>0?Math.min(this.anim.pose.fade,0.5):this.anim.pose.fade);
    // контур-підсвітка бафів
    sp.outline=this.dispersT>0?[168,120,255]:this.ascT>0?[150,215,255]:this.wingsT>0?[255,226,120]:this.buffs.dmg.t>0?[255,110,40]:(this.buffs.dr.t>0||this.shield>0?[90,170,255]:(this.buffs.spd.t>0?[120,230,255]:this.ultReady()?this.ultOutline(time):null));
    sp.alpha=1;
    return sp;
  }

  ultReady(){ return this.meter>=ULT_MAX&&!this.ko&&!this.preview; }
  ultOutline(time){ const k=0.5+0.5*Math.sin(time*7); return [255,Math.round(170+70*k),Math.round(40+110*k)]; }
  // ульта заряджена: золота аура за спиною — стовп світла, кільце під ногами й іскри, що здіймаються
  drawUltAura(g){
    const x=this.x, y=this.y, t=g.time, pulse=0.5+0.5*Math.sin(t*7);
    ctx.save();
    ctx.globalAlpha=this.stealthT>0?0.08:1;     // у тіні аура не видає розбійника
    ctx.globalCompositeOperation='lighter';
    const gr=ctx.createRadialGradient(x,y-62,6,x,y-62,78);
    gr.addColorStop(0,`rgba(255,214,90,${0.30+0.16*pulse})`); gr.addColorStop(1,'rgba(255,170,40,0)');
    ctx.fillStyle=gr; ctx.beginPath(); ctx.ellipse(x,y-62,52,84,0,0,7); ctx.fill();
    ctx.strokeStyle=`rgba(255,226,120,${0.45+0.3*pulse})`; ctx.lineWidth=3;
    ctx.beginPath(); ctx.ellipse(x,GROUND+6,36+pulse*6,9+pulse*1.5,0,0,7); ctx.stroke();
    for(let i=0;i<9;i++){
      const ph=(t*0.9+i*0.37)%1, sx=x+Math.sin(i*2.3+t*2)*30*(1-ph*0.4), sy=y-4-ph*140, sz=ph<0.7?4:2;
      ctx.globalAlpha=(this.stealthT>0?0.08:1)*(1-ph);
      ctx.fillStyle=i%3?'#ffd23a':'#fff4b0'; ctx.fillRect(Math.round(sx-sz/2),Math.round(sy-sz/2),sz,sz);
    }
    ctx.restore();
  }

  draw(g){
    const x=this.x, y=this.y;
    ctx.save();
    // тінь (менша, коли боєць у повітрі) + підсвітка кольору спеку
    const hAir=clamp((GROUND-y)/200,0,1);
    ctx.fillStyle='rgba(0,0,0,.38)';
    ctx.beginPath(); ctx.ellipse(x,GROUND+6,30*(1-hAir*0.5),7*(1-hAir*0.5),0,0,7); ctx.fill();
    ctx.globalAlpha=this.stealthT>0?0.06:0.16;
    ctx.fillStyle=this.accent;
    ctx.beginPath(); ctx.ellipse(x,GROUND+6,40,10,0,0,7); ctx.fill();
    ctx.restore();

    // Avatar: боєць більшає (розростається за 0.3 с і зменшується в кінці)
    if(this.ultReady()) this.drawUltAura(g);

    const gk=this.growT>0?1+0.16*Math.min(1,(8-this.growT)/0.3,this.growT/0.4):1;
    if(gk!==1){ ctx.save(); ctx.translate(x,y); ctx.scale(gk,gk); ctx.translate(-x,-y); }
    drawSprite(this.spriteState(g.time));
    if(gk!==1) ctx.restore();

    ctx.save();
    ctx.translate(x,y);
    // блок: дуга перед бійцем
    if(this.blocking){
      ctx.globalAlpha=0.75+Math.sin(g.time*12)*0.1;
      ctx.strokeStyle='#cfe4ff'; ctx.lineWidth=5;
      ctx.beginPath(); ctx.arc(this.facing*26,-68,34,this.facing>0?-1.1:Math.PI-1.1,this.facing>0?1.1:Math.PI+1.1); ctx.stroke();
      ctx.globalAlpha=1;
    }
    // щит-бабл
    if(this.shield>0){
      ctx.strokeStyle='rgba(140,200,255,.6)'; ctx.lineWidth=4;
      ctx.beginPath(); ctx.arc(0,-66,52+Math.sin(g.time*6)*2,0,7); ctx.stroke();
      ctx.fillStyle='rgba(140,200,255,.08)'; ctx.fill();
    }
    // кайдани біля ніг: крижана брила (Frost Nova) або лози (Entangling Roots)
    if(this.rootT>0) this.drawRoot(g);
    // страх: фіолетовий піксельний череп над головою, що тремтить
    if(this.fearT>0){
      const jx=Math.round(Math.sin(g.time*40)*2), sy=-182;
      ctx.save(); ctx.translate(jx,sy); ctx.scale(1.5,1.5);
      ctx.fillStyle='#2a1440'; ctx.fillRect(-10,-10,20,18);
      ctx.fillStyle='#c9a8ff'; ctx.fillRect(-8,-8,16,10); ctx.fillRect(-5,2,10,4);
      ctx.fillStyle='#2a1440'; ctx.fillRect(-6,-5,4,4); ctx.fillRect(2,-5,4,4); ctx.fillRect(-1,1,2,2);
      ctx.fillStyle='#8a5cff'; ctx.fillRect(-3,4,2,2); ctx.fillRect(1,4,2,2);
      ctx.restore();
    }
    // оглушення: піксельні зірочки над головою
    if(this.stunT>0){
      for(let i=0;i<3;i++){
        const a=g.time*4+i*2.1, sx=Math.cos(a)*22, sy=-146+Math.sin(a)*6;
        ctx.fillStyle=i%2?'#ffe27a':'#fff';
        ctx.fillRect(sx-5,sy-1.5,10,3); ctx.fillRect(sx-1.5,sy-5,3,10);
      }
    }
    ctx.restore();

    if(this.pet) drawPet(this.pet,g.time);
  }

  drawRoot(g){
    const k=Math.min(1,(this.rootDur-this.rootT)/0.12)*Math.min(1,this.rootT/0.3); // наростає і тане
    ctx.save(); ctx.globalAlpha=k;
    if(this.rootKind==='ice'){
      // брила по коліна з гранями й відблисками
      const H=46*k;
      ctx.fillStyle='rgba(150,215,255,.55)'; ctx.fillRect(-30,-H,60,H+4);
      ctx.fillStyle='rgba(200,240,255,.7)';
      for(const [sx,w,h] of [[-34,10,H*0.8],[-20,12,H+10],[-4,10,H*0.7],[10,12,H+14],[24,10,H*0.9]]){ ctx.fillRect(sx,-h,w,h+4); }
      ctx.fillStyle='#ffffff'; ctx.fillRect(-18,-H-6,4,H*0.6); ctx.fillRect(12,-H-10,4,H*0.5);
      ctx.fillStyle='rgba(60,140,220,.6)'; ctx.fillRect(-30,0,60,4);
      if(Math.sin(g.time*9)>0.6){ ctx.fillStyle='#fff'; ctx.fillRect(-26+((g.time*40)%52),-H*0.6,3,3); }
    } else {
      // лози обвивають ноги, з листками
      ctx.strokeStyle='#3f7a22'; ctx.lineWidth=5; ctx.lineCap='square';
      for(const s of [-1,1]){ ctx.beginPath(); ctx.moveTo(s*30,4);
        for(let yy=0;yy<=52*k;yy+=6) ctx.lineTo(s*(10+Math.sin(yy*0.22+g.time*2+s)*14),-yy);
        ctx.stroke(); }
      ctx.strokeStyle='#6fbf3a'; ctx.lineWidth=2;
      for(const s of [-1,1]){ ctx.beginPath(); ctx.moveTo(s*26,2); for(let yy=0;yy<=46*k;yy+=6) ctx.lineTo(s*(8+Math.sin(yy*0.22+g.time*2+s)*12),-yy); ctx.stroke(); }
      ctx.fillStyle='#9dff70';
      for(let n=0;n<5;n++){ const yy=-8-n*10*k, xx=Math.sin(n*1.7+g.time)*20; ctx.fillRect(xx-3,yy-2,6,4); }
    }
    ctx.restore();
  }

  /* ---------- Табличка і смуга касту (екранні координати, повна роздільність) ---------- */
  drawOverlay(g,toS){
    if(this.ko||this.preview) return;
    const top=toS(this.x,this.y-150), sc=g.cam.scale;
    ctx.save();
    ctx.globalAlpha=this.stealthT>0?0.35:0.95;
    ctx.textAlign='center';
    ctx.font='12px "Tiny5",sans-serif';
    ctx.fillStyle=this.idx===0?'#4aa3ff':'#ff6a5a';
    ctx.strokeStyle='rgba(0,0,0,.75)'; ctx.lineWidth=3;
    const tag=this.isAI?'БОТ':(NET.on&&this.idx===NET.side?'ТИ':(this.idx===0?'P1':'P2'));
    ctx.strokeText(tag,top.x,top.y-10);
    ctx.fillText(tag,top.x,top.y-10);
    ctx.restore();
    if(this.casting){
      const cw=Math.max(56,86*sc),chh=7,cx0=top.x-cw/2,cy0=top.y;
      const p=this.casting.chan?this.casting.t/this.casting.total:1-this.casting.t/this.casting.total; // канал — спадає
      ctx.fillStyle='rgba(8,12,20,.85)'; ctx.fillRect(cx0,cy0,cw,chh);
      ctx.fillStyle=this.model.castCol||this.accent; ctx.fillRect(cx0,cy0,cw*p,chh);
      ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.lineWidth=1.5; ctx.strokeRect(cx0,cy0,cw,chh);
    }
  }
}

function shade(hex,amt){
  const n=parseInt(hex.slice(1),16);
  let r=(n>>16)+amt, g=((n>>8)&255)+amt, b=(n&255)+amt;
  r=clamp(r,0,255); g=clamp(g,0,255); b=clamp(b,0,255);
  return `rgb(${r},${g},${b})`;
}
function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

