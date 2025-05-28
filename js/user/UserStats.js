// js/user/UserStats.js
export class UserStats {
    constructor(game) {
        this.game = game;
    }

    /**
     * Mostra le statistiche dell'utente corrente
     */
    showStats() {
        const user = this.game.managers.auth?.currentUser;
        
        if (!user) {
            this.game.managers.ui.showError('Nessun utente connesso');
            return;
        }

        const stats = user.stats || { wins: 0, losses: 0, games: 0 };
        const winRate = stats.games > 0 ? 
            ((stats.wins / stats.games) * 100).toFixed(1) : 0;

        // Crea contenuto HTML per le statistiche
        const content = `
            <div style="text-align: center;">
                <div style="margin: 20px 0;">
                    <h3 style="color: #00ff88; margin-bottom: 20px;">
                        📊 Statistiche di ${user.username}
                    </h3>
                </div>
                
                <div style="display: grid; gap: 15px; max-width: 300px; margin: 0 auto;">
                    <div style="background: rgba(0, 255, 136, 0.1); padding: 15px; border-radius: 10px; border: 1px solid #00ff88;">
                        <div style="font-size: 24px; font-weight: bold; color: #00ff88;">
                            ${stats.wins}
                        </div>
                        <div style="font-size: 14px; opacity: 0.8;">
                            🏆 Vittorie
                        </div>
                    </div>
                    
                    <div style="background: rgba(255, 68, 68, 0.1); padding: 15px; border-radius: 10px; border: 1px solid #ff4444;">
                        <div style="font-size: 24px; font-weight: bold; color: #ff4444;">
                            ${stats.losses}
                        </div>
                        <div style="font-size: 14px; opacity: 0.8;">
                            💔 Sconfitte
                        </div>
                    </div>
                    
                    <div style="background: rgba(0, 170, 255, 0.1); padding: 15px; border-radius: 10px; border: 1px solid #00aaff;">
                        <div style="font-size: 24px; font-weight: bold; color: #00aaff;">
                            ${stats.games}
                        </div>
                        <div style="font-size: 14px; opacity: 0.8;">
                            🎮 Partite Totali
                        </div>
                    </div>
                    
                    <div style="background: rgba(255, 170, 0, 0.1); padding: 15px; border-radius: 10px; border: 1px solid #ffaa00;">
                        <div style="font-size: 24px; font-weight: bold; color: #ffaa00;">
                            ${winRate}%
                        </div>
                        <div style="font-size: 14px; opacity: 0.8;">
                            📈 Percentuale Vittorie
                        </div>
                    </div>
                </div>
                
                ${this.getAchievements(stats)}
                
                ${user.isDemo ? '<p style="margin-top: 20px; opacity: 0.7; font-size: 12px;">⚠️ Account demo - Le statistiche non vengono salvate online</p>' : ''}
            </div>
        `;

        // Mostra modal con statistiche
        this.game.managers.ui.showModal(content, {
            title: 'Le Tue Statistiche',
            buttons: [
                { text: 'Chiudi', closeModal: true }
            ]
        });
    }

