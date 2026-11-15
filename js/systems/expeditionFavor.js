// Temporary favor earned by helping a traveler. It belongs to the current
// expedition only and is never written into permanent player progression.
export const TRAVELER_FAVOR_FIGHTS = 3;
export const TRAVELER_FAVOR_ATTACK_MULTIPLIER = 0.85;

export function awardTravelerFavor(current, eventId, choiceId) {
    const charges = Number.isInteger(current) && current > 0 ? current : 0;
    return eventId === 'wounded_traveler' && choiceId === 'risk'
        ? TRAVELER_FAVOR_FIGHTS
        : charges;
}

export function consumeTravelerFavor(enemy, charges) {
    if (!enemy || !Number.isInteger(charges) || charges <= 0) {
        return { enemy, charges: Math.max(0, Number.isInteger(charges) ? charges : 0), protected: false };
    }
    return {
        enemy: {
            ...enemy,
            attack: Math.max(1, Math.floor(enemy.attack * TRAVELER_FAVOR_ATTACK_MULTIPLIER))
        },
        charges: charges - 1,
        protected: true
    };
}
