import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
const responsive = css.slice(css.indexOf('/* Combat controls remain readable when skills and status hints grow. */'));

test('combat action grid uses shrink-safe columns and wraps long skill labels', () => {
    assert.match(responsive, /\.battle-buttons\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
    assert.match(responsive, /\.battle-btn\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    assert.match(responsive, /\.battle-btn\s*\{[^}]*white-space:\s*normal/s);
    assert.match(responsive, /\.battle-btn small\s*\{[^}]*overflow-wrap:\s*anywhere/s);
});

test('battle controls remain touch-friendly at 375 CSS pixels', () => {
    assert.match(responsive, /\.battle-btn\s*\{[^}]*min-height:\s*48px/s);
    assert.match(responsive, /@media\s*\(max-width:\s*375px\)[\s\S]*?\.battle-btn\s*\{[^}]*min-height:\s*48px/s);
});

test('very narrow screens use a single-column combat action layout', () => {
    assert.match(responsive, /@media\s*\(max-width:\s*340px\)[\s\S]*?\.battle-buttons\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/s);
});

test('combat status text and participant panels may shrink and wrap', () => {
    assert.match(responsive, /\.combat-entity-title\s*\{[^}]*min-width:\s*0/s);
    assert.match(responsive, /\.battle-tactic,[\s\S]*?\.stage-info span\s*\{[^}]*overflow-wrap:\s*anywhere/s);
});
