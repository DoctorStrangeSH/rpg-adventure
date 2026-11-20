import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../js/core/state.js';
import { toggleCharacterRelic, chooseTalent } from '../js/ui/character.js';
import { claimQuestReward, updateQuestProgress } from '../js/ui/quests.js';
import { claimAchievement, updateAchievements } from '../js/ui/achievements.js';

function setup(t, classId = 'warrior') {
    const previousPlayer = gameState.player;
    const previousSave = gameState.save;
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const notifications = [];
    const player = gameState.createPlayer(classId);
    gameState.player = player;
    globalThis.window = {
        showNotification(message, type) { notifications.push({ message, type }); },
        updateMainMenu() {},
        updateCharacterScreen() {},
        updateQuestsScreen() {},
        updateAchievements() {},
        levelUp() {}
    };
    globalThis.document = { getElementById() { return { innerHTML: '' }; } };
    t.after(() => {
        gameState.player = previousPlayer;
        gameState.save = previousSave;
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    });
    return { player, notifications };
}

test('relic activation and talent unlock roll back when their saves fail', (t) => {
    const { player } = setup(t);
    player.relics = ['ash_heart'];
    player.activeRelics = [];
    player.level = 2;
    gameState.save = () => false;

    assert.equal(toggleCharacterRelic('ash_heart'), false);
    assert.deepEqual(player.activeRelics, []);
    assert.equal(chooseTalent('warrior_force'), false);
    assert.deepEqual(player.talents, []);
});

test('quest progress and completion are rolled back when persistence fails', (t) => {
    const { player } = setup(t);
    const before = structuredClone(player.quests);
    gameState.save = () => false;

    assert.equal(updateQuestProgress('kill', 1), false);
    assert.deepEqual(player.quests, before);
});

test('quest reward claim restores gold experience items and claim marker on save failure', (t) => {
    const { player } = setup(t);
    const quest = player.quests.find(entry => entry.id === 'first_blood');
    quest.completed = true;
    const before = structuredClone(player);
    gameState.save = () => false;

    assert.equal(claimQuestReward('first_blood'), false);
    assert.deepEqual(player, before);
});

test('achievement progress and reward claims roll back on save failure', (t) => {
    const { player } = setup(t);
    player.stats.kills = 1;
    gameState.save = () => false;

    const beforeProgress = structuredClone(player.achievements);
    assert.equal(updateAchievements(), false);
    assert.deepEqual(player.achievements, beforeProgress);

    const achievement = player.achievements.find(entry => entry.id === 'first_kill');
    achievement.completed = true;
    const beforeClaim = structuredClone(player);
    assert.equal(claimAchievement('first_kill'), false);
    assert.deepEqual(player, beforeClaim);
});

test('quest and achievement rewards commit once and only then show success', (t) => {
    const { player, notifications } = setup(t);
    const quest = player.quests.find(entry => entry.id === 'first_blood');
    quest.completed = true;
    const achievement = player.achievements.find(entry => entry.id === 'first_kill');
    achievement.completed = true;
    let saves = 0;
    gameState.save = () => { saves++; return true; };

    assert.equal(claimQuestReward('first_blood'), true);
    assert.equal(claimAchievement('first_kill'), true);
    assert.equal(quest.rewardClaimed, true);
    assert.equal(achievement.claimed, true);
    assert.equal(player.gold, 300);
    assert.equal(saves, 2);
    assert.equal(notifications.filter(entry => entry.type === 'success').length, 2);
});
