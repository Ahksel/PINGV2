// js/utils/Settings.js
import { Constants } from './Constants.js';
import { GameEvents } from '../core/EventManager.js';

export class Settings {
    constructor(storage) {
        this.storage = storage;
        this.settings = this.getDefaultSettings();
        this.listeners = new Set();
    }

    getDefaultSettings() {
        return {
            // Gameplay
            ballSpeed: Constants.BALL_SPEED_DEFAULT,
            paddleSize: Constants.PADDLE_HEIGHT_DEFAULT,
            
            // Multiplayer
            serverIP: window.location.hostname || Constants.DEFAULT_SERVER_IP,
            serverPort: window.location.port || Constants.DEFAULT_SERVER_PORT,
            
            // Audio (per future implementazioni)
            soundEnabled: true,
            soundVolume: 0.5,
            musicEnabled: false,
            musicVolume: 0.3,
            
            // Grafica
            particleEffects: true,
            trailEffect: true,
            fpsCounter: false,
            
            // Controlli
            mouseControl: true,
            keyboardLayout: 'default', // 'default', 'wasd', 'arrows'
            touchSensitivity: 1.0
        };
    }

    async load() {
        try {
            const saved = this.storage.get(Constants.STORAGE_KEYS.SETTINGS);
            if (saved) {
                this.settings = { ...this.getDefaultSettings(), ...saved };
            }
            
            // Applica le impostazioni al DOM
            this.applyToDOM();
            
            // Setup listener per i cambiamenti
            this.setupChangeListeners();
            
            console.log('⚙️ Impostazioni caricate:', this.settings);
        } catch (error) {
            console.error('Errore caricamento impostazioni:', error);
            this.settings = this.getDefaultSettings();
        }
    }

    save() {
        try {
            // Leggi i valori dal DOM
            this.readFromDOM();
            
            // Salva nel storage
            this.storage.set(Constants.STORAGE_KEYS.SETTINGS, this.settings);
            
            // Notifica i listener
            this.notifyListeners();
            
            console.log('💾 Impostazioni salvate');
            return true;
        } catch (error) {
            console.error('Errore salvataggio impostazioni:', error);
            return false;
        }
    }

    applyToDOM() {
        // Applica i valori agli elementi del DOM
        const elements = {
            ballSpeed: this.settings.ballSpeed,
            paddleSize: this.settings.paddleSize,
            serverIP: this.settings.serverIP,
            serverPort: this.settings.serverPort
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.value = value;
            }
        });
    }

    readFromDOM() {
        // Leggi i valori dagli elementi del DOM
        const ballSpeedEl = document.getElementById('ballSpeed');
        const paddleSizeEl = document.getElementById('paddleSize');
        const serverIPEl = document.getElementById('serverIP');
        const serverPortEl = document.getElementById('serverPort');

        if (ballSpeedEl) this.settings.ballSpeed = parseInt(ballSpeedEl.value);
        if (paddleSizeEl) this.settings.paddleSize = parseInt(paddleSizeEl.value);
        if (serverIPEl) this.settings.serverIP = serverIPEl.value;
        if (serverPortEl) this.settings.serverPort = parseInt(serverPortEl.value);
    }

    setupChangeListeners() {
        // Listener per cambiamenti in tempo reale
        const elements = ['ballSpeed', 'paddleSize'];
        
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', (e) => {
                    this.handleLiveChange(id, e.target.value);
                });
            }
        });
    }

    handleLiveChange(setting, value) {
        const oldValue = this.settings[setting];
        
        switch (setting) {
            case 'ballSpeed':
                this.settings.ballSpeed = parseInt(value);
                break;
            case 'paddleSize':
                this.settings.paddleSize = parseInt(value);
                // Aggiorna le racchette in tempo reale se in gioco
                if (window.game?.managers?.state) {
                    window.game.managers.state.updatePaddleSize(this.settings.paddleSize);
                }
                break;
        }
        
        // Emetti evento di cambio impostazione
        if (window.game) {
            window.game.emit(GameEvents.SETTINGS_CHANGED, {
                setting,
                oldValue,
                newValue: value
            });
        }
    }

    // Getter per accesso rapido
    get(key) {
        return this.settings[key];
    }

    set(key, value) {
        const oldValue = this.settings[key];
        this.settings[key] = value;
        
        // Notifica il cambio
        if (window.game) {
            window.game.emit(GameEvents.SETTINGS_CHANGED, {
                setting: key,
                oldValue,
                newValue: value
            });
        }
        
        // Auto-save
        this.save();
    }

    // Listener per cambiamenti
    onChange(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback(this.settings);
            } catch (error) {
                console.error('Errore in settings listener:', error);
            }
        });
    }

    // Reset alle impostazioni di default
    reset() {
        this.settings = this.getDefaultSettings();
        this.applyToDOM();
        this.save();
    }

    // Validazione
    validate() {
        const errors = [];
        
        if (this.settings.ballSpeed < Constants.BALL_SPEED_MIN || 
            this.settings.ballSpeed > Constants.BALL_SPEED_MAX) {
            errors.push('Velocità palla non valida');
        }
        
        if (this.settings.paddleSize < Constants.PADDLE_HEIGHT_MIN || 
            this.settings.paddleSize > Constants.PADDLE_HEIGHT_MAX) {
            errors.push('Dimensione racchette non valida');
        }
        
        if (!this.settings.serverIP) {
            errors.push('IP server non valido');
        }
        
        if (this.settings.serverPort < 1 || this.settings.serverPort > 65535) {
            errors.push('Porta server non valida');
        }
        
        return errors;
    }

    // Export/Import per backup
    export() {
        return JSON.stringify(this.settings, null, 2);
    }

    import(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            this.settings = { ...this.getDefaultSettings(), ...imported };
            this.applyToDOM();
            this.save();
            return true;
        } catch (error) {
            console.error('Errore importazione impostazioni:', error);
            return false;
        }
    }

    // Metodo per ottenere le impostazioni di rete corrette
    getNetworkSettings() {
        // Se siamo su un servizio online, usa le impostazioni corrette
        const isOnline = window.location.hostname !== 'localhost' && 
                        window.location.hostname !== '127.0.0.1';
        
        if (isOnline) {
            return {
                host: window.location.hostname,
                port: window.location.port || (window.location.protocol === 'https:' ? 443 : 80),
                protocol: window.location.protocol === 'https:' ? 'wss:' : 'ws:'
            };
        }
        
        return {
            host: this.settings.serverIP,
            port: this.settings.serverPort,
            protocol: 'ws:'
        };
    }
}
