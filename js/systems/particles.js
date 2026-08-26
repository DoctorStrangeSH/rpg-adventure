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
    
    update() {
        this.particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.2;
            particle.life -= 0.02;
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

export class DamageText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1;
        this.vy = -3;
    }
    
    update() {
        this.y += this.vy;
        this.life -= 0.02;
    }
    
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1;
    }
}