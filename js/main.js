// Точка входа
import { gameState } from './core/state.js';
import { ScreenManager } from './core/screen.js';
import { SoundSystem } from './systems/sound.js';
import { healPlayer, restorePlayerMana, addPlayerGold } from './systems/playerUtilities.js';
import { initUI, showClassSelection, showRecoveryScreen, updateMainMenu, createPlayerWithPersistence } from './ui/mainMenu.js';
import { updateCharacterScreen, levelUp, chooseTalent, toggleCharacterRelic } from './ui/character.js';
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
    showBattleMessage,
    getBattleState
} from './ui/battle.js';
import { updateInventoryScreen, useInventoryItem, unequipItem } from './ui/inventory.js';
import { updateShopScreen, buyItem } from './ui/shop.js';
import { updateQuestsScreen, updateQuestProgress, claimQuestReward } from './ui/quests.js';
import { updateAchievementsScreen, updateAchievements, claimAchievement } from './ui/achievements.js';
import { updateEndingScreen, startNewGamePlusFromEnding } from './ui/ending.js';
import { 
    startLocation, 
    startStageBattle,
    startBossFight,
    completeLocation,
    fleeLocation,
    resetLocationState,
    getLocationState,
    handleVictory,
    handleBossVictory,
    handleDefeat,
    chooseAdventureEvent,
    chooseDungeonRoute,
    chooseDungeonCheckpoint,
    chooseSecretRoom
} from './systems/dungeon.js';

// Инициализация Telegram
const tg = window.Telegram?.WebApp;
tg?.ready?.();
tg?.expand?.();
tg?.setHeaderColor?.('#0a0a1a');
tg?.setBackgroundColor?.('#0a0a1a');

// Глобальные функции для HTML
window.showScreen = function(screenId) {
    ScreenManager.show(screenId);
    ScreenManager.update(screenId);
};

window.selectClass = function(classId) {
    if (!createPlayerWithPersistence(classId)) return;
    initUI();
    ScreenManager.show('main-menu');
    updateMainMenu();
};

window.restoreRecoverySave = function() {
    if (!gameState.canRestoreRecovery()) {
        showNotification('Резервная копия повреждена или несовместима с этой версией игры.', 'error');
        showClassSelection();
        return false;
    }
    if (!gameState.restoreRecovery()) {
        showNotification('Не удалось восстановить резервную копию. Исходная копия сохранена — попробуйте ещё раз.', 'error');
        return false;
    }
    initUI();
    ScreenManager.show('main-menu');
    updateMainMenu();
    showNotification('Профиль успешно восстановлен из резервной копии.', 'success');
    return true;
};

window.showClassSelection = showClassSelection;
window.updateMainMenu = updateMainMenu;
window.initUI = initUI;
window.updateEndingScreen = updateEndingScreen;
window.startNewGamePlus = startNewGamePlusFromEnding;
window.updateCharacterScreen = updateCharacterScreen;
window.levelUp = levelUp;
window.chooseTalent = chooseTalent;
window.toggleCharacterRelic = toggleCharacterRelic;

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
window.getBattleState = getBattleState;

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

window.startLocation = startLocation;
window.startStageBattle = startStageBattle;
window.startBossFight = startBossFight;
window.completeLocation = completeLocation;
window.fleeLocation = fleeLocation;
window.resetLocationState = resetLocationState;
window.getLocationState = getLocationState;
window.handleVictory = handleVictory;
window.handleBossVictory = handleBossVictory;
window.handleDefeat = handleDefeat;
window.chooseAdventureEvent = chooseAdventureEvent;
window.chooseDungeonRoute = chooseDungeonRoute;
window.chooseDungeonCheckpoint = chooseDungeonCheckpoint;
window.chooseSecretRoom = chooseSecretRoom;

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
    if (!healPlayer(gameState.player, amount, () => gameState.save())) {
        showNotification('Не удалось сохранить восстановление здоровья. Изменения отменены.', 'error');
        return false;
    }
    updateMainMenu();
    updateCharacterScreen();
    return true;
};

window.restoreMana = function(amount) {
    if (!restorePlayerMana(gameState.player, amount, () => gameState.save())) {
        showNotification('Не удалось сохранить восстановление маны. Изменения отменены.', 'error');
        return false;
    }
    updateMainMenu();
    updateCharacterScreen();
    return true;
};

window.addGold = function(amount) {
    if (!addPlayerGold(gameState.player, amount, () => gameState.save())) {
        showNotification('Не удалось сохранить получение золота. Изменения отменены.', 'error');
        return false;
    }
    updateMainMenu();
    updateCharacterScreen();
    return true;
};

// Инициализация игры
function initGame() {
    SoundSystem.init();
    
    const loadingScreen = document.getElementById('loading-screen');
    
    setTimeout(() => {
        if (!gameState.load()) {
            if (gameState.canRestoreRecovery()) showRecoveryScreen();
            else showClassSelection();
        } else {
            initUI();
            ScreenManager.show('main-menu');
            updateMainMenu();
        }
        
        loadingScreen.classList.remove('active');
    }, 1000);
}

document.addEventListener('DOMContentLoaded', initGame);
