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


test('every ordinary adventure event supports a safe choice without changing the hero', () => {
    const events = ADVENTURE_EVENTS.filter(event => !event.followUp);
    assert.equal(events.length, 10);
    for (const event of events) {
        const player = hero();
        player.mana = 40;
        player.gold = 100;
        const before = structuredClone(player);
        const result = resolveAdventureEvent(player, event.id, 'safe', 0.5);
        assert.ok(result, event.id + ' must provide a safe exit');
        assert.deepEqual(player, before, event.id + ' safe choice must not mutate resources');
    }
});

test('every ordinary adventure event resolves both deterministic risk outcomes within resource bounds', () => {
    const events = ADVENTURE_EVENTS.filter(event => !event.followUp);
    const setup = (eventId) => {
        const player = hero();
        player.health = 70;
        player.mana = 40;
        player.gold = 100;
        if (eventId === 'astral_study') player.mana = 40;
        if (eventId === 'wounded_traveler') player.mana = 40;
        return player;
    };

    for (const event of events) {
        for (const roll of [0.1, 0.9]) {
            const player = setup(event.id);
            const result = resolveAdventureEvent(player, event.id, 'risk', roll);
            assert.ok(result, event.id + ' must resolve risk at roll ' + roll);
            assert.ok(Number.isFinite(player.health) && player.health >= 1 && player.health <= player.maxHealth);
            assert.ok(Number.isFinite(player.mana) && player.mana >= 0 && player.mana <= player.maxMana);
            assert.ok(Number.isFinite(player.gold) && player.gold >= 0);
            assert.ok(typeof result.message === 'string' && result.message.length > 0);
        }
    }
});

test('event resource costs reject unaffordable choices without partial mutation', () => {
    const cases = [
        ['astral_study', { mana: 11 }, 'Нужно 12 маны'],
        ['campfire', { gold: 24 }, 'Нужно 25 золота'],
        ['traveler', { gold: 19 }, 'Нужно 20 золота'],
        ['wounded_traveler', { mana: 17 }, 'Нужно 18 маны']
    ];
    for (const [eventId, override, message] of cases) {
        const player = { ...hero(), mana: 40, gold: 100, ...override };
        const before = structuredClone(player);
        assert.equal(resolveAdventureEvent(player, eventId, 'risk', 0.1), null);
        assert.deepEqual(player, before, eventId + ' must reject before mutation');
    }
});

test('event resolver rejects malformed requests and random values without mutation', () => {
    const player = { ...hero(), mana: 40, gold: 100 };
    const before = structuredClone(player);
    assert.equal(resolveAdventureEvent(null, 'cache', 'risk', 0.1), null);
    assert.equal(resolveAdventureEvent(player, 'unknown', 'risk', 0.1), null);
    assert.equal(resolveAdventureEvent(player, 'cache', 'unknown', 0.1), null);
    assert.equal(resolveAdventureEvent(player, 'cache', 'risk', NaN), null);
    assert.equal(resolveAdventureEvent(player, 'cache', 'risk', 1), null);
    assert.equal(resolveAdventureEvent(player, 'cache', 'risk', -0.01), null);
    assert.deepEqual(player, before);
});
