// Враги
export const ENEMIES = [
    {
        id: 'wolf',
        name: 'Волк',
        icon: '🐺',
        behavior: 'aggressive',
        damageModifiers: { fire: 1.25, ice: 0.8 },
        health: 30,
        attack: 8,
        defense: 2,
        expReward: 20,
        goldReward: 15
    },
    {
        id: 'goblin',
        name: 'Гоблин',
        icon: '👹',
        behavior: 'opportunist',
        damageModifiers: { ice: 1.2 },
        health: 50,
        attack: 12,
        defense: 4,
        expReward: 35,
        goldReward: 30
    },
    {
        id: 'skeleton',
        name: 'Скелет',
        icon: '💀',
        behavior: 'resilient',
        resistances: { bleed: 1, poison: 0.5 },
        damageModifiers: { physical: 0.85, fire: 1.4, poison: 0.5 },
        health: 70,
        attack: 15,
        defense: 6,
        expReward: 50,
        goldReward: 45
    },
    {
        id: 'dragon',
        name: 'Дракон',
        icon: '🐉',
        behavior: 'boss',
        resistances: { freeze: 1, burn: 0.5, poison: 0.5 },
        damageModifiers: { fire: 0.5, ice: 1.25, poison: 0.5 },
        health: 200,
        attack: 35,
        defense: 15,
        expReward: 200,
        goldReward: 200
    }
];

export function getEnemy(enemyId) {
    return ENEMIES.find(e => e.id === enemyId);
}

export function getRandomEnemy(enemyIds) {
    const randomId = enemyIds[Math.floor(Math.random() * enemyIds.length)];
    return getEnemy(randomId);
}
