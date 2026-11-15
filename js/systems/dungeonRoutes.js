// Route choice changes the next stage's combat risk and rewards; it does not
// grant resources directly, so abandoning a dungeon cannot farm free loot.
export const DUNGEON_ROUTES = Object.freeze({
    safe: { id: 'safe', name: 'Тихая тропа', icon: '🌿', description: 'Обычные враги и стандартные награды.', enemyHealth: 1, enemyAttack: 1, reward: 1 },
    danger: { id: 'danger', name: 'Проклятый проход', icon: '💀', description: 'Здоровье и атака врагов +35%, награды +65%. Возможны элиты.', enemyHealth: 1.35, enemyAttack: 1.35, reward: 1.65 },
    endurance: { id: 'endurance', name: 'Тропа испытания', icon: '🛡️', description: 'Здоровье врагов +60%, атака −20%, награды +30%.', enemyHealth: 1.6, enemyAttack: 0.8, reward: 1.3 }
});

export function getRoute(id) {
    return Object.hasOwn(DUNGEON_ROUTES, id) ? DUNGEON_ROUTES[id] : null;
}

export function applyRouteToEnemy(enemy, routeId, roll = Math.random()) {
    const route = getRoute(routeId);
    if (!route || !enemy) return null;
    const isElite = routeId === 'danger' && Number.isFinite(roll) && roll >= 0 && roll < 0.2;
    const eliteMultiplier = isElite ? 1.3 : 1;
    const affixes = ['vampiric', 'enraged', 'armored', 'tactician'];
    const affix = isElite ? affixes[Math.min(affixes.length - 1, Math.floor(roll / 0.2 * affixes.length))] : null;
    const affixNames = { vampiric: 'Кровопийца', enraged: 'Яростный', armored: 'Бронированный', tactician: 'Тактик' };
    // The rarest part of the elite roll produces predefined two-affix encounters.
    // Keeping the pairing deterministic makes these fights reproducible in tests.
    const comboIndex = isElite && roll >= 0.185 ? Math.min(2, Math.floor((roll - 0.185) / 0.005)) : -1;
    const combos = [['vampiric', 'enraged'], ['armored', 'tactician'], ['enraged', 'armored']];
    const eliteAffixes = isElite ? (comboIndex >= 0 ? combos[comboIndex] : [affix]) : [];
    const name = eliteAffixes.map(id => affixNames[id]).join(' ');
    return {
        ...enemy,
        name: isElite ? `⚡ ${name} ${enemy.name}` : enemy.name,
        elite: isElite,
        eliteAffix: eliteAffixes[0] || null,
        eliteAffixes,
        health: Math.max(1, Math.floor(enemy.health * route.enemyHealth * eliteMultiplier)),
        maxHealth: Math.max(1, Math.floor(enemy.maxHealth * route.enemyHealth * eliteMultiplier)),
        attack: Math.max(1, Math.floor(enemy.attack * route.enemyAttack * eliteMultiplier)),
        defense: Math.max(0, Math.floor((enemy.defense || 0) + (eliteAffixes.includes('armored') ? 12 : 0))),
        expReward: Math.floor(enemy.expReward * route.reward * eliteMultiplier),
        goldReward: Math.floor(enemy.goldReward * route.reward * eliteMultiplier)
    };
}
