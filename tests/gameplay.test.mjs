import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../js/core/state.js';
import { ITEMS, getItem } from '../js/data/items.js';
import { useInventoryItem, unequipItem } from '../js/ui/inventory.js';
import { escapeHtml } from '../js/core/html.js';
import { calculateDamage, applyDamage, consumeHealingPotion, useSkillEffect, tickEnemyEffects, chooseEnemyAction, applyEnemyAction, getBossPhase, planEnemyTurn } from '../js/systems/combat.js';
import { CLASSES } from '../js/data/classes.js';

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

test('poison deals damage for three turns and then expires', () => {
    const player = gameState.createPlayer('archer');
    const enemy = { health: 100, maxHealth: 100, defense: 2 };
    useSkillEffect(player, enemy, CLASSES.archer.skills[1]);
    assert.equal(tickEnemyEffects(enemy).poisonDamage, 5);
    assert.equal(tickEnemyEffects(enemy).poisonDamage, 5);
    assert.equal(tickEnemyEffects(enemy).poisonDamage, 5);
    assert.equal(tickEnemyEffects(enemy).poisonDamage, 0);
});

test('warrior shield skill grants damage reduction without direct damage', () => {
    const player = gameState.createPlayer('warrior');
    const enemy = { health: 100, maxHealth: 100, defense: 2 };
    const result = useSkillEffect(player, enemy, CLASSES.warrior.skills[1]);
    assert.equal(enemy.health, 100);
    assert.equal(result.guardReduction, 0.75);
});

test('different enemy archetypes choose distinct tactics', () => {
    const player = { mana: 30 };
    assert.equal(chooseEnemyAction({ behavior: 'aggressive', health: 20, maxHealth: 30 }, player, 0.1), 'heavy');
    assert.equal(chooseEnemyAction({ behavior: 'opportunist', health: 30, maxHealth: 30 }, player, 0.1), 'mana_burn');
    assert.equal(chooseEnemyAction({ behavior: 'resilient', health: 20, maxHealth: 100 }, player, 0.1), 'recover');
    assert.equal(chooseEnemyAction({ behavior: 'boss', health: 100, maxHealth: 100 }, player, 0.5), 'mana_burn');
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

test('phase change clears obsolete boss warning', () => {
    const boss = { behavior: 'boss', health: 100, maxHealth: 100 };
    planEnemyTurn(boss, { mana: 20 }, 0.1);
    boss.health = 50;
    const next = planEnemyTurn(boss, { mana: 20 }, 0.9);
    assert.equal(next.phaseChanged, true);
    assert.equal(next.action, 'attack');
    assert.equal(boss.intent, null);
});

