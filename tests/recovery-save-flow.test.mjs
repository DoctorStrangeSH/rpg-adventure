import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG } from '../js/config/constants.js';
import { gameState } from '../js/core/state.js';
import { RECOVERY_SAVE_KEY, Storage } from '../js/core/storage.js';
import { LOCATIONS, getLocation } from '../js/data/locations.js';
import { battleDefeat, battleVictory, exitBattle, getBattleState, playerAttack, playerDefend, playerSkill } from '../js/ui/battle.js';
import { getLocationState, resetLocationState, completeLocation, handleBossVictory, handleDefeat, handleVictory, startBossFight, startLocation, startStageBattle } from '../js/systems/dungeon.js';
import { getBossPhase, tickEnemyEffects } from '../js/systems/combat.js';
import { canStartNewGamePlus, completeCampaign, prepareNewGamePlus, startNewGamePlus } from '../js/systems/newGamePlus.js';

function setup(t, options = {}) {
    const previousStorage = globalThis.localStorage;
    const previousPlayer = gameState.player;
    const previousAnimationFrame = globalThis.requestAnimationFrame;
    const values = new Map();
    globalThis.requestAnimationFrame = () => 0;
    globalThis.localStorage = {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) {
            if (options.failActiveWrite && key === GAME_CONFIG.saveKey) throw new Error('QuotaExceededError');
            values.set(key, value);
        },
        removeItem(key) { values.delete(key); }
    };
    gameState.player = null;
    t.after(() => {
        gameState.player = previousPlayer;
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
        if (previousAnimationFrame === undefined) delete globalThis.requestAnimationFrame;
        else globalThis.requestAnimationFrame = previousAnimationFrame;
    });
    return values;
}

test('valid recovery can be previewed and restored in the current schema without changing the backup', (t) => {
    const values = setup(t);
    const recovery = JSON.stringify({
        player: {
            id: 7, class: 'warrior', username: 'Recovered Hero',
            level: 14, experience: 35, gold: 920,
            inventory: [{ id: 'health_potion', quantity: 6 }],
            equipment: { weapon: 'iron_sword', armor: null }
        }
    });
    values.set(RECOVERY_SAVE_KEY, recovery);
    values.set(GAME_CONFIG.saveKey, '{broken');

    assert.equal(gameState.canRestoreRecovery(), true);
    assert.equal(gameState.player, null);
    assert.equal(gameState.restoreRecovery(), true);
    assert.equal(gameState.player.username, 'Recovered Hero');
    assert.equal(gameState.player.level, 14);
    assert.equal(gameState.player.gold, 920);
    assert.equal(gameState.player.inventory[0].quantity, 6);
    assert.equal(values.get(RECOVERY_SAVE_KEY), recovery);

    const active = JSON.parse(values.get(GAME_CONFIG.saveKey));
    assert.equal(active.schemaVersion, 2);
    assert.equal(active.player.username, 'Recovered Hero');
    assert.equal(gameState.load(), true);
    assert.equal(gameState.player.gold, 920);
});

test('future-version and malformed recovery copies are not offered or restored', (t) => {
    const values = setup(t);
    const future = JSON.stringify({
        schemaVersion: 99,
        player: { class: 'warrior', level: 99, futureProgress: true }
    });
    values.set(RECOVERY_SAVE_KEY, future);
    values.set(GAME_CONFIG.saveKey, '{broken');

    assert.equal(gameState.canRestoreRecovery(), false);
    assert.equal(gameState.restoreRecovery(), false);
    assert.equal(values.get(GAME_CONFIG.saveKey), '{broken');
    assert.equal(values.get(RECOVERY_SAVE_KEY), future);

    values.set(RECOVERY_SAVE_KEY, '{invalid-json');
    assert.equal(gameState.canRestoreRecovery(), false);
    assert.equal(gameState.restoreRecovery(), false);
    assert.equal(values.get(GAME_CONFIG.saveKey), '{broken');
});

test('failed recovery write leaves both the current save and recovery copy untouched', (t) => {
    const values = setup(t, { failActiveWrite: true });
    const recovery = JSON.stringify({
        schemaVersion: 2,
        player: { class: 'mage', username: 'Safe Backup', level: 8 }
    });
    const current = '{damaged-current-save';
    values.set(RECOVERY_SAVE_KEY, recovery);
    values.set(GAME_CONFIG.saveKey, current);

    assert.equal(gameState.canRestoreRecovery(), true);
    assert.equal(gameState.restoreRecovery(), false);
    assert.equal(gameState.player, null);
    assert.equal(values.get(GAME_CONFIG.saveKey), current);
    assert.equal(values.get(RECOVERY_SAVE_KEY), recovery);
});

test('recovery validation does not mutate the stored backup or active profile', (t) => {
    const values = setup(t);
    const recovery = JSON.stringify({
        schemaVersion: 1,
        player: { class: 'archer', level: 5, inventory: [{ id: 'health_potion', quantity: 2 }] }
    });
    values.set(RECOVERY_SAVE_KEY, recovery);
    const activePlayer = gameState.createPlayer('mage');
    const activeBefore = structuredClone(activePlayer);

    assert.equal(gameState.canRestoreRecovery(), true);
    assert.deepEqual(gameState.player, activeBefore);
    assert.equal(values.get(RECOVERY_SAVE_KEY), recovery);
});


test('recovery restores NG+ progression, equipment upgrades, runes, claims and expedition resume state across reload', (t) => {
    const values = setup(t);
    const player = gameState.createPlayer('warrior');
    Object.assign(player, {
        level: 18,
        experience: 35,
        gold: 1250,
        campaignCycle: 2,
        completedCampaignCycles: 1,
        lastCompletedCampaignCycle: 1,
        campaignCompleted: false,
        newGamePlusUnlocked: true,
        inventory: [
            { id: 'iron_sword', quantity: 1 },
            { id: 'health_potion', quantity: 4 },
            { id: 'ember_core', quantity: 2 }
        ],
        equipment: { weapon: 'iron_sword', armor: 'leather_armor' },
        itemUpgrades: { iron_sword: 8, leather_armor: 4 },
        weaponRunes: { iron_sword: ['flame', 'blood'] },
        unlockedLocations: ['forest'],
        locationRewardCycles: { forest: 2, mountains: 1 },
        deepChestRewardCycles: { 'forest:20': 2 },
        dungeonProgress: {
            forest: {
                campaignCycle: 2,
                stage: 0,
                enemiesDefeated: 1,
                visitedEventStages: [0],
                visitedRouteStages: [0],
                routeChoices: { 0: 'safe' },
                checkedSecretStages: [],
                visitedCheckpointStages: [],
                claimedDeepChestStages: [],
                claimedUnbrokenBonusStages: [],
                resumedFromCheckpoint: true,
                travelerFavorFights: 2,
                travelerReturnPending: false,
                bloodPursuerPending: true,
                finalBossDefeated: false
            }
        },
        stats: { kills: 300, battles: 400, wins: 350, losses: 5, dungeonsCompleted: 4, bossesKilled: 18 }
    });
    player.quests.find(entry => entry.id === 'first_blood').rewardClaimed = true;
    player.achievements.find(entry => entry.id === 'first_kill').claimed = true;

    const recovery = JSON.stringify({ schemaVersion: 2, player });
    values.set(RECOVERY_SAVE_KEY, recovery);
    values.set(GAME_CONFIG.saveKey, '{damaged-primary-save');

    assert.equal(gameState.canRestoreRecovery(), true);
    assert.equal(gameState.restoreRecovery(), true);
    assert.equal(gameState.save(), true);
    assert.equal(gameState.load(), true);

    const restored = gameState.player;
    assert.equal(restored.campaignCycle, 2);
    assert.equal(restored.completedCampaignCycles, 1);
    assert.equal(restored.newGamePlusUnlocked, true);
    assert.equal(restored.campaignCompleted, false);
    assert.deepEqual(restored.itemUpgrades, { iron_sword: 8, leather_armor: 4 });
    assert.deepEqual(restored.weaponRunes, { iron_sword: ['flame', 'blood'] });
    assert.deepEqual(restored.locationRewardCycles, { forest: 2, mountains: 1 });
    assert.deepEqual(restored.deepChestRewardCycles, { 'forest:20': 2 });
    assert.deepEqual(restored.dungeonProgress.forest, {
        campaignCycle: 2,
        stage: 0,
        enemiesDefeated: 1,
        visitedEventStages: [0],
        visitedRouteStages: [0],
        routeChoices: { 0: 'safe' },
        checkedSecretStages: [],
        visitedCheckpointStages: [],
        claimedDeepChestStages: [],
        claimedUnbrokenBonusStages: [],
        resumedFromCheckpoint: true,
        travelerFavorFights: 2,
        travelerReturnPending: false,
        bloodPursuerPending: true,
        finalBossDefeated: false,
        pendingAdventureEventId: null,
        pendingSecretRoomId: null,
        activeEncounter: null
    });
    assert.equal(restored.quests.find(entry => entry.id === 'first_blood').rewardClaimed, true);
    assert.equal(restored.achievements.find(entry => entry.id === 'first_kill').claimed, true);
    assert.equal(restored.stats.bossesKilled, 18);
    assert.equal(values.get(RECOVERY_SAVE_KEY), recovery,
        'restoration and subsequent save must not consume or rewrite the recovery copy');
});


