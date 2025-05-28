// js/core/Game.js
import { EventManager } from './EventManager.js';
import { GameState } from './GameState.js';
import { Constants } from '../utils/Constants.js';

export class Game {
    constructor() {
        this.managers = {};
        this.currentScreen = 'loginScreen';
        this.gameMode = null;
        this.isInitialized = false;
    }

    async init() {
        console.log('🎮 Inizializzazione Pong Ultimate...');
        
        try {
            // Inizializza i manager core
            await this.initializeCoreManagers();
            
            // Inizializza i manager UI
            await this.initializeUIManagers();
            
            // Carica le impostazioni
            await this.loadSettings();
            
            // Controlla auto-login
            await this.checkAutoLogin();
            
            this.isInitialized = true;
            console.log('✅ Gioco inizializzato con successo!');
            
        } catch (error) {
            console.error('❌ Errore durante l\'inizializzazione:', error);
            this.handleInitError(error);
        }
    }

    async initializeCoreManagers() {
        // Event Manager - Sistema eventi centralizzato
        this.managers.events = new EventManager();
        
        // Game State - Stato del gioco
        this.managers.state = new GameState(this.managers.events);
        
        // Storage Manager
        const { Storage } = await import('../utils/Storage.js');
        this.managers.storage = Storage;
        
        console.log('📦 Manager core inizializzati');
    }

    async initializeUIManagers() {
        // Menu Manager
        const { MenuManager } = await import('../ui/MenuManager.js');
        this.managers.menu = new MenuManager(this);
        
        // UI Renderer
        const { UIRenderer } = await import('../ui/UIRenderer.js');
        this.managers.ui = new UIRenderer(this);
        
        console.log('🎨 Manager UI inizializzati');
    }

    async loadSettings() {
        const { Settings } = await import('../utils/Settings.js');
        this.managers.settings = new Settings(this.managers.storage);
        await this.managers.settings.load();
        
        console.log('⚙️ Impostazioni caricate');
    }

    async checkAutoLogin() {
        const savedUser = this.managers.storage.get('pong_user');
        if (savedUser) {
            try {
                // Inizializza Auth Manager se necessario
                if (!this.managers.auth) {
                    const { AuthManager } = await import('../user/AuthManager.js');
                    this.managers.auth = new AuthManager(this);
                }
                
                const success = await this.managers.auth.autoLogin(savedUser);
                if (success) {
                    this.managers.menu.showScreen('mainMenu');
                    this.managers.ui.showWelcomeMessage(savedUser.username);
                } else {
                    this.managers.menu.showScreen('loginScreen');
                }
            } catch (error) {
                console.error('Errore auto-login:', error);
                this.managers.menu.showScreen('loginScreen');
            }
        } else {
            this.managers.menu.showScreen('loginScreen');
        }
    }

    async startSinglePlayer() {
        console.log('🤖 Avvio modalità Single Player...');
        
        // Carica i moduli di gioco se non già caricati
        await this.loadGameModules();
        
        this.gameMode = 'single';
        this.managers.state.resetGame();
        this.managers.menu.showScreen('gameScreen');
        
        // Avvia il game loop
        if (this.managers.gameLoop) {
            this.managers.gameLoop.start('single');
        }
    }

    async startMultiplayer() {
        console.log('🌐 Avvio modalità Multiplayer...');
        
        if (!this.managers.auth?.currentUser) {
            this.managers.ui.showError('Devi effettuare il login per giocare online!');
            return;
        }
        
        // Carica i moduli multiplayer
        await this.loadMultiplayerModules();
        
        this.gameMode = 'multi';
        this.managers.menu.showScreen('lobby');
        
        // Connetti al server
        if (this.managers.network) {
            await this.managers.network.connect();
        }
    }

    async loadGameModules() {
        if (this.managers.gameLoop) return;
        
        console.log('📦 Caricamento moduli di gioco...');
        
        const [
            { GameLoop },
            { InputManager },
            { Renderer }
        ] = await Promise.all([
            import('../game/GameLoop.js'),
            import('../controls/InputManager.js'),
            import('../game/Renderer.js')
        ]);
        
        this.managers.gameLoop = new GameLoop(this);
        this.managers.input = new InputManager(this);
        this.managers.renderer = new Renderer(this);
        
        console.log('✅ Moduli di gioco caricati');
    }

    async loadMultiplayerModules() {
        if (this.managers.network) return;
        
        console.log('📦 Caricamento moduli multiplayer...');
        
        const [
            { NetworkManager },
            { LobbyManager }
        ] = await Promise.all([
            import('../multiplayer/NetworkManager.js'),
            import('../multiplayer/LobbyManager.js')
        ]);
        
        this.managers.network = new NetworkManager(this);
        this.managers.lobby = new LobbyManager(this);
        
        console.log('✅ Moduli multiplayer caricati');
    }

    endGame() {
        console.log('🏁 Terminando la partita...');
        
        if (this.managers.gameLoop) {
            this.managers.gameLoop.stop();
        }
        
        if (this.managers.network && this.gameMode === 'multi') {
            this.managers.network.disconnect();
        }
        
        this.gameMode = null;
        this.managers.menu.showScreen('mainMenu');
    }

    handleInitError(error) {
        // Mostra un messaggio di errore user-friendly
        const message = 'Si è verificato un errore durante il caricamento del gioco. Ricarica la pagina.';
        
        // Se l'UI manager è disponibile, usa quello
        if (this.managers.ui) {
            this.managers.ui.showError(message);
        } else {
            // Altrimenti usa un alert base
            alert(message);
        }
    }

    // Metodo helper per accedere facilmente all'event manager
    emit(event, data) {
        if (this.managers.events) {
            this.managers.events.emit(event, data);
        }
    }

    on(event, callback) {
        if (this.managers.events) {
            this.managers.events.on(event, callback);
        }
    }

    off(event, callback) {
        if (this.managers.events) {
            this.managers.events.off(event, callback);
        }
    }
}
