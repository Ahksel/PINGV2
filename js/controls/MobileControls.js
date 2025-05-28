// js/controls/MobileControls.js
export class MobileControls {
    constructor(inputManager) {
        this.inputManager = inputManager;
        this.isEnabled = false;
        this.touches = new Map();
        this.buttons = new Map();
        
        // Sensibilità touch
        this.sensitivity = 1.0;
        
        this.init();
    }

    init() {
        // Trova tutti i controlli mobile nel DOM
        this.findButtons();
        
        // Abilita solo su dispositivi touch
        if (this.isTouchDevice()) {
            this.enable();
        }
    }

    findButtons() {
        // Player 1
        const p1Up = document.getElementById('p1Up');
        const p1Down = document.getElementById('p1Down');
        
        // Player 2
        const p2Up = document.getElementById('p2Up');
        const p2Down = document.getElementById('p2Down');
        
        // Registra i pulsanti
        if (p1Up) this.buttons.set(p1Up, 'player1Up');
        if (p1Down) this.buttons.set(p1Down, 'player1Down');
        if (p2Up) this.buttons.set(p2Up, 'player2Up');
        if (p2Down) this.buttons.set(p2Down, 'player2Down');
    }

    enable() {
        if (this.isEnabled) return;
        
        // Eventi touch per ogni pulsante
        this.buttons.forEach((action, button) => {
            button.addEventListener('touchstart', (e) => this.handleTouchStart(e, action));
            button.addEventListener('touchend', (e) => this.handleTouchEnd(e, action));
            button.addEventListener('touchcancel', (e) => this.handleTouchEnd(e, action));
            
            // Supporto mouse per test su desktop
            button.addEventListener('mousedown', (e) => this.handleMouseDown(e, action));
            button.addEventListener('mouseup', (e) => this.handleMouseUp(e, action));
            button.addEventListener('mouseleave', (e) => this.handleMouseUp(e, action));
        });
        
        // Touch sul canvas per controllo diretto
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            canvas.addEventListener('touchstart', this.handleCanvasTouch.bind(this));
            canvas.addEventListener('touchmove', this.handleCanvasTouch.bind(this));
            canvas.addEventListener('touchend', this.handleCanvasTouchEnd.bind(this));
        }
        
        this.isEnabled = true;
        console.log('📱 Mobile controls abilitati');
    }

    disable() {
        if (!this.isEnabled) return;
        
        // Rimuovi tutti i listener
        this.buttons.forEach((action, button) => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
        });
        
        this.isEnabled = false;
        this.touches.clear();
        console.log('📱 Mobile controls disabilitati');
    }

    handleTouchStart(event, action) {
        event.preventDefault();
        
        // Vibrazione feedback
        this.inputManager.vibrate([20]);
        
        // Attiva l'azione
        this.inputManager.setState(action, true);
        
        // Effetto visivo
        event.target.classList.add('active');
    }

    handleTouchEnd(event, action) {
        event.preventDefault();
        
        // Disattiva l'azione
        this.inputManager.setState(action, false);
        
        // Rimuovi effetto visivo
        event.target.classList.remove('active');
    }

    handleMouseDown(event, action) {
        event.preventDefault();
        this.inputManager.setState(action, true);
        event.target.classList.add('active');
    }

    handleMouseUp(event, action) {
        event.preventDefault();
        this.inputManager.setState(action, false);
        event.target.classList.remove('active');
    }

    handleCanvasTouch(event) {
        event.preventDefault();
        
        const currentScreen = this.inputManager.game.managers.menu?.currentScreen;
        if (currentScreen !== 'gameScreen') return;
        
        const canvas = event.target;
        const rect = canvas.getBoundingClientRect();
        
        // Gestisci ogni tocco
        for (let touch of event.touches) {
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            
            // Determina quale lato dello schermo
            const side = x < rect.width / 2 ? 'left' : 'right';
            
            // In single player, controlla solo il lato sinistro
            if (this.inputManager.game.gameMode === 'single' && side === 'left') {
                this.inputManager.handleMouseMove(y);
            }
            // In multiplayer, invia la posizione
            else if (this.inputManager.game.gameMode === 'multi') {
                this.inputManager.handleMouseMove(y);
            }
            
            // Salva il tocco
            this.touches.set(touch.identifier, { x, y, side });
        }
    }

    handleCanvasTouchEnd(event) {
        event.preventDefault();
        
        // Rimuovi i tocchi terminati
        for (let touch of event.changedTouches) {
            this.touches.delete(touch.identifier);
        }
    }

    // Utility
    isTouchDevice() {
        return 'ontouchstart' in window || 
               navigator.maxTouchPoints > 0 ||
               navigator.msMaxTouchPoints > 0;
    }

    setSensitivity(value) {
        this.sensitivity = Math.max(0.1, Math.min(2.0, value));
    }

    showControls() {
        const container = document.querySelector('.mobile-controls');
        if (container) {
            container.style.display = 'flex';
        }
    }

    hideControls() {
        const container = document.querySelector('.mobile-controls');
        if (container) {
            container.style.display = 'none';
        }
    }

    // Crea controlli virtuali dinamicamente (per future implementazioni)
    createVirtualJoystick(options = {}) {
        const joystick = document.createElement('div');
        joystick.className = 'virtual-joystick';
        joystick.style.cssText = `
            position: fixed;
            bottom: ${options.bottom || '50px'};
            ${options.side}: ${options.offset || '50px'};
            width: 100px;
            height: 100px;
            background: rgba(0, 255, 136, 0.2);
            border: 2px solid #00ff88;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const stick = document.createElement('div');
        stick.style.cssText = `
            width: 40px;
            height: 40px;
            background: #00ff88;
            border-radius: 50%;
            position: relative;
        `;
        
        joystick.appendChild(stick);
        document.body.appendChild(joystick);
        
        return { joystick, stick };
    }
}
