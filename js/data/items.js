import { createContentRegistry } from '../core/contentRegistry.js';

// Предметы
export const ITEMS = {
    health_potion: {
        id: 'health_potion',
        name: 'Зелье здоровья',
        icon: '❤️',
        type: 'consumable',
        rarity: 'common',
        heal: 50,
        price: 30
    },
    mana_potion: {
        id: 'mana_potion',
        name: 'Зелье маны',
        icon: '💙',
        type: 'consumable',
        rarity: 'common',
        manaHeal: 30,
        price: 25
    },
    big_health_potion: {
        id: 'big_health_potion',
        name: 'Большое зелье здоровья',
        icon: '💖',
        type: 'consumable',
        rarity: 'uncommon',
        heal: 100,
        price: 60
    },
    iron_sword: {
        id: 'iron_sword',
        name: 'Железный меч',
        icon: '⚔️',
        type: 'weapon',
        rarity: 'uncommon',
        attackBonus: 15,
        requiredLevel: 2,
        price: 200
    },
    dragon_sword: {
        id: 'dragon_sword',
        name: 'Драконий меч',
        icon: '🐉',
        type: 'weapon',
        rarity: 'legendary',
        attackBonus: 40,
        onCrit: { type: 'echo', fraction: 0.25, maxTargetHealthFraction: 0.08 },
        lore: 'Выкован из чешуи последнего дракона, павшего над Чёрным шпилем. Клинок долго хранили без ножен: говорили, что в темноте он помнит огонь своего создателя.',
        origin: 'Чёрный шпиль · Эпоха Пепельных королей',
        requiredLevel: 8,
        price: 1000
    },
    leather_armor: {
        id: 'leather_armor',
        name: 'Кожаная броня',
        icon: '🛡️',
        type: 'armor',
        rarity: 'common',
        defenseBonus: 8,
        price: 80
    },
    guardian_armor: {
        id: 'guardian_armor', name: 'Доспех стража', icon: '🛡️',
        type: 'armor', rarity: 'rare', defenseBonus: 17,
        requiredLevel: 4, price: 450, setId: 'emberguard'
    },
    frost_armor: { id: 'frost_armor', name: 'Кираса ледяного дозора', icon: '🧊', type: 'armor', rarity: 'epic', defenseBonus: 19, requiredLevel: 6, price: 820, setId: 'frostwarden', onDamaged: { type: 'freeze', chance: 0.15, turns: 1 } },
    blood_armor: { id: 'blood_armor', name: 'Кожаный панцирь охотника', icon: '🩸', type: 'armor', rarity: 'rare', defenseBonus: 13, requiredLevel: 3, price: 390, setId: 'bloodhunter', onDamaged: { type: 'heal', chance: 0.25, fraction: 0.2, maxHealthFraction: 0.1 } },
    moonblade: {
        id: 'moonblade', name: 'Лунный клинок', icon: '🌙',
        type: 'weapon', rarity: 'epic', attackBonus: 28,
        requiredLevel: 6, price: 750,
        onCrit: { type: 'mana_restore', amount: 8 },
        lore: 'Лунная сталь была закалена в чаше ночного источника. Клинок не любит грубую силу — он возвращает магу часть энергии за точный, решающий удар.',
        origin: 'Святилище Безмолвной Луны'
    },
    ember_sword: {
        id: 'ember_sword', name: 'Клинок тлеющих углей', icon: '🔥',
        type: 'weapon', rarity: 'rare', attackBonus: 20,
        requiredLevel: 4, price: 480, setId: 'emberguard', damageType: 'fire',
        onHit: { type: 'burn', chance: 0.3, turns: 2 }
    },
    frost_blade: {
        id: 'frost_blade', name: 'Клинок вечной мерзлоты', icon: '❄️',
        type: 'weapon', rarity: 'epic', attackBonus: 24,
        requiredLevel: 6, price: 780, setId: 'frostwarden', damageType: 'ice',
        onHit: { type: 'freeze', chance: 0.18, turns: 1 }
    },
    blood_dagger: {
        id: 'blood_dagger', name: 'Кровавый кинжал', icon: '🩸',
        type: 'weapon', rarity: 'uncommon', attackBonus: 12,
        requiredLevel: 3, price: 320, setId: 'bloodhunter',
        onHit: { type: 'bleed', chance: 0.35, turns: 2 }
    },
    iron_ore: { id: 'iron_ore', name: 'Железная руда', icon: '⛏️', type: 'material', rarity: 'common', price: 8 },
    ember_core: { id: 'ember_core', name: 'Угольное ядро', icon: '🔥', type: 'material', rarity: 'rare', price: 45 },
    frost_crystal: { id: 'frost_crystal', name: 'Кристалл стужи', icon: '❄️', type: 'material', rarity: 'rare', price: 50 },
    blood_essence: { id: 'blood_essence', name: 'Кровавая эссенция', icon: '🩸', type: 'material', rarity: 'rare', price: 55 },
    dragon_scale: { id: 'dragon_scale', name: 'Чешуя дракона', icon: '🐉', type: 'material', rarity: 'epic', price: 120 },
    rune_verdant_heart: { id: 'rune_verdant_heart', name: 'Сердце древнего леса', icon: '🌿', type: 'material', rarity: 'legendary', price: 260 },
    rune_dragon_heart: { id: 'rune_dragon_heart', name: 'Сердце горного дракона', icon: '🐉', type: 'material', rarity: 'legendary', price: 320 },
    rune_lich_soul: { id: 'rune_lich_soul', name: 'Печать Короля-лича', icon: '☠️', type: 'material', rarity: 'legendary', price: 340 },
    rune_world_fragment: { id: 'rune_world_fragment', name: 'Осколок Пожирателя миров', icon: '🌑', type: 'material', rarity: 'legendary', price: 420 }

};

