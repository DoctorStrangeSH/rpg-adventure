// Pure combat rules: shared by battles and automated regression tests.
import { getItem } from '../data/items.js';
import { getTalentBonuses } from './talents.js';
import { getRelicBonuses, hasActiveRelic } from './relics.js';

export function hasSpecialization(player, id) {
    return player?.talents?.includes(id) === true;
}

export function getEnemyTacticHint(enemy) {
    if (!enemy) return '';
    if (enemy.intent === 'heavy') return '⚠️ Следующая атака будет сокрушительной. Защищайтесь!';
    const miniBossHints = {
        goblin_king: 'Король гоблинов устраивает внезапные засады.',
        mountain_giant: 'Горный великан пробивает часть вашей брони.',
        death_knight: 'Рыцарь смерти лечится, похищая ваши жизненные силы.',
        ancient_dragon: 'Древний дракон выжигает ману огненным дыханием.'
    };
    if (enemy.miniBoss && miniBossHints[enemy.id]) return `👹 ${miniBossHints[enemy.id]}`;
    const affixHints = {
        vampiric: 'Элитный враг восстанавливает здоровье атаками.',
        enraged: 'Элитный враг усиливается при низком здоровье.',
        armored: 'Элитный враг защищён дополнительной бронёй.'
    };
    if (enemy.eliteAffix && affixHints[enemy.eliteAffix]) return `⚡ ${affixHints[enemy.eliteAffix]}`;
    if (enemy.behavior === 'boss') return '👑 У босса три фазы. Следите за предупреждениями.';
    return '';
}

export function getCriticalMultiplier(player) {
    return hasSpecialization(player, 'archer_sniper') ? 2.5 : 2;
}

export function triggerRangerEffect(player, enemy, roll = Math.random()) {
    if (!hasSpecialization(player, 'archer_ranger') || !enemy || enemy.health <= 0 ||
        !Number.isFinite(roll) || roll < 0 || roll >= 0.3) return false;
    return applyStatusEffect(enemy, 'bleed', 2);
}

export function triggerWeaponEffect(player, enemy, roll = Math.random()) {
    if (!enemy || enemy.health <= 0 || !player?.equipment?.weapon) return null;
    const effect = getItem(player.equipment.weapon)?.onHit;
    if (!effect || !Number.isFinite(roll) || roll < 0 || roll >= effect.chance) return null;
    return applyStatusEffect(enemy, effect.type, effect.turns) ? effect.type : null;
}
export function calculateDamage(attack, defense, variance = 0, multiplier = 1) {
    const base = Math.max(0, Number(attack) || 0);
    const resistance = Math.max(0, Number(defense) || 0);
    const spread = Math.max(0, Math.floor(Number(variance) || 0));
    return Math.max(1, Math.floor(base * multiplier - resistance + spread));
}

export function applyDamage(entity, damage) {
    const amount = Math.max(0, Math.floor(Number(damage) || 0));
    entity.health = Math.max(0, entity.health - amount);
    return amount;
}

export function consumeHealingPotion(player, item, potionData) {
    if (!item || item.quantity <= 0 || !player.inventory.includes(item) ||
        !potionData?.heal || player.health >= player.maxHealth) {
        return 0;
    }
    const restored = Math.min(potionData.heal, player.maxHealth - player.health);
    player.health += restored;
    item.quantity--;
    if (item.quantity === 0) {
        player.inventory.splice(player.inventory.indexOf(item), 1);
    }
    return restored;
}

export function useSkillEffect(player, enemy, skill) {
    const hits = Math.max(1, Math.floor(skill.hits || 1));
    const multiplier = (skill.damageMultiplier ?? 1) * (hasSpecialization(player, 'mage_arcanist') ? 1.2 : 1) *
        (1 + getRelicBonuses(player).skillPower);
    let damage = 0;
    // Utility abilities can deliberately skip direct damage.
    if (skill.damageMultiplier || skill.hits || skill.poison) {
        for (let hit = 0; hit < hits; hit++) {
            damage += applyDamage(enemy, calculateDamage(getEffectiveCombatStats(player).attack, enemy.defense, 0, multiplier));
        }
    }
    if (skill.freeze) applyStatusEffect(enemy, 'freeze', 1);
    if (skill.poison) applyStatusEffect(enemy, 'poison', 3);
    if (skill.burn) applyStatusEffect(enemy, 'burn', 2);
    if (skill.bleed) applyStatusEffect(enemy, 'bleed', 2);
    if (skill.weaken) applyStatusEffect(enemy, 'weaken', 2);
    // Legendary skills ignite surviving enemies. The same resistance rules
    // used by ordinary burns apply, including complete immunity.
    const phoenixBurn = damage > 0 && enemy.health > 0 && hasActiveRelic(player, 'phoenix_crown')
        ? applyStatusEffect(enemy, 'burn', 2) : false;
    return { damage, hits, guardReduction: skill.defenseBonus ? 0.75 : 0, phoenixBurn };
}

