// Квесты
export const QUESTS = [
    {
        id: 'first_blood',
        name: '🩸 Первая кровь',
        description: 'Убейте 1 монстра',
        type: 'kill',
        target: 1,
        rewardExp: 50,
        rewardGold: 100,
        rewardItems: [
            { id: 'health_potion', quantity: 2 }
        ]
    },
    {
        id: 'monster_hunter',
        name: '👹 Охотник на монстров',
        description: 'Убейте 5 монстров',
        type: 'kill',
        target: 5,
        rewardExp: 200,
        rewardGold: 300,
        rewardItems: [
            { id: 'health_potion', quantity: 3 },
            { id: 'mana_potion', quantity: 2 }
        ]
    },
    {
        id: 'monster_slayer',
        name: '⚔️ Истребитель монстров',
        description: 'Убейте 10 монстров',
        type: 'kill',
        target: 10,
        rewardExp: 500,
        rewardGold: 500,
        rewardItems: [
            { id: 'iron_sword', quantity: 1 }
        ]
    },
    {
        id: 'battle_veteran',
        name: '🎖️ Ветеран сражений',
        description: 'Выиграйте 3 сражения',
        type: 'win',
        target: 3,
        rewardExp: 150,
        rewardGold: 200,
        rewardItems: []
    },
    {
        id: 'wealthy',
        name: '💰 Богач',
        description: 'Накопите 500 золота',
        type: 'gold',
        target: 500,
        rewardExp: 300,
        rewardGold: 400,
        rewardItems: []
    },
    {
        id: 'level_5',
        name: '⭐ Растущий герой',
        description: 'Достигните 5 уровня',
        type: 'level',
        target: 5,
        rewardExp: 400,
        rewardGold: 500,
        rewardItems: [
            { id: 'leather_armor', quantity: 1 }
        ]
    }
];

export function getQuest(questId) {
    return QUESTS.find(q => q.id === questId);
}