test('recovered regional reward claims prevent duplicate items, gold and experience', (t) => {
    const values = setup(t);
    const previousWindow = globalThis.window;
    const previousTimeout = globalThis.setTimeout;
    globalThis.window = {
        showNotification() {},
        updateMainMenu() {},
        updateMapScreen() {},
        exitBattle() {},
        showScreen() {}
    };
    globalThis.setTimeout = callback => { callback(); return 1; };
    t.after(() => {
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        globalThis.setTimeout = previousTimeout;
        resetLocationState();
        const battle = getBattleState();
        battle.isActive = false;
        battle.currentEnemy = null;
    });

    const player = gameState.createPlayer('warrior');
    const location = getLocation('forest');
    const run = getLocationState();
    run.currentLocation = location;
    run.currentStage = location.stages.length - 1;
    run.inLocation = true;
    run.finalBossDefeated = false;

    assert.equal(completeLocation(), true, 'first clear must commit the guaranteed reward');
    const rewardSnapshot = {
        gold: player.gold,
        experience: player.experience,
        inventory: structuredClone(player.inventory),
        claimCycle: player.locationRewardCycles.forest
    };
    assert.equal(rewardSnapshot.claimCycle, player.campaignCycle);

    const recovery = values.get(GAME_CONFIG.saveKey);
    assert.ok(recovery);
    values.set(RECOVERY_SAVE_KEY, recovery);
    values.set(GAME_CONFIG.saveKey, '{damaged-primary-after-crash');
    gameState.player = null;

    assert.equal(gameState.canRestoreRecovery(), true);
    assert.equal(gameState.restoreRecovery(), true);
    assert.equal(gameState.player.locationRewardCycles.forest, rewardSnapshot.claimCycle);

    const restoredPlayer = gameState.player;
    run.currentLocation = location;
    run.currentStage = location.stages.length - 1;
    run.inLocation = true;
    run.finalBossDefeated = false;

    assert.equal(completeLocation(), true, 'a replayed region clear may complete, but must not regrant its cycle reward');
    assert.equal(restoredPlayer.gold, rewardSnapshot.gold);
    assert.equal(restoredPlayer.experience, rewardSnapshot.experience);
    assert.deepEqual(restoredPlayer.inventory, rewardSnapshot.inventory);
    assert.equal(restoredPlayer.locationRewardCycles.forest, rewardSnapshot.claimCycle);
    assert.equal(values.get(RECOVERY_SAVE_KEY), recovery, 'the recovery snapshot must remain unchanged');
});


test('recovery restore resumes the exact active expedition boss encounter', (t) => {
    const values = setup(t);
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousTimeout = globalThis.setTimeout;
    const battle = getBattleState();
    const previousBattle = {
        isActive: battle.isActive,
        currentEnemy: battle.currentEnemy,
        isBossBattle: battle.isBossBattle,
        isLocationBattle: battle.isLocationBattle,
        isDungeonBattle: battle.isDungeonBattle,
        turn: battle.turn,
        guardReduction: battle.guardReduction,
        relicEffects: structuredClone(battle.relicEffects)
    };
    globalThis.window = {
        showScreen() {},
        showNotification() {},
        updateMainMenu() {},
        updateMapScreen() {},
        exitBattle() {},
        showBattleMessage() {}
    };
    globalThis.document = { getElementById() { return { innerHTML: '' }; } };
    globalThis.setTimeout = () => 0;
    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;

    t.after(() => {
        exitBattle();
        resetLocationState();
        Object.assign(battle, previousBattle);
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        globalThis.setTimeout = previousTimeout;
    });

    const player = gameState.createPlayer('warrior');
    player.level = 18;
    player.unlockedLocations = ['forest'];
    const location = getLocation('forest');
    location.unlocked = true;
    const encounter = {
        enemy: {
            id: 'forest_guardian',
            name: 'Страж леса',
            health: 437,
            maxHealth: 900,
            attack: 52,
            defense: 18,
            behavior: 'boss',
            intent: 'heavy',
            phase: 2,
            effects: { burnTurns: 2, poisonTurns: 1 },
            archerMarks: 1,
            adaptiveResistance: { type: 'fire', turns: 2 }
        },
        isBossBattle: true,
        turn: 'player',
        guardReduction: 0.75,
        relicEffects: { phoenixRebirthUsed: true }
    };
    player.dungeonProgress = {
        forest: {
            campaignCycle: player.campaignCycle,
            stage: 8,
            enemiesDefeated: location.stages[8].enemiesCount,
            activeEncounter: structuredClone(encounter)
        }
    };

    const recovery = JSON.stringify({ schemaVersion: 2, player });
    values.set(RECOVERY_SAVE_KEY, recovery);
    values.set(GAME_CONFIG.saveKey, '{damaged-primary-before-recovery}');

    assert.equal(gameState.canRestoreRecovery(), true);
    assert.equal(gameState.restoreRecovery(), true);
    assert.deepEqual(gameState.player.dungeonProgress.forest.activeEncounter, encounter);
    assert.equal(values.get(RECOVERY_SAVE_KEY), recovery);

    startLocation('forest');
    assert.equal(getLocationState().activeEncounter.enemy.health, 437);
    startStageBattle();

    assert.equal(battle.isActive, true);
    assert.equal(battle.isBossBattle, true);
    assert.equal(battle.isLocationBattle, true);
    assert.equal(battle.isDungeonBattle, true);
    assert.equal(battle.turn, 'player');
    assert.equal(battle.guardReduction, 0.75);
    assert.deepEqual(battle.relicEffects, { phoenixRebirthUsed: true });
    assert.equal(battle.currentEnemy.id, 'forest_guardian');
    assert.equal(battle.currentEnemy.health, 437);
    assert.equal(battle.currentEnemy.intent, 'heavy');
    assert.equal(battle.currentEnemy.phase, 2);
    assert.deepEqual(battle.currentEnemy.effects, { burnTurns: 2, poisonTurns: 1 });
    assert.deepEqual(battle.currentEnemy.adaptiveResistance, { type: 'fire', turns: 2 });
    assert.equal(values.get(RECOVERY_SAVE_KEY), recovery,
        'resuming the recovered encounter must not consume or rewrite the backup');
});


test('a malformed active encounter in recovery is discarded without losing expedition progress', (t) => {
    const values = setup(t);
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousTimeout = globalThis.setTimeout;
    const battle = getBattleState();
    const previousBattle = { isActive: battle.isActive, currentEnemy: battle.currentEnemy };
    globalThis.window = {
        showScreen() {}, showNotification() {}, updateMainMenu() {},
        updateMapScreen() {}, exitBattle() {}, showBattleMessage() {},
        updateBattleUI() {}, animateBattle() {}
    };
    globalThis.document = { getElementById() { return { innerHTML: '' }; } };
    globalThis.setTimeout = () => 0;
    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    t.after(() => {
        resetLocationState();
        battle.isActive = previousBattle.isActive;
        battle.currentEnemy = previousBattle.currentEnemy;
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        globalThis.setTimeout = previousTimeout;
    });

    const player = gameState.createPlayer('warrior');
    player.unlockedLocations = ['forest'];
    const location = getLocation('forest');
    location.unlocked = true;
    player.dungeonProgress = {
        forest: {
            campaignCycle: player.campaignCycle,
            stage: 0,
            enemiesDefeated: 0,
            visitedEventStages: [],
            visitedRouteStages: [],
            routeChoices: {},
            checkedSecretStages: [],
            visitedCheckpointStages: [],
            claimedDeepChestStages: [],
            claimedUnbrokenBonusStages: [],
            activeEncounter: {
                enemy: {
                    id: 'forest_guardian', name: 'Страж леса', health: 901,
                    maxHealth: 900, attack: 52, defense: 18
                },
                isBossBattle: true, turn: 'enemy', guardReduction: 0.75,
                relicEffects: { phoenixRebirthUsed: true }
            }
        }
    };
    const recovery = JSON.stringify({ schemaVersion: 2, player });
    values.set(RECOVERY_SAVE_KEY, recovery);
    values.set(GAME_CONFIG.saveKey, '{damaged-primary}');

    assert.equal(gameState.canRestoreRecovery(), true);
    assert.equal(gameState.restoreRecovery(), true);
    assert.equal(gameState.player.dungeonProgress.forest.stage, 0);
    assert.equal(gameState.player.dungeonProgress.forest.activeEncounter, null,
        'invalid nested combat data must be discarded during save normalization');

    startLocation('forest');
    assert.equal(getLocationState().currentStage, 0);
    assert.equal(getLocationState().inLocation, true);
    startStageBattle();
    assert.equal(battle.isActive, true, 'the valid expedition must remain playable');
    assert.ok(battle.currentEnemy, 'a fresh encounter should be generated for the preserved stage');
    assert.equal(values.get(RECOVERY_SAVE_KEY), recovery,
        'discarding invalid nested encounter data must not rewrite the recovery copy');
});

test('a malformed primary save never replaces the active in-memory profile during reload', (t) => {
    const values = setup(t);
    const activePlayer = gameState.createPlayer('archer');
    Object.assign(activePlayer, {
        username: 'Current Hero',
        level: 23,
        gold: 1840,
        campaignCycle: 2,
        newGamePlusUnlocked: true
    });
    const activeBefore = structuredClone(activePlayer);
    const damagedPrimary = '{truncated-after-browser-crash';
    values.set(GAME_CONFIG.saveKey, damagedPrimary);

    assert.equal(gameState.load(), false);
    assert.deepEqual(gameState.player, activeBefore);
    assert.equal(values.get(GAME_CONFIG.saveKey), damagedPrimary);
});


