const CONTENT_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

/** Validated lookup registry for data shipped with the game (not executable plugins). */
export function createContentRegistry({ kind = 'content', validate = () => true } = {}) {
    if (typeof validate !== 'function') throw new TypeError('Content registry validator must be a function');
    const entries = new Map();

    function validateEntry(entry) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            throw new TypeError(`Invalid ${kind}: expected an object`);
        }
        if (typeof entry.id !== 'string' || !CONTENT_ID_PATTERN.test(entry.id)) {
            throw new TypeError(`Invalid ${kind} id: expected lowercase snake_case`);
        }
        const result = validate(entry);
        if (result !== true) {
            const detail = typeof result === 'string' ? `: ${result}` : '';
            throw new TypeError(`Invalid ${kind} "${entry.id}"${detail}`);
        }
    }

    function register(entry) { return registerMany([entry])[0]; }

    function registerMany(batch) {
        if (!Array.isArray(batch)) throw new TypeError(`Cannot register ${kind}: expected an array`);
        const batchIds = new Set();
        for (const entry of batch) {
            validateEntry(entry);
            if (entries.has(entry.id) || batchIds.has(entry.id)) throw new Error(`Duplicate ${kind} id: ${entry.id}`);
            batchIds.add(entry.id);
        }
        for (const entry of batch) entries.set(entry.id, entry);
        return [...batch];
    }

    return Object.freeze({
        kind, register, registerMany,
        get(id) { return typeof id === 'string' ? entries.get(id) : undefined; },
        has(id) { return typeof id === 'string' && entries.has(id); },
        list() { return [...entries.values()]; },
        get size() { return entries.size; }
    });
}
