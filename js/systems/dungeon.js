// Система локаций с этапами
import { gameState } from '../core/state.js';
import { getLocation, unlockNextLocation } from '../data/locations.js';
import { getRandomEnemy } from '../data/enemies.js';
import { getBattleState } from '../ui/battle.js';
import { grantItem } from './loot.js';
import { rollAdventureEvent, resolveAdventureEvent } from './adventureEvents.js';

let locationState = {
    currentLocation: null,
    currentStage: 0,
    enemiesDefeated: 0,
    inLocation: false,
    runId: 0,
    pendingEvent: null,
    visitedEventStages: new Set()
};

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
    locationState.currentStage = 0;
    locationState.enemiesDefeated = 0;
    locationState.inLocation = true;
    locationState.pendingEvent = null;
    locationState.visitedEventStages = new Set();
    const runId = ++locationState.runId;
    
    // Показываем экран боя
    window.showScreen('battle-screen');
    
    // Сразу начинаем первый бой
    setTimeout(() => {
        if (locationState.inLocation && locationState.runId === runId) startStageBattle();
    }, 500);
}

export function startStageBattle() {
    if (!locationState.inLocation || getBattleState().isActive) return;
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

    // Every fifth stage offers a one-time detour between battles. It is not
    // re-rolled when the player chooses and returns to the same stage.
    if (locationState.currentStage > 0 && (locationState.currentStage + 1) % 5 === 0 &&
        !locationState.visitedEventStages.has(locationState.currentStage)) {
        presentAdventureEvent();
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
    
    const enemy = {
        ...enemyData,
        health: Math.floor(enemyData.health * stageMultiplier),
        maxHealth: Math.floor(enemyData.health * stageMultiplier),
        attack: Math.floor(enemyData.attack * (1 + stage.stage * 0.05 + locationIndex * 0.3)),
        defense: Math.floor(enemyData.defense * (1 + stage.stage * 0.05 + locationIndex * 0.3)),
        expReward: Math.floor(enemyData.expReward * stageMultiplier),
        goldReward: Math.floor(enemyData.goldReward * stageMultiplier)
    };
    
    const battleState = getBattleState();
    battleState.currentEnemy = enemy;
    battleState.isActive = true;
    battleState.animationFrame = 0;
    battleState.turn = 'player';
    battleState.isLocationBattle = true;
    battleState.isBossBattle = false;
    battleState.guardReduction = 0;
    gameState.player.stats.battles++;
    gameState.save();
    
    const canvasWidth = battleState.canvas ? battleState.canvas.width : 400;
    
    import('../entities/Sprite.js').then(module => {
        if (!battleState.isActive || battleState.currentEnemy !== enemy) return;
        const Sprite = module.Sprite;
        battleState.playerSprite = new Sprite(gameState.player.class, 100, 200);
        battleState.enemySprite = new Sprite(enemyData.id, canvasWidth - 100, 200);
        
        window.updateBattleUI();
        window.animateBattle();
        
        // Показываем информацию о этапе
        const bossText = stage.boss ? ' 👹 БОСС!' : '';
        window.showBattleMessage(`${location.name} - Этап ${stage.stage}/${location.stages.length}${bossText}`);
    });
}

function presentAdventureEvent() {
    if (locationState.pendingEvent) return;
    const event = rollAdventureEvent();
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
        ${event.choices.map(choice => `<button class="battle-btn" onclick="window.chooseAdventureEvent('${choice.id}')">${choice.label}</button>`).join('')}
    </section>`;
    window.showBattleMessage?.(`🧭 Событие: ${event.name}`);
}

export function chooseAdventureEvent(choiceId) {
    const pending = locationState.pendingEvent;
    if (!pending || !locationState.inLocation || pending.runId !== locationState.runId ||
        pending.stage !== locationState.currentStage || getBattleState().isActive) return false;
    const outcome = resolveAdventureEvent(gameState.player, pending.id, choiceId);
    if (!outcome) {
        window.showNotification?.('Недостаточно золота или неверный выбор.', 'error');
        return false;
    }
    locationState.visitedEventStages.add(pending.stage);
    locationState.pendingEvent = null;
    gameState.save();
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
        behavior: 'boss',
        health: bossData.health,
        maxHealth: bossData.health,
        attack: bossData.attack,
        defense: bossData.defense,
        expReward: bossData.expReward,
        goldReward: bossData.goldReward
    };
    
    const battleState = getBattleState();
    battleState.currentEnemy = enemy;
    battleState.isActive = true;
    battleState.animationFrame = 0;
    battleState.turn = 'player';
    battleState.isBossBattle = true;
    battleState.isLocationBattle = true;
    battleState.guardReduction = 0;
    gameState.player.stats.battles++;
    gameState.save();
    
    const canvasWidth = battleState.canvas ? battleState.canvas.width : 400;
    
    import('../entities/Sprite.js').then(module => {
        if (!battleState.isActive || battleState.currentEnemy !== enemy) return;
        const Sprite = module.Sprite;
        battleState.playerSprite = new Sprite(gameState.player.class, 100, 200);
        battleState.enemySprite = new Sprite(bossData.id, canvasWidth - 100, 150);
        
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
    
    // Выдаём награды
    player.experience += location.rewards.exp;
    player.gold += location.rewards.gold;
    if (player.experience >= player.maxExperience) window.levelUp?.();
    
    location.rewards.items.forEach(rewardItem => {
        grantItem(player, rewardItem.id, rewardItem.quantity);
    });
    
    // Открываем следующую локацию
    const nextLocation = unlockNextLocation(location.id);
    if (nextLocation && !player.unlockedLocations?.includes(nextLocation.id)) {
        player.unlockedLocations ||= ['forest'];
        player.unlockedLocations.push(nextLocation.id);
    }
    player.stats.dungeonsCompleted = (player.stats.dungeonsCompleted || 0) + 1;
    
    locationState.inLocation = false;
    locationState.pendingEvent = null;
    locationState.currentLocation = null;
    locationState.currentStage = 0;
    locationState.enemiesDefeated = 0;
    
    let nextLocationText = '';
    if (nextLocation) {
        nextLocationText = `\n🔓 Открыта новая локация: ${nextLocation.name}!`;
    } else {
        nextLocationText = '\n🎉 Все локации пройдены!';
    }
    
    window.showNotification(`🎉 Локация пройдена! +${location.rewards.exp} EXP, +${location.rewards.gold} золота!${nextLocationText}`, 'success');
    
    gameState.save();
    window.updateMainMenu?.();
    window.updateMapScreen?.();
    
    setTimeout(() => {
        if (locationState.runId !== runId || locationState.inLocation || getBattleState().isActive) return;
        window.exitBattle();
        window.showScreen('map-screen');
    }, 3000);
}

export function fleeLocation() {
    locationState.runId++;
    locationState.inLocation = false;
    locationState.pendingEvent = null;
    locationState.currentLocation = null;
    locationState.currentStage = 0;
    locationState.enemiesDefeated = 0;
    
    window.showNotification('Вы покинули локацию. Прогресс сброшен.', 'info');
    window.exitBattle();
    window.showScreen('map-screen');
}

export function resetLocationState() {
    locationState.runId++;
    locationState.inLocation = false;
    locationState.pendingEvent = null;
    locationState.currentLocation = null;
    locationState.currentStage = 0;
    locationState.enemiesDefeated = 0;
}

export function getLocationState() {
    return locationState;
}

// Вызывается после победы над обычным врагом
export function handleVictory() {
    if (!locationState.inLocation || !locationState.currentLocation) return;
    locationState.enemiesDefeated++;
    
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
    
    // Проверяем, был ли это последний этап
    if (locationState.currentStage >= location.stages.length - 1) {
        completeLocation();
    } else {
        // Переход на следующий этап
        locationState.currentStage++;
        locationState.enemiesDefeated = 0;
        startStageBattle();
    }
}

// Вызывается при поражении
export function handleDefeat() {
    locationState.currentStage = 0;
    locationState.enemiesDefeated = 0;
    locationState.inLocation = false;
    locationState.pendingEvent = null;
    locationState.currentLocation = null;
    
    window.showNotification('Вы погибли! Прогресс локации сброшен. Начните заново.', 'error');
}
