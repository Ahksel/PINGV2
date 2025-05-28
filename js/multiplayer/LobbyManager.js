// js/multiplayer/LobbyManager.js
import { GameEvents } from '../core/EventManager.js';
import { Constants } from '../utils/Constants.js';

export class LobbyManager {
    constructor(game) {
        this.game = game;
        this.lobbyState = {
            player1: null,
            player2: null,
            player1Ready: false,
            player2Ready: false,
            player1Name: '',
            player2Name: '',
            playersCount: 0
        };
        
        this.isReady = false;
        this.countdownInterval = null;
        
        this.init();
    }

    init() {
        // Ascolta eventi network
        const network = this.game.managers.network;
        if (network) {
            network.on('lobbyUpdate', (data) => this.handleLobbyUpdate(data));
            network.on('gameStart', () => this.handleGameStart());
            network.on('countdown', (data) => this.handleCountdown(data));
        }
        
        // Ascolta eventi locali
        this.game.on(GameEvents.PLAYER_LEFT, () => this.handlePlayerLeft());
    }

    /**
     * Entra nella lobby
     */
    async joinLobby() {
        try {
            // Mostra schermata lobby
            this.game.managers.menu.showScreen('lobby');
            this.updateUI('Connessione alla lobby...', 'waiting');
            
            // Connetti se necessario
            const network = this.game.managers.network;
            if (!network.isConnected) {
                await network.connect();
            }
            
            // Entra nella lobby
            network.joinLobby();
            
        } catch (error) {
            console.error('❌ Errore joining lobby:', error);
            this.updateUI('Errore di connessione', 'error');
            this.game.managers.ui.showError('Impossibile connettersi alla lobby');
        }
    }

    /**
     * Lascia la lobby
     */
    leaveLobby() {
        this.resetState();
        
        if (this.game.managers.network) {
            this.game.managers.network.leaveLobby();
        }
        
        this.game.managers.menu.showScreen('mainMenu');
    }

    /**
     * Toggle stato ready
     */
    toggleReady() {
        this.isReady = !this.isReady;
        
        // Aggiorna UI
        this.updateReadyButton();
        
        // Invia al server
        if (this.game.managers.network) {
            this.game.managers.network.setReady(this.isReady);
        }
    }

    /**
     * Gestisce aggiornamento lobby dal server
     */
    handleLobbyUpdate(data) {
        console.log('🔄 Aggiornamento lobby:', data);
        
        // Aggiorna stato locale
        this.lobbyState = {
            player1: data.player1,
            player2: data.player2,
            player1Ready: data.player1Ready,
            player2Ready: data.player2Ready,
            player1Name: data.player1Name || 'Giocatore 1',
            player2Name: data.player2Name || 'Giocatore 2',
            playersCount: data.playersCount
        };
        
        // Aggiorna UI
        this.updateLobbyUI();
        
        // Emetti evento
        this.game.emit(GameEvents.LOBBY_UPDATE, this.lobbyState);
    }

    /**
     * Aggiorna interfaccia lobby
     */
    updateLobbyUI() {
        const playerId = this.game.managers.network?.playerId;
        
        // Aggiorna nomi giocatori
        document.getElementById('player1Name').textContent = this.lobbyState.player1Name;
        document.getElementById('player2Name').textContent = this.lobbyState.player2Name;
        
        // Aggiorna stati
        document.getElementById('player1Status').textContent = 
            this.lobbyState.player1 ? 
                (this.lobbyState.player1Ready ? '✅ PRONTO!' : '⏳ Connesso') : 
                '❌ In attesa...';
                
        document.getElementById('player2Status').textContent = 
            this.lobbyState.player2 ? 
                (this.lobbyState.player2Ready ? '✅ PRONTO!' : '⏳ Connesso') : 
                '❌ In attesa...';
        
        // Aggiorna card visive
        const player1Card = document.getElementById('player1Card');
        const player2Card = document.getElementById('player2Card');
        
        if (player1Card) {
            player1Card.classList.toggle('ready', this.lobbyState.player1Ready);
            if (playerId === 1) {
                player1Card.classList.add('current-player');
            }
        }
        
        if (player2Card) {
            player2Card.classList.toggle('ready', this.lobbyState.player2Ready);
            if (playerId === 2) {
                player2Card.classList.add('current-player');
            }
        }
        
        // Aggiorna stato generale
        if (this.lobbyState.playersCount === 2) {
            if (this.lobbyState.player1Ready && this.lobbyState.player2Ready) {
                this.updateUI('Pronti! Avvio partita...', 'success');
            } else {
                this.updateUI('In attesa che entrambi i giocatori siano pronti', 'normal');
            }
            
            // Mostra pulsante ready
            this.showReadyButton(true);
        } else {
            this.updateUI('In attesa di un altro giocatore...', 'waiting');
            this.showReadyButton(false);
        }
    }

