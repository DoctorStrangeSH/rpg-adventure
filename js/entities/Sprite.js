// Класс спрайта с отрисовкой
// Illustrated characters load once and remain optional so low-connectivity clients
// and test environments can fall back to the original canvas silhouettes.
const HERO_IMAGES = {};
const HERO_ATTACK_IMAGES = {};
const HERO_GUARD_IMAGES = {};
if (typeof Image !== 'undefined') {
    for (const hero of ['warrior', 'mage', 'archer']) {
        const image = new Image();
        image.src = `assets/characters/heroes/${hero}-idle.png`;
        HERO_IMAGES[hero] = image;
    }
    for (const hero of ['warrior', 'mage', 'archer']) {
        const attack = new Image();
        attack.src = `assets/characters/heroes/${hero}-attack.png`;
        HERO_ATTACK_IMAGES[hero] = attack;
    }
    const warriorGuard = new Image();
    warriorGuard.src = 'assets/characters/heroes/warrior-guard.png';
    HERO_GUARD_IMAGES.warrior = warriorGuard;
    for (const enemy of ['skeleton', 'wolf', 'goblin']) {
        const idle = new Image();
        idle.src = `assets/characters/enemies/${enemy}-idle.png`;
        HERO_IMAGES[enemy] = idle;
        const attack = new Image();
        attack.src = `assets/characters/enemies/${enemy}-attack.png`;
        HERO_ATTACK_IMAGES[enemy] = attack;
    }
}

// Validate a uniform grid atlas before drawing. Invalid dimensions return null
// so the existing procedural/canvas fallback remains available.
export function getGridAtlasFrame(imageWidth, imageHeight, columns, rows, frameIndex) {
    if (!Number.isInteger(imageWidth) || imageWidth <= 0 ||
        !Number.isInteger(imageHeight) || imageHeight <= 0 ||
        !Number.isInteger(columns) || columns <= 0 ||
        !Number.isInteger(rows) || rows <= 0 ||
        imageWidth % columns !== 0 || imageHeight % rows !== 0 ||
        !Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= columns * rows) {
        return null;
    }
    const width = imageWidth / columns;
    const height = imageHeight / rows;
    return {
        x: (frameIndex % columns) * width,
        y: Math.floor(frameIndex / columns) * height,
        width,
        height
    };
}

// Horizontal compatibility wrapper for existing four-frame character sheets.
export function getHorizontalAtlasFrame(imageWidth, imageHeight, frameCount, frameIndex) {
    return getGridAtlasFrame(imageWidth, imageHeight, frameCount, 1, frameIndex);
}

// Short visual blend at state boundaries. It changes opacity only, never the
// attack/guard duration or the number of combat actions.
export function getHeroStateBlend(elapsed, duration = 4) {
    if (!Number.isFinite(elapsed) || !Number.isFinite(duration) || duration <= 0 || elapsed < 0) return 0;
    const progress = Math.max(0, Math.min(1, elapsed / duration));
    return progress * progress * (3 - 2 * progress);
}

export function getEquipmentDrawRect(imageWidth, imageHeight, anchor, targetHeight = 54) {
    if (!Number.isFinite(imageWidth) || imageWidth <= 0 ||
        !Number.isFinite(imageHeight) || imageHeight <= 0 ||
        !anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y) ||
        !Number.isFinite(targetHeight) || targetHeight <= 0) return null;
    const height = targetHeight;
    const width = height * imageWidth / imageHeight;
    return { x: anchor.x - width / 2, y: anchor.y - height / 2, width, height };
}

export function getHeroEquipmentAnchor(heroType, equipment, pose = 'idle') {
    if (!['warrior', 'mage', 'archer'].includes(heroType)) return null;
    if (!['weapon', 'shield', 'back'].includes(equipment)) return null;
    const anchors = {
        warrior: {
            idle: { weapon: [20, -43], shield: [-19, -35], back: [0, -74] },
            attack: { weapon: [27, -46], shield: [-17, -32], back: [0, -74] },
            guard: { weapon: [17, -39], shield: [-23, -38], back: [0, -74] }
        },
        mage: {
            idle: { weapon: [19, -43], shield: [-18, -34], back: [0, -73] },
            attack: { weapon: [24, -48], shield: [-18, -34], back: [0, -73] },
            guard: { weapon: [19, -43], shield: [-18, -34], back: [0, -73] }
        },
        archer: {
            idle: { weapon: [20, -42], shield: [-18, -34], back: [0, -73] },
            attack: { weapon: [25, -45], shield: [-18, -34], back: [0, -73] },
            guard: { weapon: [20, -42], shield: [-18, -34], back: [0, -73] }
        }
    };
    const selectedPose = anchors[heroType][pose] || anchors[heroType].idle;
    const [x, y] = selectedPose[equipment];
    return { x, y, originX: 0, originY: -30 };
}

// Four hand-drawn attack frames, each lasting seven render ticks. The index
// is clamped so slower devices cannot draw beyond the last sprite-sheet cell.
export function getAttackFrame(elapsed, frames = 4, ticksPerFrame = 7) {
    if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
    return Math.max(0, Math.min(frames - 1, Math.floor(elapsed / ticksPerFrame)));
}

