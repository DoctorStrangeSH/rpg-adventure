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

test('rune pairs unlock deterministic synergies with combined combat effects',async()=>{
 const {getRuneSynergy,getWeaponRuneBonuses,triggerRuneEffect}=await import('../js/systems/enchanting.js');
 const p={equipment:{weapon:'iron_sword'},weaponRunes:{iron_sword:['flame','blood']}};
 assert.equal(getRuneSynergy(p).id,'crimson_flare');
 assert.equal(getWeaponRuneBonuses(p).attack,6);
 const enemy={health:100,effects:{}};
 assert.equal(triggerRuneEffect(p,enemy,0.1),'crimson_flare');
 assert.equal(enemy.effects.burnTurns,2);assert.equal(enemy.effects.bleedTurns,2);
});
test('frost and storm unlock frozen tempest regardless of rune order',async()=>{
 const {getRuneSynergy,getWeaponRuneBonuses,triggerRuneEffect}=await import('../js/systems/enchanting.js');
 const p={equipment:{weapon:'iron_sword'},weaponRunes:{iron_sword:['storm','frost']}};
 assert.equal(getRuneSynergy(p).id,'frozen_tempest');
 assert.equal(getWeaponRuneBonuses(p).critChance,0.07);
 const enemy={health:100,effects:{}};
 assert.equal(triggerRuneEffect(p,enemy,0.1),'frozen_tempest');
 assert.equal(enemy.effects.freezeTurns,1);assert.equal(enemy.effects.weakenTurns,1);
});
test('unknown rune combinations do not create a synergy',async()=>{
 const {getRuneSynergy}=await import('../js/systems/enchanting.js');
 const p={equipment:{weapon:'iron_sword'},weaponRunes:{iron_sword:['flame','frost']}};
 assert.equal(getRuneSynergy(p),null);
});

test('rune extraction charges gold and frees the selected socket',async()=>{
 const {extractRune,getRuneExtractionPreview,getWeaponRunes}=await import('../js/systems/enchanting.js');
 const p={gold:100,equipment:{weapon:'iron_sword'},weaponRunes:{iron_sword:['flame','blood']}};
 assert.equal(getRuneExtractionPreview(p,'iron_sword',0).available,true);
 const result=extractRune(p,'iron_sword',0);
 assert.equal(result.ok,true);assert.equal(result.rune.id,'flame');assert.equal(p.gold,50);
 assert.deepEqual(getWeaponRunes(p),['blood']);
});
test('rune extraction refuses insufficient gold or invalid sockets without mutation',async()=>{
 const {extractRune}=await import('../js/systems/enchanting.js');
 const p={gold:49,equipment:{weapon:'iron_sword'},weaponRunes:{iron_sword:['flame']}};
 const snapshot=structuredClone(p);
 assert.equal(extractRune(p,'iron_sword',0).reason,'gold');assert.deepEqual(p,snapshot);
 assert.equal(extractRune(p,'iron_sword',3).reason,'invalid_socket');assert.deepEqual(p,snapshot);
});

test('boss-only runes can be inscribed with their exact boss drop and extracted safely',async()=>{
 const {inscribeRune,extractRune,getWeaponRunes}=await import('../js/systems/enchanting.js');
 const p={gold:100,equipment:{weapon:'iron_sword'},itemUpgrades:{iron_sword:4},inventory:[{id:'rune_dragon_heart',quantity:1}]};
 assert.equal(inscribeRune(p,'iron_sword','dragon').ok,true);
 assert.deepEqual(getWeaponRunes(p),['dragon']);
 assert.equal(p.inventory.length,0);
 const result=extractRune(p,'iron_sword',0);
 assert.equal(result.ok,true);
 assert.deepEqual(p.inventory,[{id:'rune_dragon_heart',quantity:1}]);
 assert.equal(p.gold,50);
});
test('rune extraction refuses inventory overflow without charging or removing the rune',async()=>{
 const {extractRune}=await import('../js/systems/enchanting.js');
 const p={gold:100,equipment:{weapon:'iron_sword'},weaponRunes:{iron_sword:['flame']},inventory:[{id:'ember_core',quantity:Number.MAX_SAFE_INTEGER}]};
 const snapshot=structuredClone(p);
 assert.equal(extractRune(p,'iron_sword',0).reason,'inventory_capacity');
 assert.deepEqual(p,snapshot);
});

