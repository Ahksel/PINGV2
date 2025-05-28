// js/user/AuthManager.js
import { GameEvents } from '../core/EventManager.js';
import { Constants } from '../utils/Constants.js';

export class AuthManager {
    constructor(game) {
        this.game = game;
        this.currentUser = null;
        this.isAuthenticated = false;
        this.tempPassword = null; // Per il multiplayer
    }

    /**
     * Login utente
     * @param {string} username 
     * @param {string} password 
     * @returns {Promise<boolean>}
     */
    async login(username, password) {
        try {
            // Validazione base
            if (!this.validateCredentials(username, password)) {
                throw new Error('Username e password devono avere almeno 3 caratteri');
            }

            // Salva temporaneamente la password per il multiplayer
            this.tempPassword = password;
            this.game.managers.storage.set('temp_password', password);

            // Account demo (offline)
            if (this.isDemoAccount(username, password)) {
                this.handleDemoLogin(username);
                return true;
            }

            // Login reale via server
            if (this.game.managers.network) {
                return await this.serverLogin(username, password);
            } else {
                // Se non c'è network manager, caricalo
                await this.game.loadMultiplayerModules();
                return await this.serverLogin(username, password);
            }

        } catch (error) {
            console.error('Errore login:', error);
            this.game.emit(GameEvents.AUTH_ERROR, { message: error.message });
            throw error;
        }
    }

    /**
     * Registrazione nuovo utente
     * @param {string} username 
     * @param {string} password 
     * @returns {Promise<boolean>}
     */
    async register(username, password) {
        try {
            // Validazione
            if (!this.validateCredentials(username, password)) {
                throw new Error('Username e password devono avere almeno 3 caratteri');
            }

            if (!this.validateUsername(username)) {
                throw new Error('Username può contenere solo lettere, numeri e underscore');
            }

            // Registrazione via server
            if (!this.game.managers.network) {
                await this.game.loadMultiplayerModules();
            }

            return await this.serverRegister(username, password);

        } catch (error) {
            console.error('Errore registrazione:', error);
            this.game.emit(GameEvents.AUTH_ERROR, { message: error.message });
            throw error;
        }
    }

    /**
     * Auto-login con dati salvati
     * @param {Object} savedUser 
     * @returns {Promise<boolean>}
     */
    async autoLogin(savedUser) {
        try {
            if (savedUser && savedUser.username) {
                this.currentUser = savedUser;
                this.isAuthenticated = true;
                
                this.game.emit(GameEvents.AUTH_LOGIN, { 
                    username: savedUser.username,
                    stats: savedUser.stats 
                });
                
                return true;
            }
            return false;
        } catch (error) {
            console.error('Errore auto-login:', error);
            return false;
        }
    }

    /**
     * Logout
     */
    async logout() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.tempPassword = null;
        
        // Pulisci storage
        this.game.managers.storage.remove('user');
        this.game.managers.storage.remove('temp_password');
        
        // Disconnetti da network se connesso
        if (this.game.managers.network?.isConnected) {
            this.game.managers.network.disconnect();
        }
        
        this.game.emit(GameEvents.AUTH_LOGOUT);
        
        console.log('👋 Logout completato');
    }

    /**
     * Login tramite server
     * @private
     */
    async serverLogin(username, password) {
        return new Promise((resolve, reject) => {
            const network = this.game.managers.network;
            
            // Timeout per la risposta
            const timeout = setTimeout(() => {
                reject(new Error('Timeout connessione al server'));
            }, 10000);

            // Listener per la risposta
            const handleLoginResult = (data) => {
                clearTimeout(timeout);
                
                if (data.success) {
                    this.currentUser = {
                        username: data.username,
                        stats: data.stats || { wins: 0, losses: 0, games: 0 }
                    };
                    this.isAuthenticated = true;
                    
                    // Salva nel storage
                    this.game.managers.storage.set('user', this.currentUser);
                    
                    this.game.emit(GameEvents.AUTH_LOGIN, {
                        username: this.currentUser.username,
                        stats: this.currentUser.stats
                    });
                    
                    resolve(true);
                } else {
                    reject(new Error(data.message || 'Login fallito'));
                }
            };

            // Registra il listener temporaneo
            network.once('loginResult', handleLoginResult);
            
            // Invia richiesta login
            network.send('login', { username, password });
        });
    }

    /**
     * Registrazione tramite server
     * @private
     */
    async serverRegister(username, password) {
        return new Promise((resolve, reject) => {
            const network = this.game.managers.network;
            
            const timeout = setTimeout(() => {
                reject(new Error('Timeout connessione al server'));
            }, 10000);

            const handleRegisterResult = (data) => {
                clearTimeout(timeout);
                
                if (data.success) {
                    this.game.managers.ui.showSuccess(data.message);
                    resolve(true);
                } else {
                    reject(new Error(data.message || 'Registrazione fallita'));
                }
            };

            network.once('registerResult', handleRegisterResult);
            network.send('register', { username, password });
        });
    }

    /**
     * Verifica se è un account demo
     * @private
     */
    isDemoAccount(username, password) {
        const demoAccounts = {
            'guest1': 'password',
            'guest2': 'password',
            'admin': 'admin123'
        };
        
        return demoAccounts[username] === password;
    }

    /**
     * Gestisce login account demo
     * @private
     */
    handleDemoLogin(username) {
        const demoStats = {
            'guest1': { wins: 5, losses: 3, games: 8 },
            'guest2': { wins: 2, losses: 6, games: 8 },
            'admin': { wins: 10, losses: 2, games: 12 }
        };

        this.currentUser = {
            username: username,
            stats: demoStats[username] || { wins: 0, losses: 0, games: 0 },
            isDemo: true
        };
        
        this.isAuthenticated = true;
        
        // Salva nel storage
        this.game.managers.storage.set('user', this.currentUser);
        
        this.game.emit(GameEvents.AUTH_LOGIN, {
            username: this.currentUser.username,
            stats: this.currentUser.stats
        });
        
        console.log(`✅ Login demo riuscito per ${username}`);
    }

    /**
     * Validazione credenziali base
     * @private
     */
    validateCredentials(username, password) {
        return username && password && 
               username.length >= 3 && 
               password.length >= 3;
    }

    /**
     * Validazione formato username
     * @private
     */
    validateUsername(username) {
        return Constants.VALIDATION.USERNAME.test(username);
    }

    /**
     * Ottieni statistiche utente corrente
     */
    getUserStats() {
        if (this.currentUser) {
            return this.currentUser.stats;
        }
        return null;
    }

    /**
     * Aggiorna statistiche dopo una partita
     */
    updateStats(won) {
        if (this.currentUser && this.currentUser.stats) {
            this.currentUser.stats.games++;
            if (won) {
                this.currentUser.stats.wins++;
            } else {
                this.currentUser.stats.losses++;
            }
            
            // Salva aggiornamento
            this.game.managers.storage.set('user', this.currentUser);
            
            // Se non è demo, invia al server
            if (!this.currentUser.isDemo && this.game.managers.network) {
                this.game.managers.network.send('updateStats', {
                    stats: this.currentUser.stats
                });
            }
        }
    }

    /**
     * Verifica se l'utente può giocare online
     */
    canPlayOnline() {
        return this.isAuthenticated && !this.currentUser?.isDemo;
    }
}
