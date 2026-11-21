import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
const accessibility = css.slice(css.indexOf('/* Accessible keyboard focus and a project-wide reduced-motion fallback. */'));

test('keyboard users get a visible high-contrast focus indicator', () => {
    assert.match(accessibility, /:where\(button, a, \[role="button"\], \[tabindex\]:not\(\[tabindex="-1"\]\)\):focus-visible\s*\{[^}]*outline:\s*3px solid var\(--gold\)/s);
    assert.match(accessibility, /:focus-visible\s*\{[^}]*outline-offset:\s*3px/s);
    assert.match(accessibility, /:focus:not\(:focus-visible\)\s*\{\s*outline:\s*none/s);
});

test('reduced-motion preference disables animation and transitions globally', () => {
    assert.match(accessibility, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation:\s*none\s*!important/s);
    assert.match(accessibility, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?transition:\s*none\s*!important/s);
    assert.match(accessibility, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?scroll-behavior:\s*auto\s*!important/s);
});

test('reduced motion also removes hover movement from primary interactive cards', () => {
    assert.match(accessibility, /\.menu-btn:hover,[\s\S]*?\.battle-btn:hover,[\s\S]*?transform:\s*none\s*!important/s);
});
