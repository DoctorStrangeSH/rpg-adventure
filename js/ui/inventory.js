// Экран инвентаря
import { gameState } from '../core/state.js';
import { getItem, RARITIES } from '../data/items.js';

export function updateInventoryScreen() {
    const player = gameState.player;
    if (!player) return;
    
    const content = document.getElementById('inventory-content');
    
    content.innerHTML = `
        <div class="section-title">⚔️ Экипировка</div>
        <div class="equipment-slots">
            ${createEquipmentSlot('weapon', '⚔️', 'Оружие', player.equipment.weapon)}
            ${createEquipmentSlot('armor', '🛡️', 'Броня', player.equipment.armor)}
        </div>
        
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
            if (!equipItem(player, item, 'weapon')) return;
            break;
        case 'armor':
            if (!equipItem(player, item, 'armor')) return;
            break;
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

function equipItem(player, item, slot) {
    const itemData = getItem(item.id);
    if ((itemData.requiredLevel || 1) > player.level) {
        window.showNotification(`Требуется ${itemData.requiredLevel} уровень!`, 'error');
        return false;
    }
    if (player.equipment[slot] === item.id) {
        window.showNotification('Предмет уже экипирован', 'info');
        return false;
    }
    
    // Снимаем старый предмет
    if (player.equipment[slot]) {
        const oldItemData = getItem(player.equipment[slot]);
        
        if (oldItemData?.attackBonus) {
            player.attack -= oldItemData.attackBonus;
        }
        if (oldItemData?.defenseBonus) {
            player.defense -= oldItemData.defenseBonus;
        }
    }
    
    // Надеваем новый
    player.equipment[slot] = item.id;
    
    if (itemData.attackBonus) {
        player.attack += itemData.attackBonus;
    }
    if (itemData.defenseBonus) {
        player.defense += itemData.defenseBonus;
    }
    
    window.showNotification(`${itemData.name} экипирован!`, 'success');
    return true;
}

export function unequipItem(slot) {
    const player = gameState.player;
    if (!player || !['weapon', 'armor'].includes(slot)) return;
    
    if (!player.equipment[slot]) {
        window.showNotification('Слот пуст', 'info');
        return;
    }
    
    const itemData = getItem(player.equipment[slot]);
    
    if (itemData?.attackBonus) {
        player.attack -= itemData.attackBonus;
    }
    if (itemData?.defenseBonus) {
        player.defense -= itemData.defenseBonus;
    }
    
    player.equipment[slot] = null;
    
    window.showNotification(`${itemData?.name || 'Предмет'} снят`, 'info');
    gameState.save();
    updateInventoryScreen();
    window.updateCharacterScreen?.();
    window.updateMainMenu?.();
}
