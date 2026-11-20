import { createPlayerSnapshot, restorePlayerSnapshot, commitPlayerMutation } from './playerTransactions.js';

function persistChange(player, mutate, save) {
    if (!player || typeof save !== 'function') return false;
    const snapshot = createPlayerSnapshot(player);
    if (!snapshot) return false;
    try {
        if (mutate(player) === false) {
            restorePlayerSnapshot(player, snapshot);
            return false;
        }
    } catch {
        restorePlayerSnapshot(player, snapshot);
        return false;
    }
    return commitPlayerMutation(player, snapshot, save);
}

export function healPlayer(player, amount, save) {
    if (!Number.isFinite(amount) || amount <= 0 ||
        !Number.isFinite(player?.health) || !Number.isFinite(player?.maxHealth) ||
        player.maxHealth < 0) return false;
    const nextHealth = Math.min(player.maxHealth, player.health + amount);
    if (nextHealth === player.health) return true;
    return persistChange(player, target => {
        target.health = nextHealth;
        return true;
    }, save);
}

export function restorePlayerMana(player, amount, save) {
    if (!Number.isFinite(amount) || amount <= 0 ||
        !Number.isFinite(player?.mana) || !Number.isFinite(player?.maxMana) ||
        player.maxMana < 0) return false;
    const nextMana = Math.min(player.maxMana, player.mana + amount);
    if (nextMana === player.mana) return true;
    return persistChange(player, target => {
        target.mana = nextMana;
        return true;
    }, save);
}

export function addPlayerGold(player, amount, save) {
    if (!Number.isSafeInteger(amount) || amount <= 0 ||
        !Number.isSafeInteger(player?.gold) || player.gold < 0 ||
        player.gold > Number.MAX_SAFE_INTEGER - amount) return false;
    return persistChange(player, target => {
        target.gold += amount;
        return true;
    }, save);
}
