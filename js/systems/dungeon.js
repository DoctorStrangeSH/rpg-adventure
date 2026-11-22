// Система локаций с этапами
import { gameState } from '../core/state.js';
import { createPlayerSnapshot, commitPlayerMutation } from './playerTransactions.js';
import { LOCATIONS, getLocation, unlockNextLocation } from '../data/locations.js';
import { getRandomEnemy } from '../data/enemies.js';
import { getItem } from '../data/items.js';
import { isDungeonBattleActive, restoreDungeonEncounter, startDungeonEncounter } from '../ports/dungeonBattlePort.js';
import { canGrantItems, claimDeepChestAttempt, grantItemsAtomically, rollDeepChest } from './loot.js';
import { rollAdventureEvent, resolveAdventureEvent, getAdventureChoiceLock, getAdventureEvent } from './adventureEvents.js';
import { DUNGEON_ROUTES, getRoute, applyRouteToEnemy } from './dungeonRoutes.js';
import { SECRET_ROOMS, rollSecretRoom, resolveSecretRoom } from './secretRooms.js';
import { awardTravelerFavor, consumeTravelerFavor } from './expeditionFavor.js';
import { scheduleBloodPursuer, applyBloodPursuer } from './contractPursuit.js';
import { completeCampaign, canClaimLocationReward, claimLocationReward } from './newGamePlus.js';

let locationState = {
    currentLocation: null,
    currentStage: 0,
    enemiesDefeated: 0,
    inLocation: false,
    runId: 0,
    pendingEvent: null,
    visitedEventStages: new Set(),
    pendingRoute: null,
    visitedRouteStages: new Set(),
    routeChoices: {},
    checkedSecretStages: new Set(),
    pendingSecretRoom: null,
    pendingCheckpoint: null,
    visitedCheckpointStages: new Set(),
    claimedDeepChestStages: new Set(),
    claimedUnbrokenBonusStages: new Set(),
    resumedFromCheckpoint: false,
    travelerFavorFights: 0,
    travelerReturnPending: false,
    bloodPursuerPending: false,
    finalBossDefeated: false,
    activeEncounter: null
};

export function getUnbrokenExpeditionBonus(stageNumber, boss, resumed = false) {
    if (resumed || !Number.isInteger(stageNumber) || stageNumber < 20 || stageNumber % 10 !== 0 ||
        !boss || !Number.isFinite(boss.expReward) || !Number.isFinite(boss.goldReward)) {
        return { exp: 0, gold: 0 };
    }
    const fraction = stageNumber >= 30 ? 0.2 : 0.15;
    return {
        exp: Math.max(0, Math.floor(boss.expReward * fraction)),
        gold: Math.max(0, Math.floor(boss.goldReward * fraction))
    };
}

export function getExpeditionDepthModifiers(stageNumber) {
    const stage = Number.isFinite(stageNumber) ? Math.max(1, Math.floor(stageNumber)) : 1;
    const tier = Math.min(6, Math.floor((stage - 1) / 5));
    return {
        tier,
        health: 1 + tier * 0.04,
        attack: 1 + tier * 0.03,
        reward: 1 + tier * 0.08
    };
}

function persistDungeonProgress() {
    const player = gameState.player;
    const location = locationState.currentLocation;
    if (!player || !location) return false;
    player.dungeonProgress ||= {};
    player.dungeonProgress[location.id] = {
        campaignCycle: player.campaignCycle || 1,
        stage: locationState.currentStage,
        enemiesDefeated: locationState.enemiesDefeated,
        visitedEventStages: [...locationState.visitedEventStages],
        visitedRouteStages: [...locationState.visitedRouteStages],
        routeChoices: { ...locationState.routeChoices },
        checkedSecretStages: [...locationState.checkedSecretStages],
        visitedCheckpointStages: [...locationState.visitedCheckpointStages],
        claimedDeepChestStages: [...locationState.claimedDeepChestStages],
        claimedUnbrokenBonusStages: [...locationState.claimedUnbrokenBonusStages],
        resumedFromCheckpoint: locationState.resumedFromCheckpoint,
        travelerFavorFights: locationState.travelerFavorFights,
        travelerReturnPending: locationState.travelerReturnPending,
        bloodPursuerPending: locationState.bloodPursuerPending,
        finalBossDefeated: locationState.finalBossDefeated,
        pendingAdventureEventId: locationState.pendingEvent?.id || null,
        pendingSecretRoomId: locationState.pendingSecretRoom?.id || null,
        activeEncounter: locationState.activeEncounter ? structuredClone(locationState.activeEncounter) : null
    };
    return true;
}

function clearDungeonProgress(player, locationId) {
    if (player?.dungeonProgress && locationId) delete player.dungeonProgress[locationId];
}

function commitDungeonProgress(rollback) {
    const player = gameState.player;
    const hadContainer = Boolean(player?.dungeonProgress);
    const previousProgress = hadContainer ? structuredClone(player.dungeonProgress) : null;
    persistDungeonProgress();
    let saved = false;
    try {
        saved = gameState.save() === true;
    } catch {
        saved = false;
    }
    if (saved) return true;
    if (player) {
        if (hadContainer) player.dungeonProgress = previousProgress;
        else delete player.dungeonProgress;
    }
    rollback?.();
    window.showNotification?.('Не удалось сохранить состояние экспедиции. Переход отменён — попробуйте ещё раз.', 'error');
    return false;
}

function restoreStageSet(value) {
    return new Set(Array.isArray(value) ? value : []);
}

function snapshotPlayer() {
    return gameState.player ? structuredClone(gameState.player) : null;
}

function restorePlayer(snapshot) {
    const player = gameState.player;
    if (!player || !snapshot) return;
    for (const key of Object.keys(player)) {
        if (!Object.hasOwn(snapshot, key)) delete player[key];
    }
    Object.assign(player, snapshot);
}

export function getDungeonCheckpoint(player, locationId, location = getLocation(locationId)) {
    const stage = player?.dungeonCheckpoints?.[locationId];
    return Number.isInteger(stage) && stage > 0 && stage < (location?.stages?.length || 0) ? stage : 0;
}

