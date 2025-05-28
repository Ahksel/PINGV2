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
        if (!this.aiEnabled)
