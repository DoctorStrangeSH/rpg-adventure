// Permanent class talents. Values are computed on demand, never applied to
// stored base stats, so save/load and repeated rendering cannot duplicate them.
export const TALENTS = Object.freeze({
    warrior: [
        { id: 'warrior_force', name: 'Сокрушитель', icon: '⚔️', description: '+5 к атаке', attack: 5 },
        { id: 'warrior_guard', name: 'Железная воля', icon: '🛡️', description: '+5 к защите', defense: 5 },
        { id: 'warrior_critical', name: 'Боевой азарт', icon: '💥', description: '+5% к шансу критического удара', critChance: 0.05 }
    ],
    mage: [
        { id: 'mage_focus', name: 'Тайное знание', icon: '🔮', description: '+6 к атаке', attack: 6 },
        { id: 'mage_ward', name: 'Магический барьер', icon: '✨', description: '+4 к защите', defense: 4 },
        { id: 'mage_critical', name: 'Разряд энергии', icon: '⚡', description: '+5% к шансу критического удара', critChance: 0.05 }
    ],
    archer: [
        { id: 'archer_precision', name: 'Верный прицел', icon: '🎯', description: '+5% к шансу критического удара', critChance: 0.05 },
        { id: 'archer_power', name: 'Тугой лук', icon: '🏹', description: '+5 к атаке', attack: 5 },
        { id: 'archer_evasion', name: 'Ловкость охотника', icon: '🍃', description: '+4 к защите', defense: 4 }
    ]
});

export function getTalentPoints(player) {
    const spent = Array.isArray(player?.talents) ? player.talents.length : 0;
    return Math.max(0, Math.floor(Number(player?.level) || 1) - 1 - spent);
}

export function unlockTalent(player, id) {
    if (!player || !Object.hasOwn(TALENTS, player.class)) return false;
    const talent = TALENTS[player.class].find(entry => entry.id === id);
    if (!talent || player.talents?.includes(id) || getTalentPoints(player) < 1) return false;
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
