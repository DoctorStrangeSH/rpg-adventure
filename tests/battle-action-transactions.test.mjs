import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../js/core/state.js';
import { Storage } from '../js/core/storage.js';
import { CLASSES } from '../js/data/classes.js';
import { startBattle, playerAttack, playerSkill, playerUseItem, playerDefend, playerFlee, battleVictory, battleDefeat, getBattleState } from '../js/ui/battle.js';

function setup(t, classId = 'warrior') {
    const previousPlayer = gameState.player;
    const previousSave = gameState.save;
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousRandom = Math.random;
    const previousTimeout = globalThis.setTimeout;
    const previousRaf = globalThis.requestAnimationFrame;
    const battle = getBattleState();
    const previousBattle = { ...battle };
    const notifications = [];
    const player = gameState.createPlayer(classId);
    gameState.player = player;
    globalThis.window = {
        showNotification(message, type) { notifications.push({ message, type }); },
        showScreen() {},
        getLocationState() { return null; },
        updateMainMenu() {}
    };
    globalThis.document = {
        getElementById() { return { innerHTML: '' }; },
        querySelectorAll() { return []; },
        querySelector() { return null; },
        createElement() { return { classList: { add() {} }, remove() {} }; }
    };
    t.after(() => {
        gameState.player = previousPlayer;
        gameState.save = previousSave;
        Object.assign(battle, previousBattle);
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        Math.random = previousRandom;
        globalThis.setTimeout = previousTimeout;
        if (previousRaf === undefined) delete globalThis.requestAnimationFrame;
        else globalThis.requestAnimationFrame = previousRaf;
    });
    return { player, battle, notifications };
}

function prepareBattle(battle, player, enemy = {}) {
    Object.assign(battle, {
        isActive: true,
        currentEnemy: {
            id: 'test_enemy', name: 'Тестовый враг', health: 200, maxHealth: 200,
            attack: 10, defense: 0, effects: {}, ...enemy
        },
        turn: 'player',
        isBossBattle: false,
        isLocationBattle: false,
        isDungeonBattle: false,
        guardReduction: 0,
        relicEffects: { phoenixRebirthUsed: false },
        playerSprite: { x: 0, y: 0, isAttacking: false, beginDeath() { this.deathStartFrame = 0; }, startParry() { this.parryStarted = true; }, startCounter() { this.counterStarted = true; }, receiveHit() { this.hitCount = (this.hitCount || 0) + 1; } },
        enemySprite: { x: 100, y: 0, receiveHit() { this.hitCount = (this.hitCount || 0) + 1; } }
    });
}

test('failed battle start does not count or open an unsaved encounter', (t) => {
    const { player, battle, notifications } = setup(t);
    const previousEnemy = battle.currentEnemy;
    const battles = player.stats.battles;
    gameState.save = () => false;

    startBattle({ enemies: ['wolf'] });

    assert.equal(player.stats.battles, battles);
    assert.equal(battle.isActive, false);
    assert.equal(battle.currentEnemy, previousEnemy);
    assert.match(notifications[0]?.message || '', /начало боя/);
});

test('failed skill save restores mana, enemy health and effects without consuming the turn', (t) => {
    const { player, battle, notifications } = setup(t, 'mage');
    prepareBattle(battle, player, { health: 200, effects: { burnTurns: 1 } });
    const enemy = battle.currentEnemy;
    const beforePlayer = structuredClone(player);
    const beforeEnemy = structuredClone(enemy);
    gameState.save = () => false;

    playerSkill(CLASSES.mage.skills[1].id);

    assert.deepEqual(player, beforePlayer);
    assert.deepEqual(enemy, beforeEnemy);
    assert.equal(battle.turn, 'player');
    assert.match(notifications[0]?.message || '', /применение навыка/);
});

test('failed potion save restores health and the exact inventory stack', (t) => {
    const { player, battle, notifications } = setup(t);
    prepareBattle(battle, player);
    player.health -= 25;
    const beforePlayer = structuredClone(player);
    gameState.save = () => false;

    playerUseItem('health_potion');

    assert.deepEqual(player, beforePlayer);
    assert.equal(battle.turn, 'player');
    assert.match(notifications[0]?.message || '', /использование зелья/);
});

test('failed moonblade save restores player mana and opponent state before hit feedback', (t) => {
    const { player, battle, notifications } = setup(t, 'mage');
    prepareBattle(battle, player);
    player.equipment.weapon = 'moonblade';
    player.mana = 0;
    const enemy = battle.currentEnemy;
    const beforePlayer = structuredClone(player);
    const beforeEnemy = structuredClone(enemy);
    Math.random = () => 0;
    gameState.save = () => false;

    playerAttack();

    assert.deepEqual(player, beforePlayer);
    assert.deepEqual(enemy, beforeEnemy);
    assert.equal(battle.enemySprite.hitCount || 0, 0);
    assert.equal(battle.turn, 'player');
    assert.match(notifications[0]?.message || '', /эффект оружия/);
});

