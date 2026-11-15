import test from 'node:test';
import assert from 'node:assert/strict';
import { ADVENTURE_EVENTS, resolveAdventureEvent } from '../js/systems/adventureEvents.js';

const hero = () => ({ level: 2, health: 30, maxHealth: 80, mana: 18, maxMana: 50, gold: 12 });

test('wounded traveler can be helped or left with no cost', () => {
    const encounter = ADVENTURE_EVENTS.find(event => event.id === 'wounded_traveler');
    assert.ok(encounter);
    assert.equal(encounter.choices.length, 2);
    const player = hero();
    assert.equal(resolveAdventureEvent(player, 'wounded_traveler', 'safe').mana, 0);
    assert.deepEqual([player.mana, player.gold], [18, 12]);
    const helped = resolveAdventureEvent(player, 'wounded_traveler', 'risk', 0.99);
    assert.equal(helped.mana, -18);
    assert.equal(helped.gold, 70);
    assert.deepEqual([player.mana, player.gold], [0, 82]);
});

test('wounded traveler does not spend resources when mana is insufficient', () => {
    const player = { ...hero(), mana: 17 };
    const before = structuredClone(player);
    assert.equal(resolveAdventureEvent(player, 'wounded_traveler', 'risk', 0.5), null);
    assert.deepEqual(player, before);
    assert.equal(resolveAdventureEvent(player, 'wounded_traveler', 'other', 0.5), null);
});
