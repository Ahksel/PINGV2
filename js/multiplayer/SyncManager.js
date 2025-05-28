// js/multiplayer/SyncManager.js
import { GameEvents } from '../core/EventManager.js';

export class SyncManager {
    constructor(game) {
        this.game = game;
        
        // Buffer per interpolazione
        this.stateBuffer = [];
        this.maxBufferSize = 5;
        
        // Timestamp sincronizzazione
        this.lastSyncTime = 0;
        this.syncInterval = 50; // ms tra sincronizzazioni
        
        // Predizione e correzione
        this.enablePrediction = true;
        this.enableSmoothing = true;
        this.correctionThreshold = 10; // pixel di differenza per correggere
        
        // Statistiche sincronizzazione
        this.stats = {
            packetsReceived: 0,
            packetsSent: 0,
            corrections: 0,
            predictions: 0
        };
        
        this.init();
    }

    init() {
        // Ascolta eventi di rete
        const network = this.game.managers.network;
        if (network) {
            network.on('gameState', (data) => this.receiveState(data));
            network.on('instantAction', (data) => this.handleInstantAction(data));
        }
        
        // Ascolta eventi locali che devono essere sincronizzati
        this.game.on(GameEvents.PADDLE_MOVE, (data) => this.syncPaddleMove(data));
        this.game.on(GameEvents.BALL_LAUNCHED, () => this.syncBallLaunch());
    }

    /**
     * Invia stato corrente al server
     */
    sendState() {
        if (!this.shouldSendState()) return;
        
        const state = this.game.managers.state.serialize();
        const network = this.game.managers.network;
        
        if (network && network.isConnected) {
            network.send('gameState', { state, timestamp: Date.now() });
            this.stats.packetsSent++;
            this.lastSyncTime = Date.now();
        }
    }

    /**
     * Riceve stato dal server
     */
    receiveState(data) {
        this.stats.packetsReceived++;
        
        // Aggiungi al buffer
        this.stateBuffer.push({
            state: data.state,
            timestamp: data.timestamp || Date.now(),
            serverTime: data.serverTime
        });
        
        // Mantieni buffer di dimensione fissa
        if (this.stateBuffer.length > this.maxBufferSize) {
            this.stateBuffer.shift();
        }
        
        // Applica stato
        this.applyState();
    }

    /**
     * Applica stato con interpolazione/estrapolazione
     */
    applyState() {
        if (this.stateBuffer.length === 0) return;
        
        const latestState = this.stateBuffer[this.stateBuffer.length - 1];
        const currentState = this.game.managers.state.state;
        
        // Se siamo il server/host, ignora stati ricevuti
        if (this.game.managers.network.isHost) return;
        
        // Calcola differenze
        const ballDiff = this.calculateDifference(
            currentState.ball,
            latestState.state.ball
        );
        
        const paddle1Diff = this.calculateDifference(
            { y: currentState.paddle1.y },
            { y: latestState.state.paddle1.y }
        );
        
        const paddle2Diff = this.calculateDifference(
            { y: currentState.paddle2.y },
            { y: latestState.state.paddle2.y }
        );
        
        // Applica correzioni se necessario
        if (this.shouldCorrect(ballDiff)) {
            this.correctBall(latestState.state.ball);
        }
        
        if (this.shouldCorrect(paddle1Diff) && this.game.managers.network.playerId !== 1) {
            this.correctPaddle(1, latestState.state.paddle1.y);
        }
        
        if (this.shouldCorrect(paddle2Diff) && this.game.managers.network.playerId !== 2) {
            this.correctPaddle(2, latestState.state.paddle2.y);
        }
        
        // Aggiorna punteggio sempre
        if (latestState.state.score1 !== undefined) {
            currentState.paddle1.score = latestState.state.score1;
        }
        if (latestState.state.score2 !== undefined) {
            currentState.paddle2.score = latestState.state.score2;
        }
    }

    /**
     * Calcola differenza tra due stati
     */
    calculateDifference(current, target) {
        let diff = 0;
        
        if (current.x !== undefined && target.x !== undefined) {
            diff += Math.abs(current.x - target.x);
        }
        if (current.y !== undefined && target.y !== undefined) {
            diff += Math.abs(current.y - target.y);
        }
        
        return diff;
    }

    /**
     * Determina se correggere basato sulla differenza
     */
    shouldCorrect(difference) {
        return difference > this.correctionThreshold;
    }

    /**
     * Corregge posizione palla con smoothing
     */
    correctBall(targetState) {
        const ball = this.game.managers.gameLoop?.getBall();
        if (!ball) return;
        
        if (this.enableSmoothing) {
            // Interpolazione smooth
            const alpha = 0.3; // Fattore di smoothing
            ball.x = ball.x + (targetState.x - ball.x) * alpha;
            ball.y = ball.y + (targetState.y - ball.y) * alpha;
            ball.dx = ball.dx + (targetState.dx - ball.dx) * alpha;
            ball.dy = ball.dy + (targetState.dy - ball.dy) * alpha;
        } else {
            // Correzione diretta
            ball.deserialize(targetState);
        }
        
        this.stats.corrections++;
    }

    /**
     * Corregge posizione paddle
     */
    correctPaddle(player, targetY) {
        const paddle = this.game.managers.gameLoop?.getPaddle(player);
        if (!paddle) return;
        
        if (this.enableSmoothing) {
            const alpha = 0.5;
            paddle.y = paddle.y + (targetY - paddle.y) * alpha;
        } else {
            paddle.y = targetY;
        }
    }

