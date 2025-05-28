// js/game/Ball.js
import { Constants } from '../utils/Constants.js';
import { GameEvents } from '../core/EventManager.js';

export class Ball {
    constructor(game) {
        this.game = game;
        this.reset();
    }

    reset(centerOnly = false) {
        this.x = Constants.CANVAS_WIDTH / 2;
        this.y = Constants.CANVAS_HEIGHT / 2;
        this.radius = Constants.BALL_RADIUS;
        
        if (!centerOnly) {
            // Velocità iniziale casuale
            const speed = this.game.managers.settings.get('ballSpeed');
            this.dx = (Math.random() > 0.5 ? 1 : -1) * speed;
            this.dy = (Math.random() - 0.5) * speed * 0.8;
            this.paused = false;
        } else {
            this.dx = 0;
            this.dy = 0;
            this.paused = true;
        }
        
        // Effetti visivi
        this.trail = [];
        this.maxTrailLength = 10;
        this.glowIntensity = 0;
    }

    update(deltaTime) {
        if (this.paused) return;
        
        // Salva posizione precedente per il trail
        if (this.game.managers.settings.get('trailEffect')) {
            this.trail.push({ x: this.x, y: this.y, alpha: 1 });
            if (this.trail.length > this.maxTrailLength) {
                this.trail.shift();
            }
        }
        
        // Aggiorna posizione
        this.x += this.dx * deltaTime;
        this.y += this.dy * deltaTime;
        
        // Aggiorna trail
        this.trail.forEach(point => {
            point.alpha *= 0.9;
        });
        
        // Effetto glow quando va veloce
        const speed = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
        this.glowIntensity = Math.min(speed / 10, 1);
    }

    checkBounds() {
        // Collisione con bordi superiore e inferiore
        if (this.y - this.radius <= 0 || this.y + this.radius >= Constants.CANVAS_HEIGHT) {
            this.dy = -this.dy;
            this.y = this.y - this.radius <= 0 ? 
                this.radius : 
                Constants.CANVAS_HEIGHT - this.radius;
            
            this.game.emit(GameEvents.BALL_COLLISION, { type: 'wall' });
            return 'wall';
        }
        
        // Goal a sinistra
        if (this.x < -this.radius) {
            return 'goal_left';
        }
        
        // Goal a destra
        if (this.x > Constants.CANVAS_WIDTH + this.radius) {
            return 'goal_right';
        }
        
        return null;
    }

    checkPaddleCollision(paddle, side) {
        // Calcola i bordi della palla
        const ballLeft = this.x - this.radius;
        const ballRight = this.x + this.radius;
        const ballTop = this.y - this.radius;
        const ballBottom = this.y + this.radius;
        
        // Calcola i bordi della racchetta
        const paddleLeft = paddle.x;
        const paddleRight = paddle.x + paddle.width;
        const paddleTop = paddle.y;
        const paddleBottom = paddle.y + paddle.height;
        
        // Verifica collisione
        if (ballRight >= paddleLeft && ballLeft <= paddleRight &&
            ballBottom >= paddleTop && ballTop <= paddleBottom) {
            
            // Calcola punto di impatto relativo (da -1 a 1)
            const hitPos = ((this.y - paddle.y) - paddle.height / 2) / (paddle.height / 2);
            
            // Modifica direzione X
            if (side === 'left') {
                this.dx = Math.abs(this.dx);
                this.x = paddleRight + this.radius;
            } else {
                this.dx = -Math.abs(this.dx);
                this.x = paddleLeft - this.radius;
            }
            
            // Modifica direzione Y basata sul punto di impatto
            this.dy += hitPos * 3;
            
            // Limita velocità massima
            const maxSpeed = this.game.managers.settings.get('ballSpeed') * 2;
            const speed = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
            if (speed > maxSpeed) {
                this.dx = (this.dx / speed) * maxSpeed;
                this.dy = (this.dy / speed) * maxSpeed;
            }
            
            // Aumenta leggermente la velocità ad ogni colpo
            this.dx *= 1.05;
            this.dy *= 1.05;
            
            this.game.emit(GameEvents.BALL_COLLISION, { 
                type: 'paddle', 
                paddle: side,
                hitPos: hitPos 
            });
            
            return true;
        }
        
        return false;
    }

    launch(direction = 1) {
        const speed = this.game.managers.settings.get('ballSpeed');
        this.dx = direction * speed;
        this.dy = (Math.random() - 0.5) * speed * 0.8;
        this.paused = false;
    }

    stop() {
        this.dx = 0;
        this.dy = 0;
        this.paused = true;
    }

    // Metodi per effetti speciali
    applyEffect(effect) {
        switch (effect) {
            case 'speedBoost':
                this.dx *= 1.5;
                this.dy *= 1.5;
                break;
            case 'slowMotion':
                this.dx *= 0.5;
                this.dy *= 0.5;
                break;
            case 'curve':
                // Aggiungi effetto curva
                this.curve = 0.1;
                break;
        }
    }

    getSpeed() {
        return Math.sqrt(this.dx * this.dx + this.dy * this.dy);
    }

    getDirection() {
        return Math.atan2(this.dy, this.dx);
    }

    // Serializzazione per multiplayer
    serialize() {
        return {
            x: this.x,
            y: this.y,
            dx: this.dx,
            dy: this.dy,
            radius: this.radius,
            paused: this.paused
        };
    }

    deserialize(data) {
        this.x = data.x;
        this.y = data.y;
        this.dx = data.dx;
        this.dy = data.dy;
        this.paused = data.paused;
    }
}
