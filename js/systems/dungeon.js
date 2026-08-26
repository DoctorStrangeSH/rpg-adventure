// Система подземелий
import { gameState } from '../core/state.js';
import { DUNGEONS, getDungeon } from '../data/dungeons.js';
import { getRandomEnemy } from '../data/enemies.js';
import { getBattleState } from '../ui/battle.js';

let dungeonState = {
    currentDungeon: null,
    currentFloor: 0,
    enemiesDefeated: 0,
    inDungeon: false
};

export function startDungeon(location) {
    const player = gameState.player;
    
    const dungeon = DUNGEONS.find(d => d.id === location.id);
    
    if (!dungeon) {
        window.showNotification('Подземелье не найдено!', 'error');
        return;
    }
    
    if (player.level < dungeon.minLevel) {
        window.showNotification(`Требуется ${dungeon.minLevel} уровень!`, 'error');
        return;
    }
    
    dungeonState.currentDungeon = dungeon;
    dungeonState.currentFloor = 0;
    dungeonState.enemiesDefeated = 0;
    dungeonState.inDungeon = true;
    
    startDungeonFloor();
}

function startDungeonFloor() {
    const dungeon = dungeonState.currentDungeon;
    const floor = dungeon.floors[dungeonState.currentFloor];
    
    window.showNotification(`Вы входите на ${floor.floor} этаж!`, 'info');
    
    const battleUI = document.getElementById('battle-ui');
    battleUI.innerHTML = `
        <div class="dungeon-info">
            <h3>${dungeon.name} - Этаж ${floor.floor}</h3>
            <p>Врагов осталось: ${floor.enemiesCount - dungeonState.enemiesDefeated}</p>
            <button class="battle-btn attack" onclick="window.startDungeonBattle()">
                ⚔️ Сражаться!
            </button>
        </div>
    `;
    
    window.showScreen('battle-screen');
}

export function startDungeonBattle() {
    const dungeon = dungeonState.currentDungeon;
    const floor = dungeon.floors[dungeonState.currentFloor];
    
    const enemyData = getRandomEnemy(floor.enemies);
    
    if (!enemyData) return;
    
    const enemy = {
        ...enemyData,
        health: enemyData.health * 1.5,
        maxHealth: enemyData.health * 1.5,
        attack: enemyData.attack * 1.2,
        defense: enemyData.defense * 1.2,
        expReward: enemyData.expReward * 1.5,
        goldReward: enemyData.goldReward * 1.5
    };
    
    const battleState = getBattleState();
    battleState.currentEnemy = enemy;
    battleState.isActive = true;
    battleState.animationFrame = 0;
    battleState.turn = 'player';
    battleState.isDungeonBattle = true;
    
    // Здесь нужно создать спрайты
    const canvasWidth = battleState.canvas ? battleState.canvas.width : 400;
    
    // Импортируем Sprite динамически
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
    
    const canvasWidth = battleState.canvas ? battleState.canvas.width : 400;
    
    import('../entities/Sprite.js').then(module => {
        const Sprite = module.Sprite;
        battleState.playerSprite = new Sprite(gameState.player.class, 100, 200);
        battleState.enemySprite = new Sprite(bossData.id, canvasWidth - 100, 150);
        
        window.updateBattleUI();
        window.animateBattle();
    });
}

export function completeDungeon() {
    const dungeon = dungeonState.currentDungeon;
    const player = gameState.player;
    
    player.experience += dungeon.rewards.exp;
    player.gold += dungeon.rewards.gold;
    
    dungeon.rewards.items.forEach(rewardItem => {
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
    
    dungeonState.inDungeon = false;
    dungeonState.currentDungeon = null;
    dungeonState.currentFloor = 0;
    dungeonState.enemiesDefeated = 0;
    
    window.showNotification(`🎉 Подземелье пройдено! +${dungeon.rewards.exp} EXP, +${dungeon.rewards.gold} золота!`, 'success');
    
    gameState.save();
    window.updateMainMenu?.();
    window.updateQuestsScreen?.();
    
    setTimeout(() => {
        window.exitBattle();
        window.showScreen('map-screen');
    }, 2000);
}

export function startBossBattle(location) {
    const player = gameState.player;
    
    const dungeon = DUNGEONS.find(d => d.id === 'dragon_lair');
    
    if (dungeon) {
        const bossFloor = dungeon.floors.find(f => f.boss);
        if (bossFloor && bossFloor.boss) {
            window.showNotification(`Вы встречаете босса: ${bossFloor.boss.name}!`, 'error');
            startBossFight(bossFloor.boss);
            return;
        }
    }
    
    window.startBattle(location);
}

export function getDungeonState() {
    return dungeonState;
}

export function resetDungeonState() {
    dungeonState.inDungeon = false;
    dungeonState.currentDungeon = null;
    dungeonState.currentFloor = 0;
    dungeonState.enemiesDefeated = 0;
}