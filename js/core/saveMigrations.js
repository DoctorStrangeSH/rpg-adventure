export const CURRENT_SAVE_VERSION = 2;

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Applies sequential, idempotent envelope migrations before player normalization. */
export function migrateSaveData(saved) {
    if (!isRecord(saved) || !isRecord(saved.player)) return { ok: false, error: 'invalid_save' };
    const hasVersion = Object.hasOwn(saved, 'schemaVersion');
    if (hasVersion && (!Number.isSafeInteger(saved.schemaVersion) || saved.schemaVersion < 0)) {
        return { ok: false, error: 'unsupported_save_version' };
    }
    let version = hasVersion ? saved.schemaVersion : 0;
    if (version > CURRENT_SAVE_VERSION) return { ok: false, error: 'unsupported_save_version' };
    let data = { ...saved };
    while (version < CURRENT_SAVE_VERSION) {
        if (version === 0) {
            data = { ...data, schemaVersion: 1 };
            version = 1;
        } else if (version === 1) {
            data = {
                ...data,
                schemaVersion: 2,
                player: { ...data.player, dungeonProgress: data.player.dungeonProgress ?? {} }
            };
            version = 2;
        } else {
            return { ok: false, error: 'missing_save_migration' };
        }
    }
    return { ok: true, data };
}
