import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../js/core/state.js';
import { ITEMS, getItem } from '../js/data/items.js';
import { useInventoryItem, unequipItem } from '../js/ui/inventory.js';
import { escapeHtml } from '../js/core/html.js';
import { calculateDamage, calculateTypedDamage, getDamageTypeMultiplier, getDamageFeedback, getEnemyDamageProfile, getWeaponDamageType, applyDamage, consumeHealingPotion, useSkillEffect, tickEnemyEffects, chooseEnemyAction, applyEnemyAction, getBossPhase, planEnemyTurn, applyStatusEffect, triggerWeaponEffect, getEquipmentSetBonuses, getEffectiveCombatStats, getCriticalMultiplier, triggerRangerEffect, tryPhoenixRebirth, getEnemyTacticHint, interruptEnemyWindup, getClassTacticalBonus, consumeWarriorOpening, recordEnemyDamageType } from '../js/systems/combat.js';
import { CLASSES } from '../js/data/classes.js';
import { getBattleState, updateBattleUI, battleVictory, exitBattle } from '../js/ui/battle.js';
import { getLocation } from '../js/data/locations.js';
import { completeLocation, getLocationState, resetLocationState, startStageBattle, chooseSecretRoom, chooseAdventureEvent, chooseDungeonRoute } from '../js/systems/dungeon.js';
import { applyExperience } from '../js/systems/progression.js';
import { levelUp } from '../js/ui/character.js';
import { grantItem, rollLoot } from '../js/systems/loot.js';
import { buyItem } from '../js/ui/shop.js';
import { getTalentPoints, getTalentAvailability, unlockTalent, getTalentBonuses } from '../js/systems/talents.js';
import { rollAdventureEvent, resolveAdventureEvent } from '../js/systems/adventureEvents.js';
import { getRoute, applyRouteToEnemy } from '../js/systems/dungeonRoutes.js';
import { RELICS, RELIC_RARITIES, MAX_ACTIVE_RELICS, awardRelic, toggleRelic, getRelicBonuses, getActiveRelicSynergies, hasActiveRelic } from '../js/systems/relics.js';
import { SECRET_ROOMS, rollSecretRoom, resolveSecretRoom } from '../js/systems/secretRooms.js';

globalThis.localStorage = {
    data: new Map(),
    setItem(key, value) { this.data.set(key, value); },
    getItem(key) { return this.data.get(key) ?? null; },
    removeItem(key) { this.data.delete(key); }
};
globalThis.document = { getElementById: () => ({ innerHTML: '' }) };
globalThis.window = { showNotification() {} };

test('unknown character classes are rejected', () => {
    assert.equal(gameState.createPlayer('unknown'), null);
});

test('equipping the same weapon twice does not stack stats', () => {
    const player = gameState.createPlayer('warrior');
    player.level = 2;
    const weapon = Object.values(ITEMS).find(item => item.type === 'weapon');
    player.inventory.push({ id: weapon.id, quantity: 1 });
    const index = player.inventory.length - 1;
    const initial = player.attack;
    useInventoryItem(index);
    useInventoryItem(index);
    assert.equal(player.attack, initial + (getItem(weapon.id).attackBonus || 0));
    unequipItem('weapon');
    assert.equal(player.attack, initial);
});

test('unused potion is preserved at full health', () => {
    const player = gameState.createPlayer('warrior');
    const item = player.inventory[0];
    const before = item.quantity;
    useInventoryItem(0);
    assert.equal(item.quantity, before);
    player.health -= 10;
    useInventoryItem(0);
    assert.equal(item.quantity, before - 1);
});

test('invalid save does not replace active game state', () => {
    const player = gameState.createPlayer('warrior');
    localStorage.setItem('rpg_adventure_save', JSON.stringify({ player: { class: 'hacker' } }));
    assert.equal(gameState.load(), false);
    assert.equal(gameState.player, player);
});

test('profile names are escaped for HTML', () => {
    assert.equal(escapeHtml('<img src=x onerror="boom">'), '&lt;img src=x onerror=&quot;boom&quot;&gt;');
});

test('combat damage respects defense, critical multiplier and minimum damage', () => {
    assert.equal(calculateDamage(10, 100), 1);
    assert.equal(calculateDamage(20, 5, 3), 18);
    assert.equal(calculateDamage(20, 5, 0, 2), 35);
    const enemy = { health: 10 };
    applyDamage(enemy, 100);
    assert.equal(enemy.health, 0);
});

test('elemental affinities scale direct damage and expose readable weakness profiles', () => {
    const target = { health: 200, maxHealth: 200, defense: 0, damageModifiers: { fire: 1.4, poison: 0.5, physical: 0.85 } };
    assert.equal(getDamageTypeMultiplier(target, 'fire'), 1.4);
    assert.equal(getDamageTypeMultiplier(target, 'ice'), 1);
    assert.equal(calculateTypedDamage(20, 0, 0, 1, target, 'fire'), 28);
    assert.equal(calculateTypedDamage(20, 0, 0, 1, target, 'poison'), 10);
    assert.equal(calculateTypedDamage(20, 0, 0, 1, target, 'physical'), 17);
    assert.equal(calculateTypedDamage(20, 0, 0, 1, { damageModifiers: { fire: 0 } }, 'fire'), 0);
    assert.match(getDamageFeedback(target, 'fire'), /Уязвимость: \+40%/);
    assert.match(getDamageFeedback(target, 'poison'), /Сопротивление: −50%/);
    const profile = getEnemyDamageProfile(target);
    assert.deepEqual(profile.weaknesses.map(entry => entry.type), ['fire']);
    assert.deepEqual(profile.resistances.map(entry => entry.type), ['poison', 'physical']);
});

test('elemental affinities scale direct damage and damage-over-time for class skills', () => {
    const mage = gameState.createPlayer('mage');
    const skeleton = { health: 200, maxHealth: 200, defense: 0, resistances: { burn: 0 }, damageModifiers: { fire: 1.4, poison: 0.5 } };
    const fire = useSkillEffect(mage, skeleton, CLASSES.mage.skills[0]);
    assert.equal(fire.element, 'fire');
    assert.equal(fire.damage, 70);
    assert.equal(tickEnemyEffects(skeleton).burnDamage, 11);

    const archer = gameState.createPlayer('archer');
    const resistant = { health: 200, maxHealth: 200, defense: 0, damageModifiers: { poison: 0.5 } };
    const poison = useSkillEffect(archer, resistant, CLASSES.archer.skills[1]);
    assert.equal(poison.element, 'poison');
    assert.equal(poison.damage, 3);
    assert.equal(tickEnemyEffects(resistant).poisonDamage, 5);
});

test('frost nova and thermal shock use ice affinity without bypassing freeze immunity', () => {
    const mage = gameState.createPlayer('mage');
    const vulnerable = {
        health: 200, maxHealth: 200, defense: 0,
        effects: { burnTurns: 2 },
        damageModifiers: { ice: 1.25 }
    };
    const combo = useSkillEffect(mage, vulnerable, CLASSES.mage.skills[1]);
    assert.equal(combo.element, 'ice');
    assert.equal(combo.thermalShockDamage, 20);
    assert.equal(combo.damage, 38);

    const dragon = {
        health: 200, maxHealth: 200, defense: 0,
        effects: { burnTurns: 2 },
        resistances: { freeze: 1 },
        damageModifiers: { ice: 1.25 }
    };
    const result = useSkillEffect(mage, dragon, CLASSES.mage.skills[1]);
    assert.equal(result.damage, 18);
    assert.equal(result.thermalShockDamage, 0);
    assert.equal(dragon.effects?.freezeTurns, undefined);
    assert.equal(dragon.effects.burnTurns, 2);
});

test('complete elemental immunity also blocks matching damage-over-time ticks', () => {
    const immune = { health: 100, maxHealth: 100, damageModifiers: { fire: 0 }, effects: { burnTurns: 2 } };
    assert.equal(tickEnemyEffects(immune).burnDamage, 0);
    assert.equal(immune.health, 100);
});

