import { getItem } from '../data/items.js';
import { grantItem } from './loot.js';

export const CRAFTING_RECIPES = Object.freeze([
    { id: 'iron_sword', name: 'Железный меч', output: 'iron_sword', materials: { iron_ore: 8 }, gold: 80, station: 'forge', requiredLevel: 2 },
    { id: 'ember_sword', name: 'Клинок угольного пламени', output: 'ember_sword', materials: { iron_ore: 5, ember_core: 3 }, gold: 180, station: 'forge', requiredLevel: 4 },
    { id: 'frost_blade', name: 'Клинок ледяного дозора', output: 'frost_blade', materials: { iron_ore: 4, frost_crystal: 4 }, gold: 240, station: 'forge', requiredLevel: 6 },
    { id: 'blood_dagger', name: 'Кинжал кровавой клятвы', output: 'blood_dagger', materials: { iron_ore: 3, blood_essence: 4 }, gold: 220, station: 'forge', requiredLevel: 5 },
    { id: 'dragon_sword', name: 'Драконий меч', output: 'dragon_sword', materials: { ember_core: 5, frost_crystal: 5, blood_essence: 5, dragon_scale: 3 }, gold: 1200, station: 'forge', requiredLevel: 10, requiresDiscovery: 'dragon_scale' }
]);

function countItem(player, id) {
    return player.inventory.filter(entry => entry.id === id).reduce((sum, entry) => sum + entry.quantity, 0);
}

export function getCraftingAvailability(player, recipe) {
    if (!player || !recipe) return { available: false, reason: 'invalid_recipe' };
    if ((player.level || 1) < recipe.requiredLevel) return { available: false, reason: 'level', requiredLevel: recipe.requiredLevel };
    if (recipe.requiresDiscovery && !player.discoveredItems?.includes(recipe.requiresDiscovery)) {
        return { available: false, reason: 'discovery', requiredItem: recipe.requiresDiscovery };
    }
    if ((player.gold || 0) < recipe.gold) return { available: false, reason: 'gold', missing: recipe.gold - (player.gold || 0) };
    for (const [id, quantity] of Object.entries(recipe.materials)) {
        const missing = quantity - countItem(player, id);
        if (missing > 0) return { available: false, reason: 'materials', itemId: id, missing };
    }
    return { available: true };
}

export function craftItem(player, recipeId) {
    const recipe = CRAFTING_RECIPES.find(entry => entry.id === recipeId);
    const availability = getCraftingAvailability(player, recipe);
    if (!availability.available) return { ok: false, ...availability };
    const output = getItem(recipe.output);
    if (!output) return { ok: false, reason: 'invalid_output' };
    // Validate every stack before consuming anything; crafting is atomic.
    for (const [id, quantity] of Object.entries(recipe.materials)) {
        if (countItem(player, id) < quantity) return { ok: false, reason: 'materials', itemId: id };
    }
    const oldQuantity = countItem(player, recipe.output);
    if (oldQuantity > Number.MAX_SAFE_INTEGER - 1) return { ok: false, reason: 'inventory_limit' };
    for (const [id, quantity] of Object.entries(recipe.materials)) {
        let remaining = quantity;
        for (let i = player.inventory.length - 1; i >= 0 && remaining > 0; i--) {
            const entry = player.inventory[i];
            if (entry.id !== id) continue;
            const used = Math.min(entry.quantity, remaining);
            entry.quantity -= used;
            remaining -= used;
            if (entry.quantity === 0) player.inventory.splice(i, 1);
        }
    }
    player.gold -= recipe.gold;
    const awarded = grantItem(player, recipe.output, 1);
    if (awarded !== 1) return { ok: false, reason: 'award_failed' };
    return { ok: true, item: output, recipe };
}
