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
            const success = await this.game.managers.auth.register(username, password);
            if (success) {
                this.showLoginMessage('Registrazione completata! Ora puoi fare login.', 'success');
            }
        } catch (error) {
            this.showLoginError(error.message || 'Errore di registrazione');
        }
    }

    async handleLogout() {
        if (this.game.managers.auth) {
            await this.game.managers.auth.logout();
        }
        this.showScreen('loginScreen');
    }

    async handleShowStats() {
        if (!this.game.managers.auth?.currentUser) {
            this.game.managers.ui.showError('Devi effettuare il login per vedere le statistiche!');
            return;
        }
        
        // Carica UserStats se necessario
        if (!this.game.managers.userStats) {
            const { UserStats } = await import('../user/UserStats.js');
            this.game.managers.userStats = new UserStats(this.game);
        }
        
        this.game.managers.userStats.showStats();
    }

    handleAbout() {
        const aboutText = `🏓 Pong Ultimate v2.0

Creato per giocare con amici online!

• Single Player vs AI
• Multiplayer online
• Controlli touch mobile
• Sistema lobby
• Sistema utenti con statistiche
• Controlli mouse

Divertiti! 🎮`;
        
        this.game.managers.ui.showInfo(aboutText, 'Informazioni');
    }

    async handleReady() {
        if (this.game.managers.lobby) {
            this.game.managers.lobby.toggleReady();
        }
    }

    handleLobbyBack() {
        if (this.game.managers.network) {
            this.game.managers.network.disconnect();
        }
        this.showScreen('mainMenu');
    }

    handleLaunchBall() {
        if (this.game.managers.gameLoop && this.game.managers.state.state.waitingForLaunch) {
            this.game.managers.state.launchBall();
            
            // In multiplayer, invia al server
            if (this.game.gameMode === 'multi' && this.game.managers.network) {
                this.game.managers.network.send('launchBall', {});
            }
        }
    }

    handleEscapeKey() {
        const escapeRoutes = {
            'settings': 'mainMenu',
            'modeSelect': 'mainMenu',
            'gameScreen': () => this.game.endGame(),
            'lobby': () => this.handleLobbyBack()
        };
        
        const route = escapeRoutes[this.currentScreen];
        if (typeof route === 'string') {
            this.showScreen(route);
        } else if (typeof route === 'function') {
            route();
        }
    }

    saveSettings() {
        if (this.game.managers.settings) {
            this.game.managers.settings.save();
        }
    }

    showLoginError(message) {
        const messageEl = document.getElementById('loginMessage');
        if (messageEl) {
            messageEl.textContent = message;
            messageEl.style.color = '#ff4444';
        }
    }

    showLoginMessage(message, type = 'error') {
        const messageEl = document.getElementById('loginMessage');
        if (messageEl) {
            messageEl.textContent = message;
            messageEl.style.color = type === 'success' ? '#00ff88' : '#ff4444';
        }
    }

    clearLoginForm() {
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
        document.getElementById('loginMessage').textContent = '';
    }

    // Metodi per aggiornare elementi UI specifici
    updateWelcomeMessage(username) {
        const welcomeEl = document.getElementById('welcomeMessage');
        if (welcomeEl) {
            welcomeEl.textContent = `👋 Benvenuto, ${username}!`;
        }
    }

    updateLobbyStatus(message, type = 'normal') {
        const statusEl = document.getElementById('lobbyStatus');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = 'status';
            if (type === 'error') statusEl.classList.add('error');
            else if (type === 'waiting') statusEl.classList.add('waiting');
        }
    }

    updateGameStatus(message, type = 'normal') {
        const statusEl = document.getElementById('gameStatus');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = 'status';
            if (type === 'waiting') statusEl.classList.add('waiting');
        }
    }

    showLaunchButton(show = true) {
        const launchBtn = document.getElementById('launchButton');
        if (launchBtn) {
            launchBtn.style.display = show ? 'block' : 'none';
        }
    }

    updateScore(score1, score2) {
        document.getElementById('score1').textContent = score1;
        document.getElementById('score2').textContent = score2;
    }

    // Gestione dinamica dei menu
    disableMenuButton(buttonId, disable = true) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = disable;
            button.style.opacity = disable ? '0.5' : '1';
            button.style.cursor = disable ? 'not-allowed' : 'pointer';
        }
    }

    hideElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = 'none';
        }
    }

    showElement(elementId, display = 'block') {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = display;
        }
    }
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
