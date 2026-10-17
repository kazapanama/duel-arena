"use strict";
/* ============================================================
   ЗАСТОСУНОК (PWA): service worker для офлайну й кнопка «Встановити».
   Service worker (sw.js) працює лише в безпечному контексті — на https (GitHub Pages) і localhost. Локально
   (localhost, 127.0.0.1) його не вмикаємо, щоб правки в коді не губилися в кеші; перевірити можна з ?pwa.
   Гра по локальній мережі (http://192.168.…) — не безпечний контекст, там кешу нема, і це нормально.
   ============================================================ */
const PWA={prompt:null,standalone:matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches||!!navigator.standalone};

if('serviceWorker' in navigator){
  const dev=/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)&&!/[?&]pwa\b/.test(location.search);
  if(!dev) addEventListener('load',()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); });
  else navigator.serviceWorker.getRegistrations().then(l=>l.forEach(r=>r.unregister())).catch(()=>{});   // лишився від ?pwa — прибираємо
}

// «Встановити на пристрій» у налаштуваннях: лише коли браузер дозволяє (Chrome/Edge/Android) і застосунок ще не встановлено
function pwaSyncUi(){
  const btn=document.getElementById('installBtn'), hint=document.getElementById('iosHint');
  if(btn) btn.classList.toggle('hidden',!PWA.prompt||PWA.standalone);
  const dl=document.getElementById('dlBtn'); if(dl) dl.classList.toggle('hidden',PWA.standalone);   // на титулі — завжди, поки гру не встановлено
  // Safari на iPhone/iPad не вміє запит на встановлення — лише «Поділитися → На початковий екран»
  const ios=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(hint) hint.classList.toggle('hidden',!ios||PWA.standalone);
}
addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); PWA.prompt=e; pwaSyncUi(); });
addEventListener('appinstalled',()=>{ PWA.prompt=null; PWA.standalone=true; pwaSyncUi(); });
function pwaInstall(){
  const p=PWA.prompt;
  if(!p){ pwaHowTo(); return; }   // браузер не вміє запит (iPhone, Firefox…) — показуємо, де це робиться вручну
  PWA.prompt=null; pwaSyncUi();
  p.prompt(); p.userChoice.catch(()=>{});
}
function pwaHowTo(){
  const ua=navigator.userAgent, ios=/iP(hone|ad|od)/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const t=ios?(/EdgiOS/.test(ua)?'Edge на iPhone/iPad: натисни кнопку меню (три крапки) унизу екрана → «Поділитися» → «На початковий екран» → «Додати».'
      :'Safari на iPhone/iPad: натисни «Поділитися» (квадрат зі стрілкою) → «На початковий екран» → «Додати».')
      +' Якщо пункту нема в меню Edge — відкрий цю сторінку в Safari й зроби так само.'
    :/Android/.test(ua)?'Натисни кнопку меню (три крапки) вгорі браузера → «Встановити застосунок» (або «Додати на головний екран»).'
    :'Натисни значок встановлення в адресному рядку або меню браузера → «Встановити Азерот Арена» (в Edge: меню → «Застосунки»).';
  document.getElementById('instText').textContent=t+' Після цього гра відкриватиметься на весь екран і працюватиме без мережі.';
  show('install');
}
pwaSyncUi();

/* Офлайн-запас: іконки, картинки арен і набори деталей бійців, які гравець міг ще не відкривати. Підвантажуємо їх у
   вільний час, коли сторінка вже під контролем service worker-а (він кладе відповіді в кеш). Що вже в кеші — пропускаємо,
   тож повторний запуск нічого не качає. */
function pwaAssetList(){
  const set=new Set(), add=u=>{ if(u&&typeof u==='string') set.add(encodeURI(u)); };
  const ab=a=>{ if(a) add(a.img); };
  for(const c of CLASSES){
    add(c.img); ab(c.classAb);
    for(const s of c.specs){
      add(s.img); (s.abilities||[]).forEach(ab); ab(s.classAb); (s.meta||[]).forEach(ab);
      if(s.form){ add(s.form.img); add(s.form.baseImg); (s.form.abilities||[]).forEach(ab); ab(s.form.classAb); }
      for(const k of s.skins){ if(k.cutout) set.add('img/cutout/'+k.cutout+'.js'); if(k.formCutout) set.add('img/cutout/'+k.formCutout+'.js'); }
    }
  }
  for(const k in ULTS) add(ULTS[k].img);
  for(const t of THEMES){ add(t.thumb); add(t.img); }
  if(typeof PET_CUTOUT!=='undefined') for(const k in PET_CUTOUT) set.add('img/cutout/'+PET_CUTOUT[k]+'.js');
  set.add('img/cutout/fx_frog.js'); set.add('img/cutout/form_demon.js');
  return [...set];
}
async function pwaWarm(){
  // ~9 МБ: лише там, де це нікому не коштує, — не на мобільному інтернеті, не на повільному зв'язку й не з «Економією даних»
  const conn=navigator.connection;
  if(conn&&(conn.saveData||conn.type==='cellular'||(conn.effectiveType&&conn.effectiveType!=='4g'))) return;
  if(!('caches' in window)||!navigator.serviceWorker||!navigator.serviceWorker.controller) return;
  const todo=[];
  for(const u of pwaAssetList()) if(!(await caches.match(u))) todo.push(u);
  const worker=async()=>{ for(let u; (u=todo.shift());){ try{ await fetch(u); }catch(e){ return; } } };   // нема мережі — далі не пробуємо
  await Promise.all([worker(),worker()]);
}
addEventListener('load',()=>setTimeout(()=>warmIdle(()=>pwaWarm().catch(()=>{})),6000));   // warmIdle — з ui.js
