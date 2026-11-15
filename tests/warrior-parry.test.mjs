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
