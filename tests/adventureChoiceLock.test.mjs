import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdventureChoiceLock, resolveAdventureEvent } from '../js/systems/adventureEvents.js';

const player = () => ({ health: 60, maxHealth: 100, mana: 10, maxMana: 50, gold: 10, level: 1 });

test('dungeon choice requirements explain missing resources', () => {
    const p = player();
    assert.equal(getAdventureChoiceLock(p, 'astral_study', 'risk'), 'Нужно 12 маны');
    assert.equal(getAdventureChoiceLock(p, 'wounded_traveler', 'risk'), 'Нужно 18 маны');
    assert.equal(getAdventureChoiceLock(p, 'campfire', 'risk'), 'Нужно 25 золота');
    assert.equal(getAdventureChoiceLock(p, 'traveler', 'risk'), 'Нужно 20 золота');
    assert.equal(getAdventureChoiceLock(p, 'spark_altar', 'risk'), null);
    assert.equal(getAdventureChoiceLock(p, 'campfire', 'safe'), null);
});

test('choice availability matches actual event resolution', () => {
    const p = player();
    for (const id of ['astral_study', 'wounded_traveler', 'campfire', 'traveler']) {
        const snapshot = structuredClone(p);
        assert.ok(getAdventureChoiceLock(p, id, 'risk'));
        assert.equal(resolveAdventureEvent(p, id, 'risk', 0), null);
        assert.deepEqual(p, snapshot);
    }
    p.health = 15;
    assert.equal(getAdventureChoiceLock(p, 'spark_altar', 'risk'), 'Нужно более 15 здоровья');
    p.health = 16;
    p.mana = p.maxMana;
    assert.equal(getAdventureChoiceLock(p, 'spark_altar', 'risk'), 'Запас маны уже полный');
    p.mana = 20;
    assert.equal(getAdventureChoiceLock(p, 'spark_altar', 'risk'), null);
    assert.equal(resolveAdventureEvent(p, 'spark_altar', 'risk', 0).mana, 30);
    assert.equal(p.health, 1);
});
