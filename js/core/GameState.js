// js/core/GameState.js
import { GameEvents } from './EventManager.js';

export class GameState {
    constructor(eventManager) {
        this.events = eventManager;
        this.reset();
    }

    reset() {
        this.state = {
            // Palla
            ball: {
                x: 400,
                y: 200,
                dx: 5,
                dy: 3,
                radius: 8,
                paused: false
            },
            
            // Racchette
            paddle1: {
                x: 20,
                y: 150,
                width: 15,
                height: 100,
                dy: 0,
                score: 0
            },
            
            paddle2: {
                x: 765,
                y: 150,
                width: 15,
                height: 100,
                dy: 0,
                score: 0
            },
            
            // Stato generale
            gameRunning: false,
            gamePaused: false,
            waitingForLaunch: false,
            lastScorer: null,
            winner: null
        };
        
        this.events.emit(GameEvents.GAME_READY);
    }

    // Getters per accesso rapido
    get ball() { return this.state.ball; }
    get paddle1() { return this.state.paddle1; }
    get paddle2() { return this.state.paddle2; }
    get score1() { return this.state.paddle1.score; }
    get score2() { return this.state.paddle2.score; }
    get isRunning() { return this.state.gameRunning; }
    get isPaused() { return this.state.gamePaused; }

    // Metodi di controllo del gioco
    startGame() {
        this.state.gameRunning = true;
        this.state.gamePaused = false;
        this.events.emit(GameEvents.GAME_START);
    }

    pauseGame() {
        if (this.state.gameRunning && !this.state.gamePaused) {
            this.state.gamePaused = true;
            this.events.emit(GameEvents.GAME_PAUSE);
        }
    }

    resumeGame() {
        if (this.state.gameRunning && this.state.gamePaused) {
            this.state.gamePaused = false;
            this.events.emit(GameEvents.GAME_RESUME);
        }
    }

    endGame(winner = null) {
        this.state.gameRunning = false;
        this.state.winner = winner;
        this.events.emit(GameEvents.GAME_END, {
            winner,
            finalScore: {
                player1: this.score1,
                player2: this.score2
            }
        });
    }

    // Gestione punteggio
    scoreGoal(player) {
        if (player === 1) {
            this.state.paddle1.score++;
        } else if (player === 2) {
            this.state.paddle2.score++;
        }
        
        this.state.lastScorer = player;
        this.state.waitingForLaunch = true;
        
        this.events.emit(GameEvents.GOAL_SCORED, {
            scorer: player,
            score1: this.score1,
            score2: this.score2
        });
        
        this.events.emit(GameEvents.SCORE_UPDATE, {
            score1: this.score1,
            score2: this.score2
        });
        
        // Controlla condizione di vittoria
        if (this.score1 >= 5 || this.score2 >= 5) {
            this.endGame(this.score1 >= 5 ? 1 : 2);
        }
    }

    // Gestione palla
    resetBall(centerOnly = false) {
        this.state.ball.x = 400;
        this.state.ball.y = 200;
        
        if (!centerOnly) {
            this.state.ball.dx = Math.random() > 0.5 ? 5 : -5;
            this.state.ball.dy = (Math.random() - 0.5) * 6;
            this.state.ball.paused = false;
            this.state.waitingForLaunch = false;
        } else {
            this.state.ball.dx = 0;
            this.state.ball.dy = 0;
            this.state.ball.paused = true;
        }
        
        this.events.emit(GameEvents.BALL_RESET);
    }

    launchBall() {
        if (this.state.waitingForLaunch) {
            const direction = this.state.lastScorer === 1 ? -1 : 1;
            this.state.ball.dx = direction * 5;
            this.state.ball.dy = (Math.random() - 0.5) * 6;
            this.state.ball.paused = false;
            this.state.waitingForLaunch = false;
        }
    }

    // Movimento racchette
    movePaddle(player, dy) {
        if (player === 1) {
            this.state.paddle1.dy = dy;
        } else if (player === 2) {
            this.state.paddle2.dy = dy;
        }
        
        this.events.emit(GameEvents.PADDLE_MOVE, { player, dy });
    }

    setPaddlePosition(player, y) {
        const paddle = player === 1 ? this.state.paddle1 : this.state.paddle2;
        paddle.y = Math.max(0, Math.min(300, y));
        paddle.dy = 0;
    }

    // Aggiornamento dimensioni racchette
    updatePaddleSize(newHeight) {
        this.state.paddle1.height = newHeight;
        this.state.paddle2.height = newHeight;
    }

    // Serializzazione per multiplayer
    serialize() {
        return {
            ball: { ...this.state.ball },
            paddle1: {
                y: this.state.paddle1.y,
                score: this.state.paddle1.score
            },
            paddle2: {
                y: this.state.paddle2.y,
                score: this.state.paddle2.score
            },
            gameRunning: this.state.gameRunning,
            waitingForLaunch: this.state.waitingForLaunch,
            lastScorer: this.state.lastScorer
        };
    }

    deserialize(data) {
        if (data.ball) {
            Object.assign(this.state.ball, data.ball);
        }
        if (data.paddle1) {
            this.state.paddle1.y = data.paddle1.y;
            this.state.paddle1.score = data.paddle1.score;
        }
        if (data.paddle2) {
            this.state.paddle2.y = data.paddle2.y;
            this.state.paddle2.score = data.paddle2.score;
        }
        if (data.gameRunning !== undefined) {
            this.state.gameRunning = data.gameRunning;
        }
        if (data.waitingForLaunch !== undefined) {
            this.state.waitingForLaunch = data.waitingForLaunch;
        }
        if (data.lastScorer !== undefined) {
            this.state.lastScorer = data.lastScorer;
        }
    }

    // Debug
    getDebugInfo() {
        return {
            ball: `Pos: (${this.ball.x.toFixed(0)}, ${this.ball.y.toFixed(0)}) Vel: (${this.ball.dx.toFixed(1)}, ${this.ball.dy.toFixed(1)})`,
            paddle1: `Y: ${this.paddle1.y.toFixed(0)} Score: ${this.score1}`,
            paddle2: `Y: ${this.paddle2.y.toFixed(0)} Score: ${this.score2}`,
            state: `Running: ${this.isRunning} Paused: ${this.isPaused} Waiting: ${this.state.waitingForLaunch}`
        };
    }
}
