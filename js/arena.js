"use strict";
/* ============================================================
   ПІКСЕЛЬНІ ФОНИ АРЕН
   Усе малюється в пікселях низькороздільного світу (LOW, 640×360):
   небо з дизер-градієнтом Байєра, далекий і середній шари з
   паралаксом, земля з текстурою й смолоскипи — цілими пікселями.
   Статичні шари генеруються один раз на тему (детермінований RNG),
   анімоване (зорі, полярне сяйво, сніг, вогонь) — щокадру.
   ============================================================ */
const BG={};
function bgRng(seed){ return ()=>{ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function bgCanvas(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); g.imageSmoothingEnabled=false; return [c,g]; }
const hexRgb=h=>{ const n=parseInt(h.slice(1),16); return [n>>16,(n>>8)&255,n&255]; };

// вертикальний градієнт із дизером Байєра між сусідніми смугами палітри
function bgDitherSky(g,w,h,stops){
  const img=g.createImageData(w,h), d=img.data, cols=stops.map(hexRgb), N=cols.length-1;
  for(let y=0;y<h;y++){
    const lv=y/(h-1)*N, b=Math.min(N-1,Math.floor(lv)), fr=lv-b;
    for(let x=0;x<w;x++){
      const c=cols[(fr*16>BAYER4[((y&3)<<2)|(x&3)])?b+1:b], i=(y*w+x)*4;
      d[i]=c[0]; d[i+1]=c[1]; d[i+2]=c[2]; d[i+3]=255;
    }
  }
  g.putImageData(img,0,0);
}
// силует хребта: висота за сумою синусоїд + шум; освітлений край згори, темніє донизу дизером
function bgRidge(g,w,h,base,{col,lit,dark,amp,freq,seed,jag=0,flat=0,cap=null}){
  const r=bgRng(seed), ph=[r()*7,r()*7,r()*7];
  const top=[];
  for(let x=0;x<w;x++){
    let y=base-amp*(0.55*Math.sin(x*freq+ph[0])+0.3*Math.sin(x*freq*2.3+ph[1])+0.15*Math.sin(x*freq*5.1+ph[2]));
    if(jag) y+=(r()-0.5)*jag;
    if(flat){ const q=Math.round(y/flat)*flat; y=y*0.25+q*0.75; }   // столові гори: пласкі вершини
    top.push(Math.round(y));
  }
  for(let x=0;x<w;x++){
    const t=top[x];
    g.fillStyle=col; g.fillRect(x,t,1,h-t);
    if(dark) for(let y=t+8;y<h;y++){ const k=(y-t)/(h-t); if(k*16>BAYER4[((y&3)<<2)|(x&3)]+4){ g.fillStyle=dark; g.fillRect(x,y,1,1); } }
    if(lit&&x>0&&top[x-1]>=t){ g.fillStyle=lit; g.fillRect(x,t,1,1); if(top[x-1]>t+1) g.fillRect(x,t+1,1,1); }
    // сніжна шапка на вищих вершинах: товща на піках, рвана дизером знизу
    if(cap&&t<base-amp*0.15){ const ch=Math.round((base-amp*0.15-t)*0.45)+3;
      for(let y=0;y<ch;y++) if(y<ch-3||BAYER4[(((t+y)&3)<<2)|(x&3)]<8){ g.fillStyle=cap; g.fillRect(x,t+y,1,1); } }
  }
  return top;
}
function bgPine(g,x,y,h,col,snow){
  for(let i=0;i<h;i++){ const w=Math.round((i/h)*h*0.32)+1; g.fillStyle=col; g.fillRect(x-w,y-h+i,w*2+1,1);
    if(snow&&(i%5===0||i%5===1)&&i>2){ g.fillStyle=snow; g.fillRect(x-w,y-h+i,Math.max(1,w),1); } }
  g.fillStyle='#1a1008'; g.fillRect(x,y,1,3);
}
function bgCrystal(g,x,y,h,col,lit){
  for(let i=0;i<h;i++){ const w=Math.max(0,Math.round((1-Math.abs(i-h*0.7)/(h*0.7))*h*0.18)); g.fillStyle=col; g.fillRect(x-w,y-h+i,w*2+1,1); g.fillStyle=lit; g.fillRect(x-w,y-h+i,1,1); }
}

/* ---------- генерація шарів теми ---------- */
function bgBuild(kind){
  const L={kind};
  const [sky,gs]=bgCanvas(640,300), [far,gf]=bgCanvas(900,300), [mid,gm]=bgCanvas(1100,300), [tile,gt]=bgCanvas(64,64);
  const r=bgRng(kind.length*977);
  L.sky=sky; L.far=far; L.mid=mid; L.stars=[];
  if(kind==='shadow'){
    bgDitherSky(gs,640,300,['#0b0816','#160f28','#24183c','#3a2450','#55306a']);
    for(let i=0;i<110;i++) L.stars.push([Math.floor(r()*640),Math.floor(r()*190),r()<0.15?'#c9a8ff':'#ffffff',r()*7]);
    // місяць із кратерами і дизер-ореолом
    const mx=470,my=70;
    for(let y=-44;y<=44;y++) for(let x=-44;x<=44;x++){ const d=Math.hypot(x,y); if(d>26&&d<44&&(44-d)/18*16>BAYER4[(((my+y)&3)<<2)|((mx+x)&3)]){ gs.fillStyle='#3a2a5a'; gs.fillRect(mx+x,my+y,1,1); } }
    pxDisc(gs,mx,my,24,'#d8d0f0'); pxDisc(gs,mx+3,my-2,21,'#efeaff');
    for(const [x,y,rr] of [[-8,-6,5],[6,8,4],[9,-9,3],[-5,10,2]]) pxDisc(gs,mx+x,my+y,rr,'#c4b8e4');
    bgRidge(gf,900,300,170,{col:'#1d1530',lit:'#3e2c60',dark:'#150f24',amp:60,freq:0.012,seed:11,jag:3});
    bgRidge(gm,1100,300,215,{col:'#140e22',lit:'#2c2046',dark:'#0e0a18',amp:32,freq:0.02,seed:12,jag:2});
    for(let i=0;i<16;i++){ const x=Math.floor(30+r()*1040), h=12+Math.floor(r()*26); bgCrystal(gm,x,232+Math.floor(r()*30),h,'#4a2a8a','#b48cff'); }
    gt.fillStyle='#3a2a50'; gt.fillRect(0,0,64,64);
    for(let i=0;i<70;i++){ gt.fillStyle=r()<0.5?'#2e2242':'#46345e'; gt.fillRect(Math.floor(r()*64),Math.floor(r()*64),1+Math.floor(r()*3),1); }
    gt.fillStyle='#281c38'; for(let y=12;y<64;y+=18){ gt.fillRect(0,y,64,1); for(let x=(y*7)%32;x<64;x+=32) gt.fillRect(x,y-18,1,18); }
    L.ground={top:'#5a4478',topD:'#2a1e3c'}; L.torch={pole:'#2a2038',flame:['#e0c8ff','#b48cff','#7a4cc8']};
  } else if(kind==='durotar'){
    bgDitherSky(gs,640,300,['#2a0c06','#5a1a0a','#9a3414','#d0601c','#f0a040','#ffd080']);
    // низьке сонце зі смугами
    const sx=420,sy=208;
    for(let y=-38;y<=38;y++) for(let x=-38;x<=38;x++){ const d=Math.hypot(x,y); if(d<=36&&!(y>6&&((y>>2)&1))){ gs.fillStyle=d<30?'#fff0b0':'#ffc060'; gs.fillRect(sx+x,sy+y,1,1); } }
    for(let i=0;i<5;i++){ const cy=60+i*26, cx=Math.floor(r()*520); gs.fillStyle=i%2?'#7a2a12':'#5a1e0c'; gs.fillRect(cx,cy,60+Math.floor(r()*90),2); gs.fillRect(cx+12,cy+2,40,1); }
    bgRidge(gf,900,300,190,{col:'#6a2410',lit:'#b8562a',dark:'#521a0a',amp:46,freq:0.01,seed:21,flat:14});
    const top=bgRidge(gm,1100,300,232,{col:'#3e160a',lit:'#7a3216',dark:'#2c0e06',amp:18,freq:0.016,seed:22});
    // орківський частокіл зі стягами
    for(let x=60;x<1060;x+=220){
      for(let k=0;k<12;k++){ const px=x+k*5, ty=top[px]-16-(k%3)*2; gm.fillStyle='#2a1208'; gm.fillRect(px,ty,4,18); gm.fillStyle='#5a2a12'; gm.fillRect(px,ty,1,18); gm.fillStyle='#2a1208'; gm.fillRect(px+1,ty-2,2,2); }
      const bx=x+28, by=top[x+28]-40; gm.fillStyle='#1a0a04'; gm.fillRect(bx,by,1,26); gm.fillStyle='#a01a10'; gm.fillRect(bx+1,by,10,14); gm.fillStyle='#1a0a04'; gm.fillRect(bx+4,by+4,4,5);
    }
    gt.fillStyle='#8a4220'; gt.fillRect(0,0,64,64);
    for(let i=0;i<90;i++){ gt.fillStyle=r()<0.5?'#7a3818':'#a85a2a'; gt.fillRect(Math.floor(r()*64),Math.floor(r()*64),1+Math.floor(r()*2),1); }
    gt.fillStyle='#5a2a12'; for(let i=0;i<4;i++){ let x=Math.floor(r()*64),y=Math.floor(r()*64); for(let k=0;k<9;k++){ gt.fillRect(x&63,y&63,1,1); x+=r()<0.5?1:0; y+=1; } }
    L.ground={top:'#c87a3a',topD:'#6a3010',grass:'#d8b060'}; L.torch={pole:'#2a1408',flame:['#fff0b0','#ffb03a','#ff6a1a']};
  } else { // northrend
    bgDitherSky(gs,640,300,['#03060f','#08122a','#0e2040','#18345a','#2a4a70']);
    for(let i=0;i<140;i++) L.stars.push([Math.floor(r()*640),Math.floor(r()*200),r()<0.2?'#aee8ff':'#ffffff',r()*7]);
    bgRidge(gf,900,300,165,{col:'#6a80a0',lit:'#eef4ff',dark:'#4e6282',amp:64,freq:0.013,seed:31,jag:2,cap:'#dce8f8'});
    const top=bgRidge(gm,1100,300,228,{col:'#0e1a28',lit:'#24384e',dark:'#0a121c',amp:20,freq:0.018,seed:32});
    for(let x=6;x<1100;x+=9+Math.floor(r()*14)){ bgPine(gm,x,top[x]+2,18+Math.floor(r()*20),'#0a1622','#c8d8f0'); }
    gt.fillStyle='#c8d8ec'; gt.fillRect(0,0,64,64);
    for(let y=0;y<64;y++) for(let x=0;x<64;x++) if(((y*13+x*7)%37<3)||(y>40&&BAYER4[((y&3)<<2)|(x&3)]<(y-40)/3)){ gt.fillStyle='#9ab0cc'; gt.fillRect(x,y,1,1); }
    gt.fillStyle='#eef6ff'; for(let i=0;i<40;i++) gt.fillRect(Math.floor(r()*64),Math.floor(r()*64),2,1);
    L.ground={top:'#ffffff',topD:'#7a90b0'}; L.torch={pole:'#1a2232',flame:['#ffffff','#aee8ff','#4a9ad8']};
    L.snow=[]; for(let i=0;i<70;i++) L.snow.push([r()*640,r()*360,0.4+r()*0.8,r()*7]);
  }
  L.tile=tile;
  L.pat=null;
  return L;
}

/* ---------- арени-картинки ---------- */
const PROC_KINDS=new Set(['shadow','durotar','northrend']);
// готова лише розкодована картинка: інакше перший drawImage розкодовує її посеред кадру
function arenaImg(th){
  if(!th||!th.img) return null;
  if(!th._im){ const im=th._im=new Image(); im.fetchPriority='high'; im.src=th.img;
    (im.decode?im.decode():new Promise((ok,no)=>{ im.onload=ok; im.onerror=no; })).then(()=>{ th._ok=true; },()=>{ th._err=true; console.warn('немає картинки арени',th.img); }); }
  return th._ok?th._im:null;
}
// картинка ще вантажиться (якщо впала — буде запасний процедурний фон)
const arenaPending=th=>!!(th&&th.img&&!arenaImg(th)&&!th._err);
// картинка — частина світу: рухається й масштабується разом із камерою, як земля під бійцями
// (інакше при наближенні камери бійці «ростуть» і «їздять» відносно нерухомого фону). Ширина — трохи більша
// за арену (WORLD_W), лінія землі картинки (th.ground — частка висоти) — на рівні GROUND.
const ARENA_BW=WORLD_W+100;
function drawArenaImage(game,g){
  const im=arenaImg(game.theme); if(!im) return null;
  const cam=game.cam, k=cam.scale;
  const shx=game._shx||0, shy=game._shy||0;
  const bh=ARENA_BW*im.naturalHeight/im.naturalWidth;
  const x=cam.offX+shx+(WORLD_W/2-ARENA_BW/2)*k, y=cam.offY+shy+(GROUND-game.theme.ground*bh)*k;
  const dw=ARENA_BW*k, dh=bh*k;
  g.save(); g.setTransform(VIEW_K,0,0,VIEW_K,0,0); g.imageSmoothingEnabled=true; g.imageSmoothingQuality='high';   // базова трансформація: полотно на HiDPI-екранах більше за 1280×720
  g.fillStyle='#000'; g.fillRect(0,0,W,H);   // на випадок, якщо картинка не накриє край
  g.drawImage(im,x,y,dw,dh);
  g.restore();
  return im;
}
// анімація поверх картинки (у LOW): сніг, жарини
function drawArenaFx(game){
  const th=game.theme, t=game.time, g=ctx;
  if(!th.snow&&!th.ember) return;
  if(!th._fx){ const r=bgRng(th.kind.length*31); th._fx=[]; for(let i=0;i<70;i++) th._fx.push([r()*640,r()*360,0.4+r()*0.8,r()*7]); }
  g.save(); g.setTransform(1,0,0,1,0,0);
  for(const s of th._fx){
    if(th.snow){ const y=(s[1]+t*22*s[2])%360, x=(s[0]+Math.sin(t*0.8+s[3])*10+640)%640; g.fillStyle='#ffffff'; g.globalAlpha=0.45+s[2]*0.4; g.fillRect(x|0,y|0,s[2]>0.9?2:1,1); }
    else { const y=360-((s[1]+t*18*s[2])%360), x=(s[0]+Math.sin(t*1.3+s[3])*8+640)%640; g.fillStyle=s[2]>0.8?'#ffd24a':'#ff6a1a'; g.globalAlpha=0.35+s[2]*0.5; g.fillRect(x|0,y|0,1,1); }
  }
  g.restore();
}

/* ---------- щокадрове малювання ---------- */
function drawArenaBG(game,shx,shy){
  if(game._bgImg) return drawArenaFx(game);
  const th=game.theme;
  if(arenaPending(th)){ ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle='#000'; ctx.fillRect(0,0,LOW.cv.width,LOW.cv.height); ctx.restore(); return; }   // не підміняти процедурним фоном
  const kind=PROC_KINDS.has(th.kind)?th.kind:'shadow';   // картинки немає — процедурний фон
  const L=BG[kind]||(BG[kind]=bgBuild(kind));
  const g=ctx, t=game.time, cam=game.cam;
  g.save(); g.setTransform(1,0,0,1,0,0); g.imageSmoothingEnabled=false;
  const gy=Math.round((cam.offY+shy+GROUND*cam.scale)/PIX);      // лінія землі в пікселях LOW
  const pan=(cam.x-WORLD_W/2)/PIX;                                // зсув камери від центру арени
  g.drawImage(L.sky,0,gy-300);
  g.fillStyle='#000'; if(gy-300>0) g.fillRect(0,0,640,gy-300);
  // зорі мерехтять
  for(const [x,y,c,ph] of L.stars){ if(Math.sin(t*2+ph*3)>-0.6){ g.fillStyle=c; g.fillRect(x,y+gy-296,1,1); } }
  // полярне сяйво: хвилясті стрічки з дизером
  if(kind==='northrend'){
    for(let band=0;band<2;band++){
      const col=band?'#4affb0':'#5ae0ff';
      for(let x=0;x<640;x+=1){
        const y0=60+band*28+Math.sin(x*0.018+t*0.6+band*2)*18+Math.sin(x*0.05-t*0.9)*6, hgt=26+Math.sin(x*0.03+t)*10;
        for(let y=0;y<hgt;y++){ const k=1-y/hgt; if(k*k*10>BAYER4[(((y0+y|0)&3)<<2)|(x&3)]+3){ g.fillStyle=col; g.globalAlpha=0.5; g.fillRect(x,(y0+y)|0,1,1); } }
      }
    }
    g.globalAlpha=1;
  }
  // паралакс: далекий шар повільно, середній швидше
  g.drawImage(L.far,Math.round(-130-pan*0.15+shx/PIX*0.2),gy-300+Math.round(shy/PIX*0.2));
  g.drawImage(L.mid,Math.round(-230-pan*0.4+shx/PIX*0.5),gy-300+Math.round(shy/PIX*0.5));
  // земля: текстура прив'язана до світу
  if(!L.pat) L.pat=g.createPattern(L.tile,'repeat');
  const wx0=Math.round((cam.offX+shx)/PIX);
  g.save(); g.translate(wx0,gy); g.fillStyle=L.pat; g.fillRect(-wx0,0,640,360-gy); g.restore();
  g.fillStyle=L.ground.top; g.fillRect(0,gy,640,1);
  g.fillStyle=L.ground.topD; g.fillRect(0,gy+1,640,1);
  if(L.ground.grass){ g.fillStyle=L.ground.grass; for(let wx=40;wx<WORLD_W;wx+=57){ const x=Math.round((cam.offX+shx+wx*cam.scale)/PIX); g.fillRect(x,gy-2,1,2); g.fillRect(x+2,gy-3,1,3); g.fillRect(x+4,gy-1,1,1); } }
  // смолоскипи (у Нордсколі — жаровні з блакитним вогнем)
  for(let wx=150;wx<WORLD_W;wx+=400){
    const x=Math.round((cam.offX+shx+wx*cam.scale)/PIX), hp=Math.round(110*cam.scale/PIX);
    g.fillStyle=L.torch.pole; g.fillRect(x-1,gy-hp,3,hp);
    g.fillStyle='#000'; g.globalAlpha=0.3; g.fillRect(x-2,gy,6,1); g.globalAlpha=1;
    g.fillStyle=L.torch.pole; g.fillRect(x-3,gy-hp-2,7,3);
    const f=L.torch.flame, fl=Math.floor(t*10+wx)%3, fy=gy-hp-2;
    pxGlow(g,x,fy-7,24,f[1],0.4);
    g.fillStyle=f[2]; g.fillRect(x-3,fy-8+fl%2,7,8); g.fillRect(x-2,fy-11+fl,5,3);   // язики полум'я
    g.fillStyle=f[1]; g.fillRect(x-2,fy-9+fl%2,5,8); g.fillRect(x-1,fy-14+fl,3,5); g.fillRect(x+(fl-1),fy-16+fl,1,2);
    g.fillStyle=f[0]; g.fillRect(x-1,fy-6,3,5); g.fillRect(x,fy-9+fl%2,1,3);
  }
  // сніг падає
  if(L.snow){ g.fillStyle='#ffffff';
    for(const s of L.snow){ const y=(s[1]+t*22*s[2])%360, x=(s[0]+Math.sin(t*0.8+s[3])*10-pan*0.6+640)%640; g.globalAlpha=0.5+s[2]*0.4; g.fillRect(x|0,y|0,s[2]>0.9?2:1,1); }
    g.globalAlpha=1; }
  g.restore();
}