const ITEM_TYPES = Object.freeze(['consumable', 'weapon', 'armor', 'material']);
const ITEM_RARITIES = Object.freeze(['common', 'uncommon', 'rare', 'epic', 'legendary']);
const DAMAGE_TYPES = Object.freeze(['physical', 'fire', 'ice', 'poison']);

export function validateItemDefinition(entry) {
    if (typeof entry.name !== 'string' || !entry.name.trim()) return 'name is required';
    if (!ITEM_TYPES.includes(entry.type)) return 'unsupported item type';
    if (!ITEM_RARITIES.includes(entry.rarity)) return 'unsupported rarity';
    if (!Number.isFinite(entry.price) || entry.price < 0) return 'price must be a non-negative finite number';
    if (entry.requiredLevel !== undefined &&
        (!Number.isSafeInteger(entry.requiredLevel) || entry.requiredLevel < 1)) return 'requiredLevel must be a positive integer';
    if (entry.type === 'weapon' &&
        (!Number.isFinite(entry.attackBonus) || entry.attackBonus < 0)) return 'weapon attackBonus must be non-negative';
    if (entry.type === 'armor' &&
        (!Number.isFinite(entry.defenseBonus) || entry.defenseBonus < 0)) return 'armor defenseBonus must be non-negative';
    if (entry.type === 'consumable' &&
        ![entry.heal, entry.manaHeal].some(value => Number.isFinite(value) && value > 0)) return 'consumable must restore health or mana';
    if (entry.damageType !== undefined && !DAMAGE_TYPES.includes(entry.damageType)) return 'unsupported damageType';
    for (const effect of [entry.onHit, entry.onDamaged]) {
        if (!effect) continue;
        if (typeof effect.type !== 'string' || !Number.isFinite(effect.chance) ||
            effect.chance < 0 || effect.chance > 1) return 'effect requires a valid type and chance';
        if (effect.type === 'heal') {
            if (!Number.isFinite(effect.fraction) || effect.fraction < 0 ||
                !Number.isFinite(effect.maxHealthFraction) || effect.maxHealthFraction < 0) {
                return 'healing effect fractions must be non-negative';
            }
        } else if (!Number.isSafeInteger(effect.turns) || effect.turns < 1) {
            return 'status effect duration must be a positive integer';
        }
    }
    if (entry.onCrit?.type === 'mana_restore' &&
        (!Number.isSafeInteger(entry.onCrit.amount) || entry.onCrit.amount < 1)) return 'mana restore amount must be a positive integer';
    if (entry.onCrit?.type === 'echo' &&
        (!Number.isFinite(entry.onCrit.fraction) || entry.onCrit.fraction <= 0 ||
         !Number.isFinite(entry.onCrit.maxTargetHealthFraction) || entry.onCrit.maxTargetHealthFraction <= 0)) return 'echo fractions must be positive';
    return true;
}

export const ITEM_REGISTRY = createContentRegistry({
    kind: 'item',
    validate: validateItemDefinition
});
ITEM_REGISTRY.registerMany(Object.values(ITEMS));

