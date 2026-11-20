export const CURRENT_SAVE_VERSION = 1;

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Applies sequential, idempotent envelope migrations before player normalization. */
export function migrateSaveData(saved) {
    if (!isRecord(saved) || !isRecord(saved.player)) return { ok: false, error: 'invalid_save' };
    let version = Number.isSafeInteger(saved.schemaVersion) ? saved.schemaVersion : 0;
    if (version < 0 || version > CURRENT_SAVE_VERSION) return { ok: false, error: 'unsupported_save_version' };
    let data = { ...saved };
    while (version < CURRENT_SAVE_VERSION) {
        if (version === 0) {
            data = { ...data, schemaVersion: 1 };
            version = 1;
        } else {
            return { ok: false, error: 'missing_save_migration' };
        }
    }
    return { ok: true, data };
}
