import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../js/', import.meta.url);

function collectJavaScript(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return collectJavaScript(path);
        return entry.isFile() && entry.name.endsWith('.js') ? [path] : [];
    });
}

function readSources() {
    return collectJavaScript(root).map(path => ({
        path: relative(root.pathname, path).replaceAll('\\', '/'),
        source: readFileSync(path, 'utf8')
    }));
}

test('every window callback used by inline UI handlers is registered by the application entry point', () => {
    const sources = readSources();
    const entry = sources.find(file => file.path === 'main.js');
    assert.ok(entry, 'js/main.js must exist');

    const registered = new Set(
        [...entry.source.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)].map(match => match[1])
    );
    const missing = new Map();

    for (const file of sources) {
        for (const attribute of file.source.matchAll(/\bonclick\s*=\s*(["'])([\s\S]*?)\1/gi)) {
            for (const callback of attribute[2].matchAll(/window\.([A-Za-z_$][\w$]*)\s*\(/g)) {
                const name = callback[1];
                if (!registered.has(name)) {
                    const locations = missing.get(name) ?? [];
                    locations.push(file.path);
                    missing.set(name, locations);
                }
            }
        }
    }

    assert.deepEqual(
        [...missing.entries()].map(([name, files]) => ({ name, files: [...new Set(files)] })),
        [],
        'inline UI callbacks must be registered centrally in js/main.js'
    );
});

test('the application entry point registers each global callback only once', () => {
    const entry = readSources().find(file => file.path === 'main.js');
    const registrations = [...entry.source.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)]
        .map(match => match[1]);
    const duplicates = registrations.filter((name, index) => registrations.indexOf(name) !== index);
    assert.deepEqual([...new Set(duplicates)], [], 'duplicate global callback registrations obscure ownership');
});
