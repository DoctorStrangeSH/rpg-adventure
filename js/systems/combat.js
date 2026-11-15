// Pure combat rules: shared by battles and automated regression tests.
import { getItem } from '../data/items.js';
import { getTalentBonuses } from './talents.js';
import { getRelicBonuses, hasActiveRelic } from './relics.js';

export function hasSpecialization(player, id) {
    return player?.talents?.includes(id) === true;
}

// When a foe prepares a special strike, each class has a different answer:
// warriors brace, archers exploit the opening, mages can cancel it with frost.
export function getClassTacticalBonus(player, enemy) {
    if (!enemy?.intent) return { attackMultiplier: 1, guardReduction: 0.5 };
    if (player?.class === 'archer') return { attackMultiplier: 1.3, guardReduction: 0.5 };
    if (player?.class === 'warrior') return { attackMultiplier: 1, guardReduction: 0.75 };
    return { attackMultiplier: 1, guardReduction: 0.5 };
}

// A warrior can trade the remaining weakening duration for a stronger basic
// strike. The effect is consumed once and cannot be exploited by other classes.
export function consumeWarriorOpening(player, enemy) {
    if (player?.class !== 'warrior' || !enemy || enemy.health <= 0 || !(enemy.effects?.weakenTurns > 0)) return false;
    enemy.effects.weakenTurns--;
    return true;
}

export function getEnemyTacticHint(enemy) {
    if (!enemy) return '';
    if (enemy.intent === 'heavy') return '⚠️ Следующая атака будет сокрушительной. Защищайтесь!';
    if (enemy.intent) {
        const warnings = {
            ambush: '⚠️ Готовится засада. Защищайтесь или прервите подготовку заморозкой!',
            crush: '⚠️ Великан замахивается! Удар частично игнорирует броню.',
            pounce: '🐺 Противник заметил вашу слабость и готовится к прыжку. Защищайтесь или прервите атаку!',
            mana_burn: '💠 Враг нацелился на ваш запас маны. Подготовьтесь к истощению!',
            siphon: '⚠️ Враг готовит похищение жизненных сил.',
            flame_breath: '⚠️ Дракон набирает воздух для огненного дыхания. Берегите ману!',
            cataclysm: '☄️ Босс собирает энергию для катаклизма! Защита особенно важна.',
            thorn_burst: '🌿 Хранитель призывает шипастые корни! Удар частично пробьёт броню.'
        };
        if (warnings[enemy.intent]) return warnings[enemy.intent];
    }
    if (enemy.pendingAdaptation) return '⚠️ Противник заметил повторяющийся тип урона и готовится к нему адаптироваться.';
    if (enemy.adaptiveResistance?.turns > 0) {
        const label = DAMAGE_TYPE_LABELS[enemy.adaptiveResistance.type] || enemy.adaptiveResistance.type;
        return '🛡️ Противник адаптировался к типу урона: ' + label + ' (' + enemy.adaptiveResistance.turns + ' хода).';
    }
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
        armored: 'Элитный враг защищён дополнительной бронёй.',
        tactician: 'Элитный тактик запоминает повторяющиеся типы урона и сопротивляется им.'
    };
    if (enemy.eliteAffix && affixHints[enemy.eliteAffix]) return `⚡ ${affixHints[enemy.eliteAffix]}`;
    if (enemy.behavior === 'resilient' && getEnemyCleanseTarget(enemy)) {
        return '🛡️ Противник может снять с себя один опасный отрицательный эффект.';
    }
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
export const DAMAGE_TYPE_LABELS = {
    physical: 'физический урон',
    fire: 'огонь',
    ice: 'лёд',
    poison: 'яд'
};

export function getDamageTypeMultiplier(enemy, type = 'physical') {
    const rawValue = enemy?.damageModifiers?.[type];
    const base = rawValue === undefined || rawValue === null ? 1 : Number(rawValue);
    if (!Number.isFinite(base)) return 1;
    const adaptive = enemy?.adaptiveResistance?.type === type && enemy.adaptiveResistance.turns > 0 ? 0.5 : 1;
    return Math.max(0, Math.min(2.5, base * adaptive));
}

function scalePeriodicDamage(enemy, damage, type) {
    const multiplier = getDamageTypeMultiplier(enemy, type);
    if (multiplier === 0) return 0;
    return Math.max(1, Math.floor(damage * multiplier));
}

export function calculateDamage(attack, defense, variance = 0, multiplier = 1) {
    const base = Math.max(0, Number(attack) || 0);
    const resistance = Math.max(0, Number(defense) || 0);
    const spread = Math.max(0, Math.floor(Number(variance) || 0));
    return Math.max(1, Math.floor(base * multiplier - resistance + spread));
}

