import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RELICS } from '../js/systems/relics.js';

const character = readFileSync(new URL('../js/ui/character.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
const relicArt = css.slice(css.indexOf('/* Seven named relic seals: rarity controls the metal, each artifact its own aura. */'));

test('relic cards expose stable artifact identity and accessible names', () => {
    assert.match(character, /class="skill-icon relic-icon relic-rarity-\$\{RELICS\[id\]\.rarity\} relic-art-\$\{id\}"/);
    assert.match(character, /role="img" aria-label="\$\{RELICS\[id\]\.name\}"/);
});

test('all seven defined relics have their own named art treatment', () => {
    const ids = Object.keys(RELICS);
    assert.equal(ids.length, 7);
    for (const id of ids) {
        assert.match(relicArt, new RegExp('\\.relic-art-' + id + '\\s*\\{[^}]*--relic-art-tone:', 's'), id);
    }
});

test('relic seals retain rarity metal and share layered ornamental framing', () => {
    for (const rarity of ['common', 'rare', 'epic', 'legendary']) {
        assert.match(css, new RegExp('\\.relic-icon\\.relic-rarity-' + rarity));
    }
    assert.match(relicArt, /\.skill-icon\.relic-icon\[class\*="relic-art-"\]::before/);
    assert.match(relicArt, /\.skill-icon\.relic-icon\[class\*="relic-art-"\]::after/);
});

test('relic art remains presentation-only and leaves relic effects untouched', () => {
    for (const relic of Object.values(RELICS)) {
        assert.ok(relic.name.length > 0);
        assert.ok(relic.description.length > 0);
        assert.ok(['common', 'rare', 'epic', 'legendary'].includes(relic.rarity));
    }
    assert.match(character, /RELICS\[id\]\.description/);
});


test('equipped relics are visibly marked and expose pressed state to assistive technology', () => {
    assert.match(character, /relic-card-active/);
    assert.match(character, /class="relic-active-label">Экипирована/);
    assert.match(character, /aria-pressed="\$\{player\.activeRelics\?\.includes\(id\) \? 'true' : 'false'\}"/);
    assert.match(character, /player\.activeRelics\?\.includes\(id\) \? 'Снять' : 'Надеть'/);
});

test('equipped relic state remains readable on narrow mobile screens', () => {
    assert.match(css, /\.relic-card\.relic-card-active\s*\{[^}]*border-color:/s);
    assert.match(css, /\.relic-active-label::before/);
    assert.match(css, /\.relic-toggle-button\[aria-pressed="true"\]/);
    assert.match(css, /@media\s*\(max-width:\s*375px\)[\s\S]*?\.relic-card \.skill-info\s*\{[^}]*overflow-wrap:\s*anywhere/s);
});
