"use strict";
// згенеровано tools/arenas/arenas.py — арени з картинками (js/arena.js); ground — частка висоти, де стоять ноги
const ARENA_IMG=[
  {kind:"shadow",name:"Тінисте плато",img:'img/arenas/shadow.webp',thumb:'img/arenas/thumbs/shadow.webp',ground:0.79},
  {kind:"durotar",name:"Дуротар",img:'img/arenas/durotar.webp',thumb:'img/arenas/thumbs/durotar.webp',ground:0.79,ember:1},
  {kind:"northrend",name:"Нордскол",img:'img/arenas/northrend.webp',thumb:'img/arenas/thumbs/northrend.webp',ground:0.79,snow:1},
  {kind:"nagrand",name:"Арена Наґранда",img:'img/arenas/nagrand.webp',thumb:'img/arenas/thumbs/nagrand.webp',ground:0.79},
  {kind:"blades_edge",name:"Арена Блейдс-Еджу",img:'img/arenas/blades_edge.webp',thumb:'img/arenas/thumbs/blades_edge.webp',ground:0.79},
  {kind:"lordaeron",name:"Руїни Лордерону",img:'img/arenas/lordaeron.webp',thumb:'img/arenas/thumbs/lordaeron.webp',ground:0.79},
  {kind:"dalaran",name:"Каналізація Даларану",img:'img/arenas/dalaran.webp',thumb:'img/arenas/thumbs/dalaran.webp',ground:0.79},
  {kind:"ring_of_valor",name:"Кільце Звитяги",img:'img/arenas/ring_of_valor.webp',thumb:'img/arenas/thumbs/ring_of_valor.webp',ground:0.79,ember:1},
  {kind:"gurubashi",name:"Арена Гурубаші",img:'img/arenas/gurubashi.webp',thumb:'img/arenas/thumbs/gurubashi.webp',ground:0.79},
  {kind:"darkmoon",name:"Ярмарок Темного Місяця",img:'img/arenas/darkmoon.webp',thumb:'img/arenas/thumbs/darkmoon.webp',ground:0.79},
  {kind:"stormwind",name:"Брама Штормвінда",img:'img/arenas/stormwind.webp',thumb:'img/arenas/thumbs/stormwind.webp',ground:0.79},
  {kind:"orgrimmar",name:"Брама Оргріммара",img:'img/arenas/orgrimmar.webp',thumb:'img/arenas/thumbs/orgrimmar.webp',ground:0.79,ember:1},
  {kind:"ironforge",name:"Брама Айронфорджа",img:'img/arenas/ironforge.webp',thumb:'img/arenas/thumbs/ironforge.webp',ground:0.79,snow:1},
  {kind:"dalaran_city",name:"Даларан",img:'img/arenas/dalaran_city.webp',thumb:'img/arenas/thumbs/dalaran_city.webp',ground:0.79}
];
