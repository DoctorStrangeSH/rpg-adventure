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

test('a newer recovery copy is never overwritten by a later damaged primary save', (t) => {
    const firstRecovery = JSON.stringify({
        schemaVersion: 99,
        player: { class: 'warrior', futureProgress: { chapter: 9 } }
    });
    const damagedPrimary = '{broken-primary';
    const values = new Map([
        [GAME_CONFIG.saveKey, damagedPrimary],
        [RECOVERY_SAVE_KEY, firstRecovery]
    ]);
    installStorage(t, {
        setItem(key, value) { values.set(key, value); },
        getItem(key) { return values.get(key) ?? null; },
        removeItem(key) { values.delete(key); }
    });

    assert.equal(Storage.save({ schemaVersion: 2, player: { class: 'mage' } }), true);
    assert.equal(values.get(RECOVERY_SAVE_KEY), firstRecovery);
    assert.deepEqual(Storage.load(), { schemaVersion: 2, player: { class: 'mage' } });
});


test('recovery backup survives a quota failure while writing the replacement save', (t) => {
    const original = JSON.stringify({
        schemaVersion: 99,
        player: { class: 'warrior', level: 42, futureProgress: { chapter: 9 } }
    });
    const values = new Map([[GAME_CONFIG.saveKey, original]]);
    installStorage(t, {
        setItem(key, value) {
            if (key === GAME_CONFIG.saveKey) throw new Error('QuotaExceededError');
            values.set(key, value);
        },
        getItem(key) { return values.get(key) ?? null; },
        removeItem(key) { values.delete(key); }
    });
    const originalError = console.error;
    console.error = () => {};
    t.after(() => { console.error = originalError; });

    assert.equal(Storage.save({ schemaVersion: 2, player: { class: 'mage', level: 1 } }), false);
    assert.equal(values.get(GAME_CONFIG.saveKey), original,
        'the original primary save must remain untouched');
    assert.equal(values.get(RECOVERY_SAVE_KEY), original,
        'the byte-for-byte recovery copy must survive the failed replacement');
    assert.equal(Storage.loadRecovery().player.futureProgress.chapter, 9);
});

test('repeated quota failures never replace the first recovery copy or primary save', (t) => {
    const original = '{damaged-but-preserved';
    const firstRecovery = '{"schemaVersion":77,"player":{"class":"archer","chapter":4}}';
    const values = new Map([
        [GAME_CONFIG.saveKey, original],
        [RECOVERY_SAVE_KEY, firstRecovery]
    ]);
    installStorage(t, {
        setItem(key, value) {
            if (key === GAME_CONFIG.saveKey) throw new Error('QuotaExceededError');
            values.set(key, value);
        },
        getItem(key) { return values.get(key) ?? null; },
        removeItem(key) { values.delete(key); }
    });
    const originalError = console.error;
    console.error = () => {};
    t.after(() => { console.error = originalError; });

    for (let attempt = 0; attempt < 3; attempt++) {
        assert.equal(Storage.save({
            schemaVersion: 2,
            player: { class: 'mage', level: attempt + 1 }
        }), false);
    }
    assert.equal(values.get(GAME_CONFIG.saveKey), original);
    assert.equal(values.get(RECOVERY_SAVE_KEY), firstRecovery);
});


test('invalid save envelopes are rejected before touching primary or recovery data', (t) => {
    const original = JSON.stringify({ schemaVersion: 2, player: { class: 'warrior', level: 12 } });
    const recovery = JSON.stringify({ schemaVersion: 1, player: { class: 'mage', level: 7 } });
    const values = new Map([
        [GAME_CONFIG.saveKey, original],
        [RECOVERY_SAVE_KEY, recovery]
    ]);
    let writes = 0;
    installStorage(t, {
        setItem(key, value) { writes++; values.set(key, value); },
        getItem(key) { return values.get(key) ?? null; },
        removeItem(key) { values.delete(key); }
    });

    const invalid = [
        undefined,
        null,
        false,
        0,
        'not-a-save',
        [],
        {},
        { player: null },
        { player: [] },
        { player: 'invalid' },
        { player: { class: 'warrior' }, toJSON() { return null; } },
        { player: { class: 'warrior' }, toJSON() { return 'not-json-envelope'; } }
    ];

    for (const candidate of invalid) {
        assert.equal(Storage.save(candidate), false);
        assert.equal(values.get(GAME_CONFIG.saveKey), original);
        assert.equal(values.get(RECOVERY_SAVE_KEY), recovery);
    }
    assert.equal(writes, 0, 'invalid envelopes must not write either storage key');
});

test('circular save payloads are rejected without replacing the existing profile', (t) => {
    const original = JSON.stringify({ player: { class: 'archer', level: 9 } });
    const values = new Map([[GAME_CONFIG.saveKey, original]]);
    installStorage(t, {
        setItem(key, value) { values.set(key, value); },
        getItem(key) { return values.get(key) ?? null; },
        removeItem(key) { values.delete(key); }
    });
    const circular = { player: { class: 'mage' } };
    circular.self = circular;
    const originalError = console.error;
    console.error = () => {};
    t.after(() => { console.error = originalError; });

    assert.equal(Storage.save(circular), false);
    assert.equal(values.get(GAME_CONFIG.saveKey), original);
});
