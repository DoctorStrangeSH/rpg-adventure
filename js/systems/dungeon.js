// Система локаций с этапами
import { gameState } from '../core/state.js';
import { getLocation, unlockNextLocation } from '../data/locations.js';
import { getRandomEnemy } from '../data/enemies.js';
import { getItem } from '../data/items.js';
import { getBattleState, resetBattlePresentation } from '../ui/battle.js';
import { getBattlePositions } from '../ui/battleLayout.js';
import { claimDeepChestAttempt, grantItem, rollDeepChest } from './loot.js';
import { rollAdventureEvent, resolveAdventureEvent, getAdventureChoiceLock, getAdventureEvent } from './adventureEvents.js';
import { DUNGEON_ROUTES, getRoute, applyRouteToEnemy } from './dungeonRoutes.js';
import { rollSecretRoom, resolveSecretRoom } from './secretRooms.js';
import { awardTravelerFavor, consumeTravelerFavor } from './expeditionFavor.js';
import { scheduleBloodPursuer, applyBloodPursuer } from './contractPursuit.js';
import { completeCampaign, claimLocationReward } from './newGamePlus.js';

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
    finalBossDefeated: false
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
        finalBossDefeated: locationState.finalBossDefeated
    };
    return true;
}

function clearDungeonProgress(player, locationId) {
    if (player?.dungeonProgress && locationId) delete player.dungeonProgress[locationId];
}

function restoreStageSet(value) {
    return new Set(Array.isArray(value) ? value : []);
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
    if (locationState.inLocation || getBattleState().isActive) return;
    
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
    const runId = ++locationState.runId;
    persistDungeonProgress();
    if (gameState.save() !== true) {
        window.showNotification?.('Не удалось сохранить состояние экспедиции. Проверьте свободное место хранилища.', 'error');
    }
    
    // Показываем экран боя
    window.showScreen('battle-screen');
    
    // Сразу начинаем первый бой
    setTimeout(() => {
        if (locationState.inLocation && locationState.runId === runId) startStageBattle();
    }, 500);
}

export function startStageBattle() {
    if (!locationState.inLocation || getBattleState().isActive) return;
    // The stage must wait for the player's choice; duplicate callbacks must
    // never bypass an unresolved encounter or overwrite its buttons.
    if (locationState.pendingEvent || locationState.pendingRoute || locationState.pendingSecretRoom || locationState.pendingCheckpoint) return;
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
        locationState.checkedSecretStages.add(locationState.currentStage);
        persistDungeonProgress();
        gameState.save();
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
        locationState.currentStage++;
        locationState.enemiesDefeated = 0;
        persistDungeonProgress();
        gameState.save();
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
    const routeId = locationState.routeChoices[locationState.currentStage];
    if (routeId) enemy = applyRouteToEnemy(enemy, routeId);
    const favor = consumeTravelerFavor(enemy, locationState.travelerFavorFights);
    enemy = favor.enemy;
    locationState.travelerFavorFights = favor.charges;
    const pursuer = applyBloodPursuer(enemy, locationState.bloodPursuerPending);
    enemy = pursuer.enemy;
    if (pursuer.pursued) locationState.bloodPursuerPending = false;
    
    const battleState = getBattleState();
    resetBattlePresentation();
    battleState.currentEnemy = enemy;
    battleState.isActive = true;
    battleState.animationFrame = 0;
    battleState.turn = 'player';
    battleState.isLocationBattle = true;
    battleState.isBossBattle = false;
    battleState.guardReduction = 0;
    battleState.relicEffects = { phoenixRebirthUsed: false };
    gameState.player.stats.battles++;
    gameState.save();
    
    const positions = getBattlePositions(battleState.canvas?.width, battleState.canvas?.height);
    
    import('../entities/Sprite.js').then(module => {
        if (!battleState.isActive || battleState.currentEnemy !== enemy) return;
        const Sprite = module.Sprite;
        battleState.playerSprite = new Sprite(gameState.player.class, positions.player.x, positions.player.y);
        battleState.enemySprite = new Sprite(enemyData.id, positions.enemy.x, positions.enemy.y);
        
        window.updateBattleUI();
        window.animateBattle();
        
        // Показываем информацию о этапе
        const bossText = stage.boss ? ' 👹 БОСС!' : '';
        window.showBattleMessage(`${location.name} - Этап ${stage.stage}/${location.stages.length}${bossText}${depth.tier ? ` ⚠️ Глубина ${depth.tier + 1}: награды +${Math.round((depth.reward - 1) * 100)}%` : ''}${favor.protected ? ' 🛡️ Защита странника: атака врага −15%' : ''}${pursuer.pursued ? ' 🩸 Вас настиг преследователь печати: враг сильнее, награды +25%' : ''}`);
    });
}