    /**
     * Calcola e mostra achievements
     * @private
     */
    getAchievements(stats) {
        const achievements = [];
        
        // Prima vittoria
        if (stats.wins >= 1) {
            achievements.push({ 
                icon: '🌟', 
                name: 'Prima Vittoria', 
                desc: 'Hai vinto la tua prima partita!' 
            });
        }
        
        // 10 vittorie
        if (stats.wins >= 10) {
            achievements.push({ 
                icon: '⭐', 
                name: 'Campione', 
                desc: 'Hai vinto 10 partite!' 
            });
        }
        
        // 50 vittorie
        if (stats.wins >= 50) {
            achievements.push({ 
                icon: '🏆', 
                name: 'Leggenda', 
                desc: 'Hai vinto 50 partite!' 
            });
        }
        
        // Percentuale vittorie alta
        const winRate = stats.games > 0 ? (stats.wins / stats.games) : 0;
        if (winRate >= 0.7 && stats.games >= 10) {
            achievements.push({ 
                icon: '💪', 
                name: 'Imbattibile', 
                desc: 'Hai un win rate superiore al 70%!' 
            });
        }
        
        // Veterano
        if (stats.games >= 100) {
            achievements.push({ 
                icon: '🎖️', 
                name: 'Veterano', 
                desc: 'Hai giocato 100 partite!' 
            });
        }

        if (achievements.length === 0) {
            return '<p style="margin-top: 20px; opacity: 0.7;">Gioca altre partite per sbloccare achievements!</p>';
        }

        let html = '<div style="margin-top: 30px;"><h4 style="color: #ffaa00; margin-bottom: 15px;">🏅 Achievements</h4>';
        html += '<div style="display: grid; gap: 10px;">';
        
        achievements.forEach(ach => {
            html += `
                <div style="background: rgba(255, 170, 0, 0.1); padding: 10px; border-radius: 8px; border: 1px solid #ffaa00; text-align: left;">
                    <span style="font-size: 20px; margin-right: 10px;">${ach.icon}</span>
                    <strong>${ach.name}</strong> - ${ach.desc}
                </div>
            `;
        });
        
        html += '</div></div>';
        return html;
    }

    /**
     * Confronta statistiche con un altro giocatore
     */
    compareStats(otherUsername, otherStats) {
        const myStats = this.game.managers.auth?.currentUser?.stats;
        if (!myStats) return;

        const myWinRate = myStats.games > 0 ? 
            ((myStats.wins / myStats.games) * 100).toFixed(1) : 0;
        const otherWinRate = otherStats.games > 0 ? 
            ((otherStats.wins / otherStats.games) * 100).toFixed(1) : 0;

        const content = `
            <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 20px; align-items: center;">
                <div style="text-align: center;">
                    <h4 style="color: #00ff88;">${this.game.managers.auth.currentUser.username}</h4>
                    <div style="margin-top: 15px;">
                        <div>🏆 ${myStats.wins}</div>
                        <div>💔 ${myStats.losses}</div>
                        <div>📈 ${myWinRate}%</div>
                    </div>
                </div>
                
                <div style="font-size: 24px;">VS</div>
                
                <div style="text-align: center;">
                    <h4 style="color: #00aaff;">${otherUsername}</h4>
                    <div style="margin-top: 15px;">
                        <div>🏆 ${otherStats.wins}</div>
                        <div>💔 ${otherStats.losses}</div>
                        <div>📈 ${otherWinRate}%</div>
                    </div>
                </div>
            </div>
        `;

        this.game.managers.ui.showModal(content, {
            title: 'Confronto Statistiche',
            buttons: [{ text: 'OK', closeModal: true }]
        });
    }

    /**
     * Esporta statistiche in formato JSON
     */
    exportStats() {
        const user = this.game.managers.auth?.currentUser;
        if (!user) return null;

        const data = {
            username: user.username,
            stats: user.stats,
            exportDate: new Date().toISOString(),
            gameVersion: '2.0.0'
        };

        return JSON.stringify(data, null, 2);
    }

    /**
     * Calcola statistiche dettagliate
     */
    getDetailedStats() {
        const stats = this.game.managers.auth?.currentUser?.stats;
        if (!stats) return null;

        return {
            totalGames: stats.games,
            wins: stats.wins,
            losses: stats.losses,
            winRate: stats.games > 0 ? (stats.wins / stats.games) : 0,
            winStreak: this.calculateWinStreak(),
            avgGameTime: this.getAverageGameTime(),
            favoriteOpponent: this.getFavoriteOpponent()
        };
    }

    /**
     * Calcola serie di vittorie (placeholder per future implementazioni)
     * @private
     */
    calculateWinStreak() {
        // TODO: Implementare tracking delle serie di vittorie
        return 0;
    }

    /**
     * Tempo medio partita (placeholder)
     * @private
     */
    getAverageGameTime() {
        // TODO: Implementare tracking tempo partite
        return '5:00';
    }

    /**
     * Avversario preferito (placeholder)
     * @private
     */
    getFavoriteOpponent() {
        // TODO: Implementare tracking avversari
        return 'N/A';
    }
}