test('a committed player defence restores as the pending enemy turn after reload', (t) => {
    const values = setup(t);
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousTimeout = globalThis.setTimeout;
    const battle = getBattleState();
    const previousBattle = {
        isActive: battle.isActive,
        currentEnemy: battle.currentEnemy,
        isBossBattle: battle.isBossBattle,
        isLocationBattle: battle.isLocationBattle,
        isDungeonBattle: battle.isDungeonBattle,
        turn: battle.turn,
        guardReduction: battle.guardReduction,
        relicEffects: structuredClone(battle.relicEffects)
    };
    const scheduled = [];
    globalThis.window = {
        showScreen() {}, showNotification() {}, updateMainMenu() {},
        updateMapScreen() {}, exitBattle() {}, showBattleMessage() {},
        getLocationState,
        resetLocationState,
        startStageBattle
    };
    globalThis.document = {
        getElementById(id) { return id === 'battle-ui' ? { innerHTML: '' } : null; },
        querySelector() { return null; },
        querySelectorAll() { return []; }
    };
    globalThis.setTimeout = callback => { scheduled.push(callback); return scheduled.length; };
    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    t.after(() => {
        exitBattle();
        resetLocationState();
        Object.assign(battle, previousBattle);
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        globalThis.setTimeout = previousTimeout;
    });

    const player = gameState.createPlayer('warrior');
    player.unlockedLocations = ['forest'];
    getLocation('forest').unlocked = true;
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();
    assert.equal(battle.isActive, true);
    const enemyId = battle.currentEnemy.id;
    const enemyHealth = battle.currentEnemy.health;

    playerDefend();

    assert.equal(battle.turn, 'enemy');
    assert.equal(battle.guardReduction > 0, true);
    const committed = Storage.load().player.dungeonProgress.forest.activeEncounter;
    assert.equal(committed.enemy.id, enemyId);
    assert.equal(committed.enemy.health, enemyHealth);
    assert.equal(committed.turn, 'enemy');
    assert.equal(committed.guardReduction, battle.guardReduction);
    assert.equal(scheduled.length, 1, 'the original enemy-turn timer is pending');

    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    assert.equal(gameState.load(), true);
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();

    assert.equal(battle.isActive, true);
    assert.equal(battle.currentEnemy.id, enemyId);
    assert.equal(battle.currentEnemy.health, enemyHealth);
    assert.equal(battle.turn, 'enemy');
    assert.equal(battle.guardReduction, committed.guardReduction);
    assert.equal(scheduled.length, 2,
        'reload schedules one resumed enemy turn, rather than replaying the player action');
    assert.equal(values.has(RECOVERY_SAVE_KEY), false,
        'ordinary reload does not fabricate a recovery copy');
});


test('a committed player attack restores the damaged enemy and pending enemy turn after reload', (t) => {
    const values = setup(t);
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousTimeout = globalThis.setTimeout;
    const previousRandom = Math.random;
    const battle = getBattleState();
    const previousBattle = {
        isActive: battle.isActive,
        currentEnemy: battle.currentEnemy,
        playerSprite: battle.playerSprite,
        enemySprite: battle.enemySprite,
        isBossBattle: battle.isBossBattle,
        isLocationBattle: battle.isLocationBattle,
        isDungeonBattle: battle.isDungeonBattle,
        turn: battle.turn,
        guardReduction: battle.guardReduction,
        relicEffects: structuredClone(battle.relicEffects)
    };
    const scheduled = [];
    globalThis.window = {
        showScreen() {}, showNotification() {}, updateMainMenu() {},
        updateMapScreen() {}, exitBattle() {}, showBattleMessage() {},
        getLocationState, resetLocationState, startStageBattle,
        updateQuestProgress() {}, updateAchievements() {}
    };
    globalThis.document = {
        getElementById(id) { return id === 'battle-ui' ? { innerHTML: '' } : null; },
        querySelector() { return null; },
        querySelectorAll() { return []; }
    };
    globalThis.setTimeout = callback => { scheduled.push(callback); return scheduled.length; };
    Math.random = () => 0.99;
    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    t.after(() => {
        exitBattle();
        resetLocationState();
        Object.assign(battle, previousBattle);
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        globalThis.setTimeout = previousTimeout;
        Math.random = previousRandom;
    });

    const player = gameState.createPlayer('warrior');
    player.unlockedLocations = ['forest'];
    getLocation('forest').unlocked = true;
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();
    assert.equal(battle.isActive, true);
    const enemyId = battle.currentEnemy.id;
    const enemyHealthBefore = battle.currentEnemy.health;

    playerAttack();

    assert.equal(battle.isActive, true);
    assert.ok(battle.currentEnemy.health < enemyHealthBefore,
        'the real attack must reduce the active enemy HP');
    assert.equal(battle.turn, 'enemy');
    const savedEncounter = Storage.load().player.dungeonProgress.forest.activeEncounter;
    assert.equal(savedEncounter.enemy.id, enemyId);
    assert.equal(savedEncounter.enemy.health, battle.currentEnemy.health);
    assert.equal(savedEncounter.turn, 'enemy');
    assert.equal(scheduled.length, 1, 'the original enemy-turn delay is pending');

    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    battle.playerSprite = null;
    battle.enemySprite = null;
    assert.equal(gameState.load(), true);
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();

    assert.equal(battle.isActive, true);
    assert.equal(battle.currentEnemy.id, enemyId);
    assert.equal(battle.currentEnemy.health, savedEncounter.enemy.health);
    assert.equal(battle.turn, 'enemy');
    assert.equal(scheduled.length, 2,
        'reload schedules exactly one resumed enemy turn without replaying the player attack');
});


test('a committed mage fireball restores mana, enemy HP and burn without replaying the skill', (t) => {
    const values = setup(t);
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousTimeout = globalThis.setTimeout;
    const previousRandom = Math.random;
    const battle = getBattleState();
    const previousBattle = {
        isActive: battle.isActive, currentEnemy: battle.currentEnemy,
        playerSprite: battle.playerSprite, enemySprite: battle.enemySprite,
        isBossBattle: battle.isBossBattle, isLocationBattle: battle.isLocationBattle,
        isDungeonBattle: battle.isDungeonBattle, turn: battle.turn,
        guardReduction: battle.guardReduction, relicEffects: structuredClone(battle.relicEffects)
    };
    const scheduled = [];
    globalThis.window = {
        showScreen() {}, showNotification() {}, updateMainMenu() {}, updateMapScreen() {},
        exitBattle() {}, showBattleMessage() {}, getLocationState, resetLocationState,
        startStageBattle, updateQuestProgress() {}, updateAchievements() {}
    };
    globalThis.document = {
        getElementById(id) { return id === 'battle-ui' ? { innerHTML: '' } : null; },
        querySelector() { return null; },
        querySelectorAll() { return []; }
    };
    globalThis.setTimeout = callback => { scheduled.push(callback); return scheduled.length; };
    Math.random = () => 0.99;
    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    t.after(() => {
        exitBattle();
        resetLocationState();
        Object.assign(battle, previousBattle);
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        globalThis.setTimeout = previousTimeout;
        Math.random = previousRandom;
    });

    const player = gameState.createPlayer('mage');
    player.unlockedLocations = ['forest'];
    getLocation('forest').unlocked = true;
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();
    assert.equal(battle.isActive, true);
    battle.playerSprite = { isAttacking: false };
    battle.enemySprite = { receiveHit() {} };
    const enemyId = battle.currentEnemy.id;
    const healthBefore = battle.currentEnemy.health;
    const manaBefore = player.mana;

    playerSkill('fireball');

    assert.equal(battle.isActive, true);
    assert.equal(battle.turn, 'enemy');
    assert.equal(player.mana, manaBefore - 20);
    assert.ok(battle.currentEnemy.health < healthBefore, 'fireball must deal damage');
    assert.ok(battle.currentEnemy.effects?.burnTurns > 0, 'fireball burn must be applied');
    const saved = Storage.load().player;
    const savedEncounter = saved.dungeonProgress.forest.activeEncounter;
    assert.equal(saved.mana, player.mana);
    assert.equal(savedEncounter.enemy.id, enemyId);
    assert.equal(savedEncounter.enemy.health, battle.currentEnemy.health);
    assert.equal(savedEncounter.enemy.effects.burnTurns, battle.currentEnemy.effects.burnTurns);
    assert.equal(savedEncounter.turn, 'enemy');
    assert.equal(scheduled.length, 1, 'the original enemy-turn delay is pending');

    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    battle.playerSprite = null;
    battle.enemySprite = null;
    assert.equal(gameState.load(), true);
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();

    assert.equal(battle.isActive, true);
    assert.equal(battle.currentEnemy.id, enemyId);
    assert.equal(battle.currentEnemy.health, savedEncounter.enemy.health);
    assert.equal(battle.currentEnemy.effects.burnTurns, savedEncounter.enemy.effects.burnTurns);
    assert.equal(gameState.player.mana, manaBefore - 20);
    assert.equal(battle.turn, 'enemy');
    assert.equal(scheduled.length, 2,
        'reload schedules one enemy turn and does not replay the mana cost or fireball');
    assert.equal(values.has(RECOVERY_SAVE_KEY), false);
});