test('rune loadout preview calculates the incremental bonus and synergy before spending materials',async()=>{
 const {getRuneLoadoutPreview,inscribeRune}=await import('../js/systems/enchanting.js');
 const p={equipment:{weapon:'iron_sword'},itemUpgrades:{iron_sword:4},weaponRunes:{iron_sword:['flame']},inventory:[]};
 const preview=getRuneLoadoutPreview(p,'iron_sword','blood');
 assert.equal(preview.delta.attack,4);
 assert.equal(preview.delta.defense,0);
 assert.deepEqual(p.weaponRunes.iron_sword,['flame']);
 assert.equal(inscribeRune(p,'iron_sword','blood').reason,'materials');
});
test('rune socket thresholds expose exactly three forge sockets',async()=>{
 const {getRuneSocketCount}=await import('../js/systems/enchanting.js');
 const p={itemUpgrades:{blade:0}};
 assert.deepEqual([0,1,4,8,10].map(level=>{p.itemUpgrades.blade=level;return getRuneSocketCount(p,'blade')}),[0,1,2,3,3]);
});


test('tenth equipment upgrade has a valid cost and completes without a runtime error',async()=>{
 const {upgradeEquipment,getUpgradePreview,getItemUpgradeLevel}=await import('../js/systems/upgrades.js');
 const p={gold:12000,equipment:{weapon:'iron_sword',armor:null},itemUpgrades:{iron_sword:9},inventory:[
  {id:'iron_ore',quantity:15},{id:'ember_core',quantity:4},{id:'frost_crystal',quantity:4},{id:'blood_essence',quantity:3}
 ]};
 const preview=getUpgradePreview(p,'iron_sword');
 assert.equal(preview.available,true);
 assert.equal(preview.next,10);
 assert.equal(preview.gold,12000);
 const result=upgradeEquipment(p,'iron_sword');
 assert.equal(result.ok,true);
 assert.equal(result.level,10);
 assert.equal(getItemUpgradeLevel(p,'iron_sword'),10);
 assert.equal(p.gold,0);
 assert.equal(p.inventory.length,0);
 assert.equal(getUpgradePreview(p,'iron_sword').reason,'max_level');
});

test('Dragon Lair completion grants the exact scale requirement once per campaign cycle',async()=>{
 const {LOCATIONS}=await import('../js/data/locations.js');
 const {claimLocationReward}=await import('../js/systems/newGamePlus.js');
 const {grantItem}=await import('../js/systems/loot.js');
 const {getCraftingAvailability,CRAFTING_RECIPES}=await import('../js/systems/crafting.js');
 const location=LOCATIONS.find(entry=>entry.id==='dragon_lair');
 const scaleReward=location.rewards.items.find(entry=>entry.id==='dragon_scale');
 assert.deepEqual(scaleReward,{id:'dragon_scale',quantity:3});

 const p={level:10,gold:2000,campaignCycle:1,locationRewardCycles:{},discoveredItems:[],inventory:[
  {id:'ember_core',quantity:5},{id:'frost_crystal',quantity:5},{id:'blood_essence',quantity:5}
 ]};
 assert.equal(claimLocationReward(p,'dragon_lair'),true);
 assert.equal(grantItem(p,scaleReward.id,scaleReward.quantity),3);
 assert.equal(getCraftingAvailability(p,CRAFTING_RECIPES.find(recipe=>recipe.id==='dragon_sword')).available,true);
 assert.equal(claimLocationReward(p,'dragon_lair'),false);
 assert.equal(p.inventory.find(entry=>entry.id==='dragon_scale').quantity,3);

 p.campaignCycle=2;
 assert.equal(claimLocationReward(p,'dragon_lair'),true);
});
