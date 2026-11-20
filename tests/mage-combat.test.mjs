import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../js/data/classes.js';
import { applyEnemyAction, interruptEnemyWindup, planEnemyTurn, tickEnemyEffects, useSkillEffect } from '../js/systems/combat.js';
import { unlockTalent } from '../js/systems/talents.js';

const mage = () => ({
    class: 'mage',
    level: 5,
    attack: 40,
    defense: 0,
    health: 100,
    maxHealth: 100,
    mana: 100,
    maxMana: 100,
    talents: [],
    equipment: {},
    activeRelics: [],
    relics: []
});

const enemy = overrides => ({
    id: 'world_eater',
    behavior: 'boss',
    health: 1000,
    maxHealth: 1000,
    attack: 40,
    defense: 0,
    effects: {},
    resistances: {},
    ...overrides
});

const mageSkill = id => {
    const found = CLASSES.mage.skills.find(skill => skill.id === id);
    assert.ok(found, `Mage skill ${id} must remain configured`);
    return found;
};

test('mage warden specialization reduces real incoming damage and stacks with guarding', () => {
    const unskilled = mage();
    const warden = mage();
    assert.equal(unlockTalent(warden, 'mage_ward'), true);
    assert.equal(unlockTalent(warden, 'mage_warden'), true);

    const baseHit = applyEnemyAction(enemy(), unskilled, 'attack').damage;
    const wardenHit = applyEnemyAction(enemy(), warden, 'attack').damage;
    const guardedWardenHit = applyEnemyAction(enemy(), mageWithWarden(), 'attack', 0, 0.5).damage;

    assert.equal(baseHit, 40);
    assert.equal(wardenHit, 22);
    assert.equal(guardedWardenHit, 11);
    assert.ok(guardedWardenHit < wardenHit);
});

function mageWithWarden() {
    const player = mage();
    player.talents = ['mage_ward', 'mage_warden'];
    return player;
}

test('mage arcanist specialization increases real fireball skill damage', () => {
    const ordinary = mage();
    const arcanist = mage();
    assert.equal(unlockTalent(arcanist, 'mage_focus'), true);
    assert.equal(unlockTalent(arcanist, 'mage_arcanist'), true);

    const ordinaryTarget = enemy({ behavior: 'normal' });
    const arcanistTarget = enemy({ behavior: 'normal' });
    const ordinaryResult = useSkillEffect(ordinary, ordinaryTarget, mageSkill('fireball'));
    const arcanistResult = useSkillEffect(arcanist, arcanistTarget, mageSkill('fireball'));

    assert.equal(ordinaryResult.damage, 100);
    assert.equal(arcanistResult.damage, 180);
    assert.ok(arcanistResult.damage > ordinaryResult.damage);
    assert.equal(arcanistTarget.effects.burnTurns, 2);
});

test('mage frost nova interrupts a boss telegraph and consumes exactly one frozen turn', () => {
    const player = mage();
    const target = enemy({ health: 2000, maxHealth: 2000 });
    const warning = planEnemyTurn(target, player, 0.1);
    assert.equal(warning.warned, true);
    assert.equal(target.intent, 'heavy');

    useSkillEffect(player, target, mageSkill('frost_nova'));
    const skippedTurn = tickEnemyEffects(target);
    assert.equal(skippedTurn.frozen, true);
    assert.equal(interruptEnemyWindup(target), true);
    assert.equal(target.intent, null);

    const followingTurn = tickEnemyEffects(target);
    assert.equal(followingTurn.frozen, false);
    assert.equal(interruptEnemyWindup(target), false);
});

test('mage elemental skills preserve configured mana costs and starting cast budget', () => {
    const fireball = mageSkill('fireball');
    const frostNova = mageSkill('frost_nova');
    assert.equal(fireball.manaCost, 20);
    assert.equal(frostNova.manaCost, 25);

    let mana = CLASSES.mage.stats.mana;
    mana -= fireball.manaCost;
    mana -= fireball.manaCost;
    mana -= frostNova.manaCost;
    mana -= frostNova.manaCost;
    assert.equal(mana, 10);
    assert.ok(mana < frostNova.manaCost);
});
