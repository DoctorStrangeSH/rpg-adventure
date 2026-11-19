import test from 'node:test';
import assert from 'node:assert/strict';
import { equipInventoryItem, unequipEquipmentItem, getEquipmentSlotForItem } from '../js/systems/equipment.js';
import { getItem, getItemLore, getEquipmentComparison } from '../js/data/items.js';
import { getEquipmentSetBonuses, getEffectiveCombatStats } from '../js/systems/combat.js';

function makePlayer() {
    return {
        level: 10, attack: 20, defense: 10,
        equipment: { weapon: null, armor: null },
        inventory: [
            { id: 'iron_sword', quantity: 1 },
            { id: 'dragon_sword', quantity: 1 },
            { id: 'leather_armor', quantity: 1 },
            { id: 'health_potion', quantity: 2 }
        ]
    };
}

test('equipping replaces an item and applies only the stat difference', () => {
    const player = makePlayer();
    assert.equal(equipInventoryItem(player, 0).ok, true);
    assert.equal(player.attack, 35);
    assert.equal(equipInventoryItem(player, 1).ok, true);
    assert.equal(player.attack, 60);
    assert.equal(player.equipment.weapon, 'dragon_sword');
    assert.equal(player.inventory[0].quantity, 1);
});

test('unequipping removes exactly the equipped bonus', () => {
    const player = makePlayer();
    equipInventoryItem(player, 0);
    const result = unequipEquipmentItem(player, 'weapon');
    assert.equal(result.ok, true);
    assert.equal(player.attack, 20);
    assert.equal(player.equipment.weapon, null);
});

test('consumables and unknown slots cannot be equipped', () => {
    const player = makePlayer();
    assert.equal(equipInventoryItem(player, 3).reason, 'not_equipment');
    assert.equal(equipInventoryItem(player, -1).ok, false);
    assert.equal(unequipEquipmentItem(player, 'cape').reason, 'invalid_slot');
    assert.equal(getEquipmentSlotForItem('iron_sword'), 'weapon');
    assert.equal(getEquipmentSlotForItem('health_potion'), null);
});

test('level restrictions and empty slots are handled without changing stats', () => {
    const player = makePlayer();
    player.level = 1;
    const before = player.attack;
    assert.equal(equipInventoryItem(player, 1).reason, 'level_required');
    assert.equal(player.attack, before);
    assert.equal(unequipEquipmentItem(player, 'armor').reason, 'empty_slot');
});

test('legendary and epic signature items expose authored lore and origin', () => {
    const dragon = getItemLore(getItem('dragon_sword'));
    const moon = getItemLore(getItem('moonblade'));
    assert.ok(dragon.lore.length > 40);
    assert.match(dragon.origin, /Чёрный шпиль/);
    assert.ok(moon.lore.length > 40);
    assert.ok(moon.origin.length > 0);
    assert.equal(getItemLore(getItem('iron_sword')), null);
});

test('equipment comparison reports exact upgrade and downgrade values', () => {
    const sword = getItem('dragon_sword');
    const weaker = getEquipmentComparison(sword, getItem('iron_sword'));
    assert.equal(weaker.delta, 25);
    assert.equal(weaker.isUpgrade, true);
    const stronger = getEquipmentComparison(getItem('iron_sword'), sword);
    assert.equal(stronger.delta, -25);
    assert.equal(stronger.isDowngrade, true);
    assert.equal(getEquipmentComparison(getItem('health_potion'), null), null);
});

test('themed sets grant a partial bonus and unlock stronger complete-set bonuses', () => {
    const player = makePlayer();
    player.equipment.weapon = 'ember_sword';
    const partial = getEquipmentSetBonuses(player);
    assert.equal(partial.progress.find(set => set.id === 'emberguard').equippedPieces, 1);
    assert.equal(partial.attack, 0);
    assert.equal(partial.defense, 2);
    assert.equal(partial.activeSets.length, 0);

    player.equipment.armor = 'guardian_armor';
    const complete = getEquipmentSetBonuses(player);
    assert.equal(complete.progress.find(set => set.id === 'emberguard').complete, true);
    assert.equal(complete.attack, 6);
    assert.equal(complete.defense, 2);
    assert.deepEqual(complete.activeSets, [{ id: 'emberguard', name: 'Страж пепла' }]);
});

test('set bonuses are calculated dynamically and do not mutate saved base stats', () => {
    const player = makePlayer();
    player.equipment.weapon = 'blood_dagger';
    player.equipment.armor = 'blood_armor';
    const baseAttack = player.attack;
    const baseDefense = player.defense;
    const first = getEffectiveCombatStats(player);
    const second = getEffectiveCombatStats(player);
    assert.equal(first.attack, baseAttack + 6);
    assert.equal(first.defense, baseDefense + 3);
    assert.equal(second.attack, first.attack);
    assert.equal(player.attack, baseAttack);
    assert.equal(player.defense, baseDefense);
});
