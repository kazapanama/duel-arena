"use strict";
/* ============================================================
   ДАНІ: 10 класів × 3 спеки × (1 класова + 3 спекові здібності)
   ============================================================ */
const mk = {
  melee:(name,icon,cd,dmg,o={})=>({name,icon,cd,type:'melee',dmg,...o}),
  proj:(name,icon,cd,dmg,o={})=>({name,icon,cd,type:'proj',dmg,speed:o.speed??750,psize:o.psize??10,...o}),
  multi:(name,icon,cd,dmg,count,o={})=>({name,icon,cd,type:'multi',dmg,count,speed:o.speed??820,psize:o.psize??8,...o}),
  heal:(name,icon,cd,amount,o={})=>({name,icon,cd,type:'heal',amount,...o}),
  shield:(name,icon,cd,amount,dur,o={})=>({name,icon,cd,type:'shield',amount,dur,...o}),
  buff:(name,icon,cd,dur,o={})=>({name,icon,cd,type:'buff',dur,...o}),
  aoe:(name,icon,cd,dmg,radius,o={})=>({name,icon,cd,type:'aoe',dmg,radius,...o}),
  zone:(name,icon,cd,dps,radius,dur,o={})=>({name,icon,cd,type:'zone',dps,radius,dur,...o}),
  dash:(name,icon,cd,o={})=>({name,icon,cd,type:'dash',...o}),
  tele:(name,icon,cd,mode,o={})=>({name,icon,cd,type:'tele',mode,...o}),
  pull:(name,icon,cd,o={})=>({name,icon,cd,type:'pull',...o}),
  stealth:(name,icon,cd,dur,o={})=>({name,icon,cd,type:'stealth',dur,...o}),
  curse:(name,icon,cd,o={})=>({name,icon,cd,type:'curse',...o}),
  pet:(name,icon,cd,dur,o={})=>({name,icon,cd,type:'pet',dur,...o}),
  knock:(name,icon,cd,dmg,radius,o={})=>({name,icon,cd,type:'knock',dmg,radius,...o}),
  leap:(name,icon,cd,dmg,radius,o={})=>({name,icon,cd,type:'leap',dmg,radius,...o}),
  // канал: тіки шкоди по ворогу з лікуванням собі, поки заклинач стоїть на місці
  drain:(name,icon,cd,dmg,o={})=>({name,icon,cd,type:'drain',dmg,...o}),
  // пастка під ногами: зводиться за arm с, чекає life с; ворог, що на неї ступить (не перестрибне), замерзає на freeze с
  trap:(name,icon,cd,o={})=>({name,icon,cd,type:'trap',...o}),
};

/* Порядок здібностей спеку: [X спам-атака, Y сильна/кастована, B утиліта].
   Кнопка A (слот 4) — класова мобільність, АБО власна здібність спеку (spec.classAb). */