function presentDungeonCheckpoint() {
    const stage = locationState.currentStage;
    locationState.pendingCheckpoint = { stage, runId: locationState.runId };
    const ui = document.getElementById('battle-ui');
    if (!ui) {
        locationState.pendingCheckpoint = null;
        locationState.visitedCheckpointStages.add(stage);
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
        getBattleState().isActive || pending.runId !== locationState.runId ||
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
        locationState.pendingRoute = null;
        locationState.visitedRouteStages.add(stage);
        locationState.routeChoices[stage] = 'safe';
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
        getBattleState().isActive || pending.runId !== locationState.runId ||
        pending.stage !== locationState.currentStage) return false;
    locationState.routeChoices[pending.stage] = routeId;
    locationState.visitedRouteStages.add(pending.stage);
    locationState.pendingRoute = null;
    persistDungeonProgress();
    if (gameState.save() !== true) {
        window.showNotification?.('Не удалось сохранить выбор маршрута. Он может потребоваться повторно после перезагрузки.', 'error');
    }
    window.showNotification?.(`Вы выбрали: ${getRoute(routeId).name}`, 'info');
    startStageBattle();
    return true;
}

function presentAdventureEvent() {
    if (locationState.pendingEvent) return;
    const event = locationState.travelerReturnPending
        ? getAdventureEvent('traveler_return') : rollAdventureEvent();
    if (locationState.travelerReturnPending) locationState.travelerReturnPending = false;
    const stage = locationState.currentStage;
    locationState.pendingEvent = { id: event.id, stage, runId: locationState.runId };
    const ui = document.getElementById('battle-ui');
    if (!ui) { // If no UI is mounted, continue without blocking the run.
        locationState.visitedEventStages.add(stage);
        locationState.pendingEvent = null;
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
        pending.stage !== locationState.currentStage || getBattleState().isActive) return false;
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
        window.showNotification?.('Не удалось сохранить исход события. После перезагрузки выбор может потребоваться повторить.', 'error');
    }
    window.showNotification?.(outcome.message, 'info');
    startStageBattle();
    return true;
}

