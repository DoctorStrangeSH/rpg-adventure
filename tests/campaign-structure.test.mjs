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


test('all 180 stages have valid encounter definitions and stable regional boss identities', async () => {
    const { getEnemy } = await import('../js/data/enemies.js');
    const battleLocations = LOCATIONS.filter(location => location.type !== 'safe');
    let miniBossCount = 0;
    let mainBossCount = 0;

    for (const location of battleLocations) {
        const miniBossIds = new Set();
        const mainBossIds = new Set();

        for (let index = 0; index < location.stages.length; index++) {
            const stage = location.stages[index];
            assert.equal(stage.stage, index + 1, `${location.id} stages must be contiguous and one-based`);
            assert.ok(Number.isSafeInteger(stage.enemiesCount) && stage.enemiesCount > 0,
                `${location.id} stage ${stage.stage} must have a positive encounter count`);
            assert.ok(Array.isArray(stage.enemies) && stage.enemies.length > 0,
                `${location.id} stage ${stage.stage} must define an enemy pool`);

            for (const enemyId of stage.enemies) {
                assert.ok(getEnemy(enemyId), `${location.id} stage ${stage.stage} references missing enemy ${enemyId}`);
            }

            if (!stage.boss) continue;
            const boss = stage.boss;
            assert.equal(typeof boss.id, 'string');
            assert.ok(boss.id.length > 0);
            assert.equal(typeof boss.name, 'string');
            assert.ok(boss.name.length > 0);
            for (const stat of ['health', 'attack', 'defense', 'expReward', 'goldReward']) {
                assert.ok(Number.isSafeInteger(boss[stat]) && boss[stat] > 0,
                    `${location.id} stage ${stage.stage} boss ${stat} must be a positive safe integer`);
            }

            if (stage.stage % 10 === 0) {
                assert.notEqual(boss.miniBoss, true);
                mainBossCount++;
                mainBossIds.add(boss.id);
            } else {
                assert.equal(boss.miniBoss, true);
                miniBossCount++;
                miniBossIds.add(boss.id);
            }
        }

        assert.equal(miniBossIds.size, 1, `${location.id} must use one consistent mini-boss identity`);
        assert.equal(mainBossIds.size, 1, `${location.id} must use one consistent main-boss identity`);
    }

    assert.equal(miniBossCount, 18);
    assert.equal(mainBossCount, 18);
});

test('the safe village is excluded from the 180-stage battle route', () => {
    const village = LOCATIONS.find(location => location.id === 'village');
    assert.ok(village);
    assert.equal(village.type, 'safe');
    assert.equal(village.stages, undefined);
    assert.equal(LOCATIONS.filter(location => location.type !== 'safe').length, 4);
});
