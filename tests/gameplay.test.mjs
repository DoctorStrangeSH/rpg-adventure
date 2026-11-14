import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../js/core/state.js';
import { ITEMS, getItem } from '../js/data/items.js';
import { useInventoryItem, unequipItem } from '../js/ui/inventory.js';
import { escapeHtml } from '../js/core/html.js';

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

