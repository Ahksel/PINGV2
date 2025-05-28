// js/controls/InputManager.js
import { GameEvents } from '../core/EventManager.js';
import { KeyboardHandler } from './KeyboardHandler.js';
import { MouseHandler } from './MouseHandler.js';
import { MobileControls } from './MobileControls.js';

export class InputManager {
    constructor(game) {
        this.game = game;
        
        // Stato input corrente
        this.state = {
            player1Up: false,
            player1Down: false,
            player2Up: false,
            player2Down: false,
            pause: false,
            launchBall: false
        };
        
        // Handler per diversi tipi di input
        this.keyboard = null;
        this.mouse = null;
        this.mobile = null;
        
        this.init();
    }

    init() {
        // Inizializza handler
        this.keyboard = new KeyboardHandler(this);
        this.mouse = new MouseHandler(this);
        this.mobile = new MobileControls(this);
        
        // Configura mapping tasti base
        this.setupDefaultMappings();
    }

    setupDefaultMappings() {
        // Mappatura tastiera default
        this.keyboard.setMapping({
            // Player 1
            'q': 'player1Up',
            'Q': 'player1Up',
            'a': 'player1Down',
            'A': 'player1Down',
            
            // Player 2
            'p': 'player2Up',
            'P': 'player2Up',
            'l': 'player2Down',
            'L': 'player2Down',
            
            // Controlli generali
            ' ': 'launchBall',
            'Escape': 'pause',
            'Enter': 'action'
        });
    }

    // Metodi per aggiornare lo stato
    setState(key, value) {
        const oldValue = this.state[key];
        this.state[key] = value;
        
        // Emetti evento se lo stato è cambiato
        if (oldValue !== value) {
            this.emitInputEvent(key, value);
        }
    }

    getState() {
        return { ...this.state };
    }

    isPressed(key) {
        return this.state[key] === true;
    }

    // Emissione eventi
    emitInputEvent(key, value) {
        const eventMap = {
            'player1Up': GameEvents.INPUT_KEYDOWN,
            'player1Down': GameEvents.INPUT_KEYDOWN,
            'player2Up': GameEvents.INPUT_KEYDOWN,
            'player2Down': GameEvents.INPUT_KEYDOWN,
            'launchBall': GameEvents.INPUT_KEYDOWN,
            'pause': GameEvents.INPUT_KEYDOWN
        };
        
        if (eventMap[key]) {
            const event = value ? GameEvents.INPUT_KEYDOWN : GameEvents.INPUT_KEYUP;
            this.game.emit(event, { key, value });
        }
    }

    // Reset dello stato
    reset() {
        Object.keys(this.state).forEach(key => {
            this.state[key] = false;
        });
    }

    // Abilita/disabilita input
    enable() {
        this.keyboard.enable();
        this.mouse.enable();
        this.mobile.enable();
    }

    disable() {
        this.keyboard.disable();
        this.mouse.disable();
        this.mobile.disable();
        this.reset();
    }

    // Configurazione
    setKeyboardLayout(layout) {
        switch (layout) {
            case 'wasd':
                this.keyboard.setMapping({
                    'w': 'player1Up',
                    'W': 'player1Up',
                    's': 'player1Down',
                    'S': 'player1Down',
                    'ArrowUp': 'player2Up',
                    'ArrowDown': 'player2Down',
                    ' ': 'launchBall',
                    'Escape': 'pause'
                });
                break;
                
            case 'arrows':
                this.keyboard.setMapping({
                    'ArrowUp': 'player1Up',
                    'ArrowDown': 'player1Down',
                    'w': 'player2Up',
                    'W': 'player2Up',
                    's': 'player2Down',
                    'S': 'player2Down',
                    ' ': 'launchBall',
                    'Escape': 'pause'
                });
                break;
                
            default:
                this.setupDefaultMappings();
        }
    }

    // Gestione mouse per paddle
    handleMouseMove(y) {
        if (!this.game.managers.gameLoop) return;
        
        const gameMode = this.game.gameMode;
        const playerId = this.game.managers.network?.playerId;
        
        if (gameMode === 'single') {
            // In single player, il mouse controlla sempre il player 1
            const paddle = this.game.managers.gameLoop.getPaddle(1);
            if (paddle) {
                const paddleY = Math.max(0, Math.min(400 - paddle.height, y - paddle.height / 2));
                paddle.setPosition(paddleY);
            }
        } else if (gameMode === 'multi' && playerId) {
            // In multiplayer, invia la posizione al server
            this.game.managers.network.send('mouseInput', { paddleY: y });
        }
    }

    // Vibrazione per feedback mobile
    vibrate(pattern = [50]) {
        if ('vibrate' in navigator && this.game.managers.settings.get('vibration')) {
            navigator.vibrate(pattern);
        }
    }

    // Debug info
    getDebugInfo() {
        return {
            keyboard: this.keyboard.isEnabled,
            mouse: this.mouse.isEnabled,
            mobile: this.mobile.isEnabled,
            activeInputs: Object.entries(this.state)
                .filter(([_, value]) => value)
                .map(([key, _]) => key)
        };
    }
}
