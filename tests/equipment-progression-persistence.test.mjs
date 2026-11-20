import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../js/core/state.js';
import { GAME_CONFIG } from '../js/config/constants.js';
import { craftItem } from '../js/systems/crafting.js';
import { upgradeEquipment } from '../js/systems/upgrades.js';
import { inscribeRune, extractRune, getWeaponRunes } from '../js/systems/enchanting.js';
import { salvageEquipment } from '../js/systems/salvage.js';

function installStorage(t) {
    const previous = globalThis.localStorage;
    const values = new Map();
    globalThis.localStorage = {
        setItem(key, value) { values.set(key, String(value)); },
        getItem(key) { return values.get(key) ?? null; },
        removeItem(key) { values.delete(key); }
    };
    t.after(() => {
        if (previous === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previous;
    });
    return values;
}

function saveAndReload(player) {
    assert.equal(gameState.player, player);
    assert.equal(gameState.save(), true, 'operation result must be persisted');
    assert.equal(gameState.load(), true, 'saved player must survive a fresh load');
    return gameState.player;
}

test('crafting, upgrades, rune inscription/extraction and salvage survive save reloads', (t) => {
    const values = installStorage(t);
    const previousPlayer = gameState.player;
    t.after(() => { gameState.player = previousPlayer; });

    const player = gameState.createPlayer('warrior');
    player.level = 10;
    player.gold = 5000;
    player.inventory = [
        { id: 'iron_ore', quantity: 20 },
        { id: 'ember_core', quantity: 4 },
        { id: 'frost_crystal', quantity: 4 },
        { id: 'blood_essence', quantity: 4 }
    ];

    // Craft an item, persist it, and prove the loaded inventory is authoritative.
    const crafted = craftItem(player, 'iron_sword');
    assert.equal(crafted.ok, true);
    let loaded = saveAndReload(player);
    assert.equal(loaded.inventory.find(entry => entry.id === 'iron_sword')?.quantity, 1);
    assert.equal(loaded.discoveredItems.includes('iron_sword'), true);
    assert.equal(loaded.gold, 4920);
    assert.equal(loaded.inventory.find(entry => entry.id === 'iron_ore')?.quantity, 12);

    // Upgrade the crafted and equipped weapon, then reload its level and costs.
    loaded.equipment.weapon = 'iron_sword';
    assert.equal(upgradeEquipment(loaded, 'iron_sword').ok, true);
    loaded = saveAndReload(loaded);
    assert.equal(loaded.itemUpgrades.iron_sword, 1);
    assert.equal(loaded.gold, 4870);
    assert.equal(loaded.inventory.find(entry => entry.id === 'iron_ore')?.quantity, 10);

    // Inscribe a rune and verify both its socket and material deduction after reload.
    assert.equal(inscribeRune(loaded, 'iron_sword', 'flame').ok, true);
    loaded = saveAndReload(loaded);
    assert.deepEqual(getWeaponRunes(loaded, 'iron_sword'), ['flame']);
    assert.equal(loaded.inventory.find(entry => entry.id === 'ember_core')?.quantity, 2,
        'inscription must persist the exact remaining material quantity');

    // Extraction returns the exact materials and removes the rune after reload.
    assert.equal(extractRune(loaded, 'iron_sword', 0).ok, true);
    loaded = saveAndReload(loaded);
    assert.deepEqual(getWeaponRunes(loaded, 'iron_sword'), []);
    assert.equal(loaded.inventory.find(entry => entry.id === 'ember_core')?.quantity, 4);
    assert.equal(loaded.gold, 4820);

    // Unequip, salvage the crafted sword, and confirm the conversion is persistent.
    loaded.equipment.weapon = null;
    const swordIndex = loaded.inventory.findIndex(entry => entry.id === 'iron_sword');
    assert.ok(swordIndex >= 0);
    assert.equal(salvageEquipment(loaded, swordIndex).ok, true);
    loaded = saveAndReload(loaded);
    assert.equal(loaded.inventory.find(entry => entry.id === 'iron_sword'), undefined);
    assert.equal(loaded.inventory.find(entry => entry.id === 'iron_ore')?.quantity, 12);
    assert.equal(loaded.discoveredItems.includes('iron_sword'), true,
        'collection discovery remains permanent after salvaging the item');
    assert.ok(values.has(GAME_CONFIG.saveKey));
});
