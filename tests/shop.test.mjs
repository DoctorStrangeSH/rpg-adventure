import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../js/core/state.js';
import { buyItem } from '../js/ui/shop.js';

function withShopState(player, callback) {
    const previousPlayer = gameState.player;
    const previousWindow = globalThis.window;
    const notifications = [];
    globalThis.window = {
        showNotification: (message, type) => notifications.push({ message, type })
    };
    gameState.player = player;
    try {
        callback(notifications);
    } finally {
        gameState.player = previousPlayer;
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
    }
}

test('shop enforces required level in purchase logic, not only in the UI', () => {
    const player = {
        level: 1,
        gold: 5000,
        inventory: [],
        discoveredItems: []
    };

    withShopState(player, notifications => {
        buyItem('dragon_sword');
        assert.equal(player.gold, 5000);
        assert.deepEqual(player.inventory, []);
        assert.deepEqual(player.discoveredItems, []);
        assert.equal(notifications.length, 1);
        assert.match(notifications[0].message, /8 уровня/);
    });
});

test('shop rejects malformed gold instead of treating an invalid balance as free money', () => {
    const player = {
        level: 20,
        gold: Number.NaN,
        inventory: [],
        discoveredItems: []
    };

    withShopState(player, notifications => {
        buyItem('health_potion');
        assert.ok(Number.isNaN(player.gold));
        assert.deepEqual(player.inventory, []);
        assert.deepEqual(player.discoveredItems, []);
        assert.equal(notifications.length, 0);
    });
});

test('shop permits a purchase once the required level and currency are available', () => {
    const player = {
        level: 8,
        gold: 1500,
        inventory: [],
        discoveredItems: []
    };
    const previousSave = gameState.save;
    let saved = false;
    gameState.save = () => { saved = true; return true; };
    const previousDocument = globalThis.document;
    globalThis.document = {
        getElementById: () => ({ innerHTML: '' })
    };

    withShopState(player, notifications => {
        buyItem('dragon_sword');
        assert.equal(player.gold, 500);
        assert.deepEqual(player.inventory, [{ id: 'dragon_sword', quantity: 1 }]);
        assert.deepEqual(player.discoveredItems, ['dragon_sword']);
        assert.equal(saved, true);
        assert.equal(notifications.length, 1);
        assert.match(notifications[0].message, /Драконий меч/);
    });

    gameState.save = previousSave;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
});
