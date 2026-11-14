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
