// Система локаций с этапами
import { gameState } from '../core/state.js';
import { getLocation, unlockNextLocation } from '../data/locations.js';
import { getRandomEnemy } from '../data/enemies.js';
import { getBattleState } from '../ui/battle.js';

let locationState = {
    currentLocation: null,
    currentStage: 0,
    enemiesDefeated: 0,
    inLocation: false
};

export function startLocation(locationId) {
    const player = gameState.player;
    const location = getLocation(locationId);
    
    if (!location) {
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
    
    locationState.currentLocation = location;
    locationState.currentStage = 0;
    locationState.enemiesDefeated = 0;
    locationState.inLocation = true;
    
    startStage();
}

function startStage() {
    const location = locationState.currentLocation;
    const stage = location.stages[locationState.currentStage];
    
    if (!stage) {
        completeLocation();
        return;
    }
    
    const isMiniBoss = stage.boss && stage.stage % 10 !== 0;
    const isBoss = stage.boss && stage.stage % 10 === 0;
    
    let bossText = '';
    if (isMiniBoss) {
        bossText = '<p style="color: #ff9800;">👹 МИНИ-БОСС!</p>';
    } else if (isBoss) {
        bossText = '<p style="color: #ff4444;">👑 ГЛАВНЫЙ БОСС!</p>';
    }
    
    window.showNotification(`${location.name} - Этап ${stage.stage}/${location.stages.length}`, 'info');
    
    const battleUI = document.getElementById('battle-ui');
    battleUI.innerHTML = `
        <div class="dungeon-info">
            <h3>${location.name}</h3>
            <p>Этап ${stage.stage}/${location.stages.length}</p>
            <p>Врагов осталось: ${stage.enemiesCount - locationState.enemiesDefeated}</p>
            ${bossText}
            <button class="battle-btn attack" onclick="window.startStageBattle()">
                ⚔️ Сражаться!
            </button>
            <button class="battle-btn flee" onclick="window.fleeLocation()" style="margin-top: 10px;">
                🏃 Покинуть локацию
            </button>
        </div>
    `;
    
    window.showScreen('battle-screen');
}

export function startStageBattle() {
    const location = locationState.currentLocation;
    const stage = location.stages[locationState.currentStage];
    
    if (!stage) return;
    
    const enemyData = getRandomEnemy(stage.enemies);
    if (!enemyData) return;
    
    // Усиливаем врага в зависимости от этапа и локации
    const locationIndex = parseInt(location.id === 'forest' ? 1 : 
                                  location.id === 'mountains' ? 2 : 
                                  location.id === 'ruins' ? 3 : 4);
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
    
    const canvasWidth = battleState.canvas ? battleState.canvas.width : 400;
    
    import('../entities/Sprite.js').then(module => {
        const Sprite = module.Sprite;
        battleState.playerSprite = new Sprite(gameState.player.class, 100, 200);
        battleState.enemySprite = new Sprite(enemyData.id, canvasWidth - 100, 200);
        
        window.updateBattleUI();
        window.animateBattle();
    });
}

export function startBossFight(bossData) {
    window.showNotification(`👹 ПОЯВИЛСЯ БОСС: ${bossData.name}!`, 'error');
    
    const enemy = {
        id: bossData.id,
        name: bossData.name,
        icon: bossData.icon,
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
    
    const canvasWidth = battleState.canvas ? battleState.canvas.width : 400;
    
    import('../entities/Sprite.js').then(module => {
        const Sprite = module.Sprite;
        battleState.playerSprite = new Sprite(gameState.player.class, 100, 200);
        battleState.enemySprite = new Sprite(bossData.id, canvasWidth - 100, 150);
        
        window.updateBattleUI();
        window.animateBattle();
    });
}

export function completeLocation() {
    const location = locationState.currentLocation;
    const player = gameState.player;
    
    // Выдаём награды
    player.experience += location.rewards.exp;
    player.gold += location.rewards.gold;
    
    location.rewards.items.forEach(rewardItem => {
        const existingItem = player.inventory.find(item => item.id === rewardItem.id);
        
        if (existingItem) {
            existingItem.quantity += rewardItem.quantity;
        } else {
            player.inventory.push({
                id: rewardItem.id,
                quantity: rewardItem.quantity
            });
        }
    });
    
    // Открываем следующую локацию
    const nextLocation = unlockNextLocation(location.id);
    
    locationState.inLocation = false;
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
        window.exitBattle();
        window.showScreen('map-screen');
    }, 3000);
}

export function fleeLocation() {
    locationState.inLocation = false;
    locationState.currentLocation = null;
    locationState.currentStage = 0;
    locationState.enemiesDefeated = 0;
    
    window.showNotification('Вы покинули локацию. Прогресс сброшен.', 'info');
    window.exitBattle();
    window.showScreen('map-screen');
}

export function resetLocationState() {
    locationState.inLocation = false;
    locationState.currentLocation = null;
    locationState.currentStage = 0;
    locationState.enemiesDefeated = 0;
}

export function getLocationState() {
    return locationState;
}

export function handleVictory() {
    locationState.enemiesDefeated++;
    
    const location = locationState.currentLocation;
    const stage = location.stages[locationState.currentStage];
    
    setTimeout(() => {
        if (locationState.enemiesDefeated >= stage.enemiesCount) {
            if (stage.boss) {
                // Бой с боссом
                startBossFight(stage.boss);
            } else {
                // Следующий этап
                locationState.currentStage++;
                locationState.enemiesDefeated = 0;
                startStage();
            }
        } else {
            // Следующий враг
            startStageBattle();
        }
    }, 2000);
}

export function handleBossVictory() {
    const location = locationState.currentLocation;
    
    // Проверяем, был ли это последний этап
    if (locationState.currentStage >= location.stages.length - 1) {
        completeLocation();
    } else {
        // Следующий этап
        locationState.currentStage++;
        locationState.enemiesDefeated = 0;
        startStage();
    }
}

export function handleDefeat() {
    // Сбрасываем прогресс локации
    locationState.currentStage = 0;
    locationState.enemiesDefeated = 0;
    locationState.inLocation = false;
    locationState.currentLocation = null;
    
    window.showNotification('Вы погибли! Прогресс локации сброшен. Начните заново.', 'error');
}