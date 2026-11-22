import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../js/', import.meta.url));

function collectModules(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return collectModules(path);
        return entry.isFile() && entry.name.endsWith('.js') ? [path] : [];
    });
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&');
}

function importedBindings(source) {
    const imports = [];
    const pattern = /\bimport\s*\{([^}]+)\}\s*from\s*(['"])[^'"]+\2\s*;?/gs;
    for (const match of source.matchAll(pattern)) {
        for (const item of match[1].split(',')) {
            const specifier = item.trim();
            if (!specifier || specifier.startsWith('type ')) continue;
            const parts = specifier.split(/\s+as\s+/);
            const localName = (parts[1] || parts[0]).trim();
            if (/^[A-Za-z_$][\w$]*$/.test(localName)) {
                imports.push({ localName, declaration: match[0] });
            }
        }
    }
    return imports;
}

test('named JavaScript imports are referenced by their modules', () => {
    const unused = [];

    for (const path of collectModules(root)) {
        const source = readFileSync(path, 'utf8');
        for (const binding of importedBindings(source)) {
            const withoutDeclaration = source.replace(binding.declaration, '');
            const references = withoutDeclaration.match(
                new RegExp('\\b' + escapeRegExp(binding.localName) + '\\b', 'g')
            ) || [];
            if (references.length === 0) {
                unused.push({
                    file: relative(root, path).replaceAll('\\', '/'),
                    imported: binding.localName
                });
            }
        }
    }

    assert.deepEqual(unused, [], 'remove unused named imports or use them intentionally');
});
