// js/controls/MouseHandler.js
export class MouseHandler {
    constructor(inputManager) {
        this.inputManager = inputManager;
        this.isEnabled = false;
        this.canvas = null;
        this.isMouseDown = false;
        
        // Bind dei metodi
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleContextMenu = this.handleContextMenu.bind(this);
        
        this.init();
    }

    init() {
        // Trova il canvas
        this.canvas = document.getElementById('gameCanvas');
        if (this.canvas) {
            this.enable();
        }
    }

    enable() {
        if (this.isEnabled || !this.canvas) return;
        
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('contextmenu', this.handleContextMenu);
        
        // Cursore personalizzato sul canvas
        this.canvas.style.cursor = 'none';
        
        this.isEnabled = true;
        console.log('🖱️ Mouse handler abilitato');
    }

    disable() {
        if (!this.isEnabled || !this.canvas) return;
        
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
        
        this.canvas.style.cursor = 'default';
        
        this.isEnabled = false;
        this.isMouseDown = false;
        console.log('🖱️ Mouse handler disabilitato');
    }

    handleMouseMove(event) {
        // Verifica che siamo in gioco
        const currentScreen = this.inputManager.game.managers.menu?.currentScreen;
        if (currentScreen !== 'gameScreen') return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseY = event.clientY - rect.top;
        
        // Invia la posizione Y al gestore input
        this.inputManager.handleMouseMove(mouseY);
        
        // Emetti evento per altri sistemi che potrebbero averne bisogno
        this.inputManager.game.emit('input:mouse', {
            x: event.clientX - rect.left,
            y: mouseY,
            canvasX: (event.clientX - rect.left) / rect.width,
            canvasY: mouseY / rect.height
        });
    }

    handleMouseDown(event) {
        this.isMouseDown = true;
        
        // Click sinistro = lancia palla
        if (event.button === 0) {
            this.inputManager.setState('launchBall', true);
        }
        
        event.preventDefault();
    }

    handleMouseUp(event) {
        this.isMouseDown = false;
        
        if (event.button === 0) {
            this.inputManager.setState('launchBall', false);
        }
        
        event.preventDefault();
    }

    handleContextMenu(event) {
        // Previeni menu contestuale sul canvas
        event.preventDefault();
    }

    // Metodi utility
    isButtonPressed() {
        return this.isMouseDown;
    }

    getCanvasCoordinates(event) {
        if (!this.canvas) return null;
        
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            normalizedX: (event.clientX - rect.left) / rect.width,
            normalizedY: (event.clientY - rect.top) / rect.height
        };
    }
}
