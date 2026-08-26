// Управление сохранением
import { GAME_CONFIG } from '../config/constants.js';

export const Storage = {
    save(data) {
        try {
            localStorage.setItem(GAME_CONFIG.saveKey, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving:', error);
        }
    },
    
    load() {
        try {
            const saved = localStorage.getItem(GAME_CONFIG.saveKey);
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Error loading:', error);
            return null;
        }
    },
    
    clear() {
        localStorage.removeItem(GAME_CONFIG.saveKey);
    }
};