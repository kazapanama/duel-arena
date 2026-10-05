"use strict";
/* ============================================================
   МОДЕЛІ: клас → спек → сет. Кожен рівень уточнює попередній.
   Кольори сету беруться зі SPEC_SKINS (body/trim/eyes/head/glow),
   тут — форма: шолом, наплічники, плащ, табард, зброя, ефекти.
   ============================================================ */

/* ---------- кольори ---------- */
function hexToRgb(h){ const n=parseInt(h.slice(1),16); return [n>>16,(n>>8)&255,n&255]; }
function rgbToHex(r,g,b){ return '#'+((1<<24)|(clamp(Math.round(r),0,255)<<16)|(clamp(Math.round(g),0,255)<<8)|clamp(Math.round(b),0,255)).toString(16).slice(1); }
// k<0 — темніше (множення), k>0 — світліше (до білого)
function hexShade(h,k){
  const [r,g,b]=hexToRgb(h);
  if(k<0){ const f=1+k; return rgbToHex(r*f,g*f,b*f); }
  return rgbToHex(r+(255-r)*k,g+(255-g)*k,b+(255-b)*k);
}
function hexMix(a,b,k){ const A=hexToRgb(a),B=hexToRgb(b); return rgbToHex(A[0]+(B[0]-A[0])*k,A[1]+(B[1]-A[1])*k,A[2]+(B[2]-A[2])*k); }
// темні кольори світлішаємо сильніше, щоб відблиски було видно
function lightOf(h,k){ const [r,g,b]=hexToRgb(h); const lum=(r+g+b)/765; return hexShade(h,k+(lum<0.2?0.12:0)); }

/* ---------- дефолти класів ---------- */
const CLASS_LOOK={
  warrior:{armor:'plate',helm:{t:'helm',crest:'horns'},sh:{t:'round',s:1.2},lower:'tassets',hair:'#5a3a22',metal:'#c4ccd8'},
  paladin:{armor:'plate',helm:{t:'open',crest:'wings'},sh:{t:'round',s:1.25},lower:'tassets',tabard:{emblem:'sun'},cape:{len:44,trim:1},hair:'#c8a060',metal:'#d8dde8'},
  hunter:{armor:'mail',helm:{t:'ranger',col:'sec'},sh:{t:'fur'},lower:'kilt',cape:{t:'tatter',len:34},hair:'#6a4a2a'},
  rogue:{armor:'leather',helm:{t:'hood',mask:'sec'},sh:{t:'blades',s:0.95},lower:'pants',hair:'#2a1a14'},
  priest:{armor:'cloth',helm:{t:'cowl'},sh:{t:'mantle'},lower:'robe',hair:'#d8c8a0'},
  dk:{armor:'plate',helm:{t:'skull'},sh:{t:'spiked',s:1.2},lower:'tassets',cape:{t:'tatter',len:40},race:'dk',hair:'#e0e4ea',metal:'#aab4c4'},
  shaman:{armor:'mail',helm:{t:'feathers'},sh:{t:'totem'},lower:'kilt',hair:'#3a2a1a',fur:true},
  mage:{armor:'cloth',helm:{t:'hat'},sh:{t:'mantle',gem:1},lower:'robe',hair:'#c8c0b0'},
  warlock:{armor:'cloth',helm:{t:'horns'},sh:{t:'spiked',s:0.95},lower:'robe',hair:'#2a1a2a'},
  druid:{armor:'leather',helm:{t:'antlers'},sh:{t:'leaf'},lower:'kilt',hair:'#5a3a1a'},
};
// базові кольори «Класичного» скіну (колір класу йде в оздоблення)
const CLASSIC_PRIM={warrior:'#8a909c',paladin:'#c8ccd8',hunter:'#5a6a3a',rogue:'#3a3230',priest:'#ecebe4',
  dk:'#3a3f4a',shaman:'#2a5a9a',mage:'#3a7ac0',warlock:'#5a3a8a',druid:'#6b4a2a'};

/* ---------- «Класичний» вигляд окремих спеків (за референсом користувача) ---------- */
const CLASSIC_LOOK={
  // Ret-паладин дреней: золоті лати, фіолетовий табард з емблемою, величезні наплічники з фіолетовим сяйвом,
  // темні рукавиці, дворучний молот із фіолетовим кристалом
  'paladin/Retribution':{prim:'#c8963a',sec:'#3a2468',trim:'#f2d27a',acc:'#b070ff',metal:'#d8b060',glove:'#2c2a38',
    helm:{t:'none'},sh:{t:'regal',s:1.3},tabard:{emblem:'palasym',col:'#3a2468',full:1},cape:null,
    main:{t:'crystalhammer'},aura:null},
};

/* ---------- спеки: стиль бою та зброя ---------- */
const SPEC_LOOK={
  'warrior/Arms':{style:'2h',main:{t:'axe2h'}},
  'warrior/Fury':{style:'dual',main:{t:'axe1h'},off:{t:'sword1h'}},
  'warrior/Protection':{style:'shield',main:{t:'sword1h'},off:{t:'shield',emblem:'lion'}},
  'paladin/Holy':{style:'shield',main:{t:'mace1h'},off:{t:'shield',emblem:'sun'},castSide:'b'},
  'paladin/Protection':{style:'shield',main:{t:'hammer1h'},off:{t:'shield',emblem:'cross'}},
  'paladin/Retribution':{style:'2h',main:{t:'hammer2h',rune:1},race:'draenei',legs:'hoof',tail:1,bulk:1.08}, // Ret — дреней
  'hunter/Beast Mastery':{style:'bow',main:{t:'bow'}},
  'hunter/Marksmanship':{style:'bow',main:{t:'bow',gem:1}},
  'hunter/Survival':{style:'spear',main:{t:'spear'}},
  'rogue/Assassination':{style:'dual',main:{t:'dagger',edge:1},off:{t:'dagger',edge:1}},
  'rogue/Combat':{style:'dual',main:{t:'sword1h'},off:{t:'pistol'},helm:{t:'bandana',col:'sec'}},
  'rogue/Subtlety':{style:'dual',main:{t:'dagger',curve:1},off:{t:'dagger',curve:1}},
  'priest/Discipline':{style:'staff',main:{t:'staff',head:'rune'}},
  'priest/Holy':{style:'staff',main:{t:'staff',head:'sun'},helm:{t:'circlet',halo:1}},
  'priest/Shadow':{style:'staff',main:{t:'staff',head:'void'},helm:{t:'hood'}},
  'dk/Blood':{style:'2h',main:{t:'sword2h',rune:1}},
  'dk/Frost':{style:'dual',main:{t:'sword1h',rune:1},off:{t:'sword1h',rune:1}},
  'dk/Unholy':{style:'2h',main:{t:'axe2h',edge:1}},
  'shaman/Elemental':{style:'staff',main:{t:'staff',head:'totem'}},
  'shaman/Enhancement':{style:'dual',main:{t:'axe1h',edge:1},off:{t:'axe1h',edge:1}},
  'shaman/Restoration':{style:'staff',main:{t:'staff',head:'orb'}},
  'mage/Arcane':{style:'staff',main:{t:'staff',head:'orb'}},
  'mage/Fire':{style:'staff',main:{t:'staff',head:'flame'}},
  'mage/Frost':{style:'staff',main:{t:'staff',head:'crystal'}},
  'warlock/Affliction':{style:'staff',main:{t:'staff',head:'skull'}},
  'warlock/Demonology':{style:'staff',main:{t:'staff',head:'void'}},
  'warlock/Destruction':{style:'staff',main:{t:'staff',head:'flame'}},
  'druid/Balance':{style:'staff',main:{t:'staff',head:'moon'},lower:'robe'},
  'druid/Feral':{style:'staff',main:{t:'staff',head:'crook'},helm:{t:'beast',fur:'sec'},sh:{t:'fur'}}, // у гуманоїді кастує; бій — у формі кота
  'druid/Restoration':{style:'staff',main:{t:'staff',head:'leaf'},lower:'robe'},
};