test('failed enemy-turn save restores player and enemy state and returns the turn safely', (t) => {
    const { player, battle, notifications } = setup(t, 'mage');
    prepareBattle(battle, player, { behavior: 'aggressive', intent: 'attack', attack: 18 });
    const enemy = battle.currentEnemy;
    const beforePlayer = structuredClone(player);
    const beforeEnemy = structuredClone(enemy);
    globalThis.setTimeout = callback => { callback(); return 1; };
    gameState.save = () => false;

    // Defend advances directly into the enemy action using the deterministic timer stub.
    playerDefend();

    assert.deepEqual(player, beforePlayer);
    assert.deepEqual(enemy, beforeEnemy);
    assert.equal(battle.turn, 'player');
    assert.match(notifications[0]?.message || '', /ход противника/);
});

test('field victory rolls back rewards on save failure and exposes an explicit retry', (t) => {
    const { player, battle, notifications } = setup(t);
    prepareBattle(battle, player, { health: 0, expReward: 20, goldReward: 15 });
    player.experience = player.maxExperience - 1;
    const beforePlayer = structuredClone(player);
    const progressSaveFlags = [];
    window.updateQuestProgress = (_type, _amount, options) => progressSaveFlags.push(options?.save);
    window.updateAchievements = options => progressSaveFlags.push(options?.save);
    window.levelUp = options => progressSaveFlags.push(options?.save);
    globalThis.setTimeout = () => 1;
    gameState.save = () => false;

    battleVictory();

    assert.deepEqual(player, beforePlayer);
    assert.deepEqual(progressSaveFlags, [false, false, false, false, false, false]);
    assert.equal(battle.isActive, true);
    assert.equal(battle.pendingVictorySave, true);
    assert.match(notifications[0]?.message || '', /Победа не сохранена/);

    gameState.save = () => true;
    battleVictory();

    assert.equal(battle.isActive, false);
    assert.equal(battle.pendingVictorySave, false);
    assert.equal(player.stats.wins, beforePlayer.stats.wins + 1);
    assert.ok(player.gold > beforePlayer.gold);
});

test('defeat failure restores all penalties and keeps an explicit save retry available', (t) => {
    const { player, battle, notifications } = setup(t);
    prepareBattle(battle, player);
    player.health = 0;
    player.gold = 100;
    const beforePlayer = structuredClone(player);
    globalThis.requestAnimationFrame = () => 1;
    globalThis.setTimeout = () => 1;
    window.handleDefeat = snapshot => {
        assert.deepEqual(snapshot, beforePlayer);
        return false;
    };

    battleDefeat();

    assert.deepEqual(player, beforePlayer);
    assert.equal(battle.isActive, true);
    assert.equal(battle.pendingDefeatSave, true);
    assert.match(notifications.at(-1)?.message || '', /Поражение не сохранено/);

    window.handleDefeat = () => true;
    battleDefeat();

    assert.equal(battle.isActive, false);
    assert.equal(battle.pendingDefeatSave, false);
    assert.equal(player.health, 1);
    assert.equal(player.gold, 90);
    assert.equal(player.stats.losses, beforePlayer.stats.losses + 1);
});

test('failed expedition flee save keeps the battle open and restores available actions', (t) => {
    const { battle } = setup(t);
    prepareBattle(battle, gameState.player);
    window.getLocationState = () => ({ inLocation: true });
    window.fleeLocation = () => false;
    globalThis.setTimeout = callback => { callback(); return 1; };
    Math.random = () => 0;

    playerFlee();

    assert.equal(battle.isActive, true);
    assert.equal(battle.turn, 'player');
    assert.equal(battle.pendingVictorySave, false);
    assert.equal(battle.pendingDefeatSave, false);
});

test('failed field boss victory rolls back trophy and boss loot before offering a retry', (t) => {
    const { player, battle } = setup(t);
    prepareBattle(battle, player, {
        id: 'world_eater', name: 'Пожиратель миров', health: 0,
        expReward: 50, goldReward: 50
    });
    battle.isBossBattle = true;
    const beforePlayer = structuredClone(player);
    Math.random = () => 0.01;
    globalThis.setTimeout = () => 1;
    gameState.save = () => false;

    battleVictory();

    assert.deepEqual(player, beforePlayer);
    assert.equal(battle.isActive, true);
    assert.equal(battle.pendingVictorySave, true);
});