    /**
     * Gestisce azioni istantanee (no interpolazione)
     */
    handleInstantAction(data) {
        switch (data.action) {
            case 'goal':
                this.game.managers.state.scoreGoal(data.scorer);
                break;
            case 'ballLaunch':
                const ball = this.game.managers.gameLoop?.getBall();
                if (ball) {
                    ball.launch(data.direction);
                }
                break;
            case 'gameEnd':
                this.game.managers.state.endGame(data.winner);
                break;
        }
    }

    /**
     * Sincronizza movimento paddle locale
     */
    syncPaddleMove(data) {
        // Invia solo se siamo il giocatore che controlla quella paddle
        const playerId = this.game.managers.network?.playerId;
        if (playerId === data.player) {
            this.sendInstant('paddleMove', { 
                player: data.player, 
                dy: data.dy 
            });
        }
    }

    /**
     * Sincronizza lancio palla
     */
    syncBallLaunch() {
        const state = this.game.managers.state.state;
        if (state.lastScorer === this.game.managers.network?.playerId) {
            this.sendInstant('ballLaunch', {
                direction: state.lastScorer === 1 ? -1 : 1
            });
        }
    }

    /**
     * Invia azione istantanea
     */
    sendInstant(action, data) {
        const network = this.game.managers.network;
        if (network && network.isConnected) {
            network.send('instantAction', { action, ...data });
        }
    }

    /**
     * Predice stato futuro
     */
    predictState(deltaTime) {
        if (!this.enablePrediction) return;
        
        const ball = this.game.managers.gameLoop?.getBall();
        const physics = this.game.managers.gameLoop?.getPhysics();
        
        if (ball && physics) {
            // Predici posizione futura della palla
            const futurePos = physics.predictBallPosition(deltaTime);
            
            // Applica predizione solo se ragionevole
            if (futurePos && Math.abs(futurePos.x - ball.x) < 100) {
                ball.x = futurePos.x;
                ball.y = futurePos.y;
                this.stats.predictions++;
            }
        }
    }

    /**
     * Determina se inviare lo stato
     */
    shouldSendState() {
        // Non inviare se non connessi
        if (!this.game.managers.network?.isConnected) return false;
        
        // Non inviare se non in gioco
        if (!this.game.managers.state?.isRunning) return false;
        
        // Controlla intervallo minimo
        const now = Date.now();
        if (now - this.lastSyncTime < this.syncInterval) return false;
        
        // Invia solo se siamo host o se richiesto
        return this.game.managers.network.isHost;
    }

    /**
     * Rollback a uno stato precedente
     */
    rollback(timestamp) {
        // Trova lo stato più vicino al timestamp
        const targetState = this.stateBuffer.find(s => s.timestamp >= timestamp);
        
        if (targetState) {
            this.game.managers.state.deserialize(targetState.state);
            console.log(`⏪ Rollback a timestamp: ${timestamp}`);
        }
    }

    /**
     * Riconciliazione client-side
     */
    reconcile() {
        // Confronta stato locale con ultimo stato server
        if (this.stateBuffer.length === 0) return;
        
        const serverState = this.stateBuffer[this.stateBuffer.length - 1].state;
        const localState = this.game.managers.state.serialize();
        
        // Se i punteggi non corrispondono, usa quelli del server
        if (serverState.score1 !== localState.paddle1.score ||
            serverState.score2 !== localState.paddle2.score) {
            this.game.managers.state.state.paddle1.score = serverState.score1;
            this.game.managers.state.state.paddle2.score = serverState.score2;
            
            // Aggiorna UI
            this.game.managers.menu.updateScore(serverState.score1, serverState.score2);
        }
    }

    /**
     * Ottimizza per latenza alta
     */
    optimizeForLatency(latency) {
        if (latency > 100) {
            // Alta latenza: più predizione, meno correzioni
            this.enablePrediction = true;
            this.correctionThreshold = 20;
            this.syncInterval = 100;
        } else if (latency > 50) {
            // Media latenza
            this.enablePrediction = true;
            this.correctionThreshold = 15;
            this.syncInterval = 75;
        } else {
            // Bassa latenza: correzioni più aggressive
            this.enablePrediction = false;
            this.correctionThreshold = 10;
            this.syncInterval = 50;
        }
    }

    /**
     * Calcola statistiche di sincronizzazione
     */
    getStats() {
        const accuracy = this.stats.packetsReceived > 0 ?
            (1 - this.stats.corrections / this.stats.packetsReceived) * 100 : 100;
        
        return {
            packetsReceived: this.stats.packetsReceived,
            packetsSent: this.stats.packetsSent,
            corrections: this.stats.corrections,
            predictions: this.stats.predictions,
            accuracy: accuracy.toFixed(1) + '%',
            bufferSize: this.stateBuffer.length
        };
    }

    /**
     * Reset sincronizzazione
     */
    reset() {
        this.stateBuffer = [];
        this.lastSyncTime = 0;
        this.stats = {
            packetsReceived: 0,
            packetsSent: 0,
            corrections: 0,
            predictions: 0
        };
    }

    /**
     * Debug info
     */
    getDebugInfo() {
        const stats = this.getStats();
        const latency = this.game.managers.network?.latency || 0;
        
        return {
            ...stats,
            latency: `${latency}ms`,
            syncInterval: `${this.syncInterval}ms`,
            predictionEnabled: this.enablePrediction,
            smoothingEnabled: this.enableSmoothing,
            correctionThreshold: this.correctionThreshold
        };
    }
}
