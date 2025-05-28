// js/utils/Storage.js
export class StorageManager {
    constructor() {
        if (StorageManager.instance) {
            return StorageManager.instance;
        }
        
        StorageManager.instance = this;
        this.prefix = 'pong_';
    }

    /**
     * Salva un valore nel localStorage
     * @param {string} key - Chiave
     * @param {*} value - Valore da salvare
     */
    set(key, value) {
        try {
            const serialized = JSON.stringify(value);
            localStorage.setItem(this.prefix + key, serialized);
            return true;
        } catch (error) {
            console.error('Errore nel salvataggio:', error);
            return false;
        }
    }

    /**
     * Recupera un valore dal localStorage
     * @param {string} key - Chiave
     * @param {*} defaultValue - Valore di default se non trovato
     */
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(this.prefix + key);
            if (item === null) return defaultValue;
            
            return JSON.parse(item);
        } catch (error) {
            console.error('Errore nel recupero:', error);
            return defaultValue;
        }
    }

    /**
     * Rimuove un valore dal localStorage
     * @param {string} key - Chiave
     */
    remove(key) {
        localStorage.removeItem(this.prefix + key);
    }

    /**
     * Pulisce tutti i dati con il prefix
     */
    clear() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(this.prefix)) {
                localStorage.removeItem(key);
            }
        });
    }

    /**
     * Verifica se una chiave esiste
     * @param {string} key - Chiave
     */
    has(key) {
        return localStorage.getItem(this.prefix + key) !== null;
    }

    /**
     * Ottiene tutte le chiavi salvate
     */
    getAllKeys() {
        const keys = Object.keys(localStorage);
        return keys
            .filter(key => key.startsWith(this.prefix))
            .map(key => key.substring(this.prefix.length));
    }

    /**
     * Salva in modo sicuro (con backup del valore precedente)
     * @param {string} key - Chiave
     * @param {*} value - Valore
     */
    safeSave(key, value) {
        const backup = this.get(key);
        if (this.set(key, value)) {
            return true;
        } else {
            // Ripristina il backup in caso di errore
            if (backup !== null) {
                this.set(key, backup);
            }
            return false;
        }
    }

    /**
     * Merge di un oggetto con uno esistente
     * @param {string} key - Chiave
     * @param {Object} updates - Aggiornamenti da applicare
     */
    merge(key, updates) {
        const current = this.get(key, {});
        const merged = { ...current, ...updates };
        return this.set(key, merged);
    }
}

// Esporta l'istanza singleton
export const Storage = new StorageManager();
