// js/controls/KeyboardHandler.js
export class KeyboardHandler {
    constructor(inputManager) {
        this.inputManager = inputManager;
        this.isEnabled = false;
        this.keyMapping = {};
        this.pressedKeys = new Set();
        
        // Bind dei metodi per mantenere il contesto
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        
        this.enable();
    }

    enable() {
        if (this.isEnabled) return;
        
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
        this.isEnabled = true;
        
        console.log('⌨️ Keyboard handler abilitato');
    }

    disable() {
        if (!this.isEnabled) return;
        
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        this.isEnabled = false;
        this.pressedKeys.clear();
        
        console.log('⌨️ Keyboard handler disabilitato');
    }

    setMapping(mapping) {
        this.keyMapping = { ...mapping };
    }

    handleKeyDown(event) {
        // Ignora se siamo in un input field
        if (this.shouldIgnoreInput(event)) return;
        
        const key = event.key;
        
        // Evita ripetizione automatica dei tasti
        if (this.pressedKeys.has(key)) return;
        
        this.pressedKeys.add(key);
        
        // Trova l'azione mappata per questo tasto
        const action = this.keyMapping[key];
        if (action) {
            event.preventDefault();
            this.inputManager.setState(action, true);
            
            // Gestione azioni speciali
            this.handleSpecialActions(action);
        }
    }

    handleKeyUp(event) {
        const key = event.key;
        this.pressedKeys.delete(key);
        
        const action = this.keyMapping[key];
        if (action) {
            event.preventDefault();
            this.inputManager.setState(action, false);
        }
    }

    handleSpecialActions(action) {
        const game = this.inputManager.game;
        
        switch (action) {
            case 'pause':
                if (game.managers.state?.isRunning) {
                    if (game.managers.state.isPaused) {
                        game.managers.state.resumeGame();
                    } else {
                        game.managers.state.pauseGame();
                    }
                }
                break;
                
            case 'launchBall':
                if (game.managers.gameLoop) {
                    game.managers.gameLoop.launchBall();
                }
                break;
                
            case 'action':
                // Azione generica per menu
                const activeButton = document.activeElement;
                if (activeButton?.tagName === 'BUTTON') {
                    activeButton.click();
                }
                break;
        }
    }

    shouldIgnoreInput(event) {
        // Ignora input se siamo in un campo di testo
        const tagName = event.target.tagName.toLowerCase();
        const isInputField = tagName === 'input' || 
                           tagName === 'textarea' || 
                           tagName === 'select';
        
        // Ignora anche se siamo in una schermata di menu (non di gioco)
        const currentScreen = this.inputManager.game.managers.menu?.currentScreen;
        const isInGame = currentScreen === 'gameScreen';
        
        return isInputField || (!isInGame && event.key !== 'Enter' && event.key !== 'Escape');
    }

    // Metodi utility
    isKeyPressed(key) {
        return this.pressedKeys.has(key);
    }

    getPressedKeys() {
        return Array.from(this.pressedKeys);
    }

    clearPressedKeys() {
        this.pressedKeys.clear();
        // Reset tutti gli stati
        Object.keys(this.keyMapping).forEach(key => {
            const action = this.keyMapping[key];
            this.inputManager.setState(action, false);
        });
    }
}
