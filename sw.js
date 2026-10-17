"use strict";
/* ============================================================
   SERVICE WORKER «Азерот Арени»: гра працює без мережі й не застряє в застарілому кеші GitHub Pages.
   Версії файлів вручну вести не треба — стратегія така:
   • код і розмітка (index.html, js/*, css/*, маніфест) — спершу мережа з перевіркою ETag, а коли її нема чи вона
     відповідає довше за NET_WAIT, — копія з кешу. Оновлення на сайті видно з першого ж відкриття;
   • важкі файли (картинки, шрифти, набори деталей img/cutout/*.js) — миттєво з кешу, а свіжу копію
     докачуємо у фоні (відкриття не чекає, а наступне вже бачить зміну).
   Усе, що гравець колись бачив, лишається в кеші: грати можна й без Wi-Fi.
   VERSION міняємо, лише якщо змінюється логіка цього файла: старі кеші тоді видаляються.
   ============================================================ */
const VERSION='v1';
const SHELL='aa-shell-'+VERSION, ASSETS='aa-assets-'+VERSION;
const NET_WAIT=3500;                        // стільки чекаємо мережу, маючи копію в кеші
const INDEX=new URL('index.html',self.registration.scope).href;

// що завантажувати наперед: сам index.html й усе, на що він посилається (скрипти, стилі, іконки, шрифти з fonts.css…)
async function precacheList(){
  const res=await fetch(INDEX,{cache:'reload'});
  const html=await res.clone().text();
  const base=INDEX, urls=new Set(), add=u=>{ try{ const x=new URL(u,base); if(x.origin===location.origin) urls.add(x.href.split('#')[0]); }catch(e){} };
  for(const m of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) add(m[1]);
  // шрифти — з fonts.css, картинки меню — з style.css (url(...) відносно самого файла)
  for(const css of [...urls].filter(u=>u.endsWith('.css'))){
    try{
      const t=await (await fetch(css,{cache:'reload'})).text();
      for(const m of t.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) if(!m[1].startsWith('data:')) urls.add(new URL(m[1],css).href);
    }catch(e){}
  }
  // іконки застосунку — з маніфесту
  for(const mf of [...urls].filter(u=>u.endsWith('.webmanifest'))){
    try{ const j=await (await fetch(mf,{cache:'reload'})).json(); for(const i of j.icons||[]) urls.add(new URL(i.src,mf).href); }catch(e){}
  }
  return {res,urls:[...urls]};
}

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const cache=await caches.open(SHELL), assets=await caches.open(ASSETS);
    try{
      const {res,urls}=await precacheList();
      await cache.put(INDEX,res);
      // шрифти, картинки й шар меню — у «важкий» кеш, решта — у кеш коду. Збій одного файла не зриває встановлення
      await Promise.all(urls.map(async u=>{
        try{ const r=await fetch(u,{cache:'reload'}); if(r.ok) await (isCode(u)?cache:assets).put(u,r); }catch(e){}
      }));
    }catch(err){ /* нема мережі під час встановлення — кеш наповниться, коли гравець зіграє онлайн */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys()) if(k.startsWith('aa-')&&k!==SHELL&&k!==ASSETS) await caches.delete(k);
    await self.clients.claim();
  })());
});

// код: html, js, css, маніфест. Набори деталей бійців (img/cutout/*.js) — теж .js, але важкі й майже незмінні
const isCode=u=>{ const p=new URL(u).pathname; return /\.(html|css|webmanifest)$/.test(p)||(/\.js$/.test(p)&&!/\/img\/cutout\//.test(p))||p.endsWith('/'); };

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET'||req.headers.has('range')) return;
  const url=new URL(req.url);
  if(url.origin!==location.origin||url.pathname.endsWith('/ws')||url.pathname==='/net-info') return;   // чужі запити й сервер мережевої гри — не чіпаємо
  if(req.mode==='navigate') e.respondWith(networkFirst(e,INDEX,true));
  else if(isCode(req.url)) e.respondWith(networkFirst(e,req.url,false));
  else e.respondWith(staleWhileRevalidate(e));
});

// записати відповідь у кеш; подія могла вже завершитись (мережа програла гонку з таймером) — тоді просто пишемо без waitUntil
function store(e,cache,key,res){
  const p=cache.put(key,res.clone()).catch(()=>{});
  try{ e.waitUntil(p); }catch(err){}
}

async function networkFirst(e,key,nav){
  const cache=await caches.open(SHELL);
  const cached=await cache.match(key,{ignoreSearch:nav});   // ?perf, ?touch=1 — та сама сторінка
  const net=fetch(nav?INDEX:key,{cache:'no-cache'}).then(res=>{
    if(res.ok) store(e,cache,key,res);
    return res;
  });
  if(!cached) return net;
  net.catch(()=>{});                                          // мережа програла гонку — її збій нікого не цікавить
  return Promise.race([net,new Promise((_,rej)=>setTimeout(rej,NET_WAIT))]).then(res=>res.ok?res:cached,()=>cached);
}

async function staleWhileRevalidate(e){
  const cache=await caches.open(ASSETS), req=e.request;
  const cached=await cache.match(req);
  const net=fetch(req).then(res=>{ if(res.ok) store(e,cache,req,res); return res; });
  if(cached){ net.catch(()=>{}); return cached; }
  return net;
}
