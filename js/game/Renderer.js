// js/game/Renderer.js
import { Constants } from '../utils/Constants.js';

export class Renderer {
    constructor(game) {
        this.game = game;
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.animations = [];
        
        this.init();
    }

    init() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            console.error('Canvas non trovato!');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        
        // Ascolta eventi per effetti
        this.game.on('ball:collision', (data) => this.createCollisionEffect(data));
        this.game.on('goal:scored', (data) => this.createGoalEffect(data));
    }

    setupCanvas() {
        // Imposta dimensioni
        this.canvas.width = Constants.CANVAS_WIDTH;
        this.canvas.height = Constants.CANVAS_HEIGHT;
        
        // Ottimizzazioni per performance
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
    }

    render(ball, paddle1, paddle2) {
        if (!this.ctx) return;
        
        // Clear con effetto fade per trail
        this.clearCanvas();
        
        // Disegna elementi di sfondo
        this.drawField();
        
        // Aggiorna e disegna particelle
        this.updateParticles();
        
        // Disegna elementi di gioco
        this.drawPaddle(paddle1);
        this.drawPaddle(paddle2);
        this.drawBall(ball);
        
        // Disegna UI in-game
        this.drawScore();
        
        // Debug info (se abilitato)
        if (this.game.managers.settings.get('fpsCounter')) {
            this.drawDebugInfo();
        }
    }

    clearCanvas() {
        // Effetto fade per trail
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawField() {
        // Linea centrale
        this.ctx.strokeStyle = Constants.COLORS.PRIMARY;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([10, 10]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / 2, 0);
        this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // Cerchio centrale
        this.ctx.beginPath();
        this.ctx.arc(this.canvas.width / 2, this.canvas.height / 2, 50, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
        this.ctx.stroke();
    }

    drawPaddle(paddle) {
        const ctx = this.ctx;
        
        // Glow effect
        if (paddle.glowIntensity > 0) {
            ctx.shadowColor = Constants.COLORS.PRIMARY;
            ctx.shadowBlur = paddle.glowIntensity * 20;
        }
        
        // Hit animation
        const scaleX = paddle.hitAnimation > 0 ? 1 + paddle.hitAnimation * 0.1 : 1;
        
        ctx.save();
        ctx.translate(paddle.x + paddle.width / 2, paddle.y + paddle.height / 2);
        ctx.scale(scaleX, 1);
        
        // Disegna racchetta
        ctx.fillStyle = Constants.COLORS.PADDLE;
        ctx.fillRect(-paddle.width / 2, -paddle.height / 2, paddle.width, paddle.height);
        
        // Bordo luminoso
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-paddle.width / 2, -paddle.height / 2, paddle.width, paddle.height);
        
        ctx.restore();
        ctx.shadowBlur = 0;
    }

    drawBall(ball) {
        const ctx = this.ctx;
        
        // Trail effect
        if (this.game.managers.settings.get('trailEffect') && ball.trail) {
            ball.trail.forEach((point, index) => {
                if (point.alpha > 0.1) {
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, ball.radius * point.alpha, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(0, 255, 136, ${point.alpha * 0.3})`;
                    ctx.fill();
                }
            });
        }
        
        // Glow effect
        ctx.shadowColor = Constants.COLORS.BALL;
        ctx.shadowBlur = 15 + ball.glowIntensity * 10;
        
        // Palla principale
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = Constants.COLORS.BALL;
        ctx.fill();
        
        // Highlight
        ctx.beginPath();
        ctx.arc(ball.x - ball.radius * 0.3, ball.y - ball.radius * 0.3, 
                ball.radius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();
        
        ctx.shadowBlur = 0;
    }

    drawScore() {
        const state = this.game.managers.state;
        if (!state) return;
        
        const ctx = this.ctx;
        ctx.font = '48px Courier New';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.textAlign = 'center';
        
        // Punteggio giocatore 1
        ctx.fillText(state.score1, this.canvas.width / 4, 60);
        
        // Punteggio giocatore 2
        ctx.fillText(state.score2, this.canvas.width * 3 / 4, 60);
    }

    // Sistema particelle per effetti
    createParticle(x, y, options = {}) {
        this.particles.push({
            x: x,
            y: y,
            vx: options.vx || (Math.random() - 0.5) * 5,
            vy: options.vy || (Math.random() - 0.5) * 5,
            size: options.size || 3,
            color: options.color || Constants.COLORS.PRIMARY,
            life: options.life || 1,
            decay: options.decay || 0.02
        });
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            // Aggiorna posizione
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            
            // Disegna
            if (p.life > 0) {
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                this.ctx.fillStyle = p.color.replace('rgb', 'rgba').replace(')', `, ${p.life})`);
                this.ctx.fill();
            } else {
                // Rimuovi particella morta
                this.particles.splice(i, 1);
            }
        }
    }

    createCollisionEffect(data) {
        if (!this.game.managers.settings.get('particleEffects')) return;
        
        const count = Math.floor(data.intensity * 10) + 5;
        for (let i = 0; i < count; i++) {
            this.createParticle(data.position.x, data.position.y, {
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                size: Math.random() * 4 + 2,
                color: Constants.COLORS.PRIMARY,
                life: 1,
                decay: 0.03
            });
        }
    }

    createGoalEffect(data) {
        if (!this.game.managers.settings.get('particleEffects')) return;
        
        // Esplosione di particelle
        for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 * i) / 30;
            this.createParticle(data.position.x, data.position.y, {
                vx: Math.cos(angle) * 5,
                vy: Math.sin(angle) * 5,
                size: 5,
                color: data.scorer === 1 ? Constants.COLORS.PRIMARY : Constants.COLORS.SECONDARY,
                life: 1,
                decay: 0.02
            });
        }
    }

    drawDebugInfo() {
        const ctx = this.ctx;
        ctx.font = '12px Courier New';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.textAlign = 'left';
        
        const debug = this.game.managers.state.getDebugInfo();
        let y = 20;
        
        Object.entries(debug).forEach(([key, value]) => {
            ctx.fillText(`${key}: ${value}`, 10, y);
            y += 15;
        });
    }

    // Pulizia
    clear() {
        this.particles = [];
        this.animations = [];
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
}
