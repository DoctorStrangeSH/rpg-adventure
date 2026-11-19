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
    }
};

export function getItem(itemId) {
    return Object.hasOwn(ITEMS, itemId) ? ITEMS[itemId] : undefined;
}

export function getItemsByType(type) {
    return Object.values(ITEMS).filter(item => item.type === type);
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
