// Relics are unique collectible drops. Only two may be active at a time;
// bonuses are derived, never written back into base player attributes.
export const RELICS = Object.freeze({
    ash_heart: { id: 'ash_heart', icon: '🔥', name: 'Сердце пепла', rarity: 'common', description: '+6 к атаке', attack: 6 },
    stone_oath: { id: 'stone_oath', icon: '🪨', name: 'Каменная клятва', rarity: 'common', description: '+6 к защите', defense: 6 },
    eagle_eye: { id: 'eagle_eye', icon: '👁️', name: 'Око орла', rarity: 'rare', description: '+7% к шансу критического удара', critChance: 0.07 },
    arcane_spark: { id: 'arcane_spark', icon: '✨', name: 'Арканная искра', rarity: 'rare', description: '+10% к урону умений', skillPower: 0.1 },
    blood_moon: { id: 'blood_moon', icon: '🌙', name: 'Кровавая луна', rarity: 'epic', description: '+9 к атаке', attack: 9 },
    guardian_sigil: { id: 'guardian_sigil', icon: '🛡️', name: 'Печать стража', rarity: 'epic', description: '+10 к защите', defense: 10 },
    phoenix_crown: { id: 'phoenix_crown', icon: '👑', name: 'Корона феникса', rarity: 'legendary', description: '+8 к атаке и +15% к урону умений', attack: 8, skillPower: 0.15 }
});
export const MAX_ACTIVE_RELICS = 2;
export const RELIC_RARITIES = Object.freeze({
    common: { name: 'Обычная', weight: 50 },
    rare: { name: 'Редкая', weight: 30 },
    epic: { name: 'Эпическая', weight: 15 },
    legendary: { name: 'Легендарная', weight: 5 }
});
export const RELIC_SYNERGIES = Object.freeze([
    { id: 'ember_magic', name: 'Пламенное колдовство', relics: ['ash_heart', 'arcane_spark'], description: '+15% к урону умений', skillPower: 0.15 },
    { id: 'watchful_guard', name: 'Бдительный страж', relics: ['stone_oath', 'eagle_eye'], description: '+4 к защите и +3% к критическому удару', defense: 4, critChance: 0.03 },
    { id: 'bloodfire', name: 'Кровавое пламя', relics: ['blood_moon', 'ash_heart'], description: '+5 к атаке', attack: 5 },
    { id: 'royal_flame', name: 'Пламя возрождения', relics: ['phoenix_crown', 'arcane_spark'], description: '+20% к урону умений', skillPower: 0.2 }
]);

function validActiveRelics(player) {
    const owned = new Set(Array.isArray(player?.relics) ? player.relics : []);
    const active = Array.isArray(player?.activeRelics) ? player.activeRelics : [];
    return [...new Set(active)].filter(id => owned.has(id) && Object.hasOwn(RELICS, id)).slice(0, MAX_ACTIVE_RELICS);
}

export function getActiveRelicSynergies(player) {
    const active = new Set(validActiveRelics(player));
    return RELIC_SYNERGIES.filter(synergy => synergy.relics.every(id => active.has(id)));
}

export function awardRelic(player, isElite = false, isBoss = false, roll = Math.random()) {
    if (!player || (!isElite && !isBoss) || !Number.isFinite(roll) || roll < 0 || roll >= 1) return null;
    if (roll >= (isBoss ? 0.6 : 0.35)) return null;
    const owned = new Set(Array.isArray(player.relics) ? player.relics : []);
    const available = Object.keys(RELICS).filter(id => !owned.has(id));
    if (!available.length) return null;
    // A single supplied roll makes both the drop gate and weighted rarity
    // selection deterministic for reproducible encounters and tests.
    const position = roll / (isBoss ? 0.6 : 0.35);
    const weights = available.map(id => RELIC_RARITIES[RELICS[id].rarity].weight *
        (isBoss && RELICS[id].rarity !== 'common' ? 1.5 : 1));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = position * totalWeight;
    let index = available.length - 1;
    for (let i = 0; i < available.length; i++) {
        cursor -= weights[i];
        if (cursor < 0) { index = i; break; }
    }
    if (!Array.isArray(player.relics)) player.relics = [];
    player.relics.push(available[index]);
    return available[index];
}

export function toggleRelic(player, id) {
    if (!player || !Object.hasOwn(RELICS, id) || !Array.isArray(player.relics) || !player.relics.includes(id)) return false;
    if (!Array.isArray(player.activeRelics)) player.activeRelics = [];
    if (player.activeRelics.includes(id)) {
        player.activeRelics = player.activeRelics.filter(entry => entry !== id);
        return true;
    }
    if (player.activeRelics.length >= MAX_ACTIVE_RELICS) return false;
    player.activeRelics.push(id);
    return true;
}

export function getRelicBonuses(player) {
    const effects = [...validActiveRelics(player).map(id => RELICS[id]), ...getActiveRelicSynergies(player)];
    return effects.reduce((sum, relic) => {
        return { attack: sum.attack + (relic.attack || 0), defense: sum.defense + (relic.defense || 0),
            critChance: sum.critChance + (relic.critChance || 0), skillPower: sum.skillPower + (relic.skillPower || 0) };
    }, { attack: 0, defense: 0, critChance: 0, skillPower: 0 });
}
