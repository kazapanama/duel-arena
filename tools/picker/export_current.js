// Поточний розподіл сетів по спеках (SPEC_SKINS у js/data.js) → tools/picker/current.js для обиралки.
//   node tools/picker/export_current.js
"use strict";
const fs=require('fs'), path=require('path'), vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const stub=()=>new Proxy(function(){},{get:(t,k)=>k===Symbol.toPrimitive?()=>0:(k==='width'||k==='height'?0:stub()),apply:()=>stub(),set:()=>true});
const ctx={console,Math,JSON,Object,Array,Set,Map,Number,String,document:stub(),window:stub(),addEventListener(){},location:{search:''},
  navigator:{userAgent:''},localStorage:{getItem(){return null},setItem(){}},requestAnimationFrame(){},performance:{now:()=>0},Image:class{},Audio:class{},setTimeout(){}};
vm.createContext(ctx);
vm.runInContext(['core','data'].map(f=>fs.readFileSync(path.join(ROOT,'js',f+'.js'),'utf8')).join('\n;\n')+'\n;globalThis.__o={CLASSES};',ctx);
const specs=[], current={};
for(const c of ctx.__o.CLASSES) for(const s of c.specs){
  const key=c.id+'/'+s.name;
  specs.push({key,cls:c.id,clsName:c.name,spec:s.name,em:s.em||'',color:c.color});
  current[key]=s.skins.filter(k=>k.tier).map(k=>k.name);
}
fs.writeFileSync(path.join(__dirname,'current.js'),
  '// згенеровано tools/picker/export_current.js — спеки гри і сети, що стоять на них зараз\n'+
  'const SPECS='+JSON.stringify(specs)+';\nconst CURRENT='+JSON.stringify(current,null,1)+';\n');
console.log(specs.length,'спеків');
