// Локации мира
export const LOCATIONS = [
    {
        id: 'village',
        name: '🏘️ Деревня',
        description: 'Безопасное место для отдыха',
        type: 'safe',
        x: 100,
        y: 100,
        minLevel: 1,
        color: '#4caf50'
    },
    {
        id: 'forest',
        name: '🌲 Лес',
        description: 'Опасный лес с дикими зверями',
        type: 'battle',
        x: 250,
        y: 150,
        minLevel: 1,
        color: '#2e7d32',
        enemies: ['wolf', 'goblin']
    },
    {
        id: 'mountains',
        name: '🏔️ Горы',
        description: 'Высокие горы с сильными монстрами',
        type: 'battle',
        x: 350,
        y: 100,
        minLevel: 3,
        color: '#616161',
        enemies: ['goblin', 'skeleton']
    },
    {
        id: 'ruins',
        name: '🏚️ Руины',
        description: 'Древние руины, полные нежити',
        type: 'dungeon',
        x: 150,
        y: 300,
        minLevel: 5,
        color: '#795548',
        enemies: ['skeleton', 'dragon']
    },
    {
        id: 'dragon_lair',
        name: '🐉 Логово дракона',
        description: 'Опасное логово древнего дракона',
        type: 'boss',
        x: 350,
        y: 350,
        minLevel: 10,
        color: '#d32f2f',
        enemies: ['dragon']
    }
];

export function getLocation(locationId) {
    return LOCATIONS.find(l => l.id === locationId);
}