test('lethal enemy action never saves a zero-health profile before defeat penalties', (t) => {
    const { player, battle } = setup(t, 'mage');
    prepareBattle(battle, player, { behavior: 'aggressive', intent: 'attack', attack: 1000 });
    player.health = 1;
    globalThis.requestAnimationFrame = () => 1;
    globalThis.setTimeout = callback => { callback(); return 1; };
    let saveCalls = 0;
    let healthAtSave = null;
    gameState.save = () => {
        saveCalls++;
        healthAtSave = player.health;
        return false;
    };

    playerDefend();

    assert.equal(saveCalls, 1);
    assert.equal(healthAtSave, 1, 'only the post-penalty health value is offered to persistence');
    assert.equal(player.health, 0, 'failed commit restores the pre-penalty in-memory snapshot');
    assert.equal(battle.isActive, true);
    assert.equal(battle.pendingDefeatSave, true);
});


test('expedition combat resource and relic ownership changes survive a real save/reload', (t) => {
    const { player, battle } = setup(t, 'mage');
    const previousStorage = globalThis.localStorage;
    const previousTimeout = globalThis.setTimeout;
    const values = new Map();
    globalThis.localStorage = {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
    };
    const callbacks = [];
    globalThis.setTimeout = callback => { callbacks.push(callback); return 1; };
    t.after(() => {
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
        globalThis.setTimeout = previousTimeout;
    });

    player.health = Math.max(1, player.maxHealth - 30);
    player.mana = Math.max(0, player.maxMana - 20);
    player.inventory = [{ id: 'health_potion', quantity: 2 }];
    player.relics = ['phoenix_feather'];
    player.dungeonProgress = {
        forest: { campaignCycle: 1, stage: 3, enemiesDefeated: 1 }
    };
    prepareBattle(battle, player, { health: 200, maxHealth: 200 });
    battle.isLocationBattle = true;
    battle.isDungeonBattle = true;
    window.getLocationState = () => ({ inLocation: true, currentLocation: { id: 'forest' } });

    const expectedHealth = player.health;
    playerUseItem('health_potion');
    const committedHealth = player.health;
    assert.ok(committedHealth > expectedHealth, 'the potion must restore health before persistence');
    assert.equal(gameState.load(), true);
    assert.equal(gameState.player.health, committedHealth);
    assert.equal(gameState.player.mana, player.mana);
    assert.deepEqual(gameState.player.relics, ['phoenix_feather']);
    const restoredProgress = gameState.player.dungeonProgress.forest;
    assert.equal(restoredProgress.campaignCycle, 1);
    assert.equal(restoredProgress.stage, 3);
    assert.equal(restoredProgress.enemiesDefeated, 1);
    assert.equal(restoredProgress.activeEncounter.turn, 'enemy');
    assert.equal(restoredProgress.activeEncounter.enemy.health, 200);
    assert.equal(gameState.player.inventory.find(item => item.id === 'health_potion').quantity, 1);

    // Complete the scheduled enemy turn so module-level battle processing is
    // reset before the next test starts.
    while (callbacks.length) callbacks.shift()();
});


test('a committed expedition guard action saves the exact enemy and next turn for reload', (t) => {
    const { player, battle } = setup(t);
    const previousStorage = globalThis.localStorage;
    const values = new Map();
    globalThis.localStorage = {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
    };
    const callbacks = [];
    globalThis.setTimeout = callback => { callbacks.push(callback); return 1; };
    t.after(() => {
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
    });

    const location = {
        id: 'forest',
        inLocation: true,
        currentLocation: { id: 'forest' },
        activeEncounter: null
    };
    window.getLocationState = () => location;
    player.dungeonProgress = {
        forest: { campaignCycle: player.campaignCycle, stage: 2, enemiesDefeated: 1 }
    };
    prepareBattle(battle, player, {
        id: 'wolf',
        health: 91,
        maxHealth: 180,
        effects: { poisonTurns: 2 },
        intent: 'heavy',
        phase: 1
    });
    battle.isDungeonBattle = true;
    battle.isLocationBattle = true;

    playerDefend();

    const saved = Storage.load().player.dungeonProgress.forest.activeEncounter;
    assert.equal(saved.enemy.id, 'wolf');
    assert.equal(saved.enemy.health, 91);
    assert.deepEqual(saved.enemy.effects, { poisonTurns: 2 });
    assert.equal(saved.enemy.intent, 'heavy');
    assert.equal(saved.turn, 'enemy');
    assert.ok(saved.guardReduction > 0);
    while (callbacks.length) callbacks.shift()();
});




