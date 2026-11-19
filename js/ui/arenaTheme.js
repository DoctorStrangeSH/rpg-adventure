// Region colour grading until dedicated hand-painted arena backgrounds ship.
const THEMES = Object.freeze({
    forest: { top: 'rgba(13,37,28,0.34)', bottom: 'rgba(25,66,40,0.22)', glow: 'rgba(113,174,119,0.18)', mote: '#b9e89c', drift: -0.12 },
    mountains: { top: 'rgba(19,34,54,0.34)', bottom: 'rgba(90,112,137,0.20)', glow: 'rgba(151,190,224,0.17)', mote: '#cbddec', drift: 0.22 },
    ruins: { top: 'rgba(26,15,41,0.40)', bottom: 'rgba(81,40,78,0.23)', glow: 'rgba(179,111,173,0.16)', mote: '#ce9bda', drift: -0.07 },
    dragon_lair: { top: 'rgba(52,15,18,0.44)', bottom: 'rgba(134,43,21,0.32)', glow: 'rgba(254,125,68,0.23)', mote: '#ffad64', drift: -0.32 }
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
    // Deterministic motes: no allocations or random numbers inside the render loop.
    ctx.fillStyle = theme.mote;
    const motes = width < 400 ? 8 : 14;
    for (let i = 0; i < motes; i++) {
        const x = ((i * 79.3 + frame * (0.08 + i % 3 * 0.03)) % width + width) % width;
        const initialY = i * 47.7 + Math.sin(i * 13.1) * 37;
        const y = ((initialY + frame * theme.drift) % height + height) % height;
        ctx.globalAlpha = 0.15 + (Math.sin(frame * 0.036 + i * 2.1) + 1) * 0.17;
        ctx.fillRect(x, y, i % 4 === 0 ? 3 : 2, i % 4 === 0 ? 3 : 2);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
}