const CLASSES = [
{ id:'warrior', name:'Воїн', em:'🪓', color:'#C69B6D',
  classAb: mk.dash('Charge','💨',6,{toEnemy:true,dmg:40,stun:0.5}),
  specs:[
   { name:'Arms', em:'⚔️', role:'Бій', abilities:[
     mk.melee('Overpower','🗡️',1.2,55),
     mk.melee('Mortal Strike','⚔️',6,150,{dot:{dps:15,dur:4}}),
     mk.melee('Hamstring','🦵',6,48,{slow:{mult:0.5,dur:4}}),   // Bladestorm — ультимейт Arms
   ]},
   { name:'Fury', em:'🔥', role:'Бій',
     classAb: mk.dash('Intercept','💨',9,{toEnemy:true,dmg:40,stun:0.6}),
     abilities:[
     mk.melee('Heroic Strike','👊',1.1,57),
     mk.melee('Bloodthirst','🩸',5,148,{selfHeal:50}),
     mk.buff('Recklessness','😡',15,6,{dmgMult:1.35,spdMult:1.15}),
   ]},
   { name:'Protection', em:'🛡️', role:'Танк',
     classAb: mk.aoe('Intimidating Shout','😱',14,20,170,{fear:{dur:1.6,brk:60}}),
     abilities:[
     mk.melee('Shield Slam','🛡️',1.3,58,{knockback:90}),
     mk.aoe('Thunder Clap','⛈️',6,95,155,{slow:{mult:0.5,dur:3}}),
     mk.shield('Shield Block','🔰',12,190,6),
   ]},
  ]},
{ id:'paladin', name:'Паладін', em:'🔨', color:'#F48CBA',
  classAb: mk.heal('Flash of Light','💛',9,90,{cast:1.0}),   // загальна для паладинів: короткий каст, невелике лікування
  specs:[
   { name:'Holy', em:'🌟', role:'Лікар', abilities:[
     mk.proj('Holy Shock','✨',1.5,60,{selfHeal:15,pcolor:'#fff2b0',speed:900}),
     mk.heal('Holy Light','✨',10,210,{cast:1.5}),
     mk.aoe('Holy Wrath','🔆',9,150,170),
   ]},
   { name:'Protection', em:'🛡️', role:'Танк',
     classAb: mk.curse('Hammer of Justice','🔨',12,{dmg:35,stun:1.2,range:360}),
     abilities:[
     mk.melee('Hammer of the Righteous','🔨',1.2,66,{selfHeal:8}),
     mk.proj("Avenger's Shield",'🛡️',6,162,{stun:0.8,speed:920,pcolor:'#9fd7ff',psize:13}),
     mk.zone('Consecration','🔥',9,70,135,5,{at:'self',zcolor:'#ffd97a'}),
   ]},
   { name:'Retribution', em:'⚔️', role:'Бій', abilities:[
     mk.melee('Crusader Strike','⚔️',1.2,60),
     mk.melee('Divine Storm','🌀',6,185,{range:105}),   // удар із розвороту — трохи довший
     mk.buff('Avenging Wrath','😇',15,6,{dmgMult:1.25,selfHeal:40,wings:true}),   // поки діє — золоті крила
   ]},
  ]},
{ id:'hunter', name:'Мисливець', em:'🏹', color:'#AAD372',
  classAb: mk.dash('Disengage','🦘',5,{back:true,dist:280}),
  specs:[
   { name:'Beast Mastery', em:'🐻', role:'Бій',
     classAb: mk.curse('Intimidation','🐺',12,{dmg:25,stun:1.0,range:520}),
     abilities:[
     mk.proj('Arcane Shot','✴️',1.3,50,{speed:880,pcolor:'#c9a8ff'}),
     mk.proj('Kill Command','🐺',5,135,{speed:1100,pcolor:'#ff8866',psize:13}),
     mk.pet('Call Pet','🐺',14,10,{pkind:'wolf',pdmg:15,pcd:1.25}),
   ]},
   { name:'Marksmanship', em:'🎯', role:'Бій', abilities:[
     mk.proj('Steady Shot','🏹',1.3,58,{speed:880,pcolor:'#d8e8ff'}),
     mk.proj('Aimed Shot','🎯',5,240,{cast:0.85,speed:900,psize:14,pcolor:'#e8f2ff'}),
     mk.buff('Rapid Fire','🏹',15,6,{haste:1.45}),   // швидкість стрільби: відкати йдуть швидше
   ]},
   /* Survival у 3.3.5 — дальній бій і контроль: Explosive Shot, отрути, пастка й сон Wyvern Sting (замість відскоку) */
   { name:'Survival', em:'💥', role:'Бій',
     classAb: mk.curse('Wyvern Sting','🐉',18,{sleep:{dur:2,dot:{dps:8,dur:6}},range:560}),
     abilities:[
     mk.proj('Serpent Sting','🐍',1.3,32,{dot:{dps:10,dur:3},speed:880,pcolor:'#9dff70'}),
     mk.proj('Explosive Shot','💥',6,70,{boom:{n:2,dmg:36,every:0.8},speed:950,psize:12,pcolor:'#ffae42'}),
     mk.trap('Freezing Trap','❄️',14,{freeze:3,arm:0.5,life:12,r:44}),
   ]},
  ]},
{ id:'rogue', name:'Розбійник', em:'🗡️', color:'#FFF468',
  classAb: mk.tele('Shadowstep','👣',5,'behind',{gcd:0}),   // без глобального КД: одразу можна бити
  specs:[
   { name:'Assassination', em:'☠️', role:'Бій',
     classAb: mk.melee('Kidney Shot','👊',12,30,{stun:1.0}),
     abilities:[
     mk.melee('Mutilate','🔪',1.2,50,{dot:{dps:8,dur:3}}),
     mk.melee('Envenom','🧪',5,125,{dot:{dps:18,dur:4}}),
     mk.buff('Hunger For Blood','🩸',15,6,{dmgMult:1.4}),
   ]},
   { name:'Combat', em:'⚔️', role:'Бій',   // у 3.3.5 Outlaw ще звався Combat
     classAb: mk.dash('Sprint','💨',6,{move:true,dist:340}),
     abilities:[
     mk.melee('Sinister Strike','🗡️',1.1,58),
     mk.proj('Deadly Throw','🔪',4,115,{slow:{mult:0.6,dur:2},speed:1000,pcolor:'#ffdf8a'}),
     mk.buff('Adrenaline Rush','⚡',15,6,{spdMult:1.4,dmgMult:1.25}),
   ]},
   { name:'Subtlety', em:'🌑', role:'Бій', abilities:[
     mk.melee('Backstab','🗡️',1.2,60),
     mk.melee('Eviscerate','🔪',5,190),
     mk.stealth('Shadow Dance','🌫️',11,5,{dmgMult:1.3}),
   ]},
  ]},
{ id:'priest', name:'Жрець', em:'✨', color:'#eeeeee',
  classAb: mk.heal('Flash Heal','💚',9,100,{cast:1.0}),   // Discipline і Holy: швидке невелике лікування (Shadow має Dispersion)
  specs:[
   { name:'Discipline', em:'🛡️', role:'Лікар',
     classAb: mk.aoe('Psychic Scream','😱',14,20,170,{fear:{dur:1.6,brk:60}}),
     abilities:[
     mk.proj('Smite','✨',1.5,54,{pcolor:'#fff6cf',speed:820}),
     mk.multi('Penance','🌠',6,52,3,{pcolor:'#ffe9a3',chan:{dur:1.5}}),
     mk.shield('Power Word: Shield','🔮',12,170,8),
   ]},
   { name:'Holy', em:'🌟', role:'Лікар', abilities:[
     mk.proj('Holy Fire','🔥',1.45,51,{dot:{dps:11,dur:3},pcolor:'#ffd070'}),
     mk.heal('Greater Heal','💛',10,260,{cast:1.5}),   // Flash Heal — у слоті A, тут велике повільне лікування
     mk.aoe('Holy Nova','✨',9,90,170,{selfHeal:60}),
   ]},
   { name:'Shadow', em:'🌑', role:'Бій', abilities:[
     mk.drain('Mind Flay','🌀',1.4,21,{chan:{dur:0.75,ticks:3},slow:{mult:0.55,dur:1.2},pcolor:'#b48cff'}),   // канал: три тіки й сповільнення
     mk.proj('Mind Blast','💥',6,180,{cast:0.9,speed:900,pcolor:'#8a5cff',psize:13}),
     mk.curse('Shadow Word: Pain','🕳️',8,{dot:{dps:22,dur:6}}),
   ],
     classAb: mk.buff('Dispersion','🌫️',12,3,{dmgTakenMult:0.4,spdMult:1.25,disperse:true}),   // тінь: менше шкоди, прохід крізь ворога
   },
  ]},
{ id:'dk', name:'Лицар смерті', em:'💀', color:'#C41E3A',
  classAb: mk.pull('Death Grip','🪤',8,{dmg:20,stun:0.6}),
  specs:[
   { name:'Blood', em:'🩸', role:'Танк', abilities:[
     mk.melee('Heart Strike','🫀',1.3,52),
     mk.melee('Death Strike','⚰️',5,120,{selfHeal:45}),
     mk.shield('Vampiric Blood','🦇',16,160,8),
   ]},
   { name:'Frost', em:'❄️', role:'Бій',
     classAb: mk.curse('Chains of Ice','⛓️',9,{dmg:20,slow:{mult:0.35,dur:3},range:520}),
     abilities:[
     mk.melee('Frost Strike','🗡️',1.2,56),
     mk.melee('Obliterate','⚔️',5,180),
     mk.buff('Unbreakable Armor','🧊',15,6,{dmgMult:1.3,dmgTakenMult:0.8}),
   ]},
   { name:'Unholy', em:'🧟', role:'Бій',
     classAb: mk.zone('Death and Decay','💀',12,40,140,5,{at:'enemy',zkind:'dnd',slow:{mult:0.5,dur:1},zcolor:'#6aff5a'}),   // осквернена земля під ворогом; сповільнення — як із гліфом Glyph of Death and Decay
     abilities:[
     mk.melee('Scourge Strike','🦠',1.2,54,{dot:{dps:8,dur:3}}),
     mk.proj('Death Coil','🟢',5,120,{pcolor:'#7cff6b'}),
     mk.pet('Raise Dead','🧟',14,9,{pkind:'ghoul',pdmg:15,pcd:1.25}),
   ]},
  ]},
{ id:'shaman', name:'Шаман', em:'⚡', color:'#0070DD',
  classAb: mk.buff('Ghost Wolf','🐺',8,3,{spdMult:1.45}),
  specs:[
   /* Thunderstorm відносить ворога дугою: поки він летить і встає — встигаєш скастувати Lava Burst */
   { name:'Elemental', em:'🌋', role:'Бій',
     classAb: mk.knock('Thunderstorm','🌩️',12,30,175,{toss:{v:600,vy:-640},gcd:0.15,wall:{dmg:30,stun:0.7}}),
     abilities:[
     mk.proj('Lightning Bolt','⚡',1.4,48,{speed:950,pcolor:'#8fd0ff'}),
     mk.proj('Lava Burst','☄️',6,175,{cast:1.0,dot:{dps:12,dur:3},speed:1300,pcolor:'#ff7733',psize:13}),
     mk.zone('Magma Totem','🔥',11,38,140,5,{at:'self',zkind:'magma',zcolor:'#ff7733'}),   // тотем біля ніг: тримає ближній бій на відстані
   ]},
   { name:'Enhancement', em:'🐺', role:'Бій', abilities:[
     mk.melee('Stormstrike','⚡',1.2,66),
     mk.melee('Lava Lash','🔥',5,172,{dot:{dps:12,dur:3}}),
     mk.pet('Feral Spirit','🐺',15,8,{pkind:'spiritwolf',pdmg:12,pcd:1.3}),
   ]},
   { name:'Restoration', em:'💧', role:'Лікар', abilities:[
     mk.proj('Lightning Bolt','⚡',1.35,57,{speed:950,pcolor:'#8fd0ff'}),
     mk.heal('Healing Wave','💙',9,225,{cast:1.1}),
     mk.heal('Riptide','🌊',8,50,{hot:{tick:12,dur:5}}),
   ]},
  ]},
{ id:'mage', name:'Маг', em:'🧙', color:'#3FC7EB',
  classAb: mk.tele('Blink','💫',6,'move',{dist:300}),
  specs:[
   { name:'Arcane', em:'🔮', role:'Бій', abilities:[
     mk.proj('Arcane Blast','🔮',1.4,52,{pcolor:'#c9a8ff'}),
     mk.multi('Arcane Barrage','🌌',6,45,4,{pcolor:'#b48cff'}),
     mk.buff('Arcane Power','⚛️',15,6,{dmgMult:1.4}),
   ]},
   { name:'Fire', em:'🔥', role:'Бій',
     classAb: mk.knock("Dragon's Breath",'🐉',12,50,0,{front:true,range:210,push:0,stun:1.0,pcolor:'#ff9440'}),
     abilities:[
     mk.proj('Fire Blast','🔥',1.4,46,{dot:{dps:8,dur:2},pcolor:'#ff9440'}),
     mk.proj('Pyroblast','☄️',7,235,{cast:1.3,speed:560,psize:16,pcolor:'#ff6a2a'}),
     mk.buff('Presence of Mind','⏳',15,10,{instantCast:true}),   // наступний Pyroblast — без касту
   ]},
   { name:'Frost', em:'❄️', role:'Бій',
     classAb: mk.shield('Ice Barrier','🧊',14,115,6),
     abilities:[
     mk.proj('Ice Lance','🧊',1.4,50,{pcolor:'#aee8ff'}),
     mk.proj('Frostbolt','❄️',6,212,{cast:1.0,slow:{mult:0.6,dur:2.5},speed:700,psize:15,pcolor:'#aee8ff'}),
     mk.aoe('Frost Nova','❄️',9,55,160,{root:{dur:2.5,kind:'ice'}}),
   ]},
  ]},
{ id:'warlock', name:'Чорнокнижник', em:'😈', color:'#8788EE',
  // замість телепорту — страх: ворог утрачає контроль і тікає від чорнокнижника; шкода його знімає
  classAb: mk.curse('Fear','😱',15,{cast:1.2,fear:{dur:2,brk:70}}),
  specs:[
   { name:'Affliction', em:'🕷️', role:'Бій', abilities:[
     mk.proj('Shadow Bolt','🟣',1.45,51,{pcolor:'#a878ff'}),
     mk.drain('Drain Life','🩸',6,32,{chan:{dur:2.4,ticks:6},healFrac:0.55,pcolor:'#7cff4a'}),   // зелений промінь, як у WoW
     mk.curse('Curse of Agony','😖',8,{dot:{dps:20,dur:6}}),
   ]},
   { name:'Demonology', em:'👿', role:'Бій',
     classAb: mk.tele('Demonic Circle: Teleport','🌀',7,'away',{dist:300}),
     abilities:[
     mk.proj('Immolate','🔥',1.4,46,{dot:{dps:8,dur:3},pcolor:'#ff9440'}),
     mk.proj('Soul Fire','☄️',6,190,{cast:1.0,speed:640,pcolor:'#ff7a2a',psize:14}),
     mk.pet('Summon Felguard','👹',14,10,{pkind:'felguard',pdmg:19,pcd:1.2}),
   ]},
   { name:'Destruction', em:'🔥', role:'Бій',
     classAb: mk.aoe('Shadowfury','🌑',12,40,160,{stun:1.0}),
     abilities:[
     mk.proj('Incinerate','🔥',1.4,45,{dot:{dps:6,dur:2},pcolor:'#ffb03a'}),
     mk.proj('Chaos Bolt','🌈',7,240,{cast:1.4,speed:520,psize:16,pcolor:'#ff5ad0'}),
     mk.proj('Conflagrate','💥',6,90,{stun:0.4,speed:1000,pcolor:'#ffb03a'}),
   ]},
  ]},
{ id:'druid', name:'Друїд', em:'🐾', color:'#FF7C0A',
  classAb: mk.buff('Travel Form','🦌',8,3,{spdMult:1.45}),
  specs:[
   /* Balance: гуманоїд — Moonfire/Regrowth/Roots; форма сови (Moonkin) — Wrath/Starfire/Hurricane (Starfall — ультимейт) */
   { name:'Balance', em:'🌙', role:'Бій', abilities:[
     mk.curse('Moonfire','🌙',6,{dmg:20,dot:{dps:9,dur:6}}),
     mk.heal('Regrowth','🌿',10,150,{cast:1.1,hot:{tick:8,dur:4}}),
     mk.curse('Entangling Roots','🌱',10,{cast:1.2,dmg:15,root:{dur:2.2,kind:'vine'},dot:{dps:8,dur:3}}),
   ],
     form:{ id:'moonkin', name:'Форма сови', em:'🦉', h:118, passive:{dr:0.9,spd:0.92},
       note:'−10% отримуваної шкоди, трохи повільніша',
       abilities:[
         mk.proj('Wrath','🌞',1.4,44,{pcolor:'#ffe27a'}),
         mk.proj('Starfire','⭐',6,150,{cast:1.0,speed:820,psize:13,pcolor:'#b8c8ff'}),
         mk.zone('Hurricane','🌪️',11,24,165,6,{at:'enemy',zkind:'storm',slow:{mult:0.65,dur:1},zcolor:'#cfe9ff'}),
       ],
       // не відскок, а навпаки — вихор відкидає ворога від сови
       classAb: mk.knock('Typhoon','🌪️',14,30,0,{front:true,range:240,push:170}),
     }},
   /* Feral: гуманоїд — Wrath/Regrowth/Roots; форма кота — Shred/Bite/Tiger's Fury/Pounce */
   { name:'Feral', em:'🐱', role:'Бій', abilities:[
     mk.proj('Wrath','🌞',1.5,42,{pcolor:'#ffe27a'}),
     mk.heal('Regrowth','🌿',10,150,{cast:1.1,hot:{tick:8,dur:4}}),
     mk.curse('Entangling Roots','🌱',10,{cast:1.2,dmg:15,root:{dur:2.2,kind:'vine'},dot:{dps:8,dur:3}}),
   ],
     form:{ id:'cat', name:'Форма кота', em:'🐈', h:80, passive:{spd:1.15},
       note:'+15% швидкості, ближній бій',
       abilities:[
         mk.melee('Shred','🐾',1.1,52),
         mk.melee('Ferocious Bite','🐈',5,160),
         mk.buff("Tiger's Fury",'🐯',12,5,{dmgMult:1.35,spdMult:1.2}),
       ],
       classAb: mk.dash('Pounce','🐆',7,{toEnemy:true,dmg:30,stun:0.8}),
     }},
   /* Restoration: гуманоїд — Wrath/Regrowth/Barkskin; Дерево життя — міцніше й повільніше, лікує без кастів */
   { name:'Restoration', em:'🌿', role:'Лікар', abilities:[
     mk.proj('Wrath','🌞',1.4,50,{pcolor:'#ffe27a'}),
     mk.heal('Regrowth','🌿',9,190,{cast:1.1,hot:{tick:10,dur:4}}),
     mk.buff('Barkskin','🪵',14,5,{dmgTakenMult:0.55}),
   ],
     form:{ id:'tree', name:'Дерево життя', em:'🌳', h:128, passive:{dr:0.92,spd:0.85},
       note:'−8% отримуваної шкоди, повільніше; лікування без кастів',
       abilities:[
         mk.proj('Wrath','🌞',1.4,46,{pcolor:'#ffe27a'}),
         mk.heal('Wild Growth','🌱',12,60,{hot:{tick:12,dur:5}}),
         mk.curse('Entangling Roots','🌱',10,{cast:1.2,dmg:15,root:{dur:2.2,kind:'vine'},dot:{dps:8,dur:3}}),
       ],
       classAb: mk.heal('Swiftmend','🍃',15,90),
     }},
  ]},
];

