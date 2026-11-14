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
export function rollLoot(isBoss = false, random = Math.random) {
    const roll = random();
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return null;
    if (!isBoss && roll >= 0.18) return null;
    const tier = isBoss ? roll : roll / 0.18;
    if (isBoss && tier < 0.10) return 'dragon_sword';
    if (tier < 0.28) return 'iron_sword';
    if (tier < 0.48) return 'leather_armor';
    if (tier < 0.72) return 'big_health_potion';
    return 'mana_potion';
}
