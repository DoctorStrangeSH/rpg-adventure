// Экран инвентаря
import { gameState } from '../core/state.js';
import { getItem, getItemAbilityDescription, getItemLore, getEquipmentComparison, RARITIES } from '../data/items.js';
import { getEquipmentSetBonuses } from '../systems/combat.js';
import { equipInventoryItem, unequipEquipmentItem } from '../systems/equipment.js';
import { getBossTrophyCatalog, getCollectionProgress } from '../systems/loot.js';
import { CRAFTING_RECIPES, getCraftingAvailability, craftItem } from '../systems/crafting.js';
import { salvageEquipment, getSalvagePreview } from '../systems/salvage.js';
import { getItemUpgradeLevel, getUpgradePreview, upgradeEquipment } from '../systems/upgrades.js';
import { getUpgradeVisualProfile } from '../systems/upgradeVisuals.js';
import { RUNE_CATALOG, getRuneSocketCount, getWeaponRunes, getEnchantPreview, inscribeRune, getRuneSynergy, getRuneExtractionPreview, extractRune, RUNE_EXTRACTION_GOLD } from '../systems/enchanting.js';

export function updateInventoryScreen() {
    const player = gameState.player;
    if (!player) return;
    
    const content = document.getElementById('inventory-content');
    
    const setBonuses = getEquipmentSetBonuses(player);
    const collection = getCollectionProgress(player.discoveredItems);
    const trophyCatalog = getBossTrophyCatalog(player.discoveredItems);
    const craftingCards = CRAFTING_RECIPES.map(recipe => {
        const availability = getCraftingAvailability(player, recipe);
        const output = getItem(recipe.output);
        const ingredients = Object.entries(recipe.materials).map(([id, qty]) => `${getItem(id)?.icon || '◆'} ${getItem(id)?.name || id} ×${qty}`).join(' · ');
        return `<div class="crafting-recipe"><div class="crafting-recipe-head"><strong>${output?.icon || '⚒️'} ${recipe.name}</strong><span>${recipe.gold} золота</span></div><small>${ingredients}</small><small>Уровень ${recipe.requiredLevel}${recipe.requiresDiscovery ? ' · Требуется особый материал' : ''}</small><button class="craft-button" ${availability.available ? '' : 'disabled'} onclick="window.craftInventoryItem('${recipe.id}')">${availability.available ? '⚒️ Создать' : availability.reason === 'level' ? `Нужен ${recipe.requiredLevel} уровень` : availability.reason === 'discovery' ? 'Нужен редкий материал' : availability.reason === 'gold' ? `Не хватает ${availability.missing} золота` : 'Не хватает материалов'}</button></div>`;
    }).join('');
    const setSummary = setBonuses.progress.map(set => {
        const status = set.complete ? 'Комплект собран' : set.equippedPieces > 0
            ? `Собрано: ${set.equippedPieces}/${set.requiredPieces}` : 'Пока не найдено';
        return `<div class="set-progress ${set.complete ? 'set-complete' : ''}">
            <div class="set-progress-heading"><strong>${set.name}</strong><span>${status}</span></div>
            <div class="set-progress-track"><span style="width:${set.equippedPieces / set.requiredPieces * 100}%"></span></div>
            <small>${set.description}</small>
        </div>`;
    }).join('');
    content.innerHTML = `
        <div class="section-title">⚔️ Экипировка</div>
        <div class="equipment-slots">
            ${createEquipmentSlot('weapon', '⚔️', 'Оружие', player.equipment.weapon)}
            ${createEquipmentSlot('armor', '🛡️', 'Броня', player.equipment.armor)}
        </div>
        <div class="inventory-hint">Нажмите на предмет, чтобы надеть его. Нажмите на слот, чтобы снять экипировку.</div>
        <div class="upgrade-panel"><strong>✨ Заточка экипировки</strong>
        ${['weapon','armor'].map(slot => {
            const id = player.equipment?.[slot];
            if (!id) return '';
            const item = getItem(id);
            const level = getItemUpgradeLevel(player, id);
            const preview = getUpgradePreview(player, id);
            const detail = preview.reason === 'max_level' ? 'Максимальный уровень' :
                preview.available ? `Следующий уровень +${preview.next} · ${preview.gold} золота` :
                preview.reason === 'gold' ? 'Не хватает золота' :
                preview.reason === 'materials' ? `Не хватает: ${preview.missing.map(x => `${getItem(x.id)?.name || x.id} ×${x.missing}`).join(', ')}` : '';
            return `<div class="upgrade-row"><div><b>${item?.icon || '⚒️'} ${item?.name || id} · +${level}</b><small>${detail}</small></div><button class="upgrade-button" ${preview.available ? '' : 'disabled'} onclick="window.upgradeInventoryItem('${id}')">${preview.available ? 'Улучшить' : 'Недоступно'}</button></div>`;
        }).join('')}
        </div>
        
        ${createRuneEnchantPanel(player)}
        <div class="section-title">✨ Комплекты</div>
        <div class="equipment-set-summary">${setSummary || 'Комплекты пока не обнаружены'}</div>
        <div class="section-title">🏆 Охота за трофеями</div>
        <div class="collection-summary"><strong>${collection.discovered}/${collection.total}</strong><span>уникальных трофеев боссов найдено</span></div>
        <div class="boss-trophy-grid">${trophyCatalog.map(entry => { const item = getItem(entry.itemId); return `<div class="boss-trophy ${entry.discovered ? 'trophy-found' : 'trophy-unknown'}"><div class="boss-trophy-icon">${entry.discovered ? item?.icon || '🏆' : '❔'}</div><div class="boss-trophy-info"><strong>${entry.discovered ? item?.name : 'Неизвестный трофей'}</strong><small>${entry.bossName} · ${entry.region}</small></div><span>${entry.discovered ? 'Найдено' : 'Не найдено'}</span></div>`; }).join('')}</div>
        <div class="section-title">⚒️ Кузница</div><div class="crafting-grid">${craftingCards}</div>\n        <div class="section-title">🎒 Предметы</div>
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
    
    const rarity = itemData ? RARITIES[itemData.rarity] || RARITIES.common : null;
    const upgradeProfile = itemId ? getUpgradeVisualProfile(itemId, getItemUpgradeLevel(gameState.player, itemId)) : null;
    const stat = itemData?.attackBonus ? `⚔️ +${itemData.attackBonus} атаки`
        : itemData?.defenseBonus ? `🛡️ +${itemData.defenseBonus} защиты` : '';
    return `
        <div class="equipment-slot ${itemData ? 'slot-filled' : 'slot-empty'} ${upgradeProfile?.className || ''}" style="${rarity ? `--item-rarity:${rarity.color}` : ''}" onclick="window.unequipItem('${slot}')">
            <div class="slot-icon">${icon}</div>
            <div class="slot-name">${name}</div>
            <div class="slot-item">
                ${itemData ? itemData.icon + ' ' + itemData.name : 'Пусто'}
            </div>
            ${stat ? `<div class="slot-stat">${stat}</div>` : ''}
            ${rarity ? `<div class="slot-rarity" style="color:${rarity.color}">${rarity.name}${upgradeLevel ? ' · +' + upgradeLevel : ''}</div>` : '<div class="slot-rarity">Можно экипировать</div>'}
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
    const comparison = getEquipmentComparison(itemData, currentItem);
    const levelLocked = (itemData.requiredLevel || 1) > player.level;
    
    const rarity = RARITIES[itemData.rarity] || RARITIES.common;
    const upgradeLevel = ['weapon', 'armor'].includes(itemData.type) ? getItemUpgradeLevel(player, item.id) : 0;
    const upgradeProfile = getUpgradeVisualProfile(item.id, upgradeLevel);
    const itemTypeLabel = itemData.type === 'weapon' ? 'ОРУЖИЕ'
        : itemData.type === 'armor' ? 'БРОНЯ' : 'РАСХОДНИК';
    return `
        <div class="inventory-item ${isEquipped ? 'equipped' : ''} rarity-${itemData.rarity || 'common'} ${upgradeProfile.className}" style="--item-rarity:${rarity.color}" onclick="window.useInventoryItem(${index})">
            <div class="item-type-label">${itemTypeLabel}</div>
            <div class="item-icon">${itemData.icon}</div>
            <div class="item-name">${itemData.name}</div>
            <div class="item-rarity" style="color:${rarity.color}">${rarity.name}</div>
            ${getItemAbilityDescription(itemData) ? `<div class="item-stats">${getItemAbilityDescription(itemData)}</div>` : ''}
            ${getItemLore(itemData) ? `<div class="item-lore"><span>${getItemLore(itemData).origin}</span><p>${getItemLore(itemData).lore}</p></div>` : ''}
            ${comparison ? `<div class="item-comparison"><span>${comparison.statLabel}: ${comparison.currentValue} → <b>${comparison.nextValue}</b></span><strong class="comparison-delta ${comparison.delta > 0 ? 'delta-up' : comparison.delta < 0 ? 'delta-down' : 'delta-equal'}">${comparison.delta > 0 ? '+' : ''}${comparison.delta}</strong></div>` : ''}
            ${itemData.requiredLevel ? `<div class="item-stats">${levelLocked ? '🔒 ' : ''}Уровень ${itemData.requiredLevel}</div>` : ''}
            <div class="item-quantity">x${item.quantity}</div>
            ${isEquipped ? '<div class="equipped-badge">✓</div>' : ['weapon', 'armor'].includes(itemData.type) ? `<button class="salvage-button" onclick="window.salvageInventoryItem(${index}, event)">Разобрать · ${getSalvagePreview(item.id).map(r => `${r.item?.icon || '◆'} ×${r.quantity}`).join(' ')}</button>` : ''}
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

export function craftInventoryItem(recipeId) {
    const player = gameState.player;
    if (!player) return;
    const result = craftItem(player, recipeId);
    if (!result.ok) {
        window.showNotification(result.reason === 'materials' ? 'Не хватает материалов' :
            result.reason === 'gold' ? 'Недостаточно золота' :
            result.reason === 'level' ? `Требуется ${result.requiredLevel} уровень` :
            result.reason === 'discovery' ? 'Сначала найдите редкий материал' : 'Не удалось создать предмет', 'error');
        return;
    }
    gameState.save();
    window.showNotification(`Создано: ${result.item.name}`, 'success');
    updateInventoryScreen();
}
window.craftInventoryItem = craftInventoryItem;

export function salvageInventoryItem(index,event){
 event?.stopPropagation?.();const player=gameState.player;if(!player)return;
 const result=salvageEquipment(player,index);
 if(!result.ok){window.showNotification(result.reason==='equipped'?'Сначала снимите предмет':result.reason==='inventory_limit'?'Недостаточно места для материалов':'Не удалось разобрать предмет','error');return;}
 gameState.save();window.showNotification(`Разобрано: ${result.item.name}`,'success');updateInventoryScreen();
}
window.salvageInventoryItem=salvageInventoryItem;

export function upgradeInventoryItem(itemId) {
    const player = gameState.player;
    if (!player) return;
    const result = upgradeEquipment(player, itemId);
    if (!result.ok) {
        window.showNotification(result.reason === 'materials' ? 'Не хватает материалов' :
            result.reason === 'gold' ? 'Недостаточно золота' :
            result.reason === 'max_level' ? 'Достигнут максимум +10' : 'Можно улучшать только надетую экипировку', 'error');
        return;
    }
    gameState.save();
    window.showNotification(`${result.item.name} улучшен до +${result.level}!`, 'success');
    updateInventoryScreen();
    window.updateCharacterScreen?.();
    window.updateMainMenu?.();
}
window.upgradeInventoryItem = upgradeInventoryItem;

function createRuneEnchantPanel(player) {
    const weaponId = player.equipment?.weapon;
    if (!weaponId) return '<div class="enchant-panel"><strong>ᚱ Руническое зачарование</strong><small>Наденьте оружие, чтобы открыть рунические гнёзда.</small></div>';
    const slots = getRuneSocketCount(player, weaponId);
    const runes = getWeaponRunes(player, weaponId);
    const labels = runes.map(id => RUNE_CATALOG[id].icon + ' ' + RUNE_CATALOG[id].name).join(' · ');
    const installed = runes.map((id, index) => {
        const preview = getRuneExtractionPreview(player, weaponId, index);
        return '<div class="installed-rune"><span>' + RUNE_CATALOG[id].icon + ' ' + RUNE_CATALOG[id].name +
            '</span><button class="rune-extract-button" ' + (preview.available ? '' : 'disabled') +
            ' onclick="window.extractInventoryRune(\\'' + weaponId + '\\',' + index + ')">Извлечь · ' +
            RUNE_EXTRACTION_GOLD + ' золота</button></div>';
    }).join('');
    const synergy = getRuneSynergy(player, weaponId);
    const cards = Object.values(RUNE_CATALOG).map(rune => {
        const preview = getEnchantPreview(player, weaponId, rune.id);
        let label = 'Вставить';
        if (preview.reason === 'upgrade_required') label = 'Требуется +1';
        else if (preview.reason === 'sockets_full') label = 'Гнёзда заняты';
        else if (preview.reason === 'duplicate') label = 'Уже установлена';
        else if (preview.reason === 'materials') label = 'Не хватает материалов';
        const cost = Object.entries(rune.cost).map(([id, qty]) => (getItem(id)?.icon || '◆') + ' ×' + qty).join(' ');
        const stats = (rune.attack ? '+' + rune.attack + ' атаки ' : '') +
            (rune.defense ? '+' + rune.defense + ' защиты ' : '') +
            (rune.critChance ? '+' + Math.round(rune.critChance * 100) + '% крит. шанса ' : '') +
            (rune.effect ? '· эффект при попадании' : '');
        return '<div class="rune-card" style="--rune-color:' + rune.color + '"><b>' + rune.icon + ' ' + rune.name +
            '</b><small>' + cost + '</small><small>' + stats + '</small><button class="rune-button" ' +
            (preview.available ? '' : 'disabled') + ' onclick="window.inscribeInventoryRune(\'' + weaponId + '\',\'' + rune.id + '\')">' +
            label + '</button></div>';
    }).join('');
    return '<div class="enchant-panel"><strong>ᚱ Руническое зачарование</strong><small>Гнёзда: ' +
        runes.length + '/' + slots + ' · ' + (labels || 'Пока пусто') + '</small>' + (installed ? '<div class="installed-runes">' + installed + '</div>' : '') + (synergy ? '<div class="rune-synergy"><b>' + synergy.icon + ' Синергия: ' + synergy.name + '</b><small>' + synergy.description + '</small></div>' : '') + '<div class="rune-grid">' + cards + '</div></div>';
}
export function inscribeInventoryRune(weaponId, runeId) {
    const player = gameState.player;
    if (!player) return;
    const result = inscribeRune(player, weaponId, runeId);
    if (!result.ok) {
        const message = result.reason === 'upgrade_required' ? 'Сначала улучшите оружие до +1' :
            result.reason === 'sockets_full' ? 'Нет свободных рунических гнёзд' :
            result.reason === 'duplicate' ? 'Эта руна уже установлена' : 'Не хватает материалов';
        window.showNotification(message, 'error');
        return;
    }
    gameState.save();
    window.showNotification('Установлена руна: ' + result.rune.name, 'success');
    updateInventoryScreen();
}
window.inscribeInventoryRune = inscribeInventoryRune;
export function extractInventoryRune(weaponId, index) {
    const player = gameState.player;
    if (!player) return;
    const result = extractRune(player, weaponId, index);
    if (!result.ok) {
        window.showNotification(result.reason === 'gold' ? 'Для извлечения нужно 50 золота' : 'Невозможно извлечь эту руну', 'error');
        return;
    }
    gameState.save();
    window.showNotification('Извлечена руна: ' + result.rune.name, 'success');
    updateInventoryScreen();
}
window.extractInventoryRune = extractInventoryRune;