test('warrior expedition guard survives save and reload with the same boss telegraph and riposte window', (t) => {
    const { player, battle } = setup(t, 'warrior');
    const previousStorage = globalThis.localStorage;
    const previousData = gameState.data;
    const values = new Map();
    globalThis.localStorage = {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
    };
    const callbacks = [];
    globalThis.setTimeout = callback => { callbacks.push(callback); return 1; };
    t.after(() => {
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
        gameState.data = previousData;
    });

    window.getLocationState = () => ({
        id: 'forest',
        inLocation: true,
        currentLocation: { id: 'forest' },
        activeEncounter: null
    });
    player.dungeonProgress = {
        forest: { campaignCycle: player.campaignCycle, stage: 8, enemiesDefeated: 7 }
    };
    prepareBattle(battle, player, {
        id: 'forest_guardian',
        name: 'Страж леса',
        health: 850,
        maxHealth: 1000,
        attack: 48,
        effects: { poisonTurns: 1 },
        intent: 'heavy',
        phase: 2
    });
    battle.isDungeonBattle = true;
    battle.isLocationBattle = true;
    battle.isBossBattle = true;

    playerDefend();

    const saved = Storage.load().player.dungeonProgress.forest.activeEncounter;
    assert.equal(saved.isBossBattle, true);
    assert.equal(saved.enemy.id, 'forest_guardian');
    assert.equal(saved.enemy.health, 850);
    assert.equal(saved.enemy.intent, 'heavy');
    assert.equal(saved.enemy.phase, 2);
    assert.ok(saved.guardReduction >= 0.75);
    assert.equal(saved.turn, 'enemy');

    gameState.data = { player: null, screen: 'main-menu' };
    assert.equal(gameState.load(), true);
    const restored = gameState.player.dungeonProgress.forest.activeEncounter;
    assert.equal(restored.isBossBattle, true);
    assert.equal(restored.enemy.id, 'forest_guardian');
    assert.equal(restored.enemy.health, 850);
    assert.equal(restored.enemy.intent, 'heavy');
    assert.equal(restored.enemy.phase, 2);
    assert.equal(restored.turn, 'enemy');
    assert.ok(restored.guardReduction >= 0.75);

    let safety = 0;
    while (callbacks.length && safety++ < 5) callbacks.shift()();
});

test('failed expedition guard snapshot restores guard, turn and previous encounter save', (t) => {
    const { player, battle } = setup(t);
    const location = {
        id: 'forest',
        inLocation: true,
        currentLocation: { id: 'forest' },
        activeEncounter: null
    };
    window.getLocationState = () => location;
    player.dungeonProgress = {
        forest: { campaignCycle: player.campaignCycle, stage: 2, enemiesDefeated: 1 }
    };
    prepareBattle(battle, player);
    battle.isDungeonBattle = true;
    battle.isLocationBattle = true;
    const beforeGuard = battle.guardReduction;
    const beforePlayer = structuredClone(player);
    gameState.save = () => false;

    playerDefend();

    assert.deepEqual(player, beforePlayer);
    assert.equal(battle.guardReduction, beforeGuard);
    assert.equal(battle.turn, 'player');
    assert.equal(location.activeEncounter, null);
    assert.equal(player.dungeonProgress.forest.activeEncounter, undefined);
});


for (const scenario of [
    { classId: 'warrior', skillId: 'power_strike', expectedEffect: 'weakenTurns' },
    { classId: 'mage', skillId: 'fireball', expectedEffect: 'burnTurns' },
    { classId: 'archer', skillId: 'poison_arrow', expectedEffect: 'poisonTurns' }
]) {
    test(`successful ${scenario.classId} skill persists its encounter snapshot and next turn`, (t) => {
        const { player, battle } = setup(t, scenario.classId);
        const previousStorage = globalThis.localStorage;
        const values = new Map();
        globalThis.localStorage = {
            getItem(key) { return values.get(key) ?? null; },
            setItem(key, value) { values.set(key, String(value)); },
            removeItem(key) { values.delete(key); }
        };
        const callbacks = [];
        globalThis.setTimeout = callback => { callbacks.push(callback); return 1; };
        t.after(() => {
            if (previousStorage === undefined) delete globalThis.localStorage;
            else globalThis.localStorage = previousStorage;
        });

        const location = {
            id: 'forest',
            inLocation: true,
            currentLocation: { id: 'forest' },
            activeEncounter: null
        };
        window.getLocationState = () => location;
        player.dungeonProgress = {
            forest: { campaignCycle: player.campaignCycle, stage: 1, enemiesDefeated: 0 }
        };
        prepareBattle(battle, player, { health: 2000, maxHealth: 2000 });
        battle.isDungeonBattle = true;
        battle.isLocationBattle = true;
        const manaBefore = player.mana;

        playerSkill(scenario.skillId);

        const saved = Storage.load().player.dungeonProgress.forest.activeEncounter;
        assert.ok(saved.enemy.health < 2000);
        assert.ok(saved.enemy.effects[scenario.expectedEffect] > 0);
        assert.equal(saved.turn, 'enemy');
        assert.equal(saved.isBossBattle, false);
        assert.equal(player.mana, manaBefore - CLASSES[scenario.classId].skills.find(skill => skill.id === scenario.skillId).manaCost);
        let safety = 0;
        while (callbacks.length && safety++ < 5) callbacks.shift()();
    });
}






