"use strict";
/* ============================================================
   ПІКСЕЛЬНІ СНАРЯДИ за школою магії, предмети з неба (ультимейти)
   і банер ультимейта.
   Снаряди малюються прямо в пікселі низькороздільного світу (LOW):
   центр — через трансформацію камери, далі цілі пікселі без
   згладжування, як у спрайтів бійців.
   ============================================================ */
const PROJ_SCHOOL={
  'Fire Blast':'fire','Pyroblast':'fire','Incinerate':'fire','Conflagrate':'fire','Immolate':'fire','Soul Fire':'fire',
  'Holy Fire':'holyfire','Lava Burst':'lava',
  'Ice Lance':'icespike','Frostbolt':'frost',
  'Arcane Blast':'arcane','Arcane Barrage':'arcane','Starfire':'star',
  'Shadow Bolt':'shadow','Mind Blast':'shadow','Haunt':'soul',
  'Death Coil':'unholy','Chaos Bolt':'chaos',
  'Smite':'holy','Holy Shock':'holy','Penance':'holy',
  'Lightning Bolt':'lightning','Wrath':'nature',"Avenger's Shield":'shield','Kill Command':'beast',
};
// палітри від найсвітлішого (ядро) до найтемнішого (край хвоста)
const PROJ_PAL={
  fire:['#ffffff','#fff2a0','#ffb03a','#ff6a1a','#a82a10'],
  fel:['#ffffff','#e0ffb0','#9dff70','#3ac02a','#1a5a10'],
  holyfire:['#ffffff','#fff8d0','#ffd070','#e0a030','#8a5a10'],
  chaos:['#ffffff','#ffd0f0','#ff5ad0','#a02aa0','#3a1040'],
  lava:['#fff2a0','#ffb03a','#ff5a1a','#6a1a0a','#2a0a04'],
  shadow:['#e8d8ff','#b48cff','#7a4cc8','#3a1a6a','#140a24'],
  unholy:['#eaffd8','#9dff70','#4ab02a','#1a4a10','#0a1a06'],
  arcane:['#ffffff','#f0e0ff','#c9a8ff','#8a5ad8','#3a1a6a'],
  holy:['#ffffff','#fffbe0','#ffe27a','#d8a040','#7a5010'],
  frost:['#ffffff','#e0f8ff','#aee8ff','#5ab0e0','#1a4a7a'],
  nature:['#ffffff','#fff8b0','#ffe27a','#9ad040','#3a6a1a'],
  lightning:['#ffffff','#e8f8ff','#8fd0ff','#3a7ad0','#10204a'],
  star:['#ffffff','#f0f4ff','#b8c8ff','#7a8ae0','#2a2a6a'],
};
const palOf=hex=>[ '#ffffff', lightOf(hex,0.55), hex, hexShade(hex,-0.35), hexShade(hex,-0.65) ];

/* ---------- піксельні примітиви (g — контекст у пікселях LOW) ---------- */
function pxDisc(g,cx,cy,r,col){
  g.fillStyle=col;
  if(r<=0){ g.fillRect(cx,cy,1,1); return; }
  for(let dy=-r;dy<=r;dy++){ const w=Math.floor(Math.sqrt(r*r-dy*dy+r*0.5)); g.fillRect(cx-w,cy+dy,w*2+1,1); }
}
function pxGlow(g,x,y,r,col,a){
  g.save(); g.globalCompositeOperation='lighter'; g.globalAlpha=a;
  const gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,col); gr.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=gr; g.fillRect(x-r,y-r,r*2,r*2); g.restore();
}
// куля з вогняним хвостом уздовж (ux,uy) — проти руху
function pxComet(g,X,Y,R,ux,uy,P,time,n=7,wob=0.35){
  for(let i=n;i>=1;i--){
    const k=i/n, fl=Math.sin(time*31+i*1.9);
    const cx=Math.round(X-ux*i*R*0.78-uy*fl*R*wob*k), cy=Math.round(Y-uy*i*R*0.78+ux*fl*R*wob*k);
    pxDisc(g,cx,cy,Math.max(0,Math.round(R*(1-k*0.8))),P[Math.min(4,1+Math.floor(k*3.6+(fl>0.6?1:0)))]);
  }
  pxDisc(g,X,Y,R,P[3]); pxDisc(g,X,Y,Math.max(1,R-1),P[2]);
  pxDisc(g,Math.round(X+ux*R*0.2),Math.round(Y+uy*R*0.2),Math.max(1,Math.round(R*0.6)),P[1]);
  pxDisc(g,Math.round(X+ux*R*0.3),Math.round(Y+uy*R*0.3),Math.max(0,Math.round(R*0.28)),P[0]);
}

