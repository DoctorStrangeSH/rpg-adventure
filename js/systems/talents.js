// Permanent class talents. Values are computed on demand, never applied to
// stored base stats, so save/load and repeated rendering cannot duplicate them.
export const TALENTS = Object.freeze({
    warrior: [
        { id: 'warrior_force', name: 'Сокрушитель', icon: '⚔️', description: '+5 к атаке', attack: 5 },
        { id: 'warrior_guard', name: 'Железная воля', icon: '🛡️', description: '+5 к защите', defense: 5 },
        { id: 'warrior_critical', name: 'Боевой азарт', icon: '💥', description: '+5% к шансу критического удара', critChance: 0.05 },
        { id: 'warrior_berserker', name: 'Берсерк', icon: '🔥', description: 'Специализация: +12 к атаке', attack: 12, requiredLevel: 4, requires: 'warrior_force', specialization: true },
        { id: 'warrior_sentinel', name: 'Защитник', icon: '🏰', description: 'Специализация: +10 к защите', defense: 10, requiredLevel: 4, requires: 'warrior_guard', specialization: true }
    ],
    mage: [
        { id: 'mage_focus', name: 'Тайное знание', icon: '🔮', description: '+6 к атаке', attack: 6 },
        { id: 'mage_ward', name: 'Магический барьер', icon: '✨', description: '+4 к защите', defense: 4 },
        { id: 'mage_critical', name: 'Разряд энергии', icon: '⚡', description: '+5% к шансу критического удара', critChance: 0.05 },
        { id: 'mage_arcanist', name: 'Арканист', icon: '🌌', description: 'Специализация: +14 к атаке', attack: 14, requiredLevel: 4, requires: 'mage_focus', specialization: true },
        { id: 'mage_warden', name: 'Хранитель рун', icon: '🪄', description: 'Специализация: +9 к защите', defense: 9, requiredLevel: 4, requires: 'mage_ward', specialization: true }
    ],
    archer: [
        { id: 'archer_precision', name: 'Верный прицел', icon: '🎯', description: '+5% к шансу критического удара', critChance: 0.05 },
        { id: 'archer_power', name: 'Тугой лук', icon: '🏹', description: '+5 к атаке', attack: 5 },
        { id: 'archer_evasion', name: 'Ловкость охотника', icon: '🍃', description: '+4 к защите', defense: 4 },
        { id: 'archer_sniper', name: 'Снайпер', icon: '🏹', description: 'Специализация: +15% к критическому удару', critChance: 0.15, requiredLevel: 4, requires: 'archer_precision', specialization: true },
        { id: 'archer_ranger', name: 'Следопыт', icon: '🌲', description: 'Специализация: +8 к атаке и +3 к защите', attack: 8, defense: 3, requiredLevel: 4, requires: 'archer_power', specialization: true }
    ]
});

export function getTalentPoints(player) {
    const spent = Array.isArray(player?.talents) ? player.talents.length : 0;
    return Math.max(0, Math.floor(Number(player?.level) || 1) - 1 - spent);
}

export function getTalentAvailability(player, id) {
    if (!player || !Object.hasOwn(TALENTS, player.class)) return { available: false, reason: 'Недоступно' };
    const talent = TALENTS[player.class].find(entry => entry.id === id);
    if (!talent) return { available: false, reason: 'Недоступно' };
    if (player.talents?.includes(id)) return { available: false, reason: 'Изучено' };
    if (talent.requiredLevel && player.level < talent.requiredLevel) return { available: false, reason: `Нужен ${talent.requiredLevel} уровень` };
    if (talent.requires && !player.talents?.includes(talent.requires)) {
        const prerequisite = TALENTS[player.class].find(entry => entry.id === talent.requires);
        return { available: false, reason: `Сначала: ${prerequisite.name}` };
    }
    if (talent.specialization && TALENTS[player.class].some(entry => entry.specialization && player.talents?.includes(entry.id))) {
        return { available: false, reason: 'Другая специализация выбрана' };
    }
    if (getTalentPoints(player) < 1) return { available: false, reason: 'Нет очков' };
    return { available: true, reason: 'Изучить' };
}

export function unlockTalent(player, id) {
    if (!player || !Object.hasOwn(TALENTS, player.class)) return false;
    const talent = TALENTS[player.class].find(entry => entry.id === id);
    if (!talent || !getTalentAvailability(player, id).available) return false;
    if (!Array.isArray(player.talents)) player.talents = [];
    player.talents.push(id);
    return true;
}

export function getTalentBonuses(player) {
    const selected = new Set(Array.isArray(player?.talents) ? player.talents : []);
    const talents = TALENTS[player?.class] || [];
    return talents.filter(t => selected.has(t.id)).reduce((bonuses, t) => ({
        attack: bonuses.attack + (t.attack || 0),
        defense: bonuses.defense + (t.defense || 0),
        critChance: bonuses.critChance + (t.critChance || 0)
    }), { attack: 0, defense: 0, critChance: 0 });
}