test('successful archer skill reload keeps consumed marks, bleed and expedition turn', (t) => {
    const { player, battle } = setup(t, 'archer');
    const previousStorage = globalThis.localStorage;
    const previousData = gameState.data;
    const values = new Map();
    globalThis.localStorage = {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
    };
    const callbacks = [];
    globalThis.setTimeout = callback => { callbacks.push(callback); return 1; };
    t.after(() => {
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
        gameState.data = previousData;
    });

    window.getLocationState = () => ({
        id: 'forest',
        inLocation: true,
        currentLocation: { id: 'forest' },
        activeEncounter: null
    });
    player.dungeonProgress = {
        forest: { campaignCycle: player.campaignCycle, stage: 3, enemiesDefeated: 2 }
    };
    prepareBattle(battle, player, {
        health: 2000,
        maxHealth: 2000,
        effects: {},
        archerMarks: 2
    });
    battle.isDungeonBattle = true;
    battle.isLocationBattle = true;
    const beforeMana = player.mana;

    playerSkill('rapid_shot');

    const committed = Storage.load().player;
    const encounter = committed.dungeonProgress.forest.activeEncounter;
    assert.equal(committed.mana, beforeMana - CLASSES.archer.skills[0].manaCost);
    assert.ok(encounter.enemy.health < 2000);
    assert.equal(encounter.enemy.archerMarks, 0);
    assert.ok(encounter.enemy.effects.bleedTurns > 0);
    assert.equal(encounter.turn, 'enemy');

    gameState.data = { player: null, screen: 'main-menu' };
    assert.equal(gameState.load(), true);
    const restored = gameState.player.dungeonProgress.forest.activeEncounter;
    assert.equal(gameState.player.mana, beforeMana - CLASSES.archer.skills[0].manaCost);
    assert.equal(restored.enemy.health, encounter.enemy.health);
    assert.equal(restored.enemy.archerMarks, 0);
    assert.equal(restored.enemy.effects.bleedTurns, encounter.enemy.effects.bleedTurns);
    assert.equal(restored.turn, 'enemy');

    let safety = 0;
    while (callbacks.length && safety++ < 5) callbacks.shift()();
});

test('successful expedition skill commits mana, damage and status effect for reload', (t) => {
    const { player, battle } = setup(t, 'mage');
    const previousStorage = globalThis.localStorage;
    const previousData = gameState.data;
    const values = new Map();
    globalThis.localStorage = {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
    };
    const callbacks = [];
    globalThis.setTimeout = callback => { callbacks.push(callback); return 1; };
    t.after(() => {
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
        gameState.data = previousData;
    });

    const location = {
        id: 'forest',
        inLocation: true,
        currentLocation: { id: 'forest' },
        activeEncounter: null
    };
    window.getLocationState = () => location;
    player.dungeonProgress = {
        forest: { campaignCycle: player.campaignCycle, stage: 2, enemiesDefeated: 1 }
    };
    prepareBattle(battle, player, {
        health: 2000,
        maxHealth: 2000,
        effects: {}
    });
    battle.isDungeonBattle = true;
    battle.isLocationBattle = true;
    const beforeMana = player.mana;

    playerSkill('fireball');

    const committed = Storage.load().player;
    const encounter = committed.dungeonProgress.forest.activeEncounter;
    assert.equal(committed.mana, beforeMana - CLASSES.mage.skills[0].manaCost);
    assert.ok(encounter.enemy.health < 2000);
    assert.ok(encounter.enemy.effects.burnTurns > 0);
    assert.equal(encounter.turn, 'enemy');

    gameState.data = { player: null, screen: 'main-menu' };
    assert.equal(gameState.load(), true);
    const restored = gameState.player.dungeonProgress.forest.activeEncounter;
    assert.equal(gameState.player.mana, beforeMana - CLASSES.mage.skills[0].manaCost);
    assert.equal(restored.enemy.health, encounter.enemy.health);
    assert.equal(restored.enemy.effects.burnTurns, encounter.enemy.effects.burnTurns);
    assert.equal(restored.turn, 'enemy');

    let safety = 0;
    while (callbacks.length && safety++ < 5) callbacks.shift()();
});

