import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../js/data/classes.js';
import {
    addArcherMark,
    consumeArcherMarks,
    getCriticalMultiplier,
    getEffectiveCombatStats,
    triggerRangerEffect,
    tickEnemyEffects,
    useSkillEffect
} from '../js/systems/combat.js';

const makeArcher = talents => ({
    class: 'archer',
    attack: 40,
    defense: 5,
    health: 100,
    maxHealth: 100,
    mana: 60,
    maxMana: 60,
    talents,
    equipment: {},
    activeRelics: [],
    relics: []
});

const makeTarget = overrides => ({
    health: 1000,
    maxHealth: 1000,
    defense: 0,
    effects: {},
    resistances: {},
    ...overrides
});

const skill = id => {
    const found = CLASSES.archer.skills.find(entry => entry.id === id);
    assert.ok(found, `Missing archer skill: ${id}`);
    return found;
};

test('ordinary archer hits build at most two marks and damaging skill consumes both for +30%', () => {
    const archer = makeArcher([]);
    const target = makeTarget();

    assert.equal(addArcherMark(archer, target, 40), 1);
    assert.equal(addArcherMark(archer, target, 40), 2);
    assert.equal(addArcherMark(archer, target, 40), 2);
    assert.equal(target.archerMarks, 2);

    const result = useSkillEffect(archer, target, skill('rapid_shot'));
    assert.equal(result.marksConsumed, 2);
    assert.equal(result.damage, 156);
    assert.equal(target.archerMarks, 0);
});

test('marks are not created by other classes, zero damage, or defeated targets', () => {
    const target = makeTarget();
    assert.equal(addArcherMark({ class: 'mage' }, target, 40), 0);
    assert.equal(addArcherMark(makeArcher([]), target, 0), 0);
    target.health = 0;
    assert.equal(addArcherMark(makeArcher([]), target, 40), 0);
    assert.equal(target.archerMarks, undefined);
});

test('non-damaging skill does not consume archer marks and other classes cannot consume them', () => {
    const target = makeTarget({ archerMarks: 2 });
    assert.equal(consumeArcherMarks(makeArcher([]), target, false), 0);
    assert.equal(target.archerMarks, 2);
    assert.equal(consumeArcherMarks({ class: 'mage' }, target, true), 0);
    assert.equal(target.archerMarks, 2);
});

test('sniper specialization applies both its critical chance and critical damage multiplier', () => {
    const ordinary = makeArcher(['archer_precision']);
    const sniper = makeArcher(['archer_precision', 'archer_sniper']);
    assert.equal(getEffectiveCombatStats(ordinary).critChance, 0.20);
    assert.equal(getEffectiveCombatStats(sniper).critChance, 0.35);
    assert.equal(getCriticalMultiplier(ordinary), 2);
    assert.equal(getCriticalMultiplier(sniper), 2.5);
});

test('ranger bleed procs at the 30 percent boundary and respects target resistance', () => {
    const ranger = makeArcher(['archer_power', 'archer_ranger']);
    const target = makeTarget();
    assert.equal(triggerRangerEffect(ranger, target, 0.299999), true);
    assert.equal(target.effects.bleedTurns, 2);
    const tick = tickEnemyEffects(target);
    assert.equal(tick.bleedDamage, 30);

    const resistant = makeTarget({ resistances: { bleed: 0.5 } });
    assert.equal(triggerRangerEffect(ranger, resistant, 0.299999), true);
    assert.equal(resistant.effects.bleedTurns, 1);

    const immune = makeTarget({ resistances: { bleed: 1 } });
    assert.equal(triggerRangerEffect(ranger, immune, 0.1), false);
    assert.equal(immune.effects.bleedTurns, undefined);
});
