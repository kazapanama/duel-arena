// згенеровано tools/picker/export_current.js — спеки гри і сети, що стоять на них зараз
const SPECS=[{"key":"warrior/Arms","cls":"warrior","clsName":"Воїн","spec":"Arms","em":"⚔️","color":"#C69B6D"},{"key":"warrior/Fury","cls":"warrior","clsName":"Воїн","spec":"Fury","em":"🔥","color":"#C69B6D"},{"key":"warrior/Protection","cls":"warrior","clsName":"Воїн","spec":"Protection","em":"🛡️","color":"#C69B6D"},{"key":"paladin/Holy","cls":"paladin","clsName":"Паладін","spec":"Holy","em":"🌟","color":"#F48CBA"},{"key":"paladin/Protection","cls":"paladin","clsName":"Паладін","spec":"Protection","em":"🛡️","color":"#F48CBA"},{"key":"paladin/Retribution","cls":"paladin","clsName":"Паладін","spec":"Retribution","em":"⚔️","color":"#F48CBA"},{"key":"hunter/Beast Mastery","cls":"hunter","clsName":"Мисливець","spec":"Beast Mastery","em":"🐻","color":"#AAD372"},{"key":"hunter/Marksmanship","cls":"hunter","clsName":"Мисливець","spec":"Marksmanship","em":"🎯","color":"#AAD372"},{"key":"hunter/Survival","cls":"hunter","clsName":"Мисливець","spec":"Survival","em":"🗡️","color":"#AAD372"},{"key":"rogue/Assassination","cls":"rogue","clsName":"Розбійник","spec":"Assassination","em":"☠️","color":"#FFF468"},{"key":"rogue/Outlaw","cls":"rogue","clsName":"Розбійник","spec":"Outlaw","em":"🏴‍☠️","color":"#FFF468"},{"key":"rogue/Subtlety","cls":"rogue","clsName":"Розбійник","spec":"Subtlety","em":"🌑","color":"#FFF468"},{"key":"priest/Discipline","cls":"priest","clsName":"Жрець","spec":"Discipline","em":"🛡️","color":"#eeeeee"},{"key":"priest/Holy","cls":"priest","clsName":"Жрець","spec":"Holy","em":"🌟","color":"#eeeeee"},{"key":"priest/Shadow","cls":"priest","clsName":"Жрець","spec":"Shadow","em":"🌑","color":"#eeeeee"},{"key":"dk/Blood","cls":"dk","clsName":"Лицар смерті","spec":"Blood","em":"🩸","color":"#C41E3A"},{"key":"dk/Frost","cls":"dk","clsName":"Лицар смерті","spec":"Frost","em":"❄️","color":"#C41E3A"},{"key":"dk/Unholy","cls":"dk","clsName":"Лицар смерті","spec":"Unholy","em":"🧟","color":"#C41E3A"},{"key":"shaman/Elemental","cls":"shaman","clsName":"Шаман","spec":"Elemental","em":"🌋","color":"#0070DD"},{"key":"shaman/Enhancement","cls":"shaman","clsName":"Шаман","spec":"Enhancement","em":"🐺","color":"#0070DD"},{"key":"shaman/Restoration","cls":"shaman","clsName":"Шаман","spec":"Restoration","em":"💧","color":"#0070DD"},{"key":"mage/Arcane","cls":"mage","clsName":"Маг","spec":"Arcane","em":"🔮","color":"#3FC7EB"},{"key":"mage/Fire","cls":"mage","clsName":"Маг","spec":"Fire","em":"🔥","color":"#3FC7EB"},{"key":"mage/Frost","cls":"mage","clsName":"Маг","spec":"Frost","em":"❄️","color":"#3FC7EB"},{"key":"warlock/Affliction","cls":"warlock","clsName":"Чорнокнижник","spec":"Affliction","em":"🕷️","color":"#8788EE"},{"key":"warlock/Demonology","cls":"warlock","clsName":"Чорнокнижник","spec":"Demonology","em":"👿","color":"#8788EE"},{"key":"warlock/Destruction","cls":"warlock","clsName":"Чорнокнижник","spec":"Destruction","em":"🔥","color":"#8788EE"},{"key":"druid/Balance","cls":"druid","clsName":"Друїд","spec":"Balance","em":"🌙","color":"#FF7C0A"},{"key":"druid/Feral","cls":"druid","clsName":"Друїд","spec":"Feral","em":"🐱","color":"#FF7C0A"},{"key":"druid/Restoration","cls":"druid","clsName":"Друїд","spec":"Restoration","em":"🌿","color":"#FF7C0A"}];
const CURRENT={
 "warrior/Arms": [
  "Battlegear of Might",
  "Destroyer Battlegear",
  "Wrynn's Battlegear"
 ],
 "warrior/Fury": [
  "Battlegear of Wrath",
  "Onslaught Battlegear",
  "Ymirjar Lord's Battlegear"
 ],
 "warrior/Protection": [
  "Dreadnaught's Battlegear",
  "Siegebreaker Battlegear",
  "Valorous Dreadnaught"
 ],
 "paladin/Holy": [
  "Lawbringer Armor",
  "Lightbringer Raiment",
  "Aegis Regalia"
 ],
 "paladin/Protection": [
  "Redemption Armor",
  "Justicar Armor",
  "Lightsworn Plate"
 ],
 "paladin/Retribution": [
  "Judgement Armor",
  "Crystalforge Battlegear",
  "Turalyon's Battlegear"
 ],
 "hunter/Beast Mastery": [
  "Giantstalker Armor",
  "Gronnstalker Armor",
  "Scourgestalker Battlegear"
 ],
 "hunter/Marksmanship": [
  "Dragonstalker Armor",
  "Rift Stalker Armor",
  "Windrunner's Battlegear"
 ],
 "hunter/Survival": [
  "Cryptstalker Armor",
  "Demon Stalker Armor",
  "Ahn'Kahar Blood Hunter"
 ],
 "rogue/Assassination": [
  "Nightslayer Armor",
  "Bloodfang Armor",
  "Shadowblade's Battlegear"
 ],
 "rogue/Outlaw": [
  "Deathmantle",
  "VanCleef's Battlegear",
  "Slayer's Armor"
 ],
 "rogue/Subtlety": [
  "Bonescythe Armor",
  "Netherblade",
  "Terrorblade Battlegear"
 ],
 "priest/Discipline": [
  "Vestments of Prophecy",
  "Incarnate Raiment",
  "Sanctification Garb"
 ],
 "priest/Holy": [
  "Vestments of Transcendence",
  "Absolution Regalia",
  "Vestments of Faith"
 ],
 "priest/Shadow": [
  "Avatar Regalia",
  "Crimson Acolyte",
  "Zabra's Raiment"
 ],
 "dk/Blood": [
  "Scourgeborne Battlegear",
  "Scourgelord's Battlegear",
  "Koltira's Battlegear"
 ],
 "dk/Frost": [
  "Scourgeborne Plate",
  "Darkruned Battlegear",
  "Thassarian's Battlegear"
 ],
 "dk/Unholy": [
  "Darkruned Plate",
  "Scourgelord's Plate",
  "Scourgeborne Battlegear"
 ],
 "shaman/Elemental": [
  "Earthshatterer Raiment",
  "Cataclysm Regalia",
  "Ten Storms"
 ],
 "shaman/Enhancement": [
  "Earthfury",
  "Skyshatter Harness",
  "Thrall's Battlegear"
 ],
 "shaman/Restoration": [
  "Cyclone Raiment",
  "Worldbreaker Garb",
  "Frost Witch's Regalia"
 ],
 "mage/Arcane": [
  "Arcanist Regalia",
  "Tirisfal Regalia",
  "Kirin Tor Garb"
 ],
 "mage/Fire": [
  "Frostfire Regalia",
  "Netherwind Regalia",
  "Bloodmage's Regalia"
 ],
 "mage/Frost": [
  "Tempest Regalia",
  "Aldor Regalia",
  "Khadgar's Regalia"
 ],
 "warlock/Affliction": [
  "Felheart Raiment",
  "Plagueheart Raiment",
  "Dark Coven's Regalia"
 ],
 "warlock/Demonology": [
  "Voidheart Raiment",
  "Malefic Raiment",
  "Deathbringer Garb"
 ],
 "warlock/Destruction": [
  "Nemesis Raiment",
  "Corruptor Raiment",
  "Gul'dan's Regalia"
 ],
 "druid/Balance": [
  "Stormrage Raiment",
  "Nordrassil Regalia",
  "Nightsong Garb"
 ],
 "druid/Feral": [
  "Cenarion Raiment",
  "Thunderheart Harness",
  "Lasherweave Battlegear"
 ],
 "druid/Restoration": [
  "Dreamwalker Raiment",
  "Malorne Raiment",
  "Runetotem's Garb"
 ]
};
