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