test('a committed frost nova restores freeze and thermal shock without replaying damage or burn', (t) => {
    setup(t);
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousTimeout = globalThis.setTimeout;
    const previousRandom = Math.random;
    const battle = getBattleState();
    const previousBattle = {
        isActive: battle.isActive, currentEnemy: battle.currentEnemy,
        playerSprite: battle.playerSprite, enemySprite: battle.enemySprite,
        isBossBattle: battle.isBossBattle, isLocationBattle: battle.isLocationBattle,
        isDungeonBattle: battle.isDungeonBattle, turn: battle.turn,
        guardReduction: battle.guardReduction, relicEffects: structuredClone(battle.relicEffects)
    };
    const scheduled = [];
    globalThis.window = {
        showScreen() {}, showNotification() {}, updateMainMenu() {}, updateMapScreen() {},
        exitBattle() {}, showBattleMessage() {}, getLocationState, resetLocationState,
        startStageBattle, updateQuestProgress() {}, updateAchievements() {}
    };
    globalThis.document = {
        getElementById(id) { return id === 'battle-ui' ? { innerHTML: '' } : null; },
        querySelector() { return null; },
        querySelectorAll() { return []; }
    };
    globalThis.setTimeout = callback => { scheduled.push(callback); return scheduled.length; };
    Math.random = () => 0.99;
    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    t.after(() => {
        exitBattle();
        resetLocationState();
        Object.assign(battle, previousBattle);
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        globalThis.setTimeout = previousTimeout;
        Math.random = previousRandom;
    });

    const player = gameState.createPlayer('mage');
    player.unlockedLocations = ['forest'];
    getLocation('forest').unlocked = true;
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();
    assert.equal(battle.isActive, true);
    battle.playerSprite = { isAttacking: false };
    battle.enemySprite = { receiveHit() {} };
    const enemy = battle.currentEnemy;
    enemy.intent = 'heavy';
    enemy.effects = { burnTurns: 2 };
    enemy.resistances = { freeze: 0 };
    const enemyId = enemy.id;
    const healthBefore = enemy.health;
    const manaBefore = player.mana;
    const playerHealthBefore = player.health;

    playerSkill('frost_nova');

    assert.equal(battle.isActive, true);
    assert.equal(battle.turn, 'enemy');
    assert.equal(player.mana, manaBefore - 25);
    assert.ok(enemy.health < healthBefore, 'frost nova and thermal shock must deal damage');
    assert.ok(enemy.effects?.freezeTurns > 0, 'frost nova must apply freeze');
    assert.equal(enemy.effects.burnTurns, 0, 'thermal shock consumes the existing burn');
    assert.equal(enemy.intent, 'heavy', 'the wind-up is interrupted when the frozen enemy turn resolves');
    const saved = Storage.load().player;
    const savedEncounter = saved.dungeonProgress.forest.activeEncounter;
    assert.equal(saved.mana, manaBefore - 25);
    assert.equal(savedEncounter.enemy.id, enemyId);
    assert.equal(savedEncounter.enemy.health, enemy.health);
    assert.equal(savedEncounter.enemy.effects.freezeTurns, enemy.effects.freezeTurns);
    assert.equal(savedEncounter.enemy.effects.burnTurns, 0);
    assert.equal(savedEncounter.enemy.intent, 'heavy');
    assert.equal(savedEncounter.turn, 'enemy');
    assert.equal(scheduled.length, 1, 'the original skill continuation is pending');

    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    battle.playerSprite = null;
    battle.enemySprite = null;
    assert.equal(gameState.load(), true);
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();

    assert.equal(battle.isActive, true);
    assert.equal(battle.currentEnemy.id, enemyId);
    assert.equal(battle.currentEnemy.health, savedEncounter.enemy.health);
    assert.equal(battle.currentEnemy.effects.freezeTurns, savedEncounter.enemy.effects.freezeTurns);
    assert.equal(battle.currentEnemy.effects.burnTurns, 0);
    assert.equal(battle.currentEnemy.intent, 'heavy');
    assert.equal(gameState.player.mana, manaBefore - 25);
    assert.equal(battle.turn, 'enemy');
    assert.equal(scheduled.length, 2, 'reload schedules the frozen enemy turn exactly once');

    scheduled[1]();

    assert.equal(battle.isActive, true);
    assert.equal(battle.turn, 'player', 'the frozen enemy turn is skipped and returns control to the player');
    assert.equal(battle.currentEnemy.intent, null, 'the prepared heavy attack is cancelled');
    assert.equal(battle.currentEnemy.effects.freezeTurns, 0, 'the restored freeze is consumed once');
    assert.equal(battle.currentEnemy.effects.burnTurns, 0, 'thermal shock is not applied a second time');
    assert.equal(battle.currentEnemy.health, savedEncounter.enemy.health,
        'resuming the frozen turn does not repeat frost nova or thermal shock damage');
    assert.equal(gameState.player.health, playerHealthBefore,
        'the interrupted enemy wind-up does not damage the player');
});


test('a committed warrior power strike restores weaken and mana without replaying the skill', (t) => {
    setup(t);
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousTimeout = globalThis.setTimeout;
    const previousRandom = Math.random;
    const battle = getBattleState();
    const previousBattle = {
        isActive: battle.isActive, currentEnemy: battle.currentEnemy,
        playerSprite: battle.playerSprite, enemySprite: battle.enemySprite,
        isBossBattle: battle.isBossBattle, isLocationBattle: battle.isLocationBattle,
        isDungeonBattle: battle.isDungeonBattle, turn: battle.turn,
        guardReduction: battle.guardReduction, relicEffects: structuredClone(battle.relicEffects)
    };
    const scheduled = [];
    globalThis.window = {
        showScreen() {}, showNotification() {}, updateMainMenu() {}, updateMapScreen() {},
        exitBattle() {}, showBattleMessage() {}, getLocationState, resetLocationState,
        startStageBattle, updateQuestProgress() {}, updateAchievements() {}
    };
    globalThis.document = {
        getElementById(id) { return id === 'battle-ui' ? { innerHTML: '' } : null; },
        querySelector() { return null; },
        querySelectorAll() { return []; }
    };
    globalThis.setTimeout = callback => { scheduled.push(callback); return scheduled.length; };
    Math.random = () => 0.99;
    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    t.after(() => {
        exitBattle();
        resetLocationState();
        Object.assign(battle, previousBattle);
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        globalThis.setTimeout = previousTimeout;
        Math.random = previousRandom;
    });

    const player = gameState.createPlayer('warrior');
    player.unlockedLocations = ['forest'];
    getLocation('forest').unlocked = true;
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();
    assert.equal(battle.isActive, true);
    battle.playerSprite = { isAttacking: false };
    battle.enemySprite = { receiveHit() {} };
    const enemyId = battle.currentEnemy.id;
    const healthBefore = battle.currentEnemy.health;
    const manaBefore = player.mana;

    playerSkill('power_strike');

    assert.equal(battle.isActive, true);
    assert.equal(battle.turn, 'player', 'the action commits before its delayed enemy turn starts');
    assert.equal(player.mana, manaBefore - 10);
    assert.ok(battle.currentEnemy.health < healthBefore, 'power strike must deal damage');
    assert.ok(battle.currentEnemy.effects?.weakenTurns > 0, 'power strike must apply weaken');
    const saved = Storage.load().player;
    const savedEncounter = saved.dungeonProgress.forest.activeEncounter;
    assert.equal(saved.mana, manaBefore - 10);
    assert.equal(savedEncounter.enemy.id, enemyId);
    assert.equal(savedEncounter.enemy.health, battle.currentEnemy.health);
    assert.equal(savedEncounter.enemy.effects.weakenTurns, battle.currentEnemy.effects.weakenTurns);
    assert.equal(savedEncounter.turn, 'player');
    assert.equal(scheduled.length, 1);

    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    battle.playerSprite = null;
    battle.enemySprite = null;
    assert.equal(gameState.load(), true);
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();

    assert.equal(battle.isActive, true);
    assert.equal(battle.currentEnemy.id, enemyId);
    assert.equal(battle.currentEnemy.health, savedEncounter.enemy.health);
    assert.equal(battle.currentEnemy.effects.weakenTurns, savedEncounter.enemy.effects.weakenTurns);
    assert.equal(gameState.player.mana, manaBefore - 10);
    assert.equal(battle.turn, 'player');
    assert.equal(scheduled.length, 1, 'reload does not replay the original delayed enemy turn');
});


test('a committed warrior shield wall restores guard reduction and mana after reload', (t) => {
    setup(t);
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousTimeout = globalThis.setTimeout;
    const battle = getBattleState();
    const previousBattle = {
        isActive: battle.isActive, currentEnemy: battle.currentEnemy,
        playerSprite: battle.playerSprite, enemySprite: battle.enemySprite,
        isBossBattle: battle.isBossBattle, isLocationBattle: battle.isLocationBattle,
        isDungeonBattle: battle.isDungeonBattle, turn: battle.turn,
        guardReduction: battle.guardReduction, relicEffects: structuredClone(battle.relicEffects)
    };
    const scheduled = [];
    globalThis.window = {
        showScreen() {}, showNotification() {}, updateMainMenu() {}, updateMapScreen() {},
        exitBattle() {}, showBattleMessage() {}, getLocationState, resetLocationState,
        startStageBattle, updateQuestProgress() {}, updateAchievements() {}
    };
    globalThis.document = {
        getElementById(id) { return id === 'battle-ui' ? { innerHTML: '' } : null; },
        querySelector() { return null; },
        querySelectorAll() { return []; }
    };
    globalThis.setTimeout = callback => { scheduled.push(callback); return scheduled.length; };
    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    t.after(() => {
        exitBattle();
        resetLocationState();
        Object.assign(battle, previousBattle);
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        globalThis.setTimeout = previousTimeout;
    });

    const player = gameState.createPlayer('warrior');
    player.unlockedLocations = ['forest'];
    getLocation('forest').unlocked = true;
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();
    assert.equal(battle.isActive, true);
    battle.playerSprite = { isAttacking: false };
    battle.enemySprite = { receiveHit() {} };
    const enemyId = battle.currentEnemy.id;
    const manaBefore = player.mana;

    playerSkill('shield_wall');

    assert.equal(player.mana, manaBefore - 15);
    assert.equal(battle.guardReduction, 0.75);
    const saved = Storage.load().player;
    const savedEncounter = saved.dungeonProgress.forest.activeEncounter;
    assert.equal(saved.mana, manaBefore - 15);
    assert.equal(savedEncounter.enemy.id, enemyId);
    assert.equal(savedEncounter.guardReduction, 0.75);
    assert.equal(savedEncounter.turn, 'player');
    assert.equal(scheduled.length, 1);

    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    battle.playerSprite = null;
    battle.enemySprite = null;
    assert.equal(gameState.load(), true);
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();

    assert.equal(battle.isActive, true);
    assert.equal(battle.currentEnemy.id, enemyId);
    assert.equal(battle.guardReduction, 0.75);
    assert.equal(gameState.player.mana, manaBefore - 15);
    assert.equal(battle.turn, 'player');
    assert.equal(scheduled.length, 1, 'reload does not replay the original skill continuation');
});


