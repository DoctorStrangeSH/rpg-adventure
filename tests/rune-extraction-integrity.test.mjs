import test from 'node:test';
import assert from 'node:assert/strict';
import { extractRune, getRuneExtractionPreview, getWeaponRunes } from '../js/systems/enchanting.js';

test('rune extraction removes the selected valid rune from its original storage index', () => {
    const player = {
        gold: 100,
        equipment: { weapon: 'iron_sword' },
        weaponRunes: { iron_sword: ['retired_unknown_rune', 'flame', 'blood'] },
        inventory: []
    };

    assert.deepEqual(getWeaponRunes(player), ['flame', 'blood']);
    const preview = getRuneExtractionPreview(player, 'iron_sword', 0);
    assert.equal(preview.available, true);
    assert.equal(preview.storageIndex, 1);

    const result = extractRune(player, 'iron_sword', 0);
    assert.equal(result.ok, true);
    assert.equal(result.rune.id, 'flame');
    assert.deepEqual(getWeaponRunes(player), ['blood']);
    assert.deepEqual(player.weaponRunes.iron_sword, ['retired_unknown_rune', 'blood']);
    assert.deepEqual(player.inventory, [{ id: 'ember_core', quantity: 2 }]);
    assert.equal(player.gold, 50);
});

test('extracting the last valid rune clears stale unknown rune entries without duplicating a rune', () => {
    const player = {
        gold: 50,
        equipment: { weapon: 'iron_sword' },
        weaponRunes: { iron_sword: ['retired_unknown_rune', 'frost'] },
        inventory: []
    };

    const result = extractRune(player, 'iron_sword', 0);
    assert.equal(result.ok, true);
    assert.equal(result.rune.id, 'frost');
    assert.equal(player.weaponRunes.iron_sword, undefined);
    assert.deepEqual(player.inventory, [{ id: 'frost_crystal', quantity: 2 }]);
    assert.deepEqual(getWeaponRunes(player), []);
});