// Three visual beats fit inside the existing 28-tick attack window. This is
// presentation only: it does not schedule extra hits or alter combat turns.
export function getWarriorComboPose(elapsed) {
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= 28) return null;
    if (elapsed < 9) {
        const p = elapsed / 9;
        return { phase: 0, rotation: -0.12 * Math.sin(p * Math.PI), offsetX: -3 * p, scaleX: 1 };
    }
    if (elapsed < 18) {
        const p = (elapsed - 9) / 9;
        return { phase: 1, rotation: 0.18 * Math.sin(p * Math.PI), offsetX: 4 * p, scaleX: -1 };
    }
    const p = (elapsed - 18) / 10;
    return { phase: 2, rotation: 0.28 * Math.sin(p * Math.PI), offsetX: 5 * (1 - p), scaleX: 1 + 0.04 * Math.sin(p * Math.PI) };
}

// The counter flash is a presentation cue for the already-resolved parry
// damage; it never creates another combat action.
export function getWarriorCounterPose(elapsed) {
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= 18) return null;
    const progress = elapsed / 18;
    const strike = Math.sin(Math.min(progress / 0.62, 1) * Math.PI / 2);
    return {
        progress,
        offsetX: 8 * strike,
        rotation: -0.34 * strike + (progress > 0.62 ? 0.08 * (progress - 0.62) / 0.38 : 0),
        alpha: progress < 0.62 ? 1 : 1 - (progress - 0.62) / 0.38,
        radius: 12 + progress * 24
    };
}

export function getWarriorVisualPose(attacking, guarding) {
    return attacking ? 'attack' : guarding ? 'guard' : 'idle';
}

// A compact four-step shield raise, followed by a stable held guard pose.
export function getWarriorGuardMotion(elapsed) {
    if (!Number.isFinite(elapsed) || elapsed < 0) return { lift: 0, tilt: 0 };
    const progress = Math.min(1, elapsed / 8);
    const eased = 1 - Math.pow(1 - progress, 3);
    return { lift: eased * 7, tilt: eased * -0.045 };
}

export function getWarriorParryPulse(elapsed) {
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= 14) return null;
    const progress = elapsed / 14;
    return { radius: 12 + progress * 29, alpha: 1 - progress };
}

// The casting sigil follows the same 28-tick attack window as the hero atlas.
export function getMageCastEffect(elapsed) {
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= 28) return null;
    const progress = elapsed / 28;
    const charge = progress < 0.68 ? progress / 0.68 : 1 - (progress - 0.68) / 0.32;
    return {
        progress,
        charge: Math.max(0, Math.min(1, charge)),
        radius: 13 + Math.max(0, Math.min(1, charge)) * 13,
        alpha: progress < 0.68 ? 0.45 + charge * 0.5 : Math.max(0, 1 - (progress - 0.68) / 0.32)
    };
}

export function getWarriorDeathPose(elapsed) {
    if (!Number.isFinite(elapsed) || elapsed < 0) {
        return { rotation: 0, offsetY: 0, alpha: 1, active: false };
    }
    if (elapsed < 12) {
        const p = elapsed / 12;
        return { rotation: p === 0 ? 0 : -0.08 * p, offsetY: p * 2, alpha: 1, active: true };
    }
    if (elapsed < 30) {
        const p = (elapsed - 12) / 18;
        return { rotation: -0.08 - p * 0.24, offsetY: 2 + p * 12, alpha: 1, active: true };
    }
    if (elapsed < 54) {
        const p = (elapsed - 30) / 24;
        return { rotation: -0.32 - p * 1.12, offsetY: 14 + p * 18, alpha: 1, active: true };
    }
    if (elapsed < 72) {
        const p = (elapsed - 54) / 18;
        return { rotation: -1.44, offsetY: 32, alpha: 1 - p * 0.18, active: true };
    }
    return { rotation: -1.44, offsetY: 32, alpha: 0.82, active: false };
}

// Each hero gets a distinct defeat silhouette within the shared 72-tick window.
// The last pose remains stable while the battle screen fades out.
export function getHeroDeathPose(type, elapsed) {
    if (type === 'warrior') return getWarriorDeathPose(elapsed);
    if (!Number.isFinite(elapsed) || elapsed < 0) {
        return { rotation: 0, offsetX: 0, offsetY: 0, alpha: 1, active: false };
    }
    if (type === 'mage') {
        const p = Math.min(elapsed / 72, 1);
        const dissolve = Math.max(0, (p - 0.18) / 0.82);
        return {
            rotation: -0.1 * Math.min(p * 3, 1),
            offsetX: -5 * p,
            offsetY: -14 * p,
            alpha: Math.max(0, 1 - dissolve),
            active: elapsed < 72
        };
    }
    if (type === 'archer') {
        const stagger = Math.min(elapsed / 15, 1);
        const fall = Math.min(Math.max((elapsed - 15) / 35, 0), 1);
        return {
            rotation: 0.12 * stagger + 1.27 * fall,
            offsetX: 5 * stagger + 15 * fall,
            offsetY: 3 * stagger + 30 * fall,
            alpha: 1 - 0.22 * Math.min(Math.max((elapsed - 50) / 22, 0), 1),
            active: elapsed < 72
        };
    }
    return getWarriorDeathPose(elapsed);
}

