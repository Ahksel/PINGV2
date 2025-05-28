// js/core/EventManager.js
export class EventManager {
    constructor() {
        this.listeners = new Map();
        this.debug = false; // Abilita per debug eventi
    }

    /**
     * Registra un listener per un evento
     * @param {string} event - Nome dell'evento
     * @param {Function} callback - Funzione da eseguire
     * @param {Object} context - Contesto per il this (opzionale)
     */
    on(event, callback, context = null) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        
        const listener = {
            callback,
            context,
            once: false
        };
        
        this.listeners.get(event).add(listener);
        
        if (this.debug) {
            console.log(`📢 Listener registrato per: ${event}`);
        }
        
        return () => this.off(event, callback);
    }

    /**
     * Registra un listener che si esegue una sola volta
     * @param {string} event - Nome dell'evento
     * @param {Function} callback - Funzione da eseguire
     * @param {Object} context - Contesto per il this (opzionale)
     */
    once(event, callback, context = null) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        
        const listener = {
            callback,
            context,
            once: true
        };
        
        this.listeners.get(event).add(listener);
        
        return () => this.off(event, callback);
    }

    /**
     * Rimuove un listener
     * @param {string} event - Nome dell'evento
     * @param {Function} callback - Funzione da rimuovere
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        
        const eventListeners = this.listeners.get(event);
        const toRemove = [];
        
        eventListeners.forEach(listener => {
            if (listener.callback === callback) {
                toRemove.push(listener);
            }
        });
        
        toRemove.forEach(listener => eventListeners.delete(listener));
        
        if (eventListeners.size === 0) {
            this.listeners.delete(event);
        }
        
        if (this.debug) {
            console.log(`🔇 Listener rimosso per: ${event}`);
        }
    }

    /**
     * Emette un evento
     * @param {string} event - Nome dell'evento
     * @param {*} data - Dati da passare ai listener
     */
    emit(event, data = null) {
        if (!this.listeners.has(event)) return;
        
        if (this.debug) {
            console.log(`📡 Evento emesso: ${event}`, data);
        }
        
        const eventListeners = this.listeners.get(event);
        const toRemove = [];
        
        eventListeners.forEach(listener => {
            try {
                if (listener.context) {
                    listener.callback.call(listener.context, data);
                } else {
                    listener.callback(data);
                }
                
                if (listener.once) {
                    toRemove.push(listener);
                }
            } catch (error) {
                console.error(`Errore nell'esecuzione del listener per ${event}:`, error);
            }
        });
        
        // Rimuovi i listener "once"
        toRemove.forEach(listener => eventListeners.delete(listener));
    }

    /**
     * Rimuove tutti i listener per un evento specifico
     * @param {string} event - Nome dell'evento
     */
    removeAllListeners(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }

    /**
     * Attende che un evento venga emesso
     * @param {string} event - Nome dell'evento
     * @returns {Promise} Promise che si risolve quando l'evento viene emesso
     */
    waitFor(event) {
        return new Promise(resolve => {
            this.once(event, resolve);
        });
    }

    /**
     * Abilita/disabilita il debug
     * @param {boolean} enabled 
     */
    setDebug(enabled) {
        this.debug = enabled;
    }
}

// Eventi del gioco
export const GameEvents = {
    // Sistema
    GAME_INIT: 'game:init',
    GAME_READY: 'game:ready',
    GAME_ERROR: 'game:error',
    
    // Autenticazione
    AUTH_LOGIN: 'auth:login',
    AUTH_LOGOUT: 'auth:logout',
    AUTH_ERROR: 'auth:error',
    
    // Menu e navigazione
    SCREEN_CHANGE: 'screen:change',
    MENU_SELECT: 'menu:select',
    
    // Gameplay
    GAME_START: 'game:start',
    GAME_PAUSE: 'game:pause',
    GAME_RESUME: 'game:resume',
    GAME_END: 'game:end',
    
    // Punteggio
    SCORE_UPDATE: 'score:update',
    GOAL_SCORED: 'goal:scored',
    
    // Input
    INPUT_KEYDOWN: 'input:keydown',
    INPUT_KEYUP: 'input:keyup',
    INPUT_MOUSE: 'input:mouse',
    INPUT_TOUCH: 'input:touch',
    
    // Multiplayer
    NETWORK_CONNECTED: 'network:connected',
    NETWORK_DISCONNECTED: 'network:disconnected',
    NETWORK_ERROR: 'network:error',
    LOBBY_UPDATE: 'lobby:update',
    PLAYER_READY: 'player:ready',
    PLAYER_LEFT: 'player:left',
    
    // Fisica
    BALL_COLLISION: 'ball:collision',
    BALL_RESET: 'ball:reset',
    PADDLE_MOVE: 'paddle:move',
    
    // Settings
    SETTINGS_CHANGED: 'settings:changed',
    SETTINGS_SAVED: 'settings:saved'
};