export function startLocation(locationId) {
    const player = gameState.player;
    const location = getLocation(locationId);
    
    if (!player || !location) {
        window.showNotification('Локация не найдена!', 'error');
        return;
    }
    
    if (!location.unlocked) {
        window.showNotification('Локация закрыта! Пройдите предыдущую.', 'error');
        return;
    }
    
    if (player.level < location.minLevel) {
        window.showNotification(`Требуется ${location.minLevel} уровень!`, 'error');
        return;
    }
    
    if (player.health <= 0) {
        window.showNotification('Вы мертвы! Восстановите здоровье в деревне.', 'error');
        return;
    }
    if (locationState.inLocation || isDungeonBattleActive()) return;
    
    locationState.currentLocation = location;
    const savedProgress = player.dungeonProgress?.[locationId];
    const resumeStage = savedProgress?.campaignCycle === player.campaignCycle
        ? savedProgress.stage : getDungeonCheckpoint(player, locationId, location);
    locationState.currentStage = resumeStage;
    locationState.enemiesDefeated = savedProgress?.campaignCycle === player.campaignCycle
        ? savedProgress.enemiesDefeated : 0;
    locationState.inLocation = true;
    locationState.pendingEvent = null;
    locationState.visitedEventStages = restoreStageSet(savedProgress?.visitedEventStages);
    locationState.pendingRoute = null;
    locationState.visitedRouteStages = restoreStageSet(savedProgress?.visitedRouteStages);
    locationState.routeChoices = savedProgress?.routeChoices && typeof savedProgress.routeChoices === 'object'
        ? { ...savedProgress.routeChoices } : {};
    locationState.checkedSecretStages = restoreStageSet(savedProgress?.checkedSecretStages);
    locationState.pendingSecretRoom = null;
    locationState.pendingCheckpoint = null;
    locationState.visitedCheckpointStages = restoreStageSet(savedProgress?.visitedCheckpointStages);
    if (resumeStage > 0 && !savedProgress) locationState.visitedCheckpointStages.add(resumeStage);
    locationState.claimedDeepChestStages = restoreStageSet(savedProgress?.claimedDeepChestStages);
    locationState.claimedUnbrokenBonusStages = restoreStageSet(savedProgress?.claimedUnbrokenBonusStages);
    locationState.resumedFromCheckpoint = savedProgress?.resumedFromCheckpoint === true || (!savedProgress && resumeStage > 0);
    locationState.travelerFavorFights = savedProgress?.travelerFavorFights || 0;
    locationState.travelerReturnPending = savedProgress?.travelerReturnPending === true;
    locationState.bloodPursuerPending = savedProgress?.bloodPursuerPending === true;
    locationState.finalBossDefeated = savedProgress?.finalBossDefeated === true;
    locationState.activeEncounter = savedProgress?.activeEncounter &&
        savedProgress.stage === resumeStage ? structuredClone(savedProgress.activeEncounter) : null;
    const previousProgress = savedProgress ? JSON.parse(JSON.stringify(savedProgress)) : null;
    const hadPreviousProgress = Boolean(savedProgress);
    const hadProgressContainer = Boolean(player.dungeonProgress);
    const runId = ++locationState.runId;
    if (savedProgress?.pendingAdventureEventId && getAdventureEvent(savedProgress.pendingAdventureEventId)) {
        locationState.pendingEvent = { id: savedProgress.pendingAdventureEventId, stage: resumeStage, runId };
    }
    if (savedProgress?.pendingSecretRoomId && SECRET_ROOMS.some(room => room.id === savedProgress.pendingSecretRoomId)) {
        locationState.pendingSecretRoom = { id: savedProgress.pendingSecretRoomId, stage: resumeStage, runId };
    }
    persistDungeonProgress();
    if (gameState.save() !== true) {
        if (hadPreviousProgress) player.dungeonProgress[locationId] = previousProgress;
        else delete player.dungeonProgress[locationId];
        if (!hadProgressContainer) delete player.dungeonProgress;
        resetLocationState();
        window.showNotification?.('Не удалось сохранить состояние экспедиции. Вход отменён — проверьте свободное место хранилища и попробуйте снова.', 'error');
        return;
    }
    
    // Показываем экран боя
    window.showScreen('battle-screen');
    
    // Сразу начинаем первый бой
    setTimeout(() => {
        if (locationState.inLocation && locationState.runId === runId) startStageBattle();
    }, 500);
}

