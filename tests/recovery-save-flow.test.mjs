import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG } from '../js/config/constants.js';
import { gameState } from '../js/core/state.js';
import { RECOVERY_SAVE_KEY, Storage } from '../js/core/storage.js';
import { getLocation } from '../js/data/locations.js';
import { getBattleState, playerAttack, playerDefend, playerSkill } from '../js/ui/battle.js';
import { getLocationState, resetLocationState, completeLocation, startLocation, startStageBattle } from '../js/systems/dungeon.js';

function setup(t, options = {}) {
    const previousStorage = globalThis.localStorage;
    const previousPlayer = gameState.player;
    const values = new Map();
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
        querySelectorAll() { return []; }
    };
    globalThis.setTimeout = callback => { scheduled.push(callback); return scheduled.length; };
    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    t.after(() => {
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
        querySelectorAll() { return []; }
    };
    globalThis.setTimeout = callback => { scheduled.push(callback); return scheduled.length; };
    Math.random = () => 0.99;
    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    t.after(() => {
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
        querySelectorAll() { return []; }
    };
    globalThis.setTimeout = callback => { scheduled.push(callback); return scheduled.length; };
    Math.random = () => 0.99;
    resetLocationState();
    battle.isActive = false;
    battle.currentEnemy = null;
    t.after(() => {
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
