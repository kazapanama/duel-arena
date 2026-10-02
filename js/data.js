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
     mk.aoe('Bladestorm','🌪️',10,120,150),
   ]},
   { name:'Fury', em:'🔥', role:'Бій',
     classAb: mk.leap('Heroic Leap','🦘',8,60,125,{slow:{mult:0.6,dur:2}}),
     abilities:[
     mk.melee('Raging Blow','👊',1.1,57),
     mk.melee('Bloodthirst','🩸',5,148,{selfHeal:50}),
     mk.buff('Recklessness','😡',15,6,{dmgMult:1.35,spdMult:1.15}),
   ]},
   { name:'Protection', em:'🛡️', role:'Танк',
     classAb: mk.aoe('Intimidating Shout','😱',14,20,170,{fear:{dur:1.6,brk:60}}),
     abilities:[
     mk.melee('Shield Slam','🛡️',1.3,54,{knockback:90}),
     mk.aoe('Thunder Clap','⛈️',6,85,155,{slow:{mult:0.5,dur:3}}),
     mk.shield('Shield Block','🔰',12,190,6),
   ]},
  ]},
{ id:'paladin', name:'Паладін', em:'🔨', color:'#F48CBA',
  classAb: mk.heal('Flash of Light','💛',9,90,{cast:1.0}),   // загальна для паладинів: короткий каст, невелике лікування
  specs:[
   { name:'Holy', em:'🌟', role:'Лікар', abilities:[
     mk.proj('Holy Shock','✨',1.5,60,{selfHeal:15,pcolor:'#fff2b0',speed:900}),
     mk.heal('Holy Light','✨',10,210,{cast:1.5}),
     mk.aoe('Holy Prism','🔆',9,135,170,{selfHeal:40}),
   ]},
   { name:'Protection', em:'🛡️', role:'Танк',
     classAb: mk.curse('Hammer of Justice','🔨',14,{dmg:30,stun:1.2,range:340}),
     abilities:[
     mk.melee('Hammer of the Righteous','🔨',1.3,56),
     mk.proj("Avenger's Shield",'🛡️',7,140,{stun:0.8,speed:920,pcolor:'#9fd7ff',psize:13}),
     mk.zone('Consecration','🔥',9,60,125,5,{at:'self',zcolor:'#ffd97a'}),
   ]},
   { name:'Retribution', em:'⚔️', role:'Бій',
     classAb: mk.dash('Divine Steed','🐎',7,{move:true,dist:360}),
     abilities:[
     mk.melee('Crusader Strike','⚔️',1.2,60),
     mk.melee("Templar's Verdict",'⚖️',6,195),
     mk.buff('Avenging Wrath','😇',15,6,{dmgMult:1.35,selfHeal:40,wings:true}),   // поки діє — золоті крила
   ]},
  ]},
{ id:'hunter', name:'Мисливець', em:'🏹', color:'#AAD372',
  classAb: mk.dash('Disengage','🦘',5,{back:true,dist:280}),
  specs:[
   { name:'Beast Mastery', em:'🐻', role:'Бій',
     classAb: mk.curse('Intimidation','🐺',12,{dmg:25,stun:1.0,range:520}),
     abilities:[
     mk.proj('Cobra Shot','🐍',1.3,50,{speed:880,pcolor:'#9dff70'}),
     mk.proj('Kill Command','🐺',5,135,{speed:1100,pcolor:'#ff8866',psize:13}),
     mk.pet('Dire Beast','🐺',14,10,{pkind:'wolf',pdmg:15,pcd:1.25}),
   ]},
   { name:'Marksmanship', em:'🎯', role:'Бій', abilities:[
     mk.proj('Steady Shot','🏹',1.3,58,{speed:880,pcolor:'#d8e8ff'}),
     mk.proj('Aimed Shot','🎯',5,240,{cast:0.85,speed:900,psize:14,pcolor:'#e8f2ff'}),
     mk.buff('Trueshot','👁️',15,6,{dmgMult:1.35,spdMult:1.2}),
   ]},
   { name:'Survival', em:'🗡️', role:'Бій',
     classAb: mk.dash('Harpoon','🪝',7,{toEnemy:true,dmg:20,slow:{mult:0.3,dur:1.5}}),
     abilities:[
     mk.melee('Raptor Strike','🦖',1.15,58,{range:112}),
     mk.proj('Wildfire Bomb','💣',6,128,{aoeOnHit:100,dot:{dps:15,dur:3},speed:700,pcolor:'#ffae42',psize:12}),
     mk.buff('Coordinated Assault','🦅',15,6,{dmgMult:1.35,spdMult:1.15}),
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
     mk.buff('Vendetta','🎯',15,6,{dmgMult:1.4}),
   ]},
   { name:'Outlaw', em:'🏴‍☠️', role:'Бій',
     classAb: mk.dash('Grappling Hook','🪝',6,{move:true,dist:340}),
     abilities:[
     mk.melee('Sinister Strike','🗡️',1.1,58),
     mk.proj('Pistol Shot','🔫',4,115,{slow:{mult:0.6,dur:2},speed:1000,pcolor:'#ffdf8a'}),
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
     classAb: mk.buff('Angelic Feather','🪶',8,3,{spdMult:1.6,feather:true}),
     abilities:[
     mk.proj('Smite','✨',1.5,54,{pcolor:'#fff6cf',speed:820}),
     mk.multi('Penance','🌠',6,52,3,{pcolor:'#ffe9a3',chan:{dur:1.5}}),
     mk.shield('Power Word: Shield','🔮',12,170,8),
   ]},
   { name:'Holy', em:'🌟', role:'Лікар', abilities:[
     mk.proj('Holy Fire','🔥',1.5,48,{dot:{dps:10,dur:3},pcolor:'#ffd070'}),
     mk.heal('Greater Heal','💛',10,240,{cast:1.6}),   // Flash Heal — у слоті A, тут велике повільне лікування
     mk.proj('Holy Word: Chastise','⚡',9,90,{stun:1.0,pcolor:'#fff',speed:900}),
   ]},
   { name:'Shadow', em:'🌑', role:'Бій', abilities:[
     mk.proj('Mind Spike','🧠',1.4,56,{speed:900,pcolor:'#b48cff'}),
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
     mk.buff('Pillar of Frost','🧊',15,6,{dmgMult:1.4}),
   ]},
   { name:'Unholy', em:'🧟', role:'Бій',
     classAb: mk.buff("Death's Advance",'💀',10,4,{spdMult:1.4,dmgTakenMult:0.85}),
     abilities:[
     mk.melee('Scourge Strike','🦠',1.2,48,{dot:{dps:8,dur:3}}),
     mk.proj('Death Coil','🟢',5,95,{pcolor:'#7cff6b'}),
     mk.pet('Apocalypse','🧟',14,9,{pkind:'ghoul',pdmg:15,pcd:1.25}),
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
     mk.zone('Earthquake','🌍',11,36,140,5,{at:'enemy',slow:{mult:0.7,dur:1},zcolor:'#c9a06a'}),
   ]},
   { name:'Enhancement', em:'🐺', role:'Бій',
     classAb: mk.dash('Feral Lunge','🐺',6,{toEnemy:true,dmg:30}),
     abilities:[
     mk.melee('Stormstrike','⚡',1.2,56),
     mk.melee('Lava Lash','🔥',5,150,{dot:{dps:12,dur:3}}),
     mk.pet('Feral Spirit','🐺',15,8,{pkind:'spiritwolf',pdmg:12,pcd:1.3}),
   ]},
   { name:'Restoration', em:'💧', role:'Лікар', abilities:[
     mk.proj('Lightning Bolt','⚡',1.35,57,{speed:950,pcolor:'#8fd0ff'}),
     mk.heal('Healing Surge','💙',9,205,{cast:1.1}),
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
     mk.proj('Pyroblast','☄️',7,250,{cast:1.3,speed:560,psize:16,pcolor:'#ff6a2a'}),
     mk.buff('Combustion','💥',15,5,{dmgMult:1.45}),
   ]},
   { name:'Frost', em:'❄️', role:'Бій',
     classAb: mk.shield('Ice Barrier','🧊',14,115,6),
     abilities:[
     mk.proj('Frostbolt','❄️',1.4,50,{slow:{mult:0.6,dur:2.5},pcolor:'#aee8ff'}),
     mk.proj('Glacial Spike','🧊',6,212,{cast:1.0,stun:0.5,speed:700,psize:15,pcolor:'#aee8ff'}),
     mk.aoe('Frost Nova','❄️',9,55,160,{root:{dur:2.5,kind:'ice'}}),
   ]},
  ]},
{ id:'warlock', name:'Чорнокнижник', em:'😈', color:'#8788EE',
  // замість телепорту — страх: ворог утрачає контроль і тікає від чорнокнижника; шкода його знімає
  classAb: mk.curse('Fear','😱',15,{cast:1.2,fear:{dur:2,brk:70}}),
  specs:[
   { name:'Affliction', em:'🕷️', role:'Бій', abilities:[
     mk.proj('Shadow Bolt','🟣',1.5,48,{pcolor:'#a878ff'}),
     mk.drain('Drain Life','🩸',6,27,{chan:{dur:2.4,ticks:6},healFrac:0.5,pcolor:'#7cff4a'}),   // зелений промінь, як у WoW
     mk.curse('Agony','😖',8,{dot:{dps:18,dur:6}}),
   ]},
   { name:'Demonology', em:'👿', role:'Бій',
     classAb: mk.tele('Demonic Circle','🌀',7,'away',{dist:300}),
     abilities:[
     mk.proj('Demonbolt','🟢',1.4,50,{pcolor:'#9dff70'}),
     mk.proj("Hand of Gul'dan",'☄️',6,160,{cast:1.0,aoeOnHit:95,speed:640,pcolor:'#7cff6b',psize:13}),
     mk.pet('Summon Felguard','👹',14,10,{pkind:'felguard',pdmg:17,pcd:1.25}),
   ]},
   { name:'Destruction', em:'🔥', role:'Бій',
     classAb: mk.aoe('Shadowfury','🌑',12,40,160,{stun:1.0}),
     abilities:[
     mk.proj('Incinerate','🔥',1.4,48,{dot:{dps:6,dur:2},pcolor:'#ffb03a'}),
     mk.proj('Chaos Bolt','🌈',7,270,{cast:1.4,speed:520,psize:16,pcolor:'#ff5ad0'}),
     mk.proj('Conflagrate','💥',6,90,{stun:0.4,speed:1000,pcolor:'#ffb03a'}),
   ]},
  ]},
{ id:'druid', name:'Друїд', em:'🐾', color:'#FF7C0A',
  classAb: mk.dash('Wild Charge','🐾',6,{toEnemy:true,dmg:25}),
  specs:[
   /* Balance: гуманоїд — Moonfire/Regrowth/Roots; форма сови (Moonkin) — Wrath/Starsurge/Starfall */
   { name:'Balance', em:'🌙', role:'Бій', abilities:[
     mk.curse('Moonfire','🌙',6,{dmg:20,dot:{dps:9,dur:6}}),
     mk.heal('Regrowth','🌿',10,150,{cast:1.1,hot:{tick:8,dur:4}}),
     mk.curse('Entangling Roots','🌱',10,{cast:1.2,dmg:15,root:{dur:2.2,kind:'vine'},dot:{dps:8,dur:3}}),
   ],
     form:{ id:'moonkin', name:'Форма сови', em:'🦉', h:118, passive:{dr:0.9,spd:0.92},
       note:'−10% отримуваної шкоди, трохи повільніша',
       abilities:[
         mk.proj('Wrath','🌞',1.4,44,{pcolor:'#ffe27a'}),
         mk.proj('Starsurge','⭐',6,150,{cast:1.0,speed:820,psize:13,pcolor:'#b8c8ff'}),
         mk.zone('Starfall','🌠',11,30,165,6,{at:'enemy',zcolor:'#a8b8ff'}),
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
   /* Restoration: гуманоїд — Wrath/Regrowth/Ironbark; Дерево життя — міцніше й повільніше, лікує без кастів */
   { name:'Restoration', em:'🌿', role:'Лікар', abilities:[
     mk.proj('Wrath','🌞',1.4,50,{pcolor:'#ffe27a'}),
     mk.heal('Regrowth','🌿',9,190,{cast:1.1,hot:{tick:10,dur:4}}),
     mk.buff('Ironbark','🪵',14,5,{dmgTakenMult:0.5}),
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
   УЛЬТИМЕЙТИ: по одному на клас, коли повна супершкала (кнопка O / Num6 / RT).
   Механіка — у Fighter.runUlt; тут назви, іконки й опис для меню.
   ============================================================ */
const ULTS={
  warrior:{name:'Avatar',ua:'Аватар',icon:'🗿',ic:'Abilities/Avatar.png',
    d:'Стрибок до ворога: 150 шкоди довкола й оглушення 0.7с; 8с боєць більшає: +30% шкоди, +20% швидкості'},
  paladin:{name:'Final Reckoning',ua:'Остаточна розплата',icon:'🔨',ic:'Spells/AuraOfLight.png',
    d:'Позначає місце під ворогом; за 0.95с з неба падає молот світла: 230 шкоди й оглушення 1с. Не блокується — тікай із кола'},
  hunter:{name:'Volley',ua:'Залп',icon:'🏹',ic:'Abilities/WildQuiver.png',
    d:'4с дощ стріл на місці ворога: 55 шкоди/с і сповільнення'},
  rogue:{name:'Death from Above',ua:'Смерть згори',icon:'🗡️',ic:'Abilities/Ambush.png',
    d:'Злітає за кадр і за пів секунди падає на ворога: 210 шкоди, оглушення 0.8с. Не блокується — тікай із кола'},
  priest:{name:'Halo',ua:'Ореол',icon:'⭕',ic:'Spells/HolyNova.png',
    d:'Кільце світла (у Shadow — тіні) на 420: 170 шкоди ворогу й 170 лікування собі'},
  dk:{name:'Army of the Dead',ua:'Армія мертвих',icon:'🧟',ic:'Spells/ArmyOfTheDead.png',
    d:'Четверо гулів по черзі виривають із землі під ворогом: по 55 шкоди й сповільнення'},
  shaman:{name:'Ascendance',ua:'Піднесення',icon:'⚡',ic:'Spells/CallStorm.png',
    d:'Блискавка з неба: 110 шкоди (не блокується); 8с: +40% шкоди, −30% отримуваної'},
  mage:{name:'Meteor',ua:'Метеор',icon:'☄️',ic:'Spells/MeteorStorm.png',
    d:'За 1с метеор падає на позначене місце: 240 шкоди й вогняна зона на 3с. Не блокується'},
  warlock:{name:'Summon Infernal',ua:'Інфернал',icon:'🔥',ic:'Spells/SummonInfernal.png',
    d:'Інфернал падає на позначене місце: 170 шкоди, оглушення 1.2с, потім 8с бʼється поруч'},
  druid:{name:'Convoke the Spirits',ua:'Заклик духів',icon:'🌳',ic:'Abilities/ForceofNature.png',
    d:'2.4с шквал із 12 випадкових чар: Wrath, Starsurge, Moonfire і лікування'},
};
// снаряди Заклику духів
const CONVOKE={
  wrath:mk.proj('Wrath','🌞',0,18,{pcolor:'#ffe27a'}),
  starsurge:mk.proj('Starsurge','⭐',0,45,{speed:820,psize:13,pcolor:'#b8c8ff'}),
};

/* Раси на вибір (екран вибору бійця, клавіша X). '' — як задумано сетом */
const RACES=[['','Як у сету'],['human','Людина'],['dwarf','Дворф'],['nelf','Нічний ельф'],['draenei','Дреней'],
  ['belf','Ельф крові'],['orc','Орк'],['undead','Нежить'],['tauren','Таурен'],['troll','Троль']];
const raceName=id=>(RACES.find(r=>r[0]===(id||''))||RACES[0])[1];

/* Кольоровий акцент кожного спеку (зброя, аура, підсвітка) */
const SPEC_ACCENT={
  'warrior/Arms':'#ffd23a','warrior/Fury':'#ff5a3a','warrior/Protection':'#9fd7ff',
  'paladin/Holy':'#ffe27a','paladin/Protection':'#9fd7ff','paladin/Retribution':'#ff9440',
  'hunter/Beast Mastery':'#ff8866','hunter/Marksmanship':'#aee8ff','hunter/Survival':'#9dff70',
  'rogue/Assassination':'#7cff6b','rogue/Outlaw':'#ffdf8a','rogue/Subtlety':'#b48cff',
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
      p.push(`Підсилення: ${b.join(', ')} (${a.dur}с)${a.wings?' · золоті крила; твої удари не можна парирувати (лише заблокувати)':''}${a.disperse?' · розсіюєшся тінню: проходиш крізь ворога, але не атакуєш':''}`); break;
    }
    case 'aoe':   p.push(`Вибух довкола себе: ${a.dmg} шкоди`); break;
    case 'zone':  p.push(`Зона: ${a.dps} шкоди/с упродовж ${a.dur}с`); break;
    case 'dash':  p.push(a.move?`Ривок у напрямку руху на ${a.dist}`:a.toEnemy?`Ривок до ворога${a.dmg?`: ${a.dmg} шкоди`:''}`:(a.back?'Стрибок назад, геть від ворога':'Ривок уперед')); break;
    case 'tele':  p.push(a.mode==='behind'?'Телепорт за спину ворога, наступний удар ×2':(a.mode==='away'?'Телепорт геть від ворога':(a.mode==='move'?'Телепорт у напрямку руху (стоячи — назад від ворога)':'Телепорт уперед'))); break;
    case 'pull':  p.push(`Притягує ворога${a.dmg?`: ${a.dmg} шкоди`:''}`); break;
    case 'stealth':p.push(`Невидимість ${a.dur}с (−30% шкоди по тобі), наступна ближня атака ×2${a.dmgMult?`, +${Math.round((a.dmgMult-1)*100)}% шкоди`:''}`); break;
    case 'curse': p.push(a.dmg?`${a.cast?'Прокляття':'Миттєве прокляття'}: ${a.dmg} шкоди`:'Прокляття'); break;
    case 'pet':   p.push(`Прикликає помічника на ${a.dur}с`); break;
    case 'knock': p.push(a.front?`Вихор перед собою: ${a.dmg} шкоди, відштовхує ворога геть від тебе`
      :`Громовий вибух довкола: ${a.dmg} шкоди, ворога відносить дугою${a.wall?` (об стіну: +${a.wall.dmg} шкоди й оглушення ${a.wall.stun}с)`:''}${a.gcd!=null&&a.gcd<0.3?'; майже не займає глобальний КД':''}`); break;
    case 'leap':  p.push(`Стрибок до ворога, при приземленні ${a.dmg} шкоди довкола`); break;
    case 'drain': p.push(`Висмоктує життя променем: ${a.dmg}×${a.chan.ticks} шкоди`); break;
  }
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
const ICON_ROOT='WoW Icon Pack/';
const CLASS_ICONS={
  warrior:'Characters and Creatures/warrior.png',
  paladin:'Characters and Creatures/paladin.png',
  hunter:'Characters and Creatures/hunter.png',
  rogue:'Characters and Creatures/rogue.png',
  priest:'Characters and Creatures/priest.png',
  dk:'Trade/MajorDeathKnight.png',
  shaman:'Characters and Creatures/shaman.png',
  mage:'Characters and Creatures/mage.png',
  warlock:'Characters and Creatures/warlock.png',
  druid:'Characters and Creatures/druid.png',
};
const ABILITY_ICONS={
  // Воїн
  'Charge':'Abilities/Charge.png',
  'Intimidating Shout':'Abilities/BattleShout.png',
  'Overpower':'Abilities/MeleeDamage.png',
  'Mortal Strike':'Abilities/SavageBlow.png',
  'Bladestorm':'Abilities/Bladestorm.png',
  'Raging Blow':'Abilities/Rampage.png',
  'Bloodthirst':'Abilities/BloodFrenzy.png',
  'Recklessness':'Abilities/BloodRage.png',
  'Shield Slam':'Abilities/ShieldBash.png',
  'Thunder Clap':'Abilities/ThunderClap.png',
  'Shield Block':'Abilities/CriticalBlock.png',
  // Паладін
  'Divine Steed':'Abilities/Charger.png',
  'Hammer of Justice':'Spells/FistOfJustice.png',
  'Holy Shock':'Spells/HolyBolt.png',
  'Flash of Light':'Spells/Heal.png',
  'Holy Light':'Spells/Heal.png',
  'Holy Prism':'Spells/SearingLight.png',
  'Hammer of the Righteous':'Abilities/HammeroftheRighteous.png',
  "Avenger's Shield":'Spells/AvengersShield.png',
  'Consecration':'Spells/SealOfFire.png',
  'Crusader Strike':'Spells/CrusaderStrike.png',
  "Templar's Verdict":'Abilities/DivineStorm.png',
  'Avenging Wrath':'Spells/Crusade.png',
  // Мисливець
  'Disengage':'Abilities/Displacement.png',
  'Intimidation':'Abilities/Wolf.png',
  'Cobra Shot':'Abilities/CobraStrikes.png',
  'Kill Command':'Abilities/KillCommand.png',
  'Bestial Wrath':'Abilities/BeastMastery.png',
  'Dire Beast':'Abilities/BeastMastery.png',
  'Steady Shot':'Abilities/SteadyShot.png',
  'Aimed Shot':'Abilities/AimedShot.png',
  'Trueshot':'Abilities/TrueShot.png',
  'Raptor Strike':'Abilities/Raptor.png',
  'Wildfire Bomb':'Miscellaneous/Bomb_01.png',
  'Coordinated Assault':'Abilities/EagleEye.png',
  // Розбійник
  'Shadowstep':'Abilities/Shadowstep.png',
  'Kidney Shot':'Abilities/KidneyShot.png',
  'Mutilate':'Abilities/Rupture.png',
  'Envenom':'Abilities/PotentVenom.png',
  'Vendetta':'Spells/Vendetta.png',
  'Sinister Strike':'Abilities/CriticalStrike.png',
  'Pistol Shot':'Miscellaneous/Ammo_Bullet_03.png',
  'Adrenaline Rush':'Abilities/Sprint.png',
  'Backstab':'Abilities/BackStab.png',
  'Eviscerate':'Abilities/Eviscerate.png',
  'Shadow Dance':'Abilities/ShadowDance.png',
  // Жрець
  'Angelic Feather':'Spells/FeatherFall.png',
  'Typhoon':'Abilities/Typhoon.png',
  'Dispersion':'Spells/Dispersion.png',
  'Smite':'Spells/HolySmite.png',
  'Penance':'Spells/Penance.png',
  'Power Word: Shield':'Spells/PowerWordShield.png',
  'Holy Fire':'Spells/Excorcism_02.png',
  'Flash Heal':'Spells/FlashHeal.png',
  'Greater Heal':'Spells/GreaterHeal.png',
  'Holy Word: Chastise':'Spells/Chastise.png',
  'Mind Spike':'Spells/PainSpike.png',
  'Mind Blast':'Spells/Brainwash.png',
  'Shadow Word: Pain':'Spells/Shadesofdarkness.png',
  // Лицар смерті
  'Death Grip':'Spells/Strangulate.png',
  'Chains of Ice':'Spells/ChainsOfIce.png',
  "Death's Advance":'Spells/UnholyPresence.png',
  'Heart Strike':'Abilities/BloodBath.png',
  'Death Strike':'Spells/DeathStrike.png',
  'Vampiric Blood':'Spells/BloodLust.png',
  'Frost Strike':'Spells/EmpowerRuneBlade2.png',
  'Obliterate':'Spells/FrozenRuneWeapon.png',
  'Pillar of Frost':'Spells/Glacier.png',
  'Scourge Strike':'Spells/ScourgeStrike.png',
  'Death Coil':'Spells/DeathCoil.png',
  'Apocalypse':'Spells/RaiseDead.png',
  // Шаман
  'Ghost Wolf':'Abilities/WhiteDireWolf.png',
  'Lightning Bolt':'Spells/Lightning.png',
  'Lava Burst':'Spells/LavaBurst.png',
  'Earthquake':'Spells/EarthShock.png',
  'Stormstrike':'Abilities/Stormstrike.png',
  'Lava Lash':'Abilities/Lavalash.png',
  'Feral Spirit':'Spells/FeralSpirit.png',
  'Healing Surge':'Spells/HealingWaveGreater.png',
  'Riptide':'Spells/Riptide.png',
  // Маг
  'Blink':'Spells/Blink.png',
  'Arcane Blast':'Spells/Arcane01.png',
  'Arcane Barrage':'Abilities/ArcaneBarrage.png',
  'Arcane Power':'Spells/ArcanePotency.png',
  'Fire Blast':'Spells/Fireball.png',
  'Pyroblast':'Spells/Fireball02.png',
  'Combustion':'Spells/Immolation.png',
  'Frostbolt':'Spells/Frostbolt.png',
  'Glacial Spike':'Spells/IceShard.png',
  'Frost Nova':'Spells/FrostNova.png',
  "Dragon's Breath":'Abilities/FireStarter.png',
  'Ice Barrier':'Spells/FrostWard.png',
  // Чорнокнижник
  'Demonic Circle':'Spells/DemonicCircleTeleport.png',
  'Fear':'Spells/PsychicHorrors.png',
  'Shadow Bolt':'Spells/ShadowPower.png',
  'Drain Life':'Spells/LifeDrain.png',
  'Agony':'Spells/PainAndSuffering.png',
  'Demonbolt':'Spells/FelFlameBolt.png',
  "Hand of Gul'dan":'Spells/MeteorStorm.png',
  'Summon Felguard':'Spells/SummonFelGuard.png',
  'Chaos Bolt':'Abilities/ChaosBolt.png',
  'Incinerate':'Spells/FlameBolt.png',
  'Conflagrate':'Spells/Fire.png',
  'Shadowfury':'Spells/Shadowfury.png',
  // Друїд
  'Wild Charge':'Spells/feralchargecat.png',
  'Wrath':'Spells/WispSplodeGreen.png',
  'Starsurge':'Spells/StarFire.png',
  'Starfall':'Abilities/Starfall.png',
  'Shred':'Abilities/Swipe.png',
  'Ferocious Bite':'Abilities/FerociousBite.png',
  "Tiger's Fury":'Abilities/TigersRoar.png',
  'Regrowth':'Spells/HealingTouch.png',
  'Wild Growth':'Spells/Rejuvenation.png',
  'Swiftmend':'Spells/NatureBlessing.png',
  'Thunderstorm':'Spells/ThunderStorm.png',
  'Heroic Leap':'Abilities/HeroicLeap.png',
  'Harpoon':'Abilities/Trip.png',
  'Grappling Hook':'Abilities/FleetFooted.png',
  'Feral Lunge':'Abilities/BlackDireWolf.png',
  'Moonfire':'Spells/MoonGlow.png',
  'Entangling Roots':'Spells/NatureTouchGrow.png',
  'Pounce':'Abilities/Ravage.png',
  'Ironbark':'Spells/SkinofEarth.png',
};
// іконки форм друїда: кнопка показує форму, у яку перетворишся
// власні іконки вкладок спеку (інакше береться друга здібність — у друїдів це однаковий Regrowth)
const SPEC_ICONS={'druid/Balance':'Abilities/Starfall.png','druid/Feral':'Abilities/Cat.png','druid/Restoration':'Abilities/TreeofLife.png'};
const FORM_ICONS={cat:'Abilities/Cat.png',moonkin:'Abilities/EyeOfTheOwl.png',tree:'Abilities/TreeofLife.png',base:'Characters and Creatures/druid.png'};
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
/* Набір іконок (папка ICON_ROOT) не входить у репозиторій. Якщо його нема — прибираємо всі шляхи,
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
   СКІНИ: «Класичний» + 3 скіни на кожен спек за мотивами
   тір-сетів T1–T10 (Might, Judgement, Bloodfang, Transcendence…)
   body — колір броні, trim — оздоблення (пояс, наплічники, візерунок),
   head — тон обличчя, eyes — очі, glow — аура, pattern — фактура броні
   ============================================================ */
const CLASS_PATTERN={warrior:'plates',paladin:'plates',dk:'plates',
  hunter:'scales',shaman:'scales',rogue:'stripes',druid:'stripes',
  priest:'runes',mage:'runes',warlock:'runes'};
const SK=(name,tier,body,trim,o={})=>({name,tier,body,trim,head:'#e8b98a',eyes:'#ffffff',...o});
const DK_FACE={head:'#cfd6e4'};
const SPEC_SKINS={
  /* Воїн */
  'warrior/Arms':[
    SK('Battlegear of Might',1,'#6f7887','#c9a06a'),
    SK('Destroyer Battlegear',5,'#b8c4d8','#ff9440',{eyes:'#ff9440'}),
    SK("Wrynn's Battlegear",9,'#a8b8d0','#3a6ad0',{eyes:'#8fd0ff'}),
  ],
  'warrior/Fury':[
    SK('Battlegear of Wrath',2,'#2a2020','#c41e3a',{eyes:'#ff4a4a',glow:'#c41e3a'}),
    SK('Onslaught Battlegear',6,'#3a1a10','#ff7733',{eyes:'#ffb03a',glow:'#ff5a1a'}),
    SK("Ymirjar Lord's Battlegear",10,'#3a404c','#7de0ff',{eyes:'#7de0ff'}),
  ],
  'warrior/Protection':[
    SK("Dreadnaught's Battlegear",3,'#3a3f4a','#ff4a4a',{eyes:'#ff4a4a',glow:'#ff3a3a'}),
    SK('Siegebreaker Battlegear',8,'#7f8a9a','#ffd23a'),
    SK('Valorous Dreadnaught',7,'#5a6a80','#8fd0ff',{eyes:'#8fd0ff'}),
  ],
  /* Паладін */
  'paladin/Holy':[
    SK('Lawbringer Armor',1,'#c8ccd8','#ffd23a'),
    SK('Lightbringer Raiment',6,'#f0ecd8','#ffd23a',{glow:'#ffe9a3'}),
    SK('Aegis Regalia',8,'#d0a040','#6b4a2a'),
  ],
  'paladin/Protection':[
    SK('Redemption Armor',3,'#c9a040','#d8dde8'),
    SK('Justicar Armor',4,'#2a4a9a','#ffd23a'),
    SK('Lightsworn Plate',10,'#8a1e2a','#ffd23a',{glow:'#ffb03a'}),
  ],
  'paladin/Retribution':[
    SK('Judgement Armor',2,'#2a1e3e','#ffd23a',{eyes:'#ff9440',glow:'#ff9440'}),
    SK('Crystalforge Battlegear',5,'#a02a2a','#ffd23a'),
    SK("Turalyon's Battlegear",9,'#b8c4d8','#3a6ad0',{eyes:'#8fd0ff'}),
  ],
  /* Мисливець */
  'hunter/Beast Mastery':[
    SK('Giantstalker Armor',1,'#6b4a2a','#4a7a2a'),
    SK('Gronnstalker Armor',6,'#3a2a1e','#ffd23a',{eyes:'#ffd23a'}),
    SK('Scourgestalker Battlegear',8,'#5a5a30','#9dff70',{eyes:'#9dff70'}),
  ],
  'hunter/Marksmanship':[
    SK('Dragonstalker Armor',2,'#2a5a7a','#7cff6b',{eyes:'#7cff6b'}),
    SK('Rift Stalker Armor',5,'#1e3a3a','#8fd0ff',{eyes:'#8fd0ff'}),
    SK("Windrunner's Battlegear",9,'#2a4a8a','#9dff70'),
  ],
  'hunter/Survival':[
    SK('Cryptstalker Armor',3,'#1e2a3e','#7de0ff',{eyes:'#7de0ff'}),
    SK('Demon Stalker Armor',4,'#4a2a6a','#9dff70',{eyes:'#9dff70',glow:'#7cff6b'}),
    SK("Ahn'Kahar Blood Hunter",10,'#5a5a6a','#c41e3a',{eyes:'#ff4a4a'}),
  ],
  /* Розбійник */
  'rogue/Assassination':[
    SK('Nightslayer Armor',1,'#4a1a1a','#2a2020'),
    SK('Bloodfang Armor',2,'#1e1a1a','#c41e3a',{eyes:'#ff4a4a',glow:'#5a0a0a'}),
    SK("Shadowblade's Battlegear",10,'#2a2a30','#8a90b0',{eyes:'#b48cff'}),
  ],
  'rogue/Outlaw':[
    SK('Deathmantle',5,'#1e2a4a','#cfd6e4'),
    SK("VanCleef's Battlegear",9,'#8a2a2a','#ffdf8a',{eyes:'#ffdf8a'}),
    SK("Slayer's Armor",6,'#2a3a2a','#9dff70',{eyes:'#9dff70'}),
  ],
  'rogue/Subtlety':[
    SK('Bonescythe Armor',3,'#c8c0a8','#3a3a3a',{head:'#d8d2c0',eyes:'#ff4a4a'}),
    SK('Netherblade',4,'#3a1e5a','#b48cff',{eyes:'#b48cff',glow:'#6a3aff'}),
    SK('Terrorblade Battlegear',8,'#4a3a5a','#a878ff',{eyes:'#a878ff'}),
  ],
  /* Жрець */
  'priest/Discipline':[
    SK('Vestments of Prophecy',1,'#ece8dc','#ffd23a'),
    SK('Incarnate Raiment',4,'#f0eee6','#c9a040'),
    SK('Sanctification Garb',8,'#e8ecf4','#4a8ad0',{eyes:'#8fd0ff'}),
  ],
  'priest/Holy':[
    SK('Vestments of Transcendence',2,'#f4f2ec','#8a5cff',{glow:'#ffe9a3'}),
    SK('Absolution Regalia',6,'#f8f4e8','#ffd23a',{glow:'#fff2b0'}),
    SK('Vestments of Faith',7,'#ece8e0','#ffe27a'),
  ],
  'priest/Shadow':[
    SK('Avatar Regalia',5,'#2a2a5a','#b48cff',{eyes:'#b48cff'}),
    SK('Crimson Acolyte',10,'#8a1e2a','#f0eee6',{eyes:'#ff5ad0'}),
    SK("Zabra's Raiment",9,'#3a2a3a','#a878ff',{eyes:'#a878ff',glow:'#6a3aff'}),
  ],
  /* Лицар смерті */
  'dk/Blood':[
    SK('Scourgeborne Battlegear',7,'#3a3f4a','#c41e3a',{...DK_FACE,eyes:'#ff4a4a'}),
    SK("Scourgelord's Battlegear",10,'#2a2020','#ff4a4a',{...DK_FACE,eyes:'#ff4a4a',glow:'#c41e3a'}),
    SK("Koltira's Battlegear",9,'#5a1e2a','#b8c4d8',{...DK_FACE,eyes:'#7de0ff'}),
  ],
  'dk/Frost':[
    SK('Scourgeborne Plate',7,'#3a3f4a','#7de0ff',{...DK_FACE,eyes:'#7de0ff'}),
    SK('Darkruned Battlegear',8,'#2a2e3a','#7de0ff',{...DK_FACE,eyes:'#7de0ff',glow:'#4ab0ff'}),
    SK("Thassarian's Battlegear",9,'#5a6a80','#aee8ff',{...DK_FACE,eyes:'#aee8ff'}),
  ],
  'dk/Unholy':[
    SK('Darkruned Plate',8,'#2a3a2a','#7cff6b',{...DK_FACE,eyes:'#7cff6b'}),
    SK("Scourgelord's Plate",10,'#1e2a1e','#7cff6b',{...DK_FACE,eyes:'#7cff6b',glow:'#3a8a3a'}),
    SK('Scourgeborne Battlegear',7,'#3a4a3a','#9dff70',{...DK_FACE,eyes:'#9dff70'}),
  ],
  /* Шаман */
  'shaman/Elemental':[
    SK('Earthshatterer Raiment',3,'#3a2a2a','#ff4a4a',{eyes:'#ff4a4a',glow:'#ff3a3a'}),
    SK('Cataclysm Regalia',5,'#a03a1a','#ffb03a',{eyes:'#ffb03a'}),
    SK('Ten Storms',2,'#2a4a8a','#cfd6e4',{eyes:'#8fd0ff'}),
  ],
  'shaman/Enhancement':[
    SK('Earthfury',1,'#6b4a2a','#4a8ad0'),
    SK('Skyshatter Harness',6,'#2a3a8a','#b48cff',{eyes:'#8fd0ff',glow:'#4a90ff'}),
    SK("Thrall's Battlegear",9,'#7a3a1a','#8fd0ff',{head:'#6fa04a',eyes:'#8fd0ff'}),
  ],
  'shaman/Restoration':[
    SK('Cyclone Raiment',4,'#2a7aa0','#aee8ff',{eyes:'#aee8ff'}),
    SK('Worldbreaker Garb',8,'#c9a040','#4a8ad0'),
    SK("Frost Witch's Regalia",10,'#4a8ad0','#f0f4ff',{eyes:'#aee8ff',glow:'#aee8ff'}),
  ],
  /* Маг */
  'mage/Arcane':[
    SK('Arcanist Regalia',1,'#5a2a8a','#4a8ad0'),
    SK('Tirisfal Regalia',5,'#8a1a24','#e0b040'),
    SK('Kirin Tor Garb',8,'#6a3ad0','#ffd23a',{eyes:'#c9a8ff',glow:'#a878ff'}),
  ],
  'mage/Fire':[
    SK('Frostfire Regalia',3,'#2a3a8a','#ff7733',{eyes:'#ff7733',glow:'#ff5a1a'}),
    SK('Netherwind Regalia',2,'#5a1420','#b48cff',{eyes:'#ff7733'}),
    SK("Bloodmage's Regalia",10,'#8a1e2a','#2a2020',{eyes:'#ff7733',glow:'#ff3a3a'}),
  ],
  'mage/Frost':[
    SK('Tempest Regalia',6,'#2a5aa0','#f0f4ff',{eyes:'#aee8ff',glow:'#aee8ff'}),
    SK('Aldor Regalia',4,'#3a4a9a','#b48cff'),
    SK("Khadgar's Regalia",9,'#4a3a8a','#aee8ff',{eyes:'#aee8ff'}),
  ],
  /* Чорнокнижник */
  'warlock/Affliction':[
    SK('Felheart Raiment',1,'#3a1e4a','#c41e3a',{eyes:'#ff4a4a'}),
    SK('Plagueheart Raiment',3,'#2a4a1a','#9dff70',{eyes:'#9dff70',glow:'#7cff6b'}),
    SK("Dark Coven's Regalia",10,'#1e1a2a','#a878ff',{eyes:'#a878ff'}),
  ],
  'warlock/Demonology':[
    SK('Voidheart Raiment',4,'#1e2a4a','#8a5cff',{eyes:'#8a5cff'}),
    SK('Malefic Raiment',6,'#2a3a2a','#b48cff',{eyes:'#9dff70'}),
    SK('Deathbringer Garb',8,'#2a2a2a','#9dff70',{eyes:'#9dff70',glow:'#5aaa3a'}),
  ],
  'warlock/Destruction':[
    SK('Nemesis Raiment',2,'#3a1a3a','#ff5ad0',{eyes:'#ff5ad0'}),
    SK('Corruptor Raiment',5,'#4a2a5a','#ff9440',{eyes:'#ff9440',glow:'#ff5a1a'}),
    SK("Gul'dan's Regalia",9,'#5a1e2a','#ffb03a',{head:'#6fa04a',eyes:'#ffb03a'}),
  ],
  /* Друїд */
  'druid/Balance':[
    SK('Stormrage Raiment',2,'#2a4a8a','#ffd23a',{head:'#a48cff',eyes:'#ffe27a'}),
    SK('Nordrassil Regalia',5,'#3a7a3a','#ffd23a'),
    SK('Nightsong Garb',8,'#4a2a7a','#b8c8ff',{eyes:'#b8c8ff',glow:'#6a5aff'}),
  ],
  'druid/Feral':[
    SK('Cenarion Raiment',1,'#6b4a2a','#4a7a2a',{pattern:'fur'}),
    SK('Thunderheart Harness',6,'#7a4a1e','#ffb03a',{eyes:'#ffb03a',pattern:'fur'}),
    SK('Lasherweave Battlegear',10,'#4a5a2a','#7dff8a',{eyes:'#7dff8a',pattern:'fur'}),
  ],
  'druid/Restoration':[
    SK('Dreamwalker Raiment',3,'#2a5a3a','#ffe27a'),
    SK('Malorne Raiment',4,'#5a4a2a','#7dff8a',{eyes:'#7dff8a'}),
    SK("Runetotem's Garb",9,'#3a6a2a','#ffd23a',{head:'#7a4a2a',eyes:'#ffe27a'}),
  ],
};
// список скінів спеку: перший — класичний вигляд класу
function skinsFor(cls,spec){
  const key=cls.id+'/'+spec.name;
  const classic=SK('Класичний',0,cls.color,SPEC_ACCENT[key]||'#ffffff',{accent:SPEC_ACCENT[key]});
  const list=[classic,...(SPEC_SKINS[key]||[])];
  for(const s of list){ s.pattern=s.pattern||CLASS_PATTERN[cls.id]||'none'; s.accent=s.accent||s.trim; }
  return list;
}
for(const c of CLASSES) for(const s of c.specs) s.skins=skinsFor(c,s);
