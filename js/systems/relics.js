// Relics are unique collectible drops. Only two may be active at a time;
// bonuses are derived, never written back into base player attributes.
export const RELICS = Object.freeze({
    ash_heart: { id: 'ash_heart', icon: '🔥', name: 'Сердце пепла', description: '+6 к атаке', attack: 6 },
    stone_oath: { id: 'stone_oath', icon: '🪨', name: 'Каменная клятва', description: '+6 к защите', defense: 6 },
    eagle_eye: { id: 'eagle_eye', icon: '👁️', name: 'Око орла', description: '+7% к шансу критического удара', critChance: 0.07 },
    arcane_spark: { id: 'arcane_spark', icon: '✨', name: 'Арканная искра', description: '+10% к урону умений', skillPower: 0.1 }
});
export const MAX_ACTIVE_RELICS = 2;

export function awardRelic(player, isElite = false, isBoss = false, roll = Math.random()) {
    if (!player || (!isElite && !isBoss) || !Number.isFinite(roll) || roll < 0 || roll >= 1) return null;
    if (roll >= (isBoss ? 0.6 : 0.35)) return null;
    const owned = new Set(Array.isArray(player.relics) ? player.relics : []);
    const available = Object.keys(RELICS).filter(id => !owned.has(id));
    if (!available.length) return null;
    const index = Math.min(available.length - 1, Math.floor(roll / (isBoss ? 0.6 : 0.35) * available.length));
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
    const owned = new Set(Array.isArray(player?.relics) ? player.relics : []);
    const active = Array.isArray(player?.activeRelics) ? [...new Set(player.activeRelics)].slice(0, MAX_ACTIVE_RELICS) : [];
    return active.filter(id => owned.has(id) && Object.hasOwn(RELICS, id)).reduce((sum, id) => {
        const relic = RELICS[id];
        return { attack: sum.attack + (relic.attack || 0), defense: sum.defense + (relic.defense || 0),
            critChance: sum.critChance + (relic.critChance || 0), skillPower: sum.skillPower + (relic.skillPower || 0) };
    }, { attack: 0, defense: 0, critChance: 0, skillPower: 0 });
}
