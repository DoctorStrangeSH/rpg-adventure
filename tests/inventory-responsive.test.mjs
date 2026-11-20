import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');

test('inventory cards use shrink-safe columns and wrap long item descriptions', () => {
    assert.match(css, /\.inventory-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
    assert.match(css, /\.inventory-item,\s*\.equipment-slot,\s*\.crafting-recipe,\s*\.forge-panel,\s*\.forge-rune-card\s*\{[^}]*min-width:\s*0/s);
    assert.match(css, /\.item-name,[\s\S]*?\.forge-rune-card small\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    assert.match(css, /\.item-comparison\s*\{[^}]*flex-wrap:\s*wrap/s);
});

test('inventory and forge actions have mobile-sized touch targets and can wrap', () => {
    assert.match(css, /\.salvage-button,[\s\S]*?\.rune-extract-button\s*\{[^}]*min-height:\s*44px/s);
    assert.match(css, /\.salvage-button,[\s\S]*?\.rune-extract-button\s*\{[^}]*white-space:\s*normal/s);
    assert.match(css, /\.upgrade-row\s*\{[^}]*flex-wrap:\s*wrap/s);
    assert.match(css, /\.forge-installed\s*\{[^}]*flex-wrap:\s*wrap/s);
});

test('375px inventory remains a two-column grid with compact forge and full-width upgrade action', () => {
    assert.match(css, /@media\s*\(max-width:\s*420px\)\s*\{[\s\S]*?\.inventory-grid\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(css, /@media\s*\(max-width:\s*375px\)\s*\{[\s\S]*?\.upgrade-row \.upgrade-button\s*\{\s*width:\s*100%/);
    assert.match(css, /@media\s*\(max-width:\s*375px\)\s*\{[\s\S]*?\.forge-sockets\s*\{\s*gap:\s*6px/);
});
