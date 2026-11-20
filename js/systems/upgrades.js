import { getItem } from '../data/items.js';
const COSTS = Object.freeze([
 null,
 {gold:50,materials:{iron_ore:2}},
 {gold:160,materials:{iron_ore:3}},
 {gold:360,materials:{iron_ore:4,ember_core:1}},
 {gold:720,materials:{iron_ore:5,ember_core:1}},
 {gold:1300,materials:{iron_ore:6,frost_crystal:1}},
 {gold:2160,materials:{iron_ore:7,frost_crystal:2}},
 {gold:3500,materials:{iron_ore:8,ember_core:2,frost_crystal:2}},
 {gold:5600,materials:{iron_ore:10,blood_essence:2}},
 {gold:8550,materials:{iron_ore:12,ember_core:3,frost_crystal:3,blood_essence:2}},
 {gold:12000,materials:{iron_ore:15,ember_core:4,frost_crystal:4,blood_essence:3}}
]);
export function getItemUpgradeLevel(player,id){return Math.max(0,Math.min(10,Math.floor(Number(player?.itemUpgrades?.[id])||0)));}

function countMaterial(player, id) {
 if (!Array.isArray(player?.inventory)) return null;
 let total = 0;
 for (const stack of player.inventory) {
  if (stack?.id !== id) continue;
  if (!Number.isSafeInteger(stack.quantity) || stack.quantity < 0 ||
      total > Number.MAX_SAFE_INTEGER - stack.quantity) return null;
  total += stack.quantity;
 }
 return total;
}

function consumeMaterials(player, materials) {
 for (const [id, quantity] of Object.entries(materials)) {
  let remaining = quantity;
  for (let i = player.inventory.length - 1; i >= 0 && remaining > 0; i--) {
   const stack = player.inventory[i];
   if (stack?.id !== id) continue;
   const used = Math.min(stack.quantity, remaining);
   stack.quantity -= used;
   remaining -= used;
   if (stack.quantity === 0) player.inventory.splice(i, 1);
  }
 }
}

export function getUpgradePreview(player,id){
 const item=getItem(id);if(!player||!item||!['weapon','armor'].includes(item.type))return {available:false,reason:'invalid_item'};
 if (!Array.isArray(player.inventory)) return {available:false,reason:'invalid_inventory'};
 if (!Number.isSafeInteger(player.gold) || player.gold < 0) return {available:false,reason:'invalid_currency'};
 const level=getItemUpgradeLevel(player,id);if(level>=10)return {available:false,reason:'max_level',level};
 const next=level+1,cost=COSTS[next],missing=[];
 for (const [mat,qty] of Object.entries(cost.materials)) {
  const owned=countMaterial(player,mat);
  if (owned===null) return {available:false,reason:'invalid_inventory',itemId:mat};
  if (owned<qty) missing.push({id:mat,missing:qty-owned});
 }
 const goldMissing=Math.max(0,cost.gold-player.gold);
 return {available:!missing.length&&!goldMissing,reason:missing.length?'materials':goldMissing?'gold':null,level,next,gold:cost.gold,materials:cost.materials,missing,goldMissing};
}
export function upgradeEquipment(player,id){
 const item=getItem(id);if(!player||!item||!['weapon','armor'].includes(item.type))return {ok:false,reason:'invalid_item'};
 if(!['weapon','armor'].some(slot=>player.equipment?.[slot]===id))return {ok:false,reason:'not_equipped'};
 const p=getUpgradePreview(player,id);if(!p.available)return {ok:false,...p};
 // Preview validates every relevant stack and the currency before mutation.
 consumeMaterials(player,p.materials);
 player.gold-=p.gold;if(!player.itemUpgrades||typeof player.itemUpgrades!=='object')player.itemUpgrades={};player.itemUpgrades[id]=p.next;
 return {ok:true,item,level:p.next,bonus:p.next*2};
}