test('successful expedition basic attack saves enemy damage, weapon state and enemy turn', (t) => {
    const { player, battle } = setup(t);
    const previousStorage = globalThis.localStorage;
    const values = new Map();
    globalThis.localStorage = {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
    };
    const callbacks = [];
    globalThis.setTimeout = callback => { callbacks.push(callback); return 1; };
    t.after(() => {
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
    });
    const location = {
        id: 'forest',
        inLocation: true,
        currentLocation: { id: 'forest' },
        activeEncounter: null
    };
    window.getLocationState = () => location;
    player.dungeonProgress = {
        forest: { campaignCycle: player.campaignCycle, stage: 1, enemiesDefeated: 0 }
    };
    prepareBattle(battle, player, { health: 2000, maxHealth: 2000 });
    battle.isDungeonBattle = true;
    battle.isLocationBattle = true;

    playerAttack();

    const saved = Storage.load().player.dungeonProgress.forest.activeEncounter;
    assert.ok(saved.enemy.health < 2000);
    assert.equal(saved.turn, 'enemy');
    let safety = 0;
    while (callbacks.length && safety++ < 5) callbacks.shift()();
});

test('successful expedition potion use saves restored resources, inventory and enemy turn', (t) => {
    const { player, battle } = setup(t);
    const previousStorage = globalThis.localStorage;
    const values = new Map();
    globalThis.localStorage = {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
    };
    const callbacks = [];
    globalThis.setTimeout = callback => { callbacks.push(callback); return 1; };
    t.after(() => {
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
    });
    const location = {
        id: 'forest',
        inLocation: true,
        currentLocation: { id: 'forest' },
        activeEncounter: null
    };
    window.getLocationState = () => location;
    player.dungeonProgress = {
        forest: { campaignCycle: player.campaignCycle, stage: 1, enemiesDefeated: 0 }
    };
    prepareBattle(battle, player, { health: 2000, maxHealth: 2000 });
    battle.isDungeonBattle = true;
    battle.isLocationBattle = true;
    player.health = Math.max(1, player.maxHealth - 30);
    const beforeHealth = player.health;
    const beforeQuantity = player.inventory.find(item => item.id === 'health_potion').quantity;

    playerUseItem('health_potion');

    const saved = Storage.load().player.dungeonProgress.forest.activeEncounter;
    const savedPlayer = Storage.load().player;
    assert.ok(savedPlayer.health > beforeHealth);
    assert.equal(savedPlayer.inventory.find(item => item.id === 'health_potion').quantity, beforeQuantity - 1);
    assert.equal(saved.enemy.health, 2000);
    assert.equal(saved.turn, 'enemy');
    let safety = 0;
    while (callbacks.length && safety++ < 5) callbacks.shift()();
});


test('successful expedition enemy action saves player damage and returns the turn to the hero', (t) => {
    const { player, battle } = setup(t);
    const previousStorage = globalThis.localStorage;
    const values = new Map();
    globalThis.localStorage = {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
    };
    const callbacks = [];
    globalThis.setTimeout = callback => { callbacks.push(callback); return 1; };
    t.after(() => {
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
    });
    const location = {
        id: 'forest',
        inLocation: true,
        currentLocation: { id: 'forest' },
        activeEncounter: null
    };
    window.getLocationState = () => location;
    player.dungeonProgress = {
        forest: { campaignCycle: player.campaignCycle, stage: 1, enemiesDefeated: 0 }
    };
    prepareBattle(battle, player, {
        health: 2000,
        maxHealth: 2000,
        attack: 35,
        behavior: 'aggressive'
    });
    battle.isDungeonBattle = true;
    battle.isLocationBattle = true;
    const beforeHealth = player.health;
    Math.random = () => 0.99; // deterministic basic attack, not a telegraph

    playerDefend();
    let safety = 0;
    while (callbacks.length && safety++ < 5) callbacks.shift()();

    const saved = Storage.load().player.dungeonProgress.forest.activeEncounter;
    assert.ok(Storage.load().player.health < beforeHealth);
    assert.equal(saved.turn, 'player');
    assert.equal(battle.turn, 'player');
});


test('a frozen expedition enemy saves the decremented effect and interrupted wind-up', (t) => {
    const { player, battle } = setup(t);
    const previousStorage = globalThis.localStorage;
    const values = new Map();
    globalThis.localStorage = {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
    };
    const callbacks = [];
    globalThis.setTimeout = callback => { callbacks.push(callback); return 1; };
    t.after(() => {
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
    });
    const location = {
        id: 'forest',
        inLocation: true,
        currentLocation: { id: 'forest' },
        activeEncounter: null
    };
    window.getLocationState = () => location;
    player.dungeonProgress = {
        forest: { campaignCycle: player.campaignCycle, stage: 1, enemiesDefeated: 0 }
    };
    prepareBattle(battle, player, {
        health: 2000,
        maxHealth: 2000,
        intent: 'heavy',
        effects: { freezeTurns: 2 }
    });
    battle.isDungeonBattle = true;
    battle.isLocationBattle = true;

    playerDefend();
    let safety = 0;
    while (callbacks.length && safety++ < 5) callbacks.shift()();

    const saved = Storage.load().player.dungeonProgress.forest.activeEncounter;
    assert.equal(saved.enemy.effects.freezeTurns, 1);
    assert.equal(saved.enemy.intent, null);
    assert.equal(saved.turn, 'player');
    assert.equal(battle.turn, 'player');
    assert.equal(saved.guardReduction, 0);
});

