// js/game/GameLoop.js
import { Ball } from './Ball.js';
import { Paddle } from './Paddle.js';
import { Physics } from './Physics.js';
import { GameEvents } from '../core/EventManager.js';

export class GameLoop {
    constructor(game) {
        this.game = game;
        this.isRunning = false;
        this.animationId = null;
        this.lastTime = 0;
        this.deltaTime = 0;
        this.fps = 0;
        this.frameCount = 0;
        this.fpsUpdateTime = 0;
        
        // Componenti del gioco
        this.ball = null;
        this.paddle1 = null;
        this.paddle2 = null;
        this.physics = null;
        
        this.init();
    }

    init() {
        // Crea componenti
        this.ball = new Ball(this.game);
        this.paddle1 = new Paddle(this.game, 'left');
        this.paddle2 = new Paddle(this.game, 'right');
        this.physics = new Physics(this.game);
        
        // Inizializza fisica
        this.physics.init(this.ball, this.paddle1, this.paddle2);
        
        // Ascolta eventi
        this.game.on(GameEvents.GAME_PAUSE, () => this.pause());
        this.game.on(GameEvents.GAME_RESUME, () => this.resume());
        this.game.on(GameEvents.BALL_RESET, () => this.ball.reset());
    }

    start(mode = 'single') {
        if (this.isRunning) return;
        
        console.log(`🎮 Avvio game loop in modalità: ${mode}`);
        
        this.mode = mode;
        this.isRunning = true;
        
        // Reset componenti
        this.reset();
        
        // Configura modalità
        if (mode === 'single') {
            this.paddle2.setAI(true);
        } else {
            this.paddle1.setAI(false);
            this.paddle2.setAI(false);
        }
        
        // Avvia stato del gioco
        this.game.managers.state.startGame();
        
        // Avvia loop
        this.lastTime = performance.now();
        this.loop();
    }

    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        console.log('🛑 Game loop fermato');
    }

    pause() {
        this.game.managers.state.pauseGame();
    }

    resume() {
        this.game.managers.state.resumeGame();
    }

    reset() {
        this.ball.reset();
        this.paddle1.reset();
        this.paddle2.reset();
        this.game.managers.state.reset();
    }

    loop(currentTime = 0) {
        if (!this.isRunning) return;
        
        // Calcola delta time (in secondi)
        this.deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;
        
        // Calcola FPS
        this.updateFPS(currentTime);
        
        // Update del gioco
        this.update(this.deltaTime * 60); // Converti in frame units
        
        // Render
        this.render();
        
        // Continua il loop
        this.animationId = requestAnimationFrame((time) => this.loop(time));
    }

    update(deltaTime) {
        const state = this.game.managers.state;
        
        if (!state.isRunning || state.isPaused) return;
        
        // Update AI se in single player
        if (this.mode === 'single') {
            this.paddle2.updateAI(this.ball);
        }
        
        // Update fisica
        this.physics.update(deltaTime);
        
        // Gestisci input locale
        this.handleLocalInput();
        
        // Se multiplayer, sincronizza stato
        if (this.mode === 'multi') {
            this.syncMultiplayer();
        }
    }

    render() {
        if (this.game.managers.renderer) {
            this.game.managers.renderer.render(this.ball, this.paddle1, this.paddle2);
        }
    }

    handleLocalInput() {
        const input = this.game.managers.input;
        if (!input) return;
        
        const state = input.getState();
        
        // Single player: controlla paddle 1
        if (this.mode === 'single') {
            if (state.player1Up) {
                this.paddle1.moveUp();
            } else if (state.player1Down) {
                this.paddle1.moveDown();
            } else {
                this.paddle1.stop();
            }
        }
        
        // Multiplayer: controlla la paddle assegnata
        else if (this.mode === 'multi') {
            const playerId = this.game.managers.network?.playerId;
            const paddle = playerId === 1 ? this.paddle1 : this.paddle2;
            
            if (state.player1Up || state.player2Up) {
                paddle.moveUp();
            } else if (state.player1Down || state.player2Down) {
                paddle.moveDown();
            } else {
                paddle.stop();
            }
        }
    }

    syncMultiplayer() {
        // In multiplayer, lo stato viene dal server
        const networkState = this.game.managers.network?.lastGameState;
        if (networkState) {
            // Sincronizza solo se non siamo il server
            if (!this.game.managers.network.isHost) {
                this.ball.deserialize(networkState.ball);
                this.paddle1.deserialize(networkState.paddle1);
                this.paddle2.deserialize(networkState.paddle2);
                
                this.game.managers.state.deserialize(networkState);
            }
        }
    }

    updateFPS(currentTime) {
        this.frameCount++;
        
        if (currentTime - this.fpsUpdateTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsUpdateTime = currentTime;
        }
    }

    // Metodi pubblici per accesso ai componenti
    getBall() {
        return this.ball;
    }

    getPaddle(player) {
        return player === 1 ? this.paddle1 : this.paddle2;
    }

    getPhysics() {
        return this.physics;
    }

    getFPS() {
        return this.fps;
    }

    // Gestione eventi di gioco
    launchBall() {
        const state = this.game.managers.state;
        if (state.state.waitingForLaunch) {
            const direction = state.state.lastScorer === 1 ? -1 : 1;
            this.ball.launch(direction);
            state.state.waitingForLaunch = false;
            
            this.game.emit(GameEvents.BALL_LAUNCHED);
        }
    }

    // Per test e debug
    setGameSpeed(multiplier) {
        // Modifica la velocità del gioco per test
        this.speedMultiplier = multiplier;
    }
}
