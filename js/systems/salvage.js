import { getItem } from '../data/items.js';

export const SALVAGE_YIELDS = Object.freeze({
 common:{iron_ore:1}, uncommon:{iron_ore:2}, rare:{iron_ore:2,ember_core:1},
 epic:{iron_ore:3,ember_core:1,frost_crystal:1},
 legendary:{iron_ore:4,ember_core:2,frost_crystal:2,blood_essence:1}
});
export function getSalvagePreview(itemId) {
 const item=getItem(itemId);
 if(!item||!['weapon','armor'].includes(item.type)) return null;
 return Object.entries(SALVAGE_YIELDS[item.rarity]||SALVAGE_YIELDS.common)
  .map(([id,quantity])=>({id,quantity,item:getItem(id)}));
}
export function salvageEquipment(player,index) {
 if(!player||!Array.isArray(player.inventory)||!Number.isInteger(index)||index<0||index>=player.inventory.length)
  return {ok:false,reason:'invalid_item'};
 const entry=player.inventory[index],item=entry&&getItem(entry.id);
 if(!item||!['weapon','armor'].includes(item.type)) return {ok:false,reason:'not_equipment'};
 if(player.equipment?.weapon===item.id||player.equipment?.armor===item.id) return {ok:false,reason:'equipped'};
 if(!Number.isSafeInteger(entry.quantity)||entry.quantity<1) return {ok:false,reason:'invalid_quantity'};
 const preview=getSalvagePreview(item.id);
 for(const reward of preview){
  const current=player.inventory.filter(stack=>stack.id===reward.id)
   .reduce((sum,stack)=>sum+(Number.isSafeInteger(stack.quantity)&&stack.quantity>0?stack.quantity:0),0);
  if(current>Number.MAX_SAFE_INTEGER-reward.quantity) return {ok:false,reason:'inventory_limit'};
 }
 entry.quantity--;
 if(entry.quantity===0) player.inventory.splice(index,1);
 for(const reward of preview){
  const stack=player.inventory.find(stack=>stack.id===reward.id);
  if(stack) stack.quantity+=reward.quantity;
  else player.inventory.push({id:reward.id,quantity:reward.quantity});
 }
 return {ok:true,item,rewards:preview};
}
