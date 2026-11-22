import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../js/', import.meta.url));

function collectModules(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return collectModules(path);
        return entry.isFile() && entry.name.endsWith('.js') ? [path] : [];
    });
}

const modulePaths = collectModules(root);
const modules = new Map(modulePaths.map(path => [
    resolve(path),
    readFileSync(path, 'utf8')
]));

function dependenciesOf(source) {
    const dependencies = [];
    const pattern = /\b(?:import|export)\s+(?:[^'"]*?\s+from\s*)?['"]([^'"]+)['"]/gs;
    for (const match of source.matchAll(pattern)) {
        if (match[1].startsWith('.')) dependencies.push(match[1]);
    }
    return dependencies;
}

function buildGraph() {
    const graph = new Map();
    const missing = [];

    for (const [path, source] of modules) {
        const dependencies = [];
        for (const specifier of dependenciesOf(source)) {
            const target = resolve(dirname(path), specifier);
            if (!modules.has(target)) {
                missing.push({ from: relative(root, path), import: specifier });
            } else {
                dependencies.push(target);
            }
        }
        graph.set(path, dependencies);
    }

    return { graph, missing };
}

function findCycles(graph) {
    const visiting = new Set();
    const visited = new Set();
    const stack = [];
    const cycles = [];

    function visit(path) {
        if (visiting.has(path)) {
            const start = stack.indexOf(path);
            cycles.push(stack.slice(start).concat(path).map(item => relative(root, item)));
            return;
        }
        if (visited.has(path)) return;

        visiting.add(path);
        stack.push(path);
        for (const dependency of graph.get(path) ?? []) visit(dependency);
        stack.pop();
        visiting.delete(path);
        visited.add(path);
    }

    for (const path of graph.keys()) visit(path);
    return cycles;
}

test('all relative JavaScript module imports resolve to files in js/', () => {
    const { missing } = buildGraph();
    assert.deepEqual(missing, [], 'relative imports must not point to missing modules');
});

test('JavaScript module dependency graph has no circular imports', () => {
    const { graph } = buildGraph();
    const cycles = findCycles(graph);
    assert.deepEqual(cycles, [], 'keep module dependencies acyclic to make ownership predictable');
});

test('JavaScript module dependencies respect documented architecture layers', () => {
    const { graph } = buildGraph();
    const violations = [];

    const forbiddenTargets = {
        core: new Set(['ui']),
        data: new Set(['systems', 'ui']),
        systems: new Set(['ui']),
        entities: new Set(['ui'])
    };

    for (const [source, dependencies] of graph) {
        const sourceLayer = relative(root, source).split(/[\\\\/]/)[0];
        const forbidden = forbiddenTargets[sourceLayer];
        if (!forbidden) continue;

        for (const dependency of dependencies) {
            const targetLayer = relative(root, dependency).split(/[\\\\/]/)[0];
            if (forbidden.has(targetLayer)) {
                violations.push({
                    from: relative(root, source),
                    to: relative(root, dependency),
                    rule: `${sourceLayer} must not depend on ${targetLayer}`
                });
            }
        }
    }

    assert.deepEqual(violations, [], 'keep dependencies aligned with docs/ARCHITECTURE.md');
});
