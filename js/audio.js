"use strict";

/* ============================================================
   ЗВУК (WebAudio, синтезовані ефекти)
   ============================================================ */
let AC=null, muted=false;
function ac(){ if(!AC){ try{ AC=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return AC; }
function sfx(kind){
  if(NET.host){ NET.sfxQ.push(kind); if(NET.sfxQ.length>24) NET.sfxQ.shift(); } // звуки бою чує й гість (їдуть у знімку)
  if(muted) return;
  const c=ac(); if(!c) return;
  if(c.state==='suspended') c.resume();
  const t=c.currentTime, o=c.createOscillator(), g=c.createGain();
  o.connect(g); g.connect(c.destination);
  const P={
    hit:   ()=>{o.type='square';  o.frequency.setValueAtTime(220,t); o.frequency.exponentialRampToValueAtTime(70,t+.12); g.gain.setValueAtTime(.12,t); g.gain.exponentialRampToValueAtTime(.001,t+.14); o.start(t); o.stop(t+.15);},
    cast:  ()=>{o.type='sine';    o.frequency.setValueAtTime(340,t); o.frequency.exponentialRampToValueAtTime(760,t+.1); g.gain.setValueAtTime(.07,t); g.gain.exponentialRampToValueAtTime(.001,t+.14); o.start(t); o.stop(t+.15);},
    heal:  ()=>{o.type='triangle';o.frequency.setValueAtTime(520,t); o.frequency.exponentialRampToValueAtTime(880,t+.2); g.gain.setValueAtTime(.09,t); g.gain.exponentialRampToValueAtTime(.001,t+.26); o.start(t); o.stop(t+.27);},
    big:   ()=>{o.type='sawtooth';o.frequency.setValueAtTime(160,t); o.frequency.exponentialRampToValueAtTime(45,t+.28); g.gain.setValueAtTime(.16,t); g.gain.exponentialRampToValueAtTime(.001,t+.32); o.start(t); o.stop(t+.33);},
    ko:    ()=>{o.type='sawtooth';o.frequency.setValueAtTime(300,t); o.frequency.exponentialRampToValueAtTime(40,t+.6);  g.gain.setValueAtTime(.18,t); g.gain.exponentialRampToValueAtTime(.001,t+.65); o.start(t); o.stop(t+.66);},
    tick:  ()=>{o.type='square';  o.frequency.setValueAtTime(880,t); o.frequency.exponentialRampToValueAtTime(660,t+.04); g.gain.setValueAtTime(.035,t); g.gain.exponentialRampToValueAtTime(.001,t+.05); o.start(t); o.stop(t+.06);},
    ok:    ()=>{o.type='triangle';o.frequency.setValueAtTime(440,t); o.frequency.setValueAtTime(660,t+.06); g.gain.setValueAtTime(.08,t); g.gain.exponentialRampToValueAtTime(.001,t+.16); o.start(t); o.stop(t+.17);},
    lock:  ()=>{o.type='sawtooth';o.frequency.setValueAtTime(220,t); o.frequency.exponentialRampToValueAtTime(880,t+.12); g.gain.setValueAtTime(.1,t); g.gain.exponentialRampToValueAtTime(.001,t+.3); o.start(t); o.stop(t+.31);},
    round: ()=>{o.type='triangle';o.frequency.setValueAtTime(392,t); o.frequency.setValueAtTime(523,t+.12); o.frequency.setValueAtTime(659,t+.24); g.gain.setValueAtTime(.1,t); g.gain.exponentialRampToValueAtTime(.001,t+.5); o.start(t); o.stop(t+.5);},
  };
  (P[kind]||P.hit)();
}

