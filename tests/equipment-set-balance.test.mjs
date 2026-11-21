import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEnemyAction, triggerWeaponEffect, getEquipmentSetBonuses } from '../js/systems/combat.js';

function frostPlayer(fullSet) {
    return { health: 100, maxHealth: 100, mana: 20, maxMana: 20, defense: 0, attack: 10,
        equipment: { weapon: 'frost_blade', armor: fullSet ? 'frost_armor' : null },
        itemUpgrades: {}, weaponRunes: {}, activeRelics: [], relics: [], talents: [] };
}
function enemy() { return { health: 100, maxHealth: 100, attack: 10, effects: {}, resistances: {} }; }

test('complete Frostwarden set boosts armor freeze retaliation by ten percentage points', () => {
    const full = frostPlayer(true);
    const partial = frostPlayer(false);
    assert.deepEqual(getEquipmentSetBonuses(full).activeSets.map(set => set.id), ['frostwarden']);
    const fullTarget = enemy();
    const partialTarget = enemy();
    const fullResult = applyEnemyAction(fullTarget, full, 'normal', 0, 0, 0.2);
    const partialResult = applyEnemyAction(partialTarget, partial, 'normal', 0, 0, 0.2);
    assert.equal(fullResult.armorEffect, 'freeze');
    assert.equal(fullTarget.effects.freezeTurns, 1);
    assert.equal(partialResult.armorEffect, null);
    assert.equal(partialTarget.effects.freezeTurns || 0, 0);
});

test('complete weapon sets boost matching on-hit effect by ten percentage points', () => {
    const full = frostPlayer(true);
    const partial = frostPlayer(false);
    assert.equal(triggerWeaponEffect(full, enemy(), 0.25), 'freeze');
    assert.equal(triggerWeaponEffect(partial, enemy(), 0.25), null);
});

test('set bonuses remain derived and do not mutate equipment or base stats', () => {
    const player = frostPlayer(true);
    const before = structuredClone(player);
    const result = getEquipmentSetBonuses(player);
    assert.equal(result.progress.find(set => set.id === 'frostwarden').complete, true);
    assert.deepEqual(player, before);
});


function weaponProcPlayer(weapon, armor = null) {
    return {
        health: 100, maxHealth: 100, attack: 20, defense: 10,
        equipment: { weapon, armor }, weaponRunes: {}, itemUpgrades: {},
        activeRelics: [], relics: [], talents: []
    };
}

test('Emberguard and Bloodhunter full sets apply their documented +10 percentage-point weapon proc bonus', () => {
    const cases = [
        { weapon: 'ember_sword', armor: 'guardian_armor', roll: 0.35, effect: 'burn' },
        { weapon: 'blood_dagger', armor: 'blood_armor', roll: 0.4, effect: 'bleed' }
    ];
    for (const entry of cases) {
        const full = weaponProcPlayer(entry.weapon, entry.armor);
        const partial = weaponProcPlayer(entry.weapon);
        const fullEnemy = enemy();
        const partialEnemy = enemy();
        assert.equal(triggerWeaponEffect(full, fullEnemy, entry.roll), entry.effect);
        assert.equal(triggerWeaponEffect(partial, partialEnemy, entry.roll), null);
    }
});

test('Frostwarden weapon bonus and armor retaliation bonus use the same documented threshold', () => {
    const full = frostPlayer(true);
    const partial = frostPlayer(false);
    assert.equal(triggerWeaponEffect(full, enemy(), 0.2), 'freeze');
    assert.equal(triggerWeaponEffect(partial, enemy(), 0.2), null);
    const fullTarget = enemy();
    const partialTarget = enemy();
    assert.equal(applyEnemyAction(fullTarget, full, 'normal', 0, 0, 0.2).armorEffect, 'freeze');
    assert.equal(applyEnemyAction(partialTarget, partial, 'normal', 0, 0, 0.2).armorEffect, null);
});

test('set proc chance is capped at one and still respects enemy status immunity', () => {
    const full = weaponProcPlayer('ember_sword', 'guardian_armor');
    full.equipment.weapon = 'ember_sword';
    const target = enemy();
    target.resistances.burn = 1;
    assert.equal(triggerWeaponEffect(full, target, 0.399), null);
    assert.equal(target.effects.burnTurns, undefined);
});
