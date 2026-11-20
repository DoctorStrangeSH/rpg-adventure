import test from 'node:test';
import assert from 'node:assert/strict';
import { RECOVERY_SAVE_KEY, Storage } from '../js/core/storage.js';
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


test('a future-version save is backed up before a current build replaces it', (t) => {
    const values = new Map();
    const future = JSON.stringify({ schemaVersion: 99, player: { class: 'warrior', level: 42 } });
    values.set(GAME_CONFIG.saveKey, future);
    installStorage(t, {
        setItem(key, value) { values.set(key, value); },
        getItem(key) { return values.get(key) ?? null; },
        removeItem(key) { values.delete(key); }
    });

    assert.equal(Storage.save({ schemaVersion: 1, player: { class: 'mage', level: 1 } }), true);
    assert.equal(values.get(RECOVERY_SAVE_KEY), future);
    assert.deepEqual(Storage.loadRecovery(), { schemaVersion: 99, player: { class: 'warrior', level: 42 } });
    assert.deepEqual(Storage.load(), { schemaVersion: 1, player: { class: 'mage', level: 1 } });
});

test('malformed existing save is preserved byte-for-byte before a new game is written', (t) => {
    const values = new Map([[GAME_CONFIG.saveKey, '{not-json']]);
    installStorage(t, {
        setItem(key, value) { values.set(key, value); },
        getItem(key) { return values.get(key) ?? null; },
        removeItem(key) { values.delete(key); }
    });

    assert.equal(Storage.save({ schemaVersion: 1, player: { class: 'archer' } }), true);
    assert.equal(values.get(RECOVERY_SAVE_KEY), '{not-json');
    assert.deepEqual(Storage.load(), { schemaVersion: 1, player: { class: 'archer' } });
});

test('failed recovery backup blocks replacement and leaves the original save intact', (t) => {
    const future = JSON.stringify({ schemaVersion: 99, player: { class: 'warrior', level: 42 } });
    const values = new Map([[GAME_CONFIG.saveKey, future]]);
    installStorage(t, {
        setItem(key, value) {
            if (key === RECOVERY_SAVE_KEY) throw new Error('QuotaExceededError');
            values.set(key, value);
        },
        getItem(key) { return values.get(key) ?? null; },
        removeItem(key) { values.delete(key); }
    });
    const originalError = console.error;
    console.error = () => {};
    t.after(() => { console.error = originalError; });

    assert.equal(Storage.save({ schemaVersion: 1, player: { class: 'mage' } }), false);
    assert.equal(values.get(GAME_CONFIG.saveKey), future);
    assert.equal(values.has(RECOVERY_SAVE_KEY), false);
});

test('legacy unversioned saves are upgraded without unnecessary recovery copies', (t) => {
    const values = new Map([[GAME_CONFIG.saveKey, JSON.stringify({ player: { class: 'warrior', level: 5 } })]]);
    installStorage(t, {
        setItem(key, value) { values.set(key, value); },
        getItem(key) { return values.get(key) ?? null; },
        removeItem(key) { values.delete(key); }
    });

    assert.equal(Storage.save({ schemaVersion: 1, player: { class: 'warrior', level: 5 } }), true);
    assert.equal(values.has(RECOVERY_SAVE_KEY), false);
});


test('a preserved recovery save can be restored without parsing or modifying its bytes', (t) => {
    const recovery = '{"schemaVersion":77,"player":{"class":"warrior"},"futureField":true}';
    const values = new Map([[RECOVERY_SAVE_KEY, recovery], [GAME_CONFIG.saveKey, '{broken']]);
    installStorage(t, {
        setItem(key, value) { values.set(key, value); },
        getItem(key) { return values.get(key) ?? null; },
        removeItem(key) { values.delete(key); }
    });

    assert.equal(Storage.restoreRecovery(), true);
    assert.equal(values.get(GAME_CONFIG.saveKey), recovery);
    assert.deepEqual(Storage.load(), {
        schemaVersion: 77,
        player: { class: 'warrior' },
        futureField: true
    });
});

test('recovery restore safely reports a missing or unavailable backup', (t) => {
    const values = new Map();
    installStorage(t, {
        setItem(key, value) { values.set(key, value); },
        getItem(key) { return values.get(key) ?? null; },
        removeItem(key) { values.delete(key); }
    });
    assert.equal(Storage.restoreRecovery(), false);

    globalThis.localStorage.getItem = () => { throw new Error('Storage unavailable'); };
    const originalError = console.error;
    console.error = () => {};
    t.after(() => { console.error = originalError; });
    assert.equal(Storage.restoreRecovery(), false);
});