/* ---------- тір-сети: форма і деталі ----------
   ключ — назва скіну (або «назва@спек», якщо назва повторюється) */
const SET_LOOK={
  /* Воїн — за скріншотами сетів із гри (Wowhead) */
  // T1: золота бронза з бірюзовими вставками, наплічники з довгими кістяними шипами
  'Battlegear of Might':{prim:'#b08a3c',sec:'#2f7f86',trim:'#e6c872',metal:'#d8c89a',panels:'sec',
    helm:{t:'helm',crest:'horns'},sh:{t:'spikes',s:1.35,n:4,len:17,spc:'bone'},aura:null},
  // T5: темно-бордові лати з помаранчевим оздобленням, сині поножі, рогатий шолом, крила-наплічники
  'Destroyer Battlegear':{prim:'#5c2a2c',sec:'#28387a',trim:'#e0923a',acc:'#ffb040',legCol:'sec',
    helm:{t:'helm',crest:'horns'},sh:{t:'bat',s:1.3},glows:['chest'],aura:null},
  // T9 (Альянс): оливкова бронза з зеленим, величезні нефритові плити на плечах, бірюзові самоцвіти
  "Wrynn's Battlegear":{prim:'#6e6a3a',sec:'#2c5a3c',trim:'#d0b050',acc:'#5af0e0',panels:'sec',
    helm:{t:'helm',crest:'crown'},sh:{t:'slab',s:1.3,slab:'jade',gem:1},glows:['chest'],tabard:null,cape:null,aura:null},
  // T2: фіолетові лати з помаранчево-золотим кантом, чаші-наплічники зі світлою підкладкою, гребінь-лезо
  'Battlegear of Wrath':{prim:'#3c2c6c',sec:'#261c48',trim:'#e89040',acc:'#7cff6b',pale:'#e8dce8',
    helm:{t:'helm',crest:'blade',crestCol:'trim'},sh:{t:'bowl',s:1.35,inner:'pale',gem:1},panels:null,aura:null,fx:null},
  // T6 (за атласом користувача «Темний Лицар»): чорно-бура броня із золотими прожилками, каптур-шолом зі світною щілиною,
  // високим лезом і загнутим рогом, кулі-наплічники з шипами, шипастий комір, світне ядро під ним, темний плащ, шипасті молоти
  'Onslaught Battlegear':{prim:'#3a3129',sec:'#5e5244',trim:'#a8843a',acc:'#ffc828',metal:'#8c8a86',leath:'#2a221c',glove:'#2e2620',
    pal:{primL:'#6a5d4d',secL:'#857660',metalL:'#d8d6d0'},
    helm:{t:'onslaught'},sh:{t:'onslaught',s:1.3},cuff:'prim',veins:1,core:1,spikeCollar:1,greaves:1,bulk:1.08,chest:1.1,headScale:1.04,
    cape:{len:46,w:8,col:'#2a231d'},main:{t:'darkhammer'},off:{t:'darkhammer'},aura:null,fx:'gold'},
  // T10: темні лати врайкулів, золоте оздоблення, великі роги
  "Ymirjar Lord's Battlegear":{prim:'#2e2c30',sec:'#4a4850',trim:'#b89448',acc:'#7de0ff',hair:'#c8c0b0',
    helm:{t:'helm',crest:'bighorns'},sh:{t:'skull',s:1.3},cape:{t:'tatter',len:36,col:'#3a3634'},fx:'frost',aura:null,
    main:{t:'axe1h',edge:1},off:{t:'axe1h',edge:1}},
  // T3: сталево-чорні лати, череп-шолом із шипом, сині вогні на колінах, грудях і плечах
  "Dreadnaught's Battlegear":{prim:'#3a3e4c',sec:'#262834',trim:'#8a92a4',acc:'#5ad8ff',metal:'#aab4c8',
    helm:{t:'skull',crest:'spikes',crestCol:'metal'},sh:{t:'bigspikes',s:1.45,spc:'metal',gem:1},glows:['chest','knee'],aura:null,fx:null},
  // T8: бронзово-коричневі лати, шолом із закрученими рогами барана, блакитні вогні
  'Siegebreaker Battlegear':{prim:'#6a4a2e',sec:'#4a3420',trim:'#c8a060',acc:'#6af0ff',
    helm:{t:'helm',crest:'ramhorns',crestCol:'trim'},sh:{t:'round',s:1.35,gem:1},glows:['chest'],off:{t:'shield',emblem:'lion'},aura:null},
  // T7: чорні лати, масивні квадратні наплічники, сині вогні
  'Valorous Dreadnaught':{prim:'#2a2a32',sec:'#1e1e26',trim:'#5a6272',acc:'#6ad0ff',metal:'#7a8294',
    helm:{t:'helm',crest:'horns'},sh:{t:'layered',s:1.45,gem:1},glows:['chest','knee'],aura:null,fx:'frost'},
  /* Паладін — за скріншотами сетів із гри */
  // T1: бурштинове золото, шолом і наплічники з золотими крилами-плавцями
  'Lawbringer Armor':{prim:'#d09a3c',sec:'#a0641e',trim:'#fff0a8',acc:'#ffe27a',metal:'#f0d080',
    helm:{t:'open',crest:'wings'},sh:{t:'winged',s:1.35},tabard:null,cape:null,aura:null},
  // T6: золоті лати з фіолетовим спідом, корона з самоцвітами
  'Lightbringer Raiment':{prim:'#e0b030',sec:'#6a58b0',trim:'#fff4b0',acc:'#c9a8ff',panels:'sec',legCol:'sec',
    helm:{t:'open',crest:'crown'},sh:{t:'round',s:1.4,gem:1},tabard:null,cape:null,fx:'holy',aura:null},
  // T8: бронза з білою спідницею-табардом
  'Aegis Regalia':{prim:'#8a6a44',sec:'#e8e4d8',trim:'#d6b670',acc:'#ffe27a',
    helm:{t:'open',crest:'horns'},sh:{t:'layered',s:1.3},tabard:{emblem:'sun',col:'#ece8dc',full:1},fx:'holy',aura:null},
  // T3: сріблясто-бузкові лати, крилаті шолом і наплічники, блакитні вогні
  'Redemption Armor':{prim:'#a4a2c8',sec:'#6a6aa4',trim:'#e0e0f4',acc:'#5ad8ff',metal:'#dcdcf0',
    helm:{t:'open',crest:'wings'},sh:{t:'winged',s:1.35,gem:1},glows:['chest'],cape:null,tabard:null,aura:null},
  // T4: бузково-сталеві лати з фіолетовим сяйвом, бронзові вставки
  'Justicar Armor':{prim:'#8a86b0',sec:'#8a6a4a',trim:'#c8a070',acc:'#c080ff',panels:'sec',
    helm:{t:'helm',crest:'fin',crestCol:'acc'},sh:{t:'round',s:1.45,gem:1},glows:['chest'],off:{t:'shield',emblem:'lion'},tabard:null,cape:null,aura:null},
  // T10: темна бронза з золотими завитками й полум'ям, довгий темний табард
  'Lightsworn Plate':{prim:'#4c3824',sec:'#2c2218',trim:'#c89040',acc:'#ffa040',
    helm:{t:'helm',crest:'fin',crestCol:'trim'},sh:{t:'flame',s:1.35},tabard:{emblem:'sun',col:'#2c2218',full:1},fx:'embers',aura:null},
  // T2: червоно-помаранчевий каптур-шолом із червоними очима, золоті наплічники з рубінами, сонячний табард
  'Judgement Armor':{prim:'#c8401a',sec:'#8a1a10',trim:'#ffc040',acc:'#ff5a2a',
    helm:{t:'hood',col:'sec'},sh:{t:'round',s:1.45,col:'trim',gem:1},tabard:{emblem:'sun',col:'#e8801e',full:1},cape:null,fx:'embers',aura:null},
  // T5: яскраво-синій кришталь
  'Crystalforge Battlegear':{prim:'#4a50d0',sec:'#2a2a90',trim:'#a8b8ff',acc:'#9ad8ff',metal:'#c8d4ff',
    helm:{t:'helm',crest:'crown',crestCol:'acc'},sh:{t:'crystal',s:1.3},glows:['chest','knee'],tabard:null,cape:null,aura:null},
  // T9 (Альянс): біле срібло з синім, величезні золоті плити на плечах, блакитні самоцвіти
  "Turalyon's Battlegear":{prim:'#d0d4dc',sec:'#2a5aa0',trim:'#d8b048',acc:'#6ad0ff',panels:'sec',
    helm:{t:'helm',crest:'wings'},sh:{t:'slab',s:1.35,slab:'trim',gem:1},glows:['chest'],tabard:null,cape:{len:46,col:'#2a4aa0',trim:1},aura:null},
  /* Мисливець — за скріншотами сетів із гри */
  // T1: пурпурно-бордова кольчуга з золотом, високі темні плити на плечах
  'Giantstalker Armor':{prim:'#5c3a58',sec:'#3a2a34',trim:'#d0a040',acc:'#e0b050',metal:'#5c5a64',
    helm:{t:'open',crest:'fin',crestCol:'metal'},sh:{t:'slab',s:1.35,slab:'metal'},cape:null,aura:null},
  // T6: червоно-помаранчева кольчуга, величезні круглі червоні наплічники
  'Gronnstalker Armor':{prim:'#b83a28',sec:'#e06a30',trim:'#f0c070',acc:'#ffb040',
    helm:{t:'helm',crest:'blade',crestCol:'sec'},sh:{t:'round',s:1.55},cape:null,aura:null},
  // T8: темно-бордовий, наплічники з довгими вигнутими лезами, червоні вогні
  'Scourgestalker Battlegear':{prim:'#4a2a2e',sec:'#2a1a1e',trim:'#c05050',acc:'#ff5040',metal:'#9a8a8e',
    helm:{t:'helm',crest:'spikes',crestCol:'metal'},sh:{t:'spikes',s:1.3,n:5,len:22,spc:'metal'},glows:['chest'],cape:null,aura:null},
  // T2: помаранчева драконяча луска з фіолетовим, золотий гребінь
  'Dragonstalker Armor':{prim:'#c86a2a',sec:'#6a2a8a',trim:'#ffd060',acc:'#ff9a30',panels:'sec',
    helm:{t:'open',crest:'fin',crestCol:'trim'},sh:{t:'winged',s:1.25},cape:null,aura:null},
  // T4: синя кольчуга, величезні кістяні черепи на плечах із блакитними очима
  'Rift Stalker Armor':{prim:'#3a5aa8',sec:'#2a3a6a',trim:'#d0b070',acc:'#6ad0ff',
    helm:{t:'beast',fur:'sec',skull:'bone'},sh:{t:'skull',s:1.55},glows:['chest'],cape:null,aura:null,fx:null},
  // T9 (Альянс): темно-синя кольчуга з бронзою
  "Windrunner's Battlegear":{prim:'#2a3470',sec:'#8a5a2a',trim:'#d0a040',acc:'#c9a8ff',race:'nelf',hair:'#2a2458',longHair:1,
    helm:{t:'none'},sh:{t:'round',s:1.35,col:'sec'},cape:null,aura:null},
  // T3: бура кольчуга з бірюзою, череп-шолом із рогами, фіолетове сяйво
  'Cryptstalker Armor':{prim:'#6a4a30',sec:'#2a4a5a',trim:'#c0b080',acc:'#b080ff',
    helm:{t:'skull',crest:'horns'},sh:{t:'spider',s:1.2},fx:'shadow',cape:null,aura:null},
  // T5: темно-бура шкіра-кольчуга, рогатий шолом, зелене сяйво
  'Demon Stalker Armor':{prim:'#4a3020',sec:'#2a1e14',trim:'#a08050',acc:'#7cff4a',
    helm:{t:'helm',crest:'horns'},sh:{t:'spiked',s:1.2,gem:1},glows:['chest'],fx:'fel',cape:null,aura:null},
  // T10: темна бронза, кажанові наплічники
  "Ahn'Kahar Blood Hunter":{prim:'#4a3626',sec:'#2a2018',trim:'#b08a50',acc:'#ff4a3a',
    helm:{t:'helm',crest:'wings',crestCol:'prim'},sh:{t:'bat',s:1.2},cape:null,aura:null,fx:'blood'},
  /* Розбійник */
  /* за скріншотами сетів із гри */
  // T1: сталево-чорна шкіра, червоний шарф-маска, червоні наручі, великі темні наплічники
  'Nightslayer Armor':{prim:'#2c2e36',sec:'#c02020',trim:'#8a8e9a',metal:'#9aa0ac',bands:'sec',
    helm:{t:'hood',col:'prim',mask:'sec'},sh:{t:'round',s:1.35,col:'prim'},cape:null,aura:null},
  // референс користувача: червоний шипастий каптур з білим оскалом, чорна броня з червоними пластинами,
  // круглі червоні наплічники, вигнуті клинки з розпеченим помаранчевим лезом, без плаща
  // референс користувача (спрайт-лист «червоного лицаря»): високий гострий червоний каптур із загнутим назад
  // вістрям, чорна щитоподібна пройма в яскравій облямівці з білим зубчастим «^», рвані клапті за спиною,
  // майже чорна броня з червоним V-коміром, круглі темні наплічники з червоним ободом, червоні кільця на
  // біцепсах, зап'ястях і під колінами, червоний пояс із китицями, червоні чоботи з білими кігтями,
  // широкі чорні кинджали з вогняно-золотим зазубреним лезом і золотими прожилками
  'Bloodfang Armor':{prim:'#2c3038',sec:'#c8241c',trim:'#f0b030',acc:'#ff7a1e',leath:'#1a1c22',
    helm:{t:'peakhood',col:'sec',rim:'secL',grin:1,flaps:4},sh:{t:'rimmed',s:1.2,rim:'sec'},
    plain:1,collar:'sec',bands:'sec',straps:'sec',boot:'sec',feet:'claws',belt:'sec',chest:1.26,
    stance:{py:7,lean:0.1,bfx:-16,ffx:15,fhx:17,fhy:-52,wf:2.45,bhx:-13,bhy:-54,wb:-2.4}, // низько, леза донизу
    cape:null,aura:null,fx:'embers',bulk:1.24,headScale:1.08,
    main:{t:'bfdagger'},off:{t:'bfdagger'}},
  // T10: сріблясто-сіра шкіра з кістяними шипами, зелене око в каптурі
  "Shadowblade's Battlegear":{prim:'#6a6e7a',sec:'#3a3e48',trim:'#c8b890',acc:'#8aff4a',
    helm:{t:'hood',col:'sec'},sh:{t:'spikes',s:1.2,n:4,len:14,spc:'bone'},cape:null,aura:null,fx:null},
  // T5: чорна шкіра, біла кістяна маска з фіолетовими очима, кістяні шипи на плечах
  'Deathmantle':{prim:'#34323c',sec:'#24222a',trim:'#8a80a0',acc:'#d060ff',
    helm:{t:'hood',col:'prim',mask:'bone'},sh:{t:'spikes',s:1.3,n:5,len:16,spc:'bone'},cape:null,aura:null},
  // T9 (Альянс): темно-синя шкіра з бронзою, руде волосся
  "VanCleef's Battlegear":{prim:'#243044',sec:'#6a4a2a',trim:'#c0a060',acc:'#5ad0ff',hair:'#c04020',longHair:1,
    helm:{t:'none'},sh:{t:'round',s:1.3,col:'sec',gem:1},cape:null,aura:null},
  // T6: червона шкіра з темно-червоним, шипасті наплічники
  "Slayer's Armor":{prim:'#8a2a1e',sec:'#4a1410',trim:'#d06040',acc:'#ff6a30',
    helm:{t:'hood',col:'sec'},sh:{t:'spiked',s:1.3,col:'prim'},cape:null,aura:null,fx:null},
  // T3: темна бронза з бірюзою, череп-капюшон, червоний плащ
  'Bonescythe Armor':{prim:'#3a3a34',sec:'#2a5a5a',trim:'#a89060',acc:'#5ad8c8',metal:'#a0a090',
    helm:{t:'skull',col:'prim'},sh:{t:'bigspikes',s:1.25,spc:'metal'},cape:{len:40,col:'#8a1e1e'},aura:null},
  // T4: чорно-фіолетова шкіра з пурпуровим кантом
  'Netherblade':{prim:'#2a1a36',sec:'#4a2a5a',trim:'#c060c0',acc:'#ff5ae0',
    helm:{t:'hood',col:'prim',mask:'sec'},sh:{t:'spiked',s:1.2,col:'sec'},glows:['chest'],fx:'arcane',cape:null,aura:null},
  // T8: синьо-фіолетова шкіра, кістяні пазурі на плечах, фіолетове сяйво
  'Terrorblade Battlegear':{prim:'#3a3a78',sec:'#2a2a50',trim:'#d0c0a0',acc:'#a070ff',
    helm:{t:'hood',col:'sec'},sh:{t:'spikes',s:1.25,n:4,len:13,spc:'bone'},fx:'shadow',cape:null,aura:null},
  /* Жрець — за скріншотами сетів із гри */
  // T1: оливково-золота мантія з червоною центральною панеллю
  'Vestments of Prophecy':{prim:'#9a7a30',sec:'#7a1a14',trim:'#e8c050',acc:'#ff5a3a',
    helm:{t:'circlet'},sh:{t:'mantle',gem:1},aura:null},
  // T4: темно-фіолетова мантія
  'Incarnate Raiment':{prim:'#3a2458',sec:'#22143a',trim:'#9a7ac8',acc:'#e0a8ff',
    helm:{t:'circlet'},sh:{t:'mantle',gem:1},fx:'arcane',aura:null},
  // T7: сріблясто-блакитна мантія з темною панеллю, крижані шипи на плечах, каптур
  'Sanctification Garb':{prim:'#aabcd8',sec:'#34426a',trim:'#e4eeff',acc:'#6ab8ff',
    helm:{t:'cowl',col:'prim'},sh:{t:'crystal',s:1.25},aura:null},
  // T2: біло-золота мантія з бірюзовою панеллю, німб
  'Vestments of Transcendence':{prim:'#e8dcc0',sec:'#2a7a9a',trim:'#d8b048',acc:'#6ad8ff',
    helm:{t:'circlet',halo:1},sh:{t:'winged',s:1.15},fx:'holy',aura:null},
  // T6: темно-синя мантія зі сріблом, каптур, великі срібні наплічники
  'Absolution Regalia':{prim:'#2a2e5c',sec:'#1a1c3c',trim:'#a8b0d8',acc:'#5ab0ff',
    helm:{t:'hood',col:'prim'},sh:{t:'layered',s:1.3,col:'trim'},glows:['chest'],aura:null},
  // T3: світло-блакитна мантія з сяйливими кристалами за плечима
  'Vestments of Faith':{prim:'#a8c4dc',sec:'#4a78a8',trim:'#e4f2ff',acc:'#8fd8ff',
    helm:{t:'circlet',halo:1},sh:{t:'crystal',s:1.4},fx:'holy',aura:null},
  // T5: біла мантія з золотом і темною спідницею, білий каптур
  'Avatar Regalia':{prim:'#e4e0d0',sec:'#2a3050',trim:'#d0a848',acc:'#b48cff',
    helm:{t:'hood',col:'prim'},sh:{t:'round',s:1.3,col:'trim'},aura:null},
  // T10: темна мантія з зеленими самоцвітами
  'Crimson Acolyte':{prim:'#3a3448',sec:'#262432',trim:'#7ab060',acc:'#6aff4a',
    helm:{t:'hood',col:'prim'},sh:{t:'orb',s:1.2},glows:['chest'],fx:'fel',aura:null},
  // T9: темно-бордова мантія з вогняно-помаранчевим, шипи
  "Zabra's Raiment":{prim:'#3a1e2a',sec:'#6a2414',trim:'#d06a30',acc:'#ff7a30',
    helm:{t:'hood',col:'prim',horns:1},sh:{t:'spiked',s:1.25},fx:'embers',aura:null},
  /* Лицар смерті — за скріншотами сетів із гри */
  // T7: темно-фіолетові лати з вигнутими рогами, сині поножі, блакитні вогні
  'Scourgeborne Battlegear':{prim:'#3a2e4a',sec:'#26307a',trim:'#b08a60',acc:'#5ad8ff',legCol:'sec',
    helm:{t:'helm',crest:'horns'},sh:{t:'spikes',s:1.3,n:3,len:15,spc:'primL'},glows:['chest'],cape:null,aura:null},
  // T10: темно-фіолетові лати, високий гребінь-кристал
  "Scourgelord's Battlegear":{prim:'#3a2c44',sec:'#241c2e',trim:'#8a6aa0',acc:'#c060ff',
    helm:{t:'helm',crest:'blade',crestCol:'acc'},sh:{t:'layered',s:1.4},glows:['chest'],fx:'shadow',cape:null,aura:null},
  // T9 (Орда): сталеві лати з синім, масивні плити на плечах
  "Koltira's Battlegear":{prim:'#5a6070',sec:'#2a3a6a',trim:'#a0a8b8',acc:'#5ab0ff',panels:'sec',
    helm:{t:'skull',crest:'spikes',crestCol:'metal'},sh:{t:'slab',s:1.35,slab:'metal',gem:1},glows:['chest'],cape:null,aura:null},
  // T7 (танк): мідно-бурі лати з рогами, бордова спідниця
  'Scourgeborne Plate':{prim:'#6a3a24',sec:'#4a1418',trim:'#c89048',acc:'#6ad8ff',
    helm:{t:'helm',crest:'horns'},sh:{t:'spikes',s:1.3,n:3,len:18,spc:'prim'},tabard:{emblem:'skull',col:'#4a1418',full:1},cape:null,fx:'frost',aura:null},
  // T8: темна бронза з бірюзовими рунами, роги
  'Darkruned Battlegear':{prim:'#3a302a',sec:'#241e1a',trim:'#8a7a60',acc:'#5ae0d0',
    helm:{t:'skull',crest:'horns'},sh:{t:'bigspikes',s:1.35,spc:'prim',gem:1},glows:['chest'],fx:'frost',cape:null,aura:null},
  // T9 (Альянс): темно-синій з сяйливими блакитними сферами на плечах
  "Thassarian's Battlegear":{prim:'#24305a',sec:'#18203c',trim:'#9aa8c8',acc:'#6ad8ff',
    helm:{t:'helm',crest:'fin',crestCol:'prim'},sh:{t:'orb',s:1.3},glows:['chest','knee'],cape:{len:44,col:'#1e2a5a',trim:1},fx:'frost',aura:null},
  // T8 (танк): темні лати зі сріблом і блакиттю
  'Darkruned Plate':{prim:'#34303a',sec:'#22202a',trim:'#a0a8c0',acc:'#7ad8ff',
    helm:{t:'skull',crest:'horns'},sh:{t:'bigspikes',s:1.3,spc:'metal'},glows:['chest'],fx:'poison',aura:null},
  "Scourgelord's Plate":{prim:'#3a2c40',sec:'#221a28',trim:'#7a6a8a',acc:'#c060ff',
    helm:{t:'helm',crest:'blade',crestCol:'acc'},sh:{t:'layered',s:1.4},glows:['chest'],fx:'poison',aura:null},
  'Scourgeborne Battlegear@Unholy':{prim:'#3a2e4a',sec:'#26307a',trim:'#b08a60',acc:'#6aff5a',legCol:'sec',
    helm:{t:'helm',crest:'horns'},sh:{t:'spikes',s:1.3,n:3,len:15,spc:'primL'},glows:['chest'],fx:'poison',cape:null,aura:null},
  /* Шаман — за скріншотами сетів із гри */
  // T7: темно-синя кольчуга-мантія з бірюзовими вогнями, рогатий шолом
  'Earthshatterer Raiment':{prim:'#24305a',sec:'#18203a',trim:'#6ab0c8',acc:'#5ae8ff',lower:'robe',
    helm:{t:'helm',crest:'horns'},sh:{t:'spiked',s:1.25,gem:1},glows:['chest'],aura:null},
  // T5: розжарена лава: темно-бура броня з помаранчевими тріщинами
  'Cataclysm Regalia':{prim:'#5a3020',sec:'#2a1812',trim:'#ff8a2a',acc:'#ffb030',
    helm:{t:'helm',crest:'horns'},sh:{t:'flame',s:1.4},glows:['chest'],fx:'embers',aura:null},
  // T2: синьо-фіолетова кольчуга з хутром, великі наплічники-голови
  'Ten Storms':{prim:'#3a44a0',sec:'#6a4a2a',trim:'#a8c0ff',acc:'#8fd0ff',
    helm:{t:'helm',crest:'horns'},sh:{t:'beast',s:1.35},glows:['chest'],fx:'lightning',aura:null},
  // T1: фіолетова кольчуга-мантія з вогняною спідницею, рогатий шолом-маска
  'Earthfury':{prim:'#5a2a6a',sec:'#2a1a1a',trim:'#e0a040',acc:'#ff7a2a',lower:'robe',
    helm:{t:'helm',crest:'horns'},sh:{t:'round',s:1.25,col:'trim'},aura:null},
  // T6: темно-синя мантія з сяйливими блакитними сферами
  'Skyshatter Harness':{prim:'#2a3060',sec:'#1a1e3a',trim:'#8a98c8',acc:'#6ae0ff',lower:'robe',
    helm:{t:'skull',col:'prim'},sh:{t:'orb',s:1.35},glows:['chest'],fx:'lightning',aura:null},
  // T9 (Орда): фіолетово-синя кольчуга з шипами, орк
  "Thrall's Battlegear":{prim:'#3a3a90',sec:'#24245a',trim:'#8a8ad0',acc:'#8fd0ff',race:'orc',hair:'#1a1a1a',longHair:1,
    helm:{t:'none'},sh:{t:'bigspikes',s:1.35,spc:'primL',gem:1},fx:'lightning',aura:null},
  // T4: темно-синя мантія, масивні наплічники, зелене сяйво в руках
  'Cyclone Raiment':{prim:'#2a3468',sec:'#1a2040',trim:'#8ab0e0',acc:'#7aff6a',lower:'robe',
    helm:{t:'none'},sh:{t:'layered',s:1.4},aura:null},
  // T8: бронза з золотими вогнями, довга мантія
  'Worldbreaker Garb':{prim:'#6a4a2a',sec:'#4a2a1a',trim:'#e0b050',acc:'#ffc040',lower:'robe',
    helm:{t:'helm',crest:'crown',crestCol:'trim'},sh:{t:'flame',s:1.3},glows:['chest'],fx:'holy',aura:null},
  // T10: оливково-зелена кольчуга з кістяними наплічниками, блакитні вогні
  "Frost Witch's Regalia":{prim:'#4a5a34',sec:'#2a3420',trim:'#c8c0a0',acc:'#6ad8ff',
    helm:{t:'skull',col:'prim'},sh:{t:'skull',s:1.35},glows:['chest'],fx:'frost',aura:null},
  /* Маг — за скріншотами сетів із гри (Tirisfal — за референсом користувача) */
  // T1: синьо-фіолетова мантія з золотом і помаранчевою панеллю, високий комір-корона
  'Arcanist Regalia':{prim:'#3a3a9a',sec:'#c05a2a',trim:'#e0b048',acc:'#ffb040',
    helm:{t:'crown'},sh:{t:'winged',s:1.2},aura:null},
  'Tirisfal Regalia':{prim:'#8a1a24',sec:'#3a3036',trim:'#e0b040',acc:'#ff3a2a',skin:'#e0b8a0',
    helm:{t:'cowl',col:'prim'},sh:{t:'round',s:1.3},gem:1,main:{t:'staff',head:'claw'},fx:'embers'},
  // T8: темна бронза з помаранчевими прожилками, кістяні ікла на плечах, око на грудях
  'Kirin Tor Garb':{prim:'#3a2e24',sec:'#241c16',trim:'#c07a40',acc:'#ff9a40',
    helm:{t:'helm',crest:'spikes',crestCol:'bone'},sh:{t:'spikes',s:1.3,n:4,len:14,spc:'bone'},glows:['chest'],aura:null},
  // T7: блакитно-сріблясті крижані шати з кристалами на плечах
  'Frostfire Regalia':{prim:'#6aa8c8',sec:'#2a4a7a',trim:'#d8f0ff',acc:'#7ae8ff',
    helm:{t:'hood',col:'prim'},sh:{t:'crystal',s:1.4},glows:['chest'],fx:'frost',aura:null},
  // T2: пурпурово-синя мантія з бірюзою, рогатий капюшон-корона
  'Netherwind Regalia':{prim:'#6a2a5a',sec:'#2a3a7a',trim:'#5ad0c0',acc:'#c080ff',
    helm:{t:'crown'},sh:{t:'winged',s:1.25},fx:'arcane',aura:null},
  // T10: темно-фіолетова мантія з золотом, золоті наплічники
  "Bloodmage's Regalia":{prim:'#3a2a5a',sec:'#241a3a',trim:'#e0b040',acc:'#ff9a40',
    helm:{t:'hood',col:'prim'},sh:{t:'round',s:1.3,col:'trim'},fx:'embers',aura:null},
  // T6: фіолетова мантія з високими кристалічними наплічниками
  'Tempest Regalia':{prim:'#4a3070',sec:'#2a1a44',trim:'#c0a8e8',acc:'#d8b0ff',
    helm:{t:'crown'},sh:{t:'crystal',s:1.45},fx:'arcane',aura:null},
  // T4: синя мантія з бронзою
  'Aldor Regalia':{prim:'#2a5a9a',sec:'#6a4a2a',trim:'#c89a50',acc:'#6ae0ff',
    helm:{t:'circlet'},sh:{t:'round',s:1.3,col:'sec'},glows:['chest'],aura:null},
  // T9 (Альянс): бузково-срібна мантія, каптур-шолом, рожеве сяйво
  "Khadgar's Regalia":{prim:'#8a7aa8',sec:'#5a3a6a',trim:'#e0d0f0',acc:'#ff80c0',
    helm:{t:'hood',col:'prim'},sh:{t:'layered',s:1.3},glows:['chest'],fx:'arcane',aura:null},
  /* Чорнокнижник — за скріншотами сетів із гри */
  // T1: темно-бордова мантія з фіолетовою спідницею й зеленими вогнями, роги, шипасті наплічники
  'Felheart Raiment':{prim:'#5a1e1a',sec:'#3a2a5a',trim:'#d08030',acc:'#6aff4a',
    helm:{t:'horns'},sh:{t:'bigspikes',s:1.3,spc:'primL',gem:1},glows:['chest'],fx:'fel',aura:null},
  // T3: темна мантія з бронзово-золотим і бірюзою, каптур, великі наплічники з зеленими самоцвітами
  'Plagueheart Raiment':{prim:'#2a2a1e',sec:'#1e3a2e',trim:'#b09040',acc:'#5aff9a',
    helm:{t:'hood',col:'prim'},sh:{t:'layered',s:1.4,col:'trim',gem:1},glows:['chest'],fx:'fel',aura:null},
  // T10: фіолетова мантія з бірюзовими рунами, високий шолом
  "Dark Coven's Regalia":{prim:'#3a2a6a',sec:'#22184a',trim:'#6ad8e8',acc:'#5ae8ff',
    helm:{t:'hood',col:'prim'},sh:{t:'crystal',s:1.2},glows:['chest'],fx:'arcane',aura:null},
  // T4: фіолетова мантія, шолом із синім полум'ям, шипи
  'Voidheart Raiment':{prim:'#3a2a58',sec:'#1e1636',trim:'#b0a0d0',acc:'#4a6aff',
    helm:{t:'skull',col:'prim'},sh:{t:'spikes',s:1.25,n:4,len:14,spc:'primL'},glows:['chest'],fx:'shadow',aura:null},
  // T6: багряна мантія з рогами й величезними демонічними крилами
  'Malefic Raiment':{prim:'#6a1a1e',sec:'#3a0e12',trim:'#e07a30',acc:'#ff7a30',wingCol:'#d8602a',permWings:0.8,wingKind:'bat',
    helm:{t:'horns'},sh:{t:'spiked',s:1.2},glows:['chest'],fx:'embers',aura:null},
  // T8: темно-синя мантія з бронзою, зелені сфери над плечима
  'Deathbringer Garb':{prim:'#2a3050',sec:'#5a3a24',trim:'#b08a50',acc:'#7aff4a',
    helm:{t:'hood',col:'prim'},sh:{t:'orb',s:1.3},glows:['chest'],fx:'fel',aura:null},
  // T5: зелена мантія з кістяним черепом-шоломом і рогами
  'Nemesis Raiment':{prim:'#2a4a24',sec:'#1a2a16',trim:'#b0c060',acc:'#9aff4a',
    helm:{t:'skull',crest:'bighorns'},sh:{t:'skull',s:1.3},glows:['chest'],fx:'fel',aura:null},
  // T5 (варіант): чорна мантія з червоними вогнями, каптур, шипи
  'Corruptor Raiment':{prim:'#241c20',sec:'#3a1016',trim:'#8a2a2a',acc:'#ff3a2a',
    helm:{t:'hood',col:'prim'},sh:{t:'spikes',s:1.3,n:5,len:15,spc:'primL',gem:1},glows:['chest'],fx:'embers',aura:null},
  // T9 (Орда): бордово-фіолетова мантія з шипами, орк
  "Gul'dan's Regalia":{prim:'#4a1e2e',sec:'#2a1020',trim:'#b06080',acc:'#ff5ad0',race:'orc',
    helm:{t:'hood',col:'prim'},sh:{t:'bigspikes',s:1.3,spc:'primL'},fx:'fel',aura:null},
  /* Друїд — за скріншотами сетів із гри */
  // T2: золото-бурі шати з зеленими листяними вставками, великі роги-лопаті, кістяні пазурі на плечах
  'Stormrage Raiment':{prim:'#8a6a2a',sec:'#2a6a2a',trim:'#e0c060',acc:'#8aff6a',lower:'robe',race:'nelf',hair:'#3a8a7a',longHair:1,
    helm:{t:'antlers'},sh:{t:'spikes',s:1.3,n:4,len:13,spc:'bone'},aura:null},
  // T5: темно-зелені шати з бурою шкірою, зелені роги
  'Nordrassil Regalia':{prim:'#2a4a24',sec:'#5a3a24',trim:'#a08a50',acc:'#7dff8a',lower:'robe',
    helm:{t:'antlers'},sh:{t:'leaf',s:1.2},fx:'nature',aura:null},
  // T8: бурштиново-золоті шати з сяйливими сферами на плечах
  'Nightsong Garb':{prim:'#8a5a24',sec:'#5a3414',trim:'#e0b048',acc:'#ffd040',lower:'robe',
    helm:{t:'circlet'},sh:{t:'orb',s:1.35},fx:'holy',aura:null},
  // T1: зелені шати з листяною накидкою, роги-гілки
  'Cenarion Raiment':{prim:'#4a5a34',sec:'#2a3a1e',trim:'#c8c8a0',acc:'#8ad05a',lower:'robe',
    helm:{t:'antlers'},sh:{t:'leaf',s:1.35},fx:'nature',aura:null},
  // T6: бура шкіра з червоною спідницею, пір'яний головний убір
  'Thunderheart Harness':{prim:'#5a3a24',sec:'#8a2a1e',trim:'#c89a50',acc:'#6ad8ff',
    helm:{t:'feathers'},sh:{t:'feathers',s:1.25},glows:['chest'],aura:null},
  // T10: темна шкіра з зеленими пащами на плечах, роги
  'Lasherweave Battlegear':{prim:'#3a2e24',sec:'#241c16',trim:'#8a7a50',acc:'#7dff5a',
    helm:{t:'helm',crest:'bighorns'},sh:{t:'beast',s:1.3},glows:['chest'],fx:'nature',aura:null},
  // T3: зелено-золоті шати з листяними наплічниками, високий зелений шолом
  'Dreamwalker Raiment':{prim:'#3a7a3a',sec:'#1e4a24',trim:'#d0c060',acc:'#9aff6a',lower:'robe',
    helm:{t:'hood',col:'prim'},sh:{t:'crystal',s:1.25},fx:'nature',aura:null},
  // T4: біло-золоті шати з пір'ям-крилами на плечах
  'Malorne Raiment':{prim:'#e0d0b0',sec:'#8a6a3a',trim:'#d8b060',acc:'#ffe27a',
    helm:{t:'antlers'},sh:{t:'winged',s:1.35},fx:'holy',aura:null},
  // T9 (Орда): бура шкіра з зеленим пір'ям, таурен
  "Runetotem's Garb":{prim:'#5a3a22',sec:'#2a4a1e',trim:'#b09050',acc:'#ffe040',race:'tauren',hair:'#3a2a1a',
    helm:{t:'none'},sh:{t:'feathers',s:1.35},glows:['chest'],beard:0,aura:null},
};