export function tryPhoenixRebirth(player, battleRelics) {
    if (!battleRelics || player?.health > 0 || !Number.isFinite(player?.maxHealth) || player.maxHealth <= 0 ||
        !hasActiveRelic(player, 'phoenix_crown') || battleRelics.phoenixRebirthUsed) return false;
    player.health = Math.max(1, Math.ceil(player.maxHealth * 0.2));
    battleRelics.phoenixRebirthUsed = true;
    return true;
}

export function applyStatusEffect(enemy, type, turns) {
    const resistance = Math.max(0, Math.min(1, Number(enemy.resistances?.[type]) || 0));
    const duration = Math.ceil(Math.max(0, turns) * (1 - resistance));
    if (!duration) return false;
    enemy.effects ||= {};
    const key = `${type}Turns`;
    enemy.effects[key] = Math.max(enemy.effects[key] || 0, duration);
    return true;
}

export function tickEnemyEffects(enemy) {
    const effects = enemy.effects || {};
    let poisonDamage = 0;
    let burnDamage = 0;
    let bleedDamage = 0;
    if (effects.poisonTurns > 0) {
        poisonDamage = applyDamage(enemy, Math.max(1, Math.floor(enemy.maxHealth * 0.05)));
        effects.poisonTurns--;
    }
    if (effects.burnTurns > 0) {
        burnDamage = applyDamage(enemy, Math.max(1, Math.floor(enemy.maxHealth * 0.04)));
        effects.burnTurns--;
    }
    if (effects.bleedTurns > 0) {
        bleedDamage = applyDamage(enemy, Math.max(1, Math.floor(enemy.maxHealth * 0.03)));
        effects.bleedTurns--;
    }
    const frozen = effects.freezeTurns > 0;
    if (frozen) effects.freezeTurns--;
    return { poisonDamage, burnDamage, bleedDamage, frozen };
}

// Deterministic with an injected roll, so tactics are reproducible in tests.
export function chooseEnemyAction(enemy, player, roll = Math.random()) {
    const behavior = enemy.behavior || (enemy.id === 'dragon' ? 'boss' : 'standard');
    const healthRatio = enemy.maxHealth > 0 ? enemy.health / enemy.maxHealth : 1;
    if (behavior === 'mini_boss') {
        const signatures = {
            goblin_king: 'ambush', mountain_giant: 'crush',
            death_knight: 'siphon', ancient_dragon: 'flame_breath'
        };
        return roll < 0.4 ? (signatures[enemy.id] || 'heavy') : roll < 0.65 ? 'heavy' : 'attack';
    }
    if (behavior === 'boss') {
        return roll < 0.4 ? 'heavy' : roll < 0.7 ? 'mana_burn' : 'attack';
    }
    if (behavior === 'resilient' && healthRatio < 0.45 && roll < 0.5) return 'recover';
    if (behavior === 'opportunist' && player.mana > 0 && roll < 0.3) return 'mana_burn';
    if (behavior === 'aggressive' && roll < 0.35) return 'heavy';
    return 'attack';
}

export function getBossPhase(enemy) {
    const ratio = enemy.maxHealth > 0 ? enemy.health / enemy.maxHealth : 1;
    return ratio <= 0.25 ? 3 : ratio <= 0.6 ? 2 : 1;
}

// A dangerous boss attack is announced one turn in advance. Keeping the intent
// on the enemy prevents the next decision from silently replacing the warning.
export function planEnemyTurn(enemy, player, roll = Math.random()) {
    if (enemy.behavior !== 'boss') return { action: chooseEnemyAction(enemy, player, roll), warned: false, phaseChanged: false };
    const phase = getBossPhase(enemy);
    const phaseChanged = enemy.phase !== undefined && phase !== enemy.phase;
    enemy.phase = phase;
    if (phaseChanged) enemy.intent = null;

    if (enemy.intent === 'heavy') {
        enemy.intent = null;
        return { action: 'heavy', warned: false, phaseChanged, phase };
    }

    // More dangerous phases increase the chance of a telegraphed heavy attack.
    const heavyChance = phase === 3 ? 0.65 : phase === 2 ? 0.5 : 0.35;
    if (roll < heavyChance) {
        enemy.intent = 'heavy';
        return { action: null, warned: true, phaseChanged, phase };
    }
    return { action: roll < 0.8 ? 'mana_burn' : 'attack', warned: false, phaseChanged, phase };
}