function presentSecretRoom() {
    const room = rollSecretRoom();
    if (!room) return;
    const stage = locationState.currentStage;
    locationState.pendingSecretRoom = { id: room.id, stage, runId: locationState.runId };
    const ui = document.getElementById('battle-ui');
    if (!ui) {
        locationState.pendingSecretRoom = null;
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
        pending.stage !== locationState.currentStage || getBattleState().isActive) return false;
    const outcome = resolveSecretRoom(gameState.player, pending.id, choice);
    if (!outcome) return false;
    locationState.pendingSecretRoom = null;
    persistDungeonProgress();
    if (gameState.save() !== true) {
        window.showNotification?.('Не удалось сохранить исход тайной комнаты. После перезагрузки награда может не сохраниться.', 'error');
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
    if (!locationState.inLocation || getBattleState().isActive) return;
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
    
    const battleState = getBattleState();
    resetBattlePresentation();
    battleState.currentEnemy = enemy;
    battleState.isActive = true;
    battleState.animationFrame = 0;
    battleState.turn = 'player';
    battleState.isBossBattle = true;
    battleState.isLocationBattle = true;
    battleState.guardReduction = 0;
    battleState.relicEffects = { phoenixRebirthUsed: false };
    gameState.player.stats.battles++;
    gameState.save();
    
    const positions = getBattlePositions(battleState.canvas?.width, battleState.canvas?.height, true);
    
    import('../entities/Sprite.js').then(module => {
        if (!battleState.isActive || battleState.currentEnemy !== enemy) return;
        const Sprite = module.Sprite;
        battleState.playerSprite = new Sprite(gameState.player.class, positions.player.x, positions.player.y);
        battleState.enemySprite = new Sprite(bossData.id, positions.enemy.x, positions.enemy.y);
        
        window.updateBattleUI();
        window.animateBattle();
        
        window.showBattleMessage(`${bossData.name} появляется!`);
    });
}

export function completeLocation() {
    const location = locationState.currentLocation;
    const player = gameState.player;
    
    if (!location || !locationState.inLocation) return;
    const runId = ++locationState.runId;
    
    // A region's fixed completion reward is claimable once per campaign cycle.
    const rewardGranted = claimLocationReward(player, location.id);
    if (rewardGranted) {
        player.experience += location.rewards.exp;
        player.gold += location.rewards.gold;
        if (player.experience >= player.maxExperience) window.levelUp?.();
        location.rewards.items.forEach(rewardItem => {
            grantItem(player, rewardItem.id, rewardItem.quantity);
        });
    }

    const campaignEnded = location.id === 'dragon_lair' && locationState.finalBossDefeated;
    if (campaignEnded) completeCampaign(player);

    // Открываем следующую локацию
    const nextLocation = unlockNextLocation(location.id);
    if (nextLocation && !player.unlockedLocations?.includes(nextLocation.id)) {
        player.unlockedLocations ||= ['forest'];
        player.unlockedLocations.push(nextLocation.id);
    }
    player.stats.dungeonsCompleted = (player.stats.dungeonsCompleted || 0) + 1;
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
    window.showNotification(`🎉 Локация пройдена! ${rewardSummary}${nextLocationText}`, 'success');
    
    const saveSucceeded = gameState.save();
    if (!saveSucceeded) {
        window.showNotification?.('Не удалось сохранить прогресс. Не закрывайте игру и проверьте свободное место хранилища.', 'error');
    }
    window.updateMainMenu?.();
    window.updateMapScreen?.();

    setTimeout(() => {
        if (locationState.runId !== runId || locationState.inLocation || getBattleState().isActive) return;
        window.exitBattle();
        window.showScreen(campaignEnded ? 'ending-screen' : 'map-screen');
    }, 3000);
}

export function fleeLocation() {
    if (gameState.player?.dungeonCheckpoints && locationState.currentLocation)
        delete gameState.player.dungeonCheckpoints[locationState.currentLocation.id];
    if (locationState.currentLocation) clearDungeonProgress(gameState.player, locationState.currentLocation.id);
    gameState.save();
    locationState.runId++;
    locationState.inLocation = false;
    locationState.pendingEvent = null;
    locationState.pendingRoute = null;
    locationState.pendingSecretRoom = null;
    locationState.currentLocation = null;
    locationState.currentStage = 0;
    locationState.enemiesDefeated = 0;
    locationState.finalBossDefeated = false;
    
    window.showNotification('Вы покинули локацию. Прогресс сброшен.', 'info');
    window.exitBattle();
    window.showScreen('map-screen');
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
}

export function getLocationState() {
    return locationState;
}

// Вызывается после победы над обычным врагом
export function handleVictory() {
    if (!locationState.inLocation || !locationState.currentLocation) return;
    locationState.enemiesDefeated++;
    persistDungeonProgress();
    if (gameState.save() !== true) {
        window.showNotification?.('Не удалось сохранить награду и прогресс боя. Проверьте свободное место хранилища.', 'error');
    }

    const location = locationState.currentLocation;
    const stage = location.stages[locationState.currentStage];
    if (!stage) return;
    const runId = locationState.runId;
    const stageIndex = locationState.currentStage;
    
    setTimeout(() => {
        if (!locationState.inLocation || locationState.runId !== runId ||
            locationState.currentStage !== stageIndex || getBattleState().isActive) return;
        if (locationState.enemiesDefeated >= stage.enemiesCount) {
            if (stage.boss) {
                // Бой с боссом
                startBossFight(stage.boss);
            } else {
                // Переход на следующий этап
                locationState.currentStage++;
                locationState.enemiesDefeated = 0;
                persistDungeonProgress();
                gameState.save();
                startStageBattle();
            }
        } else {
            // Следующий враг на этом же этапе
            startStageBattle();
        }
    }, 2000);
}

// Вызывается после победы над боссом
export function handleBossVictory() {
    if (!locationState.inLocation || !locationState.currentLocation) return;
    const location = locationState.currentLocation;
    
    // A victorious major boss can reveal one rare chest. Mark the stage before
    // awarding loot, so a duplicate victory callback cannot duplicate items.
    const stageNumber = locationState.currentStage + 1;
    if (!locationState.claimedDeepChestStages.has(stageNumber)) {
        locationState.claimedDeepChestStages.add(stageNumber);
        if (claimDeepChestAttempt(gameState.player, location.id, stageNumber)) {
            const itemId = rollDeepChest(stageNumber);
            if (itemId) {
                grantItem(gameState.player, itemId, 1);
                window.showNotification?.(`🎁 Редкий сундук глубины: ${getItem(itemId).name}!`, 'success');
            }
        }
    }

    // A full expedition earns an extra milestone payout; resuming at a camp
    // forfeits only this optional bonus, not the normal boss loot.
    if (!locationState.claimedUnbrokenBonusStages.has(stageNumber)) {
        locationState.claimedUnbrokenBonusStages.add(stageNumber);
        const bonus = getUnbrokenExpeditionBonus(stageNumber, location.stages[locationState.currentStage]?.boss,
            locationState.resumedFromCheckpoint);
        if (bonus.exp || bonus.gold) {
            gameState.player.experience += bonus.exp;
            gameState.player.gold += bonus.gold;
            if (gameState.player.experience >= gameState.player.maxExperience) window.levelUp?.();
            window.showNotification?.(`🏆 Экспедиция без отступления: +${bonus.exp} опыта, +${bonus.gold} золота!`, 'success');
        }
    }

    if (location.id === 'dragon_lair' && stageNumber === location.stages.length &&
        location.stages[locationState.currentStage]?.boss?.id === 'world_eater') {
        locationState.finalBossDefeated = true;
    }

    // Проверяем, был ли это последний этап
    if (locationState.currentStage >= location.stages.length - 1) {
        completeLocation();
    } else {
        // Переход на следующий этап
        locationState.currentStage++;
        locationState.enemiesDefeated = 0;
        persistDungeonProgress();
        if (gameState.save() !== true) {
            window.showNotification?.('Не удалось сохранить прогресс после босса. Проверьте свободное место хранилища.', 'error');
        }
        startStageBattle();
    }
}

// Вызывается при поражении
export function handleDefeat() {
    if (gameState.player?.dungeonCheckpoints && locationState.currentLocation)
        delete gameState.player.dungeonCheckpoints[locationState.currentLocation.id];
    if (locationState.currentLocation) clearDungeonProgress(gameState.player, locationState.currentLocation.id);
    gameState.save();
    locationState.runId++;
    locationState.currentStage = 0;
    locationState.enemiesDefeated = 0;
    locationState.inLocation = false;
    locationState.pendingEvent = null;
    locationState.pendingRoute = null;
    locationState.currentLocation = null;
    locationState.finalBossDefeated = false;
    
    window.showNotification('Вы погибли! Прогресс локации сброшен. Начните заново.', 'error');
}