/* ---------- ефекти сетів (частинки навколо бійця) ---------- */
const FX_KIND={
  embers:{cols:['#ff9440','#ffd23a'],vy:-50,g:-40,rate:7},
  gold:{cols:['#ffc828','#ffe9a3'],vy:-35,g:-25,rate:4},
  frost:{cols:['#cfefff','#aee8ff'],vy:-6,g:15,rate:6},
  shadow:{cols:['#6a4a9a','#2a1a3a'],vy:-30,g:-20,rate:7},
  holy:{cols:['#ffe9a3','#ffffff'],vy:-40,g:-30,rate:6},
  fel:{cols:['#7cff6b','#3a8a3a'],vy:-40,g:-35,rate:7},
  blood:{cols:['#c41e3a','#7a0e18'],vy:20,g:500,rate:5},
  arcane:{cols:['#c9a8ff','#8fd0ff'],vy:-20,g:-10,rate:6},
  nature:{cols:['#7dff8a','#4a8a3a'],vy:10,g:30,rate:4},
  lightning:{cols:['#bfe6ff','#ffffff'],vy:-10,g:0,rate:6},
  poison:{cols:['#7cff6b','#9dff70'],vy:10,g:300,rate:5},
};

/* ---------- раса за кольором обличчя скіну ---------- */
function raceFromSkin(skin,cls){
  const h=skin.head;
  if(h==='#6fa04a') return 'orc';
  if(h==='#a48cff') return 'nelf';
  if(h==='#7a4a2a') return 'tauren';
  if(cls.id==='dk') return 'dk';
  return 'human';
}

