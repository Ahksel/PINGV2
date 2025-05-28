// js/multiplayer/NetworkManager.js
import { GameEvents } from '../core/EventManager.js';
import { Constants } from '../utils/Constants.js';

export class NetworkManager {
    constructor(game) {
        this.game = game;
        this.ws = null;
        this.isConnected = false;
        this.playerId = null;
        this.isHost = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.pingInterval = null;
        this.lastPing = 0;
        this.latency = 0;
        
        // Coda messaggi per quando non connesso
        this.messageQueue = [];
        
        // Listener per messaggi specifici
        this.messageHandlers = new Map();
        
        // Ultimo stato ricevuto dal server
        this.lastGameState = null;
        
        this.setupDefaultHandlers();
    }

    setupDefaultHandlers() {
        // Handler di base per messaggi dal server
        this.on('playerId', (data) => this.handlePlayerId(data));
        this.on('gameState', (data) => this.handleGameState(data));
        this.on('playerLeft', (data) => this.handlePlayerLeft(data));
        this.on('error', (data) => this.handleError(data));
        this.on('pong', () => this.handlePong());
    }

    /**
     * Connette al server WebSocket
     * @returns {Promise<boolean>}
     */
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                const settings = this.game.managers.settings.getNetworkSettings();
                const wsUrl = `${settings.protocol}//${settings.host}`;
                
                console.log('🔌 Tentativo connessione a:', wsUrl);
                
                this.ws = new WebSocket(wsUrl);
                
                // Timeout connessione
                const timeout = setTimeout(() => {
                    if (this.ws.readyState !== WebSocket.OPEN) {
                        this.ws.close();
                        reject(new Error('Timeout connessione'));
                    }
                }, 10000);
                
                this.ws.onopen = () => {
                    clearTimeout(timeout);
                    this.onConnect();
                    resolve(true);
                };
                
                this.ws.onmessage = (event) => {
                    this.onMessage(event);
                };
                
                this.ws.onclose = (event) => {
                    this.onDisconnect(event);
                };
                
