import { getItem } from '../data/items.js';
import { LOCATIONS } from '../data/locations.js';

/**
 * Validates a batch of item awards without mutating the player.
 * Duplicate inventory stacks and duplicate rewards are counted together so
 * an award cannot overflow the aggregate quantity while each stack looks safe.
 */
export function canGrantItems(player, rewards) {
    if (!player || !Array.isArray(player.inventory) || !Array.isArray(rewards)) return false;
    const requested = new Map();
    for (const reward of rewards) {
        if (!reward || !getItem(reward.id) || !Number.isSafeInteger(reward.quantity) ||
            reward.quantity <= 0) return false;
        const previous = requested.get(reward.id) || 0;
        if (previous > Number.MAX_SAFE_INTEGER - reward.quantity) return false;
        requested.set(reward.id, previous + reward.quantity);
    }
    for (const [itemId, quantity] of requested) {
        let owned = 0;
        for (const stack of player.inventory) {
            if (stack?.id !== itemId) continue;
            if (!Number.isSafeInteger(stack.quantity) || stack.quantity < 0 ||
                owned > Number.MAX_SAFE_INTEGER - stack.quantity) return false;
            owned += stack.quantity;
        }
        if (owned > Number.MAX_SAFE_INTEGER - quantity) return false;
    }
    return true;
}

/** Applies a fully validated batch as one inventory operation. */
export function grantItemsAtomically(player, rewards) {
    if (!canGrantItems(player, rewards)) return false;
    const requested = new Map();
    for (const reward of rewards) {
        requested.set(reward.id, (requested.get(reward.id) || 0) + reward.quantity);
    }
    for (const [itemId, quantity] of requested) {
        let firstIndex = -1;
        let total = 0;
        for (let i = 0; i < player.inventory.length; i++) {
            if (player.inventory[i]?.id !== itemId) continue;
            if (firstIndex === -1) firstIndex = i;
            total += player.inventory[i].quantity;
        }
        if (firstIndex === -1) {
            player.inventory.push({ id: itemId, quantity });
        } else {
            player.inventory[firstIndex].quantity = total + quantity;
            for (let i = player.inventory.length - 1; i > firstIndex; i--) {
                if (player.inventory[i]?.id === itemId) player.inventory.splice(i, 1);
            }
        }
    }
    if (!Array.isArray(player.discoveredItems)) player.discoveredItems = [];
    for (const itemId of requested.keys()) {
        if (!player.discoveredItems.includes(itemId)) player.discoveredItems.push(itemId);
    }
    return true;
}

// Returns the quantity actually awarded; invalid IDs and quantities never modify a save.
export function grantItem(player, itemId, quantity = 1) {
    return grantItemsAtomically(player, [{ id: itemId, quantity }]) ? quantity : 0;
}

// A small, predictable economy: ordinary enemies mostly award gold; bosses
// always leave an item. RNG can be injected to make drops reproducible in tests.
const BOSS_TROPHIES = Object.freeze({
    forest_guardian: 'guardian_armor',
    mountain_dragon: 'frost_blade',
    lich_king: 'blood_armor',
    world_eater: 'dragon_sword'
});
export const BOSS_RUNE_DROPS = Object.freeze({
    forest_guardian: 'verdant',
    mountain_dragon: 'dragon',
    lich_king: 'lich',
    world_eater: 'world'
});
const BOSS_RUNE_ITEMS = Object.freeze({
    forest_guardian: 'rune_verdant_heart',
    mountain_dragon: 'rune_dragon_heart',
    lich_king: 'rune_lich_soul',
    world_eater: 'rune_world_fragment'
});

// Story bosses favor loot tied to their region; the remaining rolls retain
// the normal boss pool, so repeat encounters can still yield varied equipment.
export function hasBossTrophy(player, bossId) {
    const trophyId = BOSS_TROPHIES[bossId];
    if (!trophyId || !player) return false;
    return (Array.isArray(player.discoveredItems) && player.discoveredItems.includes(trophyId)) ||
        (Array.isArray(player.inventory) && player.inventory.some(entry => entry?.id === trophyId && entry.quantity > 0));
}

