import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCATIONS } from '../js/data/locations.js';
import { getEnemy } from '../js/data/enemies.js';
import { getItem } from '../js/data/items.js';
import { applyExperience } from '../js/systems/progression.js';
import { upgradeEquipment } from '../js/systems/upgrades.js';

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

test('each region has valid enemy pools, monotonic boss rewards, and resolvable completion rewards', () => {
    const campaignRegions = LOCATIONS.filter(location => location.type !== 'safe');
    assert.equal(campaignRegions.length, 4);

    for (const location of campaignRegions) {
        assert.equal(location.stages.length, location.totalStages, `${location.id} stage count`);
        assert.ok(Number.isSafeInteger(location.rewards?.exp) && location.rewards.exp > 0,
            `${location.id} completion XP must be positive`);
        assert.ok(Number.isSafeInteger(location.rewards?.gold) && location.rewards.gold > 0,
            `${location.id} completion gold must be positive`);

        for (const stage of location.stages) {
            assert.ok(Array.isArray(stage.enemies) && stage.enemies.length > 0,
                `${location.id} stage ${stage.stage} needs an enemy pool`);
            for (const enemyId of stage.enemies) {
                const enemy = getEnemy(enemyId);
                assert.ok(enemy, `${location.id} stage ${stage.stage} references unknown enemy ${enemyId}`);
                assert.ok(Number.isFinite(enemy.expReward) && enemy.expReward > 0,
                    `${enemyId} must award positive XP`);
                assert.ok(Number.isFinite(enemy.goldReward) && enemy.goldReward > 0,
                    `${enemyId} must award positive gold`);
            }

            if (stage.boss) {
                for (const stat of ['health', 'attack', 'defense', 'expReward', 'goldReward']) {
                    assert.ok(Number.isFinite(stage.boss[stat]) && stage.boss[stat] > 0,
                        `${location.id} stage ${stage.stage} boss needs positive ${stat}`);
                }
            }
        }

        for (const isMiniBoss of [true, false]) {
            const bosses = location.stages
                .map(stage => stage.boss)
                .filter(boss => boss && Boolean(boss.miniBoss) === isMiniBoss);
            for (let index = 1; index < bosses.length; index++) {
                const previous = bosses[index - 1];
                const current = bosses[index];
                for (const stat of ['health', 'attack', 'defense', 'expReward', 'goldReward']) {
                    assert.ok(current[stat] >= previous[stat],
                        `${location.id} ${isMiniBoss ? 'mini-boss' : 'boss'} ${stat} must not regress`);
                }
            }
        }

        assert.ok(Array.isArray(location.rewards.items) && location.rewards.items.length > 0,
            `${location.id} must grant completion items`);
        for (const reward of location.rewards.items) {
            assert.ok(getItem(reward.id), `${location.id} references unknown reward item ${reward.id}`);
            assert.ok(Number.isSafeInteger(reward.quantity) && reward.quantity > 0,
                `${location.id} reward ${reward.id} must have a positive integer quantity`);
        }
    }
});

test('full +0 to +10 upgrade budget is reproducible and exposes the campaign gold-to-upgrade gap', () => {
    const player = {
        level: 20,
        gold: 1_000_000,
        equipment: { weapon: 'dragon_sword', armor: null },
        itemUpgrades: { dragon_sword: 0 },
        inventory: [
            { id: 'iron_ore', quantity: 72 },
            { id: 'ember_core', quantity: 11 },
            { id: 'frost_crystal', quantity: 12 },
            { id: 'blood_essence', quantity: 7 }
        ]
    };
    const startingGold = player.gold;

    for (let level = 1; level <= 10; level++) {
        const result = upgradeEquipment(player, 'dragon_sword');
        assert.equal(result.ok, true, `upgrade to +${level}`);
        assert.equal(result.level, level);
    }

    const upgradeGold = startingGold - player.gold;
    assert.equal(upgradeGold, 34_400);
    assert.deepEqual(player.inventory, []);
    assert.equal(player.itemUpgrades.dragon_sword, 10);

    const campaignGold = calculateCampaignRewards().gold;
    assert.ok(campaignGold > upgradeGold * 100,
        'current campaign gold expectation should continue to flag the unresolved economy gap');
});

function calculateConservativeRegionExperience(location) {
    const locationIndex = LOCATION_INDEX[location.id];
    let experience = location.rewards.exp;

    for (const stage of location.stages) {
        const weakestEnemyExperience = Math.min(...stage.enemies.map(id => getEnemy(id).expReward));
        const depthTier = Math.min(6, Math.floor((stage.stage - 1) / 5));
        const depthReward = 1 + depthTier * 0.08;
        const stageMultiplier = 1 + stage.stage * 0.1 + locationIndex * 0.5;
        const ordinaryReward = Math.floor(weakestEnemyExperience * stageMultiplier * depthReward);
        experience += stage.enemiesCount * ordinaryReward;

        // Boss rewards use their authored stage values. Optional unbroken-expedition
        // bonuses are deliberately excluded from this conservative progression floor.
        if (stage.boss) experience += stage.boss.expReward;
    }

    return experience;
}

function getConservativeClearLevel(location) {
    const player = {
        level: 1, experience: 0, maxExperience: 100,
        maxHealth: 100, health: 100, maxMana: 50, mana: 50,
        attack: 10, defense: 5
    };
    applyExperience(player, calculateConservativeRegionExperience(location));
    return player.level;
}

test('region entry gates match the conservative level reached after clearing the previous region', () => {
    const byId = new Map(LOCATIONS.map(location => [location.id, location]));
    const progression = [
        ['forest', 'mountains', 15],
        ['mountains', 'ruins', 19],
        ['ruins', 'dragon_lair', 22]
    ];

    for (const [completedId, nextId, expectedLevel] of progression) {
        const completed = byId.get(completedId);
        const next = byId.get(nextId);
        const conservativeLevel = getConservativeClearLevel(completed);

        assert.equal(conservativeLevel, expectedLevel,
            `${completedId} conservative clear level`);
        assert.equal(next.minLevel, expectedLevel,
            `${nextId} must unlock at the conservative level from ${completedId}`);
    }
});