// центр снаряда в пікселях LOW і масштаб «світ → піксель»
function toLow(x,y){ const T=ctx.getTransform(); const p=T.transformPoint(new DOMPoint(x,y)); return {X:Math.round(p.x),Y:Math.round(p.y),s:Math.hypot(T.a,T.b)}; }

function drawProjectile(p,time){
  const {X,Y,s}=toLow(p.x,p.y), dir=Math.sign(p.vx)||1;
  const sch=p.kind==='arrow'?'arrow':(p.kind==='knife'?'knife':(p.school||'orb'));
  const R=Math.max(2,Math.round((p.size||10)*s*0.75));
  const g=ctx; g.save(); g.setTransform(1,0,0,1,0,0); g.imageSmoothingEnabled=false;
  const P=PROJ_PAL[sch]||palOf(p.color||'#ffffff');
  switch(sch){
    case 'arrow':{ // древко, наконечник, оперення кольору стрільця
      const L=Math.round(R*4.4);
      if((p.size||10)>=16){ // Kill Shot: золоте сяйво й довгий світний слід
        pxGlow(g,X,Y,R*3.4,p.color||'#ffe27a',0.55);
        g.fillStyle='#fff4b0'; g.globalAlpha=0.6; g.fillRect(dir>0?X-L-R*9:X+L,Y-1,R*9,3); g.globalAlpha=1;
      }
      g.fillStyle='#d8e8ff'; g.globalAlpha=0.35; g.fillRect(X-dir*(L+R*5),Y,dir*R*5,1); g.globalAlpha=1;
      g.fillStyle='#6b4a2a'; g.fillRect(dir>0?X-L:X,Y,L,2);
      g.fillStyle='#e8eef8'; for(let i=0;i<4;i++) g.fillRect(X+dir*(i)-(dir<0?1:0),Y-(3-i),1,(3-i)*2+2);
      g.fillStyle=p.color||'#ffffff'; for(let i=0;i<3;i++){ g.fillRect(X-dir*(L-i*2),Y-2-i%2,1,2); g.fillRect(X-dir*(L-i*2),Y+2,1,2+i%2); }
      break;
    }
    case 'knife':{ // метальний ніж Deadly Throw: крутиться в польоті (4 фази), за ним слід
      const L=Math.max(6,Math.round(R*2.4)), ph=Math.floor(time*28)%4;
      const [ux,uy]=[[1,0],[1,1],[0,1],[1,-1]][ph];
      g.fillStyle='#e8eef8'; g.globalAlpha=0.35; g.fillRect(dir>0?X-R*6:X,Y-1,R*6,2); g.globalAlpha=1;
      const dot=(k,c,w)=>{ g.fillStyle=c; g.fillRect(X+dir*ux*k-(w>>1),Y+uy*k-(w>>1),w,w); };
      for(let k=-L-1;k<=L+1;k++) dot(k,'#141018',4);                      // темний контур
      for(let k=-L;k<=L;k++){ const blade=k>-L/3;                         // руків'я — третина від заднього кінця
        dot(k,blade?'#c8d2e0':'#6b4428',2);
        if(blade&&k>=L-1) dot(k,'#ffffff',2); }                           // блиск вістря
      dot(Math.round(-L/3),'#e0b04a',3);                                  // гарда
      break;
    }
    case 'frost': case 'icespike':{ // крижаний уламок-ромб, сніжинки за ним
      const L=Math.round(R*(sch==='icespike'?4.2:3)), F=Math.round(L*0.35);
      pxGlow(g,X,Y,R*2.6,P[2],0.3);
      for(let i=1;i<=4;i++){ g.fillStyle=P[i%2?1:2]; g.fillRect(X-dir*(L+i*R*0.9),Y+Math.round(Math.sin(time*20+i*2)*R*0.6),1,1); }
      for(let xx=-L;xx<=F;xx++){
        const hh=Math.round(xx<0?R*(1+xx/L):R*(1-xx/F));
        if(hh<0) continue;
        g.fillStyle=P[3]; g.fillRect(X+dir*xx,Y-hh,1,hh*2+1);
        if(hh>1){ g.fillStyle=P[2]; g.fillRect(X+dir*xx,Y-hh+1,1,hh*2-1); }
      }
      g.fillStyle=P[0]; g.fillRect(dir>0?X-Math.round(L*0.6):X-2,Y-1,Math.round(L*0.6)+2,1);
      break;
    }
    case 'lightning':{ // ламана блискавка, кожен кадр нова
      pxGlow(g,X,Y,R*3,P[2],0.4);
      let px=X-dir*R*6, py=Y;
      for(let i=1;i<=6;i++){
        const nx=X-dir*R*(6-i), ny=i===6?Y:Y+Math.round((Math.random()-0.5)*R*1.6);
        const st=Math.max(Math.abs(nx-px),Math.abs(ny-py))||1;
        for(let k=0;k<=st;k++){ const qx=Math.round(px+(nx-px)*k/st), qy=Math.round(py+(ny-py)*k/st);
          g.fillStyle=P[2]; g.fillRect(qx,qy-1,1,3); g.fillStyle=P[0]; g.fillRect(qx,qy,1,1); }
        px=nx; py=ny;
      }
      pxDisc(g,X,Y,Math.max(1,Math.round(R*0.7)),P[1]); pxDisc(g,X,Y,Math.max(0,Math.round(R*0.35)),P[0]);
      break;
    }
    case 'shield':{ // щит, що крутиться: ширина пульсує
      const w=Math.max(1,Math.round(R*Math.abs(Math.cos(time*18)))), h=R+1;
      pxGlow(g,X,Y,R*2.4,'#9fd7ff',0.35);
      for(let dy=-h;dy<=h;dy++){ const ww=Math.round(w*Math.sqrt(Math.max(0,1-(dy*dy)/(h*h)))+0.4);
        g.fillStyle='#24406a'; g.fillRect(X-ww-1,Y+dy,ww*2+3,1); g.fillStyle='#d8e8ff'; g.fillRect(X-ww,Y+dy,ww*2+1,1); }
      g.fillStyle='#ffd23a'; g.fillRect(X-Math.max(0,Math.round(w*0.4)),Y-1,Math.max(1,Math.round(w*0.8)),3);
      break;
    }
    case 'beast':{ // три кігті-півмісяці летять до ворога
      pxGlow(g,X,Y,R*2.4,'#ff8866',0.35);
      for(let k=-1;k<=1;k++) for(let i=0;i<=R*2;i++){
        const a=i/(R*2), xx=Math.round(X-dir*R+dir*a*R*2), yy=Math.round(Y+k*R*0.8-Math.sin(a*Math.PI)*R*0.6*dir*0);
        g.fillStyle=i>R*1.4?'#ffffff':'#ff6a4a'; g.fillRect(xx,yy-Math.round(Math.sin(a*Math.PI)*2),1,2);
      }
      break;
    }
    case 'soul':{ // Haunt: блідий череп-дух із хвилястим хвостом
      pxGlow(g,X,Y,R*3,'#9fe0ff',0.45);
      for(let i=1;i<=7;i++){ const k=i/7; g.fillStyle=i<4?'#d8f4ff':'#7ab8d8'; g.globalAlpha=1-k*0.8;
        g.fillRect(Math.round(X-dir*R*1.4*i*0.7),Math.round(Y+Math.sin(time*16-i*0.9)*R*0.5*k),Math.max(1,Math.round(R*(1-k*0.7))),Math.max(1,Math.round(R*(1-k*0.7)))); }
      g.globalAlpha=1;
      pxDisc(g,X,Y,R,'#e8f8ff'); pxDisc(g,X,Y+Math.round(R*0.35),Math.max(1,Math.round(R*0.7)),'#c8ecff');
      g.fillStyle='#1a2a3a'; const e=Math.max(1,Math.round(R*0.35));
      g.fillRect(X+dir*Math.round(R*0.15)-e,Y-Math.round(R*0.25),e,e); g.fillRect(X+dir*Math.round(R*0.55)-e,Y-Math.round(R*0.25),e,e);
      g.fillRect(X+dir*Math.round(R*0.3)-1,Y+Math.round(R*0.45),Math.max(2,Math.round(R*0.5)),1);
      break;
    }
    case 'bomb':{ // бомба з ґнотом
      pxDisc(g,X,Y,R,'#1e1a1a'); pxDisc(g,X-1,Y-1,Math.max(1,R-2),'#3a3434'); g.fillStyle='#8a8484'; g.fillRect(X-Math.round(R*0.5),Y-Math.round(R*0.6),2,1);
      g.fillStyle='#6b4a2a'; g.fillRect(X,Y-R-3,1,3);
      if(Math.sin(time*40)>-0.3){ g.fillStyle='#ffe27a'; g.fillRect(X-1,Y-R-5,3,2); g.fillStyle='#ff6a1a'; g.fillRect(X,Y-R-6,1,1); }
      break;
    }
    case 'lava':
      pxGlow(g,X,Y,R*3,'#ff5a1a',0.45);
      pxComet(g,X,Y,R,dir,0,PROJ_PAL.fire,time);
      pxDisc(g,X,Y,Math.max(1,R-1),P[3]);                                       // застигла кірка
      g.fillStyle=P[1]; g.fillRect(X-1,Y-Math.round(R*0.5),1,R); g.fillRect(X-Math.round(R*0.5),Y,R,1); // розпечені тріщини
      break;
    case 'star':{ // чотирипроменева зірка, що обертається
      pxGlow(g,X,Y,R*3,P[2],0.45);
      for(let i=1;i<=4;i++){ g.fillStyle=P[1]; g.fillRect(X-dir*i*R,Y+Math.round(Math.sin(time*18+i)*R*0.5),1,1); }
      const rot=time*8;
      for(let k=0;k<4;k++){ const a=rot+k*Math.PI/2;
        for(let i=0;i<=R*1.6;i++){ g.fillStyle=i<R*0.6?P[0]:P[2]; g.fillRect(Math.round(X+Math.cos(a)*i),Math.round(Y+Math.sin(a)*i),1,1); } }
      pxDisc(g,X,Y,Math.max(1,Math.round(R*0.45)),P[1]); g.fillStyle=P[0]; g.fillRect(X,Y,1,1);
      break;
    }
    default:{ // кулі-комети: вогонь, фел, хаос, тінь, світло, аркан, природа, нежить
      pxGlow(g,X,Y,R*2.8,P[2],sch==='shadow'?0.25:0.45);
      pxComet(g,X,Y,R,dir,0,P,time,sch==='holy'||sch==='arcane'?4:7,sch==='shadow'?0.6:0.35);
      if(sch==='arcane'){ for(let k=0;k<3;k++){ const a=time*12+k*2.1; g.fillStyle=P[0]; g.fillRect(Math.round(X+Math.cos(a)*(R+2)),Math.round(Y+Math.sin(a)*(R+2)),1,1); } }
      if(sch==='holy'){ const a=time*6; g.fillStyle=P[1]; for(let k=0;k<4;k++){ const b=a+k*Math.PI/2; for(let i=R+1;i<R+4;i++) g.fillRect(Math.round(X+Math.cos(b)*i),Math.round(Y+Math.sin(b)*i),1,1); } }
      if(sch==='chaos'){ g.fillStyle='#9dff70'; for(let k=0;k<3;k++) g.fillRect(Math.round(X-dir*R*k*0.9+Math.sin(time*40+k)*R),Math.round(Y+Math.cos(time*33+k)*R),1,1); }
      if(sch==='unholy'){ g.fillStyle=P[4]; g.fillRect(X+dir*1-1,Y-1,1,1); g.fillRect(X+dir*1+1,Y-1,1,1); }
      if(sch==='shadow'){ pxDisc(g,X,Y,Math.max(0,Math.round(R*0.35)),P[4]); }
    }
  }
  g.restore();
}

