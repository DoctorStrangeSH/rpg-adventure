// Класс спрайта с отрисовкой
// Illustrated heroes load once and remain optional so low-connectivity clients
// and test environments can fall back to the original canvas silhouettes.
const HERO_IMAGES = {};
const HERO_ATTACK_IMAGES = {};
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
}

// Four hand-drawn attack frames, each lasting seven render ticks. The index
// is clamped so slower devices cannot draw beyond the last sprite-sheet cell.
export function getAttackFrame(elapsed, frames = 4, ticksPerFrame = 7) {
    if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
    return Math.max(0, Math.min(frames - 1, Math.floor(elapsed / ticksPerFrame)));
}

export class Sprite {
    constructor(type, x, y) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = 60;
        this.height = 60;
        this.isAttacking = false;
        this.isHit = false;
        this.attackStartFrame = null;
    }
    
    draw(ctx, frame) {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.isAttacking && this.attackStartFrame === null) this.attackStartFrame = frame;
        if (!this.isAttacking) this.attackStartFrame = null;
        
        // Preserve the legacy lunge only while illustrated animation is unavailable.
        const attackImage = HERO_ATTACK_IMAGES[this.type];
        if (this.isAttacking && this.type !== 'warrior' &&
            !(attackImage?.complete && attackImage.naturalWidth > 0)) {
            ctx.translate(20, 0);
        }
        
        if (this.isHit) {
            ctx.translate(0, 10);
        }
        
        this.drawSprite(ctx, frame);
        
        ctx.restore();
    }
    
    drawSprite(ctx, frame) {
        const attackImage = HERO_ATTACK_IMAGES[this.type];
        if (this.isAttacking && attackImage?.complete && attackImage.naturalWidth > 0) {
            const frameWidth = attackImage.naturalWidth / 4;
            const frameIndex = getAttackFrame(frame - (this.attackStartFrame ?? frame));
            const height = 112;
            const width = height * frameWidth / attackImage.naturalHeight;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(attackImage, frameIndex * frameWidth, 0, frameWidth,
                attackImage.naturalHeight, -width / 2, 30 - height, width, height);
            return;
        }
        const heroImage = HERO_IMAGES[this.type];
        if (heroImage?.complete && heroImage.naturalWidth > 0) {
            const height = 100;
            const width = height * heroImage.naturalWidth / heroImage.naturalHeight;
            const breathing = Math.sin(frame * 0.055) * 2;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(heroImage, -width / 2, 30 - height + breathing, width, height);
            return;
        }
        const drawFunctions = {
            warrior: this.drawWarrior,
            mage: this.drawMage,
            archer: this.drawArcher,
            wolf: this.drawWolf,
            goblin: this.drawGoblin,
            skeleton: this.drawSkeleton,
            dragon: this.drawDragon,
            goblin_king: this.drawGoblinKing,
            death_knight: this.drawDeathKnight,
            ancient_dragon: this.drawAncientDragon
        };
        
        const drawFunc = drawFunctions[this.type];
        if (drawFunc) {
            drawFunc.call(this, ctx, frame);
        }
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
        ctx.fillStyle = '#2ecc71';
        ctx.beginPath();
        ctx.ellipse(0, 10 + bounce, 50, 30, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#27ae60';
        ctx.beginPath();
        ctx.moveTo(-10, -10 + bounce);
        ctx.lineTo(-50, -40 + bounce);
        ctx.lineTo(-20, -5 + bounce);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(10, -10 + bounce);
        ctx.lineTo(50, -40 + bounce);
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
        const bounce = Math.sin(frame * 0.08) * 3;
        ctx.fillStyle = '#424242';
        ctx.fillRect(-20, -30 + bounce, 40, 50);
        ctx.fillStyle = '#f5f5f5';
        ctx.beginPath();
        ctx.arc(0, -35 + bounce, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#616161';
        ctx.beginPath();
        ctx.arc(0, -40 + bounce, 24, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(-8, -40 + bounce, 6, 6);
        ctx.fillRect(2, -40 + bounce, 6, 6);
        ctx.fillStyle = '#757575';
        ctx.fillRect(20, -50 + bounce, 8, 45);
        ctx.fillStyle = '#424242';
        ctx.fillRect(15, -10 + bounce, 18, 6);
    }
    
    drawAncientDragon(ctx, frame) {
        const bounce = Math.sin(frame * 0.05) * 8;
        ctx.fillStyle = '#1b5e20';
        ctx.beginPath();
        ctx.ellipse(0, 10 + bounce, 60, 35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2e7d32';
        ctx.beginPath();
        ctx.moveTo(-15, -15 + bounce);
        ctx.lineTo(-60, -50 + bounce);
        ctx.lineTo(-25, -10 + bounce);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(15, -15 + bounce);
        ctx.lineTo(60, -50 + bounce);
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
