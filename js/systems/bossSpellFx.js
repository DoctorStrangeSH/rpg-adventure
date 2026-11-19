// Visual-only necromancy feedback. Damage and healing are resolved by combat.js.
export function getSoulDrainPhase(elapsed, duration = 30) {
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= duration) return null;
    const progress = elapsed / duration;
    return { progress, opacity: Math.min(1, progress * 5, (1 - progress) * 5) };
}

export function getFlameBreathPhase(elapsed, duration = 30) {
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= duration) return null;
    const progress = elapsed / duration;
    return { progress, reach: Math.min(1, progress * 2.8), opacity: Math.min(1, progress * 6, (1 - progress) * 5) };
}

export class BossSpellFx {
    constructor() { this.spells = []; }

    clear() { this.spells = []; }

    start(kind, source, target, frame) {
        if (!['siphon', 'flame_breath'].includes(kind) || !source || !target) return;
        this.spells.push({ kind, frame,
            source: { x: source.x, y: source.y - 40 },
            target: { x: target.x, y: target.y - 35 } });
    }

    draw(ctx, frame) {
        this.spells = this.spells.filter(spell => spell.kind === 'siphon'
            ? getSoulDrainPhase(frame - spell.frame) : getFlameBreathPhase(frame - spell.frame));
        for (const spell of this.spells) {
            if (spell.kind === 'flame_breath') {
                this.drawFlameBreath(ctx, spell, frame);
                continue;
            }
            const phase = getSoulDrainPhase(frame - spell.frame);
            const { source, target } = spell;
            const sway = Math.sin(phase.progress * Math.PI * 4) * 13;
            const middleX = (source.x + target.x) / 2;
            const middleY = (source.y + target.y) / 2 - 25;
            ctx.save();
            ctx.globalAlpha = phase.opacity;
            ctx.strokeStyle = '#4f284c';
            ctx.lineWidth = 11;
            ctx.beginPath();
            ctx.moveTo(target.x, target.y);
            ctx.quadraticCurveTo(middleX, middleY + sway, source.x, source.y);
            ctx.stroke();
            ctx.strokeStyle = '#d17cae';
            ctx.lineWidth = 3;
            ctx.stroke();
            const orbX = target.x + (source.x - target.x) * phase.progress;
            const orbY = target.y + (source.y - target.y) * phase.progress - Math.sin(phase.progress * Math.PI) * 24;
            ctx.fillStyle = '#f6d8ef';
            ctx.beginPath();
            ctx.arc(orbX, orbY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    drawFlameBreath(ctx, spell, frame) {
        const phase = getFlameBreathPhase(frame - spell.frame);
        const { source, target } = spell;
        const tipX = source.x + (target.x - source.x) * phase.reach;
        const tipY = source.y + (target.y - source.y) * phase.reach;
        const angle = Math.atan2(target.y - source.y, target.x - source.x);
        const length = Math.hypot(tipX - source.x, tipY - source.y);
        ctx.save();
        ctx.globalAlpha = phase.opacity;
        ctx.translate(source.x, source.y);
        ctx.rotate(angle);
        // Layered tapering flames with stable geometry and no random flicker.
        for (const [width, color] of [[30, '#a52e28'], [22, '#f26f37'], [11, '#ffdf8e']]) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(0, -width / 3);
            ctx.quadraticCurveTo(length * 0.45, -width, length, 0);
            ctx.quadraticCurveTo(length * 0.45, width, 0, width / 3);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }
}