/* ---------- з неба: молот світла, метеор, інфернал ---------- */
function drawFaller(f,time){
  const {X,Y,s}=toLow(f.x,f.y);
  const dx=f.x1-f.x0, dy=(GROUND-30)-f.y0, L=Math.hypot(dx,dy)||1, ux=dx/L, uy=dy/L;
  const g=ctx; g.save(); g.setTransform(1,0,0,1,0,0); g.imageSmoothingEnabled=false;
  if(f.kind==='hammer'){
    const R=Math.max(4,Math.round(12*s));
    // світловий стовп над молотом
    g.globalCompositeOperation='lighter'; g.globalAlpha=0.35; g.fillStyle='#fff4b0'; g.fillRect(X-R,0,R*2,Y); g.globalAlpha=0.6; g.fillRect(X-Math.round(R*0.4),0,Math.round(R*0.8),Y);
    g.globalCompositeOperation='source-over'; g.globalAlpha=1;
    pxGlow(g,X,Y,R*4,'#ffe27a',0.5);
    g.fillStyle='#6b4a2a'; g.fillRect(X-Math.round(R*0.3),Y-R*5,Math.round(R*0.6),R*4);          // руків'я
    g.fillStyle='#ffe27a'; g.fillRect(X-Math.round(R*0.4),Y-R*5-2,Math.round(R*0.8),3);            // навершя
    g.fillStyle='#7a5010'; g.fillRect(X-R*2-1,Y-R-1,R*4+2,R*2+2);                                  // голова молота
    g.fillStyle='#ffd23a'; g.fillRect(X-R*2,Y-R,R*4,R*2);
    g.fillStyle='#fff8d0'; g.fillRect(X-R*2,Y-R,R*4,Math.max(1,Math.round(R*0.4))); g.fillRect(X-1,Y-R,2,R*2);
  } else if(f.kind==='meteor'){
    const R=Math.max(5,Math.round(20*s));
    pxGlow(g,X,Y,R*3.5,'#ff7733',0.55);
    pxComet(g,X,Y,R,ux,uy,PROJ_PAL.fire,time,10,0.25);
    pxDisc(g,X,Y,Math.round(R*0.75),'#4a1a0a'); g.fillStyle='#ffb03a'; g.fillRect(X-Math.round(R*0.4),Y,Math.round(R*0.8),1); g.fillRect(X,Y-Math.round(R*0.4),1,Math.round(R*0.8));
  } else if(f.kind==='star'){ // Starfall: зірка з довгим хвостом
    const R=Math.max(3,Math.round(9*s));
    pxGlow(g,X,Y,R*4,'#b8c8ff',0.6);
    pxComet(g,X,Y,R,ux,uy,PROJ_PAL.star,time,9,0.2);
    for(let k=0;k<4;k++){ const a=time*9+k*Math.PI/2;
      for(let i=0;i<=R*2;i++){ g.fillStyle=i<R*0.7?'#ffffff':'#b8c8ff'; g.fillRect(Math.round(X+Math.cos(a)*i),Math.round(Y+Math.sin(a)*i),1,1); } }
    pxDisc(g,X,Y,Math.max(1,Math.round(R*0.5)),'#ffffff');
  } else { // інфернал: брила з фел-полум'ям
    const R=Math.max(5,Math.round(18*s));
    pxGlow(g,X,Y,R*3.5,'#7cff6b',0.55);
    pxComet(g,X,Y,R,ux,uy,PROJ_PAL.fel,time,10,0.3);
    pxDisc(g,X,Y,Math.round(R*0.85),'#2a2622'); pxDisc(g,X-1,Y-1,Math.round(R*0.6),'#4a4440');
    g.fillStyle='#9dff70'; g.fillRect(X-Math.round(R*0.5),Y,R,1); g.fillRect(X+2,Y-Math.round(R*0.5),1,R);
  }
  g.restore();
}

