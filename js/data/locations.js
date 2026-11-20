import { createContentRegistry } from '../core/contentRegistry.js';

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
                damageModifiers: { fire: 1.1, ice: 1.25 },
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
                damageModifiers: { fire: 1.25, physical: 0.9 },
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
                damageModifiers: { ice: 1.25, physical: 0.9 },
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
                damageModifiers: { fire: 0.5, ice: 1.25, poison: 0.5 },
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
                damageModifiers: { fire: 1.25, poison: 0.5 },
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
                damageModifiers: { fire: 1.2, ice: 0.85, poison: 0.5 },
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
                damageModifiers: { fire: 0.5, ice: 1.35, poison: 0.5 },
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
                damageModifiers: { fire: 0.6, ice: 1.15, poison: 0.75 },
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

// Boss scaling is normalized to each region's own length. Regional base stats
// already express the campaign's difficulty curve; stage scaling must remain
// bounded so late bosses do not become mathematically unkillable.
function getBossProgress(stageNumber, firstBossStage, totalStages) {
    const span = Math.max(1, totalStages - firstBossStage);
    return Math.max(0, Math.min(1, (stageNumber - firstBossStage) / span));
}

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
        
        // Каждый 5 этап - мини босс. Regional base stats carry the broad
        // campaign progression; local scaling adds at most 25% HP, 15% attack,
        // 10% defense and 40% reward by the last mini-boss.
        if (i % 5 === 0 && i % 10 !== 0) {
            const progress = getBossProgress(i, 5, totalStages);
            stage.boss = {
                ...bosses.miniBoss,
                miniBoss: true,
                health: Math.floor(bosses.miniBoss.health * (1 + progress * 0.25)),
                attack: Math.floor(bosses.miniBoss.attack * (1 + progress * 0.15)),
                defense: Math.floor(bosses.miniBoss.defense * (1 + progress * 0.10)),
                expReward: Math.floor(bosses.miniBoss.expReward * (1 + progress * 0.4)),
                goldReward: Math.floor(bosses.miniBoss.goldReward * (1 + progress * 0.4))
            };
        }
        
        // Каждый 10 этап - главный босс. The regional base values increase
        // between biomes; local scaling adds at most 35% HP, 20% attack,
        // 15% defense and 50% reward across the region.
        if (i % 10 === 0) {
            const progress = getBossProgress(i, 10, totalStages);
            stage.boss = {
                ...bosses.boss,
                health: Math.floor(bosses.boss.health * (1 + progress * 0.35)),
                attack: Math.floor(bosses.boss.attack * (1 + progress * 0.20)),
                defense: Math.floor(bosses.boss.defense * (1 + progress * 0.15)),
                expReward: Math.floor(bosses.boss.expReward * (1 + progress * 0.5)),
                goldReward: Math.floor(bosses.boss.goldReward * (1 + progress * 0.5))
            };
        }
        
        stages.push(stage);
    }
    
    return stages;
}

export const LOCATION_REGISTRY = createContentRegistry({
    kind: 'location',
    validate: entry => typeof entry.name === 'string' && (entry.type === 'safe' || (Array.isArray(entry.stages) && entry.stages.length > 0))
});
LOCATION_REGISTRY.registerMany(LOCATIONS);

export function getLocation(locationId) {
    return LOCATION_REGISTRY.get(locationId);
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
