import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCATIONS } from '../js/data/locations.js';
import { CLASSES } from '../js/data/classes.js';
import { gameState } from '../js/core/state.js';
import { applyEnemyAction, useSkillEffect } from '../js/systems/combat.js';

const REGIONS = LOCATIONS.filter(location => location.type !== 'safe');

test('regional boss scaling stays bounded and preserves increasing regional base difficulty', () => {
    for (const region of REGIONS) {
        const mainBosses = region.stages.filter(stage => stage.boss && !stage.boss.miniBoss);
        const miniBosses = region.stages.filter(stage => stage.boss?.miniBoss);
        assert.ok(mainBosses.length > 0, `${region.id} must retain its main bosses`);
        assert.ok(miniBosses.length > 0, `${region.id} must retain its mini-bosses`);

        const mainBase = mainBosses[0].boss;
        for (let index = 0; index < mainBosses.length; index++) {
            const boss = mainBosses[index].boss;
            assert.ok(boss.health <= mainBase.health * 1.35);
            assert.ok(boss.attack <= mainBase.attack * 1.20);
            assert.ok(boss.defense <= mainBase.defense * 1.15);
            if (index > 0) {
                const previous = mainBosses[index - 1].boss;
                assert.ok(boss.health >= previous.health);
                assert.ok(boss.attack >= previous.attack);
                assert.ok(boss.defense >= previous.defense);
            }
        }

        const firstMini = miniBosses[0].boss;
        const lastMini = miniBosses.at(-1).boss;
        const miniBase = region.stages.find(entry => entry.boss?.miniBoss).boss;
        assert.ok(lastMini.health <= miniBase.health * 1.25);
        assert.ok(lastMini.attack <= miniBase.attack * 1.15);
        assert.ok(lastMini.defense <= miniBase.defense * 1.10);
        assert.ok(lastMini.health >= firstMini.health);
        assert.ok(lastMini.attack >= firstMini.attack);
        assert.ok(lastMini.defense >= firstMini.defense);
    }
});

test('final world eater can be damaged by each class real signature skill', () => {
    const finalRegion = REGIONS.find(region => region.id === 'dragon_lair');
    const finalBoss = finalRegion.stages.at(-1).boss;
    const signatureSkills = {
        warrior: 'power_strike',
        mage: 'fireball',
        archer: 'rapid_shot'
    };

    for (const [classId, skillId] of Object.entries(signatureSkills)) {
        const classData = CLASSES[classId];
        const skill = classData.skills.find(entry => entry.id === skillId);
        assert.ok(skill, `${classId} must retain its configured signature skill`);
        assert.ok(skill.manaCost > 0 && skill.manaCost <= classData.stats.mana,
            `${classId} must be able to cast its signature skill from a full starting mana pool`);

        const player = gameState.createPlayer(classId);
        // Level 26 with the same ordinary weapon and armor stat budget for
        // every class. useSkillEffect applies the real skill, relic, affinity,
        // hit-count and status rules rather than a hand-written multiplier.
        player.attack = classData.stats.attack + 25 * 5 + 40;
        player.defense = classData.stats.defense + 25 * 3 + 19;
        const enemy = {
            ...finalBoss,
            health: finalBoss.health,
            maxHealth: finalBoss.health,
            effects: {}
        };
        const result = useSkillEffect(player, enemy, skill);
        const actionsToDefeat = Math.ceil(finalBoss.health / result.damage);

        assert.ok(result.damage > 0, `${classId} signature skill must damage the final boss`);
        assert.ok(actionsToDefeat <= 20,
            `${classId} needs at most 20 signature actions, got ${actionsToDefeat}`);
        assert.equal(result.hits, Math.max(1, Math.floor(skill.hits || 1)));
    }
});

test('final world eater ordinary attack is survivable by a full-health level-26 hero', () => {
    const finalRegion = REGIONS.find(region => region.id === 'dragon_lair');
    const finalBoss = finalRegion.stages.at(-1).boss;

    for (const classId of Object.keys(CLASSES)) {
        const classStats = CLASSES[classId].stats;
        const player = gameState.createPlayer(classId);
        player.maxHealth = classStats.health + 25 * 20;
        player.health = player.maxHealth;
        player.defense = classStats.defense + 25 * 3 + 19;

        const result = applyEnemyAction(
            { ...finalBoss, behavior: 'boss', health: finalBoss.health, maxHealth: finalBoss.health },
            player,
            'attack'
        );

        assert.ok(result.damage < player.maxHealth / 3,
            `${classId} should not lose a third of max HP to one ordinary boss attack`);
        assert.ok(player.health > 0, `${classId} must survive one ordinary boss attack`);
    }
});

test('final world eater scaling remains within the documented release envelope', () => {
    const finalRegion = REGIONS.find(region => region.id === 'dragon_lair');
    const finalBoss = finalRegion.stages.at(-1).boss;
    assert.deepEqual(
        { health: finalBoss.health, attack: finalBoss.attack, defense: finalBoss.defense },
        { health: 4050, attack: 180, defense: 86 }
    );
});
