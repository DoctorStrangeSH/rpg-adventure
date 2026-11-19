import { getItem } from '../data/items.js';

const SLOT_BY_TYPE = Object.freeze({ weapon: 'weapon', armor: 'armor' });

function getBonus(item, key) {
    const value = getItem(item)?.[key];
    return Number.isFinite(value) ? value : 0;
}

function ensureEquipment(player) {
    if (!player.equipment || typeof player.equipment !== 'object') player.equipment = {};
    for (const slot of Object.values(SLOT_BY_TYPE)) {
        if (!(slot in player.equipment)) player.equipment[slot] = null;
    }
}

export function getEquipmentSlotForItem(itemId) {
    const item = getItem(itemId);
    return item ? SLOT_BY_TYPE[item.type] || null : null;
}

export function equipInventoryItem(player, inventoryIndex) {
    if (!player || !Array.isArray(player.inventory) || !Number.isInteger(inventoryIndex) ||
        inventoryIndex < 0 || inventoryIndex >= player.inventory.length) {
        return { ok: false, reason: 'invalid_item' };
    }
    const entry = player.inventory[inventoryIndex];
    if (!entry || !Number.isSafeInteger(entry.quantity) || entry.quantity < 1) {
        return { ok: false, reason: 'invalid_quantity' };
    }
    const item = getItem(entry.id);
    const slot = item && SLOT_BY_TYPE[item.type];
    if (!item || !slot) return { ok: false, reason: 'not_equipment' };
    if ((item.requiredLevel || 1) > (Number(player.level) || 1)) {
        return { ok: false, reason: 'level_required', requiredLevel: item.requiredLevel };
    }

    ensureEquipment(player);
    if (player.equipment[slot] === item.id) return { ok: false, reason: 'already_equipped' };

    const oldId = player.equipment[slot];
    const attackDelta = getBonus(item.id, 'attackBonus') - getBonus(oldId, 'attackBonus');
    const defenseDelta = getBonus(item.id, 'defenseBonus') - getBonus(oldId, 'defenseBonus');
    player.attack = (Number(player.attack) || 0) + attackDelta;
    player.defense = (Number(player.defense) || 0) + defenseDelta;
    player.equipment[slot] = item.id;
    return { ok: true, slot, itemId: item.id, replacedItemId: oldId || null, attackDelta, defenseDelta };
}

export function unequipEquipmentItem(player, slot) {
    if (!player || !['weapon', 'armor'].includes(slot)) return { ok: false, reason: 'invalid_slot' };
    ensureEquipment(player);
    const itemId = player.equipment[slot];
    if (!itemId) return { ok: false, reason: 'empty_slot' };
    player.attack = (Number(player.attack) || 0) - getBonus(itemId, 'attackBonus');
    player.defense = (Number(player.defense) || 0) - getBonus(itemId, 'defenseBonus');
    player.equipment[slot] = null;
    return { ok: true, slot, itemId };
}
