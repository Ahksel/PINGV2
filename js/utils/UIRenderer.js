// js/ui/UIRenderer.js
import { Constants } from '../utils/Constants.js';

export class UIRenderer {
    constructor(game) {
        this.game = game;
        this.modals = new Map();
        this.toasts = [];
        
        this.init();
    }

    init() {
        // Crea container per notifiche toast
        this.createToastContainer();
        
        // Crea container per modali
        this.createModalContainer();
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
        this.toastContainer = container;
    }

    createModalContainer() {
        const container = document.createElement('div');
        container.id = 'modal-container';
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        container.addEventListener('click', (e) => {
            if (e.target === container) {
                this.closeModal();
            }
        });
        document.body.appendChild(container);
        this.modalContainer = container;
    }

    // Toast notifications
    showToast(message, type = 'info', duration = Constants.MESSAGE_DURATION) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            padding: 15px 25px;
            border-radius: 10px;
            color: white;
            font-family: 'Courier New', monospace;
            animation: slideIn 0.3s ease-out;
            cursor: pointer;
            max-width: 300px;
            word-wrap: break-word;
            ${this.getToastStyles(type)}
        `;
        toast.textContent = message;
        
        // Click per chiudere
        toast.addEventListener('click', () => this.removeToast(toast));
        
        this.toastContainer.appendChild(toast);
        this.toasts.push(toast);
        
        // Auto-rimozione
        setTimeout(() => this.removeToast(toast), duration);
        
        return toast;
    }

    getToastStyles(type) {
        const styles = {
            info: `background: rgba(0, 170, 255, 0.9); border: 2px solid ${Constants.COLORS.SECONDARY};`,
            success: `background: rgba(0, 255, 136, 0.9); border: 2px solid ${Constants.COLORS.PRIMARY};`,
            error: `background: rgba(255, 68, 68, 0.9); border: 2px solid ${Constants.COLORS.DANGER};`,
            warning: `background: rgba(255, 170, 0, 0.9); border: 2px solid ${Constants.COLORS.WARNING};`
        };
        return styles[type] || styles.info;
    }

    removeToast(toast) {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
                const index = this.toasts.indexOf(toast);
                if (index > -1) {
                    this.toasts.splice(index, 1);
                }
            }
        }, 300);
    }

    // Metodi convenience per diversi tipi di notifiche
    showInfo(message) {
        return this.showToast(message, 'info');
    }

    showSuccess(message) {
        return this.showToast(message, 'success');
    }

    showError(message) {
        return this.showToast(message, 'error');
    }

    showWarning(message) {
        return this.showToast(message, 'warning');
    }

    // Modal dialogs
    showModal(content, options = {}) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = `
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            border: 2px solid ${Constants.COLORS.PRIMARY};
            border-radius: 20px;
            padding: 30px;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            color: white;
            font-family: 'Courier New', monospace;
            box-shadow: 0 0 30px rgba(0, 255, 136, 0.5);
            animation: modalIn 0.3s ease-out;
        `;
        
        // Titolo
        if (options.title) {
            const title = document.createElement('h2');
            title.style.cssText = `
                margin-bottom: 20px;
                color: ${Constants.COLORS.PRIMARY};
                text-align: center;
            `;
            title.textContent = options.title;
            modal.appendChild(title);
        }
        
        // Contenuto
        const contentDiv = document.createElement('div');
        if (typeof content === 'string') {
            contentDiv.innerHTML = content;
        } else {
            contentDiv.appendChild(content);
        }
        modal.appendChild(contentDiv);
        
        // Pulsanti
        if (options.buttons) {
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                gap: 15px;
                justify-content: center;
                margin-top: 25px;
            `;
            
            options.buttons.forEach(btn => {
                const button = document.createElement('button');
                button.className = 'menu-button';
                button.style.cssText = `
                    padding: 10px 25px;
                    min-width: 100px;
                    font-size: 16px;
                `;
                button.textContent = btn.text;
                button.addEventListener('click', () => {
                    if (btn.handler) btn.handler();
                    if (btn.closeModal !== false) this.closeModal();
                });
                buttonContainer.appendChild(button);
            });
            
            modal.appendChild(buttonContainer);
        }
        
        // Mostra modal
        this.modalContainer.innerHTML = '';
        this.modalContainer.appendChild(modal);
        this.modalContainer.style.display = 'flex';
        
        return modal;
    }

    closeModal() {
        const modal = this.modalContainer.querySelector('.modal');
        if (modal) {
            modal.style.animation = 'modalOut 0.3s ease-in';
            setTimeout(() => {
                this.modalContainer.style.display = 'none';
                this.modalContainer.innerHTML = '';
            }, 300);
        }
    }

    // Dialogs predefiniti
    showAlert(message, title = 'Attenzione') {
        return this.showModal(message, {
            title,
            buttons: [
                { text: 'OK', closeModal: true }
            ]
        });
    }

    showConfirm(message, title = 'Conferma') {
        return new Promise(resolve => {
            this.showModal(message, {
                title,
                buttons: [
                    { 
                        text: 'Sì', 
                        handler: () => resolve(true)
                    },
                    { 
                        text: 'No', 
                        handler: () => resolve(false)
                    }
                ]
            });
        });
    }

    showPrompt(message, title = 'Inserisci', defaultValue = '') {
        return new Promise(resolve => {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = defaultValue;
            input.className = 'setting-input';
            input.style.cssText = `
                width: 100%;
                margin-top: 15px;
            `;
            
            const content = document.createElement('div');
            content.innerHTML = `<p>${message}</p>`;
            content.appendChild(input);
            
            this.showModal(content, {
                title,
                buttons: [
                    { 
                        text: 'OK', 
                        handler: () => resolve(input.value)
                    },
                    { 
                        text: 'Annulla', 
                        handler: () => resolve(null)
                    }
                ]
            });
            
            // Focus sull'input
            setTimeout(() => input.focus(), 100);
        });
    }

    // Metodi UI specifici del gioco
    showWelcomeMessage(username) {
        if (this.game.managers.menu) {
            this.game.managers.menu.updateWelcomeMessage(username);
        }
    }

    showCountdown(seconds = Constants.COUNTDOWN_DURATION) {
        const countdownEl = document.getElementById('countdown');
        if (!countdownEl) return;
        
        countdownEl.style.display = 'block';
        let count = seconds;
        
        const interval = setInterval(() => {
            if (count > 0) {
                countdownEl.textContent = count;
                countdownEl.style.animation = 'countdownPulse 1s ease-in-out';
            } else {
                countdownEl.textContent = 'VIA!';
                setTimeout(() => {
                    countdownEl.style.display = 'none';
                }, 500);
                clearInterval(interval);
            }
            count--;
        }, 1000);
        
        return interval;
    }

    // Animazioni CSS
    addCSS() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            
            @keyframes modalIn {
                from { transform: scale(0.8); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            
            @keyframes modalOut {
                from { transform: scale(1); opacity: 1; }
                to { transform: scale(0.8); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Inizializza animazioni CSS al caricamento
document.addEventListener('DOMContentLoaded', () => {
    const ui = new UIRenderer({ managers: {} });
    ui.addCSS();
});
