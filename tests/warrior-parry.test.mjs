import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWarriorParry } from '../js/systems/combat.js';

const warrior = { class: 'warrior', attack: 100, equipment: {}, talents: [], activeRelics: [], relics: [] };

test('warrior parries telegraphed hits only after an intentional strong guard', () => {
    for (const [hero, windup, guard] of [
        [warrior, false, 0.75],
        [warrior, true, 0.5],
        [{ ...warrior, class: 'archer' }, true, 0.75]
    ]) {
        const enemy = { health: 100, maxHealth: 100 };
        assert.equal(resolveWarriorParry(hero, enemy, windup, guard), 0);
        assert.equal(enemy.health, 100);
    }
});

test('warrior riposte caps damage at eight percent of target HP', () => {
    const enemy = { health: 100, maxHealth: 100 };
    assert.equal(resolveWarriorParry(warrior, enemy, true, 0.75), 8);
    assert.equal(enemy.health, 92);
});

test('riposte cannot overkill or trigger against defeated and malformed enemies', () => {
    const enemy = { health: 3, maxHealth: 100 };
    assert.equal(resolveWarriorParry(warrior, enemy, true, 0.75), 3);
    assert.equal(enemy.health, 0);
    assert.equal(resolveWarriorParry(warrior, enemy, true, 0.75), 0);
    assert.equal(resolveWarriorParry(warrior, { health: 10, maxHealth: NaN }, true, 0.75), 0);
});

import { applyEnemyAction, getClassTacticalBonus } from '../js/systems/combat.js';

const makeHero = classId => ({
    class: classId, attack: 100, defense: 0, health: 100, maxHealth: 100,
    mana: 30, talents: [], equipment: {}, activeRelics: [], relics: []
});

test('warrior receives the stronger 75 percent guard against a telegraphed attack', () => {
    const enemy = { attack: 40, health: 100, maxHealth: 100, effects: {}, intent: 'heavy' };
    const warriorHero = makeHero('warrior');
    const mageHero = makeHero('mage');

    const warriorGuard = getClassTacticalBonus(warriorHero, enemy).guardReduction;
    const mageGuard = getClassTacticalBonus(mageHero, enemy).guardReduction;
    assert.equal(warriorGuard, 0.75);
    assert.equal(mageGuard, 0.5);

    const warriorHit = applyEnemyAction({ ...enemy }, warriorHero, 'attack', 0, warriorGuard);
    const mageHit = applyEnemyAction({ ...enemy }, mageHero, 'attack', 0, mageGuard);
    const unguardedHero = makeHero('warrior');
    const unguardedHit = applyEnemyAction({ ...enemy }, unguardedHero, 'attack');

    assert.equal(warriorHit.damage, 10);
    assert.equal(mageHit.damage, 20);
    assert.equal(unguardedHit.damage, 40);
    assert.ok(warriorHit.damage < mageHit.damage);
});

test('warrior guard remains 50 percent against an unannounced attack', () => {
    const hero = makeHero('warrior');
    const enemy = { attack: 40, health: 100, maxHealth: 100, effects: {}, intent: null };
    const guard = getClassTacticalBonus(hero, enemy).guardReduction;
    assert.equal(guard, 0.5);
    const result = applyEnemyAction(enemy, hero, 'attack', 0, guard);
    assert.equal(result.damage, 20);
});

test('warrior riposte is bounded by attack and enemy health and leaves no negative HP', () => {
    const hero = makeHero('warrior');
    hero.attack = 20;
    const enemy = { health: 5, maxHealth: 100 };
    assert.equal(resolveWarriorParry(hero, enemy, true, 0.75), 5);
    assert.equal(enemy.health, 0);
});
