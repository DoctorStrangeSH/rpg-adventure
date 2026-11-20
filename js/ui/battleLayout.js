// One responsive coordinate system for overworld, dungeon and boss encounters.
export function getBattleCanvasSize(width, height) {
    const safeWidth = Number.isFinite(width) && width > 0 ? Math.round(width) : 1;
    const safeHeight = Number.isFinite(height) && height > 0 ? Math.round(height) : 1;
    return { width: safeWidth, height: safeHeight };
}

export function getBattlePositions(width, height, isBoss = false) {
    const w = Number.isFinite(width) && width > 0 ? width : 400;
    const h = Number.isFinite(height) && height > 0 ? height : 300;
    const playerY = Math.max(90, Math.min(200, h - 40));
    const enemyY = Math.max(90, Math.min(isBoss ? 150 : 200, h - 40));
    return {
        player: { x: Math.round(w * 0.25), y: playerY },
        enemy: { x: Math.round(w * 0.75), y: enemyY }
    };
}