/* ---------- збірка моделі ---------- */
// раса, задана скіном (race у SET_LOOK або в SK): шкіра, ноги, борода — те, що робить расу впізнаваною навіть під шоломом
const RACE_SKIN={orc:'#6fa04a',nelf:'#a48cff',tauren:'#7a4a2a',dk:'#cfd6e4',draenei:'#94a6c8',
  belf:'#f0c8a0',troll:'#5a8ab0',undead:'#9aa890',dwarf:'#e0a880',human:'#e8b98a'};
function applyRace(m,race,L){
  m.race=race;
  if(race==='draenei'){ m.legs='hoof'; m.tail=1; }
  else if(race==='tauren'){ m.legs='hoof'; m.tail=1; m.bulk=Math.max(m.bulk||1,1.12); }
  else { if(m.legs==='hoof'&&!(L&&L.legs)) m.legs=null; if(!(L&&L.tail)) m.tail=0; }
  if(race==='dwarf'){ m.beard=1; m.bulk=Math.max(m.bulk||1,1.1); }
  if(race==='troll'&&!m.longHair) m.mohawk=1;
}
function resolveModel(cls,spec,skin){
  const key=cls.id+'/'+spec.name;
  const C=CLASS_LOOK[cls.id], SP=SPEC_LOOK[key]||{};
  const L=skin.tier? (SET_LOOK[skin.name+'@'+spec.name]||SET_LOOK[skin.name]||{}) : (CLASSIC_LOOK[key]||{});
  const classic=!skin.tier;
  const accent=SPEC_ACCENT[key]||skin.trim;
  const m={
    armor:C.armor, style:SP.style||'staff',
    helm:{...(SP.helm||C.helm)}, sh:{...(SP.sh||C.sh)},
    lower:SP.lower||C.lower,
    cape:C.cape?{...C.cape}:null, tabard:C.tabard?{...C.tabard}:null,
    race:C.race||SP.race||raceFromSkin(skin,cls),
    legs:SP.legs||null, tail:SP.tail||0, bulk:SP.bulk||1,
    main:{...SP.main}, off:SP.off?{...SP.off}:null,
    castSide:SP.castSide||'b',
    gem:0, fx:null, aura:skin.glow||null,
    longHair:0, beard:0, mohawk:0,
  };
  // накладаємо опис сету
  for(const k of ['helm','sh','main','off']) if(L[k]!==undefined) m[k]=L[k]?{...L[k]}:null;
  for(const k of ['cape','tabard']) if(L[k]!==undefined) m[k]=L[k]?{...(m[k]||{}),...L[k]}:null;
  for(const k of ['lower','race','gem','fx','longHair','beard','mohawk','plates','bulk','headScale','aura',
    'plain','collar','bands','straps','boot','feet','belt','chest','stance','panels','legCol','glows','sash','skirt','permWings','wingKind',
    'cuff','veins','core','spikeCollar','greaves']) if(L[k]!==undefined) m[k]=L[k];
  if(skin.race) m.race=skin.race;
  // раса зі скіну, якої не дає клас чи спек (дворф, ельф крові, троль, нежить, таурен…): ноги, хвіст, борода
  if((L.race||skin.race)&&m.race!==(SP.race||C.race)) applyRace(m,m.race,L);
  if(m.race==='tauren'||m.race==='orc'){ if(!L.helm) m.helm={t:'none'}; }
  if(m.race==='draenei'&&m.helm&&['open','circlet','crown'].includes(m.helm.t)&&!L.helm) m.helm={...m.helm}; // обличчя дренея видно

  // кольори
  const prim=classic?(L.prim||CLASSIC_PRIM[cls.id]):(L.prim||skin.body);
  let trim=classic?(L.trim||(cls.id==='priest'?'#d8b048':skin.trim)):(L.trim||skin.trim);
  // неонові акценти скінів в оздобленні броні приглушуємо до «металу/фарби»
  { const [r,g,b]=hexToRgb(trim), mx=Math.max(r,g,b), mn=Math.min(r,g,b);
    if(mx>200&&(mx-mn)>120) trim=hexShade(hexMix(trim,'#9a9080',0.22),-0.12); }
  const sec=classic?(L.sec||hexMix(cls.color,prim,0.3)):(L.sec||hexShade(prim,-0.45));
  const acc=L.acc||accent;
  const skinCol=L.skin||(m.race!=='human'?RACE_SKIN[m.race]:null)||skin.head||'#e8b98a';
  const glowEye=(skin.eyes&&skin.eyes!=='#ffffff')||m.race==='draenei'||m.race==='undead';
  const eye=(skin.eyes&&skin.eyes!=='#ffffff')?skin.eyes:(m.race==='dk'?'#7de0ff':(m.race==='draenei'?'#eef8ff':'#e8f0ff'));
  const capeCol=(m.cape&&m.cape.col)||(classic?cls.color:hexShade(sec,0.05));
  const tabCol=(m.tabard&&m.tabard.col)||(classic?cls.color:sec);
  const shieldCol=(m.off&&m.off.col)||(classic?cls.color:sec);
  const metal=L.metal||C.metal||'#c0c8d4';
  const leath=L.leath||'#5a3a24';
  const hair=L.hair||C.hair||'#4a3020';
  m.glowEye=glowEye||m.race==='dk';
  m.fur=C.fur||false;
  m.pal={
    prim, primD:hexShade(prim,-0.32), primDD:hexShade(prim,-0.58), primL:lightOf(prim,0.3),
    sec, secD:hexShade(sec,-0.35), secDD:hexShade(sec,-0.6), secL:lightOf(sec,0.3),
    trim, trimD:hexShade(trim,-0.4), trimL:lightOf(trim,0.45),
    metal, metalD:hexShade(metal,-0.38), metalL:lightOf(metal,0.5),
    leath, leathD:hexShade(leath,-0.4), leathL:lightOf(leath,0.3),
    skin:skinCol, skinD:hexShade(skinCol,-0.25), skinDD:hexShade(skinCol,-0.5), skinL:lightOf(skinCol,0.3),
    hair, hairD:hexShade(hair,-0.35), hairL:lightOf(hair,0.35),
    eye, acc, accD:hexShade(acc,-0.4), accL:lightOf(acc,0.55),
    cape:capeCol, capeD:hexShade(capeCol,-0.38), capeL:lightOf(capeCol,0.25),
    tab:tabCol, tabD:hexShade(tabCol,-0.35),
    shieldCol, shieldD:hexShade(shieldCol,-0.35),
    bone:'#e4dcc4', boneD:'#a89c80', wood:'#7a5230', woodD:'#4a3018',
    shadow:'#0c0a10', white:'#f6f2e8',
    wing:'#ffe39a', wingD:'#d8a040', wingL:'#fffbea',   // крила Avenging Wrath
    tabL:lightOf(tabCol,0.28), tabM:hexMix(tabCol,acc,0.55),
    tendril:'#dde5f4', tendrilD:'#98a6c4',              // вусики дренея
    hoof:'#3a2a60', hoofL:'#6a58a4',                     // ратиці
    cryst:'#b46cff', crystD:'#6a2ac0', crystL:'#f0d4ff', // фіолетовий кристал
    haft:'#3a3848', haftL:'#5a5870', haftD:'#24222e', pale:L.pale||'#ece4cc', // темне руків'я, бліда пластина
    jade:'#b8d8a8', jadeD:'#7aa070',
  };
  if(L.wingCol){ m.pal.wing=L.wingCol; m.pal.wingD=hexShade(L.wingCol,-0.4); m.pal.wingL=lightOf(L.wingCol,0.35); m.wingLight=L.wingCol; }
  if(L.pal) Object.assign(m.pal,L.pal);   // точкові кольори сету (відблиски не завжди добре виводяться з бази)
  if(L.glove){ m.pal.glove=L.glove; m.pal.gloveD=hexShade(L.glove,-0.4); m.pal.gloveL=lightOf(L.glove,0.3); }
  m.pal.outline=hexMix(hexShade(prim,-0.8),'#0a0608',0.6);
  m.castCol=acc;
  // хто що тримає: передня рука ближча до глядача
  if(m.style==='shield'){ m.front=m.off; m.back=m.main; }
  else { m.front=m.main; m.back=m.off; }
  // FX-частинки: аура сету без явного ефекту — легкі іскри кольору аури
  m.fxKind=m.fx?FX_KIND[m.fx]:null;
  m.name=skin.name; m.key=key;
  m.cutout=skin.cutout||null;
  if(m.cutout&&STANCE34[m.style]) m.stance={...(m.stance||{}),...STANCE34[m.style]};   // стійка для напівоберту (rig.js)   // набір растрових деталей скіну (js/cutout.js); кольори деталей додаються в палітру, коли набір завантажиться
  return m;
}

