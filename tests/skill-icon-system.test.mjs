import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLASSES } from '../js/data/classes.js';

const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
const character = readFileSync(new URL('../js/ui/character.js', import.meta.url), 'utf8');
const skillStyles = css.slice(css.indexOf('/* Combat skill sigils: one shared frame, class-specific elemental materials. */'));

test('combat skill cards attach stable skill IDs to their icon presentation', () => {
    assert.match(character, /class="skill-icon skill-art-icon skill-art-\$\{skill\.id\}"/);
    assert.match(character, /\$\{skill\.icon\}/);
});

test('every shipped class skill has a dedicated visual tone', () => {
    const ids = Object.values(CLASSES).flatMap(classData => classData.skills.map(skill => skill.id));
    assert.equal(ids.length, 6);
    for (const id of ids) {
        assert.match(skillStyles, new RegExp('\\.skill-art-' + id + '\\s*\\{[^}]*--skill-tone:', 's'), id);
    }
});

test('skill sigils share a consistent gothic frame and preserve compact mobile layout', () => {
    assert.match(skillStyles, /\.skill-icon\.skill-art-icon\s*\{[^}]*border-radius:\s*13px 13px 8px 8px/s);
    assert.match(skillStyles, /\.skill-icon\.skill-art-icon::before/);
    assert.match(skillStyles, /\.skill-icon\.skill-art-icon::after/);
    assert.match(skillStyles, /@media\s*\(max-width:\s*375px\)[\s\S]*?\.skill-icon\.skill-art-icon\s*\{[^}]*width:\s*42px/s);
});

test('skill icon presentation does not modify combat values or skill definitions', () => {
    for (const classData of Object.values(CLASSES)) {
        for (const skill of classData.skills) {
            assert.ok(Number.isFinite(skill.manaCost));
            assert.ok(typeof skill.description === 'string' && skill.description.length > 0);
        }
    }
});
