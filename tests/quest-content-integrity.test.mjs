import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTS } from '../js/data/quests.js';
import { ACHIEVEMENTS } from '../js/data/achievements.js';
import { getItem } from '../js/data/items.js';

test('quest definitions have unique ids, supported progress types and valid rewards', () => {
    const ids = new Set();
    const supportedTypes = new Set(['kill', 'win', 'gold', 'level']);
    for (const quest of QUESTS) {
        assert.equal(typeof quest.id, 'string');
        assert.ok(quest.id.length > 0);
        assert.equal(ids.has(quest.id), false, `duplicate quest id: ${quest.id}`);
        ids.add(quest.id);
        assert.equal(typeof quest.name, 'string');
        assert.ok(quest.name.length > 0);
        assert.equal(typeof quest.description, 'string');
        assert.ok(quest.description.length > 0);
        assert.ok(supportedTypes.has(quest.type), `${quest.id} has unsupported progress type`);
        assert.ok(Number.isSafeInteger(quest.target) && quest.target > 0, quest.id);
        assert.ok(Number.isSafeInteger(quest.rewardExp) && quest.rewardExp >= 0, quest.id);
        assert.ok(Number.isSafeInteger(quest.rewardGold) && quest.rewardGold >= 0, quest.id);
        assert.ok(Array.isArray(quest.rewardItems), quest.id);
        for (const reward of quest.rewardItems) {
            assert.ok(getItem(reward.id), `${quest.id} references missing item ${reward.id}`);
            assert.ok(Number.isSafeInteger(reward.quantity) && reward.quantity > 0,
                `${quest.id} has invalid quantity for ${reward.id}`);
        }
    }
});

test('achievement definitions have unique ids and valid lifetime progression rewards', () => {
    const ids = new Set();
    const supportedStats = new Set([
        'kills', 'wins', 'level', 'gold', 'dungeons_completed', 'bosses_killed'
    ]);
    for (const achievement of ACHIEVEMENTS) {
        assert.equal(typeof achievement.id, 'string');
        assert.equal(ids.has(achievement.id), false, `duplicate achievement id: ${achievement.id}`);
        ids.add(achievement.id);
        assert.equal(typeof achievement.name, 'string');
        assert.equal(typeof achievement.description, 'string');
        assert.ok(Number.isSafeInteger(achievement.target) && achievement.target > 0);
        assert.ok(supportedStats.has(achievement.stat),
            `${achievement.id} has unsupported stat ${achievement.stat}`);
        assert.ok(Number.isSafeInteger(achievement.rewardExp) && achievement.rewardExp >= 0);
        assert.ok(Number.isSafeInteger(achievement.rewardGold) && achievement.rewardGold >= 0);
    }
});
