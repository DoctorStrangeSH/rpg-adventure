// Подземелья
export const DUNGEONS = [
    {
        id: 'cave',
        name: '🕳️ Пещера новичка',
        description: 'Тёмная пещера с летучими мышами',
        minLevel: 1,
        floors: [
            {
                floor: 1,
                enemies: ['wolf', 'goblin'],
                enemiesCount: 3,
                boss: null
            },
            {
                floor: 2,
                enemies: ['goblin', 'skeleton'],
                enemiesCount: 4,
                boss: {
                    id: 'goblin_king',
                    name: '👹 Король гоблинов',
                    icon: '👹',
                    health: 100,
                    attack: 15,
                    defense: 8,
                    expReward: 100,
                    goldReward: 150
                }
            }
        ],
        rewards: {
            exp: 200,
            gold: 300,
            items: [
                { id: 'health_potion', quantity: 3 },
                { id: 'iron_sword', quantity: 1 }
            ]
        }
    },
    {
        id: 'castle',
        name: '🏚️ Заброшенный замок',
        description: 'Руины древнего замка с нежитью',
        minLevel: 3,
        floors: [
            {
                floor: 1,
                enemies: ['skeleton', 'goblin'],
                enemiesCount: 4,
                boss: null
            },
            {
                floor: 2,
                enemies: ['skeleton', 'goblin'],
                enemiesCount: 5,
                boss: {
                    id: 'death_knight',
                    name: '💀 Рыцарь смерти',
                    icon: '💀',
                    health: 200,
                    attack: 25,
                    defense: 12,
                    expReward: 200,
                    goldReward: 300
                }
            }
        ],
        rewards: {
            exp: 400,
            gold: 600,
            items: [
                { id: 'health_potion', quantity: 5 },
                { id: 'leather_armor', quantity: 1 }
            ]
        }
    },
    {
        id: 'dragon_lair',
        name: '🐉 Логово дракона',
        description: 'Опасное логово древнего дракона',
        minLevel: 5,
        floors: [
            {
                floor: 1,
                enemies: ['skeleton', 'dragon'],
                enemiesCount: 5,
                boss: null
            },
            {
                floor: 2,
                enemies: ['dragon', 'skeleton'],
                enemiesCount: 6,
                boss: {
                    id: 'ancient_dragon',
                    name: '🐉 Древний дракон',
                    icon: '🐉',
                    health: 500,
                    attack: 40,
                    defense: 20,
                    expReward: 500,
                    goldReward: 800
                }
            }
        ],
        rewards: {
            exp: 800,
            gold: 1200,
            items: [
                { id: 'health_potion', quantity: 10 },
                { id: 'iron_sword', quantity: 1 },
                { id: 'leather_armor', quantity: 1 }
            ]
        }
    }
];

export function getDungeon(dungeonId) {
    return DUNGEONS.find(d => d.id === dungeonId);
}