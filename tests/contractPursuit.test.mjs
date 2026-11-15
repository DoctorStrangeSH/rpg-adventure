import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleBloodPursuer, applyBloodPursuer } from '../js/systems/contractPursuit.js';

const enemy = Object.freeze({ name: 'Гоблин', health: 100, maxHealth: 100, attack: 20, defense: 5, expReward: 80, goldReward: 40 });

test('only a successful risky blood pact schedules a pursuer', () => {
    assert.equal(scheduleBloodPursuer('blood_contract', 'risk', { gold: 65 }), true);
    assert.equal(scheduleBloodPursuer('blood_contract', 'risk', { gold: 0 }), false);
    assert.equal(scheduleBloodPursuer('blood_contract', 'safe', { gold: 65 }), false);
    assert.equal(scheduleBloodPursuer('cache', 'risk', { gold: 65 }), false);
    assert.equal(scheduleBloodPursuer('blood_contract', 'risk', null), false);
});

test('pursuer boosts enemy difficulty and rewards without mutating base enemy', () => {
    const result = applyBloodPursuer(enemy, true);
    assert.equal(result.pursued, true);
    assert.match(result.enemy.name, /Преследователь/);
    assert.equal(result.enemy.health, 120);
    assert.equal(result.enemy.maxHealth, 120);
    assert.equal(result.enemy.attack, 24);
    assert.equal(result.enemy.defense, 5);
    assert.equal(result.enemy.expReward, 100);
    assert.equal(result.enemy.goldReward, 50);
    assert.equal(enemy.health, 100);
    assert.deepEqual(applyBloodPursuer(enemy, false), { enemy, pursued: false });
});
