import { getItem } from '../data/items.js';
export const RUNE_CATALOG = Object.freeze({
 flame:{id:'flame',name:'Руна пламени',icon:'🔥',color:'#ff8748',damageType:'fire',effect:'burn',turns:2,attack:2,cost:{ember_core:2}},
 frost:{id:'frost',name:'Руна стужи',icon:'❄️',color:'#78dfff',damageType:'ice',effect:'freeze',turns:1,defense:2,cost:{frost_crystal:2}},
 blood:{id:'blood',name:'Руна крови',icon:'🩸',color:'#e45b75',damageType:'poison',effect:'bleed',turns:2,attack:2,cost:{blood_essence:2}},
 storm:{id:'storm',name:'Руна грозы',icon:'⚡',color:'#d5b4ff',damageType:'physical',effect:null,turns:0,critChance:0.04,cost:{iron_ore:5,ember_core:1}},
 verdant:{id:'verdant',name:'Сердце древнего леса',icon:'🌿',color:'#83d18b',damageType:'poison',effect:'poison',turns:2,defense:3,cost:{rune_verdant_heart:1},bossRune:true},
 dragon:{id:'dragon',name:'Сердце горного дракона',icon:'🐉',color:'#ff754c',damageType:'fire',effect:'burn',turns:3,attack:3,cost:{rune_dragon_heart:1},bossRune:true},
 lich:{id:'lich',name:'Печать Короля-лича',icon:'☠️',color:'#b99aff',damageType:'poison',effect:'poison',turns:3,critChance:0.03,cost:{rune_lich_soul:1},bossRune:true},
 world:{id:'world',name:'Осколок Пожирателя миров',icon:'🌑',color:'#d58bff',damageType:'physical',effect:'bleed',turns:3,attack:2,critChance:0.02,cost:{rune_world_fragment:1},bossRune:true}
});
export function getRuneSocketCount(player,weaponId){
 const level=Math.max(0,Math.min(10,Math.floor(Number(player?.itemUpgrades?.[weaponId])||0)));
 return level>=8?3:level>=4?2:level>=1?1:0;
}
export function getWeaponRunes(player,weaponId=player?.equipment?.weapon){
 const list=player?.weaponRunes?.[weaponId];return Array.isArray(list)?list.filter(id=>RUNE_CATALOG[id]):[];
}

function countMaterial(player,id){
 if(!Array.isArray(player?.inventory))return null;
 let total=0;
 for(const stack of player.inventory){
  if(stack?.id!==id)continue;
  if(!Number.isSafeInteger(stack.quantity)||stack.quantity<0||total>Number.MAX_SAFE_INTEGER-stack.quantity)return null;
  total+=stack.quantity;
 }
 return total;
}
function consumeMaterials(player,materials){
 for(const [id,quantity] of Object.entries(materials)){
  let remaining=quantity;
  for(let i=player.inventory.length-1;i>=0&&remaining>0;i--){
   const stack=player.inventory[i];if(stack?.id!==id)continue;
   const used=Math.min(stack.quantity,remaining);stack.quantity-=used;remaining-=used;
   if(stack.quantity===0)player.inventory.splice(i,1);
  }
 }
}

