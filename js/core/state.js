// Управление состоянием игры
import { CLASSES } from '../data/classes.js';
import { QUESTS } from '../data/quests.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { Storage } from './storage.js';
import { LOCATIONS } from '../data/locations.js';
import { getItem } from '../data/items.js';
import { CURRENT_SAVE_VERSION, migrateSaveData } from './saveMigrations.js';
import { RUNE_CATALOG } from '../systems/enchanting.js';

function isPlainRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeNonNegativeInteger(value, fallback = 0) {
    return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function normalizeActiveEncounter(value) {
    if (!isPlainRecord(value) || !isPlainRecord(value.enemy)) return null;
    const enemy = value.enemy;
    if (typeof enemy.id !== 'string' || enemy.id.length > 100 ||
        typeof enemy.name !== 'string' || enemy.name.length > 200 ||
        !Number.isFinite(enemy.health) || enemy.health < 0 ||
        !Number.isFinite(enemy.maxHealth) || enemy.maxHealth <= 0 || enemy.health > enemy.maxHealth ||
        !Number.isFinite(enemy.attack) || enemy.attack < 0 ||
        !Number.isFinite(enemy.defense) || enemy.defense < 0) return null;
    let serialized;
    try {
        serialized = JSON.stringify(enemy);
        if (serialized.length > 16000) return null;
        const safeEnemy = JSON.parse(serialized);
        return {
            enemy: safeEnemy,
            isBossBattle: value.isBossBattle === true,
            turn: value.turn === 'enemy' ? 'enemy' : 'player',
            guardReduction: Number.isFinite(value.guardReduction)
                ? Math.max(0, Math.min(0.95, value.guardReduction)) : 0,
            relicEffects: isPlainRecord(value.relicEffects)
                ? Object.fromEntries(Object.entries(value.relicEffects)
                    .filter(([key, entry]) => /^[a-zA-Z0-9_]{1,60}$/.test(key) &&
                        (typeof entry === 'boolean' || (Number.isFinite(entry) && Math.abs(entry) <= 100000))))
                : { phoenixRebirthUsed: false }
        };
    } catch {
        return null;
    }
}

function migrateProgressEntries(savedEntries, definitions, completionField) {
    const existing = new Map(
        (Array.isArray(savedEntries) ? savedEntries : [])
            .filter(entry => isPlainRecord(entry) && typeof entry.id === 'string')
            .map(entry => [entry.id, entry])
    );
    return definitions.map(definition => {
        const saved = existing.get(definition.id) || {};
        const progress = Math.min(definition.target, safeNonNegativeInteger(saved.progress));
        return {
            id: definition.id,
            progress,
            completed: saved.completed === true || progress >= definition.target,
            [completionField]: saved[completionField] === true
        };
    });
}

function normalizePlayerSave(player) {
    const classData = CLASSES[player.class];
    if (!classData) return false;

    const defaults = classData.stats;
    const numericDefaults = {
        level: 1, experience: 0, maxExperience: 100,
        health: defaults.health, maxHealth: defaults.health,
        mana: defaults.mana, maxMana: defaults.mana,
        attack: defaults.attack, defense: defaults.defense,
        speed: defaults.speed, gold: 100
    };
    for (const [key, fallback] of Object.entries(numericDefaults)) {
        const value = player[key];
        const minimum = key === 'level' || key === 'maxExperience' ? 1 : 0;
        player[key] = Number.isFinite(value) && value >= minimum ? value : fallback;
    }
    player.level = Math.max(1, Math.floor(player.level));
    player.experience = Math.max(0, Math.floor(player.experience));
    player.maxExperience = Math.max(1, Math.floor(player.maxExperience));
    player.gold = Math.floor(player.gold);
    player.health = Math.min(player.maxHealth, Math.floor(player.health));
    player.mana = Math.min(player.maxMana, Math.floor(player.mana));

    if (!Array.isArray(player.inventory)) player.inventory = [];
    const inventory = new Map();
    for (const entry of player.inventory) {
        if (!isPlainRecord(entry) || typeof entry.id !== 'string' ||
            !getItem(entry.id) || !Number.isSafeInteger(entry.quantity) || entry.quantity <= 0) continue;
        const previous = inventory.get(entry.id) || 0;
        if (previous > Number.MAX_SAFE_INTEGER - entry.quantity) continue;
        inventory.set(entry.id, previous + entry.quantity);
    }
    player.inventory = [...inventory].map(([id, quantity]) => ({ id, quantity }));

    const equipment = isPlainRecord(player.equipment) ? player.equipment : {};
    player.equipment = {
        weapon: getItem(equipment.weapon)?.type === 'weapon' ? equipment.weapon : null,
        armor: getItem(equipment.armor)?.type === 'armor' ? equipment.armor : null
    };

    // Equipment progression is part of the save contract too. Normalize it
    // independently so malformed legacy fields cannot crash the forge or grant
    // unbounded stat bonuses after a reload.
    const savedUpgrades = isPlainRecord(player.itemUpgrades) ? player.itemUpgrades : {};
    player.itemUpgrades = Object.fromEntries(
        Object.entries(savedUpgrades)
            .filter(([id, level]) => ['weapon', 'armor'].includes(getItem(id)?.type) &&
                Number.isSafeInteger(level) && level >= 0)
            .map(([id, level]) => [id, Math.min(10, level)])
    );

    const savedWeaponRunes = isPlainRecord(player.weaponRunes) ? player.weaponRunes : {};
    player.weaponRunes = Object.fromEntries(
        Object.entries(savedWeaponRunes)
            .filter(([weaponId, runes]) => getItem(weaponId)?.type === 'weapon' && Array.isArray(runes))
            .map(([weaponId, runes]) => [
                weaponId,
                [...new Set(runes.filter(runeId => typeof runeId === 'string' &&
                    Object.hasOwn(RUNE_CATALOG, runeId)))].slice(0, 3)
            ])
            .filter(([, runes]) => runes.length > 0)
    );

    const validLocationIds = new Set(LOCATIONS.map(location => location.id));
    const unlocked = Array.isArray(player.unlockedLocations)
        ? player.unlockedLocations.filter(id => typeof id === 'string' && validLocationIds.has(id))
        : [];
    player.unlockedLocations = [...new Set(['forest', ...unlocked])];
    if (isPlainRecord(player.dungeonCheckpoints)) {
        player.dungeonCheckpoints = Object.fromEntries(
            Object.entries(player.dungeonCheckpoints).filter(([id, stage]) => {
                const location = LOCATIONS.find(entry => entry.id === id && entry.type !== 'safe');
                return location && Number.isInteger(stage) && stage > 0 && stage < location.stages.length;
            })
        );
    } else {
        player.dungeonCheckpoints = {};
    }

    player.discoveredItems = Array.isArray(player.discoveredItems)
        ? [...new Set(player.discoveredItems.filter(id => typeof id === 'string' && Boolean(getItem(id))))]
        : player.inventory.map(entry => entry.id);
    player.talents = Array.isArray(player.talents) ? player.talents.filter(id => typeof id === 'string') : [];
    player.relics = Array.isArray(player.relics) ? player.relics.filter(id => typeof id === 'string') : [];
    player.activeRelics = Array.isArray(player.activeRelics) ? player.activeRelics.filter(id => typeof id === 'string') : [];

    const statDefaults = {
        kills: 0, battles: 0, wins: 0, losses: 0,
        dungeonsCompleted: 0, bossesKilled: 0
    };
    const stats = isPlainRecord(player.stats) ? player.stats : {};
    player.stats = Object.fromEntries(Object.entries(statDefaults).map(([key, fallback]) =>
        [key, safeNonNegativeInteger(stats[key], fallback)]
    ));

    player.quests = migrateProgressEntries(player.quests, QUESTS, 'rewardClaimed');
    player.achievements = migrateProgressEntries(player.achievements, ACHIEVEMENTS, 'claimed');

    player.campaignCycle = Number.isSafeInteger(player.campaignCycle) && player.campaignCycle >= 1
        ? player.campaignCycle : 1;
    player.completedCampaignCycles = safeNonNegativeInteger(player.completedCampaignCycles);
    player.lastCompletedCampaignCycle = safeNonNegativeInteger(player.lastCompletedCampaignCycle);
    player.campaignCompleted = player.campaignCompleted === true;
    player.newGamePlusUnlocked = player.newGamePlusUnlocked === true || player.completedCampaignCycles > 0;
    if (player.campaignCompleted) {
        player.newGamePlusUnlocked = true;
        player.completedCampaignCycles = Math.max(1, player.completedCampaignCycles);
        player.lastCompletedCampaignCycle = player.campaignCycle;
    }
    if (isPlainRecord(player.locationRewardCycles)) {
        player.locationRewardCycles = Object.fromEntries(
            Object.entries(player.locationRewardCycles).filter(([id, cycle]) =>
                validLocationIds.has(id) && Number.isSafeInteger(cycle) && cycle >= 1 && cycle <= player.campaignCycle
            )
        );
    } else {
        player.locationRewardCycles = {};
    }

    if (isPlainRecord(player.deepChestRewardCycles)) {
        player.deepChestRewardCycles = Object.fromEntries(
            Object.entries(player.deepChestRewardCycles).filter(([key, cycle]) => {
                const separator = key.lastIndexOf(':');
                if (separator <= 0) return false;
                const locationId = key.slice(0, separator);
                const stageNumber = Number(key.slice(separator + 1));
                const location = LOCATIONS.find(entry => entry.id === locationId && entry.type !== 'safe');
                return location && Number.isSafeInteger(stageNumber) &&
                    stageNumber >= 20 && stageNumber <= location.totalStages && stageNumber % 10 === 0 &&
                    Number.isSafeInteger(cycle) && cycle >= 1 && cycle <= player.campaignCycle;
            })
        );
    } else {
        player.deepChestRewardCycles = {};
    }

    // Per-location resumable expedition snapshots. Treat localStorage as untrusted input.
    const savedDungeonProgress = isPlainRecord(player.dungeonProgress) ? player.dungeonProgress : {};
    player.dungeonProgress = {};
    for (const [locationId, progress] of Object.entries(savedDungeonProgress)) {
        const location = LOCATIONS.find(entry => entry.id === locationId && entry.type !== 'safe');
        if (!location || !isPlainRecord(progress) || progress.campaignCycle !== player.campaignCycle ||
            !Number.isSafeInteger(progress.stage) || progress.stage < 0 || progress.stage >= location.stages.length ||
            !Number.isSafeInteger(progress.enemiesDefeated) || progress.enemiesDefeated < 0 ||
            progress.enemiesDefeated > location.stages[progress.stage].enemiesCount) continue;
        const validStageList = value => Array.isArray(value)
            ? [...new Set(value.filter(stage => Number.isSafeInteger(stage) && stage >= 0 && stage < location.stages.length))]
            : [];
        const routeChoices = isPlainRecord(progress.routeChoices) ? Object.fromEntries(
            Object.entries(progress.routeChoices).filter(([stage, route]) =>
                Number.isSafeInteger(Number(stage)) && Number(stage) >= 0 &&
                Number(stage) < location.stages.length && typeof route === 'string' && route.length <= 40)
        ) : {};
        player.dungeonProgress[locationId] = {
            campaignCycle: player.campaignCycle,
            stage: progress.stage,
            enemiesDefeated: progress.enemiesDefeated,
            visitedEventStages: validStageList(progress.visitedEventStages),
            visitedRouteStages: validStageList(progress.visitedRouteStages),
            routeChoices,
            checkedSecretStages: validStageList(progress.checkedSecretStages),
            visitedCheckpointStages: validStageList(progress.visitedCheckpointStages),
            claimedDeepChestStages: validStageList(progress.claimedDeepChestStages),
            claimedUnbrokenBonusStages: validStageList(progress.claimedUnbrokenBonusStages),
            resumedFromCheckpoint: progress.resumedFromCheckpoint === true,
            travelerFavorFights: safeNonNegativeInteger(progress.travelerFavorFights, 0),
            travelerReturnPending: progress.travelerReturnPending === true,
            bloodPursuerPending: progress.bloodPursuerPending === true,
            finalBossDefeated: progress.finalBossDefeated === true,
            pendingAdventureEventId: typeof progress.pendingAdventureEventId === 'string' &&
                ['cache', 'moonwell', 'blood_contract', 'shrine', 'astral_study', 'campfire', 'vault', 'spark_altar', 'wounded_traveler', 'traveler_return', 'traveler'].includes(progress.pendingAdventureEventId)
                ? progress.pendingAdventureEventId : null,
            pendingSecretRoomId: ['armory', 'sanctuary', 'crypt'].includes(progress.pendingSecretRoomId)
                ? progress.pendingSecretRoomId : null,
            activeEncounter: normalizeActiveEncounter(progress.activeEncounter)
        };
    }

    if (!Number.isSafeInteger(player.id) || player.id < 0) player.id = Date.now();
    if (typeof player.username !== 'string' || !player.username.trim()) player.username = 'Игрок';
    if (typeof player.telegramId !== 'number' && typeof player.telegramId !== 'string') player.telegramId = 0;
    if (typeof player.createdAt !== 'string' || !Number.isFinite(Date.parse(player.createdAt))) {
        player.createdAt = new Date().toISOString();
    }
    return true;
}

function restoreUnlockedLocations(player) {
    const ids = new Set(Array.isArray(player.unlockedLocations) ? player.unlockedLocations : ['forest']);
    ids.add('forest');
    LOCATIONS.forEach(location => {
        location.unlocked = location.type === 'safe' || ids.has(location.id);
    });
    player.unlockedLocations = [...ids];
}

class GameState {
    constructor() {
        this.data = {
            player: null,
            screen: 'loading'
        };
    }
    
    get player() {
        return this.data.player;
    }
    
    set player(player) {
        this.data.player = player;
    }
    
    get screen() {
        return this.data.screen;
    }
    
    set screen(screen) {
        this.data.screen = screen;
    }
    
    createPlayer(classId) {
        const classData = CLASSES[classId];
        if (!classData) return null;
        
        this.player = {
            id: Date.now(),
            telegramId: globalThis.window?.Telegram?.WebApp?.initDataUnsafe?.user?.id || 0,
            username: globalThis.window?.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || 'Игрок',
            class: classId,
            level: 1,
            talents: [],
            relics: [],
            activeRelics: [],
            experience: 0,
            maxExperience: 100,
            health: classData.stats.health,
            maxHealth: classData.stats.health,
            mana: classData.stats.mana,
            maxMana: classData.stats.mana,
            attack: classData.stats.attack,
            defense: classData.stats.defense,
            speed: classData.stats.speed,
            gold: 100,
            campaignCycle: 1,
            completedCampaignCycles: 0,
            lastCompletedCampaignCycle: 0,
            campaignCompleted: false,
            newGamePlusUnlocked: false,
            campaignCompletedAt: null,
            locationRewardCycles: {},
            dungeonProgress: {},
            unlockedLocations: ['forest'],
            discoveredItems: [],
            inventory: [                { id: 'health_potion', quantity: 3 },
                { id: 'mana_potion', quantity: 2 }
            ],
            equipment: {
                weapon: null,
                armor: null
            },
            quests: QUESTS.map(quest => ({
                id: quest.id,
                progress: 0,
                completed: false,
                rewardClaimed: false
            })),
            achievements: ACHIEVEMENTS.map(achievement => ({
                id: achievement.id,
                progress: 0,
                completed: false,
                claimed: false
            })),
            stats: {
                kills: 0,
                battles: 0,
                wins: 0,
                losses: 0,
                dungeonsCompleted: 0,
                bossesKilled: 0
            },
            createdAt: new Date().toISOString()
        };
        restoreUnlockedLocations(this.player);
        
        return this.player;
    }
    
    save() {
        return Storage.save({ ...this.data, schemaVersion: CURRENT_SAVE_VERSION });
    }
    
    load() {
        const saved = Storage.load();
        const migrated = migrateSaveData(saved);
        if (migrated.ok && isPlainRecord(migrated.data.player) &&
            normalizePlayerSave(migrated.data.player)) {
            this.data = { player: migrated.data.player, screen: 'main-menu' };
            restoreUnlockedLocations(this.player);
            return true;
        }
        return false;
    }

    canRestoreRecovery() {
        const recovery = Storage.loadRecovery();
        if (!isPlainRecord(recovery)) return false;
        let candidate;
        try {
            candidate = JSON.parse(JSON.stringify(recovery));
        } catch {
            return false;
        }
        const migrated = migrateSaveData(candidate);
        return migrated.ok && isPlainRecord(migrated.data.player) &&
            normalizePlayerSave(migrated.data.player);
    }

    restoreRecovery() {
        const recovery = Storage.loadRecovery();
        if (!isPlainRecord(recovery)) return false;
        let candidate;
        try {
            candidate = JSON.parse(JSON.stringify(recovery));
        } catch {
            return false;
        }
        const migrated = migrateSaveData(candidate);
        if (!migrated.ok || !isPlainRecord(migrated.data.player) ||
            !normalizePlayerSave(migrated.data.player)) return false;

        const restoredData = {
            schemaVersion: CURRENT_SAVE_VERSION,
            player: migrated.data.player,
            screen: 'main-menu'
        };
        let restored = false;
        try {
            restored = Storage.restoreRecovery(restoredData) === true;
        } catch {
            restored = false;
        }
        if (!restored) return false;

        this.data = { player: restoredData.player, screen: 'main-menu' };
        restoreUnlockedLocations(this.player);
        return true;
    }
}

export const gameState = new GameState();
