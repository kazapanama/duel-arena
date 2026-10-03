"use strict";
/* ============================================================
   ФОН ГОЛОВНОГО МЕНЮ: Темний Портал (піксель-арт, анімований)
   Сцена малюється в 427×240 і розтягується ×3 без згладжування.
   Статика (небо, гори, брама, статуї, передній план) — у кеш один раз;
   щокадру — фел-вир у брамі, блискавки, світіння, вогонь і жарини.
   ============================================================ */
const MBG={w:Math.ceil(W/3),h:Math.ceil(H/3),t:0,stat:null,bolts:[],boltT:0,embers:[],motes:[]};
MBG.cv=document.createElement('canvas'); MBG.cv.width=MBG.w; MBG.cv.height=MBG.h;
MBG.ctx=MBG.cv.getContext('2d');

// геометрія брами (у пікселях сцени)
const PT={cx:213, top:36, lintelB:62, floor:150, pilL:[116,162], pilR:[264,310], gateL:162, gateR:264, horizon:176};
const STONE={deep:'#220e0c',dark:'#3a1a16',base:'#643428',mid:'#7e4632',light:'#a8664a',hi:'#d08a5e'};

/* ---------- кам'яний блок із кладкою і світлом згори-справа (від фелу/вогню) ---------- */
function mbgStone(c,x,y,w,h,opt={}){
  c.fillStyle=STONE.dark; c.fillRect(x,y,w,h);
  c.fillStyle=STONE.base; c.fillRect(x+1,y+1,w-2,h-2);
  // тінь з лівого боку, відблиск згори
  c.fillStyle=STONE.dark; c.fillRect(x+1,y+1,Math.max(2,w*0.18|0),h-2);
  c.fillStyle=STONE.light; c.fillRect(x+1,y+1,w-2,1);
  if(!opt.plain){
    const bh=opt.brick||8;
    c.fillStyle=STONE.dark;
    for(let yy=y+bh;yy<y+h-1;yy+=bh){
      c.fillRect(x+1,yy,w-2,1);
      const off=((yy-y)/bh)%2?0:bh;
      for(let xx=x+off+3;xx<x+w-2;xx+=bh*2) c.fillRect(xx,yy-bh+1,1,bh-1);
    }
    c.fillStyle=STONE.mid;
    for(let i=0;i<w*h/40;i++){ const px=x+2+((i*37)%(w-4)), py=y+2+((i*53)%(h-4)); c.fillRect(px,py,1,1); }
  }
}
function mbgPoly(c,pts,col){ c.fillStyle=col; c.beginPath(); c.moveTo(pts[0],pts[1]); for(let i=2;i<pts.length;i+=2) c.lineTo(pts[i],pts[i+1]); c.closePath(); c.fill(); }

/* ---------- статуя в каптурі з мечем (на фасаді колони) ---------- */
function mbgStatue(c,x0,x1,y0,y1){
  const cx=(x0+x1)/2|0, w=x1-x0;
  // ніша
  c.fillStyle=STONE.deep; c.fillRect(x0+3,y0,w-6,y1-y0);
  // мантія
  mbgPoly(c,[cx-9,y0+22, cx+9,y0+22, cx+15,y1, cx-15,y1],STONE.dark);
  mbgPoly(c,[cx-7,y0+22, cx+8,y0+22, cx+13,y1-1, cx-12,y1-1],STONE.base);
  mbgPoly(c,[cx+2,y0+24, cx+8,y0+22, cx+13,y1-1, cx+6,y1-1],STONE.mid);   // освітлений бік
  c.fillStyle=STONE.dark; for(let i=0;i<4;i++) c.fillRect(cx-8+i*5,y0+34,1,y1-y0-36); // складки
  // плечі й каптур
  mbgPoly(c,[cx-12,y0+24, cx-6,y0+14, cx+6,y0+14, cx+12,y0+24],STONE.base);
  mbgPoly(c,[cx-7,y0+16, cx-6,y0+5, cx,y0, cx+6,y0+5, cx+7,y0+16],STONE.mid);
  mbgPoly(c,[cx-4,y0+15, cx-4,y0+7, cx,y0+4, cx+4,y0+7, cx+4,y0+15],STONE.deep); // темне обличчя
  // меч вістрям донизу, руки на руків'ї
  c.fillStyle=STONE.hi; c.fillRect(cx,y0+22,1,y1-y0-26);
  c.fillStyle=STONE.light; c.fillRect(cx-1,y0+22,1,y1-y0-26); c.fillRect(cx-6,y0+27,13,2);
  c.fillStyle=STONE.base; c.fillRect(cx-3,y0+22,7,5);
}

