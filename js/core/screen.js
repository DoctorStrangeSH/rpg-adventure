// Управление экранами
export const ScreenManager = {
    currentScreen: null,
    
    show(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        const screen = document.getElementById(screenId);
        if (screen) {
            screen.classList.add('active');
            this.currentScreen = screenId;
            return true;
        }
        return false;
    },
    
    update(screenId) {
        const updateFunctions = {
            'main-menu': () => window.updateMainMenu?.(),
            'character-screen': () => window.updateCharacterScreen?.(),
            'map-screen': () => window.updateMapScreen?.(),
            'battle-screen': () => window.updateBattleScreen?.(),
            'inventory-screen': () => window.updateInventoryScreen?.(),
            'quests-screen': () => window.updateQuestsScreen?.(),
            'achievements-screen': () => window.updateAchievementsScreen?.(),
            'shop-screen': () => window.updateShopScreen?.()
        };
        
        if (updateFunctions[screenId]) {
            updateFunctions[screenId]();
        }
    }
};