test('enchanted weapons use their element for basic attacks', () => {
    const player = gameState.createPlayer('warrior');
    player.equipment.weapon = 'ember_sword';
    assert.equal(getWeaponDamageType(player), 'fire');
    player.equipment.weapon = 'frost_blade';
    assert.equal(getWeaponDamageType(player), 'ice');
    player.equipment.weapon = null;
    assert.equal(getWeaponDamageType(player), 'physical');
});

test('combat potion only consumes a charge when health is missing', () => {
    const player = gameState.createPlayer('warrior');
    const potion = player.inventory[0];
    const potionData = getItem(potion.id);
    assert.equal(consumeHealingPotion(player, potion, potionData), 0);
    assert.equal(potion.quantity, 3);
    player.health -= 20;
    assert.equal(consumeHealingPotion(player, potion, potionData), 20);
    assert.equal(player.health, player.maxHealth);
    assert.equal(potion.quantity, 2);
});

test('archer rapid shot hits twice', () => {
    const player = gameState.createPlayer('archer');
    const enemy = { health: 100, maxHealth: 100, defense: 2 };
    const result = useSkillEffect(player, enemy, CLASSES.archer.skills[0]);
    assert.equal(result.hits, 2);
    assert.equal(enemy.health, 100 - result.damage);
    assert.ok(result.damage > 0);
});

test('mage frost makes enemy skip exactly one turn', () => {
    const player = gameState.createPlayer('mage');
    const enemy = { health: 100, maxHealth: 100, defense: 2 };
    useSkillEffect(player, enemy, CLASSES.mage.skills[1]);
    assert.equal(tickEnemyEffects(enemy).frozen, true);
    assert.equal(tickEnemyEffects(enemy).frozen, false);
});

test('fire followed by frost causes capped thermal shock and consumes burn', () => {
    const mage = gameState.createPlayer('mage');
    const enemy = { health: 200, maxHealth: 200, defense: 3 };
    useSkillEffect(mage, enemy, CLASSES.mage.skills[0]);
    assert.equal(enemy.effects.burnTurns, 2);
    const before = enemy.health;
    const result = useSkillEffect(mage, enemy, CLASSES.mage.skills[1]);
    assert.equal(result.thermalShockDamage, 16);
    assert.equal(result.damage, 28);
    assert.equal(enemy.health, before - result.damage);
    assert.equal(enemy.effects.burnTurns, 0);
    assert.equal(tickEnemyEffects(enemy).frozen, true);
    assert.equal(useSkillEffect(mage, enemy, CLASSES.mage.skills[1]).thermalShockDamage, 0);
});

test('thermal shock respects freeze immunity and never overkills or exceeds cap', () => {
    const mage = gameState.createPlayer('mage');
    const immune = { health: 100, maxHealth: 100, defense: 0, effects: { burnTurns: 2 }, resistances: { freeze: 1 } };
    assert.equal(useSkillEffect(mage, immune, CLASSES.mage.skills[1]).thermalShockDamage, 0);
    assert.equal(immune.effects.burnTurns, 2);
    const large = { health: 25, maxHealth: 1000, defense: 0, effects: { burnTurns: 2 } };
    assert.equal(useSkillEffect(mage, large, CLASSES.mage.skills[1]).thermalShockDamage, 10);
    assert.equal(large.health, 0);
});

test('poison deals damage for three turns and then expires', () => {
    const player = gameState.createPlayer('archer');
    const enemy = { health: 100, maxHealth: 100, defense: 2 };
    useSkillEffect(player, enemy, CLASSES.archer.skills[1]);
    assert.equal(tickEnemyEffects(enemy).poisonDamage, 5);
    assert.equal(tickEnemyEffects(enemy).poisonDamage, 5);
    assert.equal(tickEnemyEffects(enemy).poisonDamage, 5);
    assert.equal(tickEnemyEffects(enemy).poisonDamage, 0);
});

test('poison and bleeding together trigger bounded wound poison on each shared turn', () => {
    const enemy = { health: 200, maxHealth: 200, effects: { poisonTurns: 3, bleedTurns: 2 } };
    const first = tickEnemyEffects(enemy);
    assert.equal(first.woundPoisonDamage, 4);
    assert.equal(first.poisonDamage, 10);
    assert.equal(first.bleedDamage, 6);
    assert.equal(tickEnemyEffects(enemy).woundPoisonDamage, 4);
    assert.equal(tickEnemyEffects(enemy).woundPoisonDamage, 0);
});

test('wound poison needs both statuses and cannot exceed remaining health or cap', () => {
    assert.equal(tickEnemyEffects({ health: 100, maxHealth: 100, effects: { poisonTurns: 2 } }).woundPoisonDamage, 0);
    const immune = { health: 100, maxHealth: 100, resistances: { bleed: 1 }, effects: { poisonTurns: 2 } };
    assert.equal(applyStatusEffect(immune, 'bleed', 2), false);
    assert.equal(tickEnemyEffects(immune).woundPoisonDamage, 0);
    const large = { health: 1000, maxHealth: 1000, effects: { poisonTurns: 1, bleedTurns: 1 } };
    assert.equal(tickEnemyEffects(large).woundPoisonDamage, 12);
    const dying = { health: 1, maxHealth: 1000, effects: { poisonTurns: 1, bleedTurns: 1 } };
    assert.equal(tickEnemyEffects(dying).woundPoisonDamage, 0);
    assert.equal(dying.health, 0);
});

test('warrior shield skill grants damage reduction without direct damage', () => {
    const player = gameState.createPlayer('warrior');
    const enemy = { health: 100, maxHealth: 100, defense: 2 };
    const result = useSkillEffect(player, enemy, CLASSES.warrior.skills[1]);
    assert.equal(enemy.health, 100);
    assert.equal(result.guardReduction, 0.75);
});

test('warrior consumes weakening to empower one basic attack', () => {
    const warrior = gameState.createPlayer('warrior');
    const enemy = { health: 200, maxHealth: 200, defense: 2 };
    useSkillEffect(warrior, enemy, CLASSES.warrior.skills[0]);
    assert.equal(enemy.effects.weakenTurns, 2);
    assert.equal(consumeWarriorOpening(warrior, enemy), true);
    assert.equal(enemy.effects.weakenTurns, 1);
    assert.ok(calculateDamage(20, 2, 0, 1.25) > calculateDamage(20, 2));
    assert.equal(consumeWarriorOpening(warrior, enemy), true);
    assert.equal(consumeWarriorOpening(warrior, enemy), false);
});

test('warrior opening cannot be spent by other classes or on defeated targets', () => {
    const enemy = { health: 20, effects: { weakenTurns: 2 } };
    assert.equal(consumeWarriorOpening({ class: 'mage' }, enemy), false);
    assert.equal(enemy.effects.weakenTurns, 2);
    enemy.health = 0;
    assert.equal(consumeWarriorOpening({ class: 'warrior' }, enemy), false);
    assert.equal(enemy.effects.weakenTurns, 2);
});

test('different enemy archetypes choose distinct tactics', () => {
    const player = { mana: 30 };
    assert.equal(chooseEnemyAction({ behavior: 'aggressive', health: 20, maxHealth: 30 }, player, 0.1), 'heavy');
    assert.equal(chooseEnemyAction({ behavior: 'opportunist', health: 30, maxHealth: 30 }, player, 0.1), 'mana_burn');
    assert.equal(chooseEnemyAction({ behavior: 'resilient', health: 20, maxHealth: 100 }, player, 0.1), 'recover');
    assert.equal(chooseEnemyAction({ behavior: 'boss', health: 100, maxHealth: 100 }, player, 0.5), 'mana_burn');
});