export function calculateTypedDamage(attack, defense, variance = 0, multiplier = 1, enemy = null, type = 'physical') {
    const baseDamage = calculateDamage(attack, defense, variance, multiplier);
    const affinity = getDamageTypeMultiplier(enemy, type);
    if (affinity === 0) return 0;
    return Math.max(1, Math.floor(baseDamage * affinity));
}

export function getWeaponDamageType(player) {
    return getItem(player?.equipment?.weapon)?.damageType || 'physical';
}

// Bosses and elite tacticians study repeated damage types. Two consecutive
// successful hits are enough to trigger one visible adaptation turn.
export function recordEnemyDamageType(enemy, type, damage) {
    const canAdapt = enemy?.behavior === 'boss' || enemy?.behavior === 'mini_boss' ||
        enemy?.eliteAffix === 'tactician';
    if (!canAdapt || !DAMAGE_TYPE_LABELS[type] || !(damage > 0)) return false;

    if (enemy.lastDamageType === type) enemy.damageTypeStreak = (enemy.damageTypeStreak || 1) + 1;
    else {
        enemy.lastDamageType = type;
        enemy.damageTypeStreak = 1;
    }

    if (enemy.damageTypeStreak < 2 || enemy.pendingAdaptation === type ||
        enemy.adaptiveResistance?.type === type) return false;
    enemy.pendingAdaptation = type;
    return true;
}

export function getDamageFeedback(enemy, type = 'physical') {
    const multiplier = getDamageTypeMultiplier(enemy, type);
    const label = DAMAGE_TYPE_LABELS[type] || DAMAGE_TYPE_LABELS.physical;
    if (multiplier > 1) return 'Уязвимость: +' + Math.round((multiplier - 1) * 100) + '% к урону (' + label + ')';
    if (multiplier < 1) return 'Сопротивление: −' + Math.round((1 - multiplier) * 100) + '% к урону (' + label + ')';
    return '';
}

export function getEnemyDamageProfile(enemy) {
    const profile = { weaknesses: [], resistances: [] };
    const types = new Set(Object.keys(enemy?.damageModifiers || {}));
    if (enemy?.adaptiveResistance?.turns > 0) types.add(enemy.adaptiveResistance.type);
    for (const type of types) {
        const multiplier = getDamageTypeMultiplier(enemy, type);
        if (multiplier === 1) continue;
        const label = DAMAGE_TYPE_LABELS[type] || type;
        const percent = Math.round(Math.abs(multiplier - 1) * 100);
        if (multiplier > 1) profile.weaknesses.push({ type, label, multiplier, percent });
        else profile.resistances.push({ type, label, multiplier, percent });
    }
    return profile;
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
    const element = skill.element || 'physical';
    // Utility abilities can deliberately skip direct damage. Elemental skills
    // use the same affinity table as enchanted weapons and damage-over-time.
    if (skill.damageMultiplier || skill.hits || skill.poison) {
        for (let hit = 0; hit < hits; hit++) {
            damage += applyDamage(enemy, calculateTypedDamage(
                getEffectiveCombatStats(player).attack, enemy.defense, 0, multiplier, enemy, element
            ));
        }
    }
    // Ice striking a burning target causes a one-off thermal shock. It consumes
    // the remaining burn, and cannot trigger when the target resists freezing.
    const frozen = skill.freeze ? applyStatusEffect(enemy, 'freeze', 1) : false;
    const thermalShock = frozen && enemy.effects?.burnTurns > 0 && enemy.health > 0;
    const thermalShockBase = thermalShock
        ? Math.max(1, Math.min(30, Math.floor(enemy.maxHealth * 0.08))) : 0;
    const thermalShockDamage = thermalShock
        ? Math.min(enemy.health, Math.min(30, scalePeriodicDamage(enemy, thermalShockBase, 'ice'))) : 0;
    if (thermalShock) {
        enemy.effects.burnTurns = 0;
        damage += applyDamage(enemy, thermalShockDamage);
    }
    if (skill.poison) applyStatusEffect(enemy, 'poison', 3);
    if (skill.burn) applyStatusEffect(enemy, 'burn', 2);
    if (skill.bleed) applyStatusEffect(enemy, 'bleed', 2);
    if (skill.weaken) applyStatusEffect(enemy, 'weaken', 2);
    recordEnemyDamageType(enemy, element, damage);
    // Legendary skills ignite surviving enemies. The same resistance rules
    // used by ordinary burns apply, including complete immunity.
    const phoenixBurn = damage > 0 && enemy.health > 0 && hasActiveRelic(player, 'phoenix_crown')
        ? applyStatusEffect(enemy, 'burn', 2) : false;
    return {
        damage, hits, element, elementMultiplier: getDamageTypeMultiplier(enemy, element),
        guardReduction: skill.defenseBonus ? 0.75 : 0, phoenixBurn, thermalShockDamage
    };
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
    // Poison spreads through open wounds. The bonus is applied once per tick,
    // only while both effects are active, with a strict damage cap.
    const exposed = effects.poisonTurns > 0 && effects.bleedTurns > 0;
    if (effects.poisonTurns > 0) {
        const base = Math.max(1, Math.floor(enemy.maxHealth * 0.05));
        poisonDamage = applyDamage(enemy, scalePeriodicDamage(enemy, base, 'poison'));
        effects.poisonTurns--;
    }
    if (effects.burnTurns > 0) {
        const base = Math.max(1, Math.floor(enemy.maxHealth * 0.04));
        burnDamage = applyDamage(enemy, scalePeriodicDamage(enemy, base, 'fire'));
        effects.burnTurns--;
    }
    if (effects.bleedTurns > 0) {
        const base = Math.max(1, Math.floor(enemy.maxHealth * 0.03));
        bleedDamage = applyDamage(enemy, scalePeriodicDamage(enemy, base, 'physical'));
        effects.bleedTurns--;
    }
    const woundPoisonBase = Math.max(1, Math.min(12, Math.floor(enemy.maxHealth * 0.02)));
    const woundPoisonDamage = exposed && enemy.health > 0
        ? applyDamage(enemy, Math.min(enemy.health, scalePeriodicDamage(enemy, woundPoisonBase, 'poison'))) : 0;
    const frozen = effects.freezeTurns > 0;
    if (frozen) effects.freezeTurns--;
    if (enemy.adaptiveResistance?.turns > 0) {
        enemy.adaptiveResistance.turns--;
        if (enemy.adaptiveResistance.turns === 0) enemy.adaptiveResistance = null;
    }
    return { poisonDamage, burnDamage, bleedDamage, woundPoisonDamage, frozen };
}

