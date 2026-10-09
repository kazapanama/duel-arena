"use strict";
/* ============================================================
   ІГРОВИЙ ДВИГУН
   ============================================================ */
const W=1280, H=720, GROUND=H-92;
const WORLD_W=1400; // ширина арени у світових координатах: вузька, щоб бійці були великими й не кайтили
const START_GAP=260; // половина стартової відстані між бійцями
const cv=document.getElementById('cv');
let ctx=cv.getContext('2d'); // let — інтерфейс тимчасово підміняє контекст для прев'ю скінів
/* Полотно рендериться в роздільності ЕКРАНА (не 1280×720, розтягнуте браузером з розмиттям).
   Логіка й HUD лишаються в координатах 1280×720 — базова трансформація VIEW_K. */
let VIEW_K=1;
// розмір кадру 16:9 рахуємо самі за видимою областю: після перемикання застосунків мобільний браузер
// показує/ховає панелі, а 100%/100dvh у CSS лишаються старими — кадр вилазить за екран (iPad, iOS)
const WRAP=document.getElementById('wrap');
let wrapKey='';
function fitWrap(){
  const vv=window.visualViewport, w=Math.round(vv?vv.width:innerWidth), h=Math.round(vv?vv.height:innerHeight);
  const key=w+'x'+h; if(!WRAP||key===wrapKey||!w||!h) return;   // галерея — без кадру гри
  wrapKey=key;
  document.body.style.height=h+'px';
  const ww=Math.floor(Math.min(w,h*16/9));
  WRAP.style.width=ww+'px'; WRAP.style.height=Math.floor(ww*9/16)+'px';
  if(window.scrollY) window.scrollTo(0,0);
}
for(const ev of ['resize','orientationchange','pageshow','focus']) window.addEventListener(ev,()=>{ wrapKey=''; fitWrap(); });
if(window.visualViewport) visualViewport.addEventListener('resize',()=>{ wrapKey=''; fitWrap(); });
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) for(const t of [0,250,700]) setTimeout(()=>{ wrapKey=''; fitWrap(); },t); });
function fitCanvas(){
  fitWrap();
  const r=cv.getBoundingClientRect(); if(!r.width) return;
  const pw=Math.max(640,Math.round(r.width*Math.min(2,window.devicePixelRatio||1))); // DPR ≤ 2: телефонам із DPR 3 вистачає й так
  if(cv.width!==pw){ cv.width=pw; cv.height=Math.round(pw*H/W); }
  VIEW_K=cv.width/W;
}
/* Графіка: high — бійці з растрових деталей у шарі повної роздільності; fast — у низькому шарі, як процедурні
   (арт-піксель удвічі крупніший, роботи на спрайт учетверо менше); auto — high, доки пристрій устигає (main.js gfxAuto) */
const GFX={mode:'auto',autoFast:false,get fast(){ return this.mode==='fast'||(this.mode==='auto'&&this.autoFast); }};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rnd=(a,b)=>a+Math.random()*(b-a);

// арени: картинки (js/arenas_data.js, tools/arenas/arenas.py); якщо їх немає — процедурні піксельні шари arena.js
const THEMES=(typeof ARENA_IMG!=='undefined'&&ARENA_IMG.length)?ARENA_IMG:[
  {kind:'shadow',name:'Тінисте плато'},
  {kind:'durotar',name:'Дуротар'},
  {kind:'northrend',name:'Нордскол'},
];

/* Гра по мережі (див. net.js): side — мій бік (0 — хост, 1 — гість), paired — суперник на зв'язку */
const NET={ws:null,side:-1,paired:false,urls:[],snap:null,sfxQ:[],rin:null,remoteSel:null,sentSel:'',out:null,
  get on(){ return this.paired; },
  get host(){ return this.paired&&this.side===0; },
  get guest(){ return this.paired&&this.side===1; }};

const state = {
  screen:'menu',       // menu | selClass | selSpec | fight
  mode:'ai',           // ai | pvp | net
  aiSkill:1,           // 0..2
  picking:0,           // чий вибір зараз (0 = P1, 1 = P2)
  picks:[null,null],   // {cls, spec, skin}
  pickedClass:null,
  pickedSpec:null,
  game:null,
  paused:false,
};