test('bosses and tactician elites adapt after two consecutive successful hits of one damage type', () => {
    const boss = { behavior: 'boss', health: 100, maxHealth: 100, damageModifiers: { fire: 1.2 } };
    assert.equal(recordEnemyDamageType(boss, 'fire', 20), false);
    assert.equal(recordEnemyDamageType(boss, 'fire', 20), true);
    assert.equal(boss.pendingAdaptation, 'fire');
    assert.match(getEnemyTacticHint(boss), /адаптироваться/);
    const plan = planEnemyTurn(boss, { mana: 20 }, 0.99);
    assert.equal(plan.action, 'adapt');
    const adapted = applyEnemyAction(boss, { health: 100, mana: 20 }, plan.action);
    assert.equal(adapted.adapted, 'fire');
    assert.equal(boss.adaptiveResistance.turns, 2);
    assert.equal(calculateTypedDamage(20, 0, 0, 1, boss, 'fire'), 12);
    assert.equal(calculateTypedDamage(20, 0, 0, 1, boss, 'ice'), 20);
    assert.match(getDamageFeedback(boss, 'fire'), /Сопротивление: −40%/);
    assert.match(getEnemyDamageProfile(boss).resistances.map(item => item.type).join(','), /fire/);
    tickEnemyEffects(boss);
    assert.equal(boss.adaptiveResistance.turns, 1);
    tickEnemyEffects(boss);
    assert.equal(boss.adaptiveResistance, null);
    assert.equal(calculateTypedDamage(20, 0, 0, 1, boss, 'fire'), 24);

    const elite = { eliteAffix: 'tactician', health: 50, maxHealth: 50 };
    assert.equal(recordEnemyDamageType(elite, 'poison', 5), false);
    assert.equal(recordEnemyDamageType(elite, 'poison', 5), true);
    const ordinary = { behavior: 'standard', health: 50, maxHealth: 50 };
    assert.equal(recordEnemyDamageType(ordinary, 'ice', 5), false);
    assert.equal(ordinary.pendingAdaptation, undefined);
});

test('changing damage type resets an adaptation streak', () => {
    const boss = { behavior: 'boss', health: 100, maxHealth: 100 };
    assert.equal(recordEnemyDamageType(boss, 'fire', 10), false);
    assert.equal(recordEnemyDamageType(boss, 'ice', 10), false);
    assert.equal(recordEnemyDamageType(boss, 'fire', 10), false);
    assert.equal(boss.damageTypeStreak, 1);
    assert.equal(boss.pendingAdaptation, undefined);
});

test('recovery cannot exceed max health', () => {
    const enemy = { health: 98, maxHealth: 100, attack: 10 };
    const result = applyEnemyAction(enemy, { health: 50, mana: 10 }, 'recover');
    assert.equal(result.healed, 2);
    assert.equal(enemy.health, 100);
});

test('enemy mana drain and guard reduction respect player resources', () => {
    const enemy = { attack: 30 };
    const player = { health: 100, mana: 3, defense: 0 };
    const result = applyEnemyAction(enemy, player, 'mana_burn', 0, 0.75);
    assert.equal(result.manaBurned, 3);
    assert.equal(player.mana, 0);
    assert.ok(result.damage < 30);
});

test('boss phase two telegraphs life siphon and phase three telegraphs a defense-breaking cataclysm', () => {
    const boss = { behavior: 'boss', health: 50, maxHealth: 100, attack: 20, defense: 0 };
    const phaseTwo = planEnemyTurn(boss, { mana: 20 }, 0.55);
    assert.equal(phaseTwo.phase, 2);
    assert.equal(phaseTwo.warned, true);
    assert.equal(boss.intent, 'siphon');
    assert.match(getEnemyTacticHint(boss), /похищение/);
    const siphon = planEnemyTurn(boss, { mana: 20 }, 0.99);
    assert.equal(siphon.action, 'siphon');
    const siphonResult = applyEnemyAction(boss, { health: 100, mana: 20, defense: 0 }, 'siphon', 0);
    assert.equal(siphonResult.soulDrain, 6);

    boss.health = 20;
    const phaseThree = planEnemyTurn(boss, { mana: 20 }, 0.55);
    assert.equal(phaseThree.phase, 3);
    assert.equal(phaseThree.warned, true);
    assert.equal(boss.intent, 'cataclysm');
    assert.match(getEnemyTacticHint(boss), /катаклизм/);
    const cataclysm = planEnemyTurn(boss, { mana: 20 }, 0.99);
    assert.equal(cataclysm.action, 'cataclysm');
    const player = { health: 100, mana: 20, defense: 10 };
    const result = applyEnemyAction(boss, player, 'cataclysm', 0);
    assert.equal(result.damage, 31);
    assert.equal(player.health, 69);
});

test('boss phases follow health thresholds', () => {
    const boss = { health: 100, maxHealth: 100 };
    assert.equal(getBossPhase(boss), 1);
    boss.health = 60;
    assert.equal(getBossPhase(boss), 2);
    boss.health = 25;
    assert.equal(getBossPhase(boss), 3);
});

test('boss telegraphs heavy hit before performing it', () => {
    const boss = { behavior: 'boss', health: 100, maxHealth: 100 };
    const player = { mana: 20 };
    const warning = planEnemyTurn(boss, player, 0.1);
    assert.equal(warning.warned, true);
    assert.equal(warning.action, null);
    const attack = planEnemyTurn(boss, player, 0.95);
    assert.equal(attack.warned, false);
    assert.equal(attack.action, 'heavy');
    assert.equal(boss.intent, null);
});

test('miniboss signature attacks are announced before they land', () => {
    const enemy = { id: 'mountain_giant', behavior: 'mini_boss', health: 100, maxHealth: 100 };
    const player = { mana: 10 };
    const warning = planEnemyTurn(enemy, player, 0.1);
    assert.equal(warning.warned, true);
    assert.equal(warning.action, null);
    assert.equal(enemy.intent, 'crush');
    assert.match(getEnemyTacticHint(enemy), /игнорирует броню/);
    const strike = planEnemyTurn(enemy, player, 0.95);
    assert.equal(strike.action, 'crush');
    assert.equal(enemy.intent, null);
});

test('ordinary miniboss attacks do not cause an extra warning turn', () => {
    const enemy = { id: 'mountain_giant', behavior: 'mini_boss', health: 100, maxHealth: 100 };
    const plan = planEnemyTurn(enemy, { mana: 10 }, 0.95);
    assert.equal(plan.action, 'attack');
    assert.equal(plan.warned, false);
});

test('freezing a charging enemy cancels its special attack', () => {
    const enemy = { id: 'ancient_dragon', behavior: 'mini_boss', health: 100, maxHealth: 100 };
    planEnemyTurn(enemy, { mana: 20 }, 0.1);
    assert.equal(enemy.intent, 'flame_breath');
    assert.equal(interruptEnemyWindup(enemy), true);
    assert.equal(interruptEnemyWindup(enemy), false);
    assert.equal(enemy.intent, null);
    assert.equal(planEnemyTurn(enemy, { mana: 20 }, 0.95).action, 'attack');
});

test('warriors can brace and archers can exploit a telegraphed strike', () => {
    const charging = { intent: 'crush' };
    assert.deepEqual(getClassTacticalBonus({ class: 'warrior' }, charging), { attackMultiplier: 1, guardReduction: 0.75 });
    assert.deepEqual(getClassTacticalBonus({ class: 'archer' }, charging), { attackMultiplier: 1.3, guardReduction: 0.5 });
    assert.deepEqual(getClassTacticalBonus({ class: 'mage' }, charging), { attackMultiplier: 1, guardReduction: 0.5 });
    assert.deepEqual(getClassTacticalBonus({ class: 'archer' }, { intent: null }), { attackMultiplier: 1, guardReduction: 0.5 });
    assert.equal(calculateDamage(20, 5, 0, getClassTacticalBonus({ class: 'archer' }, charging).attackMultiplier), 21);
});

test('phase change clears obsolete boss warning', () => {
    const boss = { behavior: 'boss', health: 100, maxHealth: 100 };
    planEnemyTurn(boss, { mana: 20 }, 0.1);
    boss.health = 50;
    const next = planEnemyTurn(boss, { mana: 20 }, 0.9);
    assert.equal(next.phaseChanged, true);
    assert.equal(next.action, 'attack');
    assert.equal(boss.intent, null);
});