function getCombatRatio(current, maximum, fallback = 1) {
    const value = Number(current);
    const limit = Number(maximum);
    if (!Number.isFinite(value)) return fallback;
    if (!Number.isFinite(limit) || limit <= 0) return fallback;
    return Math.max(0, Math.min(1, value / limit));
}

function getEnemyCleanseTarget(enemy) {
    const effects = enemy?.effects || {};
    // Damage-over-time is removed first; weakening is less urgent.
    return ['burnTurns', 'poisonTurns', 'bleedTurns', 'weakenTurns']
        .find(key => Number(effects[key]) > 0) || null;
}

// Deterministic with an injected roll, so tactics are reproducible in tests.
export function chooseEnemyAction(enemy, player, roll = Math.random()) {
    const behavior = enemy.behavior || (enemy.id === 'dragon' ? 'boss' : 'standard');
    const healthRatio = getCombatRatio(enemy.health, enemy.maxHealth);
    const playerHealthRatio = getCombatRatio(player?.health, player?.maxHealth);
    const playerManaRatio = getCombatRatio(player?.mana, player?.maxMana, player?.mana > 0 ? 1 : 0);
    // Recognize equipped armor instead of guessing protection from class alone.
    const armorBonus = getItem(player?.equipment?.armor)?.defenseBonus || 0;

    if (behavior === 'mini_boss') {
        const signatures = {
            goblin_king: 'ambush', mountain_giant: 'crush',
            death_knight: 'siphon', ancient_dragon: 'flame_breath'
        };
        // The giant is more likely to use its armor-piercing crush on heavily armored heroes.
        const signatureChance = enemy.id === 'mountain_giant' && armorBonus >= 15 ? 0.6 : 0.4;
        return roll < signatureChance ? (signatures[enemy.id] || 'heavy') : roll < 0.65 ? 'heavy' : 'attack';
    }
    if (behavior === 'boss') {
        if (playerManaRatio >= 0.5 && roll < 0.4) return 'mana_burn';
        return roll < 0.4 ? 'heavy' : roll < 0.7 ? 'mana_burn' : 'attack';
    }
    if (behavior === 'resilient') {
        if (getEnemyCleanseTarget(enemy) && roll < 0.7) return 'cleanse';
        if (healthRatio < 0.45 && roll < 0.5) return 'recover';
    }
    if (behavior === 'opportunist') {
        // Goblins prioritize mana disruption against mages while leaving exhausted targets alone.
        if (playerManaRatio >= (player?.class === 'mage' ? 0.25 : 0.4) &&
            roll < (player?.class === 'mage' ? 0.6 : 0.45)) return 'mana_burn';
        if (playerHealthRatio <= 0.35 && roll < 0.2) return 'heavy';
    }
    if (behavior === 'aggressive') {
        // Agile but lightly armored archers are exposed to earlier pounces.
        if (player?.class === 'archer' && armorBonus < 13 && playerHealthRatio <= 0.65 && roll < 0.45) return 'pounce';
        if (playerHealthRatio <= 0.4 && roll < 0.6) return 'pounce';
        if (roll < 0.35) return 'heavy';
    }
    return 'attack';
}