/* ---------- Immolation Aura (форма демона): піксельне кільце полум'я довкола ніг ----------
   Два проходи: задня половина кільця, жар землі й полум'я за тілом — до бійця (front=false), передня половина
   й іскри — поверх нього. Усе рахується від часу без частинок, тож однаково виглядає й у мережевій грі.
   ctx перед викликом переведено в точку між ступнями бійця */
const IMMO_PAL=['#fffbe0','#ffe070','#ffa030','#ff5a14','#c8260c','#6a1022'];   // ядро → край язика → темний кінчик
const hash1=(i,k)=>{ const v=Math.sin(i*12.9898+k*78.233)*43758.5453; return v-Math.floor(v); };
// язик полум'я: найширший у нижній третині, вершина хитається сильніше за основу; рядки пікселів — у шляхи за кольором.
// c — фаза циклу анімації 0…1 (кадр атласу)
function pxFlame(paths,X,Y,w,h,ph,c){
  if(h<2||w<1) return;
  const add=(ci,cx,y,half)=>{ const x0=Math.round(cx-half), x1=Math.max(x0+1,Math.round(cx+half)); paths[ci].rect(x0,y,x1-x0,1); };
  const A=c*Math.PI*2;
  for(let j=0;j<h;j++){
    const u=j/h, prof=Math.min(1,(u+0.1)/0.32)*Math.pow(1-u,0.62), half=w*0.5*prof;
    if(half<0.55) continue;   // без однопіксельних «волосин» на вершині — вони читаються як подряпини
    const cx=X+Math.sin(A+ph+u*3.4)*u*u*w*0.6, y=Y-j-1;
    add(u<0.45?3:(u<0.86||half>1.2?4:5),cx,y,half);
    if(u<0.66) add(u<0.32?1:2,cx,y,half*0.6);
    if(u<0.3) add(0,cx,y,half*0.26);
  }
  // відірваний клаптик полум'я над язиком: здіймається й гасне
  const q=(c+ph*0.37)%1, r=Math.round(w*0.24*(1-q));
  if(r>=1&&q<0.7) add(q<0.35?2:3,X+Math.sin(A+ph)*w*0.3,Math.round(Y-h-q*h*0.7),r);
}
// атлас язиків: для кожної висоти й пропорції — IMMO_F кадрів, мальованих один раз піксель у піксель; у бою кожен язик —
// один drawImage з найближчої клітинки з масштабом близько 1 (шляхи щокадру коштували ~4 мс, а сильне зменшення
// «найближчим пікселем» з'їдало стовпці — язики ставали тонкими, як трава)
const IMMO_F=8, IMMO_HB=[6,9,13,18,25,34,46,62,84], IMMO_RB=[0.34,0.5,0.72];
let IMMO_ATLAS=null;
function immoAtlas(){
  if(IMMO_ATLAS) return IMMO_ATLAS;
  const cells=[]; let y=0, W=0;
  for(const H of IMMO_HB) for(const r of IMMO_RB){
    const fw=Math.max(2,Math.round(H*r)), cw=Math.ceil(fw*2.6)+2, ch=Math.ceil(H*1.75)+2;
    cells.push({H,r,fw,cw,ch,y}); y+=ch; W=Math.max(W,cw*IMMO_F);
  }
  const cv=document.createElement('canvas'); cv.width=W; cv.height=y;
  const g=cv.getContext('2d'), paths=IMMO_PAL.map(()=>new Path2D());
  for(const c of cells) for(let f=0;f<IMMO_F;f++) pxFlame(paths,f*c.cw+Math.floor(c.cw/2),c.y+c.ch,c.fw,c.H,0,f/IMMO_F);
  for(let c=5;c>=0;c--){ g.fillStyle=IMMO_PAL[c]; g.fill(paths[c]); }
  return IMMO_ATLAS={cv,cells};
}
// язик шириною w і висотою h (пікселі LOW) з основою в (X,Y); ph — зсув кадру, щоб сусіди не рухались в унісон
function drawFlame(g,X,Y,w,h,ph,time){
  if(h<2||w<1) return;
  const A=immoAtlas(), f=(Math.floor(time*12+ph*3.7)%IMMO_F+IMMO_F)%IMMO_F;
  let hi=0, ri=0;
  for(let i=1;i<IMMO_HB.length;i++) if(Math.abs(Math.log(IMMO_HB[i]/h))<Math.abs(Math.log(IMMO_HB[hi]/h))) hi=i;
  for(let i=1;i<IMMO_RB.length;i++) if(Math.abs(Math.log(IMMO_RB[i]*h/w))<Math.abs(Math.log(IMMO_RB[ri]*h/w))) ri=i;
  const c=A.cells[hi*IMMO_RB.length+ri], kx=w/c.fw, ky=h/c.H;
  const dw=Math.max(1,Math.round(c.cw*kx)), dh=Math.max(1,Math.round(c.ch*ky));
  g.drawImage(A.cv,f*c.cw,c.y,c.cw,c.ch,Math.round(X-dw/2),Math.round(Y)-dh,dw,dh);
}
function drawImmoAura(k,R,time,front,bodyH,age){
  const g=ctx, {X,Y,s}=toLow(0,0);
  g.save(); g.setTransform(1,0,0,1,0,0); g.imageSmoothingEnabled=false;
  const P=IMMO_PAL, Rx=R*s, Ry=Rx*0.22, fa=Math.min(1,k*1.4);
  const erupt=age<0.4?1+0.9*(1-age/0.4):1;               // перші миті — полум'я вибухає вище
  const ring=(rx,ry,col,alpha,step,th=1)=>{              // піксельний еліпс: лише своя половина (задня/передня)
    g.globalAlpha=alpha; g.fillStyle=col;
    const n=Math.max(16,Math.round(rx*0.8));
    for(let i=0;i<n;i+=step){ const a=i/n*Math.PI*2, sy=Math.sin(a); if((sy>=0)!==front) continue;
      g.fillRect(Math.round(X+Math.cos(a)*rx)-1-(th>>1),Math.round(Y+sy*ry)-(th>>1),3+th,th); }
  };
  if(!front){
    // обпалена земля, жар під ногами й розпечений обідок, де стоїть полум'я
    const sc=g.createRadialGradient(X,Y,0,X,Y,Rx);
    sc.addColorStop(0,'rgba(30,6,4,.45)'); sc.addColorStop(0.8,'rgba(30,6,4,.35)'); sc.addColorStop(1,'rgba(30,6,4,0)');
    g.globalAlpha=k; g.fillStyle=sc; g.save(); g.translate(X,Y); g.scale(1,0.22); g.beginPath(); g.arc(0,0,Rx,0,7); g.fill(); g.restore();
    g.globalCompositeOperation='lighter';
    const gr=g.createRadialGradient(X,Y,0,X,Y,Rx);
    gr.addColorStop(0,'rgba(255,140,40,.55)'); gr.addColorStop(0.55,'rgba(255,80,20,.3)'); gr.addColorStop(0.85,'rgba(255,60,10,.42)'); gr.addColorStop(1,'rgba(255,40,0,0)');
    g.globalAlpha=k; g.fillStyle=gr; g.save(); g.translate(X,Y); g.scale(1,0.22); g.beginPath(); g.arc(0,0,Rx,0,7); g.fill(); g.restore();
    g.globalCompositeOperation='source-over';
    // високі язики за спиною — обрамлюють силует демона
    g.globalAlpha=fa;
    for(let i=0;i<7;i++){
      const o=(i/6-0.5)*2, fl2=0.7+0.3*Math.sin(time*7.7+i*2.3)+0.12*Math.sin(time*19+i*4.1);
      const hh=bodyH*s*(0.62-Math.abs(o)*0.3+hash1(i,3)*0.12)*fl2*k*Math.min(1.25,erupt), ww=Rx*(0.2+hash1(i,4)*0.06);
      drawFlame(g,X+o*Rx*0.42,Y-Math.round(Ry*0.35),ww,hh,i*1.9,time);
    }
  }
  ring(Rx,Ry,P[3],0.9*k,1); ring(Rx,Ry,P[1],0.8*k,3);    // обідок
  if(age<0.45){ const e=age/0.45, m=0.35+e*0.95;           // хвиля вогню на старті
    ring(Rx*m,Ry*m,P[3],1-e,1,4); ring(Rx*m,Ry*m,P[1],1-e,1,2); ring(Rx*m,Ry*m,P[0],(1-e)*0.9,2,1); }
  // кільце язиків, що повільно обертається; задні менші й темніші (далі від глядача)
  g.globalAlpha=fa;
  const N=36, M=44;
  for(let i=0;i<N+M;i++){
    const big=i<N, j=big?i:i-N, n=big?N:M;
    const a=(j+hash1(i,11)*0.6)/n*Math.PI*2+time*(big?0.8:0.8), sy=Math.sin(a);
    if((sy>=0)!==front) continue;
    const depth=0.5+0.5*sy, fl=0.6+0.32*Math.sin(time*(6.3+hash1(i,12)*3)+i*2.1)+0.14*Math.sin(time*17.1+i*5.3);
    const tall=big?(hash1(i,13)<0.25?1.45:1):0.42;     // зрідка — високий язик, щоб кільце не було рівним «парканом»
    const hh=(24+18*hash1(i,1))*tall*s*fl*(0.7+0.4*depth)*k*erupt, ww=(big?13+6*hash1(i,2):9+4*hash1(i,2))*s*(0.8+0.3*depth);
    drawFlame(g,X+Math.cos(a)*Rx,Math.round(Y+sy*Ry)+1,ww,hh,i*2.7,time);
  }
  // іскри: здіймаються від кільця й гаснуть, хитаючись
  for(let i=0;i<26;i++){
    if((i%2===0)!==front) continue;
    const q=(time*(0.45+hash1(i,5)*0.5)+hash1(i,6))%1, a=hash1(i,7)*Math.PI*2;
    const x=X+Math.cos(a)*Rx*(0.3+0.7*hash1(i,8))+Math.sin(time*3+i)*3, y=Y+Math.sin(a)*Ry-q*bodyH*s*(0.8+0.5*hash1(i,9));
    g.globalAlpha=k*(1-q); g.fillStyle=q<0.35?P[0]:(q<0.7?P[1]:P[3]);
    const z=hash1(i,10)<0.3?2:1; g.fillRect(Math.round(x),Math.round(y),z,z);
  }
  // сяйво над кільцем: вогонь світиться, а не лише лежить пікселями
  g.globalCompositeOperation='lighter'; g.globalAlpha=k*(0.8+0.2*Math.sin(time*11));
  const hg=g.createRadialGradient(X,Y,Rx*0.55,X,Y,Rx*1.12);
  hg.addColorStop(0,'rgba(255,120,30,0)'); hg.addColorStop(0.75,'rgba(255,120,30,.22)'); hg.addColorStop(1,'rgba(255,90,20,0)');
  g.fillStyle=hg; g.save(); g.translate(X,Y-Ry*0.6); g.scale(1,0.34); g.translate(-X,-Y);
  g.beginPath(); g.arc(X,Y,Rx*1.12,front?0:Math.PI,front?Math.PI:Math.PI*2); g.fill(); g.restore();
  g.globalCompositeOperation='source-over';
  if(front){ // відблиск вогню на ногах бійця
    const hy=bodyH*s*0.5, lg=g.createRadialGradient(X,Y,0,X,Y,hy);
    lg.addColorStop(0,'rgba(255,140,40,.3)'); lg.addColorStop(1,'rgba(255,90,20,0)');
    g.globalCompositeOperation='lighter'; g.globalAlpha=k; g.fillStyle=lg;
    g.save(); g.translate(X,Y); g.scale(Rx*0.5/hy,1); g.translate(-X,-Y); g.beginPath(); g.arc(X,Y,hy,Math.PI,0); g.fill(); g.restore();
  }
  g.restore();
}

