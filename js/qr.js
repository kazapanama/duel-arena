"use strict";
/* ============================================================
   QR-КОД БЕЗ БІБЛІОТЕК (потрібен «Мультиплеєру через GitHub», js/p2p.js).
   qrEncode(text) → {size, dark(x,y)}: байтовий режим, виправлення помилок M (або L, якщо M не вміщує),
   версія підбирається сама (1–20). qrDraw(canvas, text, px) малює код з білим полем навколо.
   Алгоритм стандартний (ISO 18004): Рід–Соломон над GF(256), 8 масок, штрафи за вибір найкращої.
   ============================================================ */
const QR=(()=>{
  // байтів виправлення на блок і кількість блоків: [рівень][версія]; рівні: 0 — L, 1 — M
  const ECC_LEN=[[0,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28],
                 [0,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26]];
  const ECC_BLK=[[0,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8],
                 [0,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16]];
  const FMT_BITS=[1,0];   // двійкові позначки рівнів L і M у форматі
  const MAX_VER=20;

  function rawModules(v){   // скільки модулів у коді лишається під дані й виправлення
    let r=(16*v+128)*v+64;
    if(v>=2){ const n=Math.floor(v/7)+2; r-=(25*n-10)*n-55; if(v>=7) r-=36; }
    return r;
  }
  const dataWords=(v,e)=>Math.floor(rawModules(v)/8)-ECC_LEN[e][v]*ECC_BLK[e][v];

  function gfMul(x,y){ let z=0; for(let i=7;i>=0;i--){ z=(z<<1)^((z>>>7)*0x11D); z^=((y>>>i)&1)*x; } return z; }
  function rsDivisor(deg){
    const c=new Array(deg).fill(0); c[deg-1]=1; let root=1;
    for(let i=0;i<deg;i++){
      for(let j=0;j<deg;j++){ c[j]=gfMul(c[j],root); if(j+1<deg) c[j]^=c[j+1]; }
      root=gfMul(root,2);
    }
    return c;
  }
  function rsRemainder(data,div){
    const r=new Array(div.length).fill(0);
    for(const b of data){ const f=b^r.shift(); r.push(0); div.forEach((c,i)=>{ r[i]^=gfMul(c,f); }); }
    return r;
  }

  function encode(text){
    const bytes=[...new TextEncoder().encode(text)];
    // версія й рівень: найменша версія, у яку влізе (спершу M, потім L)
    let ver=0, ecl=1;
    search: for(const e of [1,0]) for(let v=1;v<=MAX_VER;v++){
      const bits=4+(v<=9?8:16)+bytes.length*8;
      if(bits<=dataWords(v,e)*8){ ver=v; ecl=e; break search; }
    }
    if(!ver) throw new Error('Забагато даних для QR-коду');
    // бітовий потік: режим 0100, довжина, байти, термінатор, добивка 0xEC/0x11
    const bits=[], put=(val,n)=>{ for(let i=n-1;i>=0;i--) bits.push((val>>>i)&1); };
    put(4,4); put(bytes.length,ver<=9?8:16); bytes.forEach(b=>put(b,8));
    const cap=dataWords(ver,ecl)*8;
    put(0,Math.min(4,cap-bits.length)); put(0,(8-bits.length%8)%8);
    for(let pad=0xEC;bits.length<cap;pad^=0xEC^0x11) put(pad,8);
    const data=[]; for(let i=0;i<bits.length;i+=8) data.push(parseInt(bits.slice(i,i+8).join(''),2));
    // блоки з виправленням помилок і перемішування
    const nb=ECC_BLK[ecl][ver], el=ECC_LEN[ecl][ver], raw=Math.floor(rawModules(ver)/8);
    const nShort=nb-raw%nb, shortLen=Math.floor(raw/nb), div=rsDivisor(el), blocks=[];
    for(let i=0,k=0;i<nb;i++){
      const d=data.slice(k,k+shortLen-el+(i<nShort?0:1)); k+=d.length;
      const ecc=rsRemainder(d,div);
      if(i<nShort) d.push(0);
      blocks.push(d.concat(ecc));
    }
    const words=[];
    for(let i=0;i<blocks[0].length;i++) blocks.forEach((b,j)=>{ if(i!==shortLen-el||j>=nShort) words.push(b[i]); });
    return draw(ver,ecl,words);
  }

  function draw(ver,ecl,words){
    const size=ver*4+17;
    const mod=Array.from({length:size},()=>new Array(size).fill(false));
    const fn=Array.from({length:size},()=>new Array(size).fill(false));   // службові модулі (не дані)
    const set=(x,y,v)=>{ mod[y][x]=v; fn[y][x]=true; };
    // смуги синхронізації
    for(let i=0;i<size;i++){ set(6,i,i%2===0); set(i,6,i%2===0); }
    // три «очі» з відступом і вирівнювальні квадрати
    const finder=(cx,cy)=>{
      for(let dy=-4;dy<=4;dy++) for(let dx=-4;dx<=4;dx++){
        const x=cx+dx, y=cy+dy, d=Math.max(Math.abs(dx),Math.abs(dy));
        if(x>=0&&x<size&&y>=0&&y<size) set(x,y,d!==2&&d!==4);
      }
    };
    finder(3,3); finder(size-4,3); finder(3,size-4);
    if(ver>1){
      const n=Math.floor(ver/7)+2, step=ver===32?26:Math.ceil((ver*4+4)/(n*2-2))*2, pos=[6];
      for(let p=size-7;pos.length<n;p-=step) pos.splice(1,0,p);
      for(let i=0;i<n;i++) for(let j=0;j<n;j++){
        if((i===0&&j===0)||(i===0&&j===n-1)||(i===n-1&&j===0)) continue;
        for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) set(pos[i]+dx,pos[j]+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
      }
    }
    const format=mask=>{
      const d=(FMT_BITS[ecl]<<3)|mask; let r=d;
      for(let i=0;i<10;i++) r=(r<<1)^((r>>>9)*0x537);
      const b=((d<<10)|r)^0x5412, g=i=>((b>>>i)&1)!==0;
      for(let i=0;i<=5;i++) set(8,i,g(i));
      set(8,7,g(6)); set(8,8,g(7)); set(7,8,g(8));
      for(let i=9;i<15;i++) set(14-i,8,g(i));
      for(let i=0;i<8;i++) set(size-1-i,8,g(i));
      for(let i=8;i<15;i++) set(8,size-15+i,g(i));
      set(8,size-8,true);   // завжди темний модуль
    };
    format(0);
    if(ver>=7){
      let r=ver; for(let i=0;i<12;i++) r=(r<<1)^((r>>>11)*0x1F25);
      const b=(ver<<12)|r;
      for(let i=0;i<18;i++){ const v=((b>>>i)&1)!==0, a=size-11+i%3, c=Math.floor(i/3); set(a,c,v); set(c,a,v); }
    }
    // дані зигзагом знизу вгору парами колонок
    let bi=0;
    for(let right=size-1;right>=1;right-=2){
      if(right===6) right=5;
      for(let vert=0;vert<size;vert++) for(let j=0;j<2;j++){
        const x=right-j, y=((right+1)&2)===0?size-1-vert:vert;
        if(!fn[y][x]&&bi<words.length*8){ mod[y][x]=((words[bi>>>3]>>>(7-(bi&7)))&1)!==0; bi++; }
      }
    }
    // маска з найменшим штрафом
    const MASKS=[(x,y)=>(x+y)%2===0,(x,y)=>y%2===0,(x,y)=>x%3===0,(x,y)=>(x+y)%3===0,
      (x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2===0,(x,y)=>x*y%2+x*y%3===0,(x,y)=>(x*y%2+x*y%3)%2===0,(x,y)=>((x+y)%2+x*y%3)%2===0];
    const flip=m=>{ for(let y=0;y<size;y++) for(let x=0;x<size;x++) if(!fn[y][x]&&MASKS[m](x,y)) mod[y][x]=!mod[y][x]; };
    let best=0, bestScore=Infinity;
    for(let m=0;m<8;m++){
      flip(m); format(m);
      const s=penalty(mod,size);
      if(s<bestScore){ bestScore=s; best=m; }
      flip(m);
    }
    flip(best); format(best);
    return {size,dark:(x,y)=>x>=0&&y>=0&&x<size&&y<size&&mod[y][x]};
  }

  function penalty(mod,size){
    let score=0, dark=0;
    const lines=[];
    for(let y=0;y<size;y++){ lines.push(mod[y].map(v=>v?'1':'0').join('')); }
    for(let x=0;x<size;x++){ let s=''; for(let y=0;y<size;y++) s+=mod[y][x]?'1':'0'; lines.push(s); }
    for(const s of lines){
      for(const m of s.matchAll(/1{5,}|0{5,}/g)) score+=3+m[0].length-5;                 // довгі однокольорові ряди
      score+=40*(s.match(/(?=00001011101|10111010000)/g)||[]).length;                     // схоже на «око»
    }
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      if(mod[y][x]) dark++;
      if(x+1<size&&y+1<size&&mod[y][x]===mod[y][x+1]&&mod[y][x]===mod[y+1][x]&&mod[y][x]===mod[y+1][x+1]) score+=3;   // квадрати 2×2
    }
    const total=size*size;
    score+=(Math.ceil(Math.abs(dark*20-total*10)/total)-1)*10;                             // баланс темних і світлих
    return score;
  }

  /* малює код на canvas: px — розмір модуля у пікселях, поле навколо — 4 модулі (за стандартом) */
  function paint(canvas,text,px=4){
    const q=encode(text), n=q.size+8, dim=n*px;
    canvas.width=dim; canvas.height=dim;
    const c=canvas.getContext('2d');
    c.fillStyle='#fff'; c.fillRect(0,0,dim,dim);
    c.fillStyle='#000';
    for(let y=0;y<q.size;y++) for(let x=0;x<q.size;x++) if(q.dark(x,y)) c.fillRect((x+4)*px,(y+4)*px,px,px);
    return q;
  }
  return {encode,paint};
})();
