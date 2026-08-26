// Враги
export const ENEMIES = [
    {
        id: 'wolf',
        name: 'Волк',
        icon: '🐺',
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