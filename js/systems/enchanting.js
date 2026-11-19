import { getItem } from '../data/items.js';
export const RUNE_CATALOG = Object.freeze({
 flame:{id:'flame',name:'Руна пламени',icon:'🔥',color:'#ff8748',damageType:'fire',effect:'burn',turns:2,attack:2,cost:{ember_core:2}},
 frost:{id:'frost',name:'Руна стужи',icon:'❄️',color:'#78dfff',damageType:'ice',effect:'freeze',turns:1,defense:2,cost:{frost_crystal:2}},
 blood:{id:'blood',name:'Руна крови',icon:'🩸',color:'#e45b75',damageType:'poison',effect:'bleed',turns:2,attack:2,cost:{blood_essence:2}},
 storm:{id:'storm',name:'Руна грозы',icon:'⚡',color:'#d5b4ff',damageType:'physical',effect:null,turns:0,critChance:0.04,cost:{iron_ore:5,ember_core:1}}
});
export function getRuneSocketCount(player,weaponId){
 const level=Math.max(0,Math.min(10,Math.floor(Number(player?.itemUpgrades?.[weaponId])||0)));
 return level>=8?3:level>=4?2:level>=1?1:0;
}
export function getWeaponRunes(player,weaponId=player?.equipment?.weapon){
 const list=player?.weaponRunes?.[weaponId];return Array.isArray(list)?list.filter(id=>RUNE_CATALOG[id]):[];
}
export function getEnchantPreview(player,weaponId,runeId){
 const weapon=getItem(weaponId),rune=RUNE_CATALOG[runeId];
 if(!player||!weapon||weapon.type!=='weapon'||!rune)return {available:false,reason:'invalid'};
 if(player.equipment?.weapon!==weaponId)return {available:false,reason:'not_equipped'};
 const runes=getWeaponRunes(player,weaponId),slots=getRuneSocketCount(player,weaponId);
 if(runes.length>=slots)return {available:false,reason:slots===0?'upgrade_required':'sockets_full',slots,used:runes.length};
 if(runes.includes(runeId))return {available:false,reason:'duplicate'};
 const missing=Object.entries(rune.cost).map(([id,quantity])=>{
  const owned=(player.inventory||[]).filter(x=>x.id===id).reduce((sum,x)=>sum+(Number.isSafeInteger(x.quantity)&&x.quantity>0?x.quantity:0),0);
  return {id,quantity,missing:Math.max(0,quantity-owned)};
 }).filter(x=>x.missing>0);
 return {available:missing.length===0,reason:missing.length?'materials':null,missing,slots,used:runes.length,rune};
}
export function inscribeRune(player,weaponId,runeId){
 const preview=getEnchantPreview(player,weaponId,runeId);if(!preview.available)return {ok:false,...preview};
 for(const [id,quantity] of Object.entries(preview.rune.cost)){
  let left=quantity;
  for(let i=player.inventory.length-1;i>=0&&left>0;i--){
   const stack=player.inventory[i];if(stack.id!==id)continue;
   const used=Math.min(stack.quantity,left);stack.quantity-=used;left-=used;
   if(stack.quantity===0)player.inventory.splice(i,1);
  }
 }
 player.weaponRunes ||= {};player.weaponRunes[weaponId] ||= [];player.weaponRunes[weaponId].push(runeId);
 return {ok:true,rune:preview.rune,used:player.weaponRunes[weaponId].length,slots:preview.slots};
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
export function getWeaponRuneBonuses(player,weaponId=player?.equipment?.weapon){
 const total=getWeaponRunes(player,weaponId).reduce((sum,id)=>{
  const rune=RUNE_CATALOG[id];sum.attack+=rune.attack||0;sum.defense+=rune.defense||0;sum.critChance+=rune.critChance||0;return sum;
 },{attack:0,defense:0,critChance:0});
 const synergy=getRuneSynergy(player,weaponId);
 if(synergy){total.attack+=synergy.attack||0;total.critChance+=synergy.critChance||0;}
 return total;
}
export function getWeaponRuneDamageType(player){
 const runes=getWeaponRunes(player);return runes.length?RUNE_CATALOG[runes[runes.length-1]].damageType:null;
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