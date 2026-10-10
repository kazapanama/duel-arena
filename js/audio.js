"use strict";

/* ============================================================
   ЗВУК (WebAudio, синтезовані ефекти)
   ============================================================ */
let AC=null, muted=false;
function ac(){ if(!AC){ try{ AC=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return AC; }
function sfx(kind){
  if(NET.sim){ NET.sfxQ.push(kind); if(NET.sfxQ.length>24) NET.sfxQ.shift(); return; } // бій на сервері: звуки їдуть гравцям у знімку
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
    ult:   ()=>{o.type='sawtooth';o.frequency.setValueAtTime(110,t); o.frequency.exponentialRampToValueAtTime(880,t+.45); g.gain.setValueAtTime(.001,t); g.gain.exponentialRampToValueAtTime(.16,t+.3); g.gain.exponentialRampToValueAtTime(.001,t+.6); o.start(t); o.stop(t+.62); noiseHit(c,t+.42,.35,.5);},
    round: ()=>{o.type='triangle';o.frequency.setValueAtTime(392,t); o.frequency.setValueAtTime(523,t+.12); o.frequency.setValueAtTime(659,t+.24); g.gain.setValueAtTime(.1,t); g.gain.exponentialRampToValueAtTime(.001,t+.5); o.start(t); o.stop(t+.5);},
  };
  (P[kind]||P.hit)();
}

/* ---------- шум: удари барабана й «бум» ---------- */
let NOISE=null;
function noiseHit(c,t,v,dur,f=900){
  if(!NOISE){ NOISE=c.createBuffer(1,c.sampleRate,c.sampleRate); const d=NOISE.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }
  const n=c.createBufferSource(), fl=c.createBiquadFilter(), g=c.createGain();
  n.buffer=NOISE; fl.type='lowpass'; fl.frequency.setValueAtTime(f,t); fl.frequency.exponentialRampToValueAtTime(80,t+dur);
  g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  n.connect(fl); fl.connect(g); g.connect(c.destination); n.start(t); n.stop(t+dur+0.05);
  // низький «кік» під шумом
  const o=c.createOscillator(), og=c.createGain(); o.type='sine';
  o.frequency.setValueAtTime(140,t); o.frequency.exponentialRampToValueAtTime(40,t+dur*0.6);
  og.gain.setValueAtTime(v*0.9,t); og.gain.exponentialRampToValueAtTime(0.001,t+dur*0.7);
  o.connect(og); og.connect(c.destination); o.start(t); o.stop(t+dur);
}

/* ============================================================
   СТІНГИ: короткі музичні фрази для екрана VS, перемоги й поразки
   ============================================================ */
function sting(kind){
  if(muted) return;
  const c=ac(); if(!c) return;
  if(c.state==='suspended') c.resume();
  const t0=c.currentTime+0.03;
  const note=(f,t,d,type='sawtooth',v=0.08)=>{
    const o=c.createOscillator(), g=c.createGain(), fl=c.createBiquadFilter();
    o.type=type; o.frequency.setValueAtTime(f,t0+t);
    fl.type='lowpass'; fl.frequency.setValueAtTime(type==='sawtooth'?2400:6000,t0+t);
    g.gain.setValueAtTime(0.0001,t0+t); g.gain.exponentialRampToValueAtTime(v,t0+t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t0+t+d);
    o.connect(fl); fl.connect(g); g.connect(c.destination); o.start(t0+t); o.stop(t0+t+d+0.05);
  };
  switch(kind){
    case 'vs': // барабанний розгін і важкий акорд саме тоді, коли падає «VS» (0.7 с)
      for(const [t,v] of [[0,0.35],[0.24,0.4],[0.42,0.45],[0.54,0.5]]) noiseHit(c,t0+t,v,0.18);
      noiseHit(c,t0+0.7,0.8,0.7,1400);
      for(const f of [55,110,164.8,220]) note(f,0.7,1.3,'sawtooth',f<100?0.12:0.07);
      note(440,0.7,0.35,'square',0.05); note(659.3,0.78,0.3,'square',0.04);
      break;
    case 'win': // фанфара: арпеджіо до-мажору вгору й довгий акорд
      [[523.3,0],[659.3,0.13],[784,0.26]].forEach(([f,t])=>note(f,t,0.25,'square',0.06));
      for(const f of [1046.5,784,659.3]) note(f,0.4,1.1,'triangle',0.07);
      note(130.8,0.4,1.1,'sawtooth',0.08);
      noiseHit(c,t0+0.4,0.45,0.4,1200);
      break;
    case 'lose': // повільний мінорний спуск
      [[440,0],[392,0.28],[349.2,0.56]].forEach(([f,t])=>note(f,t,0.32,'triangle',0.07));
      note(329.6,0.84,1.2,'triangle',0.07); note(110,0.84,1.2,'sawtooth',0.06); note(82.4,0.84,1.2,'sine',0.1);
      noiseHit(c,t0+0.84,0.3,0.6,500);
      break;
  }
}
