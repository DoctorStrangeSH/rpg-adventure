// Система частиц
export class ParticleSystem {
    constructor() {
        this.particles = [];
    }
    
    createExplosion(x, y, color, count = 20) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1,
                color: color,
                size: Math.random() * 5 + 2
            });
        }
    }
    
    createImpactBurst(x, y, damageType = 'physical', isCrit = false) {
        const palette = {
            fire: ['#ff6b35', '#ffbd59', '#fff0a6'],
            ice: ['#65dfff', '#b8f4ff', '#f0fdff'],
            poison: ['#86c65b', '#c5e879', '#efffae'],
            arcane: ['#9d78e8', '#d4b5ff', '#f3eaff'],
            physical: ['#c5c0b5', '#f1d38a', '#ffffff']
        };
        const colors = palette[damageType] || palette.physical;
        const count = isCrit ? 22 : 10;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = (isCrit ? 3.8 : 2.4) + (i % 3) * 0.7;
            this.particles.push({
                x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                life: 1, color: colors[i % colors.length],
                size: isCrit ? 3 + (i % 3) : 2 + (i % 2),
                gravity: 0.08, impactShard: true
            });
        }
    }

    update() {
        this.particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += particle.gravity ?? 0.2;
            particle.life -= particle.impactShard ? 0.045 : 0.02;
        });
        
        this.particles = this.particles.filter(p => p.life > 0);
    }
    
    draw(ctx) {
        this.particles.forEach(particle => {
            ctx.fillStyle = particle.color;
            ctx.globalAlpha = particle.life;
            ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
        });
        ctx.globalAlpha = 1;
    }
}

export function getDamageTextStyle({ isCrit = false, damageType = 'physical' } = {}) {
    const elemental = {
        fire: '#ff9b42',
        ice: '#8deaff',
        poison: '#a6df75',
        arcane: '#c5a4ff'
    };
    return {
        color: isCrit ? '#ffdf91' : (elemental[damageType] || '#f1d38a'),
        fontSize: isCrit ? 27 : 20,
        weight: isCrit ? '900' : '700',
        outline: isCrit ? '#7b2637' : '#302b28',
        label: isCrit ? 'КРИТ!' : null
    };
}

export class DamageText {
    constructor(x, y, text, color, options = {}) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.style = getDamageTextStyle(options);
        this.color = color || this.style.color;
        this.critical = options.isCrit === true;
        this.life = 1;
        this.vy = this.critical ? -3.8 : -3;
    }
    
    update() {
        this.y += this.vy;
        this.life -= this.critical ? 0.024 : 0.02;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.font = `${this.style.weight} ${this.style.fontSize}px Arial`;
        ctx.lineWidth = this.critical ? 4 : 2;
        ctx.strokeStyle = this.style.outline;
        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.critical ? '#ff9d5c' : 'transparent';
        ctx.shadowBlur = this.critical ? 9 : 0;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}