test('an archer basic shot persists its mark and rapid shot consumes it once after reload', (t) => {
    setup(t);
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousTimeout = globalThis.setTimeout;
    const previousRandom = Math.random;
    const battle = getBattleState();
    const previousBattle = {
        isActive: battle.isActive, currentEnemy: battle.currentEnemy,
        playerSprite: battle.playerSprite, enemySprite: battle.enemySprite,
        isBossBattle: battle.isBossBattle, isLocationBattle: battle.isLocationBattle,
        isDungeonBattle: battle.isDungeonBattle, turn: battle.turn,
        guardReduction: battle.guardReduction, relicEffects: structuredClone(battle.relicEffects)
    };
    const scheduled = [];
    globalThis.window = {
        showScreen() {}, showNotification() {}, updateMainMenu() {}, updateMapScreen() {},
        exitBattle() {}, showBattleMessage() {}, getLocationState, resetLocationState,
        startStageBattle, updateQuestProgress() {}, updateAchievements() {}
    };
    globalThis.document = {
        getElementById(id) { return id === 'battle-ui' ? { innerHTML: '' } : null; },
        querySelector() { return null; },
        querySelectorAll() { return []; }
    };
    globalThis.setTimeout = callback => { scheduled.push(callback); return scheduled.length; };
    Math.random = () => 0.99;
    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    t.after(() => {
        exitBattle();
        resetLocationState();
        Object.assign(battle, previousBattle);
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        globalThis.setTimeout = previousTimeout;
        Math.random = previousRandom;
    });

    const player = gameState.createPlayer('archer');
    player.unlockedLocations = ['forest'];
    getLocation('forest').unlocked = true;
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();
    battle.playerSprite = { isAttacking: false };
    battle.enemySprite = { receiveHit() {} };
    const enemyId = battle.currentEnemy.id;
    const healthBeforeShot = battle.currentEnemy.health;

    playerAttack();

    assert.equal(battle.turn, 'player', 'the dungeon attack snapshot is committed before its animation timer');
    assert.equal(battle.currentEnemy.archerMarks, 1);
    assert.ok(battle.currentEnemy.health < healthBeforeShot);
    const attackSave = Storage.load().player.dungeonProgress.forest.activeEncounter;
    assert.equal(attackSave.enemy.archerMarks, 1);
    assert.equal(attackSave.turn, 'player');

    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    battle.playerSprite = null;
    battle.enemySprite = null;
    assert.equal(gameState.load(), true);
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();
    assert.equal(battle.currentEnemy.id, enemyId);
    assert.equal(battle.currentEnemy.archerMarks, 1);
    const healthBeforeSkill = battle.currentEnemy.health;
    const manaBeforeSkill = gameState.player.mana;
    battle.playerSprite = { isAttacking: false };
    battle.enemySprite = { receiveHit() {} };

    playerSkill('rapid_shot');

    assert.equal(gameState.player.mana, manaBeforeSkill - 15);
    assert.ok(battle.currentEnemy.health < healthBeforeSkill, 'rapid shot must deal its two-hit damage');
    assert.equal(battle.currentEnemy.archerMarks, 0, 'the saved mark is consumed exactly once');
    assert.ok(battle.currentEnemy.effects?.bleedTurns > 0, 'rapid shot applies bleeding');
    const skillSave = Storage.load().player;
    const savedEncounter = skillSave.dungeonProgress.forest.activeEncounter;
    assert.equal(savedEncounter.enemy.id, enemyId);
    assert.equal(savedEncounter.enemy.archerMarks, 0);
    assert.equal(savedEncounter.enemy.effects.bleedTurns, battle.currentEnemy.effects.bleedTurns);
    assert.equal(savedEncounter.enemy.health, battle.currentEnemy.health);
    assert.equal(skillSave.mana, manaBeforeSkill - 15);

    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    battle.playerSprite = null;
    battle.enemySprite = null;
    assert.equal(gameState.load(), true);
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();
    assert.equal(battle.currentEnemy.id, enemyId);
    assert.equal(battle.currentEnemy.archerMarks, 0);
    assert.equal(battle.currentEnemy.effects.bleedTurns, savedEncounter.enemy.effects.bleedTurns);
    assert.equal(battle.currentEnemy.health, savedEncounter.enemy.health);
    assert.equal(gameState.player.mana, manaBeforeSkill - 15);
});

test('an archer poison arrow restores poison and bleeding synergy after reload', (t) => {
    setup(t);
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousTimeout = globalThis.setTimeout;
    const previousRandom = Math.random;
    const battle = getBattleState();
    const previousBattle = {
        isActive: battle.isActive, currentEnemy: battle.currentEnemy,
        playerSprite: battle.playerSprite, enemySprite: battle.enemySprite,
        isBossBattle: battle.isBossBattle, isLocationBattle: battle.isLocationBattle,
        isDungeonBattle: battle.isDungeonBattle, turn: battle.turn,
        guardReduction: battle.guardReduction, relicEffects: structuredClone(battle.relicEffects)
    };
    const scheduled = [];
    globalThis.window = {
        showScreen() {}, showNotification() {}, updateMainMenu() {}, updateMapScreen() {},
        exitBattle() {}, showBattleMessage() {}, getLocationState, resetLocationState,
        startStageBattle, updateQuestProgress() {}, updateAchievements() {}
    };
    globalThis.document = {
        getElementById(id) { return id === 'battle-ui' ? { innerHTML: '' } : null; },
        querySelector() { return null; },
        querySelectorAll() { return []; }
    };
    globalThis.setTimeout = callback => { scheduled.push(callback); return scheduled.length; };
    Math.random = () => 0.99;
    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    t.after(() => {
        exitBattle();
        resetLocationState();
        Object.assign(battle, previousBattle);
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        globalThis.setTimeout = previousTimeout;
        Math.random = previousRandom;
    });

    const player = gameState.createPlayer('archer');
    player.unlockedLocations = ['forest'];
    getLocation('forest').unlocked = true;
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();
    battle.playerSprite = { isAttacking: false };
    battle.enemySprite = { receiveHit() {} };
    const enemy = battle.currentEnemy;
    const enemyId = enemy.id;
    enemy.effects = { bleedTurns: 2 };
    const healthBefore = enemy.health;
    const manaBefore = player.mana;

    playerSkill('poison_arrow');

    assert.equal(player.mana, manaBefore - 20);
    assert.ok(enemy.health < healthBefore);
    assert.equal(enemy.effects.poisonTurns, 3);
    assert.equal(enemy.effects.bleedTurns, 2);
    const saved = Storage.load().player;
    const savedEncounter = saved.dungeonProgress.forest.activeEncounter;
    assert.equal(savedEncounter.enemy.id, enemyId);
    assert.equal(savedEncounter.enemy.effects.poisonTurns, 3);
    assert.equal(savedEncounter.enemy.effects.bleedTurns, 2);
    assert.equal(savedEncounter.enemy.health, enemy.health);

    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    battle.playerSprite = null;
    battle.enemySprite = null;
    assert.equal(gameState.load(), true);
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();
    assert.equal(battle.currentEnemy.id, enemyId);
    assert.equal(battle.currentEnemy.effects.poisonTurns, 3);
    assert.equal(battle.currentEnemy.effects.bleedTurns, 2);
    assert.equal(gameState.player.mana, manaBefore - 20);
    const tick = tickEnemyEffects(battle.currentEnemy);
    assert.ok(tick.poisonDamage > 0);
    assert.ok(tick.bleedDamage > 0);
    assert.ok(tick.woundPoisonDamage > 0,
        'the restored poison and bleeding both trigger their combined wound-poison damage');
});