export function startStageBattle() {
    if (!locationState.inLocation || isDungeonBattleActive()) return;
    if (locationState.activeEncounter) {
        if (restoreDungeonEncounter(locationState.activeEncounter)) return;
        const invalidEncounter = locationState.activeEncounter;
        locationState.activeEncounter = null;
        persistDungeonProgress();
        let cleared = false;
        try { cleared = gameState.save() === true; } catch { cleared = false; }
        if (!cleared) {
            locationState.activeEncounter = invalidEncounter;
            window.showNotification?.('Не удалось очистить повреждённый снимок боя. Экспедиция не изменена — повторите загрузку.', 'error');
            return;
        }
        window.showNotification?.('Снимок предыдущего боя повреждён. Этап сохранён; противник будет создан заново.', 'error');
    }
    // The stage must wait for the player's choice; duplicate callbacks must
    // never bypass an unresolved encounter or overwrite its buttons.
    if (locationState.pendingEvent) { presentAdventureEvent(locationState.pendingEvent.id); return; }
    if (locationState.pendingSecretRoom) { presentSecretRoom(locationState.pendingSecretRoom.id); return; }
    if (locationState.pendingRoute || locationState.pendingCheckpoint) return;
    const location = locationState.currentLocation;
    
    if (!location || !location.stages) {
        console.error('No location or stages');
        return;
    }
    
    const stage = location.stages[locationState.currentStage];
    
    if (!stage) {
        console.error('No stage found at index:', locationState.currentStage);
        completeLocation();
        return;
    }

    // Before every fifth stage, the hero can leave safely and resume later.
    // A resumed stage does not present the same checkpoint twice.
    if (locationState.currentStage > 0 && (locationState.currentStage + 1) % 5 === 0 &&
        !locationState.visitedCheckpointStages.has(locationState.currentStage)) {
        presentDungeonCheckpoint();
        return;
    }

    // Every fifth stage offers a one-time detour between battles. It is not
    // re-rolled when the player chooses and returns to the same stage.
    if (locationState.currentStage > 0 && (locationState.currentStage + 1) % 5 === 0 &&
        !locationState.visitedEventStages.has(locationState.currentStage)) {
        presentAdventureEvent();
        return;
    }
    if ((locationState.currentStage + 1) % 10 === 3 &&
        !locationState.visitedRouteStages.has(locationState.currentStage)) {
        presentRouteChoice();
        return;
    }
    // A passage can appear once per run on every seventh stage. Persist the
    // consumed roll before showing the room, so reloads cannot reroll it.
    if ((locationState.currentStage + 1) % 7 === 0 &&
        !locationState.checkedSecretStages.has(locationState.currentStage)) {
        const checkedStage = locationState.currentStage;
        locationState.checkedSecretStages.add(checkedStage);
        if (!commitDungeonProgress(() => locationState.checkedSecretStages.delete(checkedStage))) return;
        if (Math.random() < 0.45) {
            presentSecretRoom();
            return;
        }
    }

    // A restored stage may already have cleared all regular enemies and be
    // waiting for its boss (or for the stage transition after the final mob).
    if (locationState.enemiesDefeated >= stage.enemiesCount) {
        if (stage.boss) {
            startBossFight(stage.boss);
            return;
        }
        const previousStage = locationState.currentStage;
        const previousDefeated = locationState.enemiesDefeated;
        const previousProgress = gameState.player?.dungeonProgress
            ? structuredClone(gameState.player.dungeonProgress) : null;
        locationState.currentStage++;
        locationState.enemiesDefeated = 0;
        persistDungeonProgress();
        let saved = false;
        try {
            saved = gameState.save() === true;
        } catch {
            saved = false;
        }
        if (!saved) {
            locationState.currentStage = previousStage;
            locationState.enemiesDefeated = previousDefeated;
            if (gameState.player) {
                if (previousProgress) gameState.player.dungeonProgress = previousProgress;
                else delete gameState.player.dungeonProgress;
            }
            window.showNotification?.('Не удалось сохранить переход этапа. Экспедиция сохранена на прежнем этапе — попробуйте снова.', 'error');
            return;
        }
        startStageBattle();
        return;
    }

    const enemyData = getRandomEnemy(stage.enemies);
    if (!enemyData) {
        console.error('No enemy data for:', stage.enemies);
        return;
    }
    
    // Усиливаем врага
    const locationIndex = getLocationIndex(location.id);
    const stageMultiplier = 1 + (stage.stage * 0.1) + (locationIndex * 0.5);
    const depth = getExpeditionDepthModifiers(stage.stage);
    
    let enemy = {
        ...enemyData,
        health: Math.floor(enemyData.health * stageMultiplier * depth.health),
        maxHealth: Math.floor(enemyData.health * stageMultiplier * depth.health),
        attack: Math.floor(enemyData.attack * (1 + stage.stage * 0.05 + locationIndex * 0.3) * depth.attack),
        defense: Math.floor(enemyData.defense * (1 + stage.stage * 0.05 + locationIndex * 0.3)),
        expReward: Math.floor(enemyData.expReward * stageMultiplier * depth.reward),
        goldReward: Math.floor(enemyData.goldReward * stageMultiplier * depth.reward)
    };
    const player = gameState.player;
    const playerBeforeStart = createPlayerSnapshot(player);
    if (!playerBeforeStart) {
        window.showNotification?.('Не удалось подготовить начало боя. Экспедиция не изменена.', 'error');
        return;
    }
    const previousFavorCharges = locationState.travelerFavorFights;
    const previousPursuerPending = locationState.bloodPursuerPending;
    const previousActiveEncounter = locationState.activeEncounter;
    const routeId = locationState.routeChoices[locationState.currentStage];
    if (routeId) enemy = applyRouteToEnemy(enemy, routeId);
    const favor = consumeTravelerFavor(enemy, locationState.travelerFavorFights);
    enemy = favor.enemy;
    locationState.travelerFavorFights = favor.charges;
    const pursuer = applyBloodPursuer(enemy, locationState.bloodPursuerPending);
    enemy = pursuer.enemy;
    if (pursuer.pursued) locationState.bloodPursuerPending = false;

    locationState.activeEncounter = {
        enemy: structuredClone(enemy),
        isBossBattle: false,
        turn: 'player',
        guardReduction: 0,
        relicEffects: { phoenixRebirthUsed: false }
    };
    player.stats.battles++;
    persistDungeonProgress();
    if (!commitPlayerMutation(player, playerBeforeStart, () => gameState.save())) {
        locationState.travelerFavorFights = previousFavorCharges;
        locationState.bloodPursuerPending = previousPursuerPending;
        locationState.activeEncounter = previousActiveEncounter;
        window.showNotification?.('Не удалось сохранить начало боя. Счётчик и бонусы восстановлены — повторите запуск.', 'error');
        const ui = typeof document !== 'undefined' ? document.getElementById('battle-ui') : null;
        if (ui) {
            ui.innerHTML = `<section class="adventure-event" aria-label="Повтор запуска боя">
                <div class="adventure-event-icon">⚠️</div>
                <h3>Бой не сохранён</h3>
                <p>Прогресс экспедиции сохранён. Повторите запуск, когда хранилище будет доступно.</p>
                <button class="battle-btn" onclick="window.startStageBattle()">🔄 Повторить запуск боя</button>
            </section>`;
        } else {
            window.showScreen?.('map-screen');
        }
        return;
    }

    // Battle state, sprites and animation belong to the UI adapter, not dungeon rules.
    const bossText = stage.boss ? ' 👹 БОСС!' : '';
    const battleMessage = `${location.name} - Этап ${stage.stage}/${location.stages.length}${bossText}${depth.tier ? ` ⚠️ Глубина ${depth.tier + 1}: награды +${Math.round((depth.reward - 1) * 100)}%` : ''}${favor.protected ? ' 🛡️ Защита странника: атака врага −15%' : ''}${pursuer.pursued ? ' 🩸 Вас настиг преследователь печати: враг сильнее, награды +25%' : ''}`;
    if (!startDungeonEncounter({ enemy, message: battleMessage })) {
        window.showNotification?.('Не удалось отобразить бой. Сохранённый противник будет восстановлен при повторной попытке.', 'error');
    };
}

function presentDungeonCheckpoint() {
    const stage = locationState.currentStage;
    locationState.pendingCheckpoint = { stage, runId: locationState.runId };
    const ui = document.getElementById('battle-ui');
    if (!ui) {
        const pending = locationState.pendingCheckpoint;
        locationState.pendingCheckpoint = null;
        locationState.visitedCheckpointStages.add(stage);
        if (!commitDungeonProgress(() => {
            locationState.pendingCheckpoint = pending;
            locationState.visitedCheckpointStages.delete(stage);
        })) return;
        startStageBattle();
        return;
    }
    ui.innerHTML = `<section class="adventure-event" aria-label="Контрольная точка экспедиции">
        <div class="adventure-event-icon">🏕️</div><h3>Привал экспедиции</h3>
        <p>Этап ${stage + 1}. Можно продолжить путь или вернуться в деревню и возобновить экспедицию с этого этапа.</p>
        <button class="battle-btn" onclick="window.chooseDungeonCheckpoint('continue')">⚔️ Продолжить экспедицию</button>
        <button class="battle-btn" onclick="window.chooseDungeonCheckpoint('retreat')">🏠 Вернуться и сохранить точку</button>
    </section>`;
}