export function getBossPhase(enemy) {
    const ratio = enemy.maxHealth > 0 ? enemy.health / enemy.maxHealth : 1;
    return ratio <= 0.25 ? 3 : ratio <= 0.6 ? 2 : 1;
}

export function interruptEnemyWindup(enemy) {
    if (!enemy?.intent) return false;
    enemy.intent = null;
    return true;
}

// A dangerous boss attack is announced one turn in advance. Keeping the intent
// on the enemy prevents the next decision from silently replacing the warning.
export function planEnemyTurn(enemy, player, roll = Math.random()) {
    if (enemy.pendingAdaptation) {
        // Adapting replaces a pending special move; never leave a stale wind-up.
        enemy.intent = null;
        return { action: 'adapt', warned: false, phaseChanged: false, adaptedType: enemy.pendingAdaptation };
    }
    if (enemy.behavior === 'mini_boss') {
        if (enemy.intent) {
            const action = enemy.intent;
            enemy.intent = null;
            // A signature move starts a short, recognizable combo. Only the
            // signature starts a combo, so follow-ups never loop indefinitely.
            const nextMove = {
                goblin_king: { ambush: 'mana_burn' },
                mountain_giant: { crush: 'recover' },
                death_knight: { siphon: 'heavy' },
                ancient_dragon: { flame_breath: 'heavy' }
            }[enemy.id]?.[action];
            if (nextMove) enemy.followUp = nextMove;
            return { action, warned: false, phaseChanged: false };
        }
        const action = enemy.followUp || chooseEnemyAction(enemy, player, roll);
        enemy.followUp = null;
        if (['ambush', 'crush', 'siphon', 'flame_breath', 'heavy', 'mana_burn'].includes(action)) {
            enemy.intent = action;
            return { action: null, warned: true, phaseChanged: false };
        }
        return { action, warned: false, phaseChanged: false };
    }
    if (enemy.behavior !== 'boss') {
        if (enemy.intent) {
            const action = enemy.intent;
            enemy.intent = null;
            return { action, warned: false, phaseChanged: false };
        }
        const action = chooseEnemyAction(enemy, player, roll);
        if (['pounce', 'heavy', 'mana_burn'].includes(action)) {
            enemy.intent = action;
            return { action: null, warned: true, phaseChanged: false };
        }
        return { action, warned: false, phaseChanged: false };
    }
    const phase = getBossPhase(enemy);
    const phaseChanged = enemy.phase !== undefined && phase !== enemy.phase;
    enemy.phase = phase;
    if (phaseChanged) enemy.intent = null;

    if (['heavy', 'siphon', 'cataclysm', 'thorn_burst', 'flame_breath'].includes(enemy.intent)) {
        const action = enemy.intent;
        enemy.intent = null;
        return { action, warned: false, phaseChanged, phase };
    }

    // Later phases introduce signature attacks instead of only scaling damage.
    const heavyChance = phase === 3 ? 0.45 : phase === 2 ? 0.5 : 0.35;
    const signatureChance = phase === 3 ? 0.2 : phase === 2 ? 0.15 : 0;
    if (roll < heavyChance) {
        enemy.intent = 'heavy';
        return { action: null, warned: true, phaseChanged, phase };
    }
    if (signatureChance && roll < heavyChance + signatureChance) {
        // Each location boss has its own signature, not the same spell on every map.
        const signatures = {
            forest_guardian: 'thorn_burst', mountain_dragon: 'flame_breath',
            lich_king: 'siphon', world_eater: 'cataclysm'
        };
        enemy.intent = signatures[enemy.id] || (phase === 3 ? 'cataclysm' : 'siphon');
        return { action: null, warned: true, phaseChanged, phase };
    }
    return { action: roll < 0.8 ? 'mana_burn' : 'attack', warned: false, phaseChanged, phase };
}