// Deterministic particles: no random flicker when frames are skipped or redrawn.
export function getMageDeathMotes(elapsed) {
    if (!Number.isFinite(elapsed) || elapsed < 10 || elapsed >= 72) return [];
    const progress = (elapsed - 10) / 62;
    return Array.from({ length: 14 }, (_, index) => {
        const angle = index * 2.39996;
        const distance = 9 + progress * (25 + index % 5 * 7);
        return {
            x: Math.cos(angle) * distance,
            y: -40 - progress * (18 + index % 4 * 9) + Math.sin(angle) * distance * 0.6,
            size: index % 3 === 0 ? 3 : 2,
            alpha: Math.min(1, progress * 5) * (1 - progress),
            color: index % 3 === 0 ? '#e1fbff' : index % 2 ? '#7ee3ff' : '#bd91ff'
        };
    });
}

// A short two-beat impact: recoil away from the attacker, then settle.
// Computed from render ticks, so no delayed callback can affect the next fight.
export function getHitFeedback(elapsed, duration = 16) {
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= duration) {
        return { recoil: 0, flash: false, active: false };
    }
    const progress = elapsed / duration;
    return {
        recoil: Math.sin(progress * Math.PI) * 9,
        flash: elapsed < 5 || (elapsed >= 7 && elapsed < 10),
        active: true
    };
}

export function getHeroHitPose(type, elapsed) {
    const base = getHitFeedback(elapsed);
    if (!base.active) return { ...base, rotation: 0, offsetY: 0, glow: 0 };
    const progress = elapsed / 16;
    if (type === 'mage') {
        return { ...base, recoil: base.recoil * 0.72, rotation: -0.12 * Math.sin(progress * Math.PI),
            offsetY: -3 * Math.sin(progress * Math.PI), glow: progress < 0.3 ? 0.7 : 0.15 };
    }
    if (type === 'archer') {
        return { ...base, recoil: base.recoil * 1.18, rotation: 0.16 * Math.sin(progress * Math.PI),
            offsetY: 2 * Math.sin(progress * Math.PI), glow: progress < 0.25 ? 0.35 : 0 };
    }
    if (type === 'warrior') {
        return { ...base, recoil: base.recoil * 0.82, rotation: -0.045 * Math.sin(progress * Math.PI),
            offsetY: 0, glow: progress < 0.25 ? 0.2 : 0 };
    }
    return { ...base, rotation: 0, offsetY: 0, glow: 0 };
}

// Location bosses must remain visible even before their dedicated atlases ship.
// Keep these aliases explicit so a newly added boss cannot silently disappear.
export const BOSS_FALLBACKS = Object.freeze({
    forest_guardian: 'dragon',
    mountain_giant: 'death_knight',
    mountain_dragon: 'ancient_dragon',
    world_eater: 'ancient_dragon'
});

// A readable four-pose windup/slash/recovery loop for the Death Knight.
// The pose follows the attack state and never modifies combat timing.
export function getDeathKnightPose(elapsed, attacking) {
    if (!attacking || !Number.isFinite(elapsed) || elapsed < 0) return 'idle';
    if (elapsed < 6) return 'windup';
    if (elapsed < 13) return 'slash';
    if (elapsed < 20) return 'recovery';
    return 'idle';
}

export function getLichSpellPhase(elapsed, attacking) {
    if (!attacking || !Number.isFinite(elapsed) || elapsed < 0) return 'idle';
    if (elapsed < 8) return 'summon';
    if (elapsed < 19) return 'release';
    return 'idle';
}

export function getDragonWingLift(frame, ancient = false) {
    if (!Number.isFinite(frame)) return 0;
    const speed = ancient ? 0.045 : 0.085;
    const amplitude = ancient ? 19 : 13;
    return Math.sin(frame * speed) * amplitude;
}

