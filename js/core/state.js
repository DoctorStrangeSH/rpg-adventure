// Управление состоянием игры
import { GAME_CONFIG } from '../config/constants.js';
import { CLASSES } from '../data/classes.js';
import { QUESTS } from '../data/quests.js';
import { ACHIEVEMENTS } from '../data/achievements.js';

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
        
        this.player = {
            id: Date.now(),
            telegramId: window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 0,
            username: window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || 'Игрок',
            class: classId,
            level: 1,
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
            inventory: [
                { id: 'health_potion', quantity: 3 },
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
        
        return this.player;
    }
    
    save() {
        try {
            localStorage.setItem(GAME_CONFIG.saveKey, JSON.stringify(this.data));
        } catch (error) {
            console.error('Error saving game:', error);
        }
    }
    
    load() {
        try {
            const saved = localStorage.getItem(GAME_CONFIG.saveKey);
            if (saved) {
                this.data = JSON.parse(saved);
                return true;
            }
        } catch (error) {
            console.error('Error loading game:', error);
        }
        return false;
    }
}

export const gameState = new GameState();