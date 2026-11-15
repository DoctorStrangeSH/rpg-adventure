import test from 'node:test';
import assert from 'node:assert/strict';
import { addArcherMark, consumeArcherMarks, useSkillEffect } from '../js/systems/combat.js';

const archer = { class: 'archer', attack: 30, equipment: {}, talents: [], activeRelics: [], relics: [] };
const enemy = () => ({ health: 1000, maxHealth: 1000, defense: 0, effects: {} });

test('archer builds up to two marks with living targets and actual hits', () => {
    const target = enemy();
    assert.equal(addArcherMark(archer, target, 10), 1);
    assert.equal(addArcherMark(archer, target, 10), 2);
    assert.equal(addArcherMark(archer, target, 10), 2);
    assert.equal(addArcherMark(archer, target, 0), 0);
    assert.equal(target.archerMarks, 2);
    assert.equal(addArcherMark({ class: 'mage' }, target, 10), 0);
    target.health = 0;
    assert.equal(addArcherMark(archer, target, 10), 0);
});

test('marks amplify the next damaging skill and are consumed once', () => {
    const target = enemy();
    const skill = { damageMultiplier: 1, element: 'physical' };
    const baseline = useSkillEffect(archer, enemy(), skill).damage;
    addArcherMark(archer, target, 10);
    addArcherMark(archer, target, 10);
    const boosted = useSkillEffect(archer, target, skill);
    assert.equal(boosted.marksConsumed, 2);
    assert.equal(boosted.damage, Math.floor(baseline * 1.3));
    assert.equal(target.archerMarks, 0);
    assert.equal(useSkillEffect(archer, target, skill).damage, baseline);
});

test('non-damaging skills and other classes do not spend archer marks', () => {
    const target = enemy();
    addArcherMark(archer, target, 10);
    assert.equal(consumeArcherMarks(archer, target, false), 0);
    assert.equal(consumeArcherMarks({ class: 'warrior' }, target, true), 0);
    assert.equal(target.archerMarks, 1);
});
