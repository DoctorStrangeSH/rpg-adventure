import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../js/core/state.js';
import { battleVictory, getBattleState } from '../js/ui/battle.js';

test('dungeon victory batches quest, achievement and level-up mutations into one progress save', (t) => {
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousSave = gameState.save;
    const battle = getBattleState();
    const previousBattle = {
        isActive: battle.isActive,
        currentEnemy: battle.currentEnemy,
        isBossBattle: battle.isBossBattle,
        isLocationBattle: battle.isLocationBattle
    };
    const questSaveFlags = [];
    const achievementSaveFlags = [];
    const levelUpSaveFlags = [];
    let saveCount = 0;

    const player = gameState.createPlayer('warrior');
    player.experience = 99;
    gameState.save = () => { saveCount++; return true; };
    globalThis.document = { querySelector() { return null; } };
    globalThis.window = {
        getLocationState() { return { inLocation: true }; },
        updateQuestProgress(_type, _amount, options) { questSaveFlags.push(options?.save); },
        updateAchievements(options) { achievementSaveFlags.push(options?.save); },
        levelUp(options) { levelUpSaveFlags.push(options?.save); },
        handleVictory() {
            player.dungeonProgress.forest = {
                campaignCycle: 1, stage: 0, enemiesDefeated: 1
            };
            return gameState.save();
        },
        updateMainMenu() {},
        showNotification() {}
    };

    battle.isActive = true;
    battle.currentEnemy = {
        id: 'atomicity_test_enemy',
        health: 0,
        expReward: 10,
        goldReward: 5,
        miniBoss: false,
        elite: false
    };
    battle.isBossBattle = false;
    battle.isLocationBattle = true;

    t.after(() => {
        gameState.save = previousSave;
        battle.isActive = previousBattle.isActive;
        battle.currentEnemy = previousBattle.currentEnemy;
        battle.isBossBattle = previousBattle.isBossBattle;
        battle.isLocationBattle = previousBattle.isLocationBattle;
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
    });

    battleVictory();

    assert.deepEqual(questSaveFlags, [false, false, false, false]);
    assert.deepEqual(achievementSaveFlags, [false]);
    assert.deepEqual(levelUpSaveFlags, [false]);
    assert.equal(saveCount, 1, 'only the dungeon handler commits the reward and resume marker');
});
