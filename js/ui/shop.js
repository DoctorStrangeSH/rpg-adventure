// Экран магазина
import { gameState } from '../core/state.js';
import { getItemsByType, getItem, RARITIES } from '../data/items.js';
import { grantItem } from '../systems/loot.js';

export function updateShopScreen() {
    const player = gameState.player;
    if (!player) return;
    
    const content = document.getElementById('shop-content');
    
    content.innerHTML = `
        <div class="gold-info">
            <span>💰 Ваше золото: ${player.gold}</span>
        </div>
        
        ${createShopSection('⚔️ Оружие', 'weapon', player)}
        ${createShopSection('🛡️ Броня', 'armor', player)}
        ${createShopSection('🧪 Зелья', 'consumable', player)}
    `;
}

function createShopSection(title, type, player) {
    const items = getItemsByType(type);
    
    return `
        <div class="section-title">${title}</div>
        <div class="shop-grid">
            ${items.map(item => createShopItem(item, player)).join('')}
        </div>
    `;
}

function createShopItem(item, player) {
    const canAfford = player.gold >= item.price;
    
    return `
        <div class="shop-item">
            <div class="item-icon">${item.icon}</div>
            <div class="item-name">${item.name}</div>
            <div class="item-rarity" style="color:${RARITIES[item.rarity]?.color || RARITIES.common.color}">${RARITIES[item.rarity]?.name || RARITIES.common.name}</div>
            <div class="item-stats">
                ${item.attackBonus ? `⚔️ +${item.attackBonus} атаки` : ''}
                ${item.defenseBonus ? `🛡️ +${item.defenseBonus} защиты` : ''}
                ${item.heal ? `❤️ +${item.heal} HP` : ''}
                ${item.manaHeal ? `💙 +${item.manaHeal} MP` : ''}
            </div>
            <div class="item-price">💰 ${item.price}</div>
            <button class="shop-btn" 
                    onclick="window.buyItem('${item.id}')"
                    ${!canAfford ? 'disabled' : ''}>
                ${canAfford ? 'Купить' : 'Недостаточно золота'}
            </button>
        </div>
    `;
}

export function buyItem(itemId) {
    const player = gameState.player;
    const itemData = getItem(itemId);
    
    if (!player || !itemData || !Number.isSafeInteger(itemData.price) || itemData.price < 0) return;
    
    if (player.gold < itemData.price) {
        window.showNotification('Недостаточно золота!', 'error');
        return;
    }
    
    if (!grantItem(player, itemId)) {
        window.showNotification?.('Не удалось добавить предмет в инвентарь', 'error');
        return;
    }
    player.gold -= itemData.price;
    
    window.showNotification(`Вы купили ${itemData.name}!`, 'success');
    
    gameState.save();
    updateShopScreen();
    window.updateInventoryScreen?.();
    window.updateMainMenu?.();
}
