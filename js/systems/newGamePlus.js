import { QUESTS } from '../data/quests.js';
import { LOCATIONS } from '../data/locations.js';

export function canStartNewGamePlus(player) {
    return Boolean(player && player.campaignCompleted === true &&
        player.newGamePlusUnlocked === true &&
        Number.isSafeInteger(player.campaignCycle) && player.campaignCycle >= 1);
}

export function completeCampaign(player, completedAt = new Date().toISOString()) {
    if (!player || !Number.isSafeInteger(player.campaignCycle) || player.campaignCycle < 1 ||
        player.lastCompletedCampaignCycle === player.campaignCycle) return false;
    player.campaignCompleted = true;
    player.newGamePlusUnlocked = true;
    player.completedCampaignCycles = Number.isSafeInteger(player.completedCampaignCycles)
        ? Math.max(0, player.completedCampaignCycles) + 1 : 1;
    player.lastCompletedCampaignCycle = player.campaignCycle;
    player.campaignCompletedAt = completedAt;
    return true;
}

export function claimLocationReward(player, locationId) {
    if (!player || typeof locationId !== 'string' ||
        !LOCATIONS.some(location => location.id === locationId && location.type !== 'safe')) return false;
    player.locationRewardCycles ||= {};
    const cycle = Number.isSafeInteger(player.campaignCycle) && player.campaignCycle >= 1
        ? player.campaignCycle : 1;
    if (player.locationRewardCycles[locationId] === cycle) return false;
    player.locationRewardCycles[locationId] = cycle;
    return true;
}

export function prepareNewGamePlus(player) {
    if (!canStartNewGamePlus(player) || player.campaignCycle >= Number.MAX_SAFE_INTEGER) return null;
    const next = JSON.parse(JSON.stringify(player));
    const savedQuests = new Map((Array.isArray(next.quests) ? next.quests : [])
        .filter(entry => entry && typeof entry.id === 'string')
        .map(entry => [entry.id, entry]));

    next.campaignCycle += 1;
    next.campaignCompleted = false;
    next.campaignCompletedAt = null;
    next.newGamePlusUnlocked = true;
    next.unlockedLocations = ['forest'];
    next.dungeonCheckpoints = {};
    next.dungeonProgress = {};
    next.health = next.maxHealth;
    next.mana = next.maxMana;
    next.quests = QUESTS.map(quest => {
        const saved = savedQuests.get(quest.id);
        if (saved?.completed === true || saved?.rewardClaimed === true) {
            return {
                id: quest.id,
                progress: quest.target,
                completed: true,
                rewardClaimed: saved.rewardClaimed === true
            };
        }
        return { id: quest.id, progress: 0, completed: false, rewardClaimed: false };
    });
    return next;
}

export function startNewGamePlus(gameState) {
    const currentPlayer = gameState?.player;
    const nextPlayer = prepareNewGamePlus(currentPlayer);
    if (!nextPlayer || typeof gameState.save !== 'function') return false;

    const previousUnlocks = LOCATIONS.map(location => location.unlocked);
    gameState.player = nextPlayer;
    LOCATIONS.forEach(location => {
        location.unlocked = location.type === 'safe' || location.id === 'forest';
    });

    if (gameState.save() !== true) {
        gameState.player = currentPlayer;
        LOCATIONS.forEach((location, index) => { location.unlocked = previousUnlocks[index]; });
        return false;
    }
    return true;
}
