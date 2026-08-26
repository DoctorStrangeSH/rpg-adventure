// Достижения
export const ACHIEVEMENTS = [
    {
        id: 'first_kill',
        name: '🩸 Первое убийство',
        description: 'Убейте первого монстра',
        category: 'battle',
        icon: '⚔️',
        target: 1,
        stat: 'kills',
        rewardExp: 50,
        rewardGold: 100
    },
    {
        id: 'monster_hunter',
        name: '👹 Охотник на монстров',
        description: 'Убейте 50 монстров',
        category: 'battle',
        icon: '⚔️',
        target: 50,
        stat: 'kills',
        rewardExp: 500,
        rewardGold: 1000
    },
    {
        id: 'monster_slayer',
        name: '⚔️ Истребитель монстров',
        description: 'Убейте 100 монстров',
        category: 'battle',
        icon: '⚔️',
        target: 100,
        stat: 'kills',
        rewardExp: 1000,
        rewardGold: 2000
    },
    {
        id: 'first_win',
        name: '🎯 Первая победа',
        description: 'Выиграйте первый бой',
        category: 'battle',
        icon: '🏆',
        target: 1,
        stat: 'wins',
        rewardExp: 30,
        rewardGold: 50
    },
    {
        id: 'veteran',
        name: '🎖️ Ветеран',
        description: 'Выиграйте 25 боёв',
        category: 'battle',
        icon: '🏆',
        target: 25,
        stat: 'wins',
        rewardExp: 300,
        rewardGold: 500
    },
    {
        id: 'champion',
        name: '👑 Чемпион',
        description: 'Выиграйте 50 боёв',
        category: 'battle',
        icon: '🏆',
        target: 50,
        stat: 'wins',
        rewardExp: 600,
        rewardGold: 1000
    },
    {
        id: 'level_5',
        name: '⭐ Новичок',
        description: 'Достигните 5 уровня',
        category: 'progress',
        icon: '⭐',
        target: 5,
        stat: 'level',
        rewardExp: 100,
        rewardGold: 200
    },
    {
        id: 'level_10',
        name: '🌟 Опытный',
        description: 'Достигните 10 уровня',
        category: 'progress',
        icon: '🌟',
        target: 10,
        stat: 'level',
        rewardExp: 300,
        rewardGold: 500
    },
    {
        id: 'level_20',
        name: '💫 Мастер',
        description: 'Достигните 20 уровня',
        category: 'progress',
        icon: '💫',
        target: 20,
        stat: 'level',
        rewardExp: 1000,
        rewardGold: 2000
    },
    {
        id: 'first_gold',
        name: '💰 Первое золото',
        description: 'Накопите 1000 золота',
        category: 'wealth',
        icon: '💰',
        target: 1000,
        stat: 'gold',
        rewardExp: 100,
        rewardGold: 200
    },
    {
        id: 'wealthy',
        name: '💎 Богач',
        description: 'Накопите 5000 золота',
        category: 'wealth',
        icon: '💎',
        target: 5000,
        stat: 'gold',
        rewardExp: 500,
        rewardGold: 1000
    },
    {
        id: 'millionaire',
        name: '👑 Миллионер',
        description: 'Накопите 10000 золота',
        category: 'wealth',
        icon: '👑',
        target: 10000,
        stat: 'gold',
        rewardExp: 2000,
        rewardGold: 5000
    },
    {
        id: 'first_dungeon',
        name: '🏰 Исследователь',
        description: 'Пройдите первое подземелье',
        category: 'dungeon',
        icon: '🏰',
        target: 1,
        stat: 'dungeons_completed',
        rewardExp: 300,
        rewardGold: 500
    },
    {
        id: 'dungeon_master',
        name: '🗝️ Мастер подземелий',
        description: 'Пройдите все подземелья',
        category: 'dungeon',
        icon: '🗝️',
        target: 3,
        stat: 'dungeons_completed',
        rewardExp: 1000,
        rewardGold: 2000
    },
    {
        id: 'first_boss',
        name: '👹 Убийца боссов',
        description: 'Победите первого босса',
        category: 'boss',
        icon: '👹',
        target: 1,
        stat: 'bosses_killed',
        rewardExp: 200,
        rewardGold: 300
    },
    {
        id: 'boss_slayer',
        name: '⚔️ Истребитель боссов',
        description: 'Победите 5 боссов',
        category: 'boss',
        icon: '⚔️',
        target: 5,
        stat: 'bosses_killed',
        rewardExp: 1000,
        rewardGold: 2000
    }
];

export function getAchievement(achievementId) {
    return ACHIEVEMENTS.find(a => a.id === achievementId);
}

export function getAchievementsByCategory(category) {
    return ACHIEVEMENTS.filter(a => a.category === category);
}