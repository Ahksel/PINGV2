// js/game/Paddle.js
import { Constants } from '../utils/Constants.js';

export class Paddle {
    constructor(game, side) {
        this.game = game;
        this.side = side; // 'left' o 'right'
        this.reset();
    }

    reset() {
        this.width = Constants.PADDLE_WIDTH;
        this.height = this.game.managers.settings.get('paddleSize');
        
        // Posizione iniziale
        if (this.side === 'left') {
            this.x = Constants.PADDLE_OFFSET;
        } else {
            this.x = Constants.CANVAS_WIDTH - Constants.PADDLE_OFFSET - this.width;
        }
        
        this.y = (Constants.CANVAS_HEIGHT - this.height) / 2;
        this.dy = 0;
        
        // Effetti visivi
        this.glowIntensity = 0;
        this.hitAnimation = 0;
        
        // AI properties
        this.aiEnabled = false;
        this.aiSpeed = Constants.AI_SPEED;
        this.aiReactionZone = Constants.AI_REACTION_ZONE;
    }

    update(deltaTime) {
        // Aggiorna posizione
        this.y += this.dy * deltaTime;
        
        // Limita ai bordi
        this.y = Math.max(0, Math.min(Constants.CANVAS_HEIGHT - this.height, this.y));
        
        // Aggiorna animazioni
        if (this.hitAnimation > 0) {
            this.hitAnimation -= deltaTime * 0.05;
        }
        
        // Aggiorna glow basato sulla velocità
        this.glowIntensity = Math.abs(this.dy) / Constants.PADDLE_SPEED;
    }

    moveUp() {
        this.dy = -Constants.PADDLE_SPEED;
    }

    moveDown() {
        this.dy = Constants.PADDLE_SPEED;
    }

    stop() {
        this.dy = 0;
    }

    setPosition(y) {
        this.y = Math.max(0, Math.min(Constants.CANVAS_HEIGHT - this.height, y));
        this.dy = 0;
    }

    // Movimento AI
    updateAI(ball) {
        if (!this.aiEnabled) return;
        
        const paddleCenter = this.y + this.height / 2;
        const ballY = ball.y;
        
        // Zona morta per evitare movimento nervoso
        if (Math.abs(ballY - paddleCenter) < this.aiReactionZone) {
            this.stop();
            return;
        }
        
        // Calcola velocità AI basata sulla distanza
        const distance = Math.abs(ballY - paddleCenter);
        const speedMultiplier = Math.min(distance / 100, 1);
        const aiSpeed = this.aiSpeed * speedMultiplier * this.game.managers.settings.get('ballSpeed');
        
        // Muovi verso la palla
        if (ballY < paddleCenter) {
            this.dy = -aiSpeed;
        } else {
            this.dy = aiSpeed;
        }
        
        // Aggiungi un po' di imperfezione all'AI
        if (Math.random() < 0.05) {
            this.dy *= 0.8; // 5% di chance di rallentare
        }
    }

    // Abilita/disabilita AI
    setAI(enabled) {
        this.aiEnabled = enabled;
        if (!enabled) {
            this.stop();
        }
    }

    // Effetto quando colpisce la palla
    onHit() {
        this.hitAnimation = 1;
    }

    // Cambia dimensione (per power-up futuri)
    setSize(height) {
        this.height = height;
        // Mantieni la racchetta nei limiti
        if (this.y + this.height > Constants.CANVAS_HEIGHT) {
            this.y = Constants.CANVAS_HEIGHT - this.height;
        }
    }

    // Ottieni il centro della racchetta
    getCenter() {
        return {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2
        };
    }

    // Verifica se un punto è dentro la racchetta
    containsPoint(x, y) {
        return x >= this.x && x <= this.x + this.width &&
               y >= this.y && y <= this.y + this.height;
    }

    // Serializzazione per multiplayer
    serialize() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            dy: this.dy
        };
    }

    deserialize(data) {
        this.y = data.y;
        this.dy = data.dy;
        if (data.height) this.height = data.height;
    }
}
