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
const MIRROR_OFF=[55,110,165];   // Mirror Image: копії стоять позаду мага на цих відстанях
// таймери станів ультимейтів без подій наприкінці — просто спадають (решта — у updateUltStates)
const ULT_TIMERS=['ccImmT','invulnT','untargT','healRedT','silenceT','mcT','hexT','dwT','berserkT','lustT','bwT','hasteT','guardT','drwT'];
// коли бот тисне ульту: f — бот, o — ворог, d — відстань, hp — частка свого здоровʼя (без запису — будь-коли)
const ULT_AI={
  'warrior/Arms':(f,o,d)=>d<150,
  'warrior/Fury':(f,o,d)=>d<520,
  'warrior/Protection':(f,o,d)=>d<380&&o.y>GROUND-40,
  'paladin/Holy':(f,o,d,hp)=>hp<0.45,
  'paladin/Protection':(f,o,d,hp)=>hp<0.5,
  'hunter/Beast Mastery':(f,o,d)=>d<600,
  'hunter/Marksmanship':(f,o)=>o.hp/o.maxHp<0.55,
  'hunter/Survival':(f,o,d)=>d>120,
  'rogue/Assassination':(f,o,d)=>d<600,
  'rogue/Combat':(f,o,d)=>d<400,
  'priest/Discipline':(f,o,d)=>d<360,
  'priest/Holy':(f,o,d,hp)=>hp<0.5,
  'priest/Shadow':(f,o,d)=>d<SPELL_RANGE,
  'dk/Blood':(f,o,d)=>d<250,
  'shaman/Elemental':(f,o,d)=>d<SPELL_RANGE-40,
  'shaman/Enhancement':(f,o,d)=>d<300,
  'shaman/Restoration':(f,o,d,hp)=>hp<0.6,
  'mage/Arcane':(f,o,d)=>d>150,
  'warlock/Affliction':(f,o)=>o.dots.length>0,
  'warlock/Demonology':(f,o,d)=>d<300,
  'druid/Feral':(f,o,d)=>d<350,
  'druid/Restoration':(f,o,d,hp)=>hp<0.55,
};
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
    this.wingsT=0; this.wingsDur=0; this.dispersT=0; this.featherT=0; this.pomT=0;
    this.combo=0; this.comboT=0; this.cancelT=0; this.lastBlocked=false;
    this.growT=0; this.growDur=8;   // боєць більшає (Death Wish, Metamorphosis, Berserk)
    // стани ультимейтів (свої й накладені ворогом) — усі таймери в секундах, 0 — неактивно
    this.ccImmT=0;                 // контроль не діє (Death Wish)
    this.stormT=0; this.stormAcc=0;   // Bladestorm
    this.invulnT=0;                // Divine Shield: жодної шкоди
    this.untargT=0;                // Killing Spree, Vanish: тебе не дістати
    this.healRedT=0;               // Wound Poison: лікування −50%
    this.silenceT=0;               // Mass Dispel: без здібностей
    this.mcT=0; this.mcDir=1;      // Mind Control
    this.hexT=0; this.hexDmg=0;    // Hex: жаба
    this.freezeT=0; this.freezeDur=0; this.freezeBrk=false; this.shatter=null;   // брила льоду (Deep Freeze, Freezing Trap)
    this.bombT=0; this.bombSrc=null;   // Living Bomb на цьому бійці
    this.hauntT=0; this.hauntSrc=null; // Haunt: DoT по цьому бійцю сильніші
    this.dwT=0; this.metaT=0; this.metaAcc=0; this.berserkT=0; this.lustT=0; this.bwT=0;
    this.hasteT=0; this.hasteMult=1;   // Rapid Fire
    this.guardT=0;                 // Guardian Spirit
    this.drwT=0;                   // Dancing Rune Weapon
    this.mirrorT=0; this.mirrorCd=0; this.mirrorN=0;   // Mirror Image
    this.tranqT=0; this.tranqAcc=0;    // Tranquility
    this.sleepT=0; this.sleepDot=null; // Wyvern Sting: сон, удар будить, далі отрута
    this._metaOn=null;   // Metamorphosis не переживає раунд: setForm нижче поверне свою модель
    if(this.forms){ // новий раунд — знову гуманоїд, свіжі аніматори й КД
      for(const F of Object.values(this.forms)){ F.anim=F.mkAnim(); F.cds.fill(0); }
      this.formCd=0; this.shiftT=0;
      this.setForm('base');
    }
  }
  get alive(){ return !this.ko; }
  get onGround(){ return this.y>=GROUND-0.5; }
  dmgMult(){ return (this.buffs.dmg.t>0?this.buffs.dmg.mult:1)*(this.dwT>0?1.25:1)*(this.metaT>0?1.2:1)*(this.lustT>0?1.1:1)*(this.bwT>0?1.1:1); }
  spdMult(){ const fp=this.formPassive; return (this.buffs.spd.t>0?this.buffs.spd.mult:1)*(this.slowT>0?this.slowMult:1)*(fp&&fp.spd||1)
    *(this.lustT>0?1.25:1)*(this.berserkT>0?1.3:1)*(this.stormT>0?0.85:1)*(this.hexT>0?0.6:1)*(this.mcT>0?0.55:1); }
  drMult(){ const fp=this.formPassive; return (this.buffs.dr.t>0?this.buffs.dr.mult:1)*(fp&&fp.dr||1)*(this.stealthT>0?0.7:1)  // у тіні по тобі важче влучити
    *(this.dwT>0?1.1:1)*(this.metaT>0?0.7:1)*(this.mcT>0?1.3:1); }
  // контроль (оглушення, сповільнення, кайдани, страх, відкидання) не діє
  ccImmune(){ return this.ccImmT>0||this.stormT>0||this.invulnT>0||this.untargT>0; }
  // скинути з себе контроль і DoT (Lay on Hands, Divine Shield, Mass Dispel)
  cleanse(){
    this.dots=[]; this.slowT=0; this.rootT=0; this.fearT=0; this.stunT=0; this.healRedT=0; this.silenceT=0;
    this.mcT=0; this.hexT=0; this.freezeT=0; this.shatter=null; this.bombT=0; this.hauntT=0;
  }
  // зняти з бійця бафи, щит і HoT (Mass Dispel)
  dispelBuffs(){
    for(const k in this.buffs) this.buffs[k].t=0;
    this.shield=0; this.shieldT=0; this.hots=[]; this.stealthT=0; this.stealthBonus=false; this.wingsT=0; this.pomT=0;
    this.dwT=0; this.metaT=0; this.lustT=0; this.hasteT=0; this.guardT=0; this.ccImmT=0; this.featherT=0;
    if(!this.berserkT) this.growT=0;
  }

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
    if(this.invulnT>0||this.untargT>0){ // Divine Shield, крізь тіні: ні шкоди, ні контролю
      if(!opts.dotTick&&raw>0&&game.time-(this._immT??-9)>0.6){ this._immT=game.time; game.float(this.x,this.y-this.h-30,'Імунітет','#ffe9a3',14); }
      return 0;
    }
    const cc=!this.ccImmune(), soft=cc&&this.berserkT<=0;   // soft — страх, сповільнення й кайдани (Berserk від них звільняє)
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
    if(dmg>0&&!tick&&this.sleepT>0) this.wake(game);   // Wyvern Sting: удар будить
    if(dmg>0&&this.hexT>0){ this.hexDmg+=dmg;   // Hex: досить шкоди — чари спадають
      if(this.hexDmg>=200){ this.hexT=0; game.smoke(this.x,this.y-40); game.float(this.x,this.y-this.h-34,'Чари розвіялись','#9dff70',14); } }
    if(dmg>0&&!tick&&this.freezeT>0&&this.freezeBrk&&this.freezeDur-this.freezeT>0.3){   // Freezing Trap: удар розбиває лід
      this.freezeT=0; this.stunT=0; game.burst(this.x,this.y-this.h*0.5,'#d8f4ff',18); game.float(this.x,this.y-this.h-34,'Лід розбито','#aee8ff',14); }
    if(dmg>0&&this.guardT>0&&this.hp-dmg<=0){ // Guardian Spirit: смертельний удар замість смерті лікує
      dmg=Math.max(0,Math.round(this.hp-1)); this.guardT=0;
      game.after(0,()=>{ if(this.ko) return; this.hp=Math.max(this.hp,400); game.burst(this.x,this.y-this.h*0.6,'#ffffff',30); game.ring(this.x,this.y-this.h/2,160,'#fff4d0');
        game.float(this.x,this.y-this.h-40,'Дух-охоронець!','#fff4d0',18); sfx('heal'); });
    }
    if(dmg>0&&foeF&&foeF.dwT>0) foeF.healSelf(dmg*0.12,game,true);   // Death Wish: удари лікують
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
    if(!blocked && opts.stun && cc) this.stunT=Math.max(this.stunT,opts.stun);
    if(opts.slow && soft){ this.slowT=Math.max(this.slowT,opts.slow.dur); this.slowMult=opts.slow.mult; }
    if(opts.fear&&!this.ko&&soft){
      this.fearT=opts.fear.dur; this.fearDmg=0; this.fearBrk=opts.fear.brk||90; this.fearSrc=src;
      this.casting=null; this.windup=null; this.blocking=false;
      game.float(this.x,this.y-this.h-34,'Страх!','#c9a8ff',17);
    }
    if(opts.sleep&&!this.ko&&soft){ // Wyvern Sting: заснув на місці
      this.sleepT=opts.sleep.dur; this.sleepDot=opts.sleep.dot; this.casting=null; this.windup=null; this.blocking=false; this.fearT=0;
      game.float(this.x,this.y-this.h-34,'Сон','#9dff70',17);
    }
    if(opts.root&&!this.ko&&soft){
      if(this.rootT<=0) game.float(this.x,this.y-this.h-34,opts.root.kind==='ice'?'Заморожено!':'Скуто!',opts.root.kind==='ice'?'#aee8ff':'#9dff70',16);
      this.rootT=Math.max(this.rootT,opts.root.dur); this.rootDur=this.rootT; this.rootKind=opts.root.kind; this.kbV=0; this.leap=null;
    }
    if(opts.dot){
      const old=opts.dotName&&this.dots.find(d=>d.name===opts.dotName);
      if(old){ old.t=opts.dot.dur; old.dps=opts.dot.dps; }  // повторне накладання оновлює, а не множить
      else this.dots.push({dps:opts.dot.dps,t:opts.dot.dur,acc:0,tick:0,name:opts.dotName});
    }
    if(opts.toss&&cc) this.tossUp(opts.toss.dir,opts.toss.v,opts.toss.vy,opts.toss.wall,src);
    if(opts.knockback && !blocked && cc){
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
    n*=(this.healRedT>0?0.5:1)*(this.guardT>0?1.4:1);   // Wound Poison / Guardian Spirit
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
    if(this.hexT>0||this.mcT>0||this.stormT>0||this.untargT>0||this.tranqT>0||this.sleepT>0) return false;   // жаба, чужа воля, буря, крізь тіні, канал Спокою, сон
    if(this.silenceT>0){ if(game.time-(this._silT??-9)>0.5){ this._silT=game.time; game.float(this.x,this.y-this.h-30,'Мовчання','#c9a8ff',13); } return false; }
    const a=this.abilities[i];
    if(this.rootT>0&&(a.type==='dash'||a.type==='leap')){
      game.float(this.x,this.y-this.h-30,this.rootKind==='ice'?'Заморожено':'Скуто','#9aa4b5',13); this.gcd=0.2; return false;
    }
    if((a.type==='curse'||a.type==='pull'||a.type==='drain')&&Math.abs(game.other(this).x-this.x)>(a.range||SPELL_RANGE)){
      game.float(this.x,this.y-this.h-30,'Задалеко','#9aa4b5',13); this.gcd=0.2; return false;
    }
    this.gcd=a.gcd??GCD;
    if(a.cast&&this.pomT>0){ // Presence of Mind: заряд витрачено — закляття без касту
      this.pomT=0; game.float(this.x,this.y-this.h-30,'Миттєво!','#c9e6ff',14);
    } else if(a.cast){ // кастований спел: КД піде після завершення касту
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
      const dealt=foe.takeDamage(a.dmg*dmgM,this,game,{dotTick:true,silent:true,slow:a.slow});
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
          const brk=this.berserkT>0;   // Berserk: удари не блокуються й лишають кровотечу
          const dealt=foe.takeDamage(a.dmg*mult,this,game,{stun:a.stun,slow:a.slow,dot:a.dot,dotName:a.name,knockback:a.knockback,heavy:i===1,unblockable:brk});
          if(brk) foe.takeDamage(0,this,game,{dot:{dps:16,dur:3},dotName:'Rake',silent:true,unblockable:true});
          if(i===0&&dealt>0&&!foe.lastBlocked) this.cancelT=CANCEL_WIN;
          if(a.selfHeal) this.healSelf(a.selfHeal,game,true);
          if(a.healFrac) this.healSelf(dealt*a.healFrac,game,true);
        }
        { const pt=foe.pet;   // удар зачіпає й пета поруч
          if(pt&&Math.abs(pt.x-this.x)<(a.range||95)+22&&Math.sign(pt.x-this.x||dir)===dir) foe.hurtPet(a.dmg*mult,game,this); }
        if(this.drwT>0) game.after(0.13,()=>this.runeStrike(a,game));   // рунний клинок повторює удар
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
        if(a.instantCast){ this.pomT=a.dur; game.burst(this.x,this.y-this.h*0.7,'#9fd0ff',16); }
        if(a.haste){ this.hasteT=a.dur; this.hasteMult=a.haste; }
        game.burst(this.x,this.y-this.h/2,a.disperse?'#a878ff':(a.feather?'#ffffff':(a.dmgTakenMult?'#9fd7ff':'#ffb03a')),16);
        break;
      case 'aoe':{
        game.ring(this.x,this.y-this.h/2,a.radius,this.color);
        const d=Math.hypot(foe.x-this.x,(foe.y-foe.h/2)-(this.y-this.h/2));
        if(d<a.radius+foe.w/2){
          foe.takeDamage(a.dmg*dmgM,this,game,{stun:a.stun,slow:a.slow,root:a.root,dot:a.dot,dotName:a.name,heavy:true,fear:a.fear});
        }
        if(a.selfHeal) this.healSelf(a.selfHeal,game,true);
        game.splashPet(this,this.x,a.radius,a.dmg*dmgM);
        break;
      }
      case 'zone':{
        const zx=a.at==='self'?this.x+dir*60:foe.x;
        game.zones.push({x:zx,r:a.radius,dps:a.dps*dmgM,t:a.dur,owner:this,color:a.zcolor||this.color,slow:a.slow,acc:0,kind:a.zkind});
        break;
      }
      case 'trap':{ // одна пастка на мисливця: нова замінює стару
        const tx=clamp(this.x+dir*14,80,WORLD_W-80);
        game.traps=game.traps.filter(t=>t.owner!==this);
        game.traps.push({x:tx,owner:this,t:a.life,arm:a.arm,r:a.r,freeze:a.freeze});
        game.burst(tx,GROUND-6,'#aee8ff',10);
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
          const dd=a.move?(this.inputDir||dir):(a.back?-dir:dir); // Disengage — від ворога; Sprint — куди біжиш
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
        const tcol=a.mode==='behind'?'#6a5a8a':(a.name==='Demonic Circle: Teleport'?'#7cff6b':'#c9a8ff');
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
          game.splashPet(this,this.x+dir*a.range*0.5,a.range*0.5,a.dmg*dmgM);
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
        game.splashPet(this,this.x,a.radius,a.dmg*dmgM);
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
        game.beam(this.x,this.y-this.h*0.6,foe.x,foe.y-foe.h*0.6,a.sleep?'#9dff70':(a.stun?'#ffe27a':(a.slow&&!a.dot?'#aee8ff':'#a878ff')));
        foe.takeDamage((a.dmg||0)*dmgM,this,game,{dot:a.dot,dotName:a.name,slow:a.slow,root:a.root,fear:a.fear,stun:a.stun,sleep:a.sleep,unblockable:!!(a.fear||a.sleep),silent:!a.dmg});
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
    const hp=PET_DEFS[kind].hp||100;
    this.pet={kind,x:clamp(x,60,WORLD_W-60),y:GROUND,vx:0,facing:this.facing,t:dur,T:dur,dmg,cd,atkT:0.6,anim:petAnim(kind),hitT:0,hp,maxHp:hp};
    game.portal(this.pet.x,GROUND,PET_DEFS[kind].col);
  }
  updatePet(dt,game){
    const p=this.pet, foe=game.other(this), D=PET_DEFS[p.kind];
    p.t-=dt; p.atkT-=dt; p.hitT=Math.max(0,p.hitT-dt); p.rage=Math.max(0,(p.rage||0)-dt);
    if(p.t<=0){ game.burst(p.x,GROUND-40,D.col,14); this.pet=null; return; }
    // тримається свого боку від ворога, на відстані удару
    const side=Math.sign(p.x-foe.x)||-this.facing;
    const tx=foe.alive&&game.phase==='fight'?foe.x+side*D.reach*0.95:this.x-this.facing*55;
    const d=tx-p.x, mv=Math.abs(d)>6?Math.sign(d)*Math.min(D.spd*(p.rage>0?1.3:1),Math.abs(d)*8):0;
    p.vx=mv; p.x=clamp(p.x+mv*dt,60,WORLD_W-60);
    p.facing=Math.sign((foe.alive?foe.x:this.x)-p.x)||p.facing;
    if(p.atkT<=0&&foe.alive&&game.phase==='fight'&&Math.abs(foe.x-p.x)<D.reach+20){
      const rage=p.rage>0;   // Bestial Wrath: кусає вдвічі частіше, укус сповільнює й не блокується
      p.atkT=rage?p.cd*0.6:p.cd; p.anim.play(Math.random()<0.5?'atkA':'atkB');
      game.after(D.hitAt,()=>{
        if(this.pet!==p||!foe.alive||Math.abs(foe.x-p.x)>D.reach+30) return;
        const dir=Math.sign(foe.x-p.x)||1;
        game.slash(p.x+dir*34,GROUND-D.h*0.5,dir,rage?'#ff5a3a':D.col,D.claw?'claw':'atkA');
        foe.takeDamage((rage?22:p.dmg)*this.dmgMult(),{x:p.x},game,rage?{slow:{mult:0.6,dur:1},unblockable:true}:{});
      });
    }
    p.anim.update(dt,{mode:Math.abs(p.vx)>20?'run':'idle',speed:Math.abs(p.vx),vy:0});
  }

  /* ---------- ультимейт (супершкала): кінопауза, банер і дія свого спеку ---------- */
  useUlt(game){
    if(this.meter<ULT_MAX||this.ko||this.stunT>0||this.staggerT>0||this.casting||this.windup||this.fearT>0||this.tossed||this.leap||this.dispersT>0) return false;
    if(this.hexT>0||this.mcT>0||this.untargT>0||this.stormT>0||this.tranqT>0||this.sleepT>0) return false;
    if(game.phase!=='fight') return false;
    const U=ultOf(this);
    this.meter=0; this.gcd=Math.max(this.gcd,0.4); this.blocking=false; this.stealthT=0;
    game.ultFx={t:1.15,T:1.15,side:this.idx,name:U.ua,color:this.cls.color,em:U.icon};
    game.hitstop=Math.max(game.hitstop,0.55); game.cam.punch=Math.max(game.cam.punch,0.1);
    sfx('ult');
    this.runUlt(U,game);
    return true;
  }
  runUlt(U,game){
    const foe=game.other(this), dir=this.facing, dm=()=>this.dmgMult();
    const hit=(x,r,dmg,o={})=>{ if(foe.alive&&Math.abs(foe.x-x)<r+foe.w/2&&foe.y>GROUND-200) foe.takeDamage(dmg*dm(),this,game,{heavy:true,...o}); game.splashPet(this,x,r,dmg*dm()); };
    const leapTo=(tx,L,vy=-760)=>{
      const air=2*-vy/1500;
      this.vy=vy; this.y=Math.min(this.y,GROUND-2);
      this.leap={vx:(clamp(tx,80,WORLD_W-80)-this.x)/air,a:L};
    };
    const hand=()=>({x:this.x+this.facing*30,y:this.y-this.h*0.62});
    const freeCC=()=>{ this.stunT=0; this.slowT=0; this.rootT=0; this.fearT=0; };
    const reach=()=>foe.alive&&foe.invulnT<=0&&foe.untargT<=0;   // ціль, на яку можна щось накласти
    switch(this.cls.id+'/'+this.spec.name){
      case 'warrior/Arms': // Bladestorm: вихор 5 с, бʼє довкола, контроль не діє
        this.stormT=5; this.stormAcc=0.15; freeCC(); this.anim.play('storm');
        game.ring(this.x,this.y-this.h/2,140,'#ffd23a');
        break;
      case 'warrior/Fury': // Death Wish: лютий стрибок і 10 с берсерка
        this.dwT=8; this.ccImmT=8; this.growT=8; this.growDur=8; freeCC();
        this.anim.play('roar');
        leapTo(foe.x-Math.sign(foe.x-this.x||dir)*70,{radius:140,dmg:90,stun:0.6,ring:'#ff3a2a',big:1});
        break;
      case 'warrior/Protection':{ // Shockwave: хвиля землею вперед, бʼє того, хто на землі
        this.anim.play('slamGround');
        const x0=this.x, d=dir; let done=false;
        game.after(0.22,()=>{
          if(this.ko) return;
          game.shake=Math.max(game.shake,12); sfx('big');
          for(let k=0;k<10;k++) game.after(k*0.035,()=>{
            const fr=40+k*46, x=x0+d*fr;
            if(x>60&&x<WORLD_W-60){
              game.dust(x,GROUND); game.ring(x,GROUND-12,22+k*2,'#e8d8b0');
              for(let q=0;q<3;q++) game.particles.push({x:x+rnd(-14,14),y:GROUND-4,vx:d*rnd(20,90),vy:-rnd(160,360),t:rnd(0.35,0.6),color:q%2?'#8a7a62':'#c8b890',size:rnd(4,8),g:900});
            }
            const pt=foe.pet; if(pt&&!pt.waveHit&&Math.abs((pt.x-x0)*d-fr)<40){ pt.waveHit=true; foe.hurtPet(150*dm(),game,this); }
            const fx=(foe.x-x0)*d;
            if(!done&&!this.ko&&foe.alive&&fx>fr-60-foe.w/2&&fx<fr+foe.w/2+10&&foe.y>GROUND-70){
              done=true; foe.takeDamage(150*dm(),this,game,{heavy:true,unblockable:true,stun:2.0});
            }
          });
        });
        break;
      }
      case 'paladin/Holy': // Lay on Hands: миттєве велике лікування й очищення
        this.anim.play('heal'); this.cleanse(); this.healSelf(420,game);
        for(let k=0;k<3;k++) game.after(k*0.08,()=>{ game.beam(this.x+rnd(-14,14),-260,this.x,this.y-this.h*0.5,'#fff4b0'); });
        game.burst(this.x,this.y-this.h*0.6,'#ffe27a',30); game.ring(this.x,this.y-this.h/2,140,'#fff4b0');
        break;
      case 'paladin/Protection': // Divine Shield: 5 с без шкоди й контролю
        this.invulnT=5; this.cleanse(); this.anim.play('ward');
        game.ring(this.x,this.y-this.h/2,90,'#ffe27a'); game.burst(this.x,this.y-this.h/2,'#fff4b0',24);
        break;
      case 'paladin/Retribution':{ // Hammer of Wrath: позначка, молот світла з неба
        const x=foe.x; game.mark(x,120,0.95,'#ffe27a');
        this.anim.play('point');
        game.fall('hammer',x,-260,x,0.95,'#ffe27a',()=>{
          game.ring(x,GROUND-30,150,'#ffe27a'); game.ring(x,GROUND-30,90,'#ffffff'); game.burst(x,GROUND-30,'#ffe27a',30);
          game.shake=Math.max(game.shake,14); game.cam.punch=Math.max(game.cam.punch,0.06); sfx('big');
          hit(x,120,230,{stun:1.0,unblockable:true});
        });
        break;
      }
      case 'hunter/Beast Mastery':{ // Bestial Wrath: вовк лютує, мисливець теж
        if(!this.pet||this.pet.kind!=='wolf') this.summonPet('wolf',this.x-dir*50,8,15,1.25,game);
        const p=this.pet; p.t=Math.max(p.t,8); p.T=Math.max(p.T,p.t); p.rage=8; p.hp=p.maxHp;
        this.bwT=8; this.anim.play('roar');
        game.burst(p.x,GROUND-40,'#ff5a3a',20); game.float(p.x,GROUND-110,'Звіряча лють!','#ff8866',16);
        break;
      }
      case 'hunter/Marksmanship': // Kill Shot: стріла на добивання
        this.anim.play('shoot');
        game.after(0.16,()=>{ if(this.ko) return; const h=hand(); game.spawnProj(this,ULT_PROJ.killShot,h.x,h.y,this.facing,dm()); sfx('big'); game.shake=Math.max(game.shake,5); });
        break;
      case 'hunter/Survival': // Lock and Load: три Explosive Shot поспіль
        for(let n=0;n<3;n++) game.after(n*0.32,()=>{
          if(this.ko) return; this.anim.play('shoot');
          game.after(0.14,()=>{ if(this.ko) return; const h=hand(); game.spawnProj(this,ULT_PROJ.explosive,h.x,h.y,this.facing,dm()); sfx('cast'); });
        });
        break;
      case 'rogue/Assassination':{ // Cold Blood: ривок і отруєний крит
        const stop=clamp(foe.x-Math.sign(foe.x-this.x||dir)*70,80,WORLD_W-80);
        game.trail(this.x,stop,this.y-this.h/2,'#7cff6b'); this.x=stop; this.facing=Math.sign(foe.x-this.x)||dir;
        this.anim.play('heavy');
        game.after(0.1,()=>{
          if(this.ko||!foe.alive) return;
          game.slash(this.x+this.facing*40,this.y-this.h*0.55,this.facing,'#7cff6b','heavy');
          if(Math.abs(foe.x-this.x)>170) return;
          foe.takeDamage(150*dm(),this,game,{heavy:true,unblockable:true,dot:{dps:25,dur:6},dotName:'Deadly Poison'});
          if(reach()){ foe.healRedT=8; game.float(foe.x,foe.y-foe.h-40,'КРИТ!','#9dff70',20); }
          game.burst(foe.x,foe.y-foe.h*0.55,'#7cff6b',22);
        });
        break;
      }
      case 'rogue/Combat': // Killing Spree: пʼять ударів крізь тіні
        this.untargT=1.85; this.ccImmT=1.85; freeCC(); game.smoke(this.x,this.y-this.h/2);
        for(let n=0;n<5;n++) game.after(0.06+n*0.34,()=>{
          if(this.ko) return;
          const side=n%2?1:-1, x=clamp(foe.x+side*72,80,WORLD_W-80);
          game.trail(this.x,x,this.y-this.h/2,'#ffdf8a'); game.smoke(x,this.y-this.h/2);
          this.x=x; this.y=GROUND; this.vy=0; this.facing=Math.sign(foe.x-x)||-side;
          this.anim.play(n%2?'atkA':'atkB');
          game.slash(this.x+this.facing*40,this.y-this.h*0.55,this.facing,'#ffdf8a',n===4?'heavy':'atkA');
          if(foe.alive&&Math.abs(foe.x-this.x)<160) foe.takeDamage(42*dm(),this,game,{unblockable:true,heavy:n===4});
        });
        break;
      case 'rogue/Subtlety': // Vanish → Ambush і Cheap Shot з-за спини
        this.untargT=1.0; this.stealthT=1.05; freeCC(); game.smoke(this.x,this.y-this.h/2); game.smoke(this.x,this.y-this.h/2);
        this.anim.play('vanish');
        game.after(1.0,()=>{
          if(this.ko) return;
          const x=clamp(foe.x-(foe.facing||1)*80,80,WORLD_W-80);   // за спиною — звідки ворог не дивиться
          game.smoke(x,this.y-this.h/2); this.x=x; this.y=GROUND; this.facing=Math.sign(foe.x-x)||1; this.stealthT=0;
          this.anim.play('heavy');
          game.after(0.08,()=>{
            if(this.ko||!foe.alive) return;
            game.slash(this.x+this.facing*40,this.y-this.h*0.55,this.facing,'#b48cff','heavy');
            if(Math.abs(foe.x-this.x)<170) foe.takeDamage(180*dm(),this,game,{heavy:true,unblockable:true,stun:1.4});
          });
        });
        break;
      case 'priest/Discipline':{ // Mass Dispel: хвиля, що зриває бафи й накладає мовчання
        this.anim.play('nova'); const R=380;
        for(const k of [0,0.1,0.2]) game.after(k,()=>{ game.ring(this.x,this.y-this.h/2,R*(0.45+k*2.6),k===0.1?'#ffffff':'#9fd7ff'); });
        game.after(0.22,()=>{
          if(this.ko) return;
          this.cleanse(); this.healSelf(80,game);
          if(foe.alive&&foe.untargT<=0&&Math.abs(foe.x-this.x)<R+foe.w/2){
            foe.dispelBuffs(); foe.silenceT=3; foe.casting=null;   // знімає навіть Divine Shield
            foe.takeDamage(110*dm(),this,game,{heavy:true,unblockable:true});
            game.burst(foe.x,foe.y-foe.h*0.6,'#e8f4ff',22); game.float(foe.x,foe.y-foe.h-40,'Розвіяно!','#cfe4ff',17);
          }
        });
        break;
      }
      case 'priest/Holy': // Guardian Spirit: дух-охоронець
        this.guardT=10; this.anim.play('heal'); this.healSelf(120,game);
        game.burst(this.x,this.y-this.h*0.8,'#ffffff',26); game.ring(this.x,this.y-this.h/2,120,'#fff4d0');
        break;
      case 'priest/Shadow': // Mind Control: ворог під чужою волею
        this.anim.play('point');
        game.beam(this.x+dir*30,this.y-this.h*0.62,foe.x,foe.y-foe.h*0.85,'#b48cff');
        if(reach()){
          foe.takeDamage(90*dm(),this,game,{unblockable:true});
          if(!foe.ccImmune()){ foe.mcT=3; foe.mcDir=Math.sign(foe.x-this.x)||dir; foe.casting=null; foe.windup=null; foe.blocking=false; foe.fearT=0;
            game.float(foe.x,foe.y-foe.h-40,'Під контролем!','#c9a8ff',17); }
        }
        break;
      case 'dk/Blood': // Dancing Rune Weapon
        this.drwT=10; this.drwSwing=0.3; this.anim.play('summon');
        game.portal(this.x-dir*30,this.y,'#ff4a4a');
        game.after(0.15,()=>{ if(this.ko||!foe.alive) return;   // клинок одразу бʼє
          game.slash(this.x+this.facing*40,this.y-this.h*0.66,this.facing,'#ff6a6a','heavy');
          if(Math.abs(foe.x-this.x)<200) foe.takeDamage(70*dm(),this,game,{heavy:true}); });
        break;
      case 'dk/Frost':{ // Howling Blast: крижаний вибух під ворогом
        this.anim.play('release'); const x=foe.x;
        game.after(0.12,()=>{
          if(this.ko) return;
          game.ring(x,GROUND-50,170,'#aee8ff'); game.ring(x,GROUND-50,100,'#ffffff');
          for(let k=0;k<26;k++){ const a=rnd(0,7), s=rnd(140,420); game.particles.push({x:x+rnd(-20,20),y:GROUND-50+rnd(-30,30),vx:Math.cos(a)*s,vy:Math.sin(a)*s-120,t:rnd(0.35,0.7),color:k%3?'#d8f4ff':'#7de0ff',size:rnd(3,6),g:200}); }
          game.shake=Math.max(game.shake,11); sfx('big');
          if(foe.alive&&Math.abs(foe.x-x)<150+foe.w/2){ const out=Math.sign(foe.x-this.x)||dir;
            foe.takeDamage(150*dm(),this,game,{heavy:true,unblockable:true,toss:{dir:out,v:200,vy:-600},dot:{dps:15,dur:6},dotName:'Frost Fever',slow:{mult:0.5,dur:4}}); }
          game.splashPet(this,x,150,150*dm());
        });
        break;
      }
      case 'dk/Unholy': // Army of the Dead: гулі виривають із землі під ворогом
        this.anim.play('summon');
        for(let n=0;n<4;n++) game.after(0.25+n*0.42,()=>{
          if(this.ko||!foe.alive) return;
          const x=foe.x; game.mark(x,70,0.32,'#7cff6b');
          game.after(0.32,()=>{ game.erupt(x); game.burst(x,GROUND-10,'#7cff6b',14); game.shake=Math.max(game.shake,5);
            hit(x,70,55,{slow:{mult:0.6,dur:1.2}}); });
        });
        break;
      case 'shaman/Elemental': // Chain Lightning: пʼять розрядів поспіль
        this.anim.play('release');
        for(let n=0;n<5;n++) game.after(0.1+n*0.17,()=>{
          if(this.ko||!foe.alive) return;
          const h=hand(), last=n===4;
          game.zap(h.x,h.y,foe.x,foe.y-foe.h*0.55,last?'#ffffff':'#8fd0ff');
          game.burst(foe.x,foe.y-foe.h*0.55,'#bfe6ff',8);
          if(Math.abs(foe.x-this.x)<SPELL_RANGE) foe.takeDamage((last?80:44)*dm(),this,game,{unblockable:true,stun:0.3,heavy:last,knockback:last?80:0});
          if(last) game.shake=Math.max(game.shake,8);
        });
        break;
      case 'shaman/Enhancement': // Bloodlust: усе вдвічі швидше
        this.lustT=8; this.cds[0]=0; this.cds[1]=0; this.anim.play('roar');
        game.burst(this.x,this.y-this.h/2,'#ff5a3a',26); game.ring(this.x,this.y-this.h/2,130,'#ff7a4a');
        break;
      case 'shaman/Restoration': // Hex: ворог — жаба
        this.anim.play('point');
        game.beam(this.x+dir*30,this.y-this.h*0.62,foe.x,foe.y-foe.h*0.5,'#9dff70');
        if(reach()&&!foe.ccImmune()){
          foe.hexT=4; foe.hexDmg=0; foe.casting=null; foe.windup=null; foe.blocking=false; foe.fearT=0; foe.stealthT=0;
          game.smoke(foe.x,foe.y-40); game.burst(foe.x,foe.y-40,'#9dff70',16); game.float(foe.x,foe.y-foe.h-30,'Жаба!','#9dff70',17);
        }
        this.cds[1]=0; this.pomT=5;   // Nature's Swiftness: Healing Wave одразу готова й без касту
        break;
      case 'mage/Arcane': // Mirror Image: три копії мага
        this.mirrorT=6; this.mirrorCd=0.45; this.mirrorN=0; this.anim.play('summon');
        for(const o of MIRROR_OFF) game.portal(clamp(this.x-dir*o,60,WORLD_W-60),this.y,'#c9a8ff');
        break;
      case 'mage/Fire': // Living Bomb: бомба на ворозі
        this.anim.play('point');
        game.beam(this.x+dir*30,this.y-this.h*0.62,foe.x,foe.y-foe.h*0.6,'#ff9440');
        if(reach()){ foe.bombT=3; foe.bombSrc=this;
          foe.takeDamage(0,this,game,{dot:{dps:14,dur:3},dotName:'Living Bomb',silent:true,unblockable:true});
          game.float(foe.x,foe.y-foe.h-30,'Жива бомба!','#ffb03a',17); }
        break;
      case 'mage/Frost': // Deep Freeze: брила льоду, потім розкол
        this.anim.play('release');
        game.beam(this.x+dir*30,this.y-this.h*0.62,foe.x,foe.y-foe.h*0.5,'#aee8ff');
        if(reach()){
          game.burst(foe.x,foe.y-foe.h*0.5,'#d8f4ff',22);
          if(foe.ccImmune()) foe.takeDamage(150*dm(),this,game,{heavy:true,unblockable:true});   // на незламного — одразу шкода
          else { foe.freezeT=2.5; foe.freezeDur=2.5; foe.freezeBrk=false; foe.stunT=Math.max(foe.stunT,2.5);
            foe.casting=null; foe.windup=null; foe.blocking=false; foe.shatter={src:this,dmg:150}; }
        }
        break;
      case 'warlock/Affliction': // Haunt: дух, що підсилює DoT і повертається з лікуванням
        this.anim.play('release');
        game.after(0.12,()=>{ if(this.ko) return; const h=hand(); game.spawnProj(this,ULT_PROJ.haunt,h.x,h.y,this.facing,dm()); });
        break;
      case 'warlock/Demonology': // Metamorphosis: форма демона
        this.metaT=10; this.metaAcc=0; this.growT=10; this.growDur=10; this.setMeta(true); this.anim.play('roar');
        game.burst(this.x,this.y-this.h/2,'#9dff70',30); game.ring(this.x,this.y-this.h/2,150,'#7cff6b'); game.portal(this.x,this.y,'#7cff6b');
        break;
      case 'warlock/Destruction':{ // Inferno: інфернал падає з неба, оглушує, лишається битися
        const x=foe.x; game.mark(x,130,0.9,'#7cff6b');
        this.anim.play('summon');
        game.fall('infernal',x+dir*160,-300,x,0.9,'#7cff6b',()=>{
          game.ring(x,GROUND-20,160,'#7cff6b'); game.burst(x,GROUND-20,'#9dff70',30); game.dust(x,GROUND);
          game.shake=Math.max(game.shake,14); sfx('big');
          hit(x,130,150,{stun:1.2,unblockable:true});
          if(!this.ko){ this.summonPet('infernal',x,8,20,1.2,game); this.pet.atkT=1.3; this.pet.anim.play('land'); }   // присідає від удару об землю
        });
        break;
      }
      case 'druid/Balance': // Starfall: зорепад довкола ворога
        this.anim.play('release');
        for(let n=0;n<10;n++) game.after(0.12+n*0.25,()=>{
          if(this.ko) return;
          const x=clamp(foe.x+rnd(-55,55),70,WORLD_W-70);
          game.fall('star',x+rnd(-160,160),-300,x,0.42,'#b8c8ff',()=>{
            game.ring(x,GROUND-24,60,'#b8c8ff'); game.burst(x,GROUND-24,'#e0e8ff',10);
            hit(x,58,25,{heavy:false,unblockable:true});
          });
        });
        break;
      case 'druid/Feral': // Berserk: кіт-берсерк
        if(this.formDef&&this.form!=='alt'){ this.setForm('alt'); this.formCd=0.5; game.burst(this.x,this.y-this.h/2,'#ffb03a',20); }
        this.berserkT=8; this.growT=8; this.growDur=8; this.slowT=0; this.rootT=0; this.fearT=0; this.cds.fill(0);   // відкати форми — одразу готові
        this.anim.play('lunge'); game.ring(this.x,this.y-40,120,'#ff5a3a');
        leapTo(foe.x-Math.sign(foe.x-this.x||dir)*60,{radius:110,dmg:60,stun:0.6,ring:'#ff5a3a'},-620);
        break;
      case 'druid/Restoration': // Tranquility: канал лікування
        this.tranqT=3; this.tranqAcc=0.25; this.anim.stop(); this.blocking=false;
        game.ring(this.x,this.y-this.h/2,130,'#7dff8a');
        break;
    }
  }
  // Dancing Rune Weapon: клинок повторює удар ближнього бою на 60% шкоди
  runeStrike(a,game){
    if(this.ko||this.drwT<=0) return;
    const foe=game.other(this), d=this.facing, bx=this.x-d*14;
    game.slash(bx+d*44,this.y-this.h*0.66,d,'#ff6a6a',this.abilities.indexOf(a)===1?'heavy':'atkB');
    if(foe.alive&&Math.abs(foe.x-bx)<(a.range||95)+70+foe.w/2&&Math.abs(foe.y-this.y)<100&&Math.sign(foe.x-bx||d)===d)
      foe.takeDamage(a.dmg*0.8*this.dmgMult(),this,game,{dot:a.dot,dotName:a.dot?a.name:undefined});
    this.drwSwing=0.3;
  }

  update(dt,game){
    // таймери (Bloodlust і Rapid Fire пришвидшують відкати; Bloodlust — ще й глобальний КД)
    const cdr=dt*(this.lustT>0?2:1)*(this.hasteT>0?this.hasteMult:1);
    for(const F of Object.values(this.forms)) for(let i=0;i<4;i++) F.cds[i]=Math.max(0,F.cds[i]-cdr); // КД тікають в обох формах
    this.formCd=Math.max(0,this.formCd-dt); this.shiftT=Math.max(0,this.shiftT-dt);
    this.gcd=Math.max(0,this.gcd-dt*(this.lustT>0?2:1));
    for(const k of ULT_TIMERS) this[k]=Math.max(0,this[k]-dt);
    this.drwSwing=Math.max(0,(this.drwSwing||0)-dt);
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
    this.dispersT=Math.max(0,this.dispersT-dt); this.featherT=Math.max(0,this.featherT-dt); this.pomT=Math.max(0,this.pomT-dt);
    this.parryT=Math.max(0,this.parryT-dt); this.parryCd=Math.max(0,this.parryCd-dt);
    this.cancelT=Math.max(0,this.cancelT-dt); this.growT=Math.max(0,this.growT-dt);
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
    const dotK=this.hauntT>0?1.6:1;   // Haunt: DoT по цілі сильніші
    for(const d of this.dots){
      d.t-=dt; d.acc+=d.dps*dt*dotK; d.tick+=dt;
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
    this.dotLeft=Math.max(0,this.dots.reduce((s,d)=>s+d.dps*d.t*dotK+d.acc,0)*this.drMult()-this.shield);
    this.hotLeft=this.hots.reduce((s,h)=>s+h.tick*h.t+h.acc,0);

    // пет
    if(this.pet) this.updatePet(dt,game);

    if(this.ko){ this.vy+=1500*dt; this.y=Math.min(GROUND,this.y+this.vy*dt); this.updateAnim(dt,game); return; }

    // керування
    const foe=game.other(this);
    this.updateUltStates(dt,game,foe);
    this.facing=Math.sign(foe.x-this.x)||this.facing;
    let mv=0, wantJump=false, wantBlock=false;
    const canAct=game.phase==='fight' && this.stunT<=0 && this.staggerT<=0 && !this.tossed && this.knockT<=0 && !this.leap && !state.paused && this.fearT<=0
      && this.mcT<=0 && this.untargT<=0 && this.sleepT<=0;
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
    // Mind Control: бреде геть від жерця, спиною до нього
    if(this.mcT>0&&game.phase==='fight'&&this.stunT<=0&&!this.tossed&&!state.paused){
      mv=this.mcDir; if((mv<0&&this.x<=81)||(mv>0&&this.x>=WORLD_W-81)) mv=0; else this.facing=mv;
      wantJump=false; wantBlock=false;
    }
    if(this.hexT>0||this.stormT>0){ wantJump=false; wantBlock=false; }   // жаба й буря: лише ходити
    if(this.tranqT>0){ mv=0; wantJump=false; wantBlock=false; }          // канал Спокою — на місці
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
      if(L){ // a=null — службовий «стрибок» без удару
        game.dust(this.x,GROUND); game.ring(this.x,GROUND-20,L.radius,L.ring||'#ffb03a'); game.shake=Math.max(game.shake,L.big?14:9);
        if(L.big){ game.ring(this.x,GROUND-20,L.radius*0.6,'#ffffff'); game.cam.punch=Math.max(game.cam.punch,0.06); sfx('big'); }
        if(Math.abs(foe.x-this.x)<L.radius+foe.w/2&&Math.abs(foe.y-this.y)<120)
          foe.takeDamage(L.dmg*this.dmgMult(),this,game,{slow:L.slow,stun:L.stun,unblockable:L.unblock,heavy:true});
        game.splashPet(this,this.x,L.radius,L.dmg*this.dmgMult());
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

  // Wyvern Sting: прокинувся (удар чи час) — отрута
  wake(game){
    const d=this.sleepDot; this.sleepT=0; this.sleepDot=null;
    if(d&&!this.ko){ this.dots.push({dps:d.dps,t:d.dur,acc:0,tick:0,name:'Wyvern Sting'}); game.float(this.x,this.y-this.h-34,'Прокинувся','#9dff70',14); }
  }
  // по пету цього бійця влучили: смуга здоровʼя, а на нулі пет гине
  hurtPet(dmg,game,src){
    const p=this.pet; if(!p||!p.maxHp||dmg<=0) return 0;
    const D=PET_DEFS[p.kind];
    dmg=Math.round(dmg*(p.rage>0?0.5:1));   // Bestial Wrath — лютий пет міцніший
    p.hp-=dmg; p.hitT=0.2;
    game.float(p.x+rnd(-8,8),GROUND-D.h*D.scale-24,`${dmg}`,'#ffdca0',15);
    game.spark(p.x,GROUND-D.h*0.5,Math.sign(p.x-(src?src.x:p.x))||1,'#ffcf6a',false);
    if(src instanceof Fighter) src.addMeter(dmg*0.04,game);
    if(p.hp<=0){ game.burst(p.x,GROUND-40,D.col,24); game.smoke(p.x,GROUND-40); game.float(p.x,GROUND-120,'Пета вбито','#ff8a7a',15); this.pet=null; }
    return dmg;
  }

  /* ---------- стани ультимейтів, що діють щокадру ---------- */
  updateUltStates(dt,game,foe){
    const fight=game.phase==='fight';
    if(this.sleepT>0){ this.sleepT=Math.max(0,this.sleepT-dt); if(this.sleepT<=0) this.wake(game); }
    if(this.stormT>0){ // Bladestorm: удар довкола кожні 0.45 с
      this.stormT=Math.max(0,this.stormT-dt); this.stormAcc-=dt;
      if(this.stormT<=0) this.anim.stop();
      else{
        if(!this.anim.act||this.anim.act.name!=='storm') this.anim.play('storm');
        if(this.stormAcc<=0&&fight){ this.stormAcc=0.45;
          game.slash(this.x+30,this.y-this.h*0.55,1,'#ffe27a','atkA'); game.slash(this.x-30,this.y-this.h*0.55,-1,'#ffe27a','atkB');
          if(foe.alive&&Math.abs(foe.x-this.x)<130+foe.w/2&&Math.abs(foe.y-this.y)<110) foe.takeDamage(36*this.dmgMult(),this,game,{});
          game.splashPet(this,this.x,130,36*this.dmgMult());
        }
        if(Math.random()<dt*20&&game.particles) game.particles.push({x:this.x+rnd(-40,40),y:GROUND-rnd(0,8),vx:rnd(-120,120),vy:-rnd(30,90),t:rnd(0.2,0.4),color:'#b8a890',size:rnd(3,5),g:300});
      }
    }
    if(this.tranqT>0){ // Tranquility: хвилі лікування, поки стоїш; оглушення чи чужа воля перериває
      if(this.stunT>0||this.fearT>0||this.mcT>0||this.hexT>0||this.tossed){ this.tranqT=0; game.float(this.x,this.y-this.h-34,'Перервано!','#ff8a7a',14); }
      else{
        this.tranqT=Math.max(0,this.tranqT-dt); this.tranqAcc-=dt;
        if(this.tranqAcc<=0){ this.tranqAcc=0.5; this.healSelf(70,game,true); game.burst(this.x,this.y-this.h*0.5,'#7dff8a',10); game.ring(this.x,this.y-this.h/2,110,'#9dff9a'); }
        if(Math.random()<dt*24&&game.particles) game.particles.push({x:this.x+rnd(-90,90),y:this.y-rnd(150,230),vx:rnd(-25,25),vy:rnd(40,90),t:rnd(0.9,1.5),color:Math.random()<0.6?'#7dff8a':'#d8ffc0',size:rnd(2,4),g:10});
        if(this.tranqT<=0) this.hots.push({tick:12,t:4,acc:0});
      }
    }
    if(this.mirrorT>0){ // Mirror Image: копії по черзі кидають Arcane Blast
      this.mirrorT=Math.max(0,this.mirrorT-dt); this.mirrorCd-=dt;
      if(this.mirrorCd<=0&&fight&&foe.alive&&!this.ko){ this.mirrorCd=0.3;
        const x=clamp(this.x-this.facing*MIRROR_OFF[this.mirrorN++%MIRROR_OFF.length],60,WORLD_W-60);
        game.spawnProj(this,ULT_PROJ.mirror,x+this.facing*30,this.y-this.h*0.62,this.facing,this.dmgMult());
      }
    }
    if(this.bombT>0){ // Living Bomb на цьому бійці: за 3 с вибух
      this.bombT=Math.max(0,this.bombT-dt);
      if(this.bombT<=0){ const src=this.bombSrc, k=src?src.dmgMult():1; this.bombSrc=null;
        game.ring(this.x,this.y-this.h/2,170,'#ff9440'); game.ring(this.x,this.y-this.h/2,100,'#ffe27a'); game.burst(this.x,this.y-this.h/2,'#ff7733',34);
        game.shake=Math.max(game.shake,13); sfx('big');
        this.takeDamage(150*k,src,game,{heavy:true,unblockable:true,toss:{dir:src?(Math.sign(this.x-src.x)||1):1,v:160,vy:-520}});
        if(src){ game.zones.push({x:this.x,r:110,dps:25*k,t:2,owner:src,color:'#ff7733',acc:0}); game.splashPet(src,this.x,170,150*k); }
      }
    }
    if(this.hauntT>0){ // Haunt: коли спадає — дух повертається й лікує господаря
      this.hauntT=Math.max(0,this.hauntT-dt);
      if(this.hauntT<=0){ const s=this.hauntSrc; this.hauntSrc=null;
        if(s&&!s.ko){ game.beam(this.x,this.y-this.h*0.8,s.x,s.y-s.h*0.6,'#c8f0ff'); s.healSelf(100,game); } }
    }
    if(this.metaT>0){ // Metamorphosis: Immolation Aura палить поруч
      this.metaT=Math.max(0,this.metaT-dt); this.metaAcc-=dt;
      if(this.metaT<=0){ this.setMeta(false); game.burst(this.x,this.y-this.h/2,'#c060ff',24); game.smoke(this.x,this.y-this.h/2); }
      if(this.metaAcc<=0&&fight){ this.metaAcc=0.5;
        if(foe.alive&&Math.abs(foe.x-this.x)<130+foe.w/2&&Math.abs(foe.y-this.y)<120) foe.takeDamage(10*this.dmgMult(),this,game,{dotTick:true,silent:true});
        game.splashPet(this,this.x,130,10*this.dmgMult()); }
      if(Math.random()<dt*26&&game.particles) game.particles.push({x:this.x+rnd(-60,60),y:this.y-rnd(0,40),vx:rnd(-20,20),vy:-rnd(60,140),t:rnd(0.3,0.6),color:Math.random()<0.6?'#7cff6b':'#e0ffb0',size:rnd(2,5),g:-60});
    }
    if(this.freezeT>0){ // брила льоду; Deep Freeze наприкінці розколюється
      this.freezeT=Math.max(0,this.freezeT-dt);
      if(this.freezeT<=0){ const sh=this.shatter; this.shatter=null;
        game.burst(this.x,this.y-this.h*0.5,'#d8f4ff',26);
        if(sh){ game.ring(this.x,this.y-this.h/2,120,'#aee8ff'); sfx('big');
          this.takeDamage(sh.dmg*(sh.src?sh.src.dmgMult():1),sh.src,game,{heavy:true,unblockable:true}); }
      }
    }
    if(game.particles&&!this.preview){ // сліди станів: отрута, жага крові, лють Death Wish
      if(this.healRedT>0&&Math.random()<dt*10) game.particles.push({x:this.x+rnd(-16,16),y:this.y-rnd(40,100),vx:rnd(-10,10),vy:rnd(20,60),t:rnd(0.4,0.7),color:Math.random()<0.6?'#7cff6b':'#2a6a1a',size:rnd(2,4),g:200});
      if(this.lustT>0&&Math.random()<dt*18) game.particles.push({x:this.x+rnd(-26,26),y:this.y-rnd(10,120),vx:rnd(-20,20),vy:-rnd(40,90),t:rnd(0.3,0.6),color:Math.random()<0.5?'#ff5a3a':'#ffb03a',size:rnd(2,4),g:-30});
      if(this.dwT>0&&Math.random()<dt*14) game.particles.push({x:this.x+rnd(-22,22),y:this.y-rnd(60,140),vx:rnd(-15,15),vy:-rnd(40,80),t:rnd(0.4,0.8),color:Math.random()<0.5?'#ff3a2a':'#5a1010',size:rnd(2,4),g:-20});
    }
  }

  /* ---------- Анімація: стан бійця → поза ---------- */
  animInput(){
    const m={mode:'idle',speed:Math.abs(this.vx),vy:this.vy,channel:0,sneak:this.stealthT>0};
    if(this.ko) return m;
    if(!this.onGround) m.mode='air';
    else if(this.stunT>0||this.knockT>0||this.sleepT>0) m.mode='stun';
    else if(this.blocking) m.mode='block';
    else if(Math.abs(this.vx)>1) m.mode=Math.sign(this.vx)===this.facing?(this.slowT>0?'walk':'run'):'back';
    if(this.casting) m.channel=1-this.casting.t/this.casting.total;
    if(this.tranqT>0){ m.mode='idle'; m.channel=1-this.tranqT/3; }   // Tranquility — руки вгору, як у каналі
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
    // золоті іскри з крил
    if(this.wingsT>0&&game.particles&&!this.preview&&Math.random()<dt*14)
      game.particles.push({x:this.x-this.facing*rnd(20,70),y:this.y-rnd(80,150),vx:rnd(-20,20),vy:rnd(-40,-10),t:rnd(0.5,1),color:Math.random()<0.5?'#ffe9a3':'#ffffff',size:rnd(2,4),g:-20});
    if(!this.preview&&game.particles){
      if(this.dispersT>0&&Math.random()<dt*30)
        game.particles.push({x:this.x+rnd(-24,24),y:this.y-rnd(10,120),vx:rnd(-25,25),vy:rnd(-50,-15),t:rnd(0.4,0.9),color:Math.random()<0.6?'#7a4cc8':'#c9a8ff',size:rnd(3,6),g:-30});
      if(this.fearT>0&&Math.random()<dt*16)
        game.particles.push({x:this.x+rnd(-18,18),y:this.y-rnd(60,130),vx:rnd(-20,20),vy:rnd(-40,-10),t:rnd(0.3,0.6),color:Math.random()<0.5?'#8a5cff':'#2a1440',size:rnd(2,4),g:-20});
      if(this.pomT>0&&Math.random()<dt*14) // заряд Presence of Mind — блакитні іскри біля рук
        game.particles.push({x:this.x+this.facing*rnd(10,30),y:this.y-this.h*rnd(0.45,0.7),vx:rnd(-15,15),vy:rnd(-45,-15),t:rnd(0.3,0.6),color:Math.random()<0.6?'#9fd0ff':'#ffffff',size:rnd(2,3),g:-20});
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
    if(this.stormT>0){ this.aiMove=dir; return; }   // Bladestorm — лише наздоганяти
    if(this.hexT>0){ this.aiMove=-dir; return; }    // жабою — тікати
    const foeImm=foe.invulnT>0||foe.untargT>0;      // Divine Shield / крізь тіні — бити марно
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
    // від бурі клинків, аури демона й невразливого ворога — геть
    if((foe.stormT>0||foe.metaT>0||foeImm)&&dist<240&&Math.random()<[0.3,0.65,0.9][sk]){ mv=-dir; if(this.x<200||this.x>WORLD_W-200) mv=0; }
    // зведена пастка ворога попереду — перестрибнути
    if(mv===dir&&this.onGround&&game.traps.some(t=>t.owner===foe&&t.arm<=0&&(t.x-this.x)*dir>0&&Math.abs(t.x-this.x)<90)&&Math.random()<[0.2,0.5,0.8][sk]) this.aiJump=true;
    this.aiMove=mv;

    // форма друїда: лікуватися — у гуманоїді, битися — у формі
    if(this.formDef && this.formCd<=0 && !this.casting){
      const healReady=this.forms.base.cds[1]<=0;
      if(this.form==='alt'){
        if(hpF<0.4 && healReady && Math.random()<[0.25,0.55,0.85][sk]){ this.shapeshift(game); return; }
      } else if(!(hpF<0.5 && healReady) && Math.random()<[0.3,0.6,0.9][sk]){ this.shapeshift(game); return; }
    }

    // ультимейт — у слушний для свого спеку момент (ULT_AI)
    if(this.meter>=ULT_MAX&&Math.random()<[0.2,0.4,0.7][sk]&&!foeImm){
      const ok=ULT_AI[this.cls.id+'/'+this.spec.name];
      if((!ok||ok(this,foe,dist,hpF))&&this.useUlt(game)) return;
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
      if((foeImm||foe.sleepT>0)&&!['heal','shield','buff','trap'].includes(a.type)) return;   // сплячого не будити — час на пастку й позицію
      let s=0;
      const reach=(a.range||95)+foe.w/2;
      switch(a.type){
        case 'heal': s=hpF<0.5?90+(0.5-hpF)*200:0; if(melee===false&&dist<160) s*=0.5;
          if(hpF<0.85&&(foe.hexT>0||foe.freezeT>0||foe.mcT>0||foe.stunT>0.8)) s=Math.max(s,85);   // ворог вимкнений — час лікуватися
          break;
        case 'shield': s=hpF<0.75&&dist<400?65:0; break;
        case 'buff':
          if(a.disperse) s=(hpF<0.55?80:0)+(dist<130&&(this.x<280||this.x>WORLD_W-280)?70:0); // притиснули до стіни — пройти крізь
          else if(a.feather) s=!melee&&dist<200?75:(melee&&dist>320?50:0);
          else if(a.instantCast) s=this.pomT<=0&&this.abilities.some((b,j)=>b.cast&&this.cds[j]<=0)?70:0; // заряд — лише під готовий каст
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
          if(a.cast) s=this.pomT>0?95:(foeOpen?90:(dist>260?55:15));
          else if(a.chan) s=dist<170&&!foeOpen?8:(foeOpen||foe.rootT>0?85:60); // канал упритул — зіб'ють
          else s=dist>130?(foeBlocking?30:65):20;
          break;
        case 'curse': s=dist>(a.range||SPELL_RANGE)?0:(foe.dots.some(d=>d.name===a.name&&d.t>1.5)?0:(a.dmg?55:50));
          if(a.stun) s=foe.stunT>0?0:(dist<(a.range||SPELL_RANGE)?72:0);
          if(a.slow&&!a.dot) s=foe.slowT>0?0:(melee&&dist>180?70:(!melee&&dist<260?70:20));
          if(a.cast&&dist<150&&!foeOpen) s=10; // каст упритул зіб'ють
          if(a.root&&foe.rootT>0) s=0;
          if(a.fear) s=foe.fearT>0||dist>SPELL_RANGE?0:(dist<320?(dist<150&&!foeOpen?40:80):30);
          if(a.sleep) s=foe.sleepT>0||foe.freezeT>0||foe.stunT>0||dist>(a.range||SPELL_RANGE)?0:(foe.preferRange<200?(dist<330?85:35):(foe.casting?85:45));
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
        case 'trap': // пастка — під ноги, коли ближній бій підходить; одна на раз
          s=foe.preferRange<200?(dist>70&&dist<340?80:(dist<=70?50:0)):(dist<160?45:0);
          if(game.traps.some(t=>t.owner===this)) s*=0.25;
          break;
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
    this.setMeta(this.metaT>0);   // Metamorphosis: на час ульти — модель демона (і в гостя мережевої гри)
    sp.model=this.model;
    // крила Avenging Wrath: розкриваються за 0.35 с, згасають в останні 0.4 с; у демона — постійні кажанові
    const aw=this.wingsT>0?Math.min(1,(this.wingsDur-this.wingsT)/0.35)*Math.min(1,this.wingsT/0.4):0;
    this.model.wings=Math.max(aw,this.model.permWings||0);
    const pf=this.anim.pose.fade;
    sp.fade=this.stealthT>0?Math.min(pf,0.4):(this.dispersT>0?Math.min(pf,0.5):(this.untargT>0?Math.min(pf,0.6):pf));
    // контур-підсвітка: стани ультимейтів, далі бафи
    sp.outline=this.dispersT>0?[168,120,255]:this.invulnT>0?[255,236,150]:this.freezeT>0?[170,230,255]:this.mcT>0?[190,140,255]
      :this.metaT>0?[192,96,255]:this.berserkT>0?[255,70,40]:this.dwT>0?[255,50,40]:this.stormT>0?[255,210,80]:this.lustT>0?[255,120,60]
      :this.guardT>0?[235,245,255]:this.wingsT>0?[255,226,120]:this.buffs.dmg.t>0?[255,110,40]
      :(this.buffs.dr.t>0||this.shield>0?[90,170,255]:(this.buffs.spd.t>0||this.hasteT>0?[120,230,255]:this.ultReady()?this.ultOutline(time):null));
    sp.alpha=1;
    return sp;
  }
  // Metamorphosis: модель і аніматор демона (бʼється пазурами) на час ульти, потім — назад свої
  setMeta(on){
    if(on===!!this._metaOn) return;
    if(on){ this._metaOn={model:this.model,anim:this.anim};
      this.model=this._demon||(this._demon=demonFormModel()); this.anim=new AnimCtl(this.model.style,this.model.stance); }
    else{ const s=this._metaOn; this._metaOn=null; this.model=s.model; this.anim=s.anim; this.anim.stop(); }
    this.spr.model=this.model;
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

    // ульта заряджена — золота аура за спиною
    if(this.ultReady()) this.drawUltAura(g);
    this.drawStatesBack(g);

    // Death Wish, Metamorphosis, Berserk: боєць більшає (розростається за 0.3 с і зменшується в кінці)
    const gk=this.growT>0?1+0.16*Math.min(1,(this.growDur-this.growT)/0.3,this.growT/0.4):1;
    if(this.hexT>0) this.drawFrog(g);   // Hex: замість бійця — жаба
    else{
      if(gk!==1){ ctx.save(); ctx.translate(x,y); ctx.scale(gk,gk); ctx.translate(-x,-y); }
      const o=this._sprOut||(this._sprOut={});
      drawSprite(this.spriteState(g.time),o);
      if(gk!==1) ctx.restore();
      if(this.mirrorT>0&&o.cv) this.drawMirrors(o);
    }

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
    // оглушення: піксельні зірочки над головою (у брилі льоду — без них)
    if(this.stunT>0&&this.freezeT<=0){
      for(let i=0;i<3;i++){
        const a=g.time*4+i*2.1, sx=Math.cos(a)*22, sy=-146+Math.sin(a)*6;
        ctx.fillStyle=i%2?'#ffe27a':'#fff';
        ctx.fillRect(sx-5,sy-1.5,10,3); ctx.fillRect(sx-1.5,sy-5,3,10);
      }
    }
    ctx.restore();

    if(this.pet) drawPet(this.pet,g.time);
  }

  // стани ультимейтів за бійцем (світові координати): ангел-охоронець, стовп Спокою, вихор бурі
  drawStatesBack(g){
    const x=this.x, y=this.y, t=g.time;
    if(this.guardT>0){ // Guardian Spirit: світлі крила й німб за спиною
      const k=Math.min(1,(10-this.guardT)/0.4,this.guardT/0.5), fl=Math.sin(t*3)*0.08;
      ctx.save(); ctx.translate(x-this.facing*4,y-112); ctx.globalCompositeOperation='lighter';
      for(const s of [-1,1]){
        ctx.save(); ctx.scale(s,1); ctx.rotate(-0.2+fl);
        for(let i=0;i<5;i++){ ctx.globalAlpha=(0.5-i*0.06)*k; ctx.fillStyle=i%2?'#e8f4ff':'#ffffff';
          ctx.save(); ctx.translate(10+i*9,-4-i*7); ctx.rotate(0.35+i*0.12); ctx.fillRect(-4,-4,9,48-i*6); ctx.restore(); }
        ctx.restore();
      }
      ctx.globalAlpha=0.85*k; ctx.strokeStyle='#fff4d0'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.ellipse(0,-22,15,4.5,0,0,7); ctx.stroke();
      ctx.restore();
    }
    if(this.tranqT>0){ // Tranquility: зелений стовп світла
      const a=0.22+0.08*Math.sin(t*8);
      ctx.save(); ctx.globalCompositeOperation='lighter';
      const gr=ctx.createLinearGradient(0,y-260,0,y); gr.addColorStop(0,'rgba(125,255,138,0)'); gr.addColorStop(1,`rgba(125,255,138,${a})`);
      ctx.fillStyle=gr; ctx.fillRect(x-46,y-260,92,264); ctx.restore();
    }
    if(this.stormT>0){ // Bladestorm: вихор довкола
      ctx.save(); ctx.strokeStyle='rgba(255,226,140,.55)'; ctx.lineWidth=3;
      for(let i=0;i<2;i++){ ctx.beginPath(); ctx.ellipse(x,y-46+i*28,118-i*22,15,0,t*9+i*2,t*9+i*2+4.2); ctx.stroke(); }
      ctx.restore();
    }
  }
  // поверх спрайта — у шарі ефектів (game.js splitPost), інакше спрайт із деталей у шарі вищої роздільності їх перекриває
  drawPost(g){ ctx.save(); ctx.translate(this.x,this.y); this.drawStatesFront(g); ctx.restore(); }
  // стани поверх бійця (локальні координати: 0 — між ступнями)
  drawStatesFront(g){
    const t=g.time;
    if(this.invulnT>0){ // Divine Shield: золотий купол
      const p=0.5+0.5*Math.sin(t*6), r=70+p*3;
      ctx.save(); ctx.globalCompositeOperation='lighter';
      ctx.fillStyle=`rgba(255,226,120,${0.12+0.05*p})`; ctx.beginPath(); ctx.ellipse(0,-62,r*0.82,r,0,0,7); ctx.fill();
      ctx.strokeStyle=`rgba(255,240,170,${0.55+0.3*p})`; ctx.lineWidth=4; ctx.stroke();
      ctx.restore();
    }
    if(this.freezeT>0){ // брила льоду на весь зріст (Deep Freeze, Freezing Trap)
      const k=Math.min(1,(this.freezeDur-this.freezeT)/0.15), H=(this.h+18)*k;
      ctx.save();
      ctx.fillStyle='rgba(150,215,255,.5)'; ctx.fillRect(-34,-H,68,H+4);
      ctx.fillStyle='rgba(205,240,255,.55)';
      for(const [sx,w,hh] of [[-38,12,0.75],[-24,12,1.05],[-8,14,0.9],[8,12,1.1],[22,14,0.8]]) ctx.fillRect(sx,-H*hh,w,H*hh+4);
      ctx.fillStyle='#ffffff'; ctx.fillRect(-20,-H+8,4,H*0.5); ctx.fillRect(14,-H+16,4,H*0.35);
      ctx.strokeStyle='rgba(60,140,220,.8)'; ctx.lineWidth=2; ctx.strokeRect(-34,-H,68,H+4);
      ctx.restore();
    }
    if(this.mcT>0){ // Mind Control: фіолетовий вир над головою
      ctx.save(); ctx.translate(0,-this.h-34);
      for(let i=0;i<6;i++){ const a=t*6+i*1.05; ctx.fillStyle=i%2?'#c9a8ff':'#7a4cc8'; ctx.fillRect(Math.cos(a)*16-3,Math.sin(a)*5-3,6,6); }
      ctx.restore();
    }
    if(this.silenceT>0){ // мовчання: перекреслене коло над головою
      ctx.save(); ctx.translate(0,-this.h-56); ctx.strokeStyle='#c9a8ff'; ctx.lineWidth=4;
      ctx.beginPath(); ctx.arc(0,0,11,0,7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-8,8); ctx.lineTo(8,-8); ctx.stroke();
      ctx.restore();
    }
    if(this.bombT>0){ // Living Bomb: вогняна куля на грудях, частішає перед вибухом
      const p=0.5+0.5*Math.sin(t*(this.bombT<1?22:9)), r=8+p*5;
      ctx.save(); ctx.translate(0,-this.h*0.62); ctx.globalCompositeOperation='lighter';
      ctx.fillStyle=`rgba(255,120,40,${0.35+0.3*p})`; ctx.beginPath(); ctx.arc(0,0,r*2,0,7); ctx.fill();
      ctx.fillStyle='#ffd23a'; ctx.beginPath(); ctx.arc(0,0,r*0.7,0,7); ctx.fill();
      ctx.restore();
    }
    if(this.hauntT>0){ // Haunt: блідий дух кружляє біля голови
      const a=t*3;
      ctx.save(); ctx.translate(Math.cos(a)*30,-this.h-10+Math.sin(a*2)*8); ctx.globalAlpha=0.85;
      ctx.fillStyle='#d8f4ff'; ctx.fillRect(-6,-6,12,12); ctx.fillRect(-4,6,8,4);
      ctx.fillStyle='#1a2a3a'; ctx.fillRect(-4,-3,3,3); ctx.fillRect(1,-3,3,3);
      ctx.restore();
    }
    if(this.sleepT>0){ // Wyvern Sting: «Z» спливають над головою
      ctx.save(); ctx.fillStyle='#d8ffc0';
      for(let i=0;i<3;i++){ const ph=(t*0.8+i/3)%1, x=10+ph*20, y=-this.h-22-ph*36, z=3+i;
        ctx.globalAlpha=1-ph; ctx.fillRect(x-z,y-z,z*2,2); ctx.fillRect(x-z,y+z-2,z*2,2);
        for(let k=0;k<z;k++) ctx.fillRect(x+z-2-k*2,y-z+2+k*2,2,2); }
      ctx.restore();
    }
    if(this.drwT>0) this.drawRuneBlade(g);
  }
  // Dancing Rune Weapon: червоний рунний клинок ширяє над плечем і змахує разом із бійцем
  drawRuneBlade(g){
    const t=g.time, d=this.facing, k=Math.min(1,(10-this.drwT)/0.3,this.drwT/0.4);
    const sw=this.drwSwing>0?1-this.drwSwing/0.3:0;
    ctx.save(); ctx.translate(-d*50,-this.h*0.8+Math.sin(t*3)*5); ctx.scale(d*1.45,1.45);
    ctx.rotate(0.35+Math.sin(sw*Math.PI)*1.7);
    ctx.globalAlpha=0.92*k;
    ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.fillStyle='rgba(255,60,60,.35)'; ctx.fillRect(-8,-64,16,74); ctx.restore();
    ctx.fillStyle='#3a1418'; ctx.fillRect(-4,-60,8,56);
    ctx.fillStyle='#ff8a8a'; ctx.fillRect(-2,-58,4,52);
    ctx.fillStyle='#ffffff'; ctx.fillRect(-1,-56,1,40);
    ctx.fillStyle='#ff3a3a'; ctx.fillRect(-1,-50,2,3); ctx.fillRect(-1,-38,2,3); ctx.fillRect(-1,-26,2,3);
    ctx.fillStyle='#2a1a1a'; ctx.fillRect(-10,-6,20,5); ctx.fillStyle='#8a3a3a'; ctx.fillRect(-9,-5,18,3);
    ctx.fillStyle='#3a2a2a'; ctx.fillRect(-2,-1,4,12); ctx.fillStyle='#ff4a4a'; ctx.fillRect(-3,10,6,4);
    ctx.restore();
  }
  // Hex: піксельна жаба на місці бійця, підскакує, коли рухається
  drawFrog(g){
    const t=g.time, d=this.facing, hop=Math.abs(Math.sin(t*7))*(Math.abs(this.vx)>1?16:3);
    ctx.save(); ctx.translate(this.x,GROUND-hop); ctx.scale(d*1.7,1.7);
    ctx.fillStyle='#1a3a10'; ctx.fillRect(-15,-17,30,17);
    ctx.fillStyle='#4aa02a'; ctx.fillRect(-14,-16,28,15);
    ctx.fillStyle='#8ad04a'; ctx.fillRect(-6,-8,18,6);
    ctx.fillStyle='#3a8a20'; ctx.fillRect(-17,-6,7,6); ctx.fillRect(10,-6,7,6);
    ctx.fillStyle='#1a3a10'; ctx.fillRect(1,-24,8,8); ctx.fillRect(-9,-24,8,8);
    ctx.fillStyle='#d8ff90'; ctx.fillRect(2,-23,6,6); ctx.fillRect(-8,-23,6,6);
    ctx.fillStyle='#101010'; ctx.fillRect(5,-21,2,3); ctx.fillRect(-5,-21,2,3);
    ctx.fillStyle='#1a3a10'; ctx.fillRect(4,-10,10,1);
    ctx.restore();
  }
  // Mirror Image: напівпрозорі копії того самого кадру спрайта позаду мага
  drawMirrors(o){
    const k=Math.min(1,(6-this.mirrorT)/0.3,this.mirrorT/0.4), g=o.dst;
    g.save(); g.setTransform(1,0,0,1,0,0); g.imageSmoothingEnabled=false;
    for(let i=MIRROR_OFF.length-1;i>=0;i--){
      const dx=Math.round(-this.facing*MIRROR_OFF[i]*o.ds), a=k*(1-i*0.15);
      g.globalAlpha=0.42*a; g.drawImage(o.cv,o.dX+dx,o.dY);
      g.globalCompositeOperation='lighter'; g.globalAlpha=0.2*a; g.drawImage(o.cv,o.dX+dx,o.dY); g.globalCompositeOperation='source-over';
    }
    g.restore();
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