export function getEnchantPreview(player,weaponId,runeId){
 const weapon=getItem(weaponId),rune=RUNE_CATALOG[runeId];
 if(!player||!weapon||weapon.type!=='weapon'||!rune)return {available:false,reason:'invalid'};
 if(player.equipment?.weapon!==weaponId)return {available:false,reason:'not_equipped'};
 const runes=getWeaponRunes(player,weaponId),slots=getRuneSocketCount(player,weaponId);
 if(runes.length>=slots)return {available:false,reason:slots===0?'upgrade_required':'sockets_full',slots,used:runes.length};
 if(runes.includes(runeId))return {available:false,reason:'duplicate'};
 if(!Array.isArray(player.inventory))return {available:false,reason:'invalid_inventory'};
 const missing=[];
 for(const [id,quantity] of Object.entries(rune.cost)){
  const owned=countMaterial(player,id);
  if(owned===null)return {available:false,reason:'invalid_inventory',itemId:id};
  if(owned<quantity)missing.push({id,quantity,missing:quantity-owned});
 }
 return {available:missing.length===0,reason:missing.length?'materials':null,missing,slots,used:runes.length,rune};
}
export function inscribeRune(player,weaponId,runeId){
 const preview=getEnchantPreview(player,weaponId,runeId);if(!preview.available)return {ok:false,...preview};
 // All material stacks are validated before any stack or rune slot is changed.
 consumeMaterials(player,preview.rune.cost);
 player.weaponRunes ||= {};player.weaponRunes[weaponId] ||= [];player.weaponRunes[weaponId].push(runeId);
 return {ok:true,rune:preview.rune,used:player.weaponRunes[weaponId].length,slots:preview.slots};
}
export const RUNE_EXTRACTION_GOLD = 50;
export function getRuneExtractionPreview(player,weaponId,index){
 const runes=getWeaponRunes(player,weaponId);
 if(!player||player.equipment?.weapon!==weaponId)return {available:false,reason:'not_equipped'};
 if(!Number.isInteger(index)||index<0||index>=runes.length)return {available:false,reason:'invalid_socket'};
 const rune=RUNE_CATALOG[runes[index]];
 if(!Number.isSafeInteger(player.gold)||player.gold<0)return {available:false,reason:'invalid_currency',rune,index};
 const gold=player.gold;
 if(gold<RUNE_EXTRACTION_GOLD)return {available:false,reason:'gold',cost:RUNE_EXTRACTION_GOLD,rune,index};
 // Legacy saves may omit inventory; extraction creates it when returning materials.
 // A present but malformed inventory is rejected rather than silently replaced.
 if(player.inventory!=null&&!Array.isArray(player.inventory))return {available:false,reason:'invalid_inventory',rune,index};
 const inventoryPlayer=player.inventory==null?{inventory:[]}:player;
 for(const [itemId,quantity] of Object.entries(rune.cost)){
  const owned=countMaterial(inventoryPlayer,itemId);
  if(owned===null)return {available:false,reason:'invalid_inventory',rune,index};
  if(owned>Number.MAX_SAFE_INTEGER-quantity)return {available:false,reason:'inventory_capacity',rune,index};
 }
 return {available:true,reason:null,cost:RUNE_EXTRACTION_GOLD,rune,index};
}
export function extractRune(player,weaponId,index){
 const preview=getRuneExtractionPreview(player,weaponId,index);
 if(!preview.available)return {ok:false,...preview};
 player.gold-=preview.cost;
 player.weaponRunes[weaponId].splice(index,1);
 if(player.weaponRunes[weaponId].length===0)delete player.weaponRunes[weaponId];
 player.inventory ||= [];
 for(const [itemId,quantity] of Object.entries(preview.rune.cost)){
  const stack=player.inventory.find(item=>item.id===itemId);
  if(stack)stack.quantity+=quantity;
  else player.inventory.push({id:itemId,quantity});
 }
 return {ok:true,rune:preview.rune,cost:preview.cost,returnedMaterials:{...preview.rune.cost},remaining:getWeaponRunes(player,weaponId).length};
}
export const RUNE_SYNERGIES = Object.freeze({
 'blood+flame': {id:'crimson_flare',name:'Алый пожар',icon:'🔥🩸',description:'Горение и кровотечение накладываются вместе; +2 к атаке.',attack:2,critChance:0,effects:['burn','bleed'],turns:2},
 'frost+storm': {id:'frozen_tempest',name:'Гром ледяной бури',icon:'❄️⚡',description:'Заморозка ослабляет противника; +3% к критическому шансу.',attack:0,critChance:0.03,effects:['freeze','weaken'],turns:1}
});
export function getRuneSynergy(player,weaponId=player?.equipment?.weapon){
 const runes=getWeaponRunes(player,weaponId);
 if(runes.length<2)return null;
 const key=[...runes].sort().join('+');
 return RUNE_SYNERGIES[key]||null;
}
export function getRuneLoadoutPreview(player,weaponId,runeId){
 const rune=RUNE_CATALOG[runeId];
 if(!player||!rune)return {available:false,reason:'invalid'};
 const current=getWeaponRuneBonuses(player,weaponId);
 const simulated={
  ...player,
  weaponRunes:{...(player.weaponRunes||{}),[weaponId]:[...getWeaponRunes(player,weaponId),runeId]}
 };
 const projected=getWeaponRuneBonuses(simulated,weaponId);
 return {
  available:true,
  current,
  projected,
  delta:{
   attack:projected.attack-current.attack,
   defense:projected.defense-current.defense,
   critChance:projected.critChance-current.critChance
  }
 };
}
export function getWeaponRuneBonuses(player,weaponId=player?.equipment?.weapon){
 const total=getWeaponRunes(player,weaponId).reduce((sum,id)=>{
  const rune=RUNE_CATALOG[id];sum.attack+=rune.attack||0;sum.defense+=rune.defense||0;sum.critChance+=rune.critChance||0;return sum;
 },{attack:0,defense:0,critChance:0});
 const synergy=getRuneSynergy(player,weaponId);
 if(synergy){total.attack+=synergy.attack||0;total.critChance+=synergy.critChance||0;}
 return total;
}
export function getWeaponRuneDamageType(player){
 const runes=getWeaponRunes(player);
 const elemental=[...runes].reverse().map(id=>RUNE_CATALOG[id].damageType).find(type=>type!=='physical');
 return elemental || null;
}
export function triggerRuneEffect(player,enemy,roll=Math.random()){
 if(!enemy||enemy.health<=0||!Number.isFinite(roll)||roll<0||roll>=1)return null;
 const synergy=getRuneSynergy(player);
 if(synergy&&roll<0.15){
  enemy.effects ||= {};
  for(const effect of synergy.effects){
   const key=effect+'Turns';enemy.effects[key]=Math.max(enemy.effects[key]||0,synergy.turns);
  }
  return synergy.id;
 }
 const runes=getWeaponRunes(player),rune=runes.length?RUNE_CATALOG[runes[runes.length-1]]:null;
 if(!rune?.effect||roll>=0.2)return null;
 const key=rune.effect+'Turns';enemy.effects ||= {};enemy.effects[key]=Math.max(enemy.effects[key]||0,rune.turns);return rune.effect;
}