/* ---------- статичний шар ---------- */
function mbgBuildStatic(){
  const c=document.createElement('canvas'); c.width=MBG.w; c.height=MBG.h;
  const g=c.getContext('2d'); const {w,h}=MBG;
  // небо Пекельного Півострова: від темної ночі до вогняного горизонту (смуги — піксельний градієнт)
  const key=['#12060a','#1c080a','#2e0a0a','#46100b','#66180d','#8a240f','#ae3812','#d25618'];
  const N=22, sky=[];
  for(let i=0;i<N;i++){ const f=i/(N-1)*(key.length-1), a=f|0, b=Math.min(key.length-1,a+1); sky.push(hexMix(key[a],key[b],f-a)); }
  const bh=PT.horizon/N;
  for(let i=0;i<N;i++){ g.fillStyle=sky[i]; g.fillRect(0,(i*bh)|0,w,Math.ceil(bh)+1); }
  // шаховий дизер на межах смуг — м'який піксельний перехід
  for(let i=1;i<N;i++){ const y=(i*bh)|0; g.fillStyle=sky[i]; for(let x=(i%2);x<w;x+=2) g.fillRect(x,y-1,1,1); g.fillStyle=sky[i-1]; for(let x=((i+1)%2);x<w;x+=2) g.fillRect(x,y,1,1); }
  // зорі
  for(let i=0;i<70;i++){ const x=(i*97)%w, y=(i*53)%70; g.fillStyle=i%5?'#6a4a50':'#e8d8d0'; g.fillRect(x,y,1,1); }
  // смуги диму/хмар
  g.fillStyle='rgba(20,4,6,.35)';
  for(let i=0;i<6;i++){ const y=60+i*17; g.fillRect(0,y,w,2); }
  // далекі гори
  g.fillStyle='#4a120c';
  g.beginPath(); g.moveTo(0,PT.horizon);
  for(let x=0;x<=w;x+=6) g.lineTo(x,PT.horizon-18-Math.abs(Math.sin(x*0.05))*22-((x*13)%9));
  g.lineTo(w,PT.horizon); g.fill();
  g.fillStyle='#2e0a08';
  g.beginPath(); g.moveTo(0,PT.horizon);
  for(let x=0;x<=w;x+=5) g.lineTo(x,PT.horizon-6-Math.abs(Math.sin(x*0.09+1))*12-((x*7)%5));
  g.lineTo(w,PT.horizon); g.fill();
  // потріскана червона земля
  g.fillStyle='#3a1410'; g.fillRect(0,PT.horizon,w,h-PT.horizon);
  g.fillStyle='#2a0e0c'; for(let y=PT.horizon+4;y<h;y+=6) g.fillRect(0,y,w,1);
  g.fillStyle='#5a2016'; for(let i=0;i<120;i++){ g.fillRect((i*71)%w,PT.horizon+2+((i*29)%(h-PT.horizon-2)),((i%3)+2),1); }
  // далекі прапори й шипи
  for(const x of [20,44,70,356,382,404]){ g.fillStyle='#1a0808'; g.fillRect(x,PT.horizon-30,1,32); mbgPoly(g,[x+1,PT.horizon-30, x+9,PT.horizon-27, x+1,PT.horizon-23],'#5a0e0e'); }

  // ---- БРАМА ----
  // ступінчастий постамент
  mbgStone(g,70,178,286,24,{brick:6});
  mbgStone(g,88,164,250,16,{brick:6});
  mbgStone(g,104,PT.floor,218,16,{brick:6});
  // центральні сходи
  for(let i=0;i<9;i++){
    const y=PT.floor+2+i*6, half=26+i*5;
    g.fillStyle=STONE.dark; g.fillRect(PT.cx-half,y,half*2,6);
    g.fillStyle=STONE.base; g.fillRect(PT.cx-half+1,y+1,half*2-2,4);
    g.fillStyle=STONE.light; g.fillRect(PT.cx-half+1,y+1,half*2-2,1);
  }
  // шипи вздовж сходів
  for(let i=0;i<5;i++){ const y=PT.floor+8+i*10, dx=34+i*9; for(const s of [-1,1]) mbgPoly(g,[PT.cx+s*dx,y, PT.cx+s*(dx+3),y-7, PT.cx+s*(dx+5),y],STONE.hi); }
  // колони
  mbgStone(g,PT.pilL[0],PT.lintelB,PT.pilL[1]-PT.pilL[0],PT.floor-PT.lintelB,{brick:10});
  mbgStone(g,PT.pilR[0],PT.lintelB,PT.pilR[1]-PT.pilR[0],PT.floor-PT.lintelB,{brick:10});
  // різьба на зовнішніх гранях
  for(const x of [PT.pilL[0]-10,PT.pilR[1]]){ mbgStone(g,x,PT.lintelB+6,10,PT.floor-PT.lintelB-6,{brick:14}); }
  // статуї
  mbgStatue(g,PT.pilL[0]+2,PT.pilL[1]-2,PT.lintelB+10,PT.floor-2);
  mbgStatue(g,PT.pilR[0]+2,PT.pilR[1]-2,PT.lintelB+10,PT.floor-2);
  // перемичка з виступами
  mbgStone(g,106,PT.top+8,214,PT.lintelB-PT.top-8,{brick:9});
  mbgStone(g,94,PT.top,48,32,{brick:8});
  mbgStone(g,284,PT.top,48,32,{brick:8});
  // різьблені панелі з символом
  for(const x of [100,290]){ g.fillStyle=STONE.dark; g.fillRect(x+10,PT.top+8,16,16); g.fillStyle=STONE.base; g.fillRect(x+11,PT.top+9,14,14); g.fillStyle=STONE.dark; g.fillRect(x+14,PT.top+12,8,8); g.fillStyle=STONE.light; g.fillRect(x+17,PT.top+14,2,4); }
  // роги на кутах
  for(const [x,s] of [[98,-1],[328,1]]){ mbgPoly(g,[x,PT.top, x+s*4,PT.top-14, x+s*12,PT.top-26, x+s*8,PT.top-10, x+s*10,PT.top],STONE.light); mbgPoly(g,[x+s*2,PT.top, x+s*5,PT.top-12, x+s*11,PT.top-24, x+s*8,PT.top-10],STONE.hi); }
  // кігті-зубці на виступах
  for(const x0 of [110,122,300,312]) mbgPoly(g,[x0,PT.top, x0+3,PT.top-7, x0+7,PT.top-5, x0+6,PT.top],STONE.mid);
  // рогатий драконячий череп у центрі
  const sx=PT.cx, sy=PT.top+2;
  mbgPoly(g,[sx-20,sy+14, sx-16,sy-6, sx,sy-12, sx+16,sy-6, sx+20,sy+14, sx+10,sy+22, sx-10,sy+22],STONE.dark);
  mbgPoly(g,[sx-18,sy+12, sx-14,sy-4, sx,sy-10, sx+14,sy-4, sx+18,sy+12, sx+9,sy+20, sx-9,sy+20],STONE.base);
  mbgPoly(g,[sx+2,sy-9, sx+14,sy-4, sx+17,sy+10, sx+6,sy+4],STONE.mid);
  for(let i=0;i<5;i++){ const x=sx-14+i*7; mbgPoly(g,[x,sy-4, x+3,sy-20-(i===2?6:0), x+6,sy-4],i%2?STONE.light:STONE.hi); }  // гребінь
  g.fillStyle=STONE.deep; g.fillRect(sx-10,sy+3,7,4); g.fillRect(sx+3,sy+3,7,4);                  // очниці
  g.fillStyle=STONE.deep; g.fillRect(sx-9,sy+14,18,5);
  g.fillStyle=STONE.hi; for(let i=0;i<5;i++) g.fillRect(sx-8+i*4,sy+14,2,3);                       // ікла
  // ланцюги з шипастими кулями
  for(const [x,s] of [[96,-1],[330,1]]){
    for(let i=0;i<12;i++){ const cx=x+s*i*1.3, cy=PT.top+32+i*5; g.fillStyle=i%2?'#5a4a48':'#3a2e2c'; g.fillRect(cx|0,cy|0,3,4); }
    const bx=x+s*16, by=PT.top+96;
    mbgPoly(g,[bx-9,by, bx,by-9, bx+9,by, bx,by+9],'#3a2e2c');
    mbgPoly(g,[bx-7,by, bx,by-7, bx+7,by, bx,by+7],'#5a4a48');
    for(const [dx,dy] of [[0,-13],[13,0],[0,13],[-13,0],[9,-9],[-9,9]]) mbgPoly(g,[bx+dx*0.5-2,by+dy*0.5, bx+dx,by+dy, bx+dx*0.5+2,by+dy*0.5],'#6a5a58');
    g.fillStyle='#8a7a76'; g.fillRect(bx-2+s*2,by-4,2,2);
  }
  // жаровні на постаменті
  for(const x of [96,330]){ g.fillStyle=STONE.dark; g.fillRect(x-3,160,6,12); g.fillStyle=STONE.light; g.fillRect(x-4,158,8,2); }
  // передній план: силуети орків-воїнів у рамці (темні, з червоним контровим світлом)
  mbgOrcSilhouette(g,-6,h+4,1);
  mbgOrcSilhouette(g,w+6,h+4,-1);
  MBG.stat=c;
}
function mbgOrcSilhouette(g,x,y,s){
  const P=(pts)=>pts.map((v,i)=>i%2?y+v:x+s*v);
  mbgPoly(g,P([0,0, 0,-50, 10,-62, 30,-68, 46,-64, 58,-52, 66,-30, 70,0]),'#140606');   // спина й плечі
  mbgPoly(g,P([24,-66, 30,-84, 40,-90, 50,-86, 52,-70, 44,-62]),'#140606');             // голова
  mbgPoly(g,P([46,-88, 58,-104, 52,-86]),'#140606');                                     // хвіст волосся
  for(const [a,b] of [[12,-64],[24,-70],[36,-70],[50,-62]]) mbgPoly(g,P([a-3,b+2, a,b-12, a+3,b+2]),'#140606'); // шипи наплічника
  // сокира
  mbgPoly(g,P([66,-20, 88,-86, 92,-84, 70,-18]),'#140606');
  mbgPoly(g,P([84,-94, 108,-104, 112,-80, 96,-70, 86,-78]),'#140606');
  // контрове світло
  g.fillStyle='#6a1a10';
  for(const [a,b,c2,d] of [[30,-68,46,-64],[46,-64,58,-52],[40,-90,50,-86],[108,-104,112,-80]]){
    const n=12; for(let i=0;i<=n;i++){ const px=a+(c2-a)*i/n, py=b+(d-b)*i/n; g.fillRect(x+s*px|0,y+py|0,1,1); }
  }
  g.fillStyle='#9a3a18'; g.fillRect(x+s*48|0,y-80|0,2,2); // око
}

