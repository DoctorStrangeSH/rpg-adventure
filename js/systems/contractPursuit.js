// A lucrative blood pact has a short-lived consequence: one pursuer.
export const PURSUER_HEALTH_MULTIPLIER = 1.2;
export const PURSUER_ATTACK_MULTIPLIER = 1.2;
export const PURSUER_REWARD_MULTIPLIER = 1.25;

export function scheduleBloodPursuer(eventId, choiceId, outcome) {
    return eventId === 'blood_contract' && choiceId === 'risk' && (outcome?.gold || 0) > 0;
}

export function applyBloodPursuer(enemy, pending) {
    if (!enemy || !pending) return { enemy, pursued: false };
    const scale = (value, multiplier) => Math.max(1, Math.floor((Number.isFinite(value) ? value : 1) * multiplier));
    return {
        enemy: {
            ...enemy,
            name: `🩸 Преследователь: ${enemy.name}`,
            health: scale(enemy.health, PURSUER_HEALTH_MULTIPLIER),
            maxHealth: scale(enemy.maxHealth, PURSUER_HEALTH_MULTIPLIER),
            attack: scale(enemy.attack, PURSUER_ATTACK_MULTIPLIER),
            expReward: Math.max(0, Math.floor((enemy.expReward || 0) * PURSUER_REWARD_MULTIPLIER)),
            goldReward: Math.max(0, Math.floor((enemy.goldReward || 0) * PURSUER_REWARD_MULTIPLIER))
        },
        pursued: true
    };
}
