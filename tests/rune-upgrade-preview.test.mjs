import test from 'node:test';
import assert from 'node:assert/strict';
import { getRuneLoadoutPreview } from '../js/systems/enchanting.js';
import { getEquipmentUpgradeStatPreview } from '../js/ui/inventory.js';
import { readFileSync } from 'node:fs';

function runePlayer(runes = []) {
    return { level: 10, attack: 20, defense: 10, equipment: { weapon: 'iron_sword', armor: null }, weaponRunes: { iron_sword: runes }, itemUpgrades: { iron_sword: 4 }, inventory: [], talents: [], activeRelics: [], relics: [] };
}

test('rune preview predicts newly activated synergy and its exact bonus', () => {
    const preview = getRuneLoadoutPreview(runePlayer(['flame']), 'iron_sword', 'blood');
    assert.equal(preview.synergyActivated, true);
    assert.equal(preview.projectedSynergy.id, 'crimson_flare');
    assert.equal(preview.delta.attack, 4);
    assert.deepEqual(preview.projectedEffects.sort(), ['bleed', 'burn']);
});

test('rune preview identifies elemental damage type changes without mutating loadout', () => {
    const player = runePlayer([]); const before = structuredClone(player);
    const preview = getRuneLoadoutPreview(player, 'iron_sword', 'frost');
    assert.equal(preview.currentDamageType, 'physical');
    assert.equal(preview.projectedDamageType, 'ice');
    assert.deepEqual(player, before);
});

test('rune preview reports a changed or lost synergy', () => {
    const preview = getRuneLoadoutPreview(runePlayer(['frost', 'storm']), 'iron_sword', 'flame');
    assert.equal(preview.currentSynergy.id, 'frozen_tempest');
    assert.equal(preview.projectedSynergy, null);
    assert.equal(preview.synergyChanged, true);
});

test('upgrade preview shows effective combat gains and newly unlocked rune sockets', () => {
    const player = runePlayer(['flame']); player.itemUpgrades.iron_sword = 0; const before = structuredClone(player);
    const preview = getEquipmentUpgradeStatPreview(player, 'iron_sword');
    assert.equal(preview.attack, 2); assert.equal(preview.defense, 0);
    assert.equal(preview.currentSockets, 0); assert.equal(preview.nextSockets, 1); assert.equal(preview.unlockedSockets, 1);
    assert.deepEqual(player, before);
});

test('inventory UI renders rune effects, synergy changes, and upgrade socket gains', () => {
    const source = readFileSync(new URL('../js/ui/inventory.js', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
    for (const text of ['Стихия: ', 'Активируется синергия:', 'Текущая синергия перестанет действовать', 'Новый эффект:', 'Гнёзда ']) assert.ok(source.includes(text), text);
    assert.match(css, /\\.forge-synergy-preview/); assert.match(css, /\\.upgrade-stat-preview/);
});
