// js/utils/Constants.js
export const Constants = {
    // Canvas
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 400,
    
    // Palla
    BALL_RADIUS: 8,
    BALL_SPEED_MIN: 3,
    BALL_SPEED_MAX: 8,
    BALL_SPEED_DEFAULT: 5,
    
    // Racchette
    PADDLE_WIDTH: 15,
    PADDLE_HEIGHT_MIN: 70,
    PADDLE_HEIGHT_MAX: 130,
    PADDLE_HEIGHT_DEFAULT: 100,
    PADDLE_SPEED: 8,
    PADDLE_OFFSET: 20,
    
    // Gioco
    WINNING_SCORE: 5,
    COUNTDOWN_DURATION: 3,
    
    // AI
    AI_SPEED: 0.6,
    AI_REACTION_ZONE: 10,
    
    // Network
    DEFAULT_SERVER_IP: 'localhost',
    DEFAULT_SERVER_PORT: 3000,
    RECONNECT_DELAY: 3000,
    PING_INTERVAL: 30000,
    
    // UI
    TRANSITION_DURATION: 300,
    MESSAGE_DURATION: 3000,
    
    // Storage Keys
    STORAGE_KEYS: {
        USER: 'pong_user',
        SETTINGS: 'pong_settings',
        STATS: 'pong_stats'
    },
    
    // Colori
    COLORS: {
        PRIMARY: '#00ff88',
        SECONDARY: '#00aaff',
        DANGER: '#ff4444',
        WARNING: '#ffaa00',
        BACKGROUND: 'rgba(0, 0, 0, 0.8)',
        PADDLE: '#00ff88',
        BALL: '#00ff88',
        TEXT: '#ffffff'
    },
    
    // Suoni (per future implementazioni)
    SOUNDS: {
        PADDLE_HIT: 'paddle_hit',
        WALL_HIT: 'wall_hit',
        GOAL: 'goal',
        GAME_START: 'game_start',
        GAME_END: 'game_end'
    },
    
    // Testi UI
    UI_TEXT: {
        TITLE: '🏓 PONG ULTIMATE',
        LOGIN_TITLE: 'Accedi o Registrati',
        DEMO_ACCOUNTS: '🎮 Account Demo:',
        SINGLE_PLAYER: '🤖 SINGLE PLAYER',
        MULTIPLAYER: '🌐 MULTIPLAYER',
        SETTINGS: '⚙️ IMPOSTAZIONI',
        STATS: '📊 STATISTICHE',
        LOGOUT: '🚪 LOGOUT',
        ABOUT: 'ℹ️ INFO',
        BACK: '← INDIETRO',
        READY: 'PRONTO',
        CANCEL: 'ANNULLA',
        LAUNCH_BALL: '🚀 LANCIA LA PALLA (SPAZIO)',
        CONNECTING: 'Connessione...',
        WAITING_PLAYER: 'In attesa di un altro giocatore...',
        GAME_OVER: 'GAME OVER',
        YOU_WIN: '🎉 HAI VINTO!',
        YOU_LOSE: '💔 HAI PERSO!',
        PLAYER_1: 'Giocatore 1',
        PLAYER_2: 'Giocatore 2'
    },
    
    // Messaggi di errore
    ERROR_MESSAGES: {
        CONNECTION_FAILED: 'Impossibile connettersi al server',
        LOGIN_REQUIRED: 'Devi effettuare il login per giocare online!',
        LOBBY_FULL: 'La lobby è piena!',
        INVALID_CREDENTIALS: 'Username o password non validi',
        USERNAME_TAKEN: 'Username già esistente',
        SERVER_ERROR: 'Errore del server',
        NETWORK_ERROR: 'Errore di rete'
    },
    
    // Regex validazione
    VALIDATION: {
        USERNAME: /^[a-zA-Z0-9_]{3,20}$/,
        PASSWORD: /^.{3,50}$/
    }
};

// Freeze per impedire modifiche accidentali
Object.freeze(Constants);
Object.freeze(Constants.STORAGE_KEYS);
Object.freeze(Constants.COLORS);
Object.freeze(Constants.SOUNDS);
Object.freeze(Constants.UI_TEXT);
Object.freeze(Constants.ERROR_MESSAGES);
Object.freeze(Constants.VALIDATION);
