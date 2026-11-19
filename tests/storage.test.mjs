import test from 'node:test';
import assert from 'node:assert/strict';
import { Storage } from '../js/core/storage.js';
import { GAME_CONFIG } from '../js/config/constants.js';

function installStorage(t, implementation) {
    const previous = globalThis.localStorage;
    globalThis.localStorage = implementation;
    t.after(() => {
        if (previous === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previous;
    });
}

test('storage saves JSON and reports a successful write', (t) => {
    const values = new Map();
    installStorage(t, {
        setItem(key, value) { values.set(key, value); },
        getItem(key) { return values.get(key) ?? null; },
        removeItem(key) { values.delete(key); }
    });
    const payload = { player: { level: 7 } };
    assert.equal(Storage.save(payload), true);
    assert.equal(values.get(GAME_CONFIG.saveKey), JSON.stringify(payload));
    assert.deepEqual(Storage.load(), payload);
});

test('storage reports quota/write failures without replacing existing data', (t) => {
    const previous = JSON.stringify({ player: { level: 3 } });
    installStorage(t, {
        setItem() { throw new Error('QuotaExceededError'); },
        getItem() { return previous; },
        removeItem() {}
    });
    const originalError = console.error;
    console.error = () => {};
    t.after(() => { console.error = originalError; });
    assert.equal(Storage.save({ player: { level: 99 } }), false);
    assert.deepEqual(Storage.load(), { player: { level: 3 } });
});

test('storage treats missing and malformed saves as no save', (t) => {
    let value = null;
    installStorage(t, {
        setItem(_key, next) { value = next; },
        getItem() { return value; },
        removeItem() { value = null; }
    });
    assert.equal(Storage.load(), null);
    value = '{broken json';
    const originalError = console.error;
    console.error = () => {};
    t.after(() => { console.error = originalError; });
    assert.equal(Storage.load(), null);
});

test('storage clear reports success and failure', (t) => {
    let removed = false;
    installStorage(t, {
        setItem() {},
        getItem() { return null; },
        removeItem() { removed = true; }
    });
    assert.equal(Storage.clear(), true);
    assert.equal(removed, true);
    globalThis.localStorage.removeItem = () => { throw new Error('Storage unavailable'); };
    const originalError = console.error;
    console.error = () => {};
    t.after(() => { console.error = originalError; });
    assert.equal(Storage.clear(), false);
});
