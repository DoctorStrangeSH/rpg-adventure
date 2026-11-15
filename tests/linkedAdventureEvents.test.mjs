import test from 'node:test';
import assert from 'node:assert/strict';
import { ADVENTURE_EVENTS, getAdventureEvent, rollAdventureEvent, resolveAdventureEvent } from '../js/systems/adventureEvents.js';

const player = () => ({ level: 1, health: 40, maxHealth: 100, mana: 12, maxMana: 50, gold: 0 });

test('rescued traveler follow-up cannot appear in the ordinary random event pool', () => {
    assert.equal(getAdventureEvent('traveler_return').followUp, true);
    assert.equal(getAdventureEvent('unknown'), null);
    for (let i = 0; i <= 100; i++) {
        assert.notEqual(rollAdventureEvent(i / 100).id, 'traveler_return');
    }
    assert.equal(rollAdventureEvent(0).id, 'cache');
    assert.equal(rollAdventureEvent(0.4).id, 'astral_study');
    assert.equal(rollAdventureEvent(0.99).id, 'traveler');
});

test('traveler returns with a bounded restorative gift and an optional refusal', () => {
    const p = player();
    const refused = resolveAdventureEvent(p, 'traveler_return', 'safe', 0.3);
    assert.equal(refused.health, 0);
    assert.equal(p.health, 40);
    const gift = resolveAdventureEvent(p, 'traveler_return', 'risk', 0.99);
    assert.equal(gift.health, 25);
    assert.equal(gift.mana, 15);
    assert.equal(p.health, 65);
    assert.equal(p.mana, 27);
    p.health = 99;
    p.mana = 49;
    resolveAdventureEvent(p, 'traveler_return', 'risk', 0.5);
    assert.equal(p.health, 100);
    assert.equal(p.mana, 50);
});
