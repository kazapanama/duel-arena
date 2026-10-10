"use strict";
/* ---------- Гра ---------- */
class Game{
  constructor(p1,p2){
    this.f=[p1,p2];
    this.projectiles=[]; this.zones=[]; this.particles=[]; this.floats=[]; this.delayed=[];
    this.slashes=[]; this.beams=[]; this.rings=[]; this.trails=[];
    this.marks=[]; this.fallers=[]; this.erupts=[]; this.portals=[]; this.ultFx=null; // ультимейти й портали
    this.traps=[]; this.zaps=[];   // пастки мисливця й ламані блискавки
    this.time=0; this.shake=0; this._shx=0; this._shy=0;
    this.hitstop=0; this.slowmo=0; // завмирання при влучанні, сповільнення на KO
    this.round=1; this.roundTimer=90;
    this.phase='intro'; this.phaseT=3.6; this.banner='';
    // обрана на екрані арени, випадкова, яку вже почав вантажити екран VS (state.nextArena), або нова випадкова
    const st=typeof state!=='undefined'?state:{};
    this.theme=st.arena||st.nextArena||THEMES[Math.floor(Math.random()*THEMES.length)];
    st.nextArena=null;
    this.born=performance.now();
    this.assetsReady();   // замовити картинку й набори одразу
    this.winner=null;
    this.cam={scale:1.2,x:WORLD_W/2,offX:0,offY:0,punch:0};
    this.updateCam(0);
  }
  /* Картинка арени й набори деталей обох бійців готові? Доки ні, бій не починається, а на екрані — «Завантаження»:
     раніше на мить показувалися процедурні арена й моделі, а потім їх підміняли картинки.
     Через 12 с починаємо з тим, що є (для того, що не довантажилось, — запасні процедурні) */
  assetsReady(){
    if(this._ready===this.theme) return true;
    if(Game.headless){ this._ready=this.theme; return true; }   // бій на сервері (tools/netsim.js): картинок там нема й не треба
    const sets=cutoutSetsReady(this.f.flatMap(f=>f.cutoutSets()));   // обидва виклики — завжди: вони ж і замовляють завантаження
    const ok=!arenaPending(this.theme)&&sets;
    if(ok||performance.now()-this.born>12000) this._ready=this.theme;
    return this._ready===this.theme;
  }
  drawLoading(){
    const c=ctx, t=(performance.now()-this.born)/1000;
    const what=this._ready===this.theme?'Чекаємо суперника':'Завантаження';   // гра по мережі: мої картинки готові, а суперника — ще ні
    c.save(); c.setTransform(VIEW_K,0,0,VIEW_K,0,0);
    c.fillStyle='#000'; c.fillRect(0,0,W,H);
    if(t>0.25){   // коротке очікування — просто чорний кадр, без мигання напису
      c.globalAlpha=Math.min(1,(t-0.25)*3);
      c.font='26px "Tiny5",sans-serif'; c.textAlign='center'; c.fillStyle='#c9d4e8';
      c.fillText(this.theme.name,W/2,H/2-10);
      c.font='18px "Tiny5",sans-serif'; c.fillStyle='#7f8aa0';
      c.fillText(what+'.'.repeat(1+Math.floor(t*3)%3),W/2,H/2+22);
    }
    c.restore();
  }