/* ---------- банер ультимейта: затемнення, діагональна смуга кольору класу, назва ---------- */
function drawUltBanner(u){
  const k=1-u.t/u.T, a=Math.min(1,k/0.06,u.t/0.3), dir=u.side===0?1:-1;
  const ease=1-Math.pow(1-Math.min(1,k/0.16),3);
  const [r,gg,b]=hexToRgb(u.color);
  ctx.save();
  ctx.globalAlpha=a*0.45; ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
  ctx.globalAlpha=a; ctx.translate((1-ease)*-dir*W*0.7,0);
  const cy=H/2-20;
  ctx.beginPath(); ctx.moveTo(-60,cy-40); ctx.lineTo(W+60,cy-90); ctx.lineTo(W+60,cy+30); ctx.lineTo(-60,cy+80); ctx.closePath();
  const grd=ctx.createLinearGradient(0,cy-90,0,cy+80);
  grd.addColorStop(0,'rgba(10,6,4,.92)'); grd.addColorStop(0.5,`rgba(${r},${gg},${b},.88)`); grd.addColorStop(1,'rgba(10,6,4,.92)');
  ctx.fillStyle=grd; ctx.fill();
  ctx.strokeStyle='#ffe27a'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(-60,cy-40); ctx.lineTo(W+60,cy-90); ctx.moveTo(-60,cy+80); ctx.lineTo(W+60,cy+30); ctx.stroke();
  // смуги швидкості
  ctx.fillStyle='rgba(255,255,255,.5)';
  for(let i=0;i<12;i++){ const y=cy-60+((i*37)%120), x=((k*2400*dir+i*173)%(W+300)+W+300)%(W+300)-150; ctx.fillRect(x,y-(x/W)*50,90+(i%3)*40,2); }
  ctx.textAlign='center';
  ctx.font='18px "Tiny5",sans-serif'; ctx.fillStyle='#fff4d0'; ctx.fillText('УЛЬТИМЕЙТ',W/2,cy-28);
  ctx.font='60px "Tiny5",sans-serif'; ctx.lineWidth=10; ctx.strokeStyle='rgba(0,0,0,.85)';
  const name=u.name.toUpperCase();
  ctx.strokeText(name,W/2,cy+30); ctx.fillStyle='#ffffff'; ctx.fillText(name,W/2,cy+30);
  const tw=ctx.measureText(name).width;
  ctx.font='56px serif'; ctx.fillText(u.em,W/2-tw/2-52,cy+26); ctx.fillText(u.em,W/2+tw/2+52,cy+26);
  ctx.restore();
}
