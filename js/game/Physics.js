// js/game/Physics.js
import { Constants } from '../utils/Constants.js';
import { GameEvents } from '../core/EventManager.js';

export class Physics {
    constructor(game) {
        this.game = game;
        this.ball = null;
        this.paddle1 = null;
        this.paddle2 = null;
    }

    init(ball, paddle1, paddle2) {
        this.ball = ball;
        this.paddle1 = paddle1;
        this.paddle2 = paddle2;
    }

    update(deltaTime) {
        if (!this.ball || !this.paddle1 || !this.paddle2) return;
        
        const gameState = this.game.managers.state;
        if (!gameState.isRunning || gameState.isPaused) return;
        
        // Aggiorna posizioni
        this.ball.update(deltaTime);
        this.paddle1.update(deltaTime);
        this.paddle2.update(deltaTime);
        
        // Controlla collisioni palla-racchette
        this.checkPaddleCollisions();
        
        // Controlla limiti del campo
        const boundResult = this.ball.checkBounds();
        
        if (boundResult === 'goal_left') {
            this.handleGoal(2);
        } else if (boundResult === 'goal_right') {
            this.handleGoal(1);
        }
    }

    checkPaddleCollisions() {
        // Collisione con paddle sinistro
        if (this.ball.dx < 0) {
            if (this.ball.checkPaddleCollision(this.paddle1, 'left')) {
                this.paddle1.onHit();
                this.createHitEffect(this.paddle1);
            }
        }
        
        // Collisione con paddle destro
        if (this.ball.dx > 0) {
            if (this.ball.checkPaddleCollision(this.paddle2, 'right')) {
                this.paddle2.onHit();
                this.createHitEffect(this.paddle2);
            }
        }
    }

    handleGoal(scorer) {
        // Notifica il GameState
        this.game.managers.state.scoreGoal(scorer);
        
        // Reset della palla (centrata e ferma)
        this.ball.reset(true);
        
        // Crea effetto goal
        this.createGoalEffect(scorer);
    }

    createHitEffect(paddle) {
        // Emetti evento per effetti visivi/sonori
        this.game.emit(GameEvents.BALL_COLLISION, {
            type: 'paddle',
            position: { x: paddle.x, y: paddle.y + paddle.height / 2 },
            intensity: this.ball.getSpeed() / 10
        });
    }

    createGoalEffect(scorer) {
        // Emetti evento per effetti goal
        this.game.emit(GameEvents.GOAL_SCORED, {
            scorer: scorer,
            position: scorer === 1 ? 
                { x: Constants.CANVAS_WIDTH, y: this.ball.y } : 
                { x: 0, y: this.ball.y }
        });
    }

    // Metodi helper per calcoli fisici
    static calculateBounceAngle(hitPosition, maxAngle = Math.PI / 4) {
        // hitPosition da -1 a 1, restituisce angolo di rimbalzo
        return hitPosition * maxAngle;
    }

    static calculateDistance(point1, point2) {
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    static normalizeVector(vector) {
        const magnitude = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
        if (magnitude === 0) return { x: 0, y: 0 };
        return {
            x: vector.x / magnitude,
            y: vector.y / magnitude
        };
    }

    // Predizione traiettoria (per AI avanzata)
    predictBallPosition(timeAhead) {
        if (!this.ball) return null;
        
        let futureX = this.ball.x + this.ball.dx * timeAhead;
        let futureY = this.ball.y + this.ball.dy * timeAhead;
        let futureDy = this.ball.dy;
        
        // Calcola rimbalzi sui muri
        let bounces = 0;
        while (futureY < 0 || futureY > Constants.CANVAS_HEIGHT) {
            if (futureY < 0) {
                futureY = -futureY;
                futureDy = -futureDy;
            } else {
                futureY = 2 * Constants.CANVAS_HEIGHT - futureY;
                futureDy = -futureDy;
            }
            bounces++;
            if (bounces > 10) break; // Evita loop infiniti
        }
        
        return { x: futureX, y: futureY };
    }

    // Verifica se la palla sta andando verso una racchetta
    isBallHeadingToPaddle(paddle) {
        if (!this.ball) return false;
        
        if (paddle === this.paddle1) {
            return this.ball.dx < 0;
        } else {
            return this.ball.dx > 0;
        }
    }

    // Reset completo della fisica
    reset() {
        if (this.ball) this.ball.reset();
        if (this.paddle1) this.paddle1.reset();
        if (this.paddle2) this.paddle2.reset();
    }
}
