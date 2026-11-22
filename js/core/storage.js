// Управление сохранением
import { GAME_CONFIG } from '../config/constants.js';

export const RECOVERY_SAVE_KEY = `${GAME_CONFIG.saveKey}.recovery`;

function needsRecoveryBackup(raw, nextData) {
    if (raw === null) return false;
    let existing;
    try {
        existing = JSON.parse(raw);
    } catch {
        return true;
    }

    if (!existing || typeof existing !== 'object' || Array.isArray(existing) ||
        !existing.player || typeof existing.player !== 'object' || Array.isArray(existing.player)) {
        return true;
    }

    // A save from a newer schema must never be silently replaced by this build.
    if (Object.hasOwn(existing, 'schemaVersion') &&
        (!Number.isSafeInteger(existing.schemaVersion) || existing.schemaVersion < 0)) {
        return true;
    }
    return Number.isSafeInteger(existing.schemaVersion) &&
        Number.isSafeInteger(nextData?.schemaVersion) &&
        existing.schemaVersion > nextData.schemaVersion;
}

export const Storage = {
    save(data) {
        try {
            // Never replace a recoverable profile with a value that cannot be
            // loaded as a save envelope. JSON.stringify(undefined) is especially
            // dangerous because Web Storage coerces it to the literal "undefined".
            if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
            const serialized = JSON.stringify(data);
            if (typeof serialized !== 'string') return false;
            const parsed = JSON.parse(serialized);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
                !parsed.player || typeof parsed.player !== 'object' || Array.isArray(parsed.player)) {
                return false;
            }

            const existingRaw = localStorage.getItem(GAME_CONFIG.saveKey);
            if (needsRecoveryBackup(existingRaw, data) &&
                localStorage.getItem(RECOVERY_SAVE_KEY) === null) {
                // Keep the first recovery copy until the user explicitly replaces it.
                // A later failed/invalid save must never overwrite the only known backup.
                localStorage.setItem(RECOVERY_SAVE_KEY, existingRaw);
            }
            localStorage.setItem(GAME_CONFIG.saveKey, serialized);
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

    loadRecovery() {
        try {
            const saved = localStorage.getItem(RECOVERY_SAVE_KEY);
            return saved === null ? null : JSON.parse(saved);
        } catch (error) {
            console.error('Error loading recovery save:', error);
            return null;
        }
    },

    restoreRecovery(validatedData = null) {
        try {
            const saved = localStorage.getItem(RECOVERY_SAVE_KEY);
            if (saved === null) return false;
            const payload = validatedData === null ? saved : JSON.stringify(validatedData);
            localStorage.setItem(GAME_CONFIG.saveKey, payload);
            return true;
        } catch (error) {
            console.error('Error restoring recovery save:', error);
            return false;
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
