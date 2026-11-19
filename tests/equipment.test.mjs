import test from 'node:test';
import assert from 'node:assert/strict';
import { equipInventoryItem, unequipEquipmentItem, getEquipmentSlotForItem } from '../js/systems/equipment.js';

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
