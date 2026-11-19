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

export class ProjectileFx {
    constructor() {
        this.effects = [];
    }

    clear() {
        this.effects = [];
    }

    launch(kind, source, target, frame) {
        if (!['mage', 'archer'].includes(kind) || !source || !target) return;
        this.effects.push({ kind, source: { ...source }, target: { ...target }, frame });
    }

    draw(ctx, frame) {
        this.effects = this.effects.filter(effect => frame - effect.frame <= 26 && frame >= effect.frame);
        for (const effect of this.effects) {
            const elapsed = frame - effect.frame;
            const position = projectilePosition(effect.source, effect.target, elapsed);
            ctx.save();
            if (elapsed >= 18) {
                const radius = (elapsed - 17) * 4;
                ctx.globalAlpha = Math.max(0, (27 - elapsed) / 9);
                ctx.strokeStyle = effect.kind === 'mage' ? '#77f1ef' : '#e4c48e';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(effect.target.x, effect.target.y, radius, 0, Math.PI * 2);
                ctx.stroke();
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