test('a lethal saved encounter grants victory rewards exactly once when restored after reload', (t) => {
    setup(t);
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousTimeout = globalThis.setTimeout;
    const previousRandom = Math.random;
    const battle = getBattleState();
    const previousBattle = {
        isActive: battle.isActive, currentEnemy: battle.currentEnemy,
        playerSprite: battle.playerSprite, enemySprite: battle.enemySprite,
        isBossBattle: battle.isBossBattle, isLocationBattle: battle.isLocationBattle,
        isDungeonBattle: battle.isDungeonBattle, turn: battle.turn,
        guardReduction: battle.guardReduction, relicEffects: structuredClone(battle.relicEffects),
        pendingVictorySave: battle.pendingVictorySave, pendingDefeatSave: battle.pendingDefeatSave
    };
    const scheduled = [];
    globalThis.window = {
        showScreen() {}, showNotification() {}, updateMainMenu() {}, updateMapScreen() {},
        exitBattle() {}, showBattleMessage() {}, getLocationState, resetLocationState,
        startStageBattle, handleVictory, updateQuestProgress() {}, updateAchievements() {},
        levelUp() {}
    };
    globalThis.document = {
        getElementById(id) { return id === 'battle-ui' ? { innerHTML: '' } : null; },
        querySelector() { return null; },
        querySelectorAll() { return []; }
    };
    globalThis.setTimeout = callback => { scheduled.push(callback); return scheduled.length; };
    Math.random = () => 0.99;
    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    t.after(() => {
        exitBattle();
        resetLocationState();
        Object.assign(battle, previousBattle);
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        globalThis.setTimeout = previousTimeout;
        Math.random = previousRandom;
    });

    const player = gameState.createPlayer('warrior');
    player.unlockedLocations = ['forest'];
    player.attack = 999;
    player.gold = 500;
    getLocation('forest').unlocked = true;
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();
    assert.equal(battle.isActive, true);
    battle.playerSprite = { isAttacking: false };
    battle.enemySprite = { receiveHit() {} };
    battle.currentEnemy.health = 1;
    const enemyId = battle.currentEnemy.id;
    const expBefore = player.experience;
    const goldBefore = player.gold;
    const winsBefore = player.stats.wins;

    playerAttack();

    assert.equal(battle.currentEnemy.health, 0, 'the real attack commits the lethal enemy snapshot');
    const lethalSave = Storage.load().player;
    assert.equal(lethalSave.dungeonProgress.forest.activeEncounter.enemy.id, enemyId);
    assert.equal(lethalSave.dungeonProgress.forest.activeEncounter.enemy.health, 0);
    assert.equal(lethalSave.experience, expBefore, 'rewards are not paid before the victory transaction');
    assert.equal(scheduled.length, 1, 'the original animation callback has not run');

    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    battle.playerSprite = null;
    battle.enemySprite = null;
    assert.equal(gameState.load(), true);
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();

    assert.equal(battle.isActive, false, 'restoring a lethal encounter resolves the pending victory');
    assert.equal(gameState.player.stats.wins, winsBefore + 1);
    assert.equal(gameState.player.stats.kills, 1);
    assert.ok(gameState.player.experience > expBefore);
    assert.ok(gameState.player.gold > goldBefore);
    const committed = Storage.load().player.dungeonProgress.forest;
    assert.equal(committed.activeEncounter, null);
    assert.equal(committed.enemiesDefeated, 1);
    const rewardsAfterCommit = {
        experience: gameState.player.experience,
        gold: gameState.player.gold,
        wins: gameState.player.stats.wins,
        kills: gameState.player.stats.kills
    };

    battleVictory();
    assert.deepEqual({
        experience: gameState.player.experience,
        gold: gameState.player.gold,
        wins: gameState.player.stats.wins,
        kills: gameState.player.stats.kills
    }, rewardsAfterCommit, 'a duplicate victory callback cannot pay rewards twice');
    assert.equal(Storage.load().player.dungeonProgress.forest.enemiesDefeated, 1);
});


test('a lethal recovered boss advances the expedition and commits boss rewards exactly once', (t) => {
    setup(t);
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousTimeout = globalThis.setTimeout;
    const previousRandom = Math.random;
    const battle = getBattleState();
    const locationState = getLocationState();
    const previousBattle = {
        isActive: battle.isActive, currentEnemy: battle.currentEnemy,
        playerSprite: battle.playerSprite, enemySprite: battle.enemySprite,
        isBossBattle: battle.isBossBattle, isLocationBattle: battle.isLocationBattle,
        isDungeonBattle: battle.isDungeonBattle, turn: battle.turn,
        guardReduction: battle.guardReduction, relicEffects: structuredClone(battle.relicEffects),
        pendingVictorySave: battle.pendingVictorySave, pendingDefeatSave: battle.pendingDefeatSave
    };
    const scheduled = [];
    globalThis.window = {
        showScreen() {}, showNotification() {}, updateMainMenu() {}, updateMapScreen() {},
        exitBattle() {}, showBattleMessage() {}, getLocationState, resetLocationState,
        startStageBattle, handleBossVictory, updateQuestProgress() {}, updateAchievements() {},
        levelUp() {}
    };
    globalThis.document = {
        getElementById(id) { return id === 'battle-ui' ? { innerHTML: '' } : null; },
        querySelector() { return null; },
        querySelectorAll() { return []; }
    };
    globalThis.setTimeout = callback => { scheduled.push(callback); return scheduled.length; };
    Math.random = () => 0.99;
    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    t.after(() => {
        exitBattle();
        resetLocationState();
        Object.assign(battle, previousBattle);
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        globalThis.setTimeout = previousTimeout;
        Math.random = previousRandom;
    });

    const player = gameState.createPlayer('warrior');
    player.unlockedLocations = ['forest'];
    player.attack = 9999;
    player.gold = 500;
    getLocation('forest').unlocked = true;
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    const state = getLocationState();
    const location = state.currentLocation;
    const bossStageIndex = location.stages.findIndex(stage => stage.boss && !stage.boss.miniBoss);
    assert.ok(bossStageIndex >= 0);
    state.currentStage = bossStageIndex;
    state.enemiesDefeated = location.stages[bossStageIndex].enemiesCount;
    startBossFight(location.stages[bossStageIndex].boss);

    assert.equal(battle.isActive, true);
    assert.equal(battle.isBossBattle, true);
    battle.playerSprite = { isAttacking: false };
    battle.enemySprite = { receiveHit() {} };
    battle.currentEnemy.health = 1;
    const bossId = battle.currentEnemy.id;
    const expBefore = player.experience;
    const goldBefore = player.gold;
    const winsBefore = player.stats.wins;
    const bossKillsBefore = player.stats.bossesKilled || 0;

    playerAttack();

    assert.equal(battle.currentEnemy.health, 0);
    const lethalSave = Storage.load().player;
    assert.equal(lethalSave.dungeonProgress.forest.activeEncounter.enemy.id, bossId);
    assert.equal(lethalSave.dungeonProgress.forest.activeEncounter.isBossBattle, true);
    assert.equal(lethalSave.dungeonProgress.forest.activeEncounter.enemy.health, 0);
    assert.equal(lethalSave.experience, expBefore);
    assert.equal(scheduled.length, 1);

    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    battle.playerSprite = null;
    battle.enemySprite = null;
    assert.equal(gameState.load(), true);
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();

    const restored = Storage.load().player;
    assert.equal(getLocationState().currentStage, bossStageIndex + 1,
        'restored boss victory advances to the next stage');
    assert.equal(getLocationState().enemiesDefeated, 0);
    assert.equal(getLocationState().activeEncounter, null);
    assert.equal(restored.dungeonProgress.forest.activeEncounter, null);
    assert.equal(gameState.player.stats.wins, winsBefore + 1);
    assert.equal(gameState.player.stats.bossesKilled, bossKillsBefore + 1);
    assert.ok(gameState.player.experience > expBefore);
    assert.ok(gameState.player.gold > goldBefore);
    assert.equal(battle.isBossBattle, false, 'the next stage does not retain boss battle mode');
    const committed = {
        experience: gameState.player.experience,
        gold: gameState.player.gold,
        wins: gameState.player.stats.wins,
        bossesKilled: gameState.player.stats.bossesKilled
    };

    battleVictory();
    assert.deepEqual({
        experience: gameState.player.experience,
        gold: gameState.player.gold,
        wins: gameState.player.stats.wins,
        bossesKilled: gameState.player.stats.bossesKilled
    }, committed, 'a duplicate boss victory callback cannot pay boss rewards twice');
    assert.equal(Storage.load().player.dungeonProgress.forest.enemiesDefeated, 0);
});


test('a dungeon defeat commits the gold penalty and expedition reset exactly once', (t) => {
    setup(t);
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousTimeout = globalThis.setTimeout;
    const battle = getBattleState();
    const previousBattle = {
        isActive: battle.isActive, currentEnemy: battle.currentEnemy,
        playerSprite: battle.playerSprite, enemySprite: battle.enemySprite,
        isBossBattle: battle.isBossBattle, isLocationBattle: battle.isLocationBattle,
        isDungeonBattle: battle.isDungeonBattle, turn: battle.turn,
        guardReduction: battle.guardReduction, relicEffects: structuredClone(battle.relicEffects),
        pendingVictorySave: battle.pendingVictorySave, pendingDefeatSave: battle.pendingDefeatSave,
        deathAnimationEndFrame: battle.deathAnimationEndFrame
    };
    const scheduled = [];
    globalThis.window = {
        showScreen() {}, showNotification() {}, updateMainMenu() {}, updateMapScreen() {},
        exitBattle() {}, showBattleMessage() {}, getLocationState, resetLocationState,
        startStageBattle, handleDefeat
    };
    globalThis.document = {
        getElementById(id) { return id === 'battle-ui' ? { innerHTML: '' } : null; },
        querySelectorAll() { return []; },
        querySelector() { return null; }
    };
    globalThis.setTimeout = callback => { scheduled.push(callback); return scheduled.length; };
    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    t.after(() => {
        exitBattle();
        resetLocationState();
        Object.assign(battle, previousBattle);
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        globalThis.setTimeout = previousTimeout;
    });

    const player = gameState.createPlayer('warrior');
    player.unlockedLocations = ['forest'];
    player.gold = 1001;
    player.stats.losses = 2;
    player.dungeonCheckpoints = { forest: { stage: 4, health: 50 } };
    getLocation('forest').unlocked = true;
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();
    assert.equal(battle.isActive, true);
    player.health = 0;
    assert.ok(player.dungeonProgress.forest);
    assert.ok(player.dungeonCheckpoints.forest);
    battle.playerSprite = { beginDeath() {} };

    battleDefeat();

    assert.equal(battle.isActive, false);
    assert.equal(player.health, 1);
    assert.equal(player.gold, 901, '10% penalty is rounded down exactly once');
    assert.equal(player.stats.losses, 3);
    assert.equal(getLocationState().inLocation, false);
    assert.equal(getLocationState().currentLocation, null);
    const saved = Storage.load().player;
    assert.equal(saved.health, 1);
    assert.equal(saved.gold, 901);
    assert.equal(saved.stats.losses, 3);
    assert.equal(saved.dungeonProgress.forest, undefined,
        'the unfinished expedition is removed from the persisted profile');
    assert.equal(saved.dungeonCheckpoints.forest, undefined,
        'the stale checkpoint is removed with the failed run');
    const afterFirstCommit = {
        gold: player.gold, health: player.health, losses: player.stats.losses
    };

    battleDefeat();
    handleDefeat();
    assert.deepEqual({ gold: player.gold, health: player.health, losses: player.stats.losses },
        afterFirstCommit, 'duplicate defeat callbacks cannot charge gold or increment losses twice');
    assert.equal(Storage.load().player.gold, 901);
    assert.equal(Storage.load().player.stats.losses, 3);
    assert.equal(scheduled.length, 1, 'only one post-defeat exit is scheduled');
});