export function chooseDungeonCheckpoint(choice) {
    const pending = locationState.pendingCheckpoint;
    if (!pending || !['continue', 'retreat'].includes(choice) || !locationState.inLocation ||
        isDungeonBattleActive() || pending.runId !== locationState.runId ||
        pending.stage !== locationState.currentStage) return false;

    if (choice === 'continue') {
        locationState.pendingCheckpoint = null;
        locationState.visitedCheckpointStages.add(pending.stage);
        startStageBattle();
        return true;
    }

    const player = gameState.player;
    if (!player) return false;
    player.dungeonCheckpoints ||= {};
    const locationId = locationState.currentLocation.id;
    const hadPreviousCheckpoint = Object.hasOwn(player.dungeonCheckpoints, locationId);
    const previousCheckpoint = player.dungeonCheckpoints[locationId];
    const previousProgress = player.dungeonProgress?.[locationId]
        ? JSON.parse(JSON.stringify(player.dungeonProgress[locationId])) : null;
    const previousEnemiesDefeated = locationState.enemiesDefeated;
    const previousResumedFromCheckpoint = locationState.resumedFromCheckpoint;
    locationState.visitedCheckpointStages.add(pending.stage);
    player.dungeonCheckpoints[locationId] = pending.stage;
    locationState.enemiesDefeated = 0;
    locationState.resumedFromCheckpoint = true;
    persistDungeonProgress();

    // Do not leave the expedition until its resume point is durably saved.
    if (gameState.save() !== true) {
        if (hadPreviousCheckpoint) player.dungeonCheckpoints[locationId] = previousCheckpoint;
        else delete player.dungeonCheckpoints[locationId];
        if (previousProgress) player.dungeonProgress[locationId] = previousProgress;
        else clearDungeonProgress(player, locationId);
        locationState.visitedCheckpointStages.delete(pending.stage);
        locationState.enemiesDefeated = previousEnemiesDefeated;
        locationState.resumedFromCheckpoint = previousResumedFromCheckpoint;
        window.showNotification?.('Не удалось сохранить контрольную точку. Экспедиция не прервана — попробуйте ещё раз.', 'error');
        return false;
    }

    locationState.pendingCheckpoint = null;
    locationState.runId++;
    locationState.inLocation = false;
    locationState.currentLocation = null;
    locationState.currentStage = 0;
    locationState.enemiesDefeated = 0;
    locationState.pendingEvent = null;
    locationState.pendingRoute = null;
    locationState.pendingSecretRoom = null;
    window.exitBattle?.();
    window.showScreen?.('map-screen');
    window.showNotification?.('🏕️ Контрольная точка сохранена. Можно продолжить экспедицию позже.', 'success');
    return true;
}

function presentRouteChoice() {
    if (locationState.pendingRoute) return;
    const stage = locationState.currentStage;
    locationState.pendingRoute = { stage, runId: locationState.runId };
    const ui = document.getElementById('battle-ui');
    if (!ui) {
        const pending = locationState.pendingRoute;
        locationState.pendingRoute = null;
        locationState.visitedRouteStages.add(stage);
        const hadChoice = Object.hasOwn(locationState.routeChoices, stage);
        const previousChoice = locationState.routeChoices[stage];
        locationState.routeChoices[stage] = 'safe';
        if (!commitDungeonProgress(() => {
            locationState.pendingRoute = pending;
            locationState.visitedRouteStages.delete(stage);
            if (hadChoice) locationState.routeChoices[stage] = previousChoice;
            else delete locationState.routeChoices[stage];
        })) return;
        startStageBattle();
        return;
    }
    ui.innerHTML = `<section class="adventure-event" aria-label="Выбор маршрута">
        <div class="adventure-event-icon">🧭</div><h3>Перекрёсток</h3>
        <p>Какую дорогу вы выберете перед следующим боем?</p>
        ${Object.values(DUNGEON_ROUTES).map(route => `<button class="battle-btn" onclick="window.chooseDungeonRoute('${route.id}')">${route.icon} ${route.name} — ${route.description}</button>`).join('')}
    </section>`;
    window.showBattleMessage?.('🧭 Перед вами развилка.');
}

export function chooseDungeonRoute(routeId) {
    const pending = locationState.pendingRoute;
    if (!pending || !getRoute(routeId) || !locationState.inLocation ||
        isDungeonBattleActive() || pending.runId !== locationState.runId ||
        pending.stage !== locationState.currentStage) return false;
    const playerSnapshot = snapshotPlayer();
    const hadPreviousChoice = Object.hasOwn(locationState.routeChoices, pending.stage);
    const previousChoice = locationState.routeChoices[pending.stage];
    const wasVisited = locationState.visitedRouteStages.has(pending.stage);
    locationState.routeChoices[pending.stage] = routeId;
    locationState.visitedRouteStages.add(pending.stage);
    locationState.pendingRoute = null;
    persistDungeonProgress();
    if (gameState.save() !== true) {
        restorePlayer(playerSnapshot);
        if (hadPreviousChoice) locationState.routeChoices[pending.stage] = previousChoice;
        else delete locationState.routeChoices[pending.stage];
        if (!wasVisited) locationState.visitedRouteStages.delete(pending.stage);
        locationState.pendingRoute = pending;
        window.showNotification?.('Не удалось сохранить выбор маршрута. Выбор не применён — попробуйте ещё раз.', 'error');
        return false;
    }
    window.showNotification?.(`Вы выбрали: ${getRoute(routeId).name}`, 'info');
    startStageBattle();
    return true;
}

function presentAdventureEvent(resumeEventId = null) {
    const stage = locationState.currentStage;
    const resumed = Boolean(locationState.pendingEvent);
    const event = resumed ? getAdventureEvent(resumeEventId || locationState.pendingEvent.id) :
        (locationState.travelerReturnPending ? getAdventureEvent('traveler_return') : rollAdventureEvent());
    if (!event) return;
    const previousTravelerReturnPending = locationState.travelerReturnPending;
    if (!resumed) {
        if (locationState.travelerReturnPending) locationState.travelerReturnPending = false;
        locationState.pendingEvent = { id: event.id, stage, runId: locationState.runId };
        if (!commitDungeonProgress(() => {
            locationState.pendingEvent = null;
            locationState.travelerReturnPending = previousTravelerReturnPending;
        })) return;
    }
    const ui = document.getElementById('battle-ui');
    if (!ui) { // If no UI is mounted, consume the event and persist the fallback.
        const pending = locationState.pendingEvent;
        const previousTravelerReturnPending = locationState.travelerReturnPending;
        locationState.visitedEventStages.add(stage);
        locationState.pendingEvent = null;
        if (!commitDungeonProgress(() => {
            locationState.visitedEventStages.delete(stage);
            locationState.pendingEvent = pending;
            locationState.travelerReturnPending = previousTravelerReturnPending;
        })) return;
        startStageBattle();
        return;
    }
    ui.innerHTML = `<section class="adventure-event" aria-label="Событие приключения">
        <div class="adventure-event-icon">${event.icon}</div>
        <h3>${event.name}</h3><p>${event.description}</p>
        ${event.choices.map(choice => { const lock = getAdventureChoiceLock(gameState.player, event.id, choice.id); return `<button class="battle-btn" ${lock ? 'disabled aria-disabled="true"' : `onclick="window.chooseAdventureEvent('${choice.id}')"`}>${choice.label}${lock ? `<small>🔒 ${lock}</small>` : ''}</button>`; }).join('')}
    </section>`;
    window.showBattleMessage?.(`🧭 Событие: ${event.name}`);
}

