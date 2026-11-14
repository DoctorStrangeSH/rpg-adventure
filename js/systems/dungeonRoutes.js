// Route choice changes the next stage's combat risk and rewards; it does not
// grant resources directly, so abandoning a dungeon cannot farm free loot.
export const DUNGEON_ROUTES = Object.freeze({
    safe: { id: 'safe', name: 'Тихая тропа', icon: '🌿', description: 'Обычные враги и стандартные награды.', enemyHealth: 1, enemyAttack: 1, reward: 1 },
    danger: { id: 'danger', name: 'Проклятый проход', icon: '💀', description: 'Враги сильнее на 35%, но награды выше на 65%.', enemyHealth: 1.35, enemyAttack: 1.35, reward: 1.65 }
});

export function getRoute(id) {
    return Object.hasOwn(DUNGEON_ROUTES, id) ? DUNGEON_ROUTES[id] : null;
}

export function applyRouteToEnemy(enemy, routeId, roll = Math.random()) {
    const route = getRoute(routeId);
    if (!route || !enemy) return null;
    const isElite = routeId === 'danger' && Number.isFinite(roll) && roll >= 0 && roll < 0.2;
    const eliteMultiplier = isElite ? 1.3 : 1;
    return {
        ...enemy,
        name: isElite ? `⚡ Элитный ${enemy.name}` : enemy.name,
        elite: isElite,
        health: Math.max(1, Math.floor(enemy.health * route.enemyHealth * eliteMultiplier)),
        maxHealth: Math.max(1, Math.floor(enemy.maxHealth * route.enemyHealth * eliteMultiplier)),
        attack: Math.max(1, Math.floor(enemy.attack * route.enemyAttack * eliteMultiplier)),
        expReward: Math.floor(enemy.expReward * route.reward * eliteMultiplier),
        goldReward: Math.floor(enemy.goldReward * route.reward * eliteMultiplier)
    };
}