test('a failed defeat save rolls back the penalty and preserves the expedition for a clean retry', (t) => {
    const options = { failActiveWrite: false };
    setup(t, options);
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousTimeout = globalThis.setTimeout;
    const previousAnimationFrame = globalThis.requestAnimationFrame;
    const battle = getBattleState();
    const previousBattle = {
        isActive: battle.isActive, currentEnemy: battle.currentEnemy,
        playerSprite: battle.playerSprite, enemySprite: battle.enemySprite,
        isBossBattle: battle.isBossBattle, isLocationBattle: battle.isLocationBattle,
        isDungeonBattle: battle.isDungeonBattle, turn: battle.turn,
        guardReduction: battle.guardReduction, relicEffects: structuredClone(battle.relicEffects),
        pendingVictorySave: battle.pendingVictorySave, pendingDefeatSave: battle.pendingDefeatSave,
        deathAnimationEndFrame: battle.deathAnimationEndFrame
    };
    const scheduled = [];
    globalThis.window = {
        showScreen() {}, showNotification() {}, updateMainMenu() {}, updateMapScreen() {},
        exitBattle() {}, showBattleMessage() {}, getLocationState, resetLocationState,
        startStageBattle, handleDefeat
    };
    globalThis.document = {
        getElementById(id) { return id === 'battle-ui' ? { innerHTML: '' } : null; },
        querySelectorAll() { return []; },
        querySelector() { return null; }
    };
    globalThis.setTimeout = callback => { scheduled.push(callback); return scheduled.length; };
    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    t.after(() => {
        exitBattle();
        resetLocationState();
        Object.assign(battle, previousBattle);
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        globalThis.setTimeout = previousTimeout;
        if (previousAnimationFrame === undefined) delete globalThis.requestAnimationFrame;
        else globalThis.requestAnimationFrame = previousAnimationFrame;
    });

    const player = gameState.createPlayer('warrior');
    player.unlockedLocations = ['forest'];
    player.gold = 1001;
    player.stats.losses = 4;
    player.dungeonCheckpoints = { forest: { stage: 3, health: 42 } };
    getLocation('forest').unlocked = true;
    startLocation('forest');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();
    player.health = 0;
    battle.playerSprite = { beginDeath() {} };
    const progressBefore = structuredClone(player.dungeonProgress.forest);
    const checkpointBefore = structuredClone(player.dungeonCheckpoints.forest);
    const savedBeforeFailure = Storage.load();

    options.failActiveWrite = true;
    battleDefeat();

    assert.equal(battle.isActive, true, 'the battle remains available for retry');
    assert.equal(battle.pendingDefeatSave, true);
    assert.equal(player.health, 0, 'the pre-defeat HP is restored after failed commit');
    assert.equal(player.gold, 1001, 'gold penalty is rolled back');
    assert.equal(player.stats.losses, 4, 'loss counter is rolled back');
    assert.equal(getLocationState().inLocation, true, 'the active expedition is preserved');
    assert.equal(getLocationState().currentLocation.id, 'forest');
    assert.deepEqual(player.dungeonProgress.forest, progressBefore);
    assert.deepEqual(player.dungeonCheckpoints.forest, checkpointBefore);
    assert.deepEqual(Storage.load(), savedBeforeFailure, 'failed storage write leaves the previous profile unchanged');
    assert.equal(scheduled.length, 0, 'no post-defeat navigation is scheduled on failure');

    options.failActiveWrite = false;
    battleDefeat();

    assert.equal(battle.isActive, false);
    assert.equal(battle.pendingDefeatSave, false);
    assert.equal(player.health, 1);
    assert.equal(player.gold, 901, 'retry applies the 10% penalty once');
    assert.equal(player.stats.losses, 5);
    assert.equal(getLocationState().inLocation, false);
    const committed = Storage.load().player;
    assert.equal(committed.gold, 901);
    assert.equal(committed.health, 1);
    assert.equal(committed.stats.losses, 5);
    assert.equal(committed.dungeonProgress.forest, undefined);
    assert.equal(committed.dungeonCheckpoints.forest, undefined);
    assert.equal(scheduled.length, 1, 'successful retry schedules navigation exactly once');
});


test('the World Eater final boss completes the campaign exactly once after reload', (t) => {
    setup(t);
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousTimeout = globalThis.setTimeout;
    const previousRandom = Math.random;
    const battle = getBattleState();
    const previousBattle = {
        isActive: battle.isActive, currentEnemy: battle.currentEnemy,
        playerSprite: battle.playerSprite, enemySprite: battle.enemySprite,
        isBossBattle: battle.isBossBattle, isLocationBattle: battle.isLocationBattle,
        isDungeonBattle: battle.isDungeonBattle, turn: battle.turn,
        guardReduction: battle.guardReduction, relicEffects: structuredClone(battle.relicEffects),
        pendingVictorySave: battle.pendingVictorySave, pendingDefeatSave: battle.pendingDefeatSave
    };
    const scheduled = [];
    globalThis.window = {
        showScreen() {}, showNotification() {}, updateMainMenu() {}, updateMapScreen() {},
        exitBattle() {}, showBattleMessage() {}, getLocationState, resetLocationState,
        startStageBattle, handleBossVictory, updateQuestProgress() {}, updateAchievements() {},
        levelUp() {}
    };
    globalThis.document = {
        getElementById(id) { return id === 'battle-ui' ? { innerHTML: '' } : null; },
        querySelector() { return null; },
        querySelectorAll() { return []; }
    };
    globalThis.setTimeout = callback => { scheduled.push(callback); return scheduled.length; };
    Math.random = () => 0.99;
    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    t.after(() => {
        exitBattle();
        resetLocationState();
        Object.assign(battle, previousBattle);
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        globalThis.setTimeout = previousTimeout;
        Math.random = previousRandom;
    });

    const player = gameState.createPlayer('warrior');
    player.unlockedLocations = ['forest', 'mountains', 'ruins', 'dragon_lair'];
    player.level = 30;
    player.attack = 99999;
    player.gold = 5000;
    const dragonLair = getLocation('dragon_lair');
    dragonLair.unlocked = true;
    startLocation('dragon_lair');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    const state = getLocationState();
    const location = state.currentLocation;
    const finalStageIndex = location.stages.length - 1;
    const finalStage = location.stages[finalStageIndex];
    assert.equal(finalStage.stage, 60);
    assert.equal(finalStage.boss.id, 'world_eater');
    state.currentStage = finalStageIndex;
    state.enemiesDefeated = finalStage.enemiesCount;
    startBossFight(finalStage.boss);

    assert.equal(battle.isActive, true);
    assert.equal(battle.isBossBattle, true);
    assert.equal(battle.currentEnemy.id, 'world_eater');
    battle.playerSprite = { isAttacking: false };
    battle.enemySprite = { receiveHit() {} };
    const boss = battle.currentEnemy;
    const bossId = boss.id;
    const maxHealth = boss.maxHealth;
    boss.health = Math.floor(maxHealth * 0.6);
    assert.equal(getBossPhase(boss), 2, 'the World Eater enters phase two at 60% HP');
    boss.health = Math.floor(maxHealth * 0.25);
    assert.equal(getBossPhase(boss), 3, 'the World Eater enters phase three at 25% HP');
    boss.health = 1;

    const expBefore = player.experience;
    const goldBefore = player.gold;
    const winsBefore = player.stats.wins;
    const bossKillsBefore = player.stats.bossesKilled || 0;
    playerAttack();

    assert.equal(boss.health, 0, 'the lethal hit is committed before rewards are paid');
    const lethalSave = Storage.load().player;
    assert.equal(lethalSave.dungeonProgress.dragon_lair.activeEncounter.enemy.id, bossId);
    assert.equal(lethalSave.dungeonProgress.dragon_lair.activeEncounter.enemy.health, 0);
    assert.equal(lethalSave.dungeonProgress.dragon_lair.activeEncounter.isBossBattle, true);
    assert.equal(lethalSave.campaignCompleted, false);
    assert.equal(lethalSave.newGamePlusUnlocked, false);
    assert.equal(scheduled.length, 1, 'the original attack animation has not been resolved');

    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    battle.playerSprite = null;
    battle.enemySprite = null;
    assert.equal(gameState.load(), true);
    startLocation('dragon_lair');
    scheduled.pop(); // Ignore the delayed auto-start; this test starts the stage explicitly.
    startStageBattle();

    const completed = Storage.load().player;
    assert.equal(battle.isActive, false, 'reload resolves the saved lethal final encounter');
    assert.equal(getLocationState().inLocation, false);
    assert.equal(getLocationState().currentLocation, null);
    assert.equal(completed.dungeonProgress.dragon_lair, undefined);
    assert.equal(completed.dungeonCheckpoints.dragon_lair, undefined);
    assert.equal(completed.campaignCompleted, true);
    assert.equal(completed.newGamePlusUnlocked, true);
    assert.equal(completed.completedCampaignCycles, 1);
    assert.equal(completed.lastCompletedCampaignCycle, 1);
    assert.ok(completed.campaignCompletedAt);
    assert.equal(completed.locationRewardCycles.dragon_lair, 1);
    assert.equal(completed.stats.wins, winsBefore + 1);
    assert.equal(completed.stats.bossesKilled, bossKillsBefore + 1);
    assert.ok(completed.experience > expBefore);
    assert.ok(completed.gold > goldBefore);
    assert.ok(completed.inventory.some(item => item.id === 'rune_world_fragment'),
        'the final region reward is granted with campaign completion');
    assert.equal(scheduled.length, 2, 'the ending transition is scheduled once after the original attack timer');

    battleVictory();
    assert.equal(handleBossVictory(), false, 'a duplicate final boss completion cannot run after campaign end');
    const afterDuplicate = Storage.load().player;
    assert.equal(afterDuplicate.completedCampaignCycles, 1);
    assert.equal(afterDuplicate.lastCompletedCampaignCycle, 1);
    assert.equal(afterDuplicate.locationRewardCycles.dragon_lair, 1);
    assert.equal(afterDuplicate.stats.bossesKilled, bossKillsBefore + 1);
    assert.equal(afterDuplicate.inventory.filter(item => item.id === 'rune_world_fragment')
        .reduce((sum, item) => sum + item.quantity, 0), 1);
});