export function chooseAdventureEvent(choiceId) {
    const pending = locationState.pendingEvent;
    if (!pending || !locationState.inLocation || pending.runId !== locationState.runId ||
        pending.stage !== locationState.currentStage || isDungeonBattleActive()) return false;
    const playerSnapshot = snapshotPlayer();
    const previousFavorFights = locationState.travelerFavorFights;
    const previousTravelerReturnPending = locationState.travelerReturnPending;
    const previousBloodPursuerPending = locationState.bloodPursuerPending;
    const previousPendingRoute = locationState.pendingRoute;
    const wasVisited = locationState.visitedEventStages.has(pending.stage);
    const outcome = resolveAdventureEvent(gameState.player, pending.id, choiceId);
    if (!outcome) {
        window.showNotification?.('Недостаточно ресурсов для выбранного действия или неверный выбор.', 'error');
        return false;
    }
    locationState.travelerFavorFights = awardTravelerFavor(locationState.travelerFavorFights, pending.id, choiceId);
    if (pending.id === 'wounded_traveler' && choiceId === 'risk')
        locationState.travelerReturnPending = true;
    if (scheduleBloodPursuer(pending.id, choiceId, outcome))
        locationState.bloodPursuerPending = true;
    locationState.visitedEventStages.add(pending.stage);
    locationState.pendingEvent = null;
    locationState.pendingRoute = null;
    persistDungeonProgress();
    if (gameState.save() !== true) {
        restorePlayer(playerSnapshot);
        locationState.travelerFavorFights = previousFavorFights;
        locationState.travelerReturnPending = previousTravelerReturnPending;
        locationState.bloodPursuerPending = previousBloodPursuerPending;
        locationState.pendingRoute = previousPendingRoute;
        if (!wasVisited) locationState.visitedEventStages.delete(pending.stage);
        locationState.pendingEvent = pending;
        window.showNotification?.('Не удалось сохранить исход события. Ресурсы и выбор восстановлены — попробуйте ещё раз.', 'error');
        return false;
    }
    window.showNotification?.(outcome.message, 'info');
    startStageBattle();
    return true;
}

function presentSecretRoom(resumeRoomId = null) {
    const resumed = Boolean(locationState.pendingSecretRoom);
    const room = resumed ? SECRET_ROOMS.find(entry => entry.id === (resumeRoomId || locationState.pendingSecretRoom.id)) : rollSecretRoom();
    if (!room) return;
    const stage = locationState.currentStage;
    if (!resumed) {
        locationState.pendingSecretRoom = { id: room.id, stage, runId: locationState.runId };
        if (!commitDungeonProgress(() => { locationState.pendingSecretRoom = null; })) return;
    }
    const ui = document.getElementById('battle-ui');
    if (!ui) {
        const pending = locationState.pendingSecretRoom;
        locationState.pendingSecretRoom = null;
        if (!commitDungeonProgress(() => { locationState.pendingSecretRoom = pending; })) return;
        startStageBattle();
        return;
    }
    ui.innerHTML = `<section class="adventure-event" aria-label="Секретная комната">
        <div class="adventure-event-icon">${room.icon}</div><h3>${room.name}</h3>
        <p>${room.description}</p>
        <button class="battle-btn" onclick="window.chooseSecretRoom('explore')">🔎 Исследовать — риск и награда</button>
        <button class="battle-btn" onclick="window.chooseSecretRoom('leave')">🚶 Пройти мимо</button>
    </section>`;
    window.showBattleMessage?.(`🔑 Обнаружена секретная комната: ${room.name}`);
}

export function chooseSecretRoom(choice) {
    const pending = locationState.pendingSecretRoom;
    if (!pending || !locationState.inLocation || pending.runId !== locationState.runId ||
        pending.stage !== locationState.currentStage || isDungeonBattleActive()) return false;
    const playerSnapshot = snapshotPlayer();
    const outcome = resolveSecretRoom(gameState.player, pending.id, choice);
    if (!outcome) return false;
    locationState.pendingSecretRoom = null;
    persistDungeonProgress();
    if (gameState.save() !== true) {
        restorePlayer(playerSnapshot);
        locationState.pendingSecretRoom = pending;
        window.showNotification?.('Не удалось сохранить исход тайной комнаты. Награда и ресурсы восстановлены — попробуйте ещё раз.', 'error');
        return false;
    }
    window.showNotification?.(outcome.message, 'info');
    startStageBattle();
    return true;
}

function getLocationIndex(locationId) {
    const indexMap = {
        'forest': 1,
        'mountains': 2,
        'ruins': 3,
        'dragon_lair': 4
    };
    return indexMap[locationId] || 1;
}

