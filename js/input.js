"use strict";
/* ---------- Ввід ---------- */
const keys=new Set();
const pressed=new Set();
addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Backspace'].includes(e.code)) e.preventDefault();
  if(e.repeat) return;
  ac();
  if(e.code==='KeyM'){ muted=!muted; if(typeof savePrefs==='function'){ savePrefs(); renderMenuVals(); } }
  // меню, вибір бійця, пауза, фінал — клавіші обробляє інтерфейс
  if(typeof setDevice==='function') setDevice('kb');   // підказки інтерфейсу — під клавіатуру
  if(typeof UI!=='undefined'&&UI.cur&&e.code!=='KeyM'){ UI.key(e.code); return; }
  keys.add(e.code); pressed.add(e.code);
  if(e.code==='Escape') togglePause();
});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('pointerdown',()=>ac());

const P1KEYS={left:'KeyA',right:'KeyD',jump:'KeyW',block:'KeyS',ab:['KeyJ','KeyK','KeyL','KeyU'],form:['KeyI'],ult:['KeyO']};
const P2KEYS={left:'ArrowLeft',right:'ArrowRight',jump:'ArrowUp',block:'ArrowDown',
  ab:[['Numpad1','Comma'],['Numpad2','Period'],['Numpad3','Slash'],['Numpad4','Quote']],form:['Numpad5','Semicolon'],ult:['Numpad6','BracketLeft']};

/* ---------- Віртуальний ввід: сенсорне керування (TIN) і суперник по мережі (NET.rin) ----------
   mv/jump/block — утримання; ab[i]/form — час натискання (0 — нема): натискання чекає
   до BUF_MS, поки боєць зможе його виконати (буфер вводу, щоб тап не губився в замаху).
   jumpUntil/blockUntil — короткий тап не пропаде, навіть якщо почався й скінчився між кадрами. */
const BUF_MS=150;
const newVin=()=>({mv:0,jump:false,block:false,ab:[0,0,0,0],form:0,ult:0,jumpUntil:0,blockUntil:0});
const TIN=newVin();
NET.rin=newVin();
function vinApply(f,v,game,st){
  const now=performance.now();
  if(v.mv) st.mv=v.mv;
  if(st.mv) f.inputDir=st.mv;   // напрямок — до здібностей: Blink/Sprint летять туди, куди тягнеш стік
  st.jump=st.jump||v.jump||now<v.jumpUntil;
  st.block=st.block||v.block||now<v.blockUntil;
  for(let i=0;i<4;i++) if(v.ab[i]&&(now-v.ab[i]>BUF_MS||f.useAbility(i,game))) v.ab[i]=0;
  if(v.form&&(now-v.form>BUF_MS||f.shapeshift(game))) v.form=0;
  if(v.ult&&(now-v.ult>BUF_MS||f.useUlt(game))) v.ult=0;
}

/* ---------- Геймпади ----------
   1-й підключений пад → Гравець 1, 2-й → Гравець 2.
   Стік/хрестовина — рух, вгору — стрибок, L1/L2 — блок, R1 — форма, R2 — ультимейт, Start — пауза.
   Здібності на хресті кнопок: X → 1, Y → 2, B → 3, A → 4. */
const PAD_AB=[2,3,1,0]; // X, Y, B, A (стандартна розкладка Gamepad API)
const padPrev=[{},{}];
const padInputs=[null,null];
const padConnected=[false,false];

/* ---------- Геймпад у меню: фронти кнопок → UI.pad ---------- */
const navPrevPads=[{},{}];
function padNavPoll(list){
  if(typeof UI==='undefined'||!UI.cur) return;
  for(let i=0;i<Math.min(list.length,2);i++){
    const gp=list[i], pv=navPrevPads[i];
    const btn=j=>!!(gp.buttons[j]&&gp.buttons[j].pressed);
    const ax=gp.axes[0]||0, ay=gp.axes[1]||0;
    const st={left:btn(14)||ax<-0.5, right:btn(15)||ax>0.5, up:btn(12)||ay<-0.5, down:btn(13)||ay>0.5,
      a:btn(0), b:btn(1), x:btn(2), y:btn(3), lb:btn(4), rb:btn(5), lt:btn(6), rt:btn(7), start:btn(9)};
    for(const k in st) if(st[k]&&!pv[k]) UI.pad(k);
    Object.assign(pv,st);
  }
}

function pollPads(){
  if(typeof navigator==='undefined'||!navigator.getGamepads) return;
  const list=[];
  for(const gp of navigator.getGamepads()) if(gp&&gp.connected) list.push(gp);
  padNavPoll(list);
  const menuOpen=typeof UI!=='undefined'&&!!UI.cur; // поки відкрите меню, бійцям ввід не передаємо
  for(let i=0;i<2;i++){
    const gp=list[i];
    padConnected[i]=!!gp;
    if(!gp){ padInputs[i]=null; padPrev[i]={}; continue; }
    const btn=j=>!!(gp.buttons[j]&&gp.buttons[j].pressed);
    const ax=gp.axes[0]||0;
    let mv=0;
    if(ax<-0.35||btn(14)) mv=-1;
    else if(ax>0.35||btn(15)) mv=1;
    const ab=[];
    for(let k=0;k<4;k++){
      const b=PAD_AB[k];
      ab[k]=btn(b)&&!padPrev[i][b];
    }
    const lt=gp.buttons[6];
    padInputs[i]={
      mv,
      jump:btn(12)||(gp.axes[1]||0)<-0.5,
      block:btn(4)||btn(6)||!!(lt&&lt.value>0.5),
      ab,
      form:btn(5)&&!padPrev[i][5],                 // R1 — зміна форми друїда
      ult:btn(7)&&!padPrev[i][7],                  // R2 — ультимейт
    };
    if(menuOpen) padInputs[i]=null;
    if(btn(9)&&!padPrev[i][9]&&!menuOpen) togglePause(); // Start (у меню Start обробляє інтерфейс)
    for(const b of [0,1,2,3,4,5,6,7,9,12]) padPrev[i][b]=btn(b);
  }
}

