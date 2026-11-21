import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
const inventory = readFileSync(new URL('../js/ui/inventory.js', import.meta.url), 'utf8');
const iconStyles = css.slice(css.indexOf('/* Unified relic-like icon frames for inventory, equipment and shop cards. */'));

test('inventory and equipment icons share the same framed gothic visual language', () => {
    assert.match(iconStyles, /\.item-icon,[\s\S]*?\.slot-icon\s*\{[^}]*border-radius:\s*14px 14px 9px 9px/s);
    assert.match(iconStyles, /radial-gradient\(circle at 50% 34%/);
    assert.match(iconStyles, /inset 0 1px 0/);
    assert.match(iconStyles, /\.item-icon::before,[\s\S]*?\.slot-icon::before/);
    assert.match(iconStyles, /\.item-icon::after,[\s\S]*?\.slot-icon::after/);
});

test('item type and rarity remain semantic inputs to icon presentation', () => {
    for (const type of ['weapon', 'armor', 'consumable', 'material']) {
        assert.ok(inventory.includes('icon-${itemData.type}'), 'inventory icon uses item type class');
        assert.match(iconStyles, new RegExp('\\.item-icon\\.icon-' + type));
    }
    assert.match(iconStyles, /var\(--item-rarity, var\(--gold-dark\)\)/);
});

test('equipped gear and inserted runes receive a restrained magical accent', () => {
    assert.match(iconStyles, /\.inventory-item\.equipped \.item-icon/);
    assert.match(iconStyles, /\.equipment-slot\.slot-filled \.slot-icon/);
    assert.match(iconStyles, /\.forge-socket\.socket-filled > span/);
});

test('narrow screens keep icon frames compact without removing their visual hierarchy', () => {
    assert.match(iconStyles, /@media\s*\(max-width:\s*375px\)[\s\S]*?\.inventory-item \.item-icon\s*\{[^}]*width:\s*52px/s);
    assert.match(iconStyles, /@media\s*\(max-width:\s*375px\)[\s\S]*?\.equipment-slot \.slot-icon\s*\{[^}]*width:\s*58px/s);
});
