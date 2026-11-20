import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCATIONS } from '../js/data/locations.js';

const EXPECTED = [
    { id: 'forest', stages: 30, ordinaryFights: 375, bossFights: 6 },
    { id: 'mountains', stages: 40, ordinaryFights: 680, bossFights: 8 },
    { id: 'ruins', stages: 50, ordinaryFights: 1075, bossFights: 10 },
    { id: 'dragon_lair', stages: 60, ordinaryFights: 1560, bossFights: 12 }
];

test('release campaign encounter volume matches the pacing audit', () => {
    const actual = LOCATIONS
        .filter(location => location.type !== 'safe')
        .map(location => ({
            id: location.id,
            stages: location.stages.length,
            ordinaryFights: location.stages.reduce((sum, stage) => sum + stage.enemiesCount, 0),
            bossFights: location.stages.filter(stage => stage.boss).length
        }));

    assert.deepEqual(actual, EXPECTED);
    assert.equal(actual.reduce((sum, region) => sum + region.stages, 0), 180);
    assert.equal(actual.reduce((sum, region) => sum + region.ordinaryFights, 0), 3690);
    assert.equal(actual.reduce((sum, region) => sum + region.bossFights, 0), 36);
});

test('every campaign stage has a finite positive ordinary encounter count', () => {
    for (const location of LOCATIONS.filter(entry => entry.type !== 'safe')) {
        for (const stage of location.stages) {
            assert.ok(Number.isInteger(stage.enemiesCount) && stage.enemiesCount > 0,
                `${location.id} stage ${stage.stage} must have a positive integer enemy count`);
        }
    }
});