test('an expedition enemy adaptation is persisted before the next player turn', (t) => {
    const { player, battle } = setup(t);
    const previousStorage = globalThis.localStorage;
    const values = new Map();
    globalThis.localStorage = {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
    };
    const callbacks = [];
    globalThis.setTimeout = callback => { callbacks.push(callback); return 1; };
    t.after(() => {
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
    });
    const location = {
        id: 'forest',
        inLocation: true,
        currentLocation: { id: 'forest' },
        activeEncounter: null
    };
    window.getLocationState = () => location;
    player.dungeonProgress = {
        forest: { campaignCycle: player.campaignCycle, stage: 1, enemiesDefeated: 0 }
    };
    prepareBattle(battle, player, {
        health: 2000,
        maxHealth: 2000,
        pendingAdaptation: 'fire'
    });
    battle.isDungeonBattle = true;
    battle.isLocationBattle = true;

    playerDefend();
    let safety = 0;
    while (callbacks.length && safety++ < 5) callbacks.shift()();

    const saved = Storage.load().player.dungeonProgress.forest.activeEncounter;
    assert.deepEqual(saved.enemy.adaptiveResistance, { type: 'fire', turns: 2 });
    assert.equal(saved.enemy.pendingAdaptation, null);
    assert.equal(saved.turn, 'player');
    assert.equal(battle.turn, 'player');
});


test('a boss wind-up is saved as a warning and resolves the same signature attack on the next turn', (t) => {
    const { player, battle } = setup(t);
    const previousStorage = globalThis.localStorage;
    const previousRandom = Math.random;
    const values = new Map();
    globalThis.localStorage = {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
    };
    const callbacks = [];
    globalThis.setTimeout = callback => { callbacks.push(callback); return 1; };
    Math.random = () => 0.1;
    t.after(() => {
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
        Math.random = previousRandom;
    });
    const location = {
        id: 'forest',
        inLocation: true,
        currentLocation: { id: 'forest' },
        activeEncounter: null
    };
    window.getLocationState = () => location;
    player.dungeonProgress = {
        forest: { campaignCycle: player.campaignCycle, stage: 30, enemiesDefeated: 29 }
    };
    prepareBattle(battle, player, {
        id: 'forest_guardian',
        name: 'Страж леса',
        health: 2000,
        maxHealth: 2000,
        attack: 35,
        behavior: 'boss',
        phase: 1
    });
    battle.isDungeonBattle = true;
    battle.isLocationBattle = true;
    battle.isBossBattle = true;

    playerDefend();
    let safety = 0;
    while (callbacks.length && safety++ < 5) callbacks.shift()();

    let saved = Storage.load().player.dungeonProgress.forest.activeEncounter;
    assert.equal(saved.enemy.intent, 'heavy');
    assert.equal(saved.turn, 'player');
    assert.equal(battle.currentEnemy.intent, 'heavy');

    const beforeHealth = player.health;
    const beforeEnemyHealth = battle.currentEnemy.health;
    playerDefend();
    safety = 0;
    while (callbacks.length && safety++ < 5) callbacks.shift()();

    saved = Storage.load().player.dungeonProgress.forest.activeEncounter;
    assert.ok(saved.enemy.health < beforeEnemyHealth, 'warrior parry must be included in the committed enemy snapshot');
    assert.equal(saved.enemy.intent, null);
    assert.equal(saved.turn, 'player');
    assert.equal(battle.currentEnemy.intent, null);
    assert.ok(player.health < beforeHealth);
});