export function startBossFight(bossData) {
    if (!locationState.inLocation || isDungeonBattleActive()) return;
    window.showNotification(`👹 ПОЯВИЛСЯ БОСС: ${bossData.name}!`, 'error');
    
    const enemy = {
        id: bossData.id,
        name: bossData.name,
        icon: bossData.icon,
        behavior: bossData.miniBoss ? 'mini_boss' : 'boss',
        miniBoss: bossData.miniBoss === true,
        health: bossData.health,
        maxHealth: bossData.health,
        attack: bossData.attack,
        defense: bossData.defense,
        damageModifiers: bossData.damageModifiers || {},
        resistances: bossData.resistances || {},
        expReward: bossData.expReward,
        goldReward: bossData.goldReward
    };
    
    const player = gameState.player;
    const playerBeforeStart = createPlayerSnapshot(player);
    if (!playerBeforeStart) {
        window.showNotification?.('Не удалось подготовить начало боя с боссом. Экспедиция не изменена.', 'error');
        return;
    }
    const previousProgress = player.dungeonProgress?.[locationState.currentLocation.id]
        ? structuredClone(player.dungeonProgress[locationState.currentLocation.id]) : null;
    const previousActiveEncounter = locationState.activeEncounter;
    locationState.activeEncounter = {
        enemy: structuredClone(enemy),
        isBossBattle: true,
        turn: 'player',
        guardReduction: 0,
        relicEffects: { phoenixRebirthUsed: false }
    };
    const hadProgress = Boolean(player.dungeonProgress &&
        Object.hasOwn(player.dungeonProgress, locationState.currentLocation.id));
    player.stats.battles++;
    persistDungeonProgress();
    if (!commitPlayerMutation(player, playerBeforeStart, () => gameState.save())) {
        if (hadProgress) player.dungeonProgress[locationState.currentLocation.id] = previousProgress;
        else clearDungeonProgress(player, locationState.currentLocation.id);
        locationState.activeEncounter = previousActiveEncounter;
        window.showNotification?.('Не удалось сохранить начало боя с боссом. Счётчик боёв восстановлен — повторите запуск.', 'error');
        const ui = typeof document !== 'undefined' ? document.getElementById('battle-ui') : null;
        if (ui) {
            ui.innerHTML = `<section class="adventure-event" aria-label="Повтор запуска боя с боссом">
                <div class="adventure-event-icon">⚠️</div>
                <h3>Бой с боссом не сохранён</h3>
                <p>Прогресс экспедиции сохранён. Повторите запуск, когда хранилище будет доступно.</p>
                <button class="battle-btn" onclick="window.startStageBattle()">🔄 Повторить запуск</button>
            </section>`;
        }
        return;
    }

    if (!startDungeonEncounter({
        enemy,
        isBossBattle: true,
        message: `${bossData.name} появляется!`
    })) {
        window.showNotification?.('Не удалось отобразить бой с боссом. Сохранённый противник будет восстановлен при повторной попытке.', 'error');
    };
}

export function completeLocation(playerBeforeCompletion = null) {
    const location = locationState.currentLocation;
    const player = gameState.player;

    if (!location || !locationState.inLocation || !player) return false;
    const rollbackPlayer = playerBeforeCompletion || snapshotPlayer();
    const previousRunId = locationState.runId;
    const previousLocationState = {
        inLocation: locationState.inLocation,
        currentLocation: locationState.currentLocation,
        currentStage: locationState.currentStage,
        enemiesDefeated: locationState.enemiesDefeated,
        pendingEvent: locationState.pendingEvent,
        pendingRoute: locationState.pendingRoute,
        pendingSecretRoom: locationState.pendingSecretRoom,
        pendingCheckpoint: locationState.pendingCheckpoint,
        finalBossDefeated: locationState.finalBossDefeated
    };
    const previousUnlocks = LOCATIONS.map(entry => entry.unlocked);

    // A region cannot be completed while its guaranteed reward is due but
    // cannot be granted. Keep the expedition active so the player can repair
    // inventory/currency and retry instead of silently losing the reward.
    const rewardCyclesValid = player.locationRewardCycles === undefined ||
        (player.locationRewardCycles !== null && typeof player.locationRewardCycles === 'object' &&
            !Array.isArray(player.locationRewardCycles));
    const rewardDue = canClaimLocationReward(player, location.id);
    const rewardItems = Array.isArray(location.rewards?.items) ? location.rewards.items : [];
    const rewardExp = location.rewards?.exp;
    const rewardGold = location.rewards?.gold;
    const canApplyReward = rewardCyclesValid && (!rewardDue || (
        Array.isArray(location.rewards?.items) &&
        Number.isSafeInteger(player.experience) && Number.isSafeInteger(rewardExp) && rewardExp >= 0 &&
        player.experience <= Number.MAX_SAFE_INTEGER - rewardExp &&
        Number.isSafeInteger(player.gold) && Number.isSafeInteger(rewardGold) && rewardGold >= 0 &&
        player.gold <= Number.MAX_SAFE_INTEGER - rewardGold &&
        canGrantItems(player, rewardItems)
    ));
    if (!canApplyReward) {
        window.showNotification?.('Награда региона не помещается в инвентарь или содержит некорректные данные. Освободите место и повторите завершение — прогресс экспедиции сохранён.', 'error');
        return false;
    }

    let rewardGranted = false;
    const completionNotifications = [];
    if (rewardDue) {
        if (!claimLocationReward(player, location.id) || !grantItemsAtomically(player, rewardItems)) {
            if (rollbackPlayer) restorePlayer(rollbackPlayer);
            window.showNotification?.('Не удалось выдать награду региона. Экспедиция сохранена — попробуйте завершить её ещё раз.', 'error');
            return false;
        }
        rewardGranted = true;
        player.experience += rewardExp;
        player.gold += rewardGold;
        if (player.experience >= player.maxExperience) {
            window.levelUp?.({ save: false, notifications: completionNotifications });
        }
    }

    const runId = ++locationState.runId;

    const campaignEnded = location.id === 'dragon_lair' && locationState.finalBossDefeated;
    if (campaignEnded) completeCampaign(player);

    // Открываем следующую локацию
    const nextLocation = unlockNextLocation(location.id);
    if (nextLocation && !player.unlockedLocations?.includes(nextLocation.id)) {
        player.unlockedLocations ||= ['forest'];
        player.unlockedLocations.push(nextLocation.id);
    }
    player.stats.dungeonsCompleted = (player.stats.dungeonsCompleted || 0) + 1;
    // Region completion happens after the final battle's normal achievement
    // update. Re-evaluate lifetime achievements here so the fourth/final region
    // can unlock its reward without requiring an unrelated fifth expedition.
    window.updateQuestProgress?.('gold', 1, {
        save: false,
        notifications: completionNotifications
    });
    window.updateQuestProgress?.('level', 1, {
        save: false,
        notifications: completionNotifications
    });
    window.updateAchievements?.({ save: false, notifications: completionNotifications });
    if (player.dungeonCheckpoints) delete player.dungeonCheckpoints[location.id];
    clearDungeonProgress(player, location.id);
    
    locationState.inLocation = false;
    locationState.pendingEvent = null;
    locationState.pendingRoute = null;
    locationState.pendingSecretRoom = null;
    locationState.pendingCheckpoint = null;
    locationState.finalBossDefeated = false;
    locationState.currentLocation = null;
    locationState.currentStage = 0;
    locationState.enemiesDefeated = 0;
    
    let nextLocationText = '';
    if (nextLocation) {
        nextLocationText = `\n🔓 Открыта новая локация: ${nextLocation.name}!`;
    } else if (campaignEnded) {
        nextLocationText = '\n🏆 Пожиратель миров повержен. Кампания завершена!';
    } else {
        nextLocationText = '\nВсе доступные локации пройдены.';
    }
    
    const itemRewardSummary = rewardGranted
        ? location.rewards.items
            .map(rewardItem => {
                const item = getItem(rewardItem.id);
                return item ? `${item.name} ×${rewardItem.quantity}` : null;
            })
            .filter(Boolean)
            .join(', ')
        : '';
    const rewardSummary = rewardGranted
        ? `+${location.rewards.exp} EXP, +${location.rewards.gold} золота!${itemRewardSummary ? ` Предметы: ${itemRewardSummary}.` : ''}`
        : 'Награда за эту локацию в текущем цикле уже получена.';
    let saveSucceeded = false;
    try {
        saveSucceeded = gameState.save() === true;
    } catch {
        saveSucceeded = false;
    }
    if (!saveSucceeded) {
        if (rollbackPlayer) restorePlayer(rollbackPlayer);
        LOCATIONS.forEach((entry, index) => { entry.unlocked = previousUnlocks[index]; });
        Object.assign(locationState, previousLocationState);
        locationState.runId = previousRunId;
        window.showNotification?.('Не удалось сохранить завершение локации. Награды и открытие следующей локации отменены — повторите победу над боссом.', 'error');
        return false;
    }

    window.showNotification(`🎉 Локация пройдена! ${rewardSummary}${nextLocationText}`, 'success');
    completionNotifications.forEach(({ kind, name }) => {
        const message = kind === 'quest'
            ? `🎉 Квест выполнен: ${name}!`
            : `🏆 Достижение получено: ${name}!`;
        window.showNotification?.(message, 'success');
    });
    window.updateMainMenu?.();
    window.updateMapScreen?.();

    setTimeout(() => {
        if (locationState.runId !== runId || locationState.inLocation || isDungeonBattleActive()) return;
        window.exitBattle();
        window.showScreen(campaignEnded ? 'ending-screen' : 'map-screen');
    }, 3000);
    return true;
}