test('fire and bleeding deal periodic damage and expire', () => {
    const enemy = { health: 100, maxHealth: 100 };
    applyStatusEffect(enemy, 'burn', 2);
    applyStatusEffect(enemy, 'bleed', 2);
    const first = tickEnemyEffects(enemy);
    assert.equal(first.burnDamage, 4);
    assert.equal(first.bleedDamage, 3);
    tickEnemyEffects(enemy);
    const expired = tickEnemyEffects(enemy);
    assert.equal(expired.burnDamage + expired.bleedDamage, 0);
});

test('immunity blocks a condition and resistance shortens duration', () => {
    const enemy = { resistances: { freeze: 1, poison: 0.5 } };
    assert.equal(applyStatusEffect(enemy, 'freeze', 1), false);
    assert.equal(enemy.effects, undefined);
    assert.equal(applyStatusEffect(enemy, 'poison', 3), true);
    assert.equal(enemy.effects.poisonTurns, 2);
});

test('weakening reduces the next two enemy attacks', () => {
    const enemy = { attack: 20, effects: { weakenTurns: 2 } };
    const player = { health: 100, defense: 0, mana: 0 };
    const first = applyEnemyAction(enemy, player, 'attack').damage;
    const second = applyEnemyAction(enemy, player, 'attack').damage;
    const third = applyEnemyAction(enemy, player, 'attack').damage;
    assert.equal(first, 15);
    assert.equal(second, 15);
    assert.equal(third, 20);
});

test('battle interface shows both class skills and combat resources', () => {
    const player = gameState.createPlayer('mage');
    player.mana = 15;
    const battle = getBattleState();
    battle.currentEnemy = { name: 'Волк', icon: '🐺', health: 20, maxHealth: 30, effects: { burnTurns: 2 }, damageModifiers: { fire: 1.25, ice: 0.8 } };
    battle.turn = 'player';
    const panel = { innerHTML: '' };
    const previous = document.getElementById;
    document.getElementById = () => panel;
    try {
        updateBattleUI();
        assert.match(panel.innerHTML, /Огненный шар/);
        assert.match(panel.innerHTML, /Ледяная нова/);
        assert.match(panel.innerHTML, /Мана: 15/);
        assert.match(panel.innerHTML, /Горение: 2/);
        assert.match(panel.innerHTML, /Здоровье врага/);
        assert.match(panel.innerHTML, /Уязвим: огонь \(\+25%\)/);
        assert.match(panel.innerHTML, /лёд \(−20%\)/);
    } finally {
        document.getElementById = previous;
        battle.currentEnemy = null;
    }
});

test('enemy tactic hints explain dangerous abilities and stay absent for ordinary enemies', () => {
    assert.equal(getEnemyTacticHint(null), '');
    assert.equal(getEnemyTacticHint({ id: 'wolf' }), '');
    assert.match(getEnemyTacticHint({ intent: 'heavy' }), /сокрушительной/);
    assert.match(getEnemyTacticHint({ id: 'mountain_giant', miniBoss: true }), /брони/);
    assert.match(getEnemyTacticHint({ eliteAffix: 'vampiric' }), /здоровье/);
    assert.match(getEnemyTacticHint({ behavior: 'boss' }), /три фазы/);
});

test('battle interface displays turn, enemy tactic and equipped relics', () => {
    const player = gameState.createPlayer('warrior');
    const relicId = Object.keys(RELICS)[0];
    player.relics = [relicId];
    player.activeRelics = [relicId];
    const battle = getBattleState();
    battle.currentEnemy = { id: 'mountain_giant', miniBoss: true, name: 'Великан', icon: '🪨', health: 30, maxHealth: 30 };
    battle.turn = 'player';
    const panel = { innerHTML: '' };
    const previous = document.getElementById;
    document.getElementById = () => panel;
    try {
        updateBattleUI();
        assert.match(panel.innerHTML, /Ваш ход/);
        assert.match(panel.innerHTML, /Горный великан пробивает/);
        assert.match(panel.innerHTML, new RegExp(RELICS[relicId].name));
        battle.turn = 'enemy';
        updateBattleUI();
        assert.match(panel.innerHTML, /Ход противника/);
    } finally {
        document.getElementById = previous;
        battle.currentEnemy = null;
        battle.turn = 'player';
    }
});

test('a completed battle pays rewards only once', () => {
    const player = gameState.createPlayer('warrior');
    const battle = getBattleState();
    battle.isActive = true;
    battle.isBossBattle = false;
    battle.currentEnemy = { health: 0, expReward: 20, goldReward: 10 };
    const previousQuery = document.querySelector;
    const previousLocation = window.getLocationState;
    document.querySelector = () => null;
    window.getLocationState = () => ({ inLocation: true });
    try {
        battleVictory();
        const exp = player.experience;
        const gold = player.gold;
        battleVictory();
        assert.equal(player.stats.wins, 1);
        assert.equal(player.stats.kills, 1);
        assert.equal(player.experience, exp);
        assert.equal(player.gold, gold);
    } finally {
        document.querySelector = previousQuery;
        window.getLocationState = previousLocation;
        battle.currentEnemy = null;
        battle.isActive = false;
    }
});

test('unlocked locations survive saving and loading', () => {
    const player = gameState.createPlayer('warrior');
    player.unlockedLocations.push('mountains');
    gameState.save();
    assert.equal(gameState.load(), true);
    assert.equal(getLocation('mountains').unlocked, true);
    gameState.createPlayer('mage');
    assert.equal(getLocation('mountains').unlocked, false);
});

test('location completion rewards only once and unlocks next area', () => {
    const player = gameState.createPlayer('warrior');
    const location = getLocation('forest');
    const run = getLocationState();
    run.currentLocation = location;
    run.currentStage = location.stages.length - 1;
    run.inLocation = true;
    const startingGold = player.gold;
    const previousTimeout = globalThis.setTimeout;
    globalThis.setTimeout = () => 0;
    try {
        completeLocation();
        completeLocation();
        assert.equal(player.gold, startingGold + location.rewards.gold);
        assert.equal(player.stats.dungeonsCompleted, 1);
        assert.ok(player.unlockedLocations.includes('mountains'));
    } finally {
        globalThis.setTimeout = previousTimeout;
        resetLocationState();
    }
});

test('large experience reward grants all earned levels and preserves remainder', () => {
    const player = gameState.createPlayer('warrior');
    const gained = applyExperience(player, 1000);
    assert.equal(gained, 4);
    assert.equal(player.level, 5);
    assert.equal(player.experience, 188);
    assert.equal(player.maxExperience, 505);
    assert.equal(player.health, player.maxHealth);
    assert.equal(player.attack, 35);
});

test('levelUp entry point handles existing XP without undefined UI helpers', () => {
    const player = gameState.createPlayer('mage');
    player.experience = 260;
    assert.doesNotThrow(() => levelUp());
    assert.equal(player.level, 3);
    assert.equal(player.experience, 10);
});

test('negative experience reward cannot reduce level or progress', () => {
    const player = gameState.createPlayer('archer');
    assert.equal(applyExperience(player, -100), 0);
    assert.equal(player.level, 1);
    assert.equal(player.experience, 0);
});

test('loot drop chances are deterministic and bosses always drop something', () => {
    assert.equal(rollLoot(false, () => 0.5), null);
    assert.equal(rollLoot(false, () => 0.01), 'ember_sword');
    assert.equal(rollLoot(true, () => 0.01), 'dragon_sword');
    assert.equal(rollLoot(true, () => 0.8), 'mana_potion');
    assert.equal(rollLoot(true, () => 0.1), 'moonblade');
    assert.equal(rollLoot(true, () => NaN), null);
});

test('item grants stack safely without allowing unknown items or negative quantities', () => {
    const player = gameState.createPlayer('warrior');
    assert.equal(grantItem(player, 'health_potion', 2), 2);
    assert.equal(player.inventory[0].quantity, 5);
    assert.equal(grantItem(player, 'unknown'), 0);
    assert.equal(grantItem(player, 'health_potion', -2), 0);
    assert.equal(grantItem(player, 'dragon_sword'), 1);
    assert.deepEqual(player.inventory.at(-1), { id: 'dragon_sword', quantity: 1 });
});

