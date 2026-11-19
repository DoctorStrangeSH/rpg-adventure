// Cosmetic, frame-based projectiles. Combat damage remains authoritative in combat.js.
export function projectilePosition(start, end, elapsed, duration = 18) {
    const progress = Number.isFinite(elapsed) && Number.isFinite(duration) && duration > 0
        ? Math.max(0, Math.min(1, elapsed / duration)) : 0;
    return {
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress - Math.sin(progress * Math.PI) * 18,
        progress
    };
}

export function getProjectileEffectPhase(kind, elapsed) {
    if (!Number.isFinite(elapsed) || elapsed < 0) return 'inactive';
    if (kind === 'fireball') return elapsed < 18 ? 'flight' : elapsed < 30 ? 'impact' : 'inactive';
    if (kind === 'frost_nova') return elapsed < 12 ? 'flight' : elapsed < 30 ? 'impact' : 'inactive';
    if (kind === 'mage' || kind === 'archer') return elapsed < 18 ? 'flight' : elapsed < 27 ? 'impact' : 'inactive';
    return 'inactive';
}

export class ProjectileFx {
    constructor() {
        this.effects = [];
    }

    clear() {
        this.effects = [];
    }

    launch(kind, source, target, frame) {
        if (!['mage', 'archer', 'fireball', 'frost_nova'].includes(kind) || !source || !target ||
            !Number.isFinite(frame) || !Number.isFinite(source.x) || !Number.isFinite(source.y) ||
            !Number.isFinite(target.x) || !Number.isFinite(target.y)) return;
        this.effects.push({ kind, source: { ...source }, target: { ...target }, frame });
    }

    draw(ctx, frame) {
        this.effects = this.effects.filter(effect => getProjectileEffectPhase(effect.kind, frame - effect.frame) !== 'inactive');
        for (const effect of this.effects) {
            const elapsed = frame - effect.frame;
            const duration = effect.kind === 'frost_nova' ? 12 : 18;
            const position = projectilePosition(effect.source, effect.target, elapsed, duration);
            ctx.save();
            const phase = getProjectileEffectPhase(effect.kind, elapsed);
            if (phase === 'impact' && effect.kind === 'frost_nova') {
                const age = elapsed - duration;
                const radius = 8 + age * 3.2;
                ctx.globalAlpha = Math.max(0, 1 - age / 18);
                ctx.strokeStyle = '#a9f3ff';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(effect.target.x, effect.target.y, radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.strokeStyle = '#e4fbff';
                ctx.lineWidth = 1.5;
                for (let shard = 0; shard < 6; shard++) {
                    const angle = shard * Math.PI / 3 + age * 0.025;
                    const inner = radius * 0.35;
                    const outer = radius * 1.35;
                    ctx.beginPath();
                    ctx.moveTo(effect.target.x + Math.cos(angle) * inner,
                        effect.target.y + Math.sin(angle) * inner);
                    ctx.lineTo(effect.target.x + Math.cos(angle) * outer,
                        effect.target.y + Math.sin(angle) * outer);
                    ctx.stroke();
                }
            } else if (phase === 'impact' && effect.kind === 'fireball') {
                const age = elapsed - duration;
                const radius = 7 + age * 2.8;
                ctx.globalAlpha = Math.max(0, 1 - age / 12);
                ctx.fillStyle = '#ff9b42';
                ctx.beginPath();
                ctx.arc(effect.target.x, effect.target.y, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff0a6';
                ctx.beginPath();
                ctx.arc(effect.target.x, effect.target.y, radius * 0.48, 0, Math.PI * 2);
                ctx.fill();
            } else if (phase === 'impact') {
                const radius = (elapsed - 17) * 4;
                ctx.globalAlpha = Math.max(0, (27 - elapsed) / 9);
                ctx.strokeStyle = effect.kind === 'mage' ? '#77f1ef' : '#e4c48e';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(effect.target.x, effect.target.y, radius, 0, Math.PI * 2);
                ctx.stroke();
            } else if (effect.kind === 'fireball') {
                ctx.translate(position.x, position.y);
                const flicker = Math.sin(elapsed * 0.9) * 2;
                ctx.fillStyle = '#e85b2a';
                ctx.beginPath();
                ctx.ellipse(-2, 0, 12 + flicker, 7 + flicker * 0.25, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffb347';
                ctx.beginPath();
                ctx.ellipse(2, 0, 8, 5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff0a6';
                ctx.beginPath();
                ctx.arc(4, -1, 3, 0, Math.PI * 2);
                ctx.fill();
            } else if (effect.kind === 'frost_nova') {
                ctx.translate(position.x, position.y);
                ctx.rotate(elapsed * 0.08);
                ctx.strokeStyle = '#b8f4ff';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
                ctx.moveTo(0, -10); ctx.lineTo(0, 10);
                ctx.moveTo(-7, -7); ctx.lineTo(7, 7);
                ctx.moveTo(-7, 7); ctx.lineTo(7, -7);
                ctx.stroke();
                ctx.fillStyle = '#f0fdff';
                ctx.beginPath();
                ctx.arc(0, 0, 3, 0, Math.PI * 2);
                ctx.fill();
            } else if (effect.kind === 'mage') {
                // Three nested, sharp-edged rune diamonds, no image scaling blur.
                ctx.translate(position.x, position.y);
                ctx.rotate(Math.PI / 4 + elapsed * 0.12);
                for (const [size, color] of [[13, '#2b7c92'], [9, '#75e0e9'], [4, '#f1fff8']]) {
                    ctx.fillStyle = color;
                    ctx.fillRect(-size / 2, -size / 2, size, size);
                }
            } else {
                const angle = Math.atan2(effect.target.y - effect.source.y, effect.target.x - effect.source.x);
                ctx.translate(position.x, position.y);
                ctx.rotate(angle);
                ctx.strokeStyle = '#e8d7b4';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(-16, 0);
                ctx.lineTo(10, 0);
                ctx.stroke();
                ctx.fillStyle = '#d4a15e';
                ctx.beginPath();
                ctx.moveTo(14, 0);
                ctx.lineTo(6, -5);
                ctx.lineTo(6, 5);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#9a6c50';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-16, -5);
                ctx.lineTo(-11, 0);
                ctx.lineTo(-16, 5);
                ctx.stroke();
            }
            ctx.restore();
        }
    }
}
