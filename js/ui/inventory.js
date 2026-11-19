// Экран инвентаря
import { gameState } from '../core/state.js';
import { getItem, getItemAbilityDescription, RARITIES } from '../data/items.js';
import { getEquipmentSetBonuses } from '../systems/combat.js';
import { equipInventoryItem, unequipEquipmentItem } from '../systems/equipment.js';

export function updateInventoryScreen() {
    const player = gameState.player;
    if (!player) return;
    
    const content = document.getElementById('inventory-content');
    
    const setBonuses = getEquipmentSetBonuses(player);
    const setSummary = setBonuses.activeSets.length
        ? setBonuses.activeSets.map(set => `${set.name} (+10 п.п. к шансу эффекта оружия)`).join(', ')
        : 'Нет активных комплектов';
    content.innerHTML = `
        <div class="section-title">⚔️ Экипировка</div>
        <div class="equipment-slots">
            ${createEquipmentSlot('weapon', '⚔️', 'Оружие', player.equipment.weapon)}
            ${createEquipmentSlot('armor', '🛡️', 'Броня', player.equipment.armor)}
        </div>
        
        <div class="section-title">✨ Комплекты</div>
        <div class="equipment-set-summary">${setSummary}${setBonuses.attack ? ` · +${setBonuses.attack} атаки` : ''}${setBonuses.defense ? ` · +${setBonuses.defense} защиты` : ''}</div>
        <div class="section-title">🎒 Предметы</div>
        <div class="inventory-grid">
            ${player.inventory.length > 0 ? player.inventory.map((item, index) => 
                createInventoryItem(item, index, player)
            ).join('') : '<p style="text-align: center; color: var(--text-muted);">Инвентарь пуст</p>'}
        </div>
        
        <div class="gold-info">
            <span>💰 Золото: ${player.gold}</span>
        </div>
    `;
}

function createEquipmentSlot(slot, icon, name, itemId) {
    const itemData = itemId ? getItem(itemId) : null;
    
    return `
        <div class="equipment-slot" onclick="window.unequipItem('${slot}')">
            <div class="slot-icon">${icon}</div>
            <div class="slot-name">${name}</div>
            <div class="slot-item">
                ${itemData ? itemData.icon + ' ' + itemData.name : 'Пусто'}
            </div>
            ${itemData && getItemAbilityDescription(itemData) ? `<div class="item-stats">${getItemAbilityDescription(itemData)}</div>` : ''}
        </div>
    `;
}

function createInventoryItem(item, index, player) {
    const itemData = getItem(item.id);
    if (!itemData) return '';
    
    const isEquipped = (player.equipment.weapon === item.id || player.equipment.armor === item.id);
    const currentItem = itemData.type === 'weapon' || itemData.type === 'armor'
        ? getItem(player.equipment[itemData.type]) : null;
    const currentBonus = itemData.type === 'weapon' ? (currentItem?.attackBonus || 0) : (currentItem?.defenseBonus || 0);
    const newBonus = itemData.type === 'weapon' ? (itemData.attackBonus || 0) : (itemData.defenseBonus || 0);
    const statLabel = itemData.type === 'weapon' ? '⚔️ Атака' : '🛡️ Защита';
    const difference = newBonus - currentBonus;
    const levelLocked = (itemData.requiredLevel || 1) > player.level;
    
    return `
        <div class="inventory-item ${isEquipped ? 'equipped' : ''}" onclick="window.useInventoryItem(${index})">
            <div class="item-icon">${itemData.icon}</div>
            <div class="item-name">${itemData.name}</div>
            <div class="item-rarity" style="color:${RARITIES[itemData.rarity]?.color || RARITIES.common.color}">${RARITIES[itemData.rarity]?.name || RARITIES.common.name}</div>
            ${getItemAbilityDescription(itemData) ? `<div class="item-stats">${getItemAbilityDescription(itemData)}</div>` : ''}
            ${['weapon', 'armor'].includes(itemData.type) ? `<div class="item-stats">${statLabel}: +${newBonus} <span style="color:${difference >= 0 ? '#6ee7b7' : '#fca5a5'}">(${difference >= 0 ? '+' : ''}${difference})</span></div>` : ''}
            ${itemData.requiredLevel ? `<div class="item-stats">${levelLocked ? '🔒 ' : ''}Уровень ${itemData.requiredLevel}</div>` : ''}
            <div class="item-quantity">x${item.quantity}</div>
            ${isEquipped ? '<div class="equipped-badge">✓</div>' : ''}
        </div>
    `;
}

export function useInventoryItem(index) {
    const player = gameState.player;
    if (!player || !Number.isInteger(index) || index < 0) return;
    const item = player.inventory[index];
    
    if (!item || !Number.isSafeInteger(item.quantity) || item.quantity < 1) return;
    
    const itemData = getItem(item.id);
    if (!itemData) return;
    
    switch (itemData.type) {
        case 'consumable':
            if (!useConsumable(player, item, itemData, index)) return;
            break;
        case 'weapon':
        case 'armor': {
            const result = equipInventoryItem(player, index);
            if (!result.ok) {
                if (result.reason === 'level_required') window.showNotification(`Требуется ${result.requiredLevel} уровень!`, 'error');
                else if (result.reason === 'already_equipped') window.showNotification('Предмет уже экипирован', 'info');
                else window.showNotification('Не удалось экипировать предмет', 'error');
                return;
            }
            window.showNotification(`${itemData.name} экипирован!`, 'success');
            break;
        }
        default:
            return;
    }
    
    gameState.save();
    updateInventoryScreen();
    window.updateCharacterScreen?.();
    window.updateMainMenu?.();
}

function useConsumable(player, item, itemData, index) {
    const needsHealth = itemData.heal > 0 && player.health < player.maxHealth;
    const needsMana = itemData.manaHeal > 0 && player.mana < player.maxMana;
    if (!needsHealth && !needsMana) {
        window.showNotification('Сейчас это зелье не требуется', 'info');
        return false;
    }
    if (itemData.heal) {
        player.health = Math.min(player.maxHealth, player.health + itemData.heal);
        window.showNotification(`Вы использовали ${itemData.name}! +${itemData.heal} HP`, 'success');
    }
    
    if (itemData.manaHeal) {
        player.mana = Math.min(player.maxMana, player.mana + itemData.manaHeal);
        window.showNotification(`Вы использовали ${itemData.name}! +${itemData.manaHeal} MP`, 'success');
    }
    
    item.quantity--;
    if (item.quantity <= 0) {
        player.inventory.splice(index, 1);
    }
    return true;
}

export function unequipItem(slot) {
    const player = gameState.player;
    if (!player) return;
    const result = unequipEquipmentItem(player, slot);
    if (!result.ok) {
        window.showNotification(result.reason === 'empty_slot' ? 'Слот пуст' : 'Недопустимый слот', 'info');
        return;
    }
    const itemData = getItem(result.itemId);
    window.showNotification(`${itemData?.name || 'Предмет'} снят`, 'info');
    gameState.save();
    updateInventoryScreen();
    window.updateCharacterScreen?.();
    window.updateMainMenu?.();
}