test('shop purchases are atomic and never overspend gold', () => {
    const player = gameState.createPlayer('warrior');
    const startingGold = player.gold;
    buyItem('unknown');
    buyItem('dragon_sword');
    assert.equal(player.gold, startingGold);
    buyItem('health_potion');
    assert.equal(player.gold, startingGold - getItem('health_potion').price);
    assert.equal(player.inventory[0].quantity, 4);
});

test('defeated boss grants loot only once', () => {
    const player = gameState.createPlayer('warrior');
    const battle = getBattleState();
    const originalRandom = Math.random;
    const originalQuery = document.querySelector;
    const originalLocation = window.getLocationState;
    Math.random = () => 0.01;
    document.querySelector = () => null;
    window.getLocationState = () => ({ inLocation: true });
    battle.isActive = true;
    battle.isBossBattle = true;
    battle.currentEnemy = { health: 0, expReward: 10, goldReward: 10 };
    try {
        battleVictory();
        battleVictory();
        assert.equal(player.inventory.find(item => item.id === 'dragon_sword')?.quantity, 1);
    } finally {
        Math.random = originalRandom;
        document.querySelector = originalQuery;
        window.getLocationState = originalLocation;
        battle.isActive = false;
        battle.isBossBattle = false;
        battle.currentEnemy = null;
    }
});

test('level-gated equipment does not modify stats until unlocked', () => {
    const player = gameState.createPlayer('warrior');
    grantItem(player, 'guardian_armor');
    const index = player.inventory.findIndex(item => item.id === 'guardian_armor');
    const defense = player.defense;
    useInventoryItem(index);
    assert.equal(player.equipment.armor, null);
    assert.equal(player.defense, defense);
    player.level = 4;
    useInventoryItem(index);
    assert.equal(player.equipment.armor, 'guardian_armor');
    assert.equal(player.defense, defense + 17);
    useInventoryItem(index);
    assert.equal(player.defense, defense + 17);
    unequipItem('armor');
    assert.equal(player.defense, defense);
});

test('inventory rejects zero-quantity and negative-index items', () => {
    const player = gameState.createPlayer('warrior');
    const originalHealth = player.health - 20;
    player.health = originalHealth;
    player.inventory[0].quantity = 0;
    useInventoryItem(0);
    useInventoryItem(-1);
    assert.equal(player.health, originalHealth);
});

test('equipped ember sword applies burn only on a successful proc', () => {
    const player = gameState.createPlayer('warrior');
    player.equipment.weapon = 'ember_sword';
    const enemy = { health: 100, maxHealth: 100 };
    assert.equal(triggerWeaponEffect(player, enemy, 0.29), 'burn');
    assert.equal(enemy.effects.burnTurns, 2);
    assert.equal(triggerWeaponEffect(player, enemy, 0.3), null);
    assert.equal(tickEnemyEffects(enemy).burnDamage, 4);
});

test('frost and bleeding weapon effects respect enemy resistance', () => {
    const player = gameState.createPlayer('mage');
    const enemy = { health: 100, maxHealth: 100, resistances: { freeze: 1, bleed: 0.5 } };
    player.equipment.weapon = 'frost_blade';
    assert.equal(triggerWeaponEffect(player, enemy, 0), null);
    assert.equal(enemy.effects, undefined);
    player.equipment.weapon = 'blood_dagger';
    assert.equal(triggerWeaponEffect(player, enemy, 0.1), 'bleed');
    assert.equal(enemy.effects.bleedTurns, 1);
    enemy.health = 0;
    assert.equal(triggerWeaponEffect(player, enemy, 0), null);
});

test('ordinary weapons and invalid proc rolls never create status effects', () => {
    const player = gameState.createPlayer('archer');
    const enemy = { health: 10, maxHealth: 10 };
    player.equipment.weapon = 'iron_sword';
    assert.equal(triggerWeaponEffect(player, enemy, 0), null);
    player.equipment.weapon = 'ember_sword';
    assert.equal(triggerWeaponEffect(player, enemy, NaN), null);
    assert.equal(triggerWeaponEffect(player, enemy, -1), null);
    assert.equal(enemy.effects, undefined);
});

test('equipment sets activate only with both pieces and do not stack base stats', () => {
    const player = gameState.createPlayer('warrior');
    const initialAttack = player.attack;
    player.equipment.weapon = 'ember_sword';
    assert.equal(getEquipmentSetBonuses(player).attack, 0);
    player.equipment.armor = 'guardian_armor';
    assert.equal(getEquipmentSetBonuses(player).attack, 6);
    assert.equal(getEffectiveCombatStats(player).attack, initialAttack + 6);
    assert.equal(getEffectiveCombatStats(player).attack, initialAttack + 6);
    assert.equal(player.attack, initialAttack);
    player.equipment.armor = null;
    assert.equal(getEffectiveCombatStats(player).attack, initialAttack);
    player.equipment = { weapon: 'frost_blade', armor: 'frost_armor' };
    assert.equal(getEquipmentSetBonuses(player).defense, 7);
    player.equipment = { weapon: 'blood_dagger', armor: 'blood_armor' };
    assert.equal(getEquipmentSetBonuses(player).attack, 4);
    assert.equal(getEquipmentSetBonuses(player).defense, 3);
});

test('class talents require a level, reject duplicates and other classes, and change combat stats', () => {
    const player = gameState.createPlayer('warrior');
    assert.equal(getTalentPoints(player), 0);
    assert.equal(unlockTalent(player, 'warrior_force'), false);
    player.level = 2;
    assert.equal(unlockTalent(player, 'mage_focus'), false);
    assert.equal(unlockTalent(player, 'warrior_force'), true);
    assert.equal(unlockTalent(player, 'warrior_force'), false);
    assert.equal(getTalentPoints(player), 0);
    assert.equal(getTalentBonuses(player).attack, 5);
    assert.equal(getEffectiveCombatStats(player).attack, player.attack + 5);
    gameState.save();
    assert.equal(gameState.load(), true);
    assert.deepEqual(gameState.player.talents, ['warrior_force']);
    assert.equal(getEffectiveCombatStats(gameState.player).attack, player.attack + 5);
});

test('legacy character saves receive empty talents without losing level progress', () => {
    const player = gameState.createPlayer('mage');
    player.level = 3;
    delete player.talents;
    gameState.save();
    assert.equal(gameState.load(), true);
    assert.deepEqual(gameState.player.talents, []);
    assert.equal(getTalentPoints(gameState.player), 2);
});

test('specializations require level and prerequisite and permanently exclude the other branch', () => {
    const player = gameState.createPlayer('warrior');
    player.level = 3;
    assert.equal(unlockTalent(player, 'warrior_force'), true);
    assert.equal(getTalentAvailability(player, 'warrior_berserker').reason, 'Нужен 4 уровень');
    player.level = 4;
    assert.equal(unlockTalent(player, 'warrior_berserker'), true);
    assert.equal(getTalentBonuses(player).attack, 17);
    assert.equal(unlockTalent(player, 'warrior_guard'), true);
    player.level = 8;
    assert.equal(getTalentAvailability(player, 'warrior_sentinel').reason, 'Другая специализация выбрана');
    assert.equal(unlockTalent(player, 'warrior_sentinel'), false);
    gameState.save();
    assert.equal(gameState.load(), true);
    assert.equal(unlockTalent(gameState.player, 'warrior_sentinel'), false);
});

test('all classes can choose only their valid specialization after its prerequisite', () => {
    for (const [classId, prerequisite, specialization, competing] of [
        ['mage', 'mage_focus', 'mage_arcanist', 'mage_warden'],
        ['archer', 'archer_precision', 'archer_sniper', 'archer_ranger']
    ]) {
        const player = gameState.createPlayer(classId);
        player.level = 5;
        assert.equal(unlockTalent(player, specialization), false);
        assert.equal(unlockTalent(player, prerequisite), true);
        assert.equal(unlockTalent(player, specialization), true);
        assert.equal(unlockTalent(player, competing), false);
    }
});

