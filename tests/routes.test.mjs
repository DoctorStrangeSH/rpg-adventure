import test from 'node:test';
import assert from 'node:assert/strict';
import { DUNGEON_ROUTES, getRoute, applyRouteToEnemy } from '../js/systems/dungeonRoutes.js';

const baseEnemy = Object.freeze({
    id: 'wolf', name: 'Волк', health: 100, maxHealth: 100,
    attack: 20, defense: 5, expReward: 100, goldReward: 50
});

test('route choices give three distinct risk-reward profiles', () => {
    assert.deepEqual(Object.keys(DUNGEON_ROUTES), ['safe', 'danger', 'endurance']);
    assert.equal(getRoute('endurance').reward, 1.3);
    assert.equal(getRoute('unknown'), null);
    assert.equal(applyRouteToEnemy(baseEnemy, 'unknown'), null);
});

test('endurance route makes a longer but less punishing encounter', () => {
    const result = applyRouteToEnemy(baseEnemy, 'endurance', 0);
    assert.equal(result.health, 160);
    assert.equal(result.maxHealth, 160);
    assert.equal(result.attack, 16);
    assert.equal(result.defense, 5);
    assert.equal(result.expReward, 130);
    assert.equal(result.goldReward, 65);
    assert.equal(result.elite, false);
    assert.equal(result.eliteAffixes.length, 0);
    assert.equal(baseEnemy.health, 100);
});

test('danger route retains elite fights and safe route remains unchanged', () => {
    const safe = applyRouteToEnemy(baseEnemy, 'safe', 0.19);
    assert.equal(safe.health, 100);
    assert.equal(safe.attack, 20);
    assert.equal(safe.elite, false);

    const dangerous = applyRouteToEnemy(baseEnemy, 'danger', 0.19);
    assert.equal(dangerous.elite, true);
    assert.equal(dangerous.eliteAffixes.length, 2);
    assert.ok(dangerous.health > safe.health);
    assert.ok(dangerous.expReward > safe.expReward);
});