test('phoenix crown revival is saved exactly once with the surviving expedition encounter', (t) => {
    const { player, battle } = setup(t);
    const previousStorage = globalThis.localStorage;
    const values = new Map();
    globalThis.localStorage = {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
    };
    const callbacks = [];
    globalThis.setTimeout = callback => { callbacks.push(callback); return 1; };
    t.after(() => {
        if (previousStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previousStorage;
    });
    const location = {
        id: 'forest',
        inLocation: true,
        currentLocation: { id: 'forest' },
        activeEncounter: null
    };
    window.getLocationState = () => location;
    player.dungeonProgress = {
        forest: { campaignCycle: player.campaignCycle, stage: 30, enemiesDefeated: 29 }
    };
    player.relics = ['phoenix_crown'];
    player.activeRelics = ['phoenix_crown'];
    player.health = 1;
    prepareBattle(battle, player, {
        id: 'forest_guardian',
        name: 'Страж леса',
        health: 2000,
        maxHealth: 2000,
        attack: 100,
        behavior: 'boss',
        intent: 'heavy',
        phase: 1
    });
    battle.isDungeonBattle = true;
    battle.isLocationBattle = true;
    battle.isBossBattle = true;

    playerDefend();
    let safety = 0;
    while (callbacks.length && safety++ < 5) callbacks.shift()();

    const saved = Storage.load().player.dungeonProgress.forest.activeEncounter;
    const savedPlayer = Storage.load().player;
    assert.equal(saved.relicEffects.phoenixRebirthUsed, true);
    assert.equal(saved.turn, 'player');
    assert.equal(savedPlayer.health, Math.ceil(player.maxHealth * 0.2));
    assert.equal(battle.relicEffects.phoenixRebirthUsed, true);
});


test('mage cannot cast a skill without its full mana cost or mutate the encounter', (t) => {
    const { player, battle, notifications } = setup(t, 'mage');
    prepareBattle(battle, player, {
        id: 'world_eater',
        behavior: 'boss',
        health: 2000,
        maxHealth: 2000,
        effects: {},
        intent: 'cataclysm'
    });
    const skill = CLASSES.mage.skills.find(entry => entry.id === 'fireball');
    assert.ok(skill);
    player.mana = skill.manaCost - 1;
    const beforeHealth = battle.currentEnemy.health;
    const beforeEffects = structuredClone(battle.currentEnemy.effects);
    const beforeMana = player.mana;

    playerSkill(skill.id);

    assert.equal(player.mana, beforeMana);
    assert.equal(battle.currentEnemy.health, beforeHealth);
    assert.deepEqual(battle.currentEnemy.effects, beforeEffects);
    assert.equal(battle.currentEnemy.intent, 'cataclysm');
    assert.equal(battle.turn, 'player');
    assert.equal(battle.currentEnemy.health, beforeHealth);
});


test('failed expedition victory commit restores all rewards and retries the same encounter without advancing', (t) => {
    const { player, battle, notifications } = setup(t);
    prepareBattle(battle, player, {
        health: 0,
        expReward: 40,
        goldReward: 35,
        elite: true
    });
    battle.isLocationBattle = true;
    battle.isDungeonBattle = true;
    const beforePlayer = structuredClone(player);
    const scheduled = [];
    const locationState = { inLocation: true };
    let commitAttempts = 0;
    let restartCalls = 0;
    window.getLocationState = () => locationState;
    window.handleVictory = snapshot => {
        assert.deepEqual(snapshot, beforePlayer);
        commitAttempts++;
        return false;
    };
    window.startStageBattle = () => { restartCalls++; };
    globalThis.setTimeout = callback => { scheduled.push(callback); return scheduled.length; };
    Math.random = () => 0;

    battleVictory();

    assert.deepEqual(player, beforePlayer, 'failed persistence must roll back EXP, gold, stats and loot');
    assert.equal(battle.isActive, false, 'the unsaved result must not be shown as a committed victory');
    assert.equal(commitAttempts, 1);
    assert.equal(scheduled.length, 1, 'a retry of the current encounter must be scheduled');
    assert.match(notifications.at(-1)?.message || '', /не удалось сохранить награду боя/i);

    scheduled.shift()();
    assert.equal(restartCalls, 1, 'retry must restart the current stage encounter');
    assert.equal(player.stats.wins, beforePlayer.stats.wins);
    assert.equal(player.stats.kills, beforePlayer.stats.kills);
});


test('duplicate expedition victory callbacks commit rewards and stage transition exactly once', (t) => {
    const { player, battle } = setup(t);
    prepareBattle(battle, player, {
        health: 0,
        expReward: 40,
        goldReward: 35
    });
    battle.isLocationBattle = true;
    battle.isDungeonBattle = true;
    const before = structuredClone(player);
    const locationState = { inLocation: true };
    let commitCount = 0;
    window.getLocationState = () => locationState;
    window.handleVictory = () => {
        commitCount++;
        player.dungeonProgress.forest = {
            campaignCycle: 1,
            stage: 4,
            enemiesDefeated: 0
        };
        return true;
    };
    Math.random = () => 0;

    battleVictory();
    const afterFirstVictory = structuredClone(player);
    battleVictory();

    assert.equal(commitCount, 1, 'the durable progress commit must happen only once');
    assert.equal(player.experience, before.experience + 40);
    assert.equal(player.gold, before.gold + 35);
    assert.equal(player.stats.wins, before.stats.wins + 1);
    assert.equal(player.stats.kills, before.stats.kills + 1);
    assert.deepEqual(player.dungeonProgress, afterFirstVictory.dungeonProgress);
    assert.equal(battle.isActive, false);
});