test('berserker power activates at critical health and disappears after healing', () => {
    const player = gameState.createPlayer('warrior');
    player.talents = ['warrior_force', 'warrior_berserker'];
    const full = getEffectiveCombatStats(player).attack;
    player.health = Math.floor(player.maxHealth * 0.35);
    assert.equal(getEffectiveCombatStats(player).attack, Math.floor(full * 1.3));
    player.health = player.maxHealth;
    assert.equal(getEffectiveCombatStats(player).attack, full);
});

test('sentinel counters guarded attacks but not unguarded hits or healing turns', () => {
    const player = gameState.createPlayer('warrior');
    player.talents = ['warrior_guard', 'warrior_sentinel'];
    const enemy = { health: 100, maxHealth: 100, attack: 36, defense: 0 };
    const guarded = applyEnemyAction(enemy, player, 'attack', 0, 0.5);
    assert.ok(guarded.reflected > 0);
    assert.equal(enemy.health, 100 - guarded.reflected);
    assert.equal(applyEnemyAction(enemy, player, 'attack', 0, 0).reflected, 0);
    assert.equal(applyEnemyAction(enemy, player, 'recover').reflected, 0);
});

test('arcanist strengthens skill damage and rune warden mitigates incoming hits', () => {
    const mage = gameState.createPlayer('mage');
    const skill = CLASSES.mage.skills[0];
    const ordinary = { health: 300, defense: 0 };
    const normalDamage = useSkillEffect(mage, ordinary, skill).damage;
    mage.talents = ['mage_focus', 'mage_arcanist'];
    const empowered = { health: 300, defense: 0 };
    assert.ok(useSkillEffect(mage, empowered, skill).damage > normalDamage);
    mage.talents = ['mage_ward', 'mage_warden'];
    const enemy = { health: 100, maxHealth: 100, attack: 35, defense: 0 };
    const guardedDamage = applyEnemyAction(enemy, mage, 'attack').damage;
    mage.talents = ['mage_ward'];
    mage.health = mage.maxHealth;
    assert.ok(applyEnemyAction(enemy, mage, 'attack').damage > guardedDamage);
});

test('sniper critical multiplier and ranger bleeding respect talent and resistance', () => {
    const player = gameState.createPlayer('archer');
    assert.equal(getCriticalMultiplier(player), 2);
    player.talents = ['archer_precision', 'archer_sniper'];
    assert.equal(getCriticalMultiplier(player), 2.5);
    const enemy = { health: 100, maxHealth: 100 };
    assert.equal(triggerRangerEffect(player, enemy, 0), false);
    player.talents = ['archer_power', 'archer_ranger'];
    assert.equal(triggerRangerEffect(player, enemy, 0.3), false);
    assert.equal(triggerRangerEffect(player, enemy, 0.2), true);
    assert.equal(enemy.effects.bleedTurns, 2);
    const immune = { health: 100, resistances: { bleed: 1 } };
    assert.equal(triggerRangerEffect(player, immune, 0.1), false);
});

test('adventure event selection is deterministic and always yields a valid encounter', () => {
    assert.equal(rollAdventureEvent(0).id, 'cache');
    assert.equal(rollAdventureEvent(0.4).id, 'shrine');
    assert.equal(rollAdventureEvent(0.99).id, 'traveler');
});

test('adventure events offer safe exit and bounded risk without killing the player', () => {
    const player = gameState.createPlayer('warrior');
    const gold = player.gold;
    assert.equal(resolveAdventureEvent(player, 'cache', 'safe').gold, 0);
    assert.equal(player.gold, gold);
    assert.equal(resolveAdventureEvent(player, 'cache', 'risk', 0.1).gold, 40);
    player.health = 3;
    assert.equal(resolveAdventureEvent(player, 'cache', 'risk', 0.95).health, -2);
    assert.equal(player.health, 1);
    assert.equal(resolveAdventureEvent(player, 'unknown', 'risk'), null);
    assert.equal(resolveAdventureEvent(player, 'cache', 'invalid'), null);
});

test('traveling merchant requires funds and never produces negative gold', () => {
    const player = gameState.createPlayer('mage');
    player.gold = 19;
    assert.equal(resolveAdventureEvent(player, 'traveler', 'risk', 0), null);
    assert.equal(player.gold, 19);
    player.gold = 20;
    player.health = 10;
    const outcome = resolveAdventureEvent(player, 'traveler', 'risk', 0);
    assert.equal(outcome.gold, -20);
    assert.equal(player.gold, 0);
    assert.equal(player.health, 55);
});

test('moonwell adjusts mana without exceeding its bounds', () => {
    const player = gameState.createPlayer('mage');
    player.mana = 1;
    const restored = resolveAdventureEvent(player, 'moonwell', 'risk', 0.1);
    assert.equal(restored.mana, Math.min(35, player.maxMana - 1));
    assert.ok(player.mana <= player.maxMana);
    const drained = resolveAdventureEvent(player, 'moonwell', 'risk', 0.9);
    assert.equal(drained.mana, -10);
    player.mana = 0;
    assert.equal(resolveAdventureEvent(player, 'moonwell', 'risk', 0.9).mana, 0);
});

test('sealed vault rewards only unowned relics and fallback treasure is bounded', () => {
    const player = gameState.createPlayer('warrior');
    const first = resolveAdventureEvent(player, 'vault', 'risk', 0.1);
    assert.ok(first.relicId);
    assert.notEqual(RELICS[first.relicId].rarity, 'common');
    const second = resolveAdventureEvent(player, 'vault', 'risk', 0.1);
    assert.notEqual(second.relicId, first.relicId);
    player.relics = Object.values(RELICS).filter(relic => relic.rarity !== 'common').map(relic => relic.id);
    const goldBefore = player.gold;
    assert.equal(resolveAdventureEvent(player, 'vault', 'risk', 0.1).gold, 75);
    assert.equal(player.gold, goldBefore + 75);
    player.health = 2;
    const cursed = resolveAdventureEvent(player, 'vault', 'risk', 0.9);
    assert.equal(cursed.relicId, null);
    assert.equal(player.health, 1);
});

test('dungeon minibosses retain their identity and each uses a signature action', () => {
    const cases = [
        ['forest', 'goblin_king', 'ambush'],
        ['mountains', 'mountain_giant', 'crush'],
        ['ruins', 'death_knight', 'siphon'],
        ['dragon_lair', 'ancient_dragon', 'flame_breath']
    ];
    for (const [locationId, bossId, signature] of cases) {
        const stage = getLocation(locationId).stages[4];
        assert.equal(stage.boss.miniBoss, true);
        const enemy = { ...stage.boss, behavior: 'mini_boss' };
        assert.equal(enemy.id, bossId);
        assert.equal(chooseEnemyAction(enemy, { mana: 20 }, 0.1), signature);
        assert.equal(chooseEnemyAction(enemy, { mana: 20 }, 0.9), 'attack');
        assert.equal(getLocation(locationId).stages[9].boss.miniBoss, undefined);
    }
});

test('miniboss crushing ignores some armor and life siphon cannot over-heal', () => {
    const warrior = gameState.createPlayer('warrior');
    const attacker = { attack: 55, health: 30, maxHealth: 50 };
    const normal = applyEnemyAction(attacker, warrior, 'attack').damage;
    warrior.health = warrior.maxHealth;
    const crushed = applyEnemyAction(attacker, warrior, 'crush').damage;
    assert.ok(crushed > normal);
    warrior.health = warrior.maxHealth;
    const healed = applyEnemyAction(attacker, warrior, 'siphon');
    assert.ok(healed.soulDrain > 0);
    assert.ok(attacker.health <= attacker.maxHealth);
    assert.ok(attacker.health > 30);
});

test('ancient dragon flame breath drains only available mana', () => {
    const mage = gameState.createPlayer('mage');
    mage.mana = 3;
    const enemy = { attack: 80, health: 100, maxHealth: 100 };
    const result = applyEnemyAction(enemy, mage, 'flame_breath');
    assert.equal(result.manaBurned, 3);
    assert.equal(mage.mana, 0);
});