export function fleeLocation() {
    const player = gameState.player;
    const location = locationState.currentLocation;
    if (!player || !location || !locationState.inLocation) return false;

    const playerBeforeFlee = snapshotPlayer();
    if (player.dungeonCheckpoints) delete player.dungeonCheckpoints[location.id];
    clearDungeonProgress(player, location.id);

    let saved = false;
    try {
        saved = gameState.save() === true;
    } catch {
        saved = false;
    }
    if (!saved) {
        restorePlayer(playerBeforeFlee);
        window.showNotification?.('Не удалось сохранить выход. Прогресс экспедиции сохранён — попробуйте ещё раз.', 'error');
        return false;
    }

    locationState.runId++;
    locationState.inLocation = false;
    locationState.pendingEvent = null;
    locationState.pendingRoute = null;
    locationState.pendingSecretRoom = null;
    locationState.pendingCheckpoint = null;
    locationState.currentLocation = null;
    locationState.currentStage = 0;
    locationState.enemiesDefeated = 0;
    locationState.finalBossDefeated = false;
    locationState.activeEncounter = null;

    window.showNotification?.('Вы покинули локацию. Прогресс сброшен.', 'info');
    window.exitBattle();
    window.showScreen('map-screen');
    return true;
}

export function resetLocationState() {
    locationState.runId++;
    locationState.inLocation = false;
    locationState.pendingEvent = null;
    locationState.pendingRoute = null;
    locationState.pendingSecretRoom = null;
    locationState.currentLocation = null;
    locationState.currentStage = 0;
    locationState.enemiesDefeated = 0;
    locationState.finalBossDefeated = false;
    locationState.activeEncounter = null;
}

export function getLocationState() {
    return locationState;
}

// Вызывается после победы над обычным врагом
export function handleVictory(playerBeforeBattle = null) {
    if (!locationState.inLocation || !locationState.currentLocation) return false;
    const previousStage = locationState.currentStage;
    const previousDefeated = locationState.enemiesDefeated;
    const previousProgress = gameState.player?.dungeonProgress
        ? structuredClone(gameState.player.dungeonProgress) : null;
    const previousActiveEncounter = locationState.activeEncounter;
    locationState.activeEncounter = null;
    locationState.enemiesDefeated++;
    persistDungeonProgress();
    let saved = false;
    try {
        saved = gameState.save() === true;
    } catch {
        saved = false;
    }
    if (!saved) {
        locationState.currentStage = previousStage;
        locationState.enemiesDefeated = previousDefeated;
        locationState.activeEncounter = previousActiveEncounter;
        if (gameState.player) {
            if (previousProgress) gameState.player.dungeonProgress = previousProgress;
            else delete gameState.player.dungeonProgress;
            if (playerBeforeBattle) restorePlayer(playerBeforeBattle);
        }
        window.showNotification?.('Не удалось сохранить победу. Награда отменена, бой будет предложен повторно.', 'error');
        return false;
    }

    const location = locationState.currentLocation;
    const stage = location.stages[locationState.currentStage];
    if (!stage) return true;
    const runId = locationState.runId;
    const stageIndex = locationState.currentStage;

    setTimeout(() => {
        if (!locationState.inLocation || locationState.runId !== runId ||
            locationState.currentStage !== stageIndex || isDungeonBattleActive()) return;
        if (locationState.enemiesDefeated >= stage.enemiesCount) {
            if (stage.boss) {
                startBossFight(stage.boss);
            } else {
                const oldStage = locationState.currentStage;
                const oldDefeated = locationState.enemiesDefeated;
                const oldProgress = gameState.player?.dungeonProgress
                    ? structuredClone(gameState.player.dungeonProgress) : null;
                locationState.currentStage++;
                locationState.enemiesDefeated = 0;
                persistDungeonProgress();
                let transitionSaved = false;
                try {
                    transitionSaved = gameState.save() === true;
                } catch {
                    transitionSaved = false;
                }
                if (!transitionSaved) {
                    locationState.currentStage = oldStage;
                    locationState.enemiesDefeated = oldDefeated;
                    if (gameState.player) {
                        if (oldProgress) gameState.player.dungeonProgress = oldProgress;
                        else delete gameState.player.dungeonProgress;
                    }
                    window.showNotification?.('Не удалось сохранить переход этапа. Текущий этап сохранён — повторите попытку.', 'error');
                    return;
                }
                startStageBattle();
            }
        } else {
            startStageBattle();
        }
    }, 2000);
    return true;
}

