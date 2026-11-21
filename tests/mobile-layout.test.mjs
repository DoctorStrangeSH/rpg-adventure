import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');

test('mobile viewport supports device safe areas without disabling user zoom', () => {
    const viewport = html.match(/<meta\s+name="viewport"\s+content="([^"]+)"/i)?.[1] ?? '';
    assert.match(viewport, /width=device-width/);
    assert.match(viewport, /initial-scale=1(?:\.0)?/);
    assert.match(viewport, /viewport-fit=cover/);
    assert.doesNotMatch(viewport, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0)?/);
});

test('application layout follows the dynamic mobile viewport height', () => {
    assert.match(css, /html\s*\{[^}]*min-height:\s*100dvh/s);
    assert.match(css, /body\s*\{[^}]*height:\s*100dvh/s);
    assert.match(css, /body\s*\{[^}]*width:\s*100%/s);
    assert.match(css, /#app,\s*\.screen\s*\{[^}]*min-height:\s*0/s);
});

test('notched mobile screens reserve safe areas for headers, content and battle controls', () => {
    assert.match(css, /safe-area-inset-top/);
    assert.match(css, /safe-area-inset-bottom/);
    assert.match(css, /safe-area-inset-left/);
    assert.match(css, /safe-area-inset-right/);
    assert.match(css, /\.battle-ui\s*\{[^}]*bottom:\s*env\(safe-area-inset-bottom/s);
});

test('375px layout and primary touch controls have explicit compact sizing', () => {
    assert.match(css, /@media\s*\(max-width:\s*375px\)/);
    assert.match(css, /\.back-btn\s*\{[^}]*min-height:\s*44px/s);
    assert.match(css, /\.battle-btn,\s*\.menu-btn,\s*\.shop-btn/s);
    assert.match(css, /min-height:\s*44px/);
});


test('375px gameplay surfaces keep battle, map and ending content independently scrollable', () => {
    assert.match(css, /\.battle-ui\s*\{[^}]*overflow-y:\s*auto/s);
    assert.match(css, /\.battle-ui\s*\{[^}]*max-height:\s*min\(62%,\s*470px\)/s);
    assert.match(css, /\.map-overlay\s*\{[^}]*max-width:\s*min\(300px,\s*calc\(100%\s*-\s*24px\)\)/s);
    assert.match(css, /\.map-overlay\s*\{[^}]*max-height:\s*min\(60dvh,\s*520px\)/s);
    assert.match(css, /\.map-overlay\s*\{[^}]*overflow-y:\s*auto/s);
    assert.match(css, /\.ending-content\s*\{[^}]*max-height:\s*100%/s);
    assert.match(css, /\.ending-content\s*\{[^}]*overflow-y:\s*auto/s);
    assert.match(css, /\.ending-actions\s+\.menu-btn\s*\{[^}]*min-height:\s*52px/s);
});

test('inventory and forge controls can shrink and remain touch accessible on narrow screens', () => {
    assert.match(css, /\.inventory-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
    assert.match(css, /\.inventory-item,[\s\S]*?\.forge-rune-card\s*\{[^}]*min-width:\s*0/s);
    assert.match(css, /\.salvage-button,[\s\S]*?\.rune-extract-button\s*\{[^}]*min-height:\s*44px/s);
    assert.match(css, /\.forge-installed\s*\{[^}]*flex-wrap:\s*wrap/s);
});