/* ============================================================
   УЛЬТИМЕЙТИ: свій для кожного спеку, коли повна супершкала (кнопка O / Num6 / RT).
   Усі — здібності з WotLK 3.3.5. Механіка — у Fighter.runUlt; тут назви, іконки й опис для меню.
   ============================================================ */
const ULTS={
  'warrior/Arms':{name:'Bladestorm',ua:'Буря клинків',icon:'🌪️',ic:'Abilities/Bladestorm.png',
    d:'5с крутишся вихором: кожні 0.45с 36 шкоди довкола. Можна рухатися, контроль не діє; здібності й блок — після бурі'},
  'warrior/Fury':{name:'Death Wish',ua:'Жага смерті',icon:'😤',ic:'Wowhead/spell_shadow_deathpact.png',
    d:'Лютий стрибок на ворога: 90 шкоди й оглушення 0.6с. 8с: більшаєш, +25% шкоди, 12% завданої шкоди лікує, контроль не діє, але отримуєш на 10% більше'},
  'warrior/Protection':{name:'Shockwave',ua:'Ударна хвиля',icon:'🌋',ic:'Wowhead/ability_warrior_shockwave.png',
    d:'Хвиля землею вперед на 420: 150 шкоди й оглушення 2с. Не блокується — лише перестрибнути'},
  'paladin/Holy':{name:'Lay on Hands',ua:'Покладання рук',icon:'🙌',ic:'Wowhead/spell_holy_layonhands.png',
    d:'Миттєво +420 HP; знімає DoT, сповільнення, кайдани й страх'},
  'paladin/Protection':{name:'Divine Shield',ua:'Божественний щит',icon:'🛡️',ic:'Wowhead/spell_holy_divineintervention.png',
    d:'5с золотий купол: жодної шкоди й контролю, знімає негативні ефекти. Бити з-під купола можна'},
  'paladin/Retribution':{name:'Hammer of Wrath',ua:'Молот гніву',icon:'🔨',ic:'Abilities/ThunderClap.png',
    d:'Позначає місце під ворогом; за 0.95с з неба падає молот: 230 шкоди й оглушення 1с. Не блокується — тікай із кола'},
  'hunter/Beast Mastery':{name:'Bestial Wrath',ua:'Звіряча лють',icon:'🐺',ic:'Abilities/FerociousBite.png',
    d:'Вовк лютує 8с (прибіжить, якщо його нема): більший, кусає частіше по 22, укуси сповільнюють і не блокуються. Твоя шкода +10%'},
  'hunter/Marksmanship':{name:'Kill Shot',ua:'Смертельний постріл',icon:'🎯',ic:'Wowhead/ability_hunter_assassinate2.png',
    d:'Стріла на добивання: 120 шкоди + 45% утраченого ворогом здоровʼя, оглушення 0.4с. Не блокується — лише перестрибнути'},
  'hunter/Survival':{name:'Lock and Load',ua:'Заряджай!',icon:'💥',ic:'Wowhead/ability_hunter_lockandload.png',
    d:'Три Explosive Shot поспіль: кожен 55 шкоди й ще два вибухи по 32 на цілі'},
  'rogue/Assassination':{name:'Cold Blood',ua:'Холодна кров',icon:'🧊',ic:'Wowhead/spell_ice_lament.png',
    d:'Ривок і гарантований крит: 150 шкоди (не блокується), Deadly Poison 25/с 6с і Wound Poison — лікування ворога −50% на 8с'},
  'rogue/Combat':{name:'Killing Spree',ua:'Вбивчий шал',icon:'⚔️',ic:'Wowhead/ability_rogue_murderspree.png',
    d:'5 ударів по 42 крізь тіні з різних боків — не блокуються; поки триває, тебе не дістати'},
  'rogue/Subtlety':{name:'Vanish',ua:'Зникнення',icon:'💨',ic:'Wowhead/ability_vanish.png',
    d:'Зникаєш на 1с (тебе не дістати) і зʼявляєшся за спиною: Ambush 180 шкоди й Cheap Shot — оглушення 1.4с. Не блокується'},
  'priest/Discipline':{name:'Mass Dispel',ua:'Масове розвіювання',icon:'💠',ic:'Wowhead/spell_arcane_massdispel.png',
    d:'Хвиля на 380: знімає з ворога бафи, щити й HoT, 110 шкоди й мовчання 3с (без здібностей). З тебе — DoT і контроль, +80 HP'},
  'priest/Holy':{name:'Guardian Spirit',ua:'Дух-охоронець',icon:'👼',ic:'Wowhead/spell_holy_guardianspirit.png',
    d:'10с поруч дух-охоронець: одразу +120 HP, лікування +40%; смертельний удар замість смерті лікує до 400 HP'},
  'priest/Shadow':{name:'Mind Control',ua:'Контроль розуму',icon:'🧠',ic:'Spells/ShadowWordDominate.png',
    d:'90 шкоди й 3с ворог під твоєю волею: не діє, не блокує, бреде геть і отримує на 30% більше шкоди'},
  'dk/Blood':{name:'Dancing Rune Weapon',ua:'Танцівна рунна зброя',icon:'🗡️',ic:'Wowhead/inv_sword_07.png',
    d:'Рунний клинок одразу бʼє на 70 і 10с ширяє поруч: повторює кожен твій удар ближнього бою на 80% шкоди'},
  'dk/Frost':{name:'Howling Blast',ua:'Виючий вибух',icon:'❄️',ic:'Wowhead/spell_frost_arcticwinds.png',
    d:'Крижаний вибух під ворогом: 150 шкоди, підкидає, Frost Fever 15/с 6с і сповільнення. Не блокується'},
  'dk/Unholy':{name:'Army of the Dead',ua:'Армія мертвих',icon:'🧟',ic:'Spells/ArmyOfTheDead.png',
    d:'Четверо гулів по черзі виривають із землі під ворогом: по 55 шкоди й сповільнення'},
  'shaman/Elemental':{name:'Chain Lightning',ua:'Ланцюгова блискавка',icon:'⚡',ic:'Wowhead/spell_nature_chainlightning.png',
    d:'5 розрядів поспіль: чотири по 44 і фінальний 80 з відкиданням; кожен оглушує на 0.3с. Не блокується'},
  'shaman/Enhancement':{name:'Bloodlust',ua:'Жага крові',icon:'🥁',ic:'Wowhead/spell_nature_bloodlust.png',
    d:'8с: відкати вдвічі швидші, глобальний КД удвічі коротший, +25% швидкості, +10% шкоди; перші дві здібності одразу готові'},
  'shaman/Restoration':{name:'Hex',ua:'Пристріт',icon:'🐸',ic:'Wowhead/spell_shaman_hex.png',
    d:'Ворог на 4с стає жабою: не бʼє, не кастує, не блокує, лише повільно скаче (200 шкоди розвіюють чари). Healing Wave одразу готова й без касту'},
  'mage/Arcane':{name:'Mirror Image',ua:'Дзеркальні образи',icon:'🪞',ic:'Wowhead/spell_magic_lesserinvisibilty.png',
    d:'Три копії мага 6с стоять позаду й по черзі кидають Arcane Blast по 18'},
  'mage/Fire':{name:'Living Bomb',ua:'Жива бомба',icon:'💣',ic:'Wowhead/ability_mage_livingbomb.png',
    d:'На ворога чіпляється бомба: горить 14/с, за 3с вибухає — 150 шкоди й підкидає. Не блокується'},
  'mage/Frost':{name:'Deep Freeze',ua:'Глибока заморозка',icon:'🧊',ic:'Wowhead/ability_mage_deepfreeze.png',
    d:'Ворог 2.5с у брилі льоду (оглушення, яке не розбити), потім лід розколюється: 150 шкоди'},
  'warlock/Affliction':{name:'Haunt',ua:'Мара',icon:'👻',ic:'Wowhead/ability_warlock_haunt.png',
    d:'Дух летить у ворога: 130 шкоди; 8с твої DoT на ньому бʼють на 60% сильніше. Коли дух повернеться — +100 HP'},
  'warlock/Demonology':{name:'Metamorphosis',ua:'Метаморфоза',icon:'😈',ic:'Wowhead/spell_shadow_demonform.png',
    d:'10с форма демона: більшаєш, крила, +20% шкоди, −30% отримуваної; Immolation Aura палить усе поруч 20/с'},
  'warlock/Destruction':{name:'Inferno',ua:'Інферно',icon:'🔥',ic:'Spells/SummonInfernal.png',
    d:'Інфернал падає на позначене місце: 150 шкоди, оглушення 1.2с, потім 8с бʼється поруч'},
  'druid/Balance':{name:'Starfall',ua:'Зорепад',icon:'🌠',ic:'Abilities/Starfall.png',
    d:'3с зорепад: 10 зірок по 25 бʼють у ворога й довкола. Не блокується — тікай'},
  'druid/Feral':{name:'Berserk',ua:'Берсерк',icon:'🐆',ic:'Wowhead/ability_druid_berserk.png',
    d:'Стрибок на ворога: 60 шкоди й оглушення 0.6с. 8с у формі кота: більшаєш, здібності кота одразу готові, удари не блокуються й лишають кровотечу 16/с, +30% швидкості, страх і сповільнення не діють'},
  'druid/Restoration':{name:'Tranquility',ua:'Спокій',icon:'🍃',ic:'Wowhead/spell_nature_tranquility.png',
    d:'3с канал на місці: 6 хвиль лікування по 70, потім +12 HP/с 4с. Оглушення перериває'},
};
const ultOf=f=>ULTS[f.cls.id+'/'+f.spec.name];
// снаряди ультимейтів
const ULT_PROJ={
  killShot:mk.proj('Kill Shot','🎯',0,120,{speed:1500,psize:17,pcolor:'#ffe27a',exec:0.45,unblock:true,stun:0.4,knockback:70}),
  explosive:mk.proj('Explosive Shot','💥',0,55,{boom:{n:2,dmg:32,every:0.7},speed:1000,psize:12,pcolor:'#ffae42'}),
  mirror:mk.proj('Arcane Blast','🔮',0,18,{speed:760,psize:9,pcolor:'#c9a8ff'}),
  haunt:mk.proj('Haunt','👻',0,130,{speed:620,psize:14,pcolor:'#c8f0ff',haunt:8}),
};