test('NG+ preparation preserves lifetime progress and resets only the new-cycle state', (t) => {
    setup(t);
    const player = gameState.createPlayer('mage');
    Object.assign(player, {
        campaignCycle: 1,
        completedCampaignCycles: 0,
        lastCompletedCampaignCycle: 0,
        campaignCompleted: false,
        newGamePlusUnlocked: false,
        campaignCompletedAt: null,
        health: 1,
        mana: 0,
        gold: 2345,
        unlockedLocations: ['forest', 'mountains', 'ruins', 'dragon_lair'],
        dungeonCheckpoints: { forest: { stage: 12 } },
        dungeonProgress: { forest: { stage: 12, enemiesDefeated: 2 } },
        itemUpgrades: { iron_sword: 8 },
        weaponRunes: { iron_sword: ['flame', 'blood'] },
        stats: { kills: 91, battles: 120, wins: 100, losses: 3, dungeonsCompleted: 4, bossesKilled: 9 }
    });
    const completedQuest = player.quests.find(entry => entry.id === 'first_blood');
    completedQuest.progress = 1;
    completedQuest.completed = true;
    completedQuest.rewardClaimed = true;
    const unfinishedQuest = player.quests.find(entry => entry.id !== 'first_blood');
    unfinishedQuest.progress = 1;
    const original = structuredClone(player);

    assert.equal(canStartNewGamePlus(player), false, 'NG+ remains locked before the campaign ending');
    assert.equal(prepareNewGamePlus(player), null);
    assert.deepEqual(player, original, 'a rejected preparation cannot mutate the completed profile');

    assert.equal(completeCampaign(player, '2026-11-22T08:00:00.000Z'), true);
    assert.equal(completeCampaign(player, '2026-11-22T08:01:00.000Z'), false,
        'the same campaign cycle cannot be completed twice');
    assert.equal(player.completedCampaignCycles, 1);
    assert.equal(canStartNewGamePlus(player), true);

    const next = prepareNewGamePlus(player);
    assert.ok(next);
    assert.notEqual(next, player, 'NG+ is prepared as a separate profile object');
    assert.equal(next.campaignCycle, 2);
    assert.equal(next.completedCampaignCycles, 1);
    assert.equal(next.lastCompletedCampaignCycle, 1);
    assert.equal(next.campaignCompleted, false);
    assert.equal(next.newGamePlusUnlocked, true);
    assert.equal(next.campaignCompletedAt, null);
    assert.equal(next.health, next.maxHealth);
    assert.equal(next.mana, next.maxMana);
    assert.equal(next.gold, original.gold);
    assert.deepEqual(next.unlockedLocations, ['forest']);
    assert.deepEqual(next.dungeonCheckpoints, {});
    assert.deepEqual(next.dungeonProgress, {});
    assert.deepEqual(next.itemUpgrades, original.itemUpgrades);
    assert.deepEqual(next.weaponRunes, original.weaponRunes);
    assert.deepEqual(next.stats, original.stats);
    assert.equal(next.quests.find(entry => entry.id === 'first_blood').rewardClaimed, true);
    assert.equal(next.quests.find(entry => entry.id === 'first_blood').completed, true);
    assert.equal(next.quests.find(entry => entry.id === unfinishedQuest.id).progress, 0);
    assert.equal(next.quests.find(entry => entry.id === unfinishedQuest.id).rewardClaimed, false);
    assert.equal(player.campaignCycle, 1, 'preparing NG+ must not mutate the original profile');
});


test('starting NG+ commits one new cycle and restores the same state after reload', (t) => {
    const values = setup(t);
    const previousLocationUnlocks = LOCATIONS.map(location => location.unlocked);
    t.after(() => LOCATIONS.forEach((location, index) => { location.unlocked = previousLocationUnlocks[index]; }));
    const player = gameState.createPlayer('warrior');
    Object.assign(player, {
        campaignCycle: 3,
        completedCampaignCycles: 2,
        lastCompletedCampaignCycle: 3,
        campaignCompleted: true,
        newGamePlusUnlocked: true,
        campaignCompletedAt: '2026-11-22T07:00:00.000Z',
        health: 1,
        mana: 0,
        unlockedLocations: ['forest', 'mountains', 'ruins', 'dragon_lair'],
        itemUpgrades: { iron_sword: 5 },
        weaponRunes: { iron_sword: ['flame'] }
    });
    player.quests.find(entry => entry.id === 'first_blood').rewardClaimed = true;
    gameState.player = player;
    ['forest', 'mountains', 'ruins', 'dragon_lair'].forEach(id => { getLocation(id).unlocked = true; });

    assert.equal(startNewGamePlus(gameState), true);
    assert.notEqual(gameState.player, player);
    assert.equal(gameState.player.campaignCycle, 4);
    assert.equal(gameState.player.completedCampaignCycles, 2);
    assert.equal(gameState.player.lastCompletedCampaignCycle, 3);
    assert.equal(gameState.player.campaignCompleted, false);
    assert.equal(gameState.player.newGamePlusUnlocked, true);
    assert.equal(gameState.player.health, gameState.player.maxHealth);
    assert.equal(gameState.player.mana, gameState.player.maxMana);
    assert.deepEqual(gameState.player.unlockedLocations, ['forest']);
    assert.equal(getLocation('forest').unlocked, true);
    assert.equal(getLocation('mountains').unlocked, false);
    assert.equal(getLocation('ruins').unlocked, false);
    assert.equal(getLocation('dragon_lair').unlocked, false);
    assert.equal(gameState.player.quests.find(entry => entry.id === 'first_blood').rewardClaimed, true);

    assert.equal(gameState.load(), true);
    assert.equal(gameState.player.campaignCycle, 4);
    assert.equal(gameState.player.completedCampaignCycles, 2);
    assert.deepEqual(gameState.player.itemUpgrades, { iron_sword: 5 });
    assert.deepEqual(gameState.player.weaponRunes, { iron_sword: ['flame'] });
    assert.equal(startNewGamePlus(gameState), false, 'a second start cannot create cycle five without another ending');
    assert.equal(Storage.load().player.campaignCycle, 4);
    assert.ok(values.has(GAME_CONFIG.saveKey));
});


test('a failed or throwing NG+ save restores the completed campaign and location unlocks', (t) => {
    setup(t);
    const previousLocationUnlocks = LOCATIONS.map(location => location.unlocked);
    t.after(() => LOCATIONS.forEach((location, index) => { location.unlocked = previousLocationUnlocks[index]; }));
    const player = gameState.createPlayer('archer');
    Object.assign(player, {
        campaignCycle: 2,
        completedCampaignCycles: 1,
        lastCompletedCampaignCycle: 2,
        campaignCompleted: true,
        newGamePlusUnlocked: true,
        campaignCompletedAt: '2026-11-22T07:30:00.000Z',
        unlockedLocations: ['forest', 'mountains', 'ruins', 'dragon_lair']
    });
    gameState.player = player;
    ['forest', 'mountains', 'ruins', 'dragon_lair'].forEach(id => { getLocation(id).unlocked = true; });
    const originalSave = gameState.save;
    t.after(() => { gameState.save = originalSave; });
    const originalUnlocks = ['forest', 'mountains', 'ruins', 'dragon_lair']
        .map(id => getLocation(id).unlocked);
    const originalPlayer = structuredClone(player);

    gameState.save = () => { throw new Error('QuotaExceededError'); };
    assert.equal(startNewGamePlus(gameState), false);
    assert.equal(gameState.player, player, 'the original player object remains active');
    assert.deepEqual(gameState.player, originalPlayer, 'campaign progress remains unchanged');
    assert.deepEqual(['forest', 'mountains', 'ruins', 'dragon_lair']
        .map(id => getLocation(id).unlocked), originalUnlocks);

    gameState.save = () => false;
    assert.equal(startNewGamePlus(gameState), false);
    assert.equal(gameState.player, player);
    assert.deepEqual(gameState.player, originalPlayer);
    assert.deepEqual(['forest', 'mountains', 'ruins', 'dragon_lair']
        .map(id => getLocation(id).unlocked), originalUnlocks);

});