/* ---------- анімований шар ---------- */
function mbgBolt(){
  const x0=PT.gateL+6+Math.random()*(PT.gateR-PT.gateL-12), pts=[[x0,PT.lintelB+2]];
  let x=x0, y=PT.lintelB+2;
  while(y<PT.floor-4){ x+=(Math.random()-0.5)*22; y+=4+Math.random()*8; x=clamp(x,PT.gateL+2,PT.gateR-2); pts.push([x,y]); }
  return {pts,t:0.12+Math.random()*0.12,branch:Math.random()<0.5};
}
// ключовий арт меню (tools/arenas/arenas.py → img/arenas/menu.webp); поки вантажиться — процедурний Темний Портал
const MENU_ART=new Image(); MENU_ART.src='img/arenas/menu.webp';
// вир порталу на арті — частки зображення (центр і розмір арки): поверх нього крутиться фел-вихор
const ART_PORTAL={cx:0.669,cy:0.54,w:0.16,h:0.365};
function drawMenuArt(dt){
  MBG.t+=dt;
  const t=MBG.t, surge=MBG.surge=Math.max(0,(MBG.surge||0)-dt*0.9);
  const k=1.04+Math.sin(t*0.15)*0.015;                       // повільний «подих» камери
  const dw=W*k, dh=dw*MENU_ART.naturalHeight/MENU_ART.naturalWidth;
  const sh=surge>0.3?Math.round((Math.random()-0.5)*surge*10):0;
  const ox=(W-dw)/2+sh+Math.sin(t*0.11)*6, oy=(H-dh)/2-Math.abs(sh)/2;
  const px=ox+ART_PORTAL.cx*dw, py=oy+ART_PORTAL.cy*dh, pw=ART_PORTAL.w*dw, ph=ART_PORTAL.h*dh;
  const c=ctx;
  c.save(); c.setTransform(VIEW_K,0,0,VIEW_K,0,0); c.imageSmoothingEnabled=true; c.imageSmoothingQuality='high';
  c.drawImage(MENU_ART,ox,oy,dw,dh);
  c.globalCompositeOperation='lighter';
  // фел-вихор: спіральні рукави часток, що обертаються й затягуються в центр
  c.save(); c.beginPath(); c.rect(px-pw/2,py-ph/2,pw,ph); c.clip();
  const greens=['#1a5a0a','#2a8a12','#4ac01e','#8aff4a','#d8ffa0'];
  for(let i=0;i<220;i++){
    const r=((i*0.618+t*0.25)%1);                            // радіус 0..1: частка повзе до центру
    const rr=1-r, a=i*2.4+t*(1.2+rr*2.5)+rr*6;
    const x=px+Math.cos(a)*rr*pw*0.62, y=py+Math.sin(a)*rr*ph*0.55;
    c.globalAlpha=0.25+0.5*(1-rr); c.fillStyle=greens[Math.min(4,(r*5)|0)];
    const s2=2+((i%3)===0?2:0); c.fillRect(x|0,y|0,s2,s2);
  }
  c.restore();
  // пульс сяйва порталу
  const pulse=0.55+Math.sin(t*2.2)*0.18+surge*0.6;
  const gl=c.createRadialGradient(px,py,4,px,py,Math.max(pw,ph)*1.1);
  gl.addColorStop(0,`rgba(150,255,80,${0.35*pulse})`); gl.addColorStop(0.5,`rgba(70,200,30,${0.16*pulse})`); gl.addColorStop(1,'rgba(0,0,0,0)');
  c.globalAlpha=1; c.fillStyle=gl; c.fillRect(px-pw*1.6,py-ph*1.3,pw*3.2,ph*2.6);
  // фел-блискавки по краях арки
  MBG.boltT-=dt;
  if(MBG.boltT<=0){ MBG.boltT=(0.12+Math.random()*0.4)*(1-surge*0.8);
    const side=Math.random()<0.5?-1:1, y0=py-ph/2+Math.random()*ph, pts=[[px+side*pw*0.5,y0]];
    let x=pts[0][0], y=y0; for(let j=0;j<6;j++){ x+=side*(6+Math.random()*16); y+=(Math.random()-0.6)*18; pts.push([x,y]); }
    MBG.bolts.push({pts,t:0.12+Math.random()*0.1}); }
  for(const bt of MBG.bolts){ bt.t-=dt;
    c.strokeStyle='rgba(190,255,120,.85)'; c.lineWidth=3; c.beginPath(); bt.pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y)); c.stroke();
    c.strokeStyle='#ffffff'; c.lineWidth=1.2; c.stroke(); }
  MBG.bolts=MBG.bolts.filter(bt=>bt.t>0);
  // зелені іскри зі сходів порталу і жарини з лави
  if(MBG.motes.length<40&&Math.random()<0.7) MBG.motes.push({x:px+(Math.random()-0.5)*pw,y:py+ph*0.5,vy:-(20+Math.random()*40),life:2+Math.random()*2});
  for(const m of MBG.motes){ m.y+=m.vy*dt; m.x+=Math.sin(t*3+m.y*0.05)*0.4; m.life-=dt; c.globalAlpha=Math.min(1,m.life); c.fillStyle='#9aff5a'; c.fillRect(m.x|0,m.y|0,2,2); }
  MBG.motes=MBG.motes.filter(m=>m.life>0);
  if(MBG.embers.length<90&&Math.random()<0.7) MBG.embers.push({x:Math.random()*W,y:H+4,vx:(Math.random()-0.3)*24,vy:-(40+Math.random()*70),life:4+Math.random()*4,s:Math.random()<0.25?3:2});
  for(const e of MBG.embers){ e.x+=e.vx*dt+Math.sin(t*2+e.y*0.03)*0.3; e.y+=e.vy*dt; e.life-=dt;
    c.fillStyle=e.life>2?'#ffb03a':'#b8401a'; c.globalAlpha=Math.min(1,e.life)*0.8; c.fillRect(e.x|0,e.y|0,e.s,e.s); }
  c.globalAlpha=1; MBG.embers=MBG.embers.filter(e=>e.life>0&&e.y>-6);
  if(surge>0){ c.fillStyle=`rgba(150,255,110,${surge*surge*0.45})`; c.fillRect(0,0,W,H); }
  c.restore();
}
function drawMenuBG(dt){
  if(MENU_ART.complete&&MENU_ART.naturalWidth) return drawMenuArt(dt);
  if(!MBG.stat) mbgBuildStatic();
  MBG.t+=dt;
  const surge=MBG.surge=Math.max(0,(MBG.surge||0)-dt*0.9); // «вибух» порталу при вході в меню
  const c=MBG.ctx, t=MBG.t, {w,h}=MBG;
  c.drawImage(MBG.stat,0,0);
  // фел-вир у брамі
  const gx=PT.gateL, gy=PT.lintelB, gw=PT.gateR-PT.gateL, gh=PT.floor-PT.lintelB;
  c.save(); c.beginPath(); c.rect(gx,gy,gw,gh); c.clip();
  // фон вихору: темні краї → світлий центр
  const bg=c.createRadialGradient(PT.cx,gy+gh*0.55,6,PT.cx,gy+gh*0.55,gw*0.75);
  bg.addColorStop(0,'#3a9a18'); bg.addColorStop(0.5,'#18520a'); bg.addColorStop(1,'#061604');
  c.fillStyle=bg; c.fillRect(gx,gy,gw,gh);
  // язики фел-полум'я вздовж країв брами
  for(let i=0;i<14;i++){
    const side=i%2?1:-1, yy=gy+((i*23+t*40)%gh), len=6+Math.sin(t*6+i)*4;
    c.fillStyle=i%3?'#5ad028':'#aaff6a';
    const x=side<0?gx:gx+gw-2;
    c.fillRect(side<0?x:x-len+2,yy|0,len|0,2);
  }
  const greens=['#1a4a0a','#2a7a10','#3aa018','#5ad028','#8aff4a'];
  for(let i=0;i<260;i++){
    const a=i*0.61+t*(0.6+(i%7)*0.12), r=((i*37)%60)+4;
    const px=PT.cx+Math.cos(a)*r*0.9, py=(gy+gh*0.55)+Math.sin(a)*r*0.75;
    const k=clamp(1-r/66,0,1);
    c.fillStyle=greens[Math.min(4,(k*5+Math.sin(t*3+i)*0.8)|0)];
    c.fillRect(px|0,py|0,2,2);
  }
  // яскраве ядро
  c.globalAlpha=0.35+Math.sin(t*2)*0.1; c.fillStyle='#b8ff7a';
  c.beginPath(); c.ellipse(PT.cx,gy+gh*0.55,18+Math.sin(t*3)*3,24,0,0,7); c.fill();
  c.globalAlpha=1;
  // блискавки
  MBG.boltT-=dt;
  if(MBG.boltT<=0){ MBG.boltT=(0.08+Math.random()*0.25)*(1-surge*0.85); MBG.bolts.push(mbgBolt()); }
  for(const b of MBG.bolts){
    b.t-=dt;
    c.strokeStyle='#d8ff9a'; c.lineWidth=2; c.beginPath();
    b.pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y)); c.stroke();
    c.strokeStyle='#ffffff'; c.lineWidth=1; c.stroke();
  }
  MBG.bolts=MBG.bolts.filter(b=>b.t>0);
  // силуети демонів, що пролітають крізь портал
  for(let i=0;i<4;i++){
    const p=((t*0.12+i*0.27)%1), x=PT.cx-40+((i*31)%80), y=gy+gh*0.2+p*gh*0.7;
    c.fillStyle='#0a1a04'; c.fillRect(x|0,y|0,3,2); c.fillRect((x-2)|0,(y-1)|0,2,1); c.fillRect((x+3)|0,(y-1)|0,2,1);
  }
  c.restore();
  // світіння порталу на каміння (адитивно)
  c.save(); c.globalCompositeOperation='lighter';
  const gl=c.createRadialGradient(PT.cx,gy+gh*0.5,10,PT.cx,gy+gh*0.5,130);
  gl.addColorStop(0,'rgba(120,255,60,.35)'); gl.addColorStop(1,'rgba(0,0,0,0)');
  c.globalAlpha=Math.min(1,0.8+Math.sin(t*2.3)*0.15+surge);
  c.fillStyle=gl; c.fillRect(0,0,w,h);
  c.restore();
  // зелені очі статуй
  const eg=0.6+Math.sin(t*2.5)*0.4;
  for(const x of [(PT.pilL[0]+PT.pilL[1])/2,(PT.pilR[0]+PT.pilR[1])/2]){
    c.fillStyle=eg>0.5?'#baff6a':'#6ad030'; c.fillRect((x-2)|0,PT.lintelB+19,1,1); c.fillRect((x+1)|0,PT.lintelB+19,1,1);
  }
  // вогонь у жаровнях
  for(const x of [96,330]){
    const y=158, f=Math.sin(t*14+x)*1.5;
    c.fillStyle='#ff7a1a'; c.fillRect(x-3,y-6+f,6,6);
    c.fillStyle='#ffd24a'; c.fillRect(x-2,y-8+f,4,5);
    c.fillStyle='#fff2b0'; c.fillRect(x-1,y-5+f,2,2);
  }
  // жарини, що летять угору
  if(MBG.embers.length<70&&Math.random()<0.6) MBG.embers.push({x:Math.random()*w,y:h+2,vx:(Math.random()-0.3)*8,vy:-(12+Math.random()*22),life:4+Math.random()*4});
  for(const e of MBG.embers){ e.x+=e.vx*dt+Math.sin(t*2+e.y*0.1)*0.1; e.y+=e.vy*dt; e.life-=dt; c.fillStyle=e.life>2?'#ffb03a':'#b8401a'; c.fillRect(e.x|0,e.y|0,1,1); }
  MBG.embers=MBG.embers.filter(e=>e.life>0&&e.y>-4);
  // зелені іскри біля порталу
  if(MBG.motes.length<24&&Math.random()<0.5) MBG.motes.push({x:PT.gateL+Math.random()*gw,y:PT.floor-4,vy:-(6+Math.random()*12),life:2+Math.random()*2});
  for(const m of MBG.motes){ m.y+=m.vy*dt; m.x+=Math.sin(t*3+m.y)*0.2; m.life-=dt; c.fillStyle='#9aff5a'; c.fillRect(m.x|0,m.y|0,1,1); }
  MBG.motes=MBG.motes.filter(m=>m.life>0);
  // на екран ×3
  ctx.save(); ctx.setTransform(VIEW_K,0,0,VIEW_K,0,0); ctx.imageSmoothingEnabled=false;
  const sh=surge>0.3?Math.round((Math.random()-0.5)*surge*8):0;
  ctx.drawImage(MBG.cv,sh,-Math.abs(sh)/2,MBG.w*3,MBG.h*3);
  if(surge>0){ ctx.globalCompositeOperation='lighter'; ctx.fillStyle=`rgba(150,255,110,${surge*surge*0.55})`; ctx.fillRect(0,0,W,H); }
  ctx.restore();
}