test('secret rooms are selected deterministically with invalid random values rejected', () => {
    assert.equal(rollSecretRoom(0).id, 'armory');
    assert.equal(rollSecretRoom(0.5).id, 'sanctuary');
    assert.equal(rollSecretRoom(0.99).id, 'crypt');
    assert.equal(rollSecretRoom(-1), null);
    assert.equal(rollSecretRoom(NaN), null);
    assert.equal(SECRET_ROOMS.length, 3);
});

test('secret rooms allow safe departure and never kill the player with traps', () => {
    const player = gameState.createPlayer('warrior');
    const snapshot = JSON.stringify(player);
    assert.equal(resolveSecretRoom(player, 'crypt', 'leave').relicId, null);
    assert.equal(JSON.stringify(player), snapshot);
    assert.equal(resolveSecretRoom(player, 'unknown', 'explore'), null);
    assert.equal(resolveSecretRoom(player, 'crypt', 'explore', -1), null);
    player.health = 2;
    const trap = resolveSecretRoom(player, 'crypt', 'explore', 0.99);
    assert.equal(trap.health, -1);
    assert.equal(player.health, 1);
});

test('secret crypt never duplicates relics and sanctuary recovery is capped', () => {
    const player = gameState.createPlayer('mage');
    const first = resolveSecretRoom(player, 'crypt', 'explore', 0.1);
    assert.ok(RELICS[first.relicId]);
    assert.notEqual(RELICS[first.relicId].rarity, 'common');
    const second = resolveSecretRoom(player, 'crypt', 'explore', 0.1);
    assert.notEqual(first.relicId, second.relicId);
    player.relics = Object.values(RELICS).filter(relic => relic.rarity !== 'common').map(relic => relic.id);
    assert.equal(resolveSecretRoom(player, 'crypt', 'explore', 0.1).itemId, 'big_health_potion');
    player.health = player.maxHealth - 2;
    player.mana = player.maxMana - 3;
    const restored = resolveSecretRoom(player, 'sanctuary', 'explore', 0.1);
    assert.equal(restored.health, 2);
    assert.equal(restored.mana, 3);
    assert.equal(player.health, player.maxHealth);
    assert.equal(player.mana, player.maxMana);
});

test('hidden armory grants an actual inventory item only on success', () => {
    const player = gameState.createPlayer('archer');
    const before = player.inventory.find(item => item.id === 'big_health_potion')?.quantity || 0;
    const reward = resolveSecretRoom(player, 'armory', 'explore', 0.1);
    assert.equal(reward.itemId, 'big_health_potion');
    assert.equal(player.inventory.find(item => item.id === reward.itemId).quantity, before + 1);
    const quantity = player.inventory.find(item => item.id === reward.itemId).quantity;
    resolveSecretRoom(player, 'armory', 'explore', 0.9);
    assert.equal(player.inventory.find(item => item.id === reward.itemId).quantity, quantity);
});

test('secret discovery appears once and a second click cannot grant another reward', async () => {
    gameState.createPlayer('warrior');
    const state = getLocationState();
    const battle = getBattleState();
    const originalRandom = Math.random;
    const originalGetElement = document.getElementById;
    const originalNotify = window.showNotification;
    const ui = { innerHTML: '' };
    Math.random = () => 0; // Discover a room, select the armory, then award its first item.
    document.getElementById = () => ui;
    window.showNotification = () => {};
    state.inLocation = true;
    state.currentLocation = getLocation('forest');
    state.currentStage = 6;
    state.enemiesDefeated = 0;
    state.pendingEvent = null;
    state.pendingRoute = null;
    state.pendingSecretRoom = null;
    state.visitedEventStages = new Set();
    state.visitedRouteStages = new Set();
    state.checkedSecretStages = new Set();
    state.routeChoices = {};
    battle.isActive = false;
    try {
        startStageBattle();
        assert.equal(state.pendingSecretRoom.id, 'armory');
        assert.match(ui.innerHTML, /Секретная комната/);
        startStageBattle();
        assert.equal(battle.isActive, false);
        assert.equal(state.pendingSecretRoom.id, 'armory');
        assert.equal(chooseSecretRoom('unknown'), false);
        assert.equal(chooseSecretRoom('explore'), true);
        assert.equal(state.pendingSecretRoom, null);
        const potionCount = gameState.player.inventory.find(item => item.id === 'big_health_potion')?.quantity || 0;
        assert.equal(potionCount, 1);
        assert.equal(chooseSecretRoom('explore'), false);
        assert.equal(gameState.player.inventory.find(item => item.id === 'big_health_potion').quantity, potionCount);
        assert.equal(state.checkedSecretStages.has(6), true);
    } finally {
        battle.isActive = false;
        battle.currentEnemy = null;
        resetLocationState();
        Math.random = originalRandom;
        document.getElementById = originalGetElement;
        window.showNotification = originalNotify;
        await new Promise(resolve => setImmediate(resolve));
    }
});

test('leaving a dungeon with the battle back button clears the active run', () => {
    gameState.createPlayer('warrior');
    const location = getLocationState();
    const battle = getBattleState();
    const originalGetLocation = window.getLocationState;
    const originalReset = window.resetLocationState;
    const originalShow = window.showScreen;
    const originalUpdateMenu = window.updateMainMenu;
    let shownScreen = '';
    window.getLocationState = getLocationState;
    window.resetLocationState = resetLocationState;
    window.showScreen = screen => { shownScreen = screen; };
    window.updateMainMenu = () => {};
    location.inLocation = true;
    location.currentLocation = getLocation('forest');
    location.currentStage = 6;
    location.pendingSecretRoom = { id: 'armory', stage: 6, runId: location.runId };
    battle.isActive = true;
    battle.currentEnemy = { health: 10, maxHealth: 10 };
    try {
        exitBattle();
        assert.equal(location.inLocation, false);
        assert.equal(location.pendingSecretRoom, null);
        assert.equal(location.currentLocation, null);
        assert.equal(battle.isActive, false);
        assert.equal(battle.currentEnemy, null);
        assert.equal(shownScreen, 'main-menu');
    } finally {
        resetLocationState();
        battle.isActive = false;
        battle.currentEnemy = null;
        window.getLocationState = originalGetLocation;
        window.resetLocationState = originalReset;
        window.showScreen = originalShow;
        window.updateMainMenu = originalUpdateMenu;
    }
});

test('safe dungeon route preserves enemy balance and rewards', () => {
    const original = { name: 'Волк', health: 100, maxHealth: 100, attack: 20, expReward: 30, goldReward: 10 };
    const safe = applyRouteToEnemy(original, 'safe', 0);
    assert.equal(safe.health, original.health);
    assert.equal(safe.goldReward, original.goldReward);
    assert.equal(safe.elite, false);
    assert.equal(original.elite, undefined);
    assert.equal(getRoute('nonexistent'), null);
    assert.equal(applyRouteToEnemy(original, 'nonexistent'), null);
});

test('danger route increases enemy difficulty and rewards with a rare elite encounter', () => {
    const enemy = { name: 'Гоблин', health: 100, maxHealth: 100, attack: 20, expReward: 100, goldReward: 40 };
    const dangerous = applyRouteToEnemy(enemy, 'danger', 0.8);
    assert.equal(dangerous.health, 135);
    assert.equal(dangerous.attack, 27);
    assert.equal(dangerous.expReward, 165);
    assert.equal(dangerous.goldReward, 66);
    assert.equal(dangerous.elite, false);
    const elite = applyRouteToEnemy(enemy, 'danger', 0.1);
    assert.equal(elite.elite, true);
    assert.ok(elite.health > dangerous.health);
    assert.ok(elite.expReward > dangerous.expReward);
    assert.ok(elite.name.startsWith('⚡'));
});

