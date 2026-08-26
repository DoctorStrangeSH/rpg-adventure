// Экран магазина
import { gameState } from '../core/state.js';
import { ITEMS, getItemsByType, getItem } from '../data/items.js';

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
    
    if (!itemData) return;
    
    if (player.gold < itemData.price) {
        window.showNotification('Недостаточно золота!', 'error');
        return;
    }
    
    player.gold -= itemData.price;
    
    const existingItem = player.inventory.find(item => item.id === itemId);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        player.inventory.push({
            id: itemId,
            quantity: 1
        });
    }
    
    window.showNotification(`Вы купили ${itemData.name}!`, 'success');
    
    gameState.save();
    updateShopScreen();
    window.updateInventoryScreen?.();
    window.updateMainMenu?.();
}