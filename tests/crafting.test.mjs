import test from 'node:test';
import assert from 'node:assert/strict';
import { craftItem, getCraftingAvailability } from '../js/systems/crafting.js';

function player(){return {level:10,gold:2000,discoveredItems:['dragon_scale'],inventory:[
{id:'iron_ore',quantity:20},{id:'ember_core',quantity:10},{id:'frost_crystal',quantity:10},{id:'blood_essence',quantity:10},{id:'dragon_scale',quantity:3}
]};}

test('craft consumes exact materials and gold and grants output',()=>{
 const p=player();const before=p.gold;const result=craftItem(p,'iron_sword');
 assert.equal(result.ok,true);assert.equal(p.gold,before-80);
 assert.equal(p.inventory.find(x=>x.id==='iron_ore').quantity,12);
 assert.equal(p.inventory.find(x=>x.id==='iron_sword').quantity,1);
 assert.ok(p.discoveredItems.includes('iron_sword'));
});

test('crafting refuses missing materials without partial consumption',()=>{
 const p=player();p.inventory=[{id:'iron_ore',quantity:2}];const snapshot=structuredClone(p);
 const result=craftItem(p,'frost_blade');
 assert.equal(result.ok,false);assert.equal(result.reason,'materials');
 assert.deepEqual(p,snapshot);
});

test('legendary recipe requires rare scale discovery and level',()=>{
 const p=player();p.discoveredItems=[];assert.equal(getCraftingAvailability(p, {requiredLevel:10,requiresDiscovery:'dragon_scale',gold:1,materials:{}}).reason,'discovery');
 p.discoveredItems=['dragon_scale'];p.level=3;assert.equal(getCraftingAvailability(p,{requiredLevel:10,gold:1,materials:{}}).reason,'level');
});

test('crafted output cannot consume ingredients if output is invalid',()=>{
 const p=player();const snapshot=structuredClone(p);assert.equal(craftItem(p,'unknown_recipe').ok,false);assert.deepEqual(p,snapshot);
});

test('salvage refuses equipped items without mutation',async()=>{
 const {salvageEquipment}=await import('../js/systems/salvage.js');
 const p={equipment:{weapon:'iron_sword',armor:null},inventory:[{id:'iron_sword',quantity:1}]};
 const snapshot=structuredClone(p),r=salvageEquipment(p,0);
 assert.equal(r.reason,'equipped');assert.deepEqual(p,snapshot);
});
test('salvage converts one unequipped item into rarity-based materials',async()=>{
 const {salvageEquipment}=await import('../js/systems/salvage.js');
 const p={equipment:{weapon:null,armor:null},inventory:[{id:'moonblade',quantity:2}]};
 const r=salvageEquipment(p,0);assert.equal(r.ok,true);
 assert.equal(p.inventory.find(x=>x.id==='moonblade').quantity,1);
 assert.equal(p.inventory.find(x=>x.id==='iron_ore').quantity,3);
 assert.equal(p.inventory.find(x=>x.id==='ember_core').quantity,1);
 assert.equal(p.inventory.find(x=>x.id==='frost_crystal').quantity,1);
});
test('salvage overflow is rejected atomically',async()=>{
 const {salvageEquipment}=await import('../js/systems/salvage.js');
 const p={equipment:{},inventory:[{id:'moonblade',quantity:1},{id:'iron_ore',quantity:Number.MAX_SAFE_INTEGER}]};
 const snapshot=structuredClone(p),r=salvageEquipment(p,0);
 assert.equal(r.reason,'inventory_limit');assert.deepEqual(p,snapshot);
});
