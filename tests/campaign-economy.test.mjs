import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCATIONS } from '../js/data/locations.js';
import { getEnemy } from '../js/data/enemies.js';
import { applyExperience } from '../js/systems/progression.js';

const LOCATION_INDEX = { forest: 1, mountains: 2, ruins: 3, dragon_lair: 4 };

// Exact expectation of floor(base * (1 + U[0, 0.5))).
// Math.random is uniform; this avoids pretending every roll is exactly 1.25x.
function expectedRolledReward(base) {
    const half = Math.floor(base / 2);
    const expectedFraction = base % 2 === 0
        ? (half - 1) / 2
        : (half * half) / base;
    return base + expectedFraction;
}

function calculateCampaignRewards() {
    let experience = 0;
    let gold = 0;
    let ordinaryBattles = 0;
    let bossBattles = 0;

    for (const location of LOCATIONS.filter(entry => entry.type !== 'safe')) {
        const locationIndex = LOCATION_INDEX[location.id];
        for (const stage of location.stages) {
            const depthTier = Math.min(6, Math.floor((stage.stage - 1) / 5));
            const depthReward = 1 + depthTier * 0.08;
            const stageMultiplier = 1 + stage.stage * 0.1 + locationIndex * 0.5;
            const enemyPool = stage.enemies.map(getEnemy);

            for (const enemy of enemyPool) {
                const expBase = Math.floor(enemy.expReward * stageMultiplier * depthReward);
                const goldBase = Math.floor(enemy.goldReward * stageMultiplier * depthReward);
                experience += stage.enemiesCount / enemyPool.length * expectedRolledReward(expBase);
                gold += stage.enemiesCount / enemyPool.length * expectedRolledReward(goldBase);
            }
            ordinaryBattles += stage.enemiesCount;

            if (!stage.boss) continue;
            bossBattles++;
            experience += expectedRolledReward(stage.boss.expReward);
            gold += expectedRolledReward(stage.boss.goldReward);

            // Optional no-checkpoint milestone bonus; the baseline assumes
            // a continuous expedition through the region.
            if (!stage.boss.miniBoss && stage.stage >= 20 && stage.stage % 10 === 0) {
                const fraction = stage.stage >= 30 ? 0.2 : 0.15;
                experience += Math.floor(stage.boss.expReward * fraction);
                gold += Math.floor(stage.boss.goldReward * fraction);
            }
        }

        experience += location.rewards.exp;
        gold += location.rewards.gold;
    }

    return { experience, gold, ordinaryBattles, bossBattles };
}

test('main campaign reward model matches the current four-region content', () => {
    const totals = calculateCampaignRewards();
    assert.equal(totals.ordinaryBattles, 3690);
    assert.equal(totals.bossBattles, 36);
    assert.ok(Math.abs(totals.experience - 7_453_529.6752) < 0.01);
    assert.ok(Math.abs(totals.gold - 8_142_094.1996) < 0.01);
});

test('expected campaign experience ends at level 26, just short of level 27', () => {
    const totals = calculateCampaignRewards();
    const player = {
        level: 1, experience: 0, maxExperience: 100,
        maxHealth: 100, health: 100, maxMana: 50, mana: 50,
        attack: 10, defense: 5
    };

    applyExperience(player, totals.experience);

    assert.equal(player.level, 26);
    assert.ok(player.experience > 2_400_000);
    assert.ok(player.experience < player.maxExperience);
    assert.equal(player.maxExperience, 2_514_505);
});

test('each completed region guarantees its matching boss rune material once through the existing reward claim', () => {
    const expected = new Map([
        ['forest', 'rune_verdant_heart'],
        ['mountains', 'rune_dragon_heart'],
        ['ruins', 'rune_lich_soul'],
        ['dragon_lair', 'rune_world_fragment']
    ]);
    for (const location of LOCATIONS.filter(entry => expected.has(entry.id))) {
        const itemId = expected.get(location.id);
        assert.equal(location.rewards.items.filter(item => item.id === itemId)
            .reduce((sum, item) => sum + item.quantity, 0), 1,
        `${location.id} must grant exactly one regional boss rune`);
    }
});
