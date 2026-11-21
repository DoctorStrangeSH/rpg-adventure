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