/* Кольоровий акцент кожного спеку (зброя, аура, підсвітка) */
const SPEC_ACCENT={
  'warrior/Arms':'#ffd23a','warrior/Fury':'#ff5a3a','warrior/Protection':'#9fd7ff',
  'paladin/Holy':'#ffe27a','paladin/Protection':'#9fd7ff','paladin/Retribution':'#ff9440',
  'hunter/Beast Mastery':'#ff8866','hunter/Marksmanship':'#aee8ff','hunter/Survival':'#9dff70',
  'rogue/Assassination':'#7cff6b','rogue/Combat':'#ffdf8a','rogue/Subtlety':'#b48cff',
  'priest/Discipline':'#9fd7ff','priest/Holy':'#ffe9a3','priest/Shadow':'#a878ff',
  'dk/Blood':'#ff4a4a','dk/Frost':'#7de0ff','dk/Unholy':'#7cff6b',
  'shaman/Elemental':'#ff7733','shaman/Enhancement':'#8fd0ff','shaman/Restoration':'#6bd6ff',
  'mage/Arcane':'#c9a8ff','mage/Fire':'#ff7733','mage/Frost':'#aee8ff',
  'warlock/Affliction':'#7cff6b','warlock/Demonology':'#9dff70','warlock/Destruction':'#ff5ad0',
  'druid/Balance':'#b8c8ff','druid/Feral':'#ffb03a','druid/Restoration':'#7dff8a',
};

