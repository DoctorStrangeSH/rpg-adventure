import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../js/core/state.js';
import {
    useInventoryItem, unequipItem, craftInventoryItem, salvageInventoryItem,
    upgradeInventoryItem, inscribeInventoryRune, extractInventoryRune
} from '../js/ui/inventory.js';

function installFailingBrowser(t) {
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousStorage = globalThis.localStorage;
    const notifications = [];

    globalThis.window = {
        showNotification(message, type) { notifications.push({ message, type }); },
        updateCharacterScreen() {},
        updateMainMenu() {}
    };
    globalThis.document = {
        getElementById() { return { innerHTML: '' }; }
    };
    globalThis.localStorage = {
        getItem() { return null; },
        setItem() { throw new Error('QuotaExceededError'); },
        removeItem() {}
    };

    t.after(() => {
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
    });

    return notifications;
}

function makePlayer() {
    const player = gameState.createPlayer('warrior');
    player.level = 20;
    player.gold = 5000;
    player.inventory = [
        { id: 'iron_sword', quantity: 1 },
        { id: 'moonblade', quantity: 1 },
        { id: 'iron_ore', quantity: 20 },
        { id: 'ember_core', quantity: 4 },
        { id: 'frost_crystal', quantity: 4 },
        { id: 'blood_essence', quantity: 4 }
    ];
    player.equipment.weapon = 'iron_sword';
    player.itemUpgrades = { iron_sword: 1 };
    player.weaponRunes = { iron_sword: ['flame'] };
    return player;
}

test('inventory UI rolls back every item operation when localStorage rejects the save', (t) => {
    const notifications = installFailingBrowser(t);
    const previousPlayer = gameState.player;
    t.after(() => { gameState.player = previousPlayer; });

    const scenarios = [
        ['equipment', () => useInventoryItem(0), (player) => { player.equipment.weapon = null; }],
        ['consumable use', () => useInventoryItem(0), (player) => {
            player.inventory = [{ id: 'health_potion', quantity: 1 }];
            player.health = Math.max(1, player.maxHealth - 30);
        }],
        ['unequip', () => unequipItem('weapon'), () => {}],
        ['crafting', () => craftInventoryItem('iron_sword'), (player) => {
            player.inventory = [{ id: 'iron_ore', quantity: 20 }];
            player.equipment.weapon = null;
            player.itemUpgrades = {};
            player.weaponRunes = {};
        }],
        ['salvage', () => salvageInventoryItem(1), () => {}],
        ['upgrade', () => upgradeInventoryItem('iron_sword'), () => {}],
        ['rune inscription', () => inscribeInventoryRune('iron_sword', 'blood'), (player) => {
            player.itemUpgrades.iron_sword = 4;
            player.weaponRunes.iron_sword = ['flame'];
            player.inventory.push({ id: 'blood_essence', quantity: 2 });
        }],
        ['rune extraction', () => extractInventoryRune('iron_sword', 0), (player) => {
            player.gold = 500;
            player.weaponRunes.iron_sword = ['flame'];
        }]
    ];

    for (const [name, action, prepare] of scenarios) {
        const player = makePlayer();
        gameState.player = player;
        prepare(player);
        const before = structuredClone(player);
        const notificationCount = notifications.length;

        action();

        assert.deepEqual(player, before, name + ' must restore the complete player snapshot');
        assert.equal(notifications.length, notificationCount + 1, name + ' must report the failed save');
        assert.equal(notifications.at(-1).type, 'error', name + ' must not report success');
    }
});
