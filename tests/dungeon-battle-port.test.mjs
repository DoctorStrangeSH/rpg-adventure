import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getDungeonBattleState,
    isDungeonBattleActive,
    registerDungeonBattleAdapter,
    resetDungeonBattlePresentation,
    restoreDungeonEncounter,
    startDungeonEncounter
} from '../js/ports/dungeonBattlePort.js';

test('dungeon battle port validates and forwards its presentation adapter contract', () => {
    assert.throws(
        () => registerDungeonBattleAdapter({ getState() {} }),
        /complete presentation contract/
    );

    const calls = [];
    const state = { isActive: true, currentEnemy: { id: 'test_enemy' } };
    registerDungeonBattleAdapter({
        getState: () => state,
        resetPresentation: () => calls.push('reset'),
        restoreEncounter: snapshot => {
            calls.push(['restore', snapshot]);
            return true;
        },
        startEncounter: options => {
            calls.push(['start', options]);
            return true;
        }
    });

    assert.equal(getDungeonBattleState(), state);
    assert.equal(isDungeonBattleActive(), true);
    resetDungeonBattlePresentation();
    assert.equal(restoreDungeonEncounter({ enemy: { id: 'saved_enemy' } }), true);
    assert.equal(startDungeonEncounter({ enemy: { id: 'new_enemy' } }), true);
    assert.deepEqual(calls, [
        'reset',
        ['restore', { enemy: { id: 'saved_enemy' } }],
        ['start', { enemy: { id: 'new_enemy' } }]
    ]);
});
