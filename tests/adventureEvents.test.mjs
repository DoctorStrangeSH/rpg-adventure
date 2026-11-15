import test from 'node:test';
import assert from 'node:assert/strict';
import { ADVENTURE_EVENTS, rollAdventureEvent, resolveAdventureEvent } from '../js/systems/adventureEvents.js';

const hero = () => ({ level: 1, health: 60, maxHealth: 100, mana: 5, maxMana: 80, gold: 0 });

test('spark altar appears as a selectable dungeon encounter', () => {
    const event = ADVENTURE_EVENTS.find(entry => entry.id === 'spark_altar');
    assert.ok(event);
    assert.deepEqual(event.choices.map(choice => choice.id), ['risk', 'safe']);
    assert.equal(rollAdventureEvent(0.99).id, 'traveler');
});

test('spark altar trades health for missing mana without randomness', () => {
    const player = hero();
    const result = resolveAdventureEvent(player, 'spark_altar', 'risk', 0.99);
    assert.equal(result.health, -15);
    assert.equal(result.mana, 30);
    assert.equal(player.health, 45);
    assert.equal(player.mana, 35);
});

test('spark altar rejects lethal or wasteful trades without modifying resources', () => {
    const lowHealth = { ...hero(), health: 15 };
    assert.equal(resolveAdventureEvent(lowHealth, 'spark_altar', 'risk', 0.1), null);
    assert.equal(lowHealth.health, 15);
    const fullMana = { ...hero(), mana: 80 };
    assert.equal(resolveAdventureEvent(fullMana, 'spark_altar', 'risk', 0.1), null);
    assert.equal(fullMana.health, 60);
    const nearlyFull = { ...hero(), mana: 75 };
    assert.equal(resolveAdventureEvent(nearlyFull, 'spark_altar', 'risk', 0.1).mana, 5);
    assert.equal(nearlyFull.mana, 80);
    const safe = hero();
    assert.equal(resolveAdventureEvent(safe, 'spark_altar', 'safe').health, 0);
    assert.equal(safe.health, 60);
});
