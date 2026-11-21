import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../js/core/state.js';
import { CLASSES } from '../js/data/classes.js';
import { startBattle, playerAttack, playerSkill, playerUseItem, getBattleState } from '../js/ui/battle.js';

function setup(t, classId = 'warrior') {
    const previousPlayer = gameState.player;
    const previousSave = gameState.save;
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousRandom = Math.random;
    const previousTimeout = globalThis.setTimeout;
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
        playerSprite: { x: 0, y: 0, isAttacking: false, receiveHit() { this.hitCount = (this.hitCount || 0) + 1; } },
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
    const { playerDefend } = await import('../js/ui/battle.js');
    playerDefend();

    assert.deepEqual(player, beforePlayer);
    assert.deepEqual(enemy, beforeEnemy);
    assert.equal(battle.turn, 'player');
    assert.match(notifications[0]?.message || '', /ход противника/);
});
