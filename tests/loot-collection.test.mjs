import test from 'node:test';
import assert from 'node:assert/strict';
import { grantItem, getBossTrophyCatalog, getCollectionProgress, hasBossTrophy, rollLoot } from '../js/systems/loot.js';
test('first successful award records discovery once',()=>{const p={inventory:[]};assert.equal(grantItem(p,'guardian_armor'),1);assert.deepEqual(p.discoveredItems,['guardian_armor']);assert.equal(grantItem(p,'guardian_armor',2),2);assert.deepEqual(p.discoveredItems,['guardian_armor']);assert.equal(p.inventory[0].quantity,3);});
test('invalid award does not create discovery',()=>{const p={inventory:[]};assert.equal(grantItem(p,'missing_item'),0);assert.equal(p.discoveredItems,undefined);});
test('collection exposes boss sources and progress',()=>{const p=getCollectionProgress(['guardian_armor','dragon_sword']);assert.equal(p.discovered,2);assert.equal(p.total,4);const e=getBossTrophyCatalog(['dragon_sword']).find(x=>x.bossId==='world_eater');assert.equal(e.discovered,true);assert.equal(e.bossName,'Пожиратель миров');});
test('existing boss trophy table remains deterministic',()=>{assert.equal(rollLoot(true,()=>0.3,'forest_guardian'),'guardian_armor');assert.equal(rollLoot(true,()=>0.3,'mountain_dragon'),'frost_blade');assert.equal(rollLoot(true,()=>0.3,'lich_king'),'blood_armor');assert.equal(rollLoot(true,()=>0.3,'world_eater'),'dragon_sword');});

test('failed quantity overflow does not unlock an item in the collection', () => {
    const player = { inventory: [{ id: 'guardian_armor', quantity: Number.MAX_SAFE_INTEGER }] };
    assert.equal(grantItem(player, 'guardian_armor', 1), 0);
    assert.deepEqual(player.discoveredItems, undefined);
    assert.equal(player.inventory[0].quantity, Number.MAX_SAFE_INTEGER);
});

test('story bosses can drop their own legendary rune materials',()=>{
 const cases=[
  ['forest_guardian','rune_verdant_heart'],
  ['mountain_dragon','rune_dragon_heart'],
  ['lich_king','rune_lich_soul'],
  ['world_eater','rune_world_fragment']
 ];
 for(const [bossId,itemId] of cases) assert.equal(rollLoot(true,()=>0.1,bossId),itemId);
});
test('boss rune drops are limited to known story bosses and preserve trophy drops',()=>{
 assert.equal(rollLoot(true,()=>0.1,'unknown_boss'),'moonblade');
 assert.equal(rollLoot(true,()=>0.3,'forest_guardian'),'guardian_armor');
});

test('a story boss trophy is awarded once and later repeats convert that slot into consumables', () => {
    const player = { inventory: [{ id: 'guardian_armor', quantity: 1 }], discoveredItems: ['guardian_armor'] };
    assert.equal(hasBossTrophy(player, 'forest_guardian'), true);
    assert.equal(rollLoot(true, () => 0.3, 'forest_guardian', hasBossTrophy(player, 'forest_guardian')),
        'big_health_potion');
    assert.equal(rollLoot(true, () => 0.5, 'forest_guardian', true), 'mana_potion');
    assert.equal(rollLoot(true, () => 0.1, 'forest_guardian', true), 'rune_verdant_heart',
        'regional rune drops remain available after the trophy is collected');
    assert.equal(hasBossTrophy({ inventory: [] }, 'forest_guardian'), false);
});
