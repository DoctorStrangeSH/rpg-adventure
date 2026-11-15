import test from 'node:test';
import assert from 'node:assert/strict';
import { awardTravelerFavor, consumeTravelerFavor, TRAVELER_FAVOR_FIGHTS } from '../js/systems/expeditionFavor.js';

test('helping the traveler grants three protected encounters, refusal grants none', () => {
    assert.equal(awardTravelerFavor(0, 'wounded_traveler', 'safe'), 0);
    assert.equal(awardTravelerFavor(0, 'wounded_traveler', 'risk'), TRAVELER_FAVOR_FIGHTS);
    assert.equal(awardTravelerFavor(1, 'cache', 'risk'), 1);
    assert.equal(awardTravelerFavor(1, 'wounded_traveler', 'risk'), TRAVELER_FAVOR_FIGHTS);
});

test('favor protects exactly three fights and never mutates original enemy data', () => {
    const original = { name: 'Волк', attack: 20, health: 40 };
    let charges = awardTravelerFavor(0, 'wounded_traveler', 'risk');
    for (let i = 0; i < 3; i++) {
        const result = consumeTravelerFavor(original, charges);
        assert.equal(result.protected, true);
        assert.equal(result.enemy.attack, 17);
        assert.equal(result.enemy.health, 40);
        charges = result.charges;
    }
    assert.equal(charges, 0);
    assert.deepEqual(consumeTravelerFavor(original, charges), { enemy: original, charges: 0, protected: false });
    assert.equal(original.attack, 20);
});

test('traveler favor cannot turn low attack negative or spend invalid charges', () => {
    assert.equal(consumeTravelerFavor({ attack: 1 }, 1).enemy.attack, 1);
    assert.equal(consumeTravelerFavor({ attack: 10 }, -2).protected, false);
    assert.equal(consumeTravelerFavor(null, 2).protected, false);
});
