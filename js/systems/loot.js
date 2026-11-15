import { getItem } from '../data/items.js';

// Returns the quantity actually awarded; invalid IDs and quantities never modify a save.
export function grantItem(player, itemId, quantity = 1) {
    if (!player || !Array.isArray(player.inventory) || !getItem(itemId) ||
        !Number.isSafeInteger(quantity) || quantity <= 0) return 0;
    const existing = player.inventory.find(item => item.id === itemId);
    if (existing) {
        if (!Number.isSafeInteger(existing.quantity) || existing.quantity < 0 ||
            existing.quantity > Number.MAX_SAFE_INTEGER - quantity) return 0;
        existing.quantity += quantity;
    } else {
        player.inventory.push({ id: itemId, quantity });
    }
    return quantity;
}

// A small, predictable economy: ordinary enemies mostly award gold; bosses
// always leave an item. RNG can be injected to make drops reproducible in tests.
const BOSS_TROPHIES = Object.freeze({
    forest_guardian: 'guardian_armor',
    mountain_dragon: 'frost_blade',
    lich_king: 'blood_armor',
    world_eater: 'dragon_sword'
});

// Story bosses favor loot tied to their region; the remaining rolls retain
// the normal boss pool, so repeat encounters can still yield varied equipment.
export function rollLoot(isBoss = false, random = Math.random, bossId = null) {
    const roll = random();
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return null;
    if (isBoss && Object.hasOwn(BOSS_TROPHIES, bossId) && roll < 0.65) {
        return BOSS_TROPHIES[bossId];
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
