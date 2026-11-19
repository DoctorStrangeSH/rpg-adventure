// Visual-only necromancy feedback. Damage and healing are resolved by combat.js.
export function getSoulDrainPhase(elapsed, duration = 30) {
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= duration) return null;
    const progress = elapsed / duration;
    return { progress, opacity: Math.min(1, progress * 5, (1 - progress) * 5) };
}

export class BossSpellFx {
    constructor() { this.spells = []; }

    clear() { this.spells = []; }

    start(kind, source, target, frame) {
        if (kind !== 'siphon' || !source || !target) return;
        this.spells.push({ kind, frame,
            source: { x: source.x, y: source.y - 40 },
            target: { x: target.x, y: target.y - 35 } });
    }

    draw(ctx, frame) {
        this.spells = this.spells.filter(spell => getSoulDrainPhase(frame - spell.frame));
        for (const spell of this.spells) {
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
}