export const SALVAGE_YIELDS = Object.freeze({
 common:{iron_ore:1}, uncommon:{iron_ore:2}, rare:{iron_ore:2,ember_core:1},
 epic:{iron_ore:3,ember_core:1,frost_crystal:1},
 legendary:{iron_ore:4,ember_core:2,frost_crystal:2,blood_essence:1}
});
export function getSalvagePreview(itemId) {
 const item=getItem(itemId);
 if(!item||!['weapon','armor'].includes(item.type)) return null;
 return Object.entries(SALVAGE_YIELDS[item.rarity]||SALVAGE_YIELDS.common)
  .map(([id,quantity])=>({id,quantity,item:getItem(id)}));
}
export function salvageEquipment(player,index) {
 if(!player||!Array.isArray(player.inventory)||!Number.isInteger(index)||index<0||index>=player.inventory.length)
  return {ok:false,reason:'invalid_item'};
 const entry=player.inventory[index],item=entry&&getItem(entry.id);
 if(!item||!['weapon','armor'].includes(item.type)) return {ok:false,reason:'not_equipment'};
 if(player.equipment?.weapon===item.id||player.equipment?.armor===item.id) return {ok:false,reason:'equipped'};
 if(!Number.isSafeInteger(entry.quantity)||entry.quantity<1) return {ok:false,reason:'invalid_quantity'};
 const preview=getSalvagePreview(item.id);
 for(const reward of preview){
  const current=player.inventory.filter(stack=>stack.id===reward.id)
   .reduce((sum,stack)=>sum+(Number.isSafeInteger(stack.quantity)&&stack.quantity>0?stack.quantity:0),0);
  if(current>Number.MAX_SAFE_INTEGER-reward.quantity) return {ok:false,reason:'inventory_limit'};
 }
 entry.quantity--;
 if(entry.quantity===0) player.inventory.splice(index,1);
 for(const reward of preview){
  const stack=player.inventory.find(stack=>stack.id===reward.id);
  if(stack) stack.quantity+=reward.quantity;
  else player.inventory.push({id:reward.id,quantity:reward.quantity});
 }
 return {ok:true,item,rewards:preview};
}

export function getItem(itemId) {
    return ITEM_REGISTRY.get(itemId);
}

export function getItemsByType(type) {
    return ITEM_REGISTRY.list().filter(item => item.type === type);
}

export const RARITIES = {
    common: { name: 'Обычный', color: '#cbd5e1' },
    uncommon: { name: 'Необычный', color: '#6ee7b7' },
    rare: { name: 'Редкий', color: '#93c5fd' },
    epic: { name: 'Эпический', color: '#d8b4fe' },
    legendary: { name: 'Легендарный', color: '#fbbf24' }
};

const STATUS_NAMES = { burn: '🔥 Поджог', bleed: '🩸 Кровотечение', freeze: '❄️ Заморозка' };

// Player-facing ability descriptions are derived from gameplay data, so the
// inventory does not silently drift when combat balance numbers change.
export function getItemAbilityDescription(item) {
    if (!item || typeof item !== 'object') return '';
    if (item.onCrit?.type === 'mana_restore') {
        return `🌙 Лунный прилив: критический удар восстанавливает ${item.onCrit.amount} маны (не выше максимума)`;
    }
    if (item.onCrit?.type === 'echo') {
        return `🐉 Эхо дракона: крит наносит ещё ${Math.round(item.onCrit.fraction * 100)}% урона (до ${Math.round(item.onCrit.maxTargetHealthFraction * 100)}% HP врага)`;
    }
    if (item.onDamaged?.type === 'heal') {
        return `🩸 Ответное лечение: ${Math.round(item.onDamaged.chance * 100)}% шанс вернуть ${Math.round(item.onDamaged.fraction * 100)}% урона (до ${Math.round((item.onDamaged.maxHealthFraction || 0.1) * 100)}% HP)`;
    }
    if (item.onDamaged?.type === 'freeze') {
        return `❄️ Ответная заморозка: ${Math.round(item.onDamaged.chance * 100)}% после удара по герою`;
    }
    if (item.onHit) {
        return `${STATUS_NAMES[item.onHit.type] || 'Эффект оружия'}: ${Math.round(item.onHit.chance * 100)}% за попадание`;
    }
    return '';
}

export function getItemLore(item) {
    if (!item || typeof item !== 'object') return null;
    if (!item.lore && !item.origin) return null;
    return { lore: item.lore || '', origin: item.origin || '' };
}

export function getEquipmentComparison(item, equippedItem) {
    if (!item || !['weapon', 'armor'].includes(item.type)) return null;
    const statKey = item.type === 'weapon' ? 'attackBonus' : 'defenseBonus';
    const statLabel = item.type === 'weapon' ? 'Атака' : 'Защита';
    const nextValue = Number.isFinite(item[statKey]) ? item[statKey] : 0;
    const currentValue = Number.isFinite(equippedItem?.[statKey]) ? equippedItem[statKey] : 0;
    const delta = nextValue - currentValue;
    return { statKey, statLabel, currentValue, nextValue, delta, isUpgrade: delta > 0, isDowngrade: delta < 0 };
}
