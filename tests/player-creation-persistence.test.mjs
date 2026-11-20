import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG } from '../js/config/constants.js';
import { gameState } from '../js/core/state.js';
import { createPlayerWithPersistence } from '../js/ui/mainMenu.js';

function installEnvironment(t, storage) {
    const previousStorage = globalThis.localStorage;
    const previousWindow = globalThis.window;
    const previousPlayer = gameState.player;
    globalThis.localStorage = storage;
    globalThis.window = { showNotification() {} };
    gameState.player = null;
    t.after(() => {
        gameState.player = previousPlayer;
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
    });
}

test('new profile is not opened when its first save fails', (t) => {
    installEnvironment(t, {
        getItem() { return null; },
        setItem() { throw new Error('QuotaExceededError'); },
        removeItem() {}
    });
    const originalError = console.error;
    console.error = () => {};
    t.after(() => { console.error = originalError; });

    assert.equal(createPlayerWithPersistence('warrior'), false);
    assert.equal(gameState.player, null);
});

test('new profile becomes active only after its first save succeeds', (t) => {
    const values = new Map();
    installEnvironment(t, {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, value); },
        removeItem(key) { values.delete(key); }
    });

    assert.equal(createPlayerWithPersistence('mage'), true);
    assert.equal(gameState.player.class, 'mage');
    const saved = JSON.parse(values.get(GAME_CONFIG.saveKey));
    assert.equal(saved.player.class, 'mage');
    assert.equal(saved.schemaVersion, 2);
});

test('unknown class cannot create or persist a profile', (t) => {
    const values = new Map();
    installEnvironment(t, {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, value); },
        removeItem(key) { values.delete(key); }
    });

    assert.equal(createPlayerWithPersistence('unknown-class'), false);
    assert.equal(gameState.player, null);
    assert.equal(values.has(GAME_CONFIG.saveKey), false);
});