    /**
     * Gestisce inizio partita
     */
    handleGameStart() {
        console.log('🚀 Partita iniziata!');
        this.game.emit(GameEvents.GAME_START);
    }

    /**
     * Gestisce countdown
     */
    handleCountdown(data) {
        const countdownEl = document.getElementById('countdown');
        if (!countdownEl) return;
        
        countdownEl.style.display = 'block';
        countdownEl.textContent = data.count;
        
        if (data.count === 0) {
            countdownEl.textContent = 'VIA!';
            setTimeout(() => {
                countdownEl.style.display = 'none';
                this.startGame();
            }, 500);
        }
    }

    /**
     * Avvia il gioco
     */
    startGame() {
        // Passa alla schermata di gioco
        this.game.managers.menu.showScreen('gameScreen');
        
        // Avvia il game loop in modalità multiplayer
        if (this.game.managers.gameLoop) {
            this.game.managers.gameLoop.start('multi');
        }
    }

    /**
     * Gestisce disconnessione giocatore
     */
    handlePlayerLeft() {
        this.updateUI('L\'altro giocatore si è disconnesso', 'error');
        this.resetReadyStates();
        
        // Torna in attesa
        setTimeout(() => {
            if (this.game.managers.menu.currentScreen === 'lobby') {
                this.updateUI('In attesa di un nuovo giocatore...', 'waiting');
            }
        }, 3000);
    }

    /**
     * Utility UI
     */
    updateUI(message, type = 'normal') {
        this.game.managers.menu.updateLobbyStatus(message, type);
    }

    updateReadyButton() {
        const button = document.getElementById('readyButton1');
        if (button) {
            button.textContent = this.isReady ? '❌ ANNULLA' : '✅ PRONTO';
            button.classList.toggle('ready', this.isReady);
        }
    }

    showReadyButton(show) {
        const button = document.getElementById('readyButton1');
        if (button) {
            button.style.display = show ? 'block' : 'none';
        }
    }

    resetState() {
        this.isReady = false;
        this.lobbyState = {
            player1: null,
            player2: null,
            player1Ready: false,
            player2Ready: false,
            player1Name: '',
            player2Name: '',
            playersCount: 0
        };
        
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
    }

    resetReadyStates() {
        this.isReady = false;
        this.lobbyState.player1Ready = false;
        this.lobbyState.player2Ready = false;
        this.updateReadyButton();
        this.updateLobbyUI();
    }

    // Metodi per UI avanzata
    showPlayerProfile(player) {
        const playerData = player === 1 ? 
            { name: this.lobbyState.player1Name, ready: this.lobbyState.player1Ready } :
            { name: this.lobbyState.player2Name, ready: this.lobbyState.player2Ready };
        
        // Potresti mostrare statistiche del giocatore
        // Per ora mostra solo info base
        this.game.managers.ui.showInfo(
            `${playerData.name}\nStato: ${playerData.ready ? 'Pronto' : 'In attesa'}`,
            'Profilo Giocatore'
        );
    }

    // Chat lobby (per future implementazioni)
    sendChatMessage(message) {
        if (this.game.managers.network) {
            this.game.managers.network.send('lobbyChat', { message });
        }
    }

    receiveChatMessage(data) {
        // Implementare UI chat
        console.log(`💬 ${data.player}: ${data.message}`);
    }

    // Debug info
    getDebugInfo() {
        return {
            state: this.lobbyState,
            isReady: this.isReady,
            playerId: this.game.managers.network?.playerId
        };
    }
}
