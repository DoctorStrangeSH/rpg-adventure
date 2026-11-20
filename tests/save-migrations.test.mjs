import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_SAVE_VERSION, migrateSaveData } from '../js/core/saveMigrations.js';

test('legacy unversioned saves migrate to the current schema without changing player data', () => {
    const legacy = { player: { id: 7, level: 4 }, screen: 'battle' };
    const result = migrateSaveData(legacy);
    assert.equal(result.ok, true);
    assert.equal(result.data.schemaVersion, CURRENT_SAVE_VERSION);
    assert.deepEqual(result.data.player, { ...legacy.player, dungeonProgress: {} });
    assert.equal(result.data.screen, 'battle');
});

test('current saves migrate idempotently', () => {
    const current = { schemaVersion: CURRENT_SAVE_VERSION, player: { level: 9 } };
    assert.deepEqual(migrateSaveData(migrateSaveData(current).data), { ok: true, data: current });
});

test('future or malformed saves are rejected instead of silently downgraded', () => {
    assert.deepEqual(migrateSaveData({ schemaVersion: CURRENT_SAVE_VERSION + 1, player: {} }),
        { ok: false, error: 'unsupported_save_version' });
    assert.deepEqual(migrateSaveData({ player: null }), { ok: false, error: 'invalid_save' });
    for (const schemaVersion of [-1, 1.5, '2', null, NaN]) {
        assert.deepEqual(migrateSaveData({ schemaVersion, player: {} }),
            { ok: false, error: 'unsupported_save_version' });
    }
});


test('version one saves migrate to version two with an empty resumable expedition registry', () => {
    const versionOne = {
        schemaVersion: 1,
        player: { id: 8, level: 12, dungeonCheckpoints: { forest: 4 } },
        screen: 'main-menu'
    };
    const result = migrateSaveData(versionOne);
    assert.equal(result.ok, true);
    assert.equal(result.data.schemaVersion, 2);
    assert.deepEqual(result.data.player.dungeonProgress, {});
    assert.deepEqual(result.data.player.dungeonCheckpoints, { forest: 4 });
    assert.equal(result.data.player.level, 12);
});