/* Автогенерація опису здібності українською */
function descr(a){
  const p=[];
  switch(a.type){
    case 'melee': p.push(`Ближня атака: ${a.dmg} шкоди`); break;
    case 'proj':  p.push(`Снаряд: ${a.dmg} шкоди`); break;
    case 'multi': p.push(`Черга з ${a.count} снарядів по ${a.dmg}`); break;
    case 'heal':  p.push(`Лікування: ${a.amount} HP`); break;
    case 'shield':p.push(`Щит: поглинає ${a.amount} шкоди (${a.dur}с)`); break;
    case 'buff': {
      const b=[];
      if(a.dmgMult) b.push(`+${Math.round((a.dmgMult-1)*100)}% шкоди`);
      if(a.spdMult) b.push(`+${Math.round((a.spdMult-1)*100)}% швидкості`);
      if(a.dmgTakenMult) b.push(`−${Math.round((1-a.dmgTakenMult)*100)}% отримуваної шкоди`);
      if(a.instantCast){ p.push(`Наступне закляття з кастом летить миттєво (заряд ${a.dur}с)`); break; }
      if(a.haste){ p.push(`Швидкість стрільби: відкати здібностей ідуть у ${a.haste} раза швидше (${a.dur}с)`); break; }
      p.push(`Підсилення: ${b.join(', ')} (${a.dur}с)${a.wings?' · золоті крила; твої удари не можна парирувати (лише заблокувати)':''}${a.disperse?' · розсіюєшся тінню: проходиш крізь ворога, але не атакуєш':''}`); break;
    }
    case 'aoe':   p.push(`Вибух довкола себе: ${a.dmg} шкоди`); break;
    case 'zone':  p.push(`Зона: ${a.dps} шкоди/с упродовж ${a.dur}с`); break;
    case 'dash':  p.push(a.move?`Ривок у напрямку руху на ${a.dist}`:a.toEnemy?`Ривок до ворога${a.dmg?`: ${a.dmg} шкоди`:''}`:(a.back?'Стрибок назад, геть від ворога':'Ривок уперед')); break;
    case 'tele':  p.push(a.mode==='behind'?'Телепорт за спину ворога, наступний удар ×2':(a.mode==='away'?'Телепорт геть від ворога':(a.mode==='move'?'Телепорт у напрямку руху (стоячи — назад від ворога)':'Телепорт уперед'))); break;
    case 'pull':  p.push(`Притягує ворога${a.dmg?`: ${a.dmg} шкоди`:''}`); break;
    case 'stealth':p.push(`Невидимість ${a.dur}с (−30% шкоди по тобі), наступна ближня атака ×2${a.dmgMult?`, +${Math.round((a.dmgMult-1)*100)}% шкоди`:''}`); break;
    case 'curse': p.push(a.sleep?`Жало присипляє ворога на ${a.sleep.dur}с (удар будить), а коли прокинеться — отрута ${a.sleep.dot.dps}/с ${a.sleep.dot.dur}с`
      :a.dmg?`${a.cast?'Прокляття':'Миттєве прокляття'}: ${a.dmg} шкоди`:'Прокляття'); break;
    case 'pet':   p.push(`Прикликає помічника на ${a.dur}с`); break;
    case 'knock': p.push(a.front?`Вихор перед собою: ${a.dmg} шкоди, відштовхує ворога геть від тебе`
      :`Громовий вибух довкола: ${a.dmg} шкоди, ворога відносить дугою${a.wall?` (об стіну: +${a.wall.dmg} шкоди й оглушення ${a.wall.stun}с)`:''}${a.gcd!=null&&a.gcd<0.3?'; майже не займає глобальний КД':''}`); break;
    case 'leap':  p.push(`Стрибок до ворога, при приземленні ${a.dmg} шкоди довкола`); break;
    case 'drain': p.push(`${a.healFrac?'Висмоктує життя променем':'Промінь'}: ${a.dmg}×${a.chan.ticks} шкоди`); break;
    case 'trap':  p.push(`Пастка під ногами (зводиться ${a.arm}с, чекає ${a.life}с): ворог, що на неї ступить, замерзає на ${a.freeze}с — удар чи снаряд розбиває лід (DoT — ні). Перестрибни!`); break;
  }
  if(a.boom) p.push(`заряд вибухає на цілі ще ${a.boom.n} рази по ${a.boom.dmg}`);
  if(a.cast) p.push(`каст ${a.cast}с`);
  if(a.chan) p.push(`канал ${a.chan.dur}с — стій на місці, рух чи блок перериває`);
  if(a.fear) p.push(`ворог у страху тікає від тебе ${a.fear.dur}с — не атакує й не блокує; ${a.fear.brk} шкоди знімають страх`);
  if(a.root) p.push(`${a.root.kind==='ice'?'заморожує':'сковує'} ворога на місці ${a.root.dur}с (бити й кастувати може, ходити — ні)`);
  if(a.dot) p.push(`періодична шкода ${a.dot.dps}/с (${a.dot.dur}с)`);
  if(a.hot) p.push(`+${a.hot.tick} HP/с (${a.hot.dur}с)`);
  if(a.stun) p.push(`оглушення ${a.stun}с`);
  if(a.slow) p.push(`сповільнення ${a.slow.dur}с`);
  if(a.selfHeal) p.push(`відновлює собі ${a.selfHeal} HP`);
  if(a.healFrac) p.push(`лікує на завдану шкоду`);
  if(a.knockback) p.push(`відкидання`);
  if(a.aoeOnHit) p.push(`вибух при влучанні`);
  if(a.gcd===0) p.push('без глобального КД');
  p.push(`КД ${a.cd}с`);
  return p.join(' · ');
}

/* ============================================================
   ІКОНКИ з паку "WoW Icon Pack"
   ============================================================ */