export function applyEnemyAction(enemy, player, action, variance = 0, reduction = 0) {
    if (action === 'recover') {
        const healed = Math.min(enemy.maxHealth - enemy.health, Math.max(1, Math.floor(enemy.maxHealth * 0.15)));
        enemy.health += healed;
        return { damage: 0, healed, manaBurned: 0, reflected: 0 };
    }
    const weakened = enemy.effects?.weakenTurns > 0;
    const enraged = enemy.eliteAffix === 'enraged' && enemy.maxHealth > 0 && enemy.health / enemy.maxHealth <= 0.5;
    const multiplier = (action === 'heavy' ? 1.5 : action === 'mana_burn' ? 0.85 :
        action === 'ambush' ? 1.25 : action === 'crush' ? 1.2 : action === 'flame_breath' ? 1.15 : 1) *
        (weakened ? 0.75 : 1) * (enraged ? 1.4 : 1);
    if (weakened) enemy.effects.weakenTurns--;
    const runeReduction = hasSpecialization(player, 'mage_warden') ? 0.15 : 0;
    const effectiveReduction = 1 - (1 - Math.min(1, Math.max(0, reduction))) * (1 - runeReduction);
    const effectiveDefense = getEffectiveCombatStats(player).defense * (action === 'crush' ? 0.5 : 1);
    const damage = Math.max(1, Math.floor(calculateDamage(enemy.attack, effectiveDefense, variance, multiplier) * (1 - effectiveReduction)));
    applyDamage(player, damage);
    // Retaliation is tied to an actual guard, not passive defense or recovery.
    const reflected = hasSpecialization(player, 'warrior_sentinel') && reduction > 0
        ? applyDamage(enemy, Math.max(1, Math.floor(damage * 0.25))) : 0;
    const lifeStolen = enemy.eliteAffix === 'vampiric' && enemy.health > 0
        ? Math.min(Math.max(0, enemy.maxHealth - enemy.health), Math.floor(damage * 0.25)) : 0;
    if (lifeStolen) enemy.health += lifeStolen;
    const soulDrain = action === 'siphon' && enemy.health > 0
        ? Math.min(Math.max(0, enemy.maxHealth - enemy.health), Math.max(1, Math.floor(damage * 0.3))) : 0;
    if (soulDrain) enemy.health += soulDrain;
    const manaBurned = action === 'mana_burn' || action === 'flame_breath'
        ? Math.min(player.mana, Math.max(1, Math.floor(enemy.attack / (action === 'flame_breath' ? 2 : 3)))) : 0;
    player.mana -= manaBurned;
    return { damage, healed: 0, manaBurned, reflected, lifeStolen, soulDrain, enraged };
}

// Set bonuses are derived from equipped IDs, never permanently added to base
// stats. Equipping, unequipping and loading saves cannot stack the bonus.
export function getEquipmentSetBonuses(player) {
    const equipped = Object.values(player?.equipment || {}).filter(Boolean);
    const sets = [
        { id: 'emberguard', name: 'Страж пепла', pieces: ['ember_sword', 'guardian_armor'], attack: 6, defense: 0 },
        { id: 'frostwarden', name: 'Хранитель стужи', pieces: ['frost_blade', 'frost_armor'], attack: 0, defense: 7 },
        { id: 'bloodhunter', name: 'Охотник за кровью', pieces: ['blood_dagger', 'blood_armor'], attack: 4, defense: 3 }
    ];
    const activeSets = sets.filter(set => set.pieces.every(id => equipped.includes(id)));
    return {
        attack: activeSets.reduce((sum, set) => sum + set.attack, 0),
        defense: activeSets.reduce((sum, set) => sum + set.defense, 0),
        activeSets: activeSets.map(({ id, name }) => ({ id, name }))
    };
}

export function getEffectiveCombatStats(player) {
    const bonuses = getEquipmentSetBonuses(player);
    const talents = getTalentBonuses(player);
    const relics = getRelicBonuses(player);
    return {
        attack: Math.max(0, Math.floor(((Number(player?.attack) || 0) + bonuses.attack + talents.attack + relics.attack) *
            (hasSpecialization(player, 'warrior_berserker') && player.maxHealth > 0 && player.health / player.maxHealth <= 0.35 ? 1.3 : 1))),
        defense: Math.max(0, (Number(player?.defense) || 0) + bonuses.defense + talents.defense + relics.defense),
        critChance: Math.min(1, 0.15 + talents.critChance + relics.critChance),
        activeSets: bonuses.activeSets
    };
}
