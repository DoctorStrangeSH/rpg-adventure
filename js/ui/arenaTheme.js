// Region colour grading until dedicated hand-painted arena backgrounds ship.
const THEMES = Object.freeze({
    forest: { top: 'rgba(13,37,28,0.34)', bottom: 'rgba(25,66,40,0.22)', glow: 'rgba(113,174,119,0.18)' },
    mountains: { top: 'rgba(19,34,54,0.34)', bottom: 'rgba(90,112,137,0.20)', glow: 'rgba(151,190,224,0.17)' },
    ruins: { top: 'rgba(26,15,41,0.40)', bottom: 'rgba(81,40,78,0.23)', glow: 'rgba(179,111,173,0.16)' },
    dragon_lair: { top: 'rgba(52,15,18,0.44)', bottom: 'rgba(134,43,21,0.32)', glow: 'rgba(254,125,68,0.23)' }
});

export function getArenaTheme(locationId, enemyId) {
    if (THEMES[locationId]) return THEMES[locationId];
    if (['dragon', 'ancient_dragon', 'mountain_dragon'].includes(enemyId)) return THEMES.dragon_lair;
    return null;
}

export function drawArenaAtmosphere(ctx, width, height, theme, frame = 0) {
    if (!theme || width <= 0 || height <= 0) return;
    ctx.save();
    const tint = ctx.createLinearGradient(0, 0, 0, height);
    tint.addColorStop(0, theme.top);
    tint.addColorStop(1, theme.bottom);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, width, height);
    // A slowly breathing light source gives each region a distinct ambience.
    const glowX = width * (0.5 + Math.sin(frame * 0.004) * 0.04);
    const light = ctx.createRadialGradient(glowX, height * 0.45, 0,
        glowX, height * 0.45, Math.max(width, height) * 0.62);
    light.addColorStop(0, theme.glow);
    light.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
}
