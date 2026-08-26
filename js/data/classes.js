// Классы персонажей
export const CLASSES = {
    warrior: {
        id: 'warrior',
        name: 'Воин',
        icon: '⚔️',
        description: 'Могучий боец ближнего боя',
        stats: {
            health: 150,
            mana: 30,
            attack: 15,
            defense: 10,
            speed: 8
        },
        skills: [
            {
                id: 'power_strike',
                name: 'Мощный удар',
                icon: '💥',
                description: 'Наносит 200% урона',
                manaCost: 10,
                damageMultiplier: 2.0
            },
            {
                id: 'shield_wall',
                name: 'Стена щитов',
                icon: '🛡️',
                description: 'Уменьшает урон на 75%',
                manaCost: 15,
                defenseBonus: 3
            }
        ]
    },
    mage: {
        id: 'mage',
        name: 'Маг',
        icon: '🔮',
        description: 'Могущественный заклинатель',
        stats: {
            health: 80,
            mana: 100,
            attack: 20,
            defense: 3,
            speed: 10
        },
        skills: [
            {
                id: 'fireball',
                name: 'Огненный шар',
                icon: '🔥',
                description: 'Наносит 250% урона',
                manaCost: 20,
                damageMultiplier: 2.5
            },
            {
                id: 'frost_nova',
                name: 'Ледяная нова',
                icon: '❄️',
                description: 'Замораживает врага',
                manaCost: 25,
                freeze: true
            }
        ]
    },
    archer: {
        id: 'archer',
        name: 'Лучник',
        icon: '🏹',
        description: 'Меткий стрелок',
        stats: {
            health: 100,
            mana: 60,
            attack: 12,
            defense: 5,
            speed: 15
        },
        skills: [
            {
                id: 'rapid_shot',
                name: 'Быстрый выстрел',
                icon: '🎯',
                description: 'Наносит 150% урона дважды',
                manaCost: 15,
                damageMultiplier: 1.5,
                hits: 2
            },
            {
                id: 'poison_arrow',
                name: 'Ядовитая стрела',
                icon: '☠️',
                description: 'Отравляет врага',
                manaCost: 20,
                poison: true
            }
        ]
    }
};

export function getClass(classId) {
    return CLASSES[classId];
}

export function getClassSkills(classId) {
    const classData = getClass(classId);
    return classData ? classData.skills : [];
}