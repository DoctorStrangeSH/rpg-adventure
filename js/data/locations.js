// Локации мира с этапами
export const LOCATIONS = [
    {
        id: 'forest',
        name: '🌲 Лес',
        description: 'Опасный лес с дикими зверями',
        icon: '🌲',
        x: 150,
        y: 200,
        minLevel: 1,
        color: '#2e7d32',
        unlocked: true,
        totalStages: 30,
        stages: generateStages(30, 1, ['wolf', 'goblin'], {
            miniBoss: {
                id: 'goblin_king',
                name: '👹 Король гоблинов',
                icon: '👹',
                health: 200,
                attack: 25,
                defense: 12,
                expReward: 200,
                goldReward: 300
            },
            boss: {
                id: 'forest_guardian',
                name: '🌲 Древний хранитель леса',
                icon: '🌲',
                health: 500,
                attack: 40,
                defense: 20,
                expReward: 800,
                goldReward: 1000
            }
        }),
        rewards: {
            exp: 2000,
            gold: 3000,
            items: [
                { id: 'iron_sword', quantity: 1 },
                { id: 'health_potion', quantity: 10 }
            ]
        }
    },
    {
        id: 'mountains',
        name: '🏔️ Горы',
        description: 'Высокие горы с сильными монстрами',
        icon: '🏔️',
        x: 300,
        y: 100,
        minLevel: 5,
        color: '#616161',
        unlocked: false,
        totalStages: 40,
        stages: generateStages(40, 2, ['goblin', 'skeleton'], {
            miniBoss: {
                id: 'mountain_giant',
                name: '🏔️ Горный великан',
                icon: '🏔️',
                health: 600,
                attack: 50,
                defense: 25,
                expReward: 600,
                goldReward: 800
            },
            boss: {
                id: 'mountain_dragon',
                name: '🐉 Горный дракон',
                icon: '🐉',
                health: 1200,
                attack: 70,
                defense: 35,
                expReward: 2000,
                goldReward: 2500
            }
        }),
        rewards: {
            exp: 5000,
            gold: 8000,
            items: [
                { id: 'dragon_sword', quantity: 1 },
                { id: 'big_health_potion', quantity: 15 }
            ]
        }
    },
    {
        id: 'ruins',
        name: '🏚️ Руины',
        description: 'Древние руины, полные нежити',
        icon: '🏚️',
        x: 200,
        y: 350,
        minLevel: 10,
        color: '#795548',
        unlocked: false,
        totalStages: 50,
        stages: generateStages(50, 3, ['skeleton', 'dragon'], {
            miniBoss: {
                id: 'death_knight',
                name: '💀 Рыцарь смерти',
                icon: '💀',
                health: 1000,
                attack: 70,
                defense: 35,
                expReward: 1000,
                goldReward: 1500
            },
            boss: {
                id: 'lich_king',
                name: '👑 Король-лич',
                icon: '👑',
                health: 2000,
                attack: 100,
                defense: 50,
                expReward: 5000,
                goldReward: 6000
            }
        }),
        rewards: {
            exp: 10000,
            gold: 15000,
            items: [
                { id: 'dragon_sword', quantity: 1 },
                { id: 'big_health_potion', quantity: 20 }
            ]
        }
    },
    {
        id: 'dragon_lair',
        name: '🐉 Логово дракона',
        description: 'Опасное логово древних драконов',
        icon: '🐉',
        x: 350,
        y: 350,
        minLevel: 15,
        color: '#d32f2f',
        unlocked: false,
        totalStages: 60,
        stages: generateStages(60, 4, ['dragon', 'skeleton'], {
            miniBoss: {
                id: 'ancient_dragon',
                name: '🐉 Древний дракон',
                icon: '🐉',
                health: 1500,
                attack: 100,
                defense: 50,
                expReward: 1500,
                goldReward: 2000
            },
            boss: {
                id: 'world_eater',
                name: '💀 Пожиратель миров',
                icon: '💀',
                health: 3000,
                attack: 150,
                defense: 75,
                expReward: 10000,
                goldReward: 12000
            }
        }),
        rewards: {
            exp: 20000,
            gold: 30000,
            items: [
                { id: 'dragon_sword', quantity: 2 },
                { id: 'big_health_potion', quantity: 30 }
            ]
        }
    },
    {
        id: 'village',
        name: '🏘️ Деревня',
        description: 'Безопасное место для отдыха',
        icon: '🏘️',
        x: 100,
        y: 100,
        minLevel: 1,
        color: '#4caf50',
        type: 'safe',
        unlocked: true
    }
];

// Функция генерации этапов
function generateStages(totalStages, locationLevel, enemies, bosses) {
    const stages = [];
    
    for (let i = 1; i <= totalStages; i++) {
        const stage = {
            stage: i,
            enemies: enemies,
            enemiesCount: Math.floor(3 + i * 0.5 + locationLevel * 2),
            boss: null
        };
        
        // Каждый 5 этап - мини босс
        if (i % 5 === 0 && i % 10 !== 0) {
            stage.boss = {
                ...bosses.miniBoss,
                // Усиливаем босса в зависимости от этапа
                health: Math.floor(bosses.miniBoss.health * (1 + i * 0.3)),
                attack: Math.floor(bosses.miniBoss.attack * (1 + i * 0.2)),
                defense: Math.floor(bosses.miniBoss.defense * (1 + i * 0.2)),
                expReward: Math.floor(bosses.miniBoss.expReward * (1 + i * 0.5)),
                goldReward: Math.floor(bosses.miniBoss.goldReward * (1 + i * 0.5))
            };
        }
        
        // Каждый 10 этап - главный босс
        if (i % 10 === 0) {
            stage.boss = {
                ...bosses.boss,
                // Усиливаем босса в зависимости от этапа
                health: Math.floor(bosses.boss.health * (1 + i * 0.5)),
                attack: Math.floor(bosses.boss.attack * (1 + i * 0.3)),
                defense: Math.floor(bosses.boss.defense * (1 + i * 0.3)),
                expReward: Math.floor(bosses.boss.expReward * (1 + i * 0.7)),
                goldReward: Math.floor(bosses.boss.goldReward * (1 + i * 0.7))
            };
        }
        
        stages.push(stage);
    }
    
    return stages;
}

export function getLocation(locationId) {
    return LOCATIONS.find(l => l.id === locationId);
}

export function getStage(locationId, stageNumber) {
    const location = getLocation(locationId);
    if (!location || !location.stages) return null;
    return location.stages.find(s => s.stage === stageNumber);
}

export function getTotalStages(locationId) {
    const location = getLocation(locationId);
    if (!location || !location.stages) return 0;
    return location.stages.length;
}

export function unlockNextLocation(currentLocationId) {
    const currentIndex = LOCATIONS.findIndex(l => l.id === currentLocationId);
    
    if (currentIndex !== -1 && currentIndex < LOCATIONS.length - 1) {
        // Ищем следующую боевую локацию
        for (let i = currentIndex + 1; i < LOCATIONS.length; i++) {
            if (LOCATIONS[i].type !== 'safe') {
                LOCATIONS[i].unlocked = true;
                return LOCATIONS[i];
            }
        }
    }
    
    return null;
}