                this.ws.onerror = (error) => {
                    clearTimeout(timeout);
                    this.onError(error);
                    reject(error);
                };
                
            } catch (error) {
                console.error('❌ Errore creazione WebSocket:', error);
                reject(error);
            }
        });
    }

    /**
     * Disconnette dal server
     */
    disconnect() {
        this.isConnected = false;
        this.playerId = null;
        
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.game.emit(GameEvents.NETWORK_DISCONNECTED);
        console.log('🔌 Disconnesso dal server');
    }

    /**
     * Invia un messaggio al server
     * @param {string} type - Tipo di messaggio
     * @param {Object} data - Dati da inviare
     */
    send(type, data = {}) {
        const message = JSON.stringify({ type, ...data });
        
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(message);
        } else {
            // Accoda il messaggio se non connesso
            this.messageQueue.push(message);
            console.warn('⚠️ Messaggio accodato (non connesso):', type);
        }
    }

    /**
     * Registra un handler per un tipo di messaggio
     * @param {string} type - Tipo di messaggio
     * @param {Function} handler - Funzione handler
     */
    on(type, handler) {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, new Set());
        }
        this.messageHandlers.get(type).add(handler);
    }

    /**
     * Registra un handler che si esegue una volta sola
     * @param {string} type - Tipo di messaggio
     * @param {Function} handler - Funzione handler
     */
    once(type, handler) {
        const wrappedHandler = (data) => {
            handler(data);
            this.off(type, wrappedHandler);
        };
        this.on(type, wrappedHandler);
    }

    /**
     * Rimuove un handler
     * @param {string} type - Tipo di messaggio
     * @param {Function} handler - Funzione handler
     */
    off(type, handler) {
        if (this.messageHandlers.has(type)) {
            this.messageHandlers.get(type).delete(handler);
        }
    }

    // Event Handlers
    onConnect() {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        console.log('✅ WebSocket connesso!');
        
        // Invia messaggi in coda
        this.flushMessageQueue();
        
        // Avvia ping per calcolare latenza
        this.startPing();
        
        // Login automatico se abbiamo credenziali
        this.autoLogin();
        
        this.game.emit(GameEvents.NETWORK_CONNECTED);
    }

    onMessage(event) {
        try {
            const data = JSON.parse(event.data);
            
            // Gestisci con handler registrati
            if (this.messageHandlers.has(data.type)) {
                this.messageHandlers.get(data.type).forEach(handler => {
                    handler(data);
                });
            }
            
        } catch (error) {
            console.error('❌ Errore parsing messaggio:', error);
        }
    }

    onDisconnect(event) {
        this.isConnected = false;
        const wasClean = event.wasClean;
        
        console.log(`🔌 Disconnesso: ${wasClean ? 'pulito' : 'inaspettato'} (code: ${event.code})`);
        
        this.game.emit(GameEvents.NETWORK_DISCONNECTED);
        
        // Tenta riconnessione se non pulito
        if (!wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
        }
    }

    onError(error) {
        console.error('❌ Errore WebSocket:', error);
        this.game.emit(GameEvents.NETWORK_ERROR, { error });
    }

    // Gestione messaggi specifici
    handlePlayerId(data) {
        this.playerId = data.id;
        console.log(`🎮 Assegnato player ID: ${this.playerId}`);
    }

    handleGameState(data) {
        this.lastGameState = data.state;
        
        // Aggiorna lo stato locale se non siamo host
        if (!this.isHost && this.game.managers.state) {
            this.game.managers.state.deserialize(data.state);
        }
    }

    handlePlayerLeft(data) {
        console.log('👋 Un giocatore ha lasciato la partita');
        this.game.emit(GameEvents.PLAYER_LEFT, data);
    }

    handleError(data) {
        console.error('❌ Errore dal server:', data.message);
        this.game.managers.ui.showError(data.message);
    }

    handlePong() {
        const latency = Date.now() - this.lastPing;
        this.latency = latency;
        
        // Aggiorna UI con latenza se visibile
        const latencyEl = document.getElementById('networkLatency');
        if (latencyEl) {
            latencyEl.textContent = `Ping: ${latency}ms`;
        }
    }

    // Utility
    flushMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(message);
            }
        }
    }

    startPing() {
        this.pingInterval = setInterval(() => {
            if (this.isConnected) {
                this.lastPing = Date.now();
                this.send('ping');
            }
        }, Constants.PING_INTERVAL);
    }

    async attemptReconnect() {
        this.reconnectAttempts++;
        console.log(`🔄 Tentativo riconnessione ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        
        this.game.managers.ui.showWarning(`Riconnessione in corso... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(async () => {
            try {
                await this.connect();
            } catch (error) {
                console.error('❌ Riconnessione fallita:', error);
            }
        }, Constants.RECONNECT_DELAY * this.reconnectAttempts);
    }

    async autoLogin() {
        const auth = this.game.managers.auth;
        if (auth && auth.currentUser && auth.tempPassword) {
            console.log('🔑 Auto-login per multiplayer...');
            this.send('login', {
                username: auth.currentUser.username,
                password: auth.tempPassword
            });
        }
    }

    // Metodi per il gioco
    joinLobby() {
        this.send('joinLobby');
    }

    leaveLobby() {
        this.send('leaveLobby');
    }

    setReady(ready) {
        this.send('playerReady', { ready });
    }

    sendInput(input) {
        this.send('input', { input });
    }

    stopInput() {
        this.send('inputStop');
    }

    launchBall() {
        this.send('launchBall');
    }

    // Debug info
    getDebugInfo() {
        return {
            connected: this.isConnected,
            playerId: this.playerId,
            latency: this.latency,
            queuedMessages: this.messageQueue.length,
            reconnectAttempts: this.reconnectAttempts
        };
    }
}