const ICON_ROOT='img/icons/';   // іконки WoW, перемальовані в піксель-арт гри (tools/icons/stylize.py); шляхи — як у WoW Icon Pack
const CLASS_ICONS={
  warrior:'Characters and Creatures/warrior.png',
  paladin:'Characters and Creatures/paladin.png',
  hunter:'Characters and Creatures/hunter.png',
  rogue:'Characters and Creatures/rogue.png',
  priest:'Characters and Creatures/priest.png',
  dk:'Wowhead/spell_deathknight_classicon.png',
  shaman:'Characters and Creatures/shaman.png',
  mage:'Characters and Creatures/mage.png',
  warlock:'Characters and Creatures/warlock.png',
  druid:'Characters and Creatures/druid.png',
};
const ABILITY_ICONS={
  // Воїн
  'Hamstring':'Wowhead/ability_shockwave.png',
  'Heroic Strike':'Wowhead/ability_rogue_ambush.png',
  'Intercept':'Abilities/Sprint.png',
  'Charge':'Abilities/Charge.png',
  'Intimidating Shout':'Abilities/BattleShout.png',
  'Overpower':'Abilities/MeleeDamage.png',
  'Mortal Strike':'Abilities/SavageBlow.png',
  'Bladestorm':'Abilities/Bladestorm.png',
  'Bloodthirst':'Abilities/BloodFrenzy.png',
  'Recklessness':'Abilities/BloodRage.png',
  'Shield Slam':'Abilities/ShieldBash.png',
  'Thunder Clap':'Abilities/ThunderClap.png',
  'Shield Block':'Abilities/CriticalBlock.png',
  // Паладін
  'Holy Wrath':'Wowhead/spell_holy_excorcism.png',
  'Divine Storm':'Abilities/DivineStorm.png',
  'Hammer of Justice':'Spells/FistOfJustice.png',
  'Holy Shock':'Spells/SearingLight.png',
  'Flash of Light':'Spells/FlashHeal.png',
  'Holy Light':'Spells/HolyBolt.png',
  'Hammer of the Righteous':'Abilities/HammeroftheRighteous.png',
  "Avenger's Shield":'Spells/AvengersShield.png',
  'Consecration':'Spells/SealOfFire.png',
  'Crusader Strike':'Spells/CrusaderStrike.png',
  'Avenging Wrath':'Spells/Crusade.png',
  // Мисливець
  'Arcane Shot':'Wowhead/ability_impalingbolt.png',
  'Call Pet':'Wowhead/ability_hunter_beastcall.png',
  'Rapid Fire':'Wowhead/ability_hunter_runningshot.png',
  'Serpent Sting':'Wowhead/ability_hunter_quickshot.png',
  'Explosive Shot':'Wowhead/ability_hunter_explosiveshot.png',
  'Freezing Trap':'Spells/ChainsOfIce.png',
  'Wyvern Sting':'Wowhead/inv_spear_02.png',
  'Disengage':'Abilities/Displacement.png',
  'Intimidation':'Abilities/Wolf.png',
  'Kill Command':'Abilities/KillCommand.png',
  'Steady Shot':'Abilities/SteadyShot.png',
  'Aimed Shot':'Abilities/AimedShot.png',
  // Розбійник
  'Hunger For Blood':'Wowhead/ability_rogue_hungerforblood.png',
  'Shadowstep':'Abilities/Shadowstep.png',
  'Kidney Shot':'Abilities/KidneyShot.png',
  'Mutilate':'Abilities/ShadowStrikes.png',
  'Envenom':'Abilities/Disembowel.png',
  'Sinister Strike':'Spells/RitualOfSacrifice.png',
  'Deadly Throw':'Wowhead/inv_throwingknife_06.png',
  'Adrenaline Rush':'Spells/ShadowWordDominate.png',
  'Backstab':'Abilities/BackStab.png',
  'Eviscerate':'Abilities/Eviscerate.png',
  'Shadow Dance':'Abilities/ShadowDance.png',
  // Жрець
  'Psychic Scream':'Wowhead/spell_shadow_psychicscream.png',
  'Holy Nova':'Spells/HolyNova.png',
  'Mind Flay':'Wowhead/spell_shadow_siphonmana.png',
  'Typhoon':'Abilities/Typhoon.png',
  'Dispersion':'Spells/Dispersion.png',
  'Smite':'Spells/HolySmite.png',
  'Penance':'Spells/Penance.png',
  'Power Word: Shield':'Spells/PowerWordShield.png',
  'Holy Fire':'Spells/Excorcism_02.png',
  'Flash Heal':'Spells/FlashHeal.png',
  'Greater Heal':'Spells/GreaterHeal.png',
  'Mind Blast':'Spells/UnholyFrenzy.png',
  'Shadow Word: Pain':'Spells/ShadowWordPain.png',
  // Лицар смерті
  'Unbreakable Armor':'Wowhead/inv_armor_helm_plate_naxxramas_raidwarrior_c_01.png',
  'Raise Dead':'Wowhead/spell_shadow_animatedead.png',
  'Death and Decay':'Wowhead/spell_shadow_deathanddecay.png',
  'Death Grip':'Spells/Strangulate.png',
  'Chains of Ice':'Spells/ChainsOfIce.png',
  'Heart Strike':'Wowhead/inv_weapon_shortblade_40.png',
  'Death Strike':'Wowhead/spell_deathknight_butcher2.png',
  'Vampiric Blood':'Spells/LifeDrain.png',
  'Frost Strike':'Spells/EmpowerRuneBlade2.png',
  'Obliterate':'Spells/FrozenRuneWeapon.png',
  'Scourge Strike':'Spells/ScourgeStrike.png',
  'Death Coil':'Spells/DeathCoil.png',
  // Шаман
  'Magma Totem':'Wowhead/spell_fire_selfdestruct.png',
  'Healing Wave':'Wowhead/spell_nature_magicimmunity.png',
  'Ghost Wolf':'Abilities/WhiteDireWolf.png',
  'Lightning Bolt':'Spells/Lightning.png',
  'Lava Burst':'Spells/LavaBurst.png',
  'Stormstrike':'Abilities/Stormstrike.png',
  'Lava Lash':'Abilities/Lavalash.png',
  'Feral Spirit':'Spells/FeralSpirit.png',
  'Riptide':'Spells/Riptide.png',
  // Маг
  'Blink':'Spells/Blink.png',
  'Arcane Blast':'Spells/Arcane01.png',
  'Arcane Barrage':'Abilities/ArcaneBarrage.png',
  'Arcane Power':'Spells/ArcanePotency.png',
  'Fire Blast':'Spells/Fireball.png',
  'Pyroblast':'Spells/Fireball02.png',
  'Presence of Mind':'Spells/EnchantArmor.png',
  'Ice Lance':'Spells/FrostBlast.png',
  'Frostbolt':'Spells/FrostBolt02.png',
  'Frost Nova':'Spells/FrostNova.png',
  "Dragon's Breath":'Miscellaneous/Head_Dragon_01.png',
  'Ice Barrier':'Wowhead/spell_ice_lament.png',
  // Чорнокнижник
  'Curse of Agony':'Wowhead/spell_shadow_curseofsargeras.png',
  'Demonic Circle: Teleport':'Spells/DemonicCircleTeleport.png',
  'Immolate':'Wowhead/spell_fire_immolation.png',
  'Soul Fire':'Spells/Fireball02.png',
  'Fear':'Wowhead/spell_shadow_possession.png',
  'Shadow Bolt':'Wowhead/spell_shadow_shadowbolt.png',
  'Drain Life':'Wowhead/spell_shadow_lifedrain02.png',
  'Summon Felguard':'Spells/SummonFelGuard.png',
  'Chaos Bolt':'Abilities/ChaosBolt.png',
  'Incinerate':'Spells/FlameBolt.png',
  'Conflagrate':'Spells/Fire.png',
  'Shadowfury':'Spells/Shadowfury.png',
  // Друїд
  'Travel Form':'Wowhead/ability_druid_travelform.png',
  'Starfire':'Spells/StarFire.png',
  'Hurricane':'Wowhead/spell_nature_cyclone.png',
  'Barkskin':'Wowhead/spell_nature_stoneclawtotem.png',
  'Wrath':'Spells/WispSplodeGreen.png',
  'Shred':'Abilities/Swipe.png',
  'Ferocious Bite':'Abilities/FerociousBite.png',
  "Tiger's Fury":'Abilities/TigersRoar.png',
  'Regrowth':'Spells/HealingTouch.png',
  'Wild Growth':'Spells/Rejuvenation.png',
  'Swiftmend':'Spells/NatureBlessing.png',
  'Thunderstorm':'Spells/ThunderStorm.png',
  'Sprint':'Abilities/Sprint.png',
  'Moonfire':'Spells/MoonGlow.png',
  'Entangling Roots':'Spells/NatureTouchGrow.png',
  'Pounce':'Abilities/Ravage.png',
};
// іконки форм друїда: кнопка показує форму, у яку перетворишся
// власні іконки вкладок спеку (інакше береться друга здібність — у друїдів це однаковий Regrowth)
const SPEC_ICONS={'druid/Balance':'Abilities/Starfall.png','druid/Feral':'Wowhead/ability_druid_catform.png','druid/Restoration':'Abilities/TreeofLife.png'};
const FORM_ICONS={cat:'Wowhead/ability_druid_catform.png',moonkin:'Wowhead/spell_nature_forceofnature.png',tree:'Abilities/TreeofLife.png',base:'Characters and Creatures/druid.png'};
// привʼязуємо шляхи до даних класів і здібностей (ic — явна іконка, якщо назва повторюється)
for(const c of CLASSES){
  c.img=ICON_ROOT+CLASS_ICONS[c.id];
  const all=[c.classAb,...c.specs.flatMap(s=>[...s.abilities,...(s.classAb?[s.classAb]:[]),...(s.form?[...s.form.abilities,s.form.classAb]:[])])];
  for(const a of all){
    const p=a.ic||ABILITY_ICONS[a.name];
    if(p) a.img=ICON_ROOT+p;
  }
  for(const s of c.specs){ const k=SPEC_ICONS[c.id+'/'+s.name]; if(k) s.img=ICON_ROOT+k; }
  for(const s of c.specs) if(s.form){ s.form.img=ICON_ROOT+FORM_ICONS[s.form.id]; s.form.baseImg=ICON_ROOT+FORM_ICONS.base; }
}
for(const k in ULTS) ULTS[k].img=ICON_ROOT+ULTS[k].ic;
/* Якщо іконки не завантажились (папки ICON_ROOT нема) — прибираємо всі шляхи,
   і інтерфейс малює емодзі (em / icon), як полотно бою й так робить без картинок. */
