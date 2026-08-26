// Предметы
export const ITEMS = {
    health_potion: {
        id: 'health_potion',
        name: 'Зелье здоровья',
        icon: '❤️',
        type: 'consumable',
        heal: 50,
        price: 30
    },
    mana_potion: {
        id: 'mana_potion',
        name: 'Зелье маны',
        icon: '💙',
        type: 'consumable',
        manaHeal: 30,
        price: 25
    },
    iron_sword: {
        id: 'iron_sword',
        name: 'Железный меч',
        icon: '⚔️',
        type: 'weapon',
        attackBonus: 15,
        price: 200
    },
    leather_armor: {
        id: 'leather_armor',
        name: 'Кожаная броня',
        icon: '🛡️',
        type: 'armor',
        defenseBonus: 8,
        price: 80
    }
};

export function getItem(itemId) {
    return ITEMS[itemId];
}

export function getItemsByType(type) {
    return Object.values(ITEMS).filter(item => item.type === type);
}