test('elite affixes are reproducible and armored elites gain real defense', () => {
    const base = { name: 'Гоблин', health: 100, maxHealth: 100, attack: 20, defense: 5, expReward: 10, goldReward: 10 };
    assert.equal(applyRouteToEnemy(base, 'danger', 0.01).eliteAffix, 'vampiric');
    assert.equal(applyRouteToEnemy(base, 'danger', 0.09).eliteAffix, 'enraged');
    const armored = applyRouteToEnemy(base, 'danger', 0.14);
    assert.equal(armored.eliteAffix, 'armored');
    assert.equal(armored.defense, 17);
    const tactician = applyRouteToEnemy(base, 'danger', 0.18);
    assert.equal(tactician.eliteAffix, 'tactician');
    assert.match(tactician.name, /Тактик/);
    assert.equal(base.defense, 5);
});

test('vampiric elites heal from actual attacks but not beyond maximum health', () => {
    const player = gameState.createPlayer('warrior');
    const enemy = { health: 40, maxHealth: 100, attack: 20, eliteAffix: 'vampiric' };
    const attack = applyEnemyAction(enemy, player, 'attack');
    assert.ok(attack.lifeStolen > 0);
    assert.equal(enemy.health, 40 + attack.lifeStolen);
    enemy.health = 99;
    assert.equal(applyEnemyAction(enemy, player, 'attack').lifeStolen, 1);
    assert.equal(enemy.health, 100);
});

test('enraged elites deal more damage at half health without affecting normal enemies', () => {
    const player = gameState.createPlayer('warrior');
    const enemy = { health: 100, maxHealth: 100, attack: 30, eliteAffix: 'enraged' };
    const normal = applyEnemyAction(enemy, player, 'attack').damage;
    enemy.health = 50;
    player.health = player.maxHealth;
    const angry = applyEnemyAction(enemy, player, 'attack');
    assert.equal(angry.enraged, true);
    assert.ok(angry.damage > normal);
});

test('relics drop only from eligible victories and do not duplicate', () => {
    const player = gameState.createPlayer('warrior');
    assert.equal(awardRelic(player, false, false, 0), null);
    assert.equal(awardRelic(player, true, false, 0.8), null);
    const first = awardRelic(player, true, false, 0.1);
    assert.ok(RELICS[first]);
    const second = awardRelic(player, true, false, 0.1);
    assert.notEqual(second, first);
    assert.equal(new Set(player.relics).size, player.relics.length);
    assert.equal(awardRelic(player, false, true, 0.9), null);
    assert.equal(awardRelic(player, false, true, -1), null);
});

test('only two owned relics can be active and duplicate toggles do not stack', () => {
    const player = gameState.createPlayer('mage');
    player.relics = Object.keys(RELICS);
    assert.equal(MAX_ACTIVE_RELICS, 2);
    assert.equal(toggleRelic(player, 'ash_heart'), true);
    assert.equal(toggleRelic(player, 'stone_oath'), true);
    assert.equal(toggleRelic(player, 'eagle_eye'), false);
    assert.equal(toggleRelic(player, 'unknown'), false);
    assert.equal(getRelicBonuses(player).attack, 6);
    assert.equal(getRelicBonuses(player).defense, 6);
    assert.equal(toggleRelic(player, 'ash_heart'), true);
    assert.equal(getRelicBonuses(player).attack, 0);
    assert.equal(toggleRelic(player, 'eagle_eye'), true);
    assert.equal(getRelicBonuses(player).critChance, 0.1); // Бонус «Бдительный страж».
});

test('relic effects apply to combat without changing saved base stats', () => {
    const player = gameState.createPlayer('mage');
    player.relics = ['ash_heart', 'arcane_spark'];
    player.activeRelics = ['ash_heart', 'arcane_spark'];
    const baseAttack = player.attack;
    assert.equal(getEffectiveCombatStats(player).attack, baseAttack + 6);
    const enemy = { health: 300, defense: 0 };
    const augmented = useSkillEffect(player, enemy, CLASSES.mage.skills[0]).damage;
    player.activeRelics = [];
    const ordinary = { health: 300, defense: 0 };
    assert.ok(augmented > useSkillEffect(player, ordinary, CLASSES.mage.skills[0]).damage);
    assert.equal(player.attack, baseAttack);
    gameState.save();
    assert.equal(gameState.load(), true);
    assert.deepEqual(gameState.player.relics, player.relics);
});

test('relic rarity weights favor common drops and bosses can award legendary finds', () => {
    const commonPlayer = gameState.createPlayer('warrior');
    const commonId = awardRelic(commonPlayer, true, false, 0);
    assert.equal(RELICS[commonId].rarity, 'common');
    const legendaryPlayer = gameState.createPlayer('warrior');
    const legendaryId = awardRelic(legendaryPlayer, false, true, 0.599);
    assert.equal(RELICS[legendaryId].rarity, 'legendary');
    assert.equal(RELIC_RARITIES.legendary.name, 'Легендарная');
});

test('two matching relics unlock a synergy only while both are equipped', () => {
    const player = gameState.createPlayer('mage');
    player.relics = ['ash_heart', 'arcane_spark', 'stone_oath'];
    player.activeRelics = ['ash_heart', 'arcane_spark'];
    assert.deepEqual(getActiveRelicSynergies(player).map(synergy => synergy.id), ['ember_magic']);
    assert.equal(getRelicBonuses(player).skillPower, 0.25);
    assert.equal(getRelicBonuses(player).attack, 6);
    toggleRelic(player, 'arcane_spark');
    assert.deepEqual(getActiveRelicSynergies(player), []);
    assert.equal(getRelicBonuses(player).skillPower, 0);
});

test('unknown, duplicate and unowned relic IDs cannot produce phantom synergies', () => {
    const player = gameState.createPlayer('warrior');
    player.relics = ['stone_oath', 'eagle_eye'];
    player.activeRelics = ['stone_oath', 'stone_oath', 'eagle_eye', 'phoenix_crown'];
    assert.equal(getActiveRelicSynergies(player).length, 1);
    assert.equal(getRelicBonuses(player).defense, 10);
    assert.equal(getRelicBonuses(player).critChance, 0.1);
    player.relics = ['stone_oath'];
    assert.deepEqual(getActiveRelicSynergies(player), []);
});

test('legendary phoenix crown ignites targets only on damaging skills and respects immunity', () => {
    const player = gameState.createPlayer('mage');
    player.relics = ['phoenix_crown'];
    player.activeRelics = ['phoenix_crown'];
    const skill = CLASSES.mage.skills.find(entry => entry.damageMultiplier);
    const target = { health: 500, maxHealth: 500, defense: 0 };
    const result = useSkillEffect(player, target, skill);
    assert.equal(result.phoenixBurn, true);
    assert.equal(target.effects.burnTurns, 2);
    const immune = { health: 500, maxHealth: 500, defense: 0, resistances: { burn: 1 } };
    assert.equal(useSkillEffect(player, immune, skill).phoenixBurn, false);
    player.activeRelics = [];
    assert.equal(useSkillEffect(player, { health: 500, defense: 0 }, skill).phoenixBurn, false);
});

test('phoenix rebirth activates once per battle and never changes base maximum health', () => {
    const player = gameState.createPlayer('warrior');
    player.relics = ['phoenix_crown'];
    player.activeRelics = ['phoenix_crown'];
    const battleRelics = { phoenixRebirthUsed: false };
    const maximum = player.maxHealth;
    assert.equal(hasActiveRelic(player, 'phoenix_crown'), true);
    assert.equal(tryPhoenixRebirth(player, battleRelics), false);
    player.health = 0;
    assert.equal(tryPhoenixRebirth(player, battleRelics), true);
    assert.equal(player.health, Math.ceil(maximum * 0.2));
    player.health = 0;
    assert.equal(tryPhoenixRebirth(player, battleRelics), false);
    assert.equal(player.maxHealth, maximum);
    assert.equal(tryPhoenixRebirth(player, { phoenixRebirthUsed: false }), true);
    player.health = 0;
    player.activeRelics = [];
    assert.equal(tryPhoenixRebirth(player, { phoenixRebirthUsed: false }), false);
    gameState.save();
    assert.equal(gameState.load(), true);
    assert.deepEqual(gameState.player.activeRelics, []);
});

