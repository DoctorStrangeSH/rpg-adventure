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

test('upgrade is deterministic, resource-gated and improves equipped combat stats',async()=>{
 const {upgradeEquipment,getItemUpgradeLevel,getUpgradePreview}=await import('../js/systems/upgrades.js');
 const {getEffectiveCombatStats}=await import('../js/systems/combat.js');
 const p={gold:5000,attack:10,defense:5,equipment:{weapon:'iron_sword',armor:null},inventory:[{id:'iron_ore',quantity:100},{id:'ember_core',quantity:20},{id:'frost_crystal',quantity:20},{id:'blood_essence',quantity:20}]};
 const before=getEffectiveCombatStats(p).attack;assert.equal(getUpgradePreview(p,'iron_sword').next,1);
 const result=upgradeEquipment(p,'iron_sword');assert.equal(result.ok,true);assert.equal(getItemUpgradeLevel(p,'iron_sword'),1);
 assert.equal(getEffectiveCombatStats(p).attack,before+2);
});
test('upgrade refuses unequipped or maxed items without spending resources',async()=>{
 const {upgradeEquipment}=await import('../js/systems/upgrades.js');
 const p={gold:5000,equipment:{weapon:null,armor:null},inventory:[{id:'iron_ore',quantity:100}]};const snapshot=structuredClone(p);
 assert.equal(upgradeEquipment(p,'iron_sword').reason,'not_equipped');assert.deepEqual(p,snapshot);
 p.equipment.weapon='iron_sword';p.itemUpgrades={iron_sword:10};const maxed=structuredClone(p);
 assert.equal(upgradeEquipment(p,'iron_sword').reason,'max_level');assert.deepEqual(p,maxed);
});

test('upgrade visual profile maps level and weapon family to distinct visual tiers',async()=>{
 const {getUpgradeVisualProfile}=await import('../js/systems/upgradeVisuals.js');
 assert.equal(getUpgradeVisualProfile('iron_sword',0).tier,'base');assert.equal(getUpgradeVisualProfile('iron_sword',2).tier,'etched');
 assert.equal(getUpgradeVisualProfile('frost_blade',5).theme,'frost');assert.equal(getUpgradeVisualProfile('blood_dagger',8).tier,'awakened');
 assert.equal(getUpgradeVisualProfile('dragon_sword',10).className,'upgrade-ascended theme-dragon');assert.equal(getUpgradeVisualProfile('dragon_sword',99).level,10);
});

test('rune inscription consumes materials, obeys socket gates and adds combat bonuses',async()=>{
 const {inscribeRune,getWeaponRunes,getRuneSocketCount}=await import('../js/systems/enchanting.js');
 const {getEffectiveCombatStats,getWeaponDamageType}=await import('../js/systems/combat.js');
 const p={attack:10,defense:5,equipment:{weapon:'iron_sword'},itemUpgrades:{iron_sword:1},inventory:[{id:'ember_core',quantity:2}]};
 assert.equal(getRuneSocketCount(p,'iron_sword'),1);
 assert.equal(inscribeRune(p,'iron_sword','flame').ok,true);
 assert.deepEqual(getWeaponRunes(p),['flame']);assert.equal(p.inventory.length,0);
 assert.equal(getEffectiveCombatStats(p).attack,14);assert.equal(getWeaponDamageType(p),'fire');
 assert.equal(inscribeRune(p,'iron_sword','frost').reason,'sockets_full');
});
test('rune effects apply status effects with a bounded chance',async()=>{
 const {triggerRuneEffect}=await import('../js/systems/enchanting.js');
 const p={equipment:{weapon:'iron_sword'},weaponRunes:{iron_sword:['frost']}};
 const enemy={health:100,effects:{}};
 assert.equal(triggerRuneEffect(p,enemy,0.1),'freeze');assert.equal(enemy.effects.freezeTurns,1);
 assert.equal(triggerRuneEffect(p,enemy,0.9),null);assert.equal(triggerRuneEffect(p,enemy,1),null);
});
test('failed rune inscription leaves inventory and weapon runes unchanged',async()=>{
 const {inscribeRune}=await import('../js/systems/enchanting.js');
 const p={equipment:{weapon:'iron_sword'},itemUpgrades:{iron_sword:1},inventory:[{id:'ember_core',quantity:1}]};
 const snapshot=structuredClone(p);const result=inscribeRune(p,'iron_sword','flame');
 assert.equal(result.reason,'materials');assert.deepEqual(p,snapshot);
});
