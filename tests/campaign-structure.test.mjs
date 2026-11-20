import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCATIONS, unlockNextLocation } from '../js/data/locations.js';

const CAMPAIGN_ROUTE = [
    { id: 'forest', stages: 30, boss: 'forest_guardian' },
    { id: 'mountains', stages: 40, boss: 'mountain_dragon' },
    { id: 'ruins', stages: 50, boss: 'lich_king' },
    { id: 'dragon_lair', stages: 60, boss: 'world_eater' }
];

test('release campaign has one fixed four-region route and 180 stages', () => {
    const battleLocations = LOCATIONS.filter(location => location.type !== 'safe');
    assert.deepEqual(battleLocations.map(location => ({
        id: location.id,
        stages: location.stages.length,
        boss: location.stages.at(-1)?.boss?.id
    })), CAMPAIGN_ROUTE);
    assert.equal(battleLocations.reduce((sum, location) => sum + location.stages.length, 0), 180);
});

test('every ten-stage milestone has its configured major boss and final boss is World Eater', () => {
    const battleLocations = LOCATIONS.filter(location => location.type !== 'safe');
    for (const location of battleLocations) {
        for (const stage of location.stages) {
            if (stage.stage % 10 === 0) assert.ok(stage.boss, `${location.id} stage ${stage.stage} must have a major boss`);
            else if (stage.stage % 5 === 0) assert.equal(stage.boss?.miniBoss, true);
        }
    }
    const finalLocation = battleLocations.at(-1);
    assert.equal(finalLocation.stages.at(-1).stage, 60);
    assert.equal(finalLocation.stages.at(-1).boss.id, 'world_eater');
    assert.equal(finalLocation.stages.at(-1).boss.name, '💀 Пожиратель миров');
});

test('campaign unlock order is Forest, Mountains, Ruins, Dragon Lair, then complete', () => {
    const previous = LOCATIONS.map(location => location.unlocked);
    try {
        LOCATIONS.forEach(location => { location.unlocked = false; });
        assert.equal(unlockNextLocation('forest')?.id, 'mountains');
        assert.equal(unlockNextLocation('mountains')?.id, 'ruins');
        assert.equal(unlockNextLocation('ruins')?.id, 'dragon_lair');
        assert.equal(unlockNextLocation('dragon_lair'), null);
    } finally {
        LOCATIONS.forEach((location, index) => { location.unlocked = previous[index]; });
    }
});