// Вызывается после победы над боссом
export function handleBossVictory(playerBeforeBattle = null) {
    if (!locationState.inLocation || !locationState.currentLocation) return false;
    const location = locationState.currentLocation;
    const player = gameState.player;
    if (!player) return false;
    const currentStage = location.stages[locationState.currentStage];
    // A boss result may only be committed while the run is still on a boss
    // stage whose regular encounters have all been cleared. This makes a
    // repeated victory callback harmless after the stage has advanced.
    if (!currentStage?.boss || locationState.enemiesDefeated < currentStage.enemiesCount) return false;

    // The snapshot comes from battleVictory before EXP, gold, loot, relics,
    // quests and statistics were changed. A failed commit must replay the boss.
    const rollbackPlayer = playerBeforeBattle || snapshotPlayer();
    const previousStage = locationState.currentStage;
    const previousDefeated = locationState.enemiesDefeated;
    const previousDeepChestStages = new Set(locationState.claimedDeepChestStages);
    const previousBonusStages = new Set(locationState.claimedUnbrokenBonusStages);
    const previousFinalBossDefeated = locationState.finalBossDefeated;
    const previousActiveEncounter = locationState.activeEncounter;
    locationState.activeEncounter = null;
    const stageNumber = previousStage + 1;
    let deepChestRewardId = null;

    // Deep-chest claims, milestone bonuses and stage advancement form one save.
    if (!locationState.claimedDeepChestStages.has(stageNumber)) {
        const itemId = rollDeepChest(stageNumber);
        deepChestRewardId = itemId;
        if (itemId && !canGrantItems(player, [{ id: itemId, quantity: 1 }])) {
            locationState.activeEncounter = previousActiveEncounter;
            if (rollbackPlayer) restorePlayer(rollbackPlayer);
            window.showNotification?.('Недостаточно места или повреждён инвентарь для награды босса. Победа не засчитана — освободите место и повторите бой.', 'error');
            return false;
        }
        if (claimDeepChestAttempt(player, location.id, stageNumber)) {
            if (itemId && !grantItemsAtomically(player, [{ id: itemId, quantity: 1 }])) {
                locationState.activeEncounter = previousActiveEncounter;
                if (rollbackPlayer) restorePlayer(rollbackPlayer);
                return false;
            }
            locationState.claimedDeepChestStages.add(stageNumber);
        }
    }

    if (!locationState.claimedUnbrokenBonusStages.has(stageNumber)) {
        const bonus = getUnbrokenExpeditionBonus(stageNumber,
            location.stages[previousStage]?.boss, locationState.resumedFromCheckpoint);
        if (bonus.exp || bonus.gold) {
            if (!Number.isSafeInteger(player.experience) || !Number.isSafeInteger(player.gold) ||
                player.experience > Number.MAX_SAFE_INTEGER - bonus.exp ||
                player.gold > Number.MAX_SAFE_INTEGER - bonus.gold) {
                locationState.activeEncounter = previousActiveEncounter;
                if (rollbackPlayer) restorePlayer(rollbackPlayer);
                locationState.claimedDeepChestStages = previousDeepChestStages;
                return false;
            }
            player.experience += bonus.exp;
            player.gold += bonus.gold;
        }
        locationState.claimedUnbrokenBonusStages.add(stageNumber);
    }

    const isFinalBoss = location.id === 'dragon_lair' && stageNumber === location.stages.length &&
        location.stages[previousStage]?.boss?.id === 'world_eater';
    if (isFinalBoss) locationState.finalBossDefeated = true;

    const isFinalStage = previousStage >= location.stages.length - 1;
    if (isFinalStage) {
        const completed = completeLocation(rollbackPlayer);
        if (!completed) {
            locationState.currentStage = previousStage;
            locationState.enemiesDefeated = previousDefeated;
            locationState.claimedDeepChestStages = previousDeepChestStages;
            locationState.claimedUnbrokenBonusStages = previousBonusStages;
            locationState.finalBossDefeated = previousFinalBossDefeated;
            locationState.activeEncounter = previousActiveEncounter;
            return false;
        }
        if (deepChestRewardId) {
            window.showNotification?.(`🎁 Редкий сундук глубины: ${getItem(deepChestRewardId).name}!`, 'success');
        }
        return true;
    }

    locationState.currentStage = previousStage + 1;
    locationState.enemiesDefeated = 0;
    persistDungeonProgress();
    let saved = false;
    try {
        saved = gameState.save() === true;
    } catch {
        saved = false;
    }
    if (!saved) {
        locationState.currentStage = previousStage;
        locationState.enemiesDefeated = previousDefeated;
        locationState.claimedDeepChestStages = previousDeepChestStages;
        locationState.claimedUnbrokenBonusStages = previousBonusStages;
        locationState.finalBossDefeated = previousFinalBossDefeated;
        locationState.activeEncounter = previousActiveEncounter;
        if (rollbackPlayer) restorePlayer(rollbackPlayer);
        window.showNotification?.('Не удалось сохранить победу над боссом. Награды отменены, бой можно повторить.', 'error');
        return false;
    }

    if (deepChestRewardId) {
        window.showNotification?.(`🎁 Редкий сундук глубины: ${getItem(deepChestRewardId).name}!`, 'success');
    }
    if (!previousBonusStages.has(stageNumber)) {
        const bonus = getUnbrokenExpeditionBonus(stageNumber, location.stages[previousStage]?.boss,
            locationState.resumedFromCheckpoint);
        if (bonus.exp || bonus.gold) {
            window.showNotification?.(`🏆 Экспедиция без отступления: +${bonus.exp} опыта, +${bonus.gold} золота!`, 'success');
        }
    }
    startStageBattle();
    return true;
}

// Вызывается при поражении
export function handleDefeat(playerBeforeDefeat = null) {
    const player = gameState.player;
    if (!player) return false;
    const playerBeforeDefeatCommit = playerBeforeDefeat || snapshotPlayer();
    const locationId = locationState.currentLocation?.id;

    if (locationId && player.dungeonCheckpoints) delete player.dungeonCheckpoints[locationId];
    if (locationId) clearDungeonProgress(player, locationId);

    let saved = false;
    try {
        saved = gameState.save() === true;
    } catch {
        saved = false;
    }
    if (!saved) {
        restorePlayer(playerBeforeDefeatCommit);
        window.showNotification?.('Не удалось сохранить поражение. Прогресс экспедиции восстановлен в сохранении.', 'error');
        return false;
    }

    locationState.runId++;
    locationState.currentStage = 0;
    locationState.enemiesDefeated = 0;
    locationState.inLocation = false;
    locationState.pendingEvent = null;
    locationState.pendingRoute = null;
    locationState.pendingSecretRoom = null;
    locationState.pendingCheckpoint = null;
    locationState.currentLocation = null;
    locationState.finalBossDefeated = false;
    locationState.activeEncounter = null;

    window.showNotification?.('Вы погибли! Прогресс локации сброшен. Начните заново.', 'error');
    return true;
}