export function rollLoot(isBoss = false, random = Math.random, bossId = null, trophyAlreadyOwned = false) {
    const roll = random();
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return null;
    if (isBoss && Object.hasOwn(BOSS_TROPHIES, bossId)) {
        if (roll < 0.18) return BOSS_RUNE_ITEMS[bossId];
        if (roll < 0.65) {
            if (!trophyAlreadyOwned) return BOSS_TROPHIES[bossId];
            // Once the regional trophy is collected, repeated boss fights
            // convert that slot into useful consumables instead of duplicates.
            return roll < 0.415 ? 'big_health_potion' : 'mana_potion';
        }
    }
    if (!isBoss && roll >= 0.18) return null;
    const tier = isBoss ? roll : roll / 0.18;
    if (isBoss && tier < 0.06) return 'dragon_sword';
    if (isBoss && tier < 0.16) return 'moonblade';
    if (tier < 0.28) return 'ember_sword';
    if (tier < 0.40) return 'guardian_armor';
    if (tier < 0.48) return 'blood_dagger';
    if (tier < 0.72) return 'big_health_potion';
    return 'mana_potion';
}


/**
 * Claims one deep-chest attempt per milestone and campaign cycle.
 * The attempt is consumed even when the chest roll produces no item, preventing
 * re-entering a cleared region from rerolling the same milestone indefinitely.
 */
export function claimDeepChestAttempt(player, locationId, stageNumber) {
    const location = LOCATIONS.find(entry => entry.id === locationId && entry.type !== 'safe');
    if (!player || !location || !Number.isSafeInteger(stageNumber) ||
        stageNumber < 20 || stageNumber > location.totalStages || stageNumber % 10 !== 0) return false;

    const cycle = Number.isSafeInteger(player.campaignCycle) && player.campaignCycle >= 1
        ? player.campaignCycle : 1;
    if (!player.deepChestRewardCycles || typeof player.deepChestRewardCycles !== 'object' ||
        Array.isArray(player.deepChestRewardCycles)) player.deepChestRewardCycles = {};

    const key = `${locationId}:${stageNumber}`;
    const previousCycle = player.deepChestRewardCycles[key];
    if (Number.isSafeInteger(previousCycle) && previousCycle >= cycle) return false;

    player.deepChestRewardCycles[key] = cycle;
    return true;
}

// Deep chests can only drop after a major boss milestone (stage 20, 30, ...).
// One roll controls both eligibility and contents for reproducible rewards.
export function rollDeepChest(stageNumber, roll = Math.random()) {
    if (!Number.isInteger(stageNumber) || stageNumber < 20 || stageNumber % 10 !== 0 ||
        !Number.isFinite(roll) || roll < 0 || roll >= 1) return null;
    const chance = stageNumber >= 40 ? 0.55 : stageNumber >= 30 ? 0.45 : 0.35;
    if (roll >= chance) return null;
    const tierRoll = roll / chance;
    if (stageNumber >= 40) return tierRoll < 0.25 ? 'moonblade' : tierRoll < 0.75 ? 'frost_blade' : 'dragon_sword';
    if (stageNumber >= 30) return tierRoll < 0.4 ? 'moonblade' : tierRoll < 0.9 ? 'frost_blade' : 'dragon_sword';
    return tierRoll < 0.7 ? 'moonblade' : 'frost_blade';
}

export const BOSS_TROPHY_CATALOG = Object.freeze([
 { bossId: 'forest_guardian', bossName: 'Лесной хранитель', itemId: 'guardian_armor', region: 'Зелёные пределы' },
 { bossId: 'mountain_dragon', bossName: 'Горный дракон', itemId: 'frost_blade', region: 'Ледяные высоты' },
 { bossId: 'lich_king', bossName: 'Король-лич', itemId: 'blood_armor', region: 'Забытый некрополь' },
 { bossId: 'world_eater', bossName: 'Пожиратель миров', itemId: 'dragon_sword', region: 'Край мира' }
]);
export function getBossTrophyCatalog(discoveredItems = []) {
 const discovered = new Set(Array.isArray(discoveredItems) ? discoveredItems : []);
 return BOSS_TROPHY_CATALOG.map(entry => ({ ...entry, discovered: discovered.has(entry.itemId) }));
}
export function getCollectionProgress(discoveredItems = []) {
 const entries = getBossTrophyCatalog(discoveredItems);
 return { discovered: entries.filter(entry => entry.discovered).length, total: entries.length, entries };
}