const ICONS={ok:null};
function dropIcons(){
  ICONS.ok=false;
  for(const c of CLASSES){
    c.img='';
    for(const s of c.specs){
      s.img='';
      for(const a of [...s.abilities,...(s.classAb?[s.classAb]:[]),...(s.form?[...s.form.abilities,s.form.classAb]:[])]) a.img='';
      if(s.form){ s.form.img=''; s.form.baseImg=''; }
    }
    c.classAb.img='';
  }
  for(const k in ULTS) ULTS[k].img='';
  if(typeof UI!=='undefined'&&UI.cur==='select'&&typeof renderSelect==='function'){ buildSelectDom(); renderSelect(); }
}
if(typeof Image!=='undefined'){
  const probe=new Image();
  probe.onload=()=>{ ICONS.ok=true; };
  probe.onerror=dropIcons;
  probe.src=encodeURI(CLASSES[0].img);
}
// кеш зображень для canvas (емодзі — запасний варіант, поки не завантажилось)
const ICON_CACHE={};
function iconImg(path){
  if(!path||typeof Image==='undefined') return null;
  let im=ICON_CACHE[path];
  if(!im){ im=new Image(); im.src=encodeURI(path); ICON_CACHE[path]=im; }
  return (im.complete&&im.naturalWidth>0)?im:null;
}

/* ============================================================
   СКІНИ: по 3 скіни (тір-сети) на кожен спек за мотивами
   тір-сетів T1–T10 (Might, Judgement, Bloodfang, Transcendence…)
   body — колір броні, trim — оздоблення (пояс, наплічники, візерунок),
   head — тон обличчя, eyes — очі, glow — аура, pattern — фактура броні
   ============================================================ */
const CLASS_PATTERN={warrior:'plates',paladin:'plates',dk:'plates',
  hunter:'scales',shaman:'scales',rogue:'stripes',druid:'stripes',
  priest:'runes',mage:'runes',warlock:'runes'};
