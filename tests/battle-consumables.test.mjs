import test from 'node:test';
import assert from 'node:assert/strict';
import { getItem } from '../js/data/items.js';
import { consumeHealingPotion, consumeManaPotion, consumeResourcePotion } from '../js/systems/combat.js';

test('mana potion restores mana up to max and consumes exactly one stack unit', () => {
    const potion = { id: 'mana_potion', quantity: 2 };
    const player = { mana: 85, maxMana: 100, inventory: [potion] };
    assert.equal(consumeManaPotion(player, potion, getItem('mana_potion')), 15);
    assert.equal(player.mana, 100);
    assert.equal(potion.quantity, 1);
    assert.equal(player.inventory.length, 1);
});

test('mana potion is not consumed when mana is already full', () => {
    const potion = { id: 'mana_potion', quantity: 1 };
    const player = { mana: 100, maxMana: 100, inventory: [potion] };
    assert.equal(consumeManaPotion(player, potion, getItem('mana_potion')), 0);
    assert.equal(potion.quantity, 1);
    assert.equal(player.inventory[0], potion);
});

test('last mana potion is removed from inventory after use', () => {
    const potion = { id: 'mana_potion', quantity: 1 };
    const player = { mana: 10, maxMana: 100, inventory: [potion] };
    assert.equal(consumeManaPotion(player, potion, getItem('mana_potion')), 30);
    assert.equal(player.mana, 40);
    assert.deepEqual(player.inventory, []);
});

test('health potion behavior remains unchanged through the shared resource helper', () => {
    const potion = { id: 'health_potion', quantity: 1 };
    const player = { health: 80, maxHealth: 100, inventory: [potion] };
    assert.equal(consumeHealingPotion(player, potion, getItem('health_potion')), 20);
    assert.equal(player.health, 100);
    assert.deepEqual(player.inventory, []);
});

test('invalid resource, malformed stack, and missing inventory fail without mutation', () => {
    const potion = { id: 'mana_potion', quantity: 1 };
    const player = { mana: 10, maxMana: 100, inventory: [potion] };
    assert.equal(consumeResourcePotion(player, potion, getItem('mana_potion'), 'stamina'), 0);
    assert.equal(consumeManaPotion(player, { id: 'mana_potion', quantity: -1 }, getItem('mana_potion')), 0);
    assert.equal(consumeManaPotion({ mana: 10, maxMana: 100 }, potion, getItem('mana_potion')), 0);
    assert.equal(player.mana, 10);
    assert.equal(potion.quantity, 1);
});