export class Sprite {
    constructor(type, x, y) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = 60;
        this.height = 60;
        this.isAttacking = false;
        this.isGuarding = false;
        this.isHit = false;
        this.attackStartFrame = null;
        this.hitStartFrame = null;
        this.guardStartFrame = null;
        this.visualState = 'idle';
        this.visualStateStartFrame = 0;
        this.parryStartFrame = null;
        this.counterStartFrame = null;
        this.deathStartFrame = null;
        this.equipmentLayers = Object.create(null);
    }

    loadEquipmentLayer(slot, source, options = {}, ImageConstructor = globalThis.Image) {
        if (!['weapon', 'shield', 'back'].includes(slot) ||
            typeof source !== 'string' || source.trim() === '' ||
            typeof ImageConstructor !== 'function') return Promise.resolve(false);
        return new Promise(resolve => {
            const image = new ImageConstructor();
            image.onload = () => {
                const accepted = this.setEquipmentLayer(slot, image, options);
                resolve(accepted);
            };
            image.onerror = () => {
                if (this.equipmentLayers[slot]?.image === image) {
                    delete this.equipmentLayers[slot];
                }
                resolve(false);
            };
            image.src = source;
        });
    }

    removeEquipmentLayer(slot) {
        if (!['weapon', 'shield', 'back'].includes(slot)) return false;
        const existed = Object.hasOwn(this.equipmentLayers, slot);
        delete this.equipmentLayers[slot];
        return existed;
    }

    setEquipmentLayer(slot, image, options = {}) {
        if (!['weapon', 'shield', 'back'].includes(slot)) return false;
        if (!image || typeof image !== 'object') {
            delete this.equipmentLayers[slot];
            return false;
        }
        const targetHeight = Number.isFinite(options.targetHeight) && options.targetHeight > 0
            ? options.targetHeight : (slot === 'shield' ? 48 : 58);
        const rotation = Number.isFinite(options.rotation) ? options.rotation : 0;
        this.equipmentLayers[slot] = { image, targetHeight, rotation };
        return true;
    }

    drawEquipmentLayers(ctx, pose) {
        const order = ['back', 'weapon', 'shield'];
        for (const slot of order) {
            const layer = this.equipmentLayers[slot];
            const image = layer?.image;
            if (!image?.complete || !Number.isFinite(image.naturalWidth) ||
                !Number.isFinite(image.naturalHeight) || image.naturalWidth <= 0 ||
                image.naturalHeight <= 0) continue;
            const anchor = getHeroEquipmentAnchor(this.type, slot, pose);
            const rect = getEquipmentDrawRect(image.naturalWidth, image.naturalHeight,
                anchor, layer.targetHeight);
            if (!rect) continue;
            ctx.save();
            ctx.translate(anchor.x, anchor.y);
            ctx.rotate(layer.rotation);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(image, -rect.width / 2, -rect.height / 2, rect.width, rect.height);
            ctx.restore();
        }
    }

    beginDeath(frame) {
        this.deathStartFrame = Number.isFinite(frame) ? frame : 0;
        this.isAttacking = false;
        this.isGuarding = false;
        this.attackStartFrame = null;
        this.guardStartFrame = null;
        this.hitStartFrame = null;
    }

    startParry(frame) {
        this.parryStartFrame = Number.isFinite(frame) ? frame : 0;
    }

    startCounter(frame) {
        this.counterStartFrame = Number.isFinite(frame) ? frame : 0;
    }

    receiveHit(frame) {
        this.hitStartFrame = frame;
    }
    
    draw(ctx, frame) {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.deathStartFrame !== null) {
            const death = getHeroDeathPose(this.type, frame - this.deathStartFrame);
            ctx.translate(death.offsetX ?? 0, death.offsetY);
            ctx.translate(0, 30);
            ctx.rotate(death.rotation);
            ctx.translate(0, -30);
            ctx.globalAlpha *= death.alpha;
        }
        if (this.isAttacking && this.attackStartFrame === null) this.attackStartFrame = frame;
        if (!this.isAttacking) this.attackStartFrame = null;
        
        // Preserve the legacy lunge only while illustrated animation is unavailable.
        const attackImage = HERO_ATTACK_IMAGES[this.type];
        if (this.isAttacking && this.type !== 'warrior' &&
            !(attackImage?.complete && attackImage.naturalWidth > 0)) {
            ctx.translate(this.type === 'mage' || this.type === 'archer' ? 20 : -12, 0);
        }
        
        const hit = getHeroHitPose(this.type, frame - (this.hitStartFrame ?? Number.NEGATIVE_INFINITY));
        if (hit.active) {
            ctx.translate(this.type === 'warrior' || this.type === 'mage' || this.type === 'archer'
                ? -hit.recoil : hit.recoil, hit.offsetY);
            ctx.translate(0, 30);
            ctx.rotate(hit.rotation);
            ctx.translate(0, -30);
            if (hit.flash) ctx.filter = 'brightness(1.9) saturate(0.5)';
            if (hit.glow > 0) {
                ctx.shadowColor = this.type === 'mage' ? '#8deaff' :
                    this.type === 'archer' ? '#b9e69b' : '#f3d18b';
                ctx.shadowBlur = 8 * hit.glow;
            }
        } else {
            this.hitStartFrame = null;
        }
        
        if (this.isGuarding && this.guardStartFrame === null) this.guardStartFrame = frame;
        if (!this.isGuarding) this.guardStartFrame = null;
        if (this.type === 'warrior' && this.isAttacking) {
            const combo = getWarriorComboPose(frame - (this.attackStartFrame ?? frame));
            if (combo) {
                ctx.save();
                ctx.translate(combo.offsetX, 0);
                ctx.translate(0, 30);
                ctx.rotate(combo.rotation);
                ctx.scale(combo.scaleX, 1);
                ctx.translate(0, -30);
                this.drawSprite(ctx, frame);
                ctx.restore();
            } else {
                this.drawSprite(ctx, frame);
            }
        } else {
            this.drawSprite(ctx, frame);
        }
        const equipmentPose = getWarriorVisualPose(this.isAttacking, this.isGuarding);
        this.drawEquipmentLayers(ctx, equipmentPose);
        if (this.type === 'mage' && this.isAttacking) {
            const cast = getMageCastEffect(frame - (this.attackStartFrame ?? frame));
            if (cast) {
                const pulse = Math.sin(frame * 0.24) * 2;
                ctx.save();
                ctx.translate(20, -47);
                ctx.globalAlpha = cast.alpha;
                ctx.strokeStyle = '#67e8f9';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.ellipse(0, 0, cast.radius + pulse, cast.radius * 0.42,
                    frame * 0.035, 0, Math.PI * 2);
                ctx.stroke();
                ctx.strokeStyle = '#b7f4ff';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.ellipse(0, 0, cast.radius * 0.68, cast.radius * 0.3,
                    -frame * 0.05, 0, Math.PI * 2);
                ctx.stroke();
                const orbX = Math.cos(cast.progress * Math.PI * 2) * cast.radius;
                const orbY = Math.sin(cast.progress * Math.PI * 2) * cast.radius * 0.42;
                ctx.fillStyle = '#d9fbff';
                ctx.beginPath();
                ctx.arc(orbX, orbY, 2.5 + cast.charge * 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
        if (this.type === 'warrior' && this.counterStartFrame !== null) {
            const counter = getWarriorCounterPose(frame - this.counterStartFrame);
            if (counter) {
                ctx.save();
                ctx.globalAlpha = counter.alpha;
                ctx.translate(counter.offsetX, 0);
                ctx.translate(0, 30);
                ctx.rotate(counter.rotation);
                ctx.translate(0, -30);
                ctx.strokeStyle = '#fff0b3';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(24, -42, counter.radius, -0.95, 0.82);
                ctx.stroke();
                ctx.strokeStyle = '#f4d58a';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(24, -42, counter.radius * 0.72, -0.8, 0.65);
                ctx.stroke();
                ctx.restore();
            } else if (frame - this.counterStartFrame >= 18) {
                this.counterStartFrame = null;
            }
        }
        if (this.type === 'warrior' && this.parryStartFrame !== null) {
            const pulse = getWarriorParryPulse(frame - this.parryStartFrame);
            if (pulse) {
                ctx.save();
                ctx.globalAlpha = pulse.alpha;
                ctx.strokeStyle = '#f4d58a';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(25, -43, pulse.radius, -1.05, 1.05);
                ctx.stroke();
                ctx.strokeStyle = '#d8efff';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(25, -43, pulse.radius * 0.78, -0.9, 0.9);
                ctx.stroke();
                ctx.restore();
            } else if (frame - this.parryStartFrame >= 14) {
                this.parryStartFrame = null;
            }
        }

        ctx.restore();
        if (this.type === 'mage' && this.deathStartFrame !== null) {
            const motes = getMageDeathMotes(frame - this.deathStartFrame);
            if (motes.length) {
                ctx.save();
                ctx.translate(this.x, this.y);
                for (const mote of motes) {
                    ctx.globalAlpha = mote.alpha;
                    ctx.fillStyle = mote.color;
                    ctx.fillRect(Math.round(mote.x), Math.round(mote.y), mote.size, mote.size);
                }
                ctx.restore();
            }
        }
    }
    
    drawSprite(ctx, frame) {
        const nextState = getWarriorVisualPose(this.isAttacking, this.isGuarding);
        if (nextState !== this.visualState) {
            this.visualState = nextState;
            this.visualStateStartFrame = frame;
        }
        const blend = getHeroStateBlend(frame - this.visualStateStartFrame);
        const heroImage = HERO_IMAGES[this.type];
        const attackImage = HERO_ATTACK_IMAGES[this.type];
        const guardImage = HERO_GUARD_IMAGES[this.type];

        // Draw the resting pose underneath transient action art. Its opacity is
        // reduced by exactly the amount gained by the new state (true crossfade).
        const drawBasePose = (alpha) => {
            if (alpha <= 0) return;
            ctx.save();
            ctx.globalAlpha *= alpha;
            if (heroImage?.complete && heroImage.naturalWidth > 0) {
                const height = 100;
                const width = height * heroImage.naturalWidth / heroImage.naturalHeight;
                const breathing = Math.sin(frame * 0.055) * 2;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(heroImage, -width / 2, 30 - height + breathing, width, height);
            } else {
                const drawFunctions = {
                    warrior: this.drawWarrior, mage: this.drawMage, archer: this.drawArcher,
                    wolf: this.drawWolf, goblin: this.drawGoblin, skeleton: this.drawSkeleton,
                    dragon: this.drawDragon, goblin_king: this.drawGoblinKing,
                    death_knight: this.drawDeathKnight, lich_king: this.drawLichKing,
                    ancient_dragon: this.drawAncientDragon
                };
                const drawFunc = drawFunctions[this.type] || drawFunctions[BOSS_FALLBACKS[this.type]];
                if (drawFunc) {
                    if (BOSS_FALLBACKS[this.type]) ctx.scale(1.18, 1.18);
                    drawFunc.call(this, ctx, frame);
                }
            }
            ctx.restore();
        };

        if (this.isAttacking && attackImage?.complete && attackImage.naturalWidth > 0) {
            const frameIndex = getAttackFrame(frame - (this.attackStartFrame ?? frame),
                4, ['skeleton', 'wolf', 'goblin'].includes(this.type) ? 5 : 7);
            const source = getHorizontalAtlasFrame(attackImage.naturalWidth,
                attackImage.naturalHeight, 4, frameIndex);
            if (source) {
                drawBasePose(1 - blend);
                const height = 112;
                const width = height * source.width / source.height;
                ctx.save();
                ctx.globalAlpha *= blend;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(attackImage, source.x, source.y, source.width,
                    source.height, -width / 2, 30 - height, width, height);
                ctx.restore();
                return;
            }
        }

        if (getWarriorVisualPose(this.isAttacking, this.isGuarding) === 'guard' &&
            guardImage?.complete && guardImage.naturalWidth > 0) {
            drawBasePose(1 - blend);
            const height = 103;
            const width = height * guardImage.naturalWidth / guardImage.naturalHeight;
            const motion = getWarriorGuardMotion(frame - (this.guardStartFrame ?? frame));
            ctx.save();
            ctx.globalAlpha *= blend;
            ctx.translate(0, -motion.lift);
            ctx.rotate(motion.tilt);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(guardImage, -width / 2, 30 - height, width, height);
            ctx.restore();
            return;
        }

        drawBasePose(1);
    }

    drawWarrior(ctx, frame) {
        const bounce = Math.sin(frame * 0.1) * 5;
        ctx.fillStyle = '#4a90e2';
        ctx.fillRect(-20, -30 + bounce, 40, 50);
        ctx.fillStyle = '#ffcc99';
        ctx.beginPath();
        ctx.arc(0, -35 + bounce, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.arc(0, -40 + bounce, 22, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#ccc';
        ctx.fillRect(20, -50 + bounce, 5, 40);
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(15, -15 + bounce, 15, 5);
        ctx.fillStyle = '#000';
        ctx.fillRect(-8, -38 + bounce, 5, 5);
        ctx.fillRect(3, -38 + bounce, 5, 5);
    }
    
    drawMage(ctx, frame) {
        const bounce = Math.sin(frame * 0.1) * 5;
        ctx.fillStyle = '#9c27b0';
        ctx.fillRect(-20, -30 + bounce, 40, 50);
        ctx.fillStyle = '#ffcc99';
        ctx.beginPath();
        ctx.arc(0, -35 + bounce, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6a1b9a';
        ctx.beginPath();
        ctx.moveTo(-25, -40 + bounce);
        ctx.lineTo(0, -70 + bounce);
        ctx.lineTo(25, -40 + bounce);
        ctx.fill();
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(15, -50 + bounce, 5, 40);
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(17, -55 + bounce, 8, 0, Math.PI * 2);
        ctx.fill();
    }
    
    drawArcher(ctx, frame) {
        const bounce = Math.sin(frame * 0.1) * 5;
        ctx.fillStyle = '#4caf50';
        ctx.fillRect(-20, -30 + bounce, 40, 50);
        ctx.fillStyle = '#ffcc99';
        ctx.beginPath();
        ctx.arc(0, -35 + bounce, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#388e3c';
        ctx.beginPath();
        ctx.arc(0, -35 + bounce, 22, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(20, -20 + bounce, 30, -Math.PI/2, Math.PI/2);
        ctx.stroke();
    }
    
    drawWolf(ctx, frame) {
        const bounce = Math.sin(frame * 0.15) * 3;
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.ellipse(0, 10 + bounce, 40, 25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(35, -5 + bounce, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#777';
        ctx.beginPath();
        ctx.moveTo(25, -20 + bounce);
        ctx.lineTo(30, -35 + bounce);
        ctx.lineTo(35, -15 + bounce);
        ctx.fill();
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(38, -10 + bounce, 5, 5);
        ctx.fillStyle = '#777';
        ctx.fillRect(-35, 0 + bounce, 20, 8);
    }
    
    drawGoblin(ctx, frame) {
        const bounce = Math.sin(frame * 0.12) * 5;
        ctx.fillStyle = '#4caf50';
        ctx.fillRect(-20, -25 + bounce, 40, 45);
        ctx.fillStyle = '#66bb6a';
        ctx.beginPath();
        ctx.arc(0, -30 + bounce, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#388e3c';
        ctx.beginPath();
        ctx.moveTo(-25, -35 + bounce);
        ctx.lineTo(-40, -50 + bounce);
        ctx.lineTo(-20, -30 + bounce);
        ctx.fill();
        ctx.moveTo(25, -35 + bounce);
        ctx.lineTo(40, -50 + bounce);
        ctx.lineTo(20, -30 + bounce);
        ctx.fill();
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(-10, -35 + bounce, 5, 5);
        ctx.fillRect(5, -35 + bounce, 5, 5);
    }
    
    drawSkeleton(ctx, frame) {
        const bounce = Math.sin(frame * 0.08) * 3;
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(-15, -25 + bounce, 30, 45);
        ctx.fillStyle = '#f5f5f5';
        ctx.beginPath();
        ctx.arc(0, -30 + bounce, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(-8, -35 + bounce, 6, 6);
        ctx.fillRect(2, -35 + bounce, 6, 6);
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(-15, -15 + bounce, 30, 5);
        ctx.fillRect(-15, 5 + bounce, 30, 5);
    }
    
    drawDragon(ctx, frame) {
        const bounce = Math.sin(frame * 0.05) * 8;
        const lift = getDragonWingLift(frame);
        ctx.fillStyle = '#2ecc71';
        ctx.beginPath();
        ctx.ellipse(0, 10 + bounce, 50, 30, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#27ae60';
        ctx.beginPath();
        ctx.moveTo(-10, -10 + bounce);
        ctx.lineTo(-53, -43 + bounce - lift);
        ctx.lineTo(-37, -23 + bounce - lift * 0.5);
        ctx.lineTo(-20, -5 + bounce);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(10, -10 + bounce);
        ctx.lineTo(53, -43 + bounce - lift);
        ctx.lineTo(37, -23 + bounce - lift * 0.5);
        ctx.lineTo(20, -5 + bounce);
        ctx.fill();
        ctx.fillStyle = '#27ae60';
        ctx.beginPath();
        ctx.arc(45, -10 + bounce, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(50, -15 + bounce, 5, 5);
        if (frame % 30 < 15) {
            ctx.fillStyle = '#ff6600';
            ctx.beginPath();
            ctx.arc(70, -10 + bounce, 10, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    drawGoblinKing(ctx, frame) {
        const bounce = Math.sin(frame * 0.1) * 5;
        ctx.fillStyle = '#388e3c';
        ctx.fillRect(-25, -35 + bounce, 50, 55);
        ctx.fillStyle = '#4caf50';
        ctx.beginPath();
        ctx.arc(0, -40 + bounce, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(-20, -65 + bounce);
        ctx.lineTo(-15, -80 + bounce);
        ctx.lineTo(-5, -70 + bounce);
        ctx.lineTo(0, -85 + bounce);
        ctx.lineTo(5, -70 + bounce);
        ctx.lineTo(15, -80 + bounce);
        ctx.lineTo(20, -65 + bounce);
        ctx.fill();
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(-12, -45 + bounce, 8, 8);
        ctx.fillRect(4, -45 + bounce, 8, 8);
    }
    
    drawDeathKnight(ctx, frame) {
        const bounce = Math.sin(frame * 0.055) * 2;
        const pose = getDeathKnightPose(frame - (this.attackStartFrame ?? frame), this.isAttacking);
        ctx.save();
        ctx.translate(0, bounce);
        // Torn cape and heavy boots establish the knight's silhouette.
        ctx.fillStyle = '#411e34';
        ctx.beginPath();
        ctx.moveTo(-18, -33);
        ctx.lineTo(-39, 23);
        ctx.lineTo(-22, 13);
        ctx.lineTo(-10, 25);
        ctx.lineTo(25, 21);
        ctx.lineTo(18, -33);
        ctx.fill();
        ctx.fillStyle = '#181d2a';
        ctx.fillRect(-21, 9, 17, 20);
        ctx.fillRect(5, 9, 17, 20);
        ctx.fillStyle = '#586071';
        ctx.fillRect(-24, 24, 21, 7);
        ctx.fillRect(4, 24, 21, 7);
        ctx.fillStyle = '#292e40';
        ctx.fillRect(-25, -32, 50, 43);
        ctx.fillStyle = '#87909b';
        ctx.fillRect(-19, -27, 38, 5);
        ctx.fillRect(-5, -20, 10, 29);
        ctx.fillStyle = '#6a4256';
        ctx.fillRect(-23, -8, 46, 7);
        // Spiked pauldrons and narrow faceplate.
        ctx.fillStyle = '#505b6e';
        ctx.beginPath();
        ctx.moveTo(-36, -23);
        ctx.lineTo(-28, -47);
        ctx.lineTo(-14, -33);
        ctx.lineTo(14, -33);
        ctx.lineTo(28, -47);
        ctx.lineTo(36, -23);
        ctx.lineTo(20, -17);
        ctx.lineTo(-20, -17);
        ctx.fill();
        ctx.fillStyle = '#1c2131';
        ctx.fillRect(-17, -59, 34, 30);
        ctx.fillStyle = '#a1a7ae';
        ctx.fillRect(-19, -61, 38, 8);
        ctx.fillRect(-19, -50, 4, 20);
        ctx.fillRect(15, -50, 4, 20);
        ctx.fillStyle = '#b24d70';
        ctx.fillRect(-11, -45, 8, 4);
        ctx.fillRect(3, -45, 8, 4);
        ctx.fillStyle = '#d882a0';
        ctx.fillRect(-9, -45, 4, 2);
        ctx.fillRect(5, -45, 4, 2);
        // Greatsword changes pose during the telegraphed attack.
        ctx.save();
        ctx.translate(26, -14);
        ctx.rotate(pose === 'windup' ? -1.15 : pose === 'slash' ? 1.1 : pose === 'recovery' ? 0.3 : -0.25);
        ctx.fillStyle = '#322537';
        ctx.fillRect(-3, -2, 6, 22);
        ctx.fillStyle = '#d2af7c';
        ctx.fillRect(-13, -7, 26, 5);
        ctx.fillStyle = '#a1b2c5';
        ctx.beginPath();
        ctx.moveTo(-7, -8);
        ctx.lineTo(-10, -63);
        ctx.lineTo(0, -79);
        ctx.lineTo(10, -63);
        ctx.lineTo(7, -8);
        ctx.fill();
        ctx.fillStyle = '#4c617e';
        ctx.fillRect(-2, -61, 4, 45);
        ctx.restore();
        if (pose === 'slash') {
            ctx.strokeStyle = '#b65e86';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(-4, -22, 73, -0.7, 0.55);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawLichKing(ctx, frame) {
        const float = Math.sin(frame * 0.048) * 3;
        const pulse = Math.sin(frame * 0.13) * 2;
        const phase = getLichSpellPhase(frame - (this.attackStartFrame ?? frame), this.isAttacking);
        ctx.save();
        ctx.translate(0, float);
        // A long split robe, not the armoured outline of the Death Knight.
        ctx.fillStyle = '#151b32';
        ctx.beginPath();
        ctx.moveTo(-20, -39);
        ctx.lineTo(-37, 31);
        ctx.lineTo(-17, 20);
        ctx.lineTo(-2, 32);
        ctx.lineTo(15, 19);
        ctx.lineTo(37, 31);
        ctx.lineTo(19, -39);
        ctx.fill();
        ctx.fillStyle = '#604267';
        ctx.beginPath();
        ctx.moveTo(-11, -37);
        ctx.lineTo(-17, 20);
        ctx.lineTo(0, 30);
        ctx.lineTo(14, 18);
        ctx.lineTo(11, -37);
        ctx.fill();
        ctx.fillStyle = '#c3a579';
        ctx.fillRect(-3, -18, 6, 41);
        ctx.fillStyle = '#24283b';
        ctx.fillRect(-25, -44, 50, 21);
        ctx.fillStyle = '#7a627b';
        ctx.fillRect(-29, -38, 58, 5);
        ctx.fillStyle = '#aaa8b9';
        ctx.fillRect(-15, -58, 30, 28);
        ctx.fillStyle = '#343044';
        ctx.fillRect(-12, -52, 24, 17);
        ctx.fillStyle = '#dce1dc';
        ctx.fillRect(-17, -63, 34, 13);
        ctx.fillStyle = '#a05b92';
        ctx.fillRect(-10, -47, 7, 4);
        ctx.fillRect(3, -47, 7, 4);
        ctx.fillStyle = '#e5aadd';
        ctx.fillRect(-8, -47, 3, 2);
        ctx.fillRect(5, -47, 3, 2);
        // A jagged gold diadem with a single amethyst at its centre.
        ctx.fillStyle = '#b29a6a';
        ctx.beginPath();
        ctx.moveTo(-22, -60);
        ctx.lineTo(-24, -80);
        ctx.lineTo(-12, -68);
        ctx.lineTo(0, -91);
        ctx.lineTo(12, -68);
        ctx.lineTo(24, -80);
        ctx.lineTo(22, -60);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#6a366f';
        ctx.fillRect(-5, -73, 10, 10);
        // The crooked staff follows the casting arm and holds a living rune.
        ctx.save();
        ctx.translate(34, -33);
        ctx.rotate(phase === 'summon' ? -0.24 : phase === 'release' ? 0.18 : 0);
        ctx.fillStyle = '#59465f';
        ctx.fillRect(-3, -36, 6, 93);
        ctx.fillStyle = '#c0a37b';
        ctx.fillRect(-5, -38, 10, 7);
        ctx.fillStyle = '#482d67';
        ctx.beginPath();
        ctx.moveTo(0, -62);
        ctx.lineTo(14, -48);
        ctx.lineTo(0, -34);
        ctx.lineTo(-14, -48);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ca8fdb';
        ctx.fillRect(-4, -52, 8, 8);
        ctx.restore();
        if (phase !== 'idle') {
            const radius = phase === 'summon' ? 11 + pulse : 19 + pulse;
            ctx.strokeStyle = '#aa6cc9';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(34, -81, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#e0b2ef';
            ctx.fillRect(30, -85, 8, 8);
        }
        ctx.restore();
    }
    
    drawAncientDragon(ctx, frame) {
        const bounce = Math.sin(frame * 0.05) * 8;
        const lift = getDragonWingLift(frame, true);
        ctx.fillStyle = '#1b5e20';
        ctx.beginPath();
        ctx.ellipse(0, 10 + bounce, 60, 35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2e7d32';
        ctx.beginPath();
        ctx.moveTo(-15, -15 + bounce);
        ctx.lineTo(-74, -61 + bounce - lift);
        ctx.lineTo(-52, -32 + bounce - lift * 0.5);
        ctx.lineTo(-25, -10 + bounce);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(15, -15 + bounce);
        ctx.lineTo(74, -61 + bounce - lift);
        ctx.lineTo(52, -32 + bounce - lift * 0.5);
        ctx.lineTo(25, -10 + bounce);
        ctx.fill();
        ctx.fillStyle = '#2e7d32';
        ctx.beginPath();
        ctx.arc(55, -15 + bounce, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(40, -40 + bounce);
        ctx.lineTo(50, -60 + bounce);
        ctx.lineTo(55, -35 + bounce);
        ctx.fill();
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(60, -20 + bounce, 8, 8);
        if (frame % 20 < 10) {
            ctx.fillStyle = '#ff6600';
            ctx.beginPath();
            ctx.arc(85, -15 + bounce, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            ctx.arc(85, -15 + bounce, 8, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