export function applyEnemyAction(enemy, player, action, variance = 0, reduction = 0, reactionRoll = Math.random()) {
    if (action === 'cleanse') {
        const key = getEnemyCleanseTarget(enemy);
        if (!key) return { damage: 0, healed: 0, manaBurned: 0, reflected: 0, cleansed: null };
        enemy.effects[key] = 0;
        return { damage: 0, healed: 0, manaBurned: 0, reflected: 0, cleansed: key.replace('Turns', '') };
    }
    if (action === 'adapt') {
        const type = enemy.pendingAdaptation;
        if (!DAMAGE_TYPE_LABELS[type]) return { damage: 0, healed: 0, manaBurned: 0, reflected: 0 };
        enemy.adaptiveResistance = { type, turns: 2 };
        enemy.pendingAdaptation = null;
        enemy.lastDamageType = null;
        enemy.damageTypeStreak = 0;
        return { damage: 0, healed: 0, manaBurned: 0, reflected: 0, adapted: type };
    }
    if (action === 'recover') {
        const healed = Math.min(enemy.maxHealth - enemy.health, Math.max(1, Math.floor(enemy.maxHealth * 0.15)));
        enemy.health += healed;
        return { damage: 0, healed, manaBurned: 0, reflected: 0 };
    }
    const weakened = enemy.effects?.weakenTurns > 0;
    const enraged = enemy.eliteAffix === 'enraged' && enemy.maxHealth > 0 && enemy.health / enemy.maxHealth <= 0.5;
    const multiplier = (action === 'heavy' ? 1.5 : action === 'pounce' ? 1.4 : action === 'mana_burn' ? 0.85 :
        action === 'ambush' ? 1.25 : action === 'crush' ? 1.2 : action === 'flame_breath' ? 1.15 :
        action === 'cataclysm' ? 1.8 : action === 'thorn_burst' ? 1.3 : 1) *
        (weakened ? 0.75 : 1) * (enraged ? 1.4 : 1);
    if (weakened) enemy.effects.weakenTurns--;
    const runeReduction = hasSpecialization(player, 'mage_warden') ? 0.15 : 0;
    const effectiveReduction = 1 - (1 - Math.min(1, Math.max(0, reduction))) * (1 - runeReduction);
    const effectiveDefense = getEffectiveCombatStats(player).defense * (['crush', 'cataclysm'].includes(action) ? 0.5 : action === 'thorn_burst' ? 0.75 : 1);
    const rawDamage = Math.max(1, Math.floor(calculateDamage(enemy.attack, effectiveDefense, variance, multiplier) * (1 - effectiveReduction)));
    // A single signature attack should be terrifying, but not one-shot a
    // fully healed hero. Ordinary attacks and miniboss moves stay unchanged.
    const storySignature = enemy.behavior === 'boss' &&
        ['thorn_burst', 'flame_breath', 'siphon', 'cataclysm'].includes(action);
    const maxHealth = Number(player?.maxHealth);
    const damage = storySignature && Number.isFinite(maxHealth) && maxHealth > 0
        ? Math.min(rawDamage, Math.max(1, Math.floor(maxHealth * 0.8))) : rawDamage;
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
    // Defensive enchantments react only to an actual damaging hit. Reuse the
    // enemy's normal status resistance rules so bosses are not hard-locked.
    const retaliation = getItem(player?.equipment?.armor)?.onDamaged;
    const armorTriggered = damage > 0 && player.health > 0 && enemy.health > 0 && retaliation &&
        Number.isFinite(reactionRoll) && reactionRoll >= 0 && reactionRoll < retaliation.chance;
    const armorEffect = armorTriggered && retaliation.type === 'freeze' &&
        applyStatusEffect(enemy, retaliation.type, retaliation.turns) ? retaliation.type : null;
    // Bloodhunter armor returns a little HP after surviving a hit; healing is
    // bounded by missing HP, incoming damage and 10% of the HP pool.
    const healthLimit = Number(player.maxHealth);
    const armorHealed = armorTriggered && retaliation.type === 'heal' &&
        Number.isFinite(healthLimit) && healthLimit > 0
        ? Math.max(0, Math.min(healthLimit - player.health,
            Math.max(1, Math.floor(damage * retaliation.fraction)),
            Math.max(1, Math.floor(healthLimit * 0.1)))) : 0;
    if (armorHealed) player.health += armorHealed;
    return { damage, healed: 0, manaBurned, reflected, lifeStolen, soulDrain, enraged, armorEffect, armorHealed };
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