/* ============================================================
   ФОРМИ ДРУЇДА: кіт (Feral) і сова-мункін (Balance)
   Забарвлення — за сетом: тір-сети мають свій «хутряний» вигляд
   ============================================================ */
const FORM_LOOK={
  cat:{
    _classic:{fur:'#3a3446',stripe:'#221c2c',belly:'#5a5068',eye:'#c9a8ff',pattern:'none'},     // нічна пантера
    'Cenarion Raiment':{fur:'#9a7444',stripe:'#5a3a1e',belly:'#c8a878',eye:'#ffd23a',pattern:'spots',collar:'leaf'},
    'Thunderheart Harness':{fur:'#d08a3a',stripe:'#3a2010',belly:'#f0d0a0',eye:'#ffb03a',pattern:'tiger'},
    'Lasherweave Battlegear':{fur:'#4a6a2e',stripe:'#24361a',belly:'#8aa060',eye:'#7dff8a',pattern:'thorns'},
  },
  // Дерево життя: кора (fur), молода кора (belly), листя, квіти, очі в корі
  tree:{
    _classic:{fur:'#6a4a2e',belly:'#9a7a4e',leaf:'#4a9a3a',flower:'#ffb0d0',eye:'#ffe27a'},
    'Dreamwalker Raiment':{fur:'#4a3a3a',belly:'#7a6a5a',leaf:'#3a8a6a',flower:'#ffe27a',eye:'#ffe27a'},
    'Malorne Raiment':{fur:'#5a4428',belly:'#8a7048',leaf:'#7a9a3a',flower:'#ff8a5a',eye:'#7dff8a'},
    "Runetotem's Garb":{fur:'#4a3a2a',belly:'#7a6448',leaf:'#5aa04a',flower:'#ffd23a',eye:'#ffe27a'},
  },
  moonkin:{
    _classic:{fur:'#8a6a4a',belly:'#e0d0a8',beak:'#e8c050',eye:'#cfe0ff',mark:null},
    'Stormrage Raiment':{fur:'#4a5a9a',belly:'#c8d0e8',beak:'#ffd23a',eye:'#ffe27a',mark:'gold'},
    'Nordrassil Regalia':{fur:'#6a5a30',belly:'#c8d8a0',beak:'#d8b050',eye:'#7dff8a',mark:'leaf'},
    'Nightsong Garb':{fur:'#4a3070',belly:'#b8a8d8',beak:'#d8c8f0',eye:'#b8c8ff',mark:'stars'},
  },
};
function resolveFormModel(cls,spec,skin,form){
  const L=(skin.tier&&FORM_LOOK[form][skin.name])||FORM_LOOK[form]._classic;
  const acc=SPEC_ACCENT[cls.id+'/'+spec.name]||'#ffffff';
  const fur=L.fur;
  const pal={
    fur, furD:hexShade(fur,-0.32), furDD:hexShade(fur,-0.58), furL:lightOf(fur,0.3),
    belly:L.belly, bellyD:hexShade(L.belly,-0.25),
    eye:L.eye, acc, accD:hexShade(acc,-0.4), accL:lightOf(acc,0.55),
    bone:'#e4dcc4', boneD:'#a89c80', wood:'#7a5230', woodD:'#4a3018',
    shadow:'#0c0a10', white:'#f6f2e8', nose:'#2a1a1e',
    leaf:'#6ab04a', leafD:'#3a6a2a', gold:'#e8c050', goldD:'#9a7020',
  };
  if(L.stripe){ pal.stripe=L.stripe; }
  if(L.beak){ pal.beak=L.beak; pal.beakD=hexShade(L.beak,-0.35); }
  if(L.leaf){ pal.leaf=L.leaf; pal.leafD=hexShade(L.leaf,-0.4); pal.leafL=lightOf(L.leaf,0.35); pal.flower=L.flower; pal.flowerL=lightOf(L.flower,0.5); }
  pal.outline=hexMix(hexShade(fur,-0.8),'#0a0608',0.6);
  return {
    kind:form, style:form==='cat'?'cat':'owl', pal, look:L,
    cutout:skin.formCutout||null,   // растрові деталі форми (js/cutout.js; кіт — paintCatCutout)
    castCol:acc, castSide:'f', glowEye:true,
    // форми з деталей (js/cutout.js paintBulkCutout): крила-руки сови звисають обабіч тіла; дерево стоїть рівно, гілки вздовж стовбура
    stance:!skin.formCutout?null:form==='moonkin'?{fhx:-1,fhy:-48,bhx:15,bhy:-48}:form==='tree'?{py:3,lean:0.03,bfx:-11,ffx:11,fhx:-3,fhy:-47,bhx:13,bhy:-47}:null,
    fxKind:skin.tier&&skin.glow?{cols:[skin.glow,acc],vy:-30,g:-20,rate:4}:null,
    name:skin.name+' ('+form+')', key:cls.id+'/'+spec.name,
  };
}
