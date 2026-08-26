// Экран инвентаря
import { gameState } from '../core/state.js';
import { ITEMS, getItem } from '../data/items.js';

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
    
    return `
        <div class="inventory-item ${isEquipped ? 'equipped' : ''}" onclick="window.useInventoryItem(${index})">
            <div class="item-icon">${itemData.icon}</div>
            <div class="item-name">${itemData.name}</div>
            <div class="item-quantity">x${item.quantity}</div>
            ${isEquipped ? '<div class="equipped-badge">✓</div>' : ''}
        </div>
    `;
}

export function useInventoryItem(index) {
    const player = gameState.player;
    const item = player.inventory[index];
    
    if (!item) return;
    
    const itemData = getItem(item.id);
    if (!itemData) return;
    
    switch (itemData.type) {
        case 'consumable':
            useConsumable(player, item, itemData, index);
            break;
        case 'weapon':
            equipItem(player, item, 'weapon');
            break;
        case 'armor':
            equipItem(player, item, 'armor');
            break;
    }
    
    gameState.save();
    updateInventoryScreen();
    window.updateCharacterScreen?.();
    window.updateMainMenu?.();
}

function useConsumable(player, item, itemData, index) {
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
}

function equipItem(player, item, slot) {
    const itemData = getItem(item.id);
    
    // Снимаем старый предмет
    if (player.equipment[slot]) {
        const oldItemData = getItem(player.equipment[slot]);
        
        if (oldItemData.attackBonus) {
            player.attack -= oldItemData.attackBonus;
        }
        if (oldItemData.defenseBonus) {
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
}

export function unequipItem(slot) {
    const player = gameState.player;
    
    if (!player.equipment[slot]) {
        window.showNotification('Слот пуст', 'info');
        return;
    }
    
    const itemData = getItem(player.equipment[slot]);
    
    if (itemData.attackBonus) {
        player.attack -= itemData.attackBonus;
    }
    if (itemData.defenseBonus) {
        player.defense -= itemData.defenseBonus;
    }
    
    player.equipment[slot] = null;
    
    window.showNotification(`${itemData.name} снят`, 'info');
    gameState.save();
    updateInventoryScreen();
    window.updateCharacterScreen?.();
    window.updateMainMenu?.();
}