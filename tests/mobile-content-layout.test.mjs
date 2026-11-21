import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
const mobileRules = css.slice(css.indexOf('/* Main menu, character, quests, achievements and shop on compact screens. */'));

test('main menu and character content can shrink and wrap on narrow screens', () => {
    assert.match(mobileRules, /\.menu-container,[\s\S]*?\.shop-item\s*\{[^}]*min-width:\s*0/s);
    assert.match(mobileRules, /@media\s*\(max-width:\s*480px\)[\s\S]*?\.character-header\s*\{[^}]*align-items:\s*flex-start/s);
    assert.match(mobileRules, /\.talent-button\s*\{[^}]*min-height:\s*44px/s);
    assert.match(mobileRules, /@media\s*\(max-width:\s*375px\)[\s\S]*?\.menu-btn\s*\{[^}]*min-height:\s*52px/s);
});

test('quest headers and rewards wrap without forcing horizontal overflow', () => {
    assert.match(mobileRules, /\.quest-header\s*\{[^}]*flex-wrap:\s*wrap/s);
    assert.match(mobileRules, /\.quest-name\s*\{[^}]*flex:\s*1 1 170px/s);
    assert.match(mobileRules, /\.quest-rewards span\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    assert.match(mobileRules, /\.quest-claim-btn,[\s\S]*?min-height:\s*44px/s);
});

test('achievement claim action moves into document flow on mobile', () => {
    assert.match(mobileRules, /\.achievement-card\s*\{[^}]*flex-wrap:\s*wrap/s);
    assert.match(mobileRules, /\.achievement-claim-btn\s*\{[^}]*position:\s*static/s);
    assert.match(mobileRules, /\.achievement-claim-btn\s*\{[^}]*flex:\s*1 0 100%/s);
});

test('shop uses a single readable mobile column with accessible purchase buttons', () => {
    assert.match(mobileRules, /\.shop-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
    assert.match(mobileRules, /\.shop-btn\s*\{[^}]*min-height:\s*44px/s);
});
