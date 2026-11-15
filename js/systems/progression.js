// Pure experience progression used by all XP reward sources.
export function applyExperience(player, amount = 0) {
    if (!Number.isFinite(amount) || amount < 0) return 0;
    player.experience += Math.floor(amount);
    let gainedLevels = 0;
    while (player.experience >= player.maxExperience && player.maxExperience > 0) {
        player.experience -= player.maxExperience;
        player.level++;
        player.maxExperience = Math.floor(player.maxExperience * 1.5);
        player.maxHealth += 20;
        player.maxMana += 10;
        player.attack += 5;
        player.defense += 3;
        gainedLevels++;
    }
    if (gainedLevels) {
        player.health = player.maxHealth;
        player.mana = player.maxMana;
    }
    return gainedLevels;
}
