/**
 * Small save transaction helpers for player-facing inventory operations.
 * Snapshots use the same JSON contract as localStorage-backed player saves.
 */
export function createPlayerSnapshot(player) {
    if (!player || typeof player !== 'object' || Array.isArray(player)) return null;
    try {
        return JSON.parse(JSON.stringify(player));
    } catch {
        return null;
    }
}

/** Restore the original player object in place so existing UI/system references stay valid. */
export function restorePlayerSnapshot(player, snapshot) {
    if (!player || !snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false;
    for (const key of Object.keys(player)) delete player[key];
    Object.assign(player, snapshot);
    return true;
}

/**
 * Commit a previously snapshotted mutation. A failed or throwing save restores
 * the player in memory and returns false; callers must not show success feedback.
 */
export function commitPlayerMutation(player, snapshot, save) {
    if (typeof save !== 'function') {
        restorePlayerSnapshot(player, snapshot);
        return false;
    }
    try {
        if (save() === true) return true;
    } catch {
        // Treat unexpected persistence errors exactly like a reported write failure.
    }
    restorePlayerSnapshot(player, snapshot);
    return false;
}
