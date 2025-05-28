// js/ui/MenuManager.js
import { GameEvents } from '../core/EventManager.js';
import { Constants } from '../utils/Constants.js';

export class MenuManager {
    constructor(game) {
        this.game = game;
        this.currentScreen = 'loginScreen';
        this.screens = new Map();
        
        this.init();
    }

    init() {
        // Registra tutte le schermate
        this.registerScreens();
        
        // Setup event listeners per i pulsanti
        this.setupEventListeners();
        
        // Ascolta eventi di navigazione
        this.game.on(GameEvents.SCREEN_CHANGE, (data) => {
            this.showScreen(data.screen);
        });
    }

    registerScreens() {
        // Trova tutte le schermate nel DOM
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => {
            this.screens.set(screen.id, screen);
        });
    }

    setupEventListeners() {
        // Login Screen
        this.addClickListener('loginButton', () => this.handleLogin());
        this.addClickListener('registerButton', () => this.handleRegister());
        
        // Main Menu
        this.addClickListener('playButton', () => this.showScreen('modeSelect'));
        this.addClickListener('settingsButton', () => this.showScreen('settings'));
        this.addClickListener('statsButton', () => this.handleShowStats());
        this.addClickListener('logoutButton', () => this.handleLogout());
        this.addClickListener('aboutButton', () => this.handleAbout());
        
        // Mode Select
        this.addClickListener('singlePlayerButton', () => this.game.startSinglePlayer());
        this.addClickListener('multiplayerButton', () => this.game.startMultiplayer());
        this.addClickListener('modeBackButton', () => this.showScreen('mainMenu'));
        
        // Settings
        this.addClickListener('settingsBackButton', () => {
            this.saveSettings();
            this.showScreen('mainMenu');
        });
        
        // Lobby
        this.addClickListener('lobbyBackButton', () => this.handleLobbyBack());
        this.addClickListener('readyButton1', () => this.handleReady());
        
        // Game
        this.addClickListener('gameBackButton', () => this.game.endGame());
        this.addClickListener('launchButton', () => this.handleLaunchBall());
        
        // Keyboard shortcuts
        this.setupKeyboardShortcuts();
    }

    addClickListener(elementId, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener('click', handler);
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Enter per login
            if (this.currentScreen === 'loginScreen' && e.key === 'Enter') {
                this.handleLogin();
            }
            
            // ESC per tornare indietro
            if (e.key === 'Escape') {
                this.handleEscapeKey();
            }
            
            // Spazio per lanciare la palla
            if (this.currentScreen === 'gameScreen' && e.key === ' ') {
                e.preventDefault();
                this.handleLaunchBall();
            }
        });
    }

    showScreen(screenId) {
        // Nascondi tutte le schermate
        this.screens.forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Mostra la schermata richiesta
        const targetScreen = this.screens.get(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId;
            
            // Emetti evento di cambio schermata
            this.game.emit(GameEvents.SCREEN_CHANGE, { 
                from: this.currentScreen, 
                to: screenId 
            });
            
            // Focus su elementi appropriati
            this.handleScreenFocus(screenId);
        }
    }

    handleScreenFocus(screenId) {
        switch (screenId) {
            case 'loginScreen':
                document.getElementById('loginUsername')?.focus();
                break;
            case 'settings':
                document.getElementById('ballSpeed')?.focus();
                break;
        }
    }

    async handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        
        if (!username || !password) {
            this.showLoginError('Inserisci username e password');
            return;
        }
        
        // Carica AuthManager se necessario
        if (!this.game.managers.auth) {
            const { AuthManager } = await import('../user/AuthManager.js');
            this.game.managers.auth = new AuthManager(this.game);
        }
        
        try {
            const success = await this.game.managers.auth.login(username, password);
            if (success) {
                this.clearLoginForm();
                this.showScreen('mainMenu');
            }
        } catch (error) {
            this.showLoginError(error.message || 'Errore di login');
        }
    }

    async handleRegister() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        
        if (!username || !password) {
            this.showLoginError('Inserisci username e password');
            return;
        }
        
        // Carica AuthManager se necessario
        if (!this.game.managers.auth) {
            const { AuthManager } = await import('../user/AuthManager.js');
            this.game.managers.auth = new AuthManager(this.game);
        }
