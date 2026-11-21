import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAMAGE_TYPE_LABELS } from '../js/systems/combat.js';

const battle = readFileSync(new URL('../js/ui/battle.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
const affinityStyles = css.slice(css.indexOf('/* Elemental combat affinity sigils: readable at a glance, no balance impact. */'));

test('combat HUD maps every supported damage type to a recognizable elemental sigil', () => {
    const mapping = battle.slice(battle.indexOf('const damageTypePresentation'), battle.indexOf('const damageProfileChips'));
    for (const type of Object.keys(DAMAGE_TYPE_LABELS)) {
        assert.match(mapping, new RegExp(type + ': \\{ icon:'));
    }
});

test('enemy weaknesses and resistances are rendered as semantic affinity chips', () => {
    assert.match(battle, /damageProfile\.weaknesses\.map\(entry => \(\{ \.\.\.entry, relation: 'weakness' \}\)\)/);
    assert.match(battle, /damageProfile\.resistances\.map\(entry => \(\{ \.\.\.entry, relation: 'resistance' \}\)\)/);
    assert.match(battle, /class="damage-affinity-chip \$\{entry\.relation\} damage-type-\$\{presentation\.tone\}"/);
    assert.match(battle, /\$\{sign\}\$\{entry\.percent\}%/);
});

test('affinity chip styling distinguishes relation and element without changing combat calculations', () => {
    for (const tone of ['physical', 'fire', 'ice', 'poison']) {
        assert.match(affinityStyles, new RegExp('\\.damage-affinity-chip\\.damage-type-' + tone));
    }
    assert.match(affinityStyles, /\.damage-affinity-chip\.weakness/);
    assert.match(affinityStyles, /\.damage-affinity-chip\.resistance/);
    assert.match(affinityStyles, /font-variant-numeric:\s*tabular-nums/);
});

test('affinity chips wrap on narrow screens instead of overflowing the battle HUD', () => {
    assert.match(affinityStyles, /\.damage-affinity-list\s*\{[^}]*display:\s*flex/);
    assert.match(affinityStyles, /flex-wrap:\s*wrap/);
    assert.match(affinityStyles, /@media\s*\(max-width:\s*375px\)[\s\S]*?\.damage-affinity-chip\s*\{[^}]*flex:\s*1 1 138px/s);
});
