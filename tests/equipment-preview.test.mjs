import test from 'node:test';
import assert from 'node:assert/strict';
import { getFullEquipmentPreview } from '../js/ui/inventory.js';

function makePlayer() {
    return {
        level: 10,
        attack: 20,
        defense: 10,
        equipment: { weapon: 'ember_sword', armor: null },
        inventory: [{ id: 'guardian_armor', quantity: 1 }],
        talents: [],
        activeRelics: [],
        relics: [],
        itemUpgrades: {},
        weaponRunes: {},
        stats: {}
    };
}

test('equipment preview includes dynamic set activation, not only the item base stat', () => {
    const player = makePlayer();
    const preview = getFullEquipmentPreview(player, 0);
    assert.deepEqual(preview.activatedSets, [{ id: 'emberguard', name: 'Страж пепла' }]);
    assert.deepEqual(preview.deactivatedSets, []);
    assert.equal(preview.attack, 6);
    assert.equal(preview.defense, 17);
});

test('equipment preview never mutates the saved player or inventory', () => {
    const player = makePlayer();
    const before = structuredClone(player);
    getFullEquipmentPreview(player, 0);
    assert.deepEqual(player, before);
});

test('equipment preview rejects invalid, consumable and level-locked items', () => {
    const player = makePlayer();
    player.inventory.push({ id: 'health_potion', quantity: 1 }, { id: 'dragon_sword', quantity: 1 });
    assert.equal(getFullEquipmentPreview(player, -1), null);
    assert.equal(getFullEquipmentPreview(player, 1), null);
    player.level = 1;
    assert.equal(getFullEquipmentPreview(player, 2), null);
});

test('inventory cards render total attack, defense, crit and set activation changes', async () => {
    const { readFile } = await import('node:fs/promises');
    const inventory = await readFile(new URL('../js/ui/inventory.js', import.meta.url), 'utf8');
    const css = await readFile(new URL('../css/style.css', import.meta.url), 'utf8');
    assert.match(inventory, /После экипировки/);
    assert.match(inventory, /comparison\.attack/);
    assert.match(inventory, /comparison\.defense/);
    assert.match(inventory, /comparison\.critChance/);
    assert.match(inventory, /comparison\.activatedSets/);
    assert.match(inventory, /comparison\.deactivatedSets/);
    assert.match(css, /\.equipment-preview-stats/);
    assert.match(css, /\.equipment-set-change\.set-activated/);
    assert.match(css, /\.equipment-set-change\.set-deactivated/);
});
