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
    const canAfford = Number.isSafeInteger(player.gold) && player.gold >= item.price;
    const requiredLevel = item.requiredLevel || 1;
    const levelLocked = player.level < requiredLevel;
    
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
                ${item.onHit ? `<br>${{ burn: '🔥 Поджог', bleed: '🩸 Кровотечение', freeze: '❄️ Заморозка' }[item.onHit.type]}: ${Math.round(item.onHit.chance * 100)}%` : ''}
            </div>
            <div class="item-price">💰 ${item.price}</div>
            ${requiredLevel > 1 ? `<div class="item-stats">${player.level < requiredLevel ? '🔒 ' : ''}Экипировка с ${requiredLevel} уровня</div>` : ''}
            <button class="shop-btn" 
                    onclick="window.buyItem('${item.id}')"
                    ${!canAfford || levelLocked ? 'disabled' : ''}>
                ${levelLocked ? `Доступно с ${requiredLevel} уровня` : canAfford ? 'Купить' : 'Недостаточно золота'}
            </button>
        </div>
    `;
}

export function buyItem(itemId) {
    const player = gameState.player;
    const itemData = getItem(itemId);
    
    if (!player || !itemData || !Number.isSafeInteger(itemData.price) || itemData.price < 0 ||
        !Number.isSafeInteger(player.gold) || player.gold < 0) return;

    const requiredLevel = itemData.requiredLevel || 1;
    if (!Number.isSafeInteger(player.level) || player.level < requiredLevel) {
        window.showNotification?.(`Предмет доступен с ${requiredLevel} уровня!`, 'error');
        return;
    }

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
