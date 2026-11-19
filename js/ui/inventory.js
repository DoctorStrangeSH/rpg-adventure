// Экран инвентаря
import { gameState } from '../core/state.js';
import { getItem, getItemAbilityDescription, getItemLore, getEquipmentComparison, RARITIES } from '../data/items.js';
import { getEquipmentSetBonuses, getEffectiveCombatStats } from '../systems/combat.js';
import { equipInventoryItem, unequipEquipmentItem } from '../systems/equipment.js';
import { getBossTrophyCatalog, getCollectionProgress } from '../systems/loot.js';
import { CRAFTING_RECIPES, getCraftingAvailability, craftItem } from '../systems/crafting.js';
import { salvageEquipment, getSalvagePreview } from '../systems/salvage.js';
import { getItemUpgradeLevel, getUpgradePreview, upgradeEquipment } from '../systems/upgrades.js';
import { getUpgradeVisualProfile } from '../systems/upgradeVisuals.js';
import { RUNE_CATALOG, getRuneSocketCount, getWeaponRunes, getEnchantPreview, inscribeRune, getRuneSynergy, getRuneExtractionPreview, extractRune, RUNE_EXTRACTION_GOLD, getRuneLoadoutPreview } from '../systems/enchanting.js';

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
    const upgradeLevel = itemData ? getItemUpgradeLevel(gameState.player, itemId) : 0;
    const upgradeProfile = itemId ? getUpgradeVisualProfile(itemId, upgradeLevel) : null;
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

export function salvageInventoryItem(index,event){
 event?.stopPropagation?.();const player=gameState.player;if(!player)return;
 const result=salvageEquipment(player,index);
 if(!result.ok){window.showNotification(result.reason==='equipped'?'Сначала снимите предмет':result.reason==='inventory_limit'?'Недостаточно места для материалов':'Не удалось разобрать предмет','error');return;}
 gameState.save();window.showNotification(`Разобрано: ${result.item.name}`,'success');updateInventoryScreen();
}

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

function createRuneEnchantPanel(player) {
    const weaponId = player.equipment?.weapon;
    if (!weaponId) return '<section class="forge-panel"><header class="forge-heading"><span>⚒️</span><div><strong>Кузница рун</strong><small>Наденьте оружие, чтобы начать зачарование</small></div></header></section>';
    const weapon = getItem(weaponId);
    const slots = getRuneSocketCount(player, weaponId);
    const runes = getWeaponRunes(player, weaponId);
    const synergy = getRuneSynergy(player, weaponId);
    const stats = getEffectiveCombatStats(player);
    const sockets = Array.from({length:3}, (_,index) => {
        const runeId = runes[index];
        const rune = runeId ? RUNE_CATALOG[runeId] : null;
        const locked = index >= slots;
        return '<div class="forge-socket ' + (rune ? 'socket-filled' : locked ? 'socket-locked' : 'socket-empty') +
            '" style="' + (rune ? '--rune-color:' + rune.color : '') + '"><span>' + (rune ? rune.icon : locked ? '🔒' : '◇') +
            '</span><small>' + (rune ? rune.name : locked ? 'Заточка +' + [1,4,8][index] : 'Свободно') + '</small></div>';
    }).join('');
    const installed = runes.map((id,index) => {
        const rune = RUNE_CATALOG[id];
        const preview = getRuneExtractionPreview(player,weaponId,index);
        return '<div class="forge-installed"><span style="color:' + rune.color + '">' + rune.icon + ' ' + rune.name +
            '</span><button class="rune-extract-button" ' + (preview.available ? '' : 'disabled') +
            ' onclick="window.extractInventoryRune(\'' + weaponId + '\',' + index + ')">Извлечь · 50 золота</button></div>';
    }).join('');
    const cards = Object.values(RUNE_CATALOG).map(rune => {
        const preview = getEnchantPreview(player,weaponId,rune.id);
        const projected = getRuneLoadoutPreview(player,weaponId,rune.id);
        let label = 'Вставить';
        if (preview.reason === 'upgrade_required') label = 'Нужна заточка +1';
        else if (preview.reason === 'sockets_full') label = 'Все гнёзда заняты';
        else if (preview.reason === 'duplicate') label = 'Уже установлена';
        else if (preview.reason === 'materials') label = 'Не хватает материалов';
        const cost = Object.entries(rune.cost).map(([id,qty]) => (getItem(id)?.icon || '◆') + ' ×' + qty).join(' · ');
        const changes = [
            projected.delta.attack ? (projected.delta.attack > 0 ? '+' : '') + projected.delta.attack + ' атаки' : '',
            projected.delta.defense ? (projected.delta.defense > 0 ? '+' : '') + projected.delta.defense + ' защиты' : '',
            projected.delta.critChance ? (projected.delta.critChance > 0 ? '+' : '') + (projected.delta.critChance * 100).toFixed(0) + '% крит. шанса' : ''
        ].filter(Boolean).join(' · ') || 'Без изменения характеристик';
        return '<article class="forge-rune-card" style="--rune-color:' + rune.color + '"><div class="forge-rune-title"><b>' +
            rune.icon + ' ' + rune.name + '</b>' + (rune.bossRune ? '<span>БОСС</span>' : '') +
            '</div><small>' + (rune.effect ? 'Эффект при попадании · ' + rune.turns + ' ход.' : 'Пассивный эффект') +
            '</small><small>Цена: ' + cost + '</small><div class="forge-preview">После установки: ' + changes + '</div><button class="rune-button" ' +
            (preview.available ? '' : 'disabled') + ' onclick="window.inscribeInventoryRune(\'' + weaponId + '\',\'' + rune.id + '\')">' +
            label + '</button></article>';
    }).join('');
    return '<section class="forge-panel"><header class="forge-heading"><span>⚒️</span><div><strong>Кузница рун</strong><small>' +
        (weapon?.icon || '⚔️') + ' ' + (weapon?.name || weaponId) + ' · Заточка +' + (player.itemUpgrades?.[weaponId] || 0) +
        '</small></div><b>⚔️ ' + stats.attack + ' <i>🛡️ ' + stats.defense + '</i></b></header>' +
        '<div class="forge-socket-title">РУНИЧЕСКИЕ ГНЕЗДА · ' + runes.length + '/' + slots + '</div><div class="forge-sockets">' +
        sockets + '</div>' + (installed ? '<div class="forge-installed-list">' + installed + '</div>' : '') +
        (synergy ? '<div class="rune-synergy"><b>' + synergy.icon + ' ' + synergy.name + '</b><small>' + synergy.description + '</small></div>' : '') +
        '<div class="forge-rune-heading">ДОСТУПНЫЕ РУНЫ</div><div class="rune-grid">' + cards + '</div></section>';
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

// Expose UI actions only in a browser; keeping module imports safe enables
// Node-based rule tests without requiring a fake window at module evaluation.
if (typeof window !== 'undefined') {
    window.craftInventoryItem = craftInventoryItem;
    window.salvageInventoryItem = salvageInventoryItem;
    window.upgradeInventoryItem = upgradeInventoryItem;
    window.inscribeInventoryRune = inscribeInventoryRune;
    window.extractInventoryRune = extractInventoryRune;
}
