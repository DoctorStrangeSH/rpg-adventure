// Точка входа
import { gameState } from './core/state.js';
import { ScreenManager } from './core/screen.js';
import { SoundSystem } from './systems/sound.js';
import { initUI, showClassSelection, updateMainMenu } from './ui/mainMenu.js';
import { updateCharacterScreen, levelUp } from './ui/character.js';
import { initMap, updateMapScreen, enterLocation } from './ui/map.js';
import { 
    initBattle, 
    updateBattleScreen, 
    startBattle, 
    playerAttack, 
    playerDefend,
    playerSkill,
    playerUseItem,
    playerFlee,
    battleVictory,
    battleDefeat,
    exitBattle,
    updateBattleUI,
    animateBattle,
    showBattleMessage
} from './ui/battle.js';
import { updateInventoryScreen, useInventoryItem, unequipItem } from './ui/inventory.js';
import { updateShopScreen, buyItem } from './ui/shop.js';
import { updateQuestsScreen, updateQuestProgress, claimQuestReward } from './ui/quests.js';
import { updateAchievementsScreen, updateAchievements, claimAchievement } from './ui/achievements.js';
import { 
    startDungeon, 
    startDungeonBattle, 
    startBossFight,
    completeDungeon,
    startBossBattle,
    getDungeonState,
    resetDungeonState
} from './systems/dungeon.js';

// Инициализация Telegram
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();
tg.setHeaderColor('#0a0a1a');
tg.setBackgroundColor('#0a0a1a');

// Глобальные функции для HTML
window.showScreen = function(screenId) {
    ScreenManager.show(screenId);
    ScreenManager.update(screenId);
};

window.selectClass = function(classId) {
    gameState.createPlayer(classId);
    gameState.save();
    initUI();
    ScreenManager.show('main-menu');
    updateMainMenu();
};

window.showClassSelection = showClassSelection;
window.updateMainMenu = updateMainMenu;
window.updateCharacterScreen = updateCharacterScreen;
window.levelUp = levelUp;

window.initMap = initMap;
window.updateMapScreen = updateMapScreen;
window.enterLocation = enterLocation;

window.initBattle = initBattle;
window.updateBattleScreen = updateBattleScreen;
window.startBattle = startBattle;
window.playerAttack = playerAttack;
window.playerDefend = playerDefend;
window.playerSkill = playerSkill;
window.playerUseItem = playerUseItem;
window.playerFlee = playerFlee;
window.battleVictory = battleVictory;
window.battleDefeat = battleDefeat;
window.exitBattle = exitBattle;
window.updateBattleUI = updateBattleUI;
window.animateBattle = animateBattle;
window.showBattleMessage = showBattleMessage;

window.updateInventoryScreen = updateInventoryScreen;
window.useInventoryItem = useInventoryItem;
window.unequipItem = unequipItem;

window.updateShopScreen = updateShopScreen;
window.buyItem = buyItem;

window.updateQuestsScreen = updateQuestsScreen;
window.updateQuestProgress = updateQuestProgress;
window.claimQuestReward = claimQuestReward;

window.updateAchievementsScreen = updateAchievementsScreen;
window.updateAchievements = updateAchievements;
window.claimAchievement = claimAchievement;

window.startDungeon = startDungeon;
window.startDungeonBattle = startDungeonBattle;
window.startBossFight = startBossFight;
window.completeDungeon = completeDungeon;
window.startBossBattle = startBossBattle;
window.getDungeonState = getDungeonState;
window.resetDungeonState = resetDungeonState;

// Уведомления
window.showNotification = function(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.borderColor = type === 'success' ? 'var(--green)' : 
                                    type === 'error' ? 'var(--red)' : 
                                    'var(--accent)';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
};

// Вспомогательные функции
window.heal = function(amount) {
    const player = gameState.player;
    player.health = Math.min(player.maxHealth, player.health + amount);
    gameState.save();
    updateMainMenu();
    updateCharacterScreen();
};

window.restoreMana = function(amount) {
    const player = gameState.player;
    player.mana = Math.min(player.maxMana, player.mana + amount);
    gameState.save();
    updateMainMenu();
    updateCharacterScreen();
};

// Инициализация игры
function initGame() {
    SoundSystem.init();
    
    const loadingScreen = document.getElementById('loading-screen');
    
    setTimeout(() => {
        if (!gameState.load()) {
            showClassSelection();
        } else {
            initUI();
            ScreenManager.show('main-menu');
            updateMainMenu();
        }
        
        loadingScreen.classList.remove('active');
    }, 1000);
}

document.addEventListener('DOMContentLoaded', initGame);