// Управление сохранением
import { GAME_CONFIG } from '../config/constants.js';

export const Storage = {
    save(data) {
        try {
            localStorage.setItem(GAME_CONFIG.saveKey, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving:', error);
            return false;
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
        try {
            localStorage.removeItem(GAME_CONFIG.saveKey);
            return true;
        } catch (error) {
            console.error('Error clearing save:', error);
            return false;
        }
    }
};