const SK=(name,tier,body,trim,o={})=>({name,tier,body,trim,head:'#e8b98a',eyes:'#ffffff',...o});
const DK_FACE={head:'#cfd6e4'};
// згенеровано tools/setsheets/assemble.py з вибору tools/picker/picks.json: 3 скіни на спек,
// кожен — растрові деталі img/cutout/<id>.js (js/cutout.js); tier — мітка сету (T5, A7, ZG, PvP)
const SPEC_SKINS={
  'warrior/Arms':[
    SK("Destroyer Battlegear",'T5','#331c30','#f2bd6c',{cutout:'warrior_arms_1'}),
    SK("Relentless Gladiator's Battlegear",'A7','#544a41','#97b6a5',{cutout:'warrior_arms_2'}),
    SK("Battlegear of Wrath",'T2','#191518','#e9c646',{cutout:'warrior_arms_3'}),
  ],
  'warrior/Fury':[
    SK("Gladiator's Battlegear",'A1','#3c3343','#797683',{cutout:'warrior_fury_1'}),
    SK("Vindicator's Battlegear",'ZG','#931714','#931714',{cutout:'warrior_fury_2'}),
    SK("Warlord's Battlegear",'PvP','#130c23','#9e8e9e',{cutout:'warrior_fury_3',faction:'H'}),
  ],
  'warrior/Protection':[
    SK("Onslaught Battlegear",'T6','#5c4b3c','#e2c461',{cutout:'warrior_protection_1'}),
    SK("Dreadnaught's Battlegear",'T3','#46445a','#a3afbb',{cutout:'warrior_protection_2'}),
    SK("Hellscream's Battlegear",'T9','#3e271d','#a6a782',{cutout:'warrior_protection_3',faction:'H'}),
  ],
  'paladin/Holy':[
    SK("Judgement Armor",'T2','#5d1b0d','#f7d458',{cutout:'paladin_holy_1'}),
    SK("Vengeful Gladiator's Vindication",'A3','#1f1014','#fbf793',{cutout:'paladin_holy_2'}),
    SK("Lawbringer Armor",'T1','#c17d44','#f7de9b',{cutout:'paladin_holy_3'}),
  ],
  'paladin/Protection':[
    SK("Lightbringer Battlegear",'T6','#14101f','#f3dc6a',{cutout:'paladin_protection_1'}),
    SK("Turalyon's Battlegear",'T9','#141118','#efe7ad',{cutout:'paladin_protection_2',faction:'A'}),
    SK("Redemption Armor",'T3','#222230','#93b9dd',{cutout:'paladin_protection_3'}),
  ],
  'paladin/Retribution':[
    SK("Crystalforge Battlegear",'T5','#12142f','#d0e9e8',{cutout:'paladin_retribution_1'}),
    SK("Wrathful Gladiator's Vindication",'A8','#180f1c','#d3cdc7',{cutout:'paladin_retribution_2'}),
    SK("Conqueror's Aegis Battlegear",'T8','#351b29','#e59c59',{cutout:'paladin_retribution_3'}),
  ],
  'hunter/Beast Mastery':[
    SK("Giantstalker Armor",'T1','#63484b','#d5b79d',{cutout:'hunter_beast_mastery_1'}),
    SK("Gronnstalker's Armor",'T6','#3d1711','#eeaa65',{cutout:'hunter_beast_mastery_2'}),
    SK("Scourgestalker Battlegear",'T8','#3c1619','#d2ae99',{cutout:'hunter_beast_mastery_3'}),
  ],
  'hunter/Marksmanship':[
    SK("Dragonstalker Armor",'T2','#341a23','#dfb05e',{cutout:'hunter_marksmanship_1'}),
    SK("Rift Stalker Armor",'T5','#332a3a','#c4dac5',{cutout:'hunter_marksmanship_2'}),
    SK("Windrunner's Battlegear",'T9','#3a1c14','#d07d3e',{cutout:'hunter_marksmanship_3',faction:'A'}),
  ],
  'hunter/Survival':[
    SK("Cryptstalker Armor",'T3','#685143','#bca993',{cutout:'hunter_survival_1'}),
    SK("Demon Stalker Armor",'T4','#553d27','#b6a172',{cutout:'hunter_survival_2'}),
    SK("Brutal Gladiator's Pursuit",'A4','#2e130f','#ce955e',{cutout:'hunter_survival_3'}),
  ],
  'rogue/Assassination':[
    SK("Nightslayer Armor",'T1','#211e1a','#b19b6a',{cutout:'rogue_assassination_1'}),
    SK("Bloodfang Armor",'T2','#471c17','#884331',{cutout:'rogue_assassination_2'}),
    SK("Wrathful Gladiator's Vestments",'A8','#261416','#de9538',{cutout:'rogue_assassination_3'}),
  ],
  'rogue/Combat':[
    SK("Deathmantle",'T5','#3a3328','#9b845b',{cutout:'rogue_outlaw_1'}),
    SK("Slayer's Armor",'T6','#3f0e0f','#be8737',{cutout:'rogue_outlaw_2'}),
    SK("Garona's Battlegear",'T9','#6f422b','#e7bf64',{cutout:'rogue_outlaw_3',faction:'H'}),
  ],
  'rogue/Subtlety':[
    SK("Netherblade",'T4','#342338','#a797a6',{cutout:'rogue_subtlety_1'}),
    SK("Furious Gladiator's Vestments",'A6','#514242','#bab4ad',{cutout:'rogue_subtlety_2'}),
    SK("Darkmantle Armor",'T0.5','#11192f','#2f5eac',{cutout:'rogue_subtlety_3'}),
  ],
  'priest/Discipline':[
    SK("Vestments of Prophecy",'T1','#6b1b10','#fad375',{cutout:'priest_discipline_1'}),
    SK("Sanctification Regalia",'T8','#161326','#dcd6cb',{cutout:'priest_discipline_2'}),
    SK("Furious Gladiator's Investiture",'A6','#321a12','#dcbb5b',{cutout:'priest_discipline_3'}),
  ],
  'priest/Holy':[
    SK("Vestments of Transcendence",'T2','#756148','#e6e3be',{cutout:'priest_holy_1'}),
    SK("Vestments of Faith",'T3','#191f33','#fae8b5',{cutout:'priest_holy_2'}),
    SK("Incarnate Raiment",'T4','#271326','#f2d2b3',{cutout:'priest_holy_3'}),
  ],
  'priest/Shadow':[
    SK("Zabra's Regalia",'T9','#46383c','#c69e75',{cutout:'priest_shadow_1',faction:'H'}),
    SK("Vengeful Gladiator's Investiture",'A3','#3f4167','#a2b3d0',{cutout:'priest_shadow_2'}),
    SK("Warlord's Raiment",'PvP','#4c5f68','#c5dcec',{cutout:'priest_shadow_3',faction:'H'}),
  ],
  'dk/Blood':[
    SK("Scourgelord's Battlegear",'T10','#241728','#746375',{cutout:'dk_blood_1'}),
    SK("Koltira's Battlegear",'T9','#333e67','#788ec4',{cutout:'dk_blood_2',faction:'H'}),
    SK("Deadly Gladiator's Desecration",'A5','#352c2a','#cbae8a',{cutout:'dk_blood_3'}),
  ],
  'dk/Frost':[
    SK("Darkruned Battlegear",'T8','#392925','#aca49a',{cutout:'dk_frost_1'}),
    SK("Thassarian's Battlegear",'T9','#464d6b','#a9b6c4',{cutout:'dk_frost_2',faction:'A'}),
    SK("Wrathful Gladiator's Desecration",'A8','#33313d','#70757b',{cutout:'dk_frost_3'}),
  ],
  'dk/Unholy':[
    SK("Darkruned Battlegear",'T8','#544139','#aca69d',{cutout:'dk_unholy_1'}),
    SK("Scourgelord's Battlegear",'T10','#39283c','#736271',{cutout:'dk_unholy_2'}),
    SK("Sanctified Scourgelord's Battlegear",'T10','#3f1d18','#a29f6c',{cutout:'dk_unholy_3'}),
  ],
  'shaman/Elemental':[
    SK("The Earthshatterer",'T3','#6e0d09','#eaac3d',{cutout:'shaman_elemental_1'}),
    SK("The Ten Storms",'T2','#4e5074','#a3c4eb',{cutout:'shaman_elemental_2'}),
    SK("The Five Thunders",'T0.5','#5b1317','#edab41',{cutout:'shaman_elemental_3'}),
  ],
  'shaman/Enhancement':[
    SK("Cataclysm Regalia",'T5','#24110f','#a87245',{cutout:'shaman_enhancement_1'}),
    SK("Warlord's Earthshaker",'PvP','#152b2d','#8391aa',{cutout:'shaman_enhancement_2',faction:'H'}),
    SK("Vengeful Gladiator's Earthshaker",'A3','#570907','#b1b781',{cutout:'shaman_enhancement_3'}),
  ],
  'shaman/Restoration':[
    SK("Cyclone Raiment",'T4','#2b324c','#c0c3c9',{cutout:'shaman_restoration_1'}),
    SK("The Earthfury",'T1','#210e20','#e2b358',{cutout:'shaman_restoration_2'}),
    SK("Cyclone Regalia",'T4','#4a836d','#bff1c5',{cutout:'shaman_restoration_3'}),
  ],
  'mage/Arcane':[
    SK("Arcanist Regalia",'T1','#191042','#fbe9be',{cutout:'mage_arcane_1'}),
    SK("Tirisfal Regalia",'T5','#3f0a0a','#c78c7a',{cutout:'mage_arcane_2'}),
    SK("Netherwind Regalia",'T2','#5075a6','#52cad9',{cutout:'mage_arcane_3'}),
  ],
  'mage/Fire':[
    SK("Magister's Regalia",'T0','#230a19','#f6b649',{cutout:'mage_fire_1'}),
    SK("Sanctified Bloodmage's Regalia",'T10','#211016','#a89e4b',{cutout:'mage_fire_2'}),
    SK("Gladiator's Regalia",'A1','#381c18','#825938',{cutout:'mage_fire_3'}),
  ],
  'mage/Frost':[
    SK("Furious Gladiator's Regalia",'A6','#381918','#daa669',{cutout:'mage_frost_1'}),
    SK("Frostfire Regalia",'T3','#0e102a','#59b5e1',{cutout:'mage_frost_2'}),
    SK("Deadly Gladiator's Regalia",'A5','#371a29','#c2979e',{cutout:'mage_frost_3'}),
  ],
  'warlock/Affliction':[
    SK("Felheart Raiment",'T1','#2d2526','#c8cf4f',{cutout:'warlock_affliction_1'}),
    SK("Plagueheart Raiment",'T3','#bd8c16','#cfbc2e',{cutout:'warlock_affliction_2'}),
    SK("Conqueror's Deathbringer Garb",'T8','#252e45','#687288',{cutout:'warlock_affliction_3'}),
  ],
  'warlock/Demonology':[
    SK("Voidheart Raiment",'T4','#51343d','#c8a585',{cutout:'warlock_demonology_1'}),
    SK("Malefic Raiment",'T6','#352238','#f5df6b',{cutout:'warlock_demonology_2'}),
    SK("Deathbringer Garb",'T8','#3d3349','#c18f79',{cutout:'warlock_demonology_3'}),
  ],
  'warlock/Destruction':[
    SK("Nemesis Raiment",'T2','#18211c','#a4ce76',{cutout:'warlock_destruction_1'}),
    SK("Gul'dan's Regalia",'T9','#261025','#a6636a',{cutout:'warlock_destruction_2',faction:'H'}),
    SK("Merciless Gladiator's Dreadgear",'A2','#2a1d17','#975844',{cutout:'warlock_destruction_3'}),
  ],
  'druid/Balance':[
    SK("Stormrage Raiment",'T2','#21150b','#e6e13a',{cutout:'druid_balance_1',formCutout:'druid_balance_1_form'}),
    SK("Nordrassil Regalia",'T5','#764d2b','#dab16f',{cutout:'druid_balance_2',formCutout:'druid_balance_2_form'}),
    SK("Nightsong Garb",'T8','#59260a','#f3b828',{cutout:'druid_balance_3',formCutout:'druid_balance_3_form'}),
  ],
  'druid/Feral':[
    SK("Cenarion Raiment",'T1','#191512','#ede6a6',{cutout:'druid_feral_1',formCutout:'druid_feral_1_form'}),
    SK("Thunderheart Harness",'T6','#511b13','#efbb87',{cutout:'druid_feral_2',formCutout:'druid_feral_2_form'}),
    SK("Lasherweave Garb",'T10','#2e2018','#a7813a',{cutout:'druid_feral_3',formCutout:'druid_feral_3_form'}),
  ],
  'druid/Restoration':[
    SK("Dreamwalker Raiment",'T3','#243d17','#f9d859',{cutout:'druid_restoration_1',formCutout:'druid_restoration_1_form'}),
    SK("Malorne Raiment",'T4','#251c11','#fcefcd',{cutout:'druid_restoration_2',formCutout:'druid_restoration_2_form'}),
    SK("Runetotem's Garb",'T9','#454430','#93c6a4',{cutout:'druid_restoration_3',faction:'H',formCutout:'druid_restoration_3_form'}),
  ],
};
// список скінів спеку — лише тір-сети (класичного вигляду класу більше немає)
function skinsFor(cls,spec){
  const key=cls.id+'/'+spec.name;
  const list=[...(SPEC_SKINS[key]||[])];
  for(const s of list){ s.pattern=s.pattern||CLASS_PATTERN[cls.id]||'none'; s.accent=s.accent||s.trim; }
  return list;
}
for(const c of CLASSES) for(const s of c.specs) s.skins=skinsFor(c,s);
