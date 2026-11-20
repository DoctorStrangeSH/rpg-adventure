import test from 'node:test';
import assert from 'node:assert/strict';
import { getUpgradePreview, upgradeEquipment } from '../js/systems/upgrades.js';
import { getEnchantPreview, inscribeRune, getRuneExtractionPreview, extractRune, getRuneSocketCount } from '../js/systems/enchanting.js';
import { getEffectiveCombatStats } from '../js/systems/combat.js';

function makePlayer() {
    return {
        level: 20,
        gold: 100_000,
        equipment: { weapon: 'dragon_sword', armor: null },
        itemUpgrades: { dragon_sword: 1 },
        weaponRunes: { dragon_sword: ['flame'] },
        inventory: [
            { id: 'iron_ore', quantity: 2 },
            { id: 'ember_core', quantity: 2 }
        ]
    };
}

test('upgrade preview rejects malformed matching stacks instead of ignoring them', () => {
    const player = makePlayer();
    player.inventory.push({ id: 'iron_ore', quantity: Number.NaN });
    const snapshot = structuredClone(player);

    assert.equal(getUpgradePreview(player, 'dragon_sword').reason, 'invalid_inventory');
    assert.equal(upgradeEquipment(player, 'dragon_sword').reason, 'invalid_inventory');
    assert.deepEqual(player, snapshot);
});

test('upgrade preview rejects missing inventory and invalid currency safely', () => {
    const missingInventory = makePlayer();
    missingInventory.inventory = null;
    assert.equal(getUpgradePreview(missingInventory, 'dragon_sword').reason, 'invalid_inventory');

    const invalidCurrency = makePlayer();
    invalidCurrency.gold = Number.NaN;
    const snapshot = structuredClone(invalidCurrency);
    assert.equal(upgradeEquipment(invalidCurrency, 'dragon_sword').reason, 'invalid_currency');
    assert.deepEqual(invalidCurrency, snapshot);
});

test('upgrade material totals reject safe-integer overflow across duplicate stacks', () => {
    const player = makePlayer();
    player.inventory = [
        { id: 'iron_ore', quantity: Number.MAX_SAFE_INTEGER },
        { id: 'iron_ore', quantity: 1 }
    ];
    assert.equal(getUpgradePreview(player, 'dragon_sword').reason, 'invalid_inventory');
});

test('rune inscription rejects malformed matching stacks without consuming materials', () => {
    const player = makePlayer();
    player.weaponRunes.dragon_sword = [];
    player.inventory.push({ id: 'ember_core', quantity: Number.NaN });
    const snapshot = structuredClone(player);

    assert.equal(getEnchantPreview(player, 'dragon_sword', 'flame').reason, 'invalid_inventory');
    assert.equal(inscribeRune(player, 'dragon_sword', 'flame').reason, 'invalid_inventory');
    assert.deepEqual(player, snapshot);
});

test('rune inscription rejects missing inventory without throwing', () => {
    const player = makePlayer();
    player.weaponRunes.dragon_sword = [];
    player.inventory = undefined;
    assert.equal(inscribeRune(player, 'dragon_sword', 'flame').reason, 'invalid_inventory');
});

test('rune extraction rejects invalid currency and overflowing material stacks atomically', () => {
    const invalidCurrency = makePlayer();
    invalidCurrency.gold = Number.NaN;
    const currencySnapshot = structuredClone(invalidCurrency);
    assert.equal(getRuneExtractionPreview(invalidCurrency, 'dragon_sword', 0).reason, 'invalid_currency');
    assert.equal(extractRune(invalidCurrency, 'dragon_sword', 0).reason, 'invalid_currency');
    assert.deepEqual(invalidCurrency, currencySnapshot);

    const overflowing = makePlayer();
    overflowing.inventory = [{ id: 'ember_core', quantity: Number.MAX_SAFE_INTEGER }];
    const inventorySnapshot = structuredClone(overflowing);
    assert.equal(getRuneExtractionPreview(overflowing, 'dragon_sword', 0).reason, 'inventory_capacity');
    assert.equal(extractRune(overflowing, 'dragon_sword', 0).reason, 'inventory_capacity');
    assert.deepEqual(overflowing, inventorySnapshot);
});

test('each equipment upgrade adds exactly two combat stat points and socket thresholds stay aligned', () => {
    const player = makePlayer();
    player.attack = 100;
    player.defense = 50;
    player.equipment.armor = 'frost_armor';
    player.itemUpgrades = { dragon_sword: 0, frost_armor: 0 };

    const base = getEffectiveCombatStats(player);
    assert.equal(base.attack, 100);
    assert.equal(base.defense, 50);

    for (const level of [1, 4, 8, 10]) {
        player.itemUpgrades.dragon_sword = level;
        player.itemUpgrades.frost_armor = level;
        const stats = getEffectiveCombatStats(player);
        assert.equal(stats.attack, 100 + level * 2);
        assert.equal(stats.defense, 50 + level * 2);
    }

    assert.equal(getRuneSocketCount(player, 'dragon_sword'), 3);
    player.itemUpgrades.dragon_sword = 0;
    assert.equal(getRuneSocketCount(player, 'dragon_sword'), 0);
    player.itemUpgrades.dragon_sword = 1;
    assert.equal(getRuneSocketCount(player, 'dragon_sword'), 1);
    player.itemUpgrades.dragon_sword = 3;
    assert.equal(getRuneSocketCount(player, 'dragon_sword'), 1);
    player.itemUpgrades.dragon_sword = 4;
    assert.equal(getRuneSocketCount(player, 'dragon_sword'), 2);
    player.itemUpgrades.dragon_sword = 7;
    assert.equal(getRuneSocketCount(player, 'dragon_sword'), 2);
    player.itemUpgrades.dragon_sword = 8;
    assert.equal(getRuneSocketCount(player, 'dragon_sword'), 3);
});
