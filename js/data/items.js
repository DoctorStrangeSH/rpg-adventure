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
        requiredLevel: 4, price: 450
    },
    moonblade: {
        id: 'moonblade', name: 'Лунный клинок', icon: '🌙',
        type: 'weapon', rarity: 'epic', attackBonus: 28,
        requiredLevel: 6, price: 750
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