  /* Камера тримає обох бійців у кадрі, віддаляючись за потреби */
  updateCam(dt){
    // бійці вдвічі більші: наближена камера, віддаляється лише щоб обидва були в кадрі
    const span=Math.abs(this.f[0].x-this.f[1].x)+470;
    const ts=clamp(W/span,0.9,1.55)+this.cam.punch;
    this.cam.punch=Math.max(0,this.cam.punch-(dt||0)*0.5);
    let tx=(this.f[0].x+this.f[1].x)/2;
    const k=dt?Math.min(1,dt*4):1;
    this.cam.scale+=(ts-this.cam.scale)*k;
    this.cam.x+=(tx-this.cam.x)*k;
    const half=(W/2)/this.cam.scale;
    this.cam.x=clamp(this.cam.x,half,WORLD_W-half);
    this.cam.offX=W/2-this.cam.x*this.cam.scale;
    this.cam.offY=(H-128)-GROUND*this.cam.scale; // земля вище: під нею — панелі здібностей
  }
  other(f){ return this.f[f===this.f[0]?1:0]; }
  after(t,fn){ this.delayed.push({t,fn}); }
  float(x,y,txt,color,size=17){ this.floats.push({x,y,txt,color,size,t:1}); }
  // число шкоди: удари по одній цілі впродовж 0.35 с зливаються в одне число
  dmgFloat(f,n,color,big){
    const last=f._lastFloat;
    if(last&&last.t>0.62&&this.floats.includes(last)&&last.color===color){
      last.val+=n; last.txt=`${last.val}`; last.size=Math.min(34,last.size+2); last.t=1; return;
    }
    const fl={x:f.x+rnd(-12,12),y:f.y-f.h-14,txt:`${n}`,val:n,color,size:big?26:19,t:1};
    this.floats.push(fl); f._lastFloat=fl;
  }
  // попередження «не парирується»: золота зірка-відблиск на час замаху
  tell(x,y,dur){ this.tells=this.tells||[]; this.tells.push({x,y,t:Math.max(0.2,dur+0.05),T:Math.max(0.2,dur+0.05)}); sfx('cast'); }
  // іскри в точці удару
  spark(x,y,dir,col,heavy){
    const n=heavy?16:9;
    for(let i=0;i<n;i++){ const a=rnd(-1.1,1.1)+(dir>0?0:Math.PI), sp=rnd(160,heavy?520:360);
      this.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-60,t:rnd(.12,.3),color:i%3?col:'#ffffff',size:rnd(3,heavy?8:6),g:600}); }
    this.rings.push({x,y,r:heavy?46:28,t:0.2,color:'#ffffff'});
  }
  burst(x,y,color,n){ for(let i=0;i<n;i++){ const a=rnd(0,7), s=rnd(60,260); this.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-80,t:rnd(.3,.7),color,size:rnd(2,5)}); } }
  slash(x,y,dir,color,kind){ const T=kind==='heavy'?0.3:0.22; this.slashes.push({x,y,dir,t:T,T,color,kind:kind||'atkA'}); }
  beam(x1,y1,x2,y2,color){ this.beams.push({x1,y1,x2,y2,t:0.25,color}); }
  ring(x,y,r,color){ this.rings.push({x,y,r,t:0.35,color}); }
  trail(x1,x2,y,color){ this.trails.push({x1,x2,y,t:0.25,color}); }
  // позначка на землі: сюди за T секунд прилетить ультимейт — тікай із кола
  mark(x,r,T,color){ this.marks.push({x,r,t:T,T,color}); }
  // предмет із неба (молот, метеор, інфернал): летить T секунд від (x0,y0) до землі в x1, потім onHit
  fall(kind,x0,y0,x1,T,color,onHit){ this.fallers.push({kind,x0,y0,x1,x:x0,y:y0,t:0,T,color,onHit}); }
  erupt(x){ this.erupts.push({x,t:0.7,T:0.7}); }                 // гуль виривається з-під землі
  portal(x,y,color){ this.portals.push({x,y,t:0.55,T:0.55,color}); }
  // зачепити пета суперника att: удар чи вибух по області x±r
  splashPet(att,x,r,dmg){ const foe=this.other(att), p=foe.pet; if(p&&Math.abs(p.x-x)<r+20) foe.hurtPet(dmg,this,att); }
  zap(x1,y1,x2,y2,color){ this.zaps.push({x1,y1,x2,y2,t:0.22,T:0.22,color,seed:1+Math.floor(Math.random()*99999)}); }   // ламана блискавка
  // Explosive Shot: заряд на цілі вибухає ще кілька разів
  boom(owner,foe,B,k){
    for(let n=1;n<=B.n;n++) this.after(n*B.every,()=>{
      if(!foe.alive||this.phase!=='fight') return;
      const x=foe.x, y=foe.y-foe.h*0.5;
      this.ring(x,y,70,'#ff9440'); this.burst(x,y,'#ffb03a',14); this.shake=Math.max(this.shake,4);
      foe.takeDamage(B.dmg*k,owner,this,{unblockable:true});   // відкладені вибухи — звичайна сила, як тіки: самі по собі не перебивають сильне
    });
  }
  smoke(x,y){ for(let i=0;i<16;i++){ const a=rnd(0,7), s=rnd(20,90); this.particles.push({x:x+rnd(-14,14),y:y+rnd(-40,40),vx:Math.cos(a)*s,vy:Math.sin(a)*s-30,t:rnd(.3,.6),color:i%3?'#3a3448':'#6a5a8a',size:rnd(4,8),g:-40}); } }
  dust(x,y){ for(let i=0;i<8;i++){ const d=i<4?-1:1; this.particles.push({x:x+d*rnd(4,16),y:y-2,vx:d*rnd(40,110),vy:-rnd(10,60),t:rnd(.25,.45),color:'#b8a890',size:rnd(3,6),g:120}); } }

  spawnProj(owner,a,x,y,dir,dmgM){
    this.projectiles.push({
      x,y,vx:dir*a.speed*PROJ_SPEED,dmg:a.dmg*dmgM,dmgM,color:a.pcolor||owner.color,size:a.psize||10,
      slot:owner.abilities.indexOf(a), tier:abilityTier(a,owner.abilities.indexOf(a)), school:PROJ_SCHOOL[a.name]||null,
      owner,riders:{stun:a.stun,slow:a.slow,dot:a.dot,healFrac:a.healFrac,selfHeal:a.selfHeal,aoeOnHit:a.aoeOnHit,
        boom:a.boom,exec:a.exec,unblock:a.unblock,knockback:a.knockback,haunt:a.haunt},
      kind:owner.model.style==='bow'?'arrow':(a.name==='Deadly Throw'?'knife':'orb'),
    });
  }

  onKO(f){
    if(this.phase!=='fight') return;
    this.hitstop=0.18; this.slowmo=1.1; this.cam.punch=0.12; this.koFlash=1.3; // фінальний удар — драматично
    const winner=this.other(f);
    winner.roundWins++;
    this.endRound(winner);
  }

  endRound(winner){
    this.phase='roundEnd'; this.phaseT=2.4;
    this.banner=winner?`${winner.cls.name} перемагає раунд!`:'Нічия у раунді!';
    if(winner&&!winner.ko) winner.anim.play('victory');
    this.shake=8;
  }

  nextRound(){
    if(this.f[0].roundWins>=2||this.f[1].roundWins>=2){
      this.phase='matchEnd';
      this.winner=this.f[0].roundWins>=2?this.f[0]:this.f[1];
      showOverlay(this.winner);
      return;
    }
    this.round++;
    this.roundTimer=90;
    this.projectiles=[]; this.zones=[]; this.delayed=[];
    this.marks=[]; this.fallers=[]; this.erupts=[]; this.portals=[]; this.ultFx=null; this.traps=[]; this.zaps=[];
    this.f[0].reset(WORLD_W/2-START_GAP,1); this.f[1].reset(WORLD_W/2+START_GAP,-1);
    this.phase='intro'; this.phaseT=3.6;
    sfx('round');
  }

  update(dt){
    if(!this.assetsReady()) return;
    if(!this._rang){ this._rang=true; sfx('round'); }   // гонг раунду — коли все завантажилось і почався відлік
    this.shake=Math.max(0,this.shake-dt*30);
    this.koFlash=Math.max(0,(this.koFlash||0)-dt);
    if(this.ultFx){ this.ultFx.t-=dt; if(this.ultFx.t<=0) this.ultFx=null; }   // банер ультимейта йде й під час кінопаузи
    // хітстоп: увесь світ завмирає на кілька кадрів після влучання
    if(this.hitstop>0){ this.hitstop-=dt; this.updateCam(dt); return; }
    if(this.slowmo>0){ this.slowmo-=dt; dt*=0.3; }
    this.time+=dt;

    if(this.phase==='intro'){
      this.phaseT-=dt;
      if(this.phaseT<=0){ this.phase='fight'; }
    } else if(this.phase==='roundEnd'){
      this.phaseT-=dt;
      if(this.phaseT<=0) this.nextRound();
    } else if(this.phase==='fight'){
      this.roundTimer-=dt;
      if(this.roundTimer<=0){
        const a=this.f[0].hp/this.f[0].maxHp, b=this.f[1].hp/this.f[1].maxHp;
        const w=a===b?null:(a>b?this.f[0]:this.f[1]);
        if(w) w.roundWins++;
        this.endRound(w);
      }
    }

    // відкладені дії
    for(const d of this.delayed){ d.t-=dt; if(d.t<=0){ d.fn(); d.done=true; } }
    this.delayed=this.delayed.filter(d=>!d.done);

    for(const f of this.f) f.update(dt,this);

    // снаряди
    for(const p of this.projectiles){
      p.x+=p.vx*dt;
      // слід
      if(Math.random()<0.5) this.particles.push({x:p.x,y:p.y,vx:rnd(-20,20),vy:rnd(-20,20),t:0.25,color:p.color,size:2});
      const foe=this.other(p.owner), pt=foe.pet;
      // снаряд, пролітаючи крізь пета, ранить його й летить далі (пет — не живий щит)
      if(pt&&p.petHit!==pt&&Math.abs(p.x-pt.x)<22+p.size&&p.y>GROUND-PET_DEFS[pt.kind].h*PET_DEFS[pt.kind].scale-p.size){
        p.petHit=pt; foe.hurtPet(p.dmg,this,p.owner); this.burst(p.x,p.y,p.color,6);
      }
      if(foe.alive && Math.abs(p.x-foe.x)<foe.w/2+p.size && p.y>foe.y-foe.h-p.size && p.y<foe.y+p.size){
        p.dead=true;
        const R=p.riders;
        const dmg=p.dmg+(R.exec?(foe.maxHp-foe.hp)*R.exec*p.dmgM:0);   // Kill Shot: тим більше, що менше в цілі здоровʼя
        const dealt=foe.takeDamage(dmg,p.owner,this,{tier:p.tier,stun:R.stun,slow:R.slow,dot:R.dot,unblockable:R.unblock,knockback:R.knockback});
        if(p.slot===0&&dealt>0&&!foe.lastBlocked) p.owner.cancelT=CANCEL_WIN;   // влучний легкий — вікно скасування
        if(R.healFrac) p.owner.healSelf(dealt*R.healFrac,this,true);
        if(R.selfHeal) p.owner.healSelf(R.selfHeal,this,true);
        if(R.aoeOnHit) this.ring(p.x,p.y,R.aoeOnHit,p.color);
        if(R.boom&&foe.invulnT<=0&&foe.untargT<=0) this.boom(p.owner,foe,R.boom,p.dmgM);
        if(R.haunt&&foe.invulnT<=0&&foe.untargT<=0){ foe.hauntT=R.haunt; foe.hauntSrc=p.owner; this.float(foe.x,foe.y-foe.h-30,'Мара!','#c8f0ff',16); }
        if(R.exec) this.shake=Math.max(this.shake,8);
        this.burst(p.x,p.y,p.color,10);
      }
      if(p.x<-40||p.x>WORLD_W+40) p.dead=true;
    }
    this.projectiles=this.projectiles.filter(p=>!p.dead);

    // зони
    for(const z of this.zones){
      z.t-=dt;
      const foe=this.other(z.owner);
      const zp=foe.pet;   // зона палить і пета
      if(zp&&Math.abs(zp.x-z.x)<z.r){ z.pacc=(z.pacc||0)+z.dps*dt; if(z.pacc>=14){ foe.hurtPet(z.pacc,this,z.owner); z.pacc=0; } }
      if(foe.alive && Math.abs(foe.x-z.x)<z.r){
        z.acc+=z.dps*dt;
        if(z.acc>=14){ const n=Math.round(z.acc); z.acc=0;
          foe.takeDamage(n,z.owner,this,{silent:true,slow:z.slow,dotTick:true,unblockable:true}); }
      }
    }
    this.zones=this.zones.filter(z=>z.t>0);

    // пастки: зведена пастка заморожує ворога, що на неї ступив (стрибок над нею — проходить)
    for(const tr of this.traps){
      tr.t-=dt; tr.arm-=dt;
      const foe=this.other(tr.owner);
      if(tr.arm<=0&&this.phase==='fight'&&foe.alive&&Math.abs(foe.x-tr.x)<tr.r+foe.w*0.3&&foe.y>GROUND-24&&foe.untargT<=0&&foe.invulnT<=0){
        tr.t=0; this.burst(tr.x,GROUND-20,'#d8f4ff',24); this.ring(tr.x,GROUND-30,80,'#aee8ff'); sfx('cast');
        if(!foe.ccImmune()){
          foe.freezeT=tr.freeze; foe.freezeDur=tr.freeze; foe.freezeBrk=true; foe.stunT=Math.max(foe.stunT,tr.freeze);
          foe.casting=null; foe.windup=null; foe.blocking=false; foe.kbV=0; foe.tranqT=0;
          this.float(foe.x,foe.y-foe.h-34,'Замерзло!','#aee8ff',16);
        }
      }
    }
    this.traps=this.traps.filter(t=>t.t>0);
    for(const z of this.zaps) z.t-=dt; this.zaps=this.zaps.filter(z=>z.t>0);

    // ультимейти: позначки, падіння з неба, гулі, портали
    for(const m of this.marks) m.t-=dt; this.marks=this.marks.filter(m=>m.t>0);
    for(const f of this.fallers){
      f.t+=dt; const k=Math.min(1,f.t/f.T);
      f.x=f.x0+(f.x1-f.x0)*k; f.y=f.y0+(GROUND-30-f.y0)*k*k;
      if(k>=1){ f.done=true; f.onHit(); }
    }
    this.fallers=this.fallers.filter(f=>!f.done);
    for(const e of this.erupts) e.t-=dt; this.erupts=this.erupts.filter(e=>e.t>0);
    for(const q of this.portals) q.t-=dt; this.portals=this.portals.filter(q=>q.t>0);

    // частинки та ефекти
    for(const p of this.particles){ p.t-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=(p.g??400)*dt; }
    this.particles=this.particles.filter(p=>p.t>0);
    for(const s of this.slashes) s.t-=dt; this.slashes=this.slashes.filter(s=>s.t>0);
    for(const b of this.beams) b.t-=dt; this.beams=this.beams.filter(b=>b.t>0);
    for(const r of this.rings) r.t-=dt; this.rings=this.rings.filter(r=>r.t>0);
    for(const tr of this.trails) tr.t-=dt; this.trails=this.trails.filter(t=>t.t>0);
    if(this.tells){ for(const t of this.tells) t.t-=dt; this.tells=this.tells.filter(t=>t.t>0); }
    for(const fl of this.floats){ fl.t-=dt*0.8; fl.y-=40*dt; }
    this.floats=this.floats.filter(f=>f.t>0);

    this.updateCam(dt);
  }

  /* ---------- Рендер ---------- */
  // світ → екран (повна роздільність)
  toScreen(x,y){ return {x:this.cam.offX+this._shx+x*this.cam.scale, y:this.cam.offY+this._shy+y*this.cam.scale}; }

  draw(){
    if(!this.assetsReady()||this.waitPeer) return this.drawLoading();   // waitPeer — мережа: сервер ще не почав бій (net.js)
    const main=ctx, hd=!GFX.fast;
    if(hd){ HDL.ctx.setTransform(1,0,0,1,0,0); HDL.ctx.clearRect(0,0,W,H);
      SPR_HD.ctx=HDL.ctx; SPR_HD.k=PIX; }   // бійці з растрових деталей — у повній роздільності
    this._post=false;
    this._bgImg=drawArenaImage(this,main);        // картинка арени — одразу на екран, світ (LOW) поверх із прозорістю
    if(this._bgImg){ LOW.ctx.setTransform(1,0,0,1,0,0); LOW.ctx.clearRect(0,0,LOW.cv.width,LOW.cv.height); }
    ctx=LOW.ctx;
    ctx.setTransform(1/PIX,0,0,1/PIX,0,0);
    ctx.imageSmoothingEnabled=false;
    this.drawWorld();
    if(this._post) LOW.ctx.restore();    // камеру на LOW закрито не було — ефекти після бійців пішли в POST
    SPR_HD.ctx=null;
    ctx=main;
    ctx.save();
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(LOW.cv,0,0,W,H);
    if(hd) ctx.drawImage(HDL.cv,0,0,W,H);
    if(this._post) ctx.drawImage(POST.cv,0,0,W,H);
    ctx.restore();
    this.drawOverlay();
    this.drawHUD();
    this.drawBanners();
  }

  // ефекти, що малюються після бійців, — в окремий низький шар POST, який кладеться поверх шару бійців із деталей
  splitPost(){
    const T=ctx.getTransform(), g=POST.ctx;
    g.setTransform(1/PIX,0,0,1/PIX,0,0); g.clearRect(0,0,W,H); g.imageSmoothingEnabled=false;
    g.save(); g.setTransform(T);
    ctx=g; this._post=true;
  }
  drawWorld(){
    const shx=this.shake>0?rnd(-this.shake,this.shake):0;
    const shy=this.shake>0?rnd(-this.shake,this.shake):0;
    this._shx=shx; this._shy=shy;
    // небо, гори, земля, смолоскипи — піксельні шари (arena.js)
    drawArenaBG(this,shx,shy);

    // світ — через камеру
    ctx.save();
    ctx.translate(this.cam.offX+shx,this.cam.offY+shy);
    ctx.scale(this.cam.scale,this.cam.scale);

    // зони
    for(const z of this.zones){
      ctx.save();
      ctx.globalAlpha=0.28+Math.sin(this.time*8)*0.06;
      ctx.fillStyle=z.color;
      ctx.beginPath(); ctx.ellipse(z.x,GROUND+4,z.r,16,0,0,7); ctx.fill();
      ctx.globalAlpha=0.5;
      ctx.strokeStyle=z.color; ctx.lineWidth=2;
      ctx.beginPath(); ctx.ellipse(z.x,GROUND+4,z.r,16,0,0,7); ctx.stroke();
      // іскри вгору
      ctx.globalAlpha=0.7;
      for(let i=0;i<3;i++){
        const sx=z.x+rnd(-z.r,z.r);
        ctx.fillRect(sx,GROUND-rnd(0,50),2,6);
      }
      ctx.restore();
    }

    // залп: стріли сиплються в зону
    for(const z of this.zones) if(z.kind==='arrows'){
      ctx.save(); ctx.strokeStyle='#d8e8ff'; ctx.fillStyle='#ffffff'; ctx.lineWidth=2;
      for(let i=0;i<9;i++){
        const ph=(this.time*1.7+i*0.37)%1, ax=z.x+((i*53)%(z.r*2))-z.r+ph*30, ay=GROUND-260+ph*262;
        ctx.globalAlpha=Math.min(1,(1-ph)*4);
        ctx.beginPath(); ctx.moveTo(ax-10,ay-26); ctx.lineTo(ax,ay); ctx.stroke();
        ctx.fillRect(ax-1.5,ay-2,4,4);
      }
      ctx.restore();
    }
    // Magma Totem — тотем із вогняним вінцем; Hurricane — вихор
    for(const z of this.zones){
      if(z.kind==='magma'){
        ctx.save(); ctx.translate(z.x,GROUND);
        ctx.fillStyle='#2a1a10'; ctx.fillRect(-9,-58,18,60);
        ctx.fillStyle='#6a3a1a'; ctx.fillRect(-7,-56,14,56);
        ctx.fillStyle='#8a4a22'; ctx.fillRect(-7,-30,14,3); ctx.fillRect(-7,-14,14,3);
        ctx.fillStyle='#ff7733'; ctx.fillRect(-5,-47,4,4); ctx.fillRect(1,-47,4,4); ctx.fillRect(-4,-38,8,3);
        ctx.fillStyle='#ffb03a';
        for(let i=0;i<5;i++){ const f=Math.abs(Math.sin(this.time*14+i*1.7)); ctx.fillRect(-11+i*5,-64-f*10,4,8+f*6); }
        ctx.restore();
      } else if(z.kind==='storm'){
        ctx.save(); ctx.strokeStyle='rgba(220,240,255,.55)'; ctx.lineWidth=3;
        for(let i=0;i<4;i++){ const yy=GROUND-20-i*38, rr=z.r*(0.35+i*0.22);
          ctx.beginPath(); ctx.ellipse(z.x,yy,rr,10+i*3,0,this.time*7+i,this.time*7+i+4.5); ctx.stroke(); }
        ctx.fillStyle='#ffffff';
        for(let i=0;i<6;i++){ const a=this.time*5+i; ctx.fillRect(z.x+Math.cos(a)*z.r*0.7,GROUND-30-((this.time*90+i*40)%150),3,3); }
        ctx.restore();
      } else if(z.kind==='dnd'){ // Death and Decay: темна земля, з неї здіймаються зелені вогники й черепи
        ctx.save();
        ctx.globalAlpha=0.55; ctx.fillStyle='#1a0e1e'; ctx.beginPath(); ctx.ellipse(z.x,GROUND+4,z.r*0.95,13,0,0,7); ctx.fill();
        for(let i=0;i<7;i++){
          const ph=(this.time*0.8+i*0.37)%1, x=z.x+Math.sin(i*2.7)*z.r*0.75, y=GROUND-ph*90;
          ctx.globalAlpha=(1-ph)*0.9;
          if(i%3===0){ // череп
            ctx.fillStyle='#b8ffb0'; ctx.fillRect(x-4,y-4,8,6); ctx.fillRect(x-3,y+2,6,2);
            ctx.fillStyle='#1a0e1e'; ctx.fillRect(x-3,y-2,2,2); ctx.fillRect(x+1,y-2,2,2);
          } else { ctx.fillStyle=i%2?'#6aff5a':'#8a5cff'; ctx.fillRect(x-2,y-2,4,4); }
        }
        ctx.restore();
      }
    }
    // пастки: зубчаста основа з крижаним ядром; зведена — світиться
    for(const tr of this.traps){
      const armed=tr.arm<=0, p=0.5+0.5*Math.sin(this.time*6);
      ctx.save(); ctx.translate(tr.x,GROUND+2); ctx.globalAlpha=armed?0.95:0.5;
      ctx.fillStyle='#2a3a4a'; ctx.fillRect(-18,-5,36,6);
      ctx.fillStyle='#8a9aaa'; for(let i=-16;i<=12;i+=7) ctx.fillRect(i,-10,3,6);
      ctx.fillStyle=armed?`rgba(174,232,255,${0.5+0.4*p})`:'#5a7a9a'; ctx.fillRect(-4,-9,8,5);
      if(armed){ ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=0.22*p; ctx.fillStyle='#aee8ff'; ctx.beginPath(); ctx.ellipse(0,0,tr.r,8,0,0,7); ctx.fill(); }
      ctx.restore();
    }
    // позначки ультимейтів: коло пульсує, внутрішнє кільце стискається до удару
    for(const m of this.marks){
      const k=m.t/m.T, pulse=0.5+Math.sin(this.time*18)*0.5;
      ctx.save();
      ctx.globalAlpha=0.18+(1-k)*0.3; ctx.fillStyle=m.color;
      ctx.beginPath(); ctx.ellipse(m.x,GROUND+4,m.r,15,0,0,7); ctx.fill();
      ctx.globalAlpha=0.6+pulse*0.4; ctx.strokeStyle=m.color; ctx.lineWidth=3;
      ctx.beginPath(); ctx.ellipse(m.x,GROUND+4,m.r,15,0,0,7); ctx.stroke();
      ctx.globalAlpha=0.9; ctx.strokeStyle='#ffffff'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.ellipse(m.x,GROUND+4,Math.max(4,m.r*k),Math.max(2,15*k),0,0,7); ctx.stroke();
      ctx.restore();
    }
    // портали (Blink, Demonic Circle, поява петів): вертикальний овал відкривається й закривається
    for(const q of this.portals){
      const k=1-q.t/q.T, open=k<0.35?k/0.35:(k>0.7?(1-k)/0.3:1);
      ctx.save(); ctx.globalCompositeOperation='lighter';
      ctx.strokeStyle=q.color; ctx.lineWidth=5; ctx.globalAlpha=0.9;
      ctx.beginPath(); ctx.ellipse(q.x,q.y-58,22*open,58*open,0,0,7); ctx.stroke();
      ctx.lineWidth=2; ctx.strokeStyle='#ffffff'; ctx.beginPath(); ctx.ellipse(q.x,q.y-58,13*open,46*open,0,0,7); ctx.stroke();
      ctx.fillStyle=q.color; ctx.globalAlpha=0.25*open; ctx.beginPath(); ctx.ellipse(q.x,q.y-58,20*open,56*open,0,0,7); ctx.fill();
      for(let i=0;i<6;i++){ const a=this.time*7+i*1.05; ctx.globalAlpha=open; ctx.fillRect(q.x+Math.cos(a)*22*open-2,q.y-58+Math.sin(a)*58*open-2,4,4); }
      ctx.restore();
    }
    // гулі виривають із землі: рука з пазурами піднімається й ховається
    for(const e of this.erupts){
      const k=1-e.t/e.T, up=k<0.3?k/0.3:(k>0.7?(1-k)/0.3:1), h=70*up;
      ctx.save();
      ctx.fillStyle='#3a2e22'; ctx.beginPath(); ctx.ellipse(e.x,GROUND+3,30,8,0,0,7); ctx.fill();
      ctx.fillStyle='#8a9a72'; ctx.fillRect(e.x-7,GROUND-h,14,h);
      ctx.fillStyle='#5a6a4a'; ctx.fillRect(e.x-7,GROUND-h,4,h);
      for(let i=-1;i<=1;i++){ ctx.fillStyle='#e4dcc4'; ctx.fillRect(e.x+i*6-1.5,GROUND-h-14,3,14); }
      ctx.fillStyle='#7cff6b'; ctx.globalAlpha=0.5*up; ctx.fillRect(e.x-12,GROUND-h-4,24,4);
      ctx.restore();
    }

    // сліди ривків
    for(const t of this.trails){
      ctx.save(); ctx.globalAlpha=t.t*3;
      ctx.strokeStyle=t.color; ctx.lineWidth=16; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(t.x1,t.y); ctx.lineTo(t.x2,t.y); ctx.stroke();
      ctx.restore();
    }

    // бійці
    for(const f of this.f) f.draw(this);
    if(SPR_HD.ctx) this.splitPost();   // без шару повної роздільності ефекти й так лягають на LOW поверх бійців
    for(const f of this.f) f.drawPost(this);   // стани ультимейтів поверх бійців

    // промені
    for(const b of this.beams){
      ctx.save(); ctx.globalAlpha=b.t*3.5;
      ctx.strokeStyle=b.color; ctx.lineWidth=4;
      ctx.setLineDash([10,8]); ctx.lineDashOffset=-this.time*120;
      ctx.beginPath(); ctx.moveTo(b.x1,b.y1); ctx.lineTo(b.x2,b.y2); ctx.stroke();
      ctx.restore();
    }

    // ламані блискавки (Chain Lightning): форма мерехтить, але однакова в межах кадру
    for(const z of this.zaps){
      let s=z.seed+Math.floor(this.time*30)*7919;
      const r=()=>{ s=(s*16807)%2147483647; return (s%1000)/1000-0.5; };
      const pts=[[z.x1,z.y1]];
      for(let i=1;i<7;i++){ const k=i/7; pts.push([z.x1+(z.x2-z.x1)*k+r()*20,z.y1+(z.y2-z.y1)*k+r()*38]); }
      pts.push([z.x2,z.y2]);
      ctx.save(); ctx.globalAlpha=Math.min(1,z.t/z.T*2); ctx.lineJoin='miter';
      for(const [w,c] of [[9,'rgba(143,208,255,.35)'],[4,z.color],[1.5,'#ffffff']]){
        ctx.strokeStyle=c; ctx.lineWidth=w; ctx.beginPath(); pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.stroke(); }
      ctx.restore();
    }
    // удари: серп (рубка) або промінь (укол)
    for(const s of this.slashes) drawSlash(s);

    // кільця AoE
    for(const r of this.rings){
      const p=1-r.t/0.35;
      ctx.save(); ctx.globalAlpha=(1-p)*0.8;
      ctx.strokeStyle=r.color; ctx.lineWidth=5;
      ctx.beginPath(); ctx.arc(r.x,r.y,r.r*p+10,0,7); ctx.stroke();
      ctx.restore();
    }

    // золоті зірки-попередження (атака, яку не можна парирувати)
    for(const t of this.tells||[]){
      const k=t.t/t.T, grow=1-k, r=18+grow*34;
      ctx.save(); ctx.translate(t.x,t.y); ctx.globalCompositeOperation='lighter';
      const g=ctx.createRadialGradient(0,0,0,0,0,r*1.2); g.addColorStop(0,'rgba(255,240,170,.9)'); g.addColorStop(1,'rgba(255,200,60,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,r*1.2,0,7); ctx.fill();
      ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=Math.min(1,k*1.6);
      ctx.fillStyle='#fffbe6'; ctx.rotate(grow*0.8);
      for(let i=0;i<4;i++){ ctx.rotate(Math.PI/2); ctx.beginPath(); ctx.moveTo(0,-r); ctx.lineTo(r*0.16,-r*0.16); ctx.lineTo(0,0); ctx.lineTo(-r*0.16,-r*0.16); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }

    // снаряди
    for(const p of this.projectiles) drawProjectile(p,this.time);
    // з неба: молот світла, метеор, інфернал
    for(const f of this.fallers) drawFaller(f,this.time);

    // частинки
    for(const p of this.particles){
      ctx.globalAlpha=clamp(p.t*2.5,0,1);
      ctx.fillStyle=p.color;
      ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
    }
    ctx.globalAlpha=1;

    ctx.restore(); // shake
  }

  /* ---------- Оверлей у повній роздільності: числа шкоди, таблички, смуги касту ---------- */
  drawOverlay(){
    const toS=(x,y)=>this.toScreen(x,y);
    for(const f of this.f) f.drawOverlay(this,toS);
    ctx.textAlign='center';
    for(const f of this.floats){
      const q=toS(f.x,f.y);
      ctx.save();
      ctx.globalAlpha=clamp(f.t*1.6,0,1);
      ctx.font=`${Math.round(f.size*Math.max(0.85,this.cam.scale*1.25))}px "Tiny5",sans-serif`;
      ctx.strokeStyle='rgba(0,0,0,.8)'; ctx.lineWidth=4;
      ctx.strokeText(f.txt,q.x,q.y);
      ctx.fillStyle=f.color; ctx.fillText(f.txt,q.x,q.y);
      ctx.restore();
    }
  }

  drawBanners(){
    // банери фаз
    if(this.phase==='intro'){
      const n=Math.ceil(this.phaseT-0.6);
      const txt=this.phaseT>0.6?`${n}`:'БІЙ!';
      bannerText(txt,this.phaseT>0.6?'#fff':'#ffd23a', this.phaseT>0.6?90:110);
      ctx.font='26px "Tiny5",sans-serif'; ctx.fillStyle='#c9d4e8'; ctx.textAlign='center';
      ctx.fillText(`Раунд ${this.round} · ${this.theme.name}`,W/2,H/2-90);
    }
    if(this.koFlash>0){ // великий K.O. з «ударним» наїздом
      const k=clamp((1.3-this.koFlash)/0.18,0,1);
      bannerText('K.O.!','#ff4a3a',Math.round(170-50*k));
    } else if(this.phase==='roundEnd') bannerText(this.banner,'#ffd23a',52);
    if(this.ultFx) drawUltBanner(this.ultFx);
    if(state.paused){
      ctx.fillStyle='rgba(5,8,14,.45)'; ctx.fillRect(0,0,W,H);
    }
  }

  drawHUD(){
    for(let i=0;i<2;i++){
      const f=this.f[i], left=i===0;
      const bx=left?30:W-30-460, bw=460;
      // рамка
      ctx.fillStyle='rgba(8,12,20,.75)';
      roundRect(bx-6,22,bw+12,68,10); ctx.fill();
      // hp
      const frac=f.hp/f.maxHp;
      ctx.fillStyle='#3a1010'; roundRect(bx,28,bw,22,6); ctx.fill();
      const hpw=bw*frac;
      const hg=ctx.createLinearGradient(0,28,0,50);
      hg.addColorStop(0,frac>0.35?'#5fd35f':'#e05545');
      hg.addColorStop(1,frac>0.35?'#2f8f2f':'#8f2a20');
      ctx.fillStyle=hg;
      if(hpw>2){ ctx.save(); ctx.beginPath();
        left?roundRect(bx,28,hpw,22,6):roundRect(bx+bw-hpw,28,hpw,22,6);
        ctx.fill(); ctx.restore(); }
      // прогноз DoT/HoT: скільки ще забере періодична шкода (смугаста частина заливки)
      // і скільки відхілить лікування (світла смуга за заливкою); відлік — від краю, де HP тане
      { const seg=(a,b)=>left?[bx+bw*a,bw*(b-a)]:[bx+bw*(1-b),bw*(b-a)];
        const stripes=(x,w,col,bg)=>{ if(w<1) return;
          ctx.save(); ctx.beginPath(); ctx.rect(x,28,w,22); ctx.clip();
          ctx.fillStyle=bg; ctx.fillRect(x,28,w,22);
          ctx.fillStyle=col; const off=(this.time*24)%10;
          for(let sx=x-22-off;sx<x+w+22;sx+=10){ ctx.beginPath(); ctx.moveTo(sx,50); ctx.lineTo(sx+4,50); ctx.lineTo(sx+26,28); ctx.lineTo(sx+22,28); ctx.fill(); }
          ctx.restore(); };
        const pulse=0.75+0.25*Math.sin(this.time*6);
        const dF=clamp((f.dotLeft||0)/f.maxHp,0,frac), hF=clamp((f.hotLeft||0)/f.maxHp,0,1-frac);
        if(dF>0){ const [x,w]=seg(frac-dF,frac); ctx.globalAlpha=pulse; stripes(x,w,'#c07cff','#4a1468'); ctx.globalAlpha=1;
          ctx.fillStyle='#e8d0ff'; ctx.fillRect(left?x:x+w-2,28,2,22); }   // межа: до неї HP дотягне DoT
        if(hF>0){ const [x,w]=seg(frac,frac+hF); ctx.globalAlpha=pulse*0.8; stripes(x,w,'rgba(150,255,160,.75)','rgba(40,110,50,.6)'); ctx.globalAlpha=1; }
      }
      // щит поверх
      if(f.shield>0){
        const sw=clamp(f.shield/f.maxHp,0,1)*bw;
        ctx.fillStyle='rgba(140,200,255,.65)';
        left?ctx.fillRect(bx,26,sw,4):ctx.fillRect(bx+bw-sw,26,sw,4);
      }
      ctx.strokeStyle='#0d1420'; ctx.lineWidth=2; roundRect(bx,28,bw,22,6); ctx.stroke();
      // шкала захисту (блок): тоншає від заблокованих ударів, при нулі — злам захисту
      const gw=bw*clamp(f.guard/GUARD_MAX,0,1);
      ctx.fillStyle='rgba(20,30,50,.9)'; ctx.fillRect(bx,52,bw,4);
      ctx.fillStyle=f.guard<35?'#ff8a5a':'#8fc8ff';
      left?ctx.fillRect(bx,52,gw,4):ctx.fillRect(bx+bw-gw,52,gw,4);
      // текст
      ctx.font='15px "Tiny5",sans-serif';
      ctx.textAlign=left?'left':'right'; ctx.fillStyle='#fff';
      const nm=`${f.cls.em} ${f.cls.name} · ${f.spec.name}${f.form==='alt'?' · '+f.formDef.em+' '+f.formDef.name:''}${f.isAI?' 🤖':''}`;
      ctx.fillText(nm,left?bx+2:bx+bw-2,68);
      ctx.font='13px "Tiny5",sans-serif'; ctx.fillStyle='#cfd8e8';
      ctx.textAlign=left?'right':'left';
      ctx.strokeStyle='rgba(0,0,0,.7)'; ctx.lineWidth=3; ctx.strokeText(`${Math.ceil(f.hp)}`,left?bx+bw-6:bx+6,44);
      ctx.fillText(`${Math.ceil(f.hp)}`,left?bx+bw-6:bx+6,44);
      // супершкала: заповнена — пульсує, поруч кнопка ультимейта
      { const fr=clamp(f.meter/ULT_MAX,0,1), full=fr>=1, mw=bw*0.62, mx=left?bx:bx+bw-mw, my=76;
        ctx.fillStyle='rgba(20,16,30,.95)'; ctx.fillRect(mx,my,mw,8); ctx.strokeStyle='#4a3e2a'; ctx.lineWidth=1; ctx.strokeRect(mx-0.5,my-0.5,mw+1,9);
        const g=ctx.createLinearGradient(0,my,0,my+8); g.addColorStop(0,full?'#fff4b0':'#ffd23a'); g.addColorStop(1,full?'#ffb03a':'#a8700a');
        ctx.fillStyle=g; left?ctx.fillRect(mx,my,mw*fr,8):ctx.fillRect(mx+mw*(1-fr),my,mw*fr,8);
        for(let q=1;q<4;q++){ ctx.fillStyle='rgba(8,12,20,.7)'; ctx.fillRect(mx+mw*q/4-1,my,2,8); }
        if(full){ ctx.save(); ctx.globalAlpha=0.35+Math.sin(this.time*8)*0.25; ctx.strokeStyle='#fff4b0'; ctx.lineWidth=2; ctx.strokeRect(mx-1,my-1,mw+2,10); ctx.restore(); }
        ctx.font='11px "Tiny5",sans-serif'; ctx.textAlign=left?'left':'right'; ctx.fillStyle=full?'#fff4b0':'#8b95a8';
        const usePadU=padConnected[i]&&!f.isAI, key=TOUCH.on||f.isAI?'':` · ${usePadU?'RT':(i===0?'O':'6')}`;
        ctx.fillText(full?`${ultOf(f).ua.toUpperCase()}${key}`:'УЛЬТА',left?mx+mw+8:mx-8,my+8); }
      // комбо-лічильник: «3 УДАРИ» під своєю панеллю
      if(f.combo>=2){
        const n=f.combo, pop=1+Math.max(0,f.comboT-0.85)*1.6;
        const word=n%10===1&&n%100!==11?'УДАР':(n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?'УДАРИ':'УДАРІВ');
        ctx.save(); ctx.globalAlpha=clamp(f.comboT*2.5,0,1);
        ctx.translate(left?bx+60:bx+bw-60,140); ctx.scale(pop,pop);
        ctx.textAlign='center'; ctx.lineWidth=6; ctx.strokeStyle='rgba(0,0,0,.85)';
        ctx.font='40px "Tiny5",sans-serif'; ctx.strokeText(`${n}`,0,0); ctx.fillStyle=n>=4?'#ff7a3a':'#ffd23a'; ctx.fillText(`${n}`,0,0);
        ctx.font='15px "Tiny5",sans-serif'; ctx.strokeText(word,0,18); ctx.fillStyle='#fff4d0'; ctx.fillText(word,0,18);
        ctx.restore();
      }
      // раундові перемоги
      for(let r=0;r<2;r++){
        const px=left?bx+bw+16+r*20:bx-16-r*20;
        ctx.beginPath(); ctx.arc(px,40,7,0,7);
        ctx.fillStyle=f.roundWins>r?'#ffd23a':'#26304a'; ctx.fill();
        ctx.strokeStyle='#0d1420'; ctx.stroke();
      }
      // бафи
      let bi=0;
      ctx.font='13px "Tiny5",sans-serif'; ctx.textAlign='left';
      const showB=(txt,color)=>{
        const px=left?bx+bi*64:bx+bw-64-bi*64;
        ctx.fillStyle='rgba(8,12,20,.7)'; roundRect(px,94,58,20,5); ctx.fill();
        ctx.fillStyle=color; ctx.fillText(txt,px+5,109); bi++;
      };
      if(f.buffs.dmg.t>0) showB(`⚔ ${f.buffs.dmg.t.toFixed(0)}с`,'#ffb03a');
      if(f.buffs.spd.t>0) showB(`💨 ${f.buffs.spd.t.toFixed(0)}с`,'#7de0ff');
      if(f.buffs.dr.t>0) showB(`🛡 ${f.buffs.dr.t.toFixed(0)}с`,'#9fd7ff');
      if(f.dotLeft>=1) showB(`☠ -${Math.round(f.dotLeft)}`,'#d8b0ff');
      if(f.hotLeft>=1) showB(`💚 +${Math.round(Math.min(f.hotLeft,f.maxHp-f.hp))}`,'#7dff8a');
      if(f.stealthT>0) showB(`👤 ${f.stealthT.toFixed(0)}с`,'#c9d4e8');

      // на телефоні здібності й КД показують сенсорні кнопки (touch.js) — панелі на полотні лише заважали б
      if(TOUCH.on){ ctx.textBaseline='alphabetic'; continue; }
      // панель здібностей: розкладка повторює фізичне розташування кнопок
      const abW=54, gap=8, cell=abW+gap;
      const usePad=padConnected[i]&&!f.isAI;
      // [колонка, рядок] для слотів 1-4
      const slots=usePad
        ? [[0,1],[1,0],[2,1],[1,2]]   // ромб пада: X зліва, Y зверху, B справа, A знизу
        : [[0,1],[1,1],[2,1],[1,0]];  // клавіатура: J K L (Num1-3) знизу, U (Num4) зверху
      const rows=usePad?3:2;
      const gridW=cell*3-gap, gridH=cell*rows-gap;
      const ax0=left?30:W-30-gridW;
      const ay0=H-16-gridH;
      const keysLabel=usePad?['X','Y','B','A']:(i===0?['J','K','L','U']:['1','2','3','4']);
      for(let k=0;k<4;k++){
        const a=f.abilities[k];
        const ax=ax0+slots[k][0]*cell, ay=ay0+slots[k][1]*cell;
        ctx.fillStyle='rgba(8,12,20,.8)';
        roundRect(ax,ay,abW,abW,10); ctx.fill();
        ctx.strokeStyle=k===3?'#f4c430':'#3d4a66'; ctx.lineWidth=2; // золото — класова мобільність (A)
        roundRect(ax,ay,abW,abW,10); ctx.stroke();
        const im=iconImg(a.img);
        if(im){
          ctx.save();
          roundRect(ax+3,ay+3,abW-6,abW-6,8); ctx.clip();
          ctx.drawImage(im,ax+3,ay+3,abW-6,abW-6);
          ctx.restore();
          ctx.textAlign='center'; ctx.textBaseline='middle';
        } else {
          ctx.font='25px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText(a.icon,ax+abW/2,ay+abW/2-3);
        }
        // затемнення КД
        const cd=f.cds[k];
        if(cd>0){
          const fr=cd/a.cd;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(ax+abW/2,ay+abW/2);
          ctx.arc(ax+abW/2,ay+abW/2,abW,-Math.PI/2,-Math.PI/2+fr*Math.PI*2);
          ctx.closePath(); ctx.clip();
          ctx.fillStyle='rgba(5,8,14,.78)'; roundRect(ax,ay,abW,abW,10); ctx.fill();
          ctx.restore();
          ctx.font='15px "Tiny5",sans-serif'; ctx.fillStyle='#fff';
          ctx.fillText(cd>=1?cd.toFixed(0):cd.toFixed(1),ax+abW/2,ay+abW/2);
        } else if(f.gcd>0){
          ctx.fillStyle='rgba(5,8,14,.4)'; roundRect(ax,ay,abW,abW,10); ctx.fill();
        }
        // підпис кнопки
        ctx.font='11px "Tiny5",monospace'; ctx.fillStyle='#ffd97a';
        ctx.fillText(keysLabel[k],ax+abW-9,ay+abW-9);
      }
      // плитка ультимейта — над L (у пада — над B): заповнюється разом із супершкалою, повна — пульсує золотом
      { const U=ultOf(f), fr=clamp(f.meter/ULT_MAX,0,1), full=fr>=1;
        const ux=ax0+2*cell, uy=ay0;
        if(full){ ctx.save(); ctx.globalAlpha=0.45+Math.sin(this.time*8)*0.3; ctx.fillStyle='#ffd23a';
          roundRect(ux-4,uy-4,abW+8,abW+8,13); ctx.fill(); ctx.restore(); }
        ctx.fillStyle='rgba(8,12,20,.85)'; roundRect(ux,uy,abW,abW,10); ctx.fill();
        const im=iconImg(U.img);
        ctx.textAlign='center'; ctx.textBaseline='middle';
        if(im){ ctx.save(); roundRect(ux+3,uy+3,abW-6,abW-6,8); ctx.clip(); ctx.drawImage(im,ux+3,uy+3,abW-6,abW-6); ctx.restore(); }
        else { ctx.font='25px serif'; ctx.fillText(U.icon,ux+abW/2,uy+abW/2-3); }
        if(!full){ // незаповнена частина — затемнення по колу, як відкат
          ctx.save(); ctx.beginPath(); ctx.moveTo(ux+abW/2,uy+abW/2);
          ctx.arc(ux+abW/2,uy+abW/2,abW,-Math.PI/2+fr*Math.PI*2,Math.PI*1.5); ctx.closePath(); ctx.clip();
          ctx.fillStyle='rgba(5,8,14,.72)'; roundRect(ux,uy,abW,abW,10); ctx.fill(); ctx.restore();
          ctx.font='14px "Tiny5",sans-serif'; ctx.strokeStyle='rgba(0,0,0,.85)'; ctx.lineWidth=3; ctx.fillStyle='#ffe9a0';
          ctx.strokeText(`${Math.floor(fr*100)}`,ux+abW/2,uy+abW/2); ctx.fillText(`${Math.floor(fr*100)}`,ux+abW/2,uy+abW/2);
        }
        ctx.strokeStyle=full?'#fff4b0':'#c99a2a'; ctx.lineWidth=full?3:2; roundRect(ux,uy,abW,abW,10); ctx.stroke();
        const uk=usePad?'RT':(i===0?'O':'6');
        ctx.font='11px "Tiny5",monospace'; ctx.strokeStyle='rgba(0,0,0,.85)'; ctx.lineWidth=3; ctx.fillStyle='#ffd97a';
        ctx.strokeText(uk,ux+abW-9,uy+abW-9); ctx.fillText(uk,ux+abW-9,uy+abW-9);
        ctx.font='10px "Tiny5",sans-serif'; ctx.fillStyle=full?'#fff4b0':'#8b95a8';
        ctx.fillText('УЛЬТА',ux+abW/2,uy-8); }
      // плитка блоку — світиться, коли гравець блокує
      const bkx=left?ax0+gridW+16:ax0-16-abW;
      const bky=ay0+cell;
      ctx.fillStyle=f.blocking?'rgba(30,50,40,.9)':'rgba(8,12,20,.8)';
      roundRect(bkx,bky,abW,abW,10); ctx.fill();
      ctx.strokeStyle=f.blocking?'#7dff8a':'#3d4a66'; ctx.lineWidth=f.blocking?3:2;
      roundRect(bkx,bky,abW,abW,10); ctx.stroke();
      ctx.font='24px serif'; ctx.textAlign='center';
      ctx.fillText('🛡️',bkx+abW/2,bky+abW/2-3);
      ctx.font='11px "Tiny5",monospace'; ctx.fillStyle='#ffd97a';
      if(usePad||i===0) ctx.fillText(usePad?'L1':'S',bkx+abW-11,bky+abW-9);
      else { const ax=bkx+abW-11, ay=bky+abW-13; ctx.fillRect(ax-1,ay-5,3,5); ctx.beginPath(); ctx.moveTo(ax-4,ay); ctx.lineTo(ax+5,ay); ctx.lineTo(ax+.5,ay+5); ctx.fill(); } // стрілка «вниз» (у шрифті її нема)
      ctx.font='10px "Tiny5",sans-serif'; ctx.fillStyle='#8b95a8';
      ctx.fillText('БЛОК',bkx+abW/2,bky-8);
      // плитка форми друїда: показує, у кого перетворишся
      if(f.formDef){
        const fx0=left?bkx+abW+10:bkx-abW-10, fy0=bky;
        ctx.fillStyle=f.form==='alt'?'rgba(40,60,30,.9)':'rgba(8,12,20,.8)';
        roundRect(fx0,fy0,abW,abW,10); ctx.fill();
        const im=iconImg(f.form==='base'?f.formDef.img:f.formDef.baseImg);
        if(im){ ctx.save(); roundRect(fx0+3,fy0+3,abW-6,abW-6,8); ctx.clip(); ctx.drawImage(im,fx0+3,fy0+3,abW-6,abW-6); ctx.restore(); }
        if(f.formCd>0){ ctx.fillStyle='rgba(5,8,14,.7)'; roundRect(fx0,fy0,abW,abW,10); ctx.fill(); }
        ctx.strokeStyle=f.form==='alt'?'#9dff70':'#7a8a5a'; ctx.lineWidth=2;
        roundRect(fx0,fy0,abW,abW,10); ctx.stroke();
        ctx.textBaseline='middle';
        ctx.font='11px "Tiny5",monospace'; ctx.fillStyle='#ffd97a';
        ctx.fillText(usePad?'R1':(i===0?'I':'5'),fx0+abW-9,fy0+abW-9);
        ctx.font='10px "Tiny5",sans-serif'; ctx.fillStyle='#8b95a8';
        ctx.fillText('ФОРМА',fx0+abW/2,fy0-8);
      }
      ctx.textBaseline='alphabetic';
    }
    // таймер
    ctx.font='34px "Tiny5",sans-serif'; ctx.textAlign='center';
    ctx.fillStyle='rgba(8,12,20,.75)';
    roundRect(W/2-45,20,90,48,10); ctx.fill();
    ctx.fillStyle=this.roundTimer<15?'#ff6a5a':'#fff';
    ctx.fillText(`${Math.max(0,Math.ceil(this.roundTimer))}`,W/2,56);
  }
}
Game.headless=false;   // true — бій на сервері (tools/netsim.js): без картинок і малювання

function bannerText(txt,color,size){
  ctx.save();
  ctx.font=`${size}px "Tiny5",sans-serif`;
  ctx.textAlign='center';
  ctx.strokeStyle='rgba(0,0,0,.8)'; ctx.lineWidth=8;
  ctx.strokeText(txt,W/2,H/2-20);
  ctx.fillStyle=color; ctx.fillText(txt,W/2,H/2-20);
  ctx.restore();
}


/* ---------- Ефект удару: розпечений серп або укол ---------- */
function drawSlash(s){
  const k=s.t/s.T;                 // 1 → 0
  const grow=Math.min(1,(1-k)*3.2);   // швидке розгортання
  ctx.save();
  ctx.translate(s.x,s.y);
  ctx.scale(s.dir,1);
  ctx.globalAlpha=Math.min(1,k*2.2);
  if(s.kind==='claw'){ // три паралельні сліди пазурів
    const a0=-1.2, a1=a0+2.3*grow;
    for(let i=0;i<3;i++){
      ctx.save(); ctx.translate(-12,-12+i*10);
      ctx.fillStyle=s.color;
      ctx.beginPath(); ctx.arc(0,0,36,a0,a1); ctx.arc(-4,-2,32,a1,a0,true); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#fff6c8';
      ctx.beginPath(); ctx.arc(0,0,36,a0+0.4,a1); ctx.arc(-2,-1,34.5,a1,a0+0.4,true); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  } else if(s.kind==='thrust'){
    const L=20+62*grow;
    ctx.fillStyle=s.color;
    ctx.beginPath(); ctx.moveTo(-18,-5); ctx.lineTo(L,0); ctx.lineTo(-18,5); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#fff6c8';
    ctx.beginPath(); ctx.moveTo(-10,-2); ctx.lineTo(L-8,0); ctx.lineTo(-10,2); ctx.closePath(); ctx.fill();
  } else {
    const big=s.kind==='heavy'?1.4:1;
    ctx.translate(-14,0);
    ctx.scale(big,s.kind==='atkB'?-big:big);
    const a0=-1.45, a1=a0+2.75*grow;
    ctx.fillStyle=s.color;
    ctx.beginPath(); ctx.arc(0,0,50,a0,a1); ctx.arc(-9,-5,43,a1,a0,true); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#fff6c8';
    ctx.beginPath(); ctx.arc(0,0,50,a0+0.3,a1); ctx.arc(-3,-2,47,a1,a0+0.3,true); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
