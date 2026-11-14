// Pure combat rules: shared by battles and automated regression tests.
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
    const multiplier = skill.damageMultiplier ?? 1;
    let damage = 0;
    // Utility abilities can deliberately skip direct damage.
    if (skill.damageMultiplier || skill.hits || skill.poison) {
        for (let hit = 0; hit < hits; hit++) {
            damage += applyDamage(enemy, calculateDamage(player.attack, enemy.defense, 0, multiplier));
        }
    }
    enemy.effects ||= {};
    if (skill.freeze) enemy.effects.freezeTurns = 1;
    if (skill.poison) enemy.effects.poisonTurns = 3;
    return { damage, hits, guardReduction: skill.defenseBonus ? 0.75 : 0 };
}

export function tickEnemyEffects(enemy) {
    const effects = enemy.effects || {};
    let poisonDamage = 0;
    if (effects.poisonTurns > 0) {
        poisonDamage = applyDamage(enemy, Math.max(1, Math.floor(enemy.maxHealth * 0.05)));
        effects.poisonTurns--;
    }
    const frozen = effects.freezeTurns > 0;
    if (frozen) effects.freezeTurns--;
    return { poisonDamage, frozen };
}

// Deterministic with an injected roll, so tactics are reproducible in tests.
export function chooseEnemyAction(enemy, player, roll = Math.random()) {
    const behavior = enemy.behavior || (enemy.id === 'dragon' ? 'boss' : 'standard');
    const healthRatio = enemy.maxHealth > 0 ? enemy.health / enemy.maxHealth : 1;
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
        return { damage: 0, healed, manaBurned: 0 };
    }
    const multiplier = action === 'heavy' ? 1.5 : action === 'mana_burn' ? 0.85 : 1;
    const damage = Math.max(1, Math.floor(calculateDamage(enemy.attack, player.defense, variance, multiplier) * (1 - reduction)));
    applyDamage(player, damage);
    const manaBurned = action === 'mana_burn' ? Math.min(player.mana, Math.max(1, Math.floor(enemy.attack / 3))) : 0;
    player.mana -= manaBurned;
    return { damage, healed: 0, manaBurned };
}
