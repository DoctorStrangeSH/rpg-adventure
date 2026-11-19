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
 {gold:8550,materials:{iron_ore:12,ember_core:3,frost_crystal:3,blood_essence:2}}
]);
export function getItemUpgradeLevel(player,id){return Math.max(0,Math.min(10,Math.floor(Number(player?.itemUpgrades?.[id])||0)));}
export function getUpgradePreview(player,id){
 const item=getItem(id);if(!player||!item||!['weapon','armor'].includes(item.type))return {available:false,reason:'invalid_item'};
 const level=getItemUpgradeLevel(player,id);if(level>=10)return {available:false,reason:'max_level',level};
 const next=level+1,cost=COSTS[next],missing=Object.entries(cost.materials).map(([mat,qty])=>{const owned=(player.inventory||[]).filter(x=>x.id===mat).reduce((s,x)=>s+(Number.isSafeInteger(x.quantity)&&x.quantity>0?x.quantity:0),0);return {id:mat,missing:Math.max(0,qty-owned)};}).filter(x=>x.missing);
 const goldMissing=Math.max(0,cost.gold-(Number(player.gold)||0));
 return {available:!missing.length&&!goldMissing,reason:missing.length?'materials':goldMissing?'gold':null,level,next,gold:cost.gold,materials:cost.materials,missing,goldMissing};
}
export function upgradeEquipment(player,id){
 const item=getItem(id);if(!player||!item||!['weapon','armor'].includes(item.type))return {ok:false,reason:'invalid_item'};
 if(!['weapon','armor'].some(slot=>player.equipment?.[slot]===id))return {ok:false,reason:'not_equipped'};
 const p=getUpgradePreview(player,id);if(!p.available)return {ok:false,...p};
 for(const [mat,qty] of Object.entries(p.materials)){let left=qty;for(let i=player.inventory.length-1;i>=0&&left>0;i--){const stack=player.inventory[i];if(stack.id!==mat)continue;const used=Math.min(stack.quantity,left);stack.quantity-=used;left-=used;if(stack.quantity===0)player.inventory.splice(i,1);}}
 player.gold-=p.gold;if(!player.itemUpgrades||typeof player.itemUpgrades!=='object')player.itemUpgrades={};player.itemUpgrades[id]=p.next;
 return {ok:true,item,level:p.next,bonus:p.next*2};
}
