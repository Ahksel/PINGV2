
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

class PongServerDB {
    constructor() {
        this.server = http.createServer(this.handleRequest.bind(this));
        this.wss = new WebSocket.Server({ server: this.server });
        
        // MongoDB connection
        console.log('🔍 DEBUG - process.env.MONGODB_URL:', process.env.MONGODB_URL ? 'TROVATO' : 'NON TROVATO');
        console.log('🔍 DEBUG - Valore:', process.env.MONGODB_URL);
        
        // TEMPORANEO: Forza la connection string se non trovata
        this.mongoUrl = process.env.MONGODB_URL || 'mongodb+srv://ponguser:c86sMF3YorkCvjvi@cluster0.yafsbkq.mongodb.net/pongultimate?retryWrites=true&w=majority';
        console.log('🔧 USANDO URL:', this.mongoUrl.includes('mongodb+srv') ? 'ATLAS' : 'LOCALHOST');
        
        this.dbName = 'pongultimate';
        this.client = null;
        this.db = null;
        
        // In-memory session management
        this.activeSessions = new Map(); // ws -> {username, playerId, ready}
        this.players = new Map(); // ws -> {id, ready, username}
        this.gameState = this.initGameState();
        this.gameRunning = false;
        this.gameLoopId = null;
        this.lobbyState = {
            player1: null,
            player2: null,
            player1Ready: false,
            player2Ready: false,
            player1Name: '',
            player2Name: '',
            playersCount: 0
        };
        
        this.initDatabase().then(() => {
            this.setupWebSocket();
            console.log('🏓 Server Pong Ultimate con MongoDB avviato!');
            console.log('💾 Database connesso e pronto');
            console.log('📡 WebSocket server pronto sulla porta 3000');
        }).catch(error => {
            console.error('❌ Errore connessione database:', error);
            console.log('⚠️  Server avviato senza database (modalità memoria)');
            this.createDemoUsersInMemory();
            this.setupWebSocket();
        });
    }

    async initDatabase() {
        try {
            console.log('🔌 Tentativo connessione MongoDB...');
            console.log('📍 URL MongoDB:', this.mongoUrl.replace(/:[^:@]*@/, ':***@'));
            
            this.client = new MongoClient(this.mongoUrl, {
                connectTimeoutMS: 10000,
                serverSelectionTimeoutMS: 10000,
            });
            
            console.log('⏳ Connessione in corso...');
            await this.client.connect();
            console.log('🔗 Client connesso, testando database...');
            
            this.db = this.client.db(this.dbName);
            
            console.log('🏓 Ping al database...');
            await this.db.admin().ping();
            console.log('✅ Ping riuscito!');
            
            console.log('📁 Creazione collezioni...');
            await this.db.createCollection('users');
            await this.db.collection('users').createIndex({ username: 1 }, { unique: true });
            console.log('📁 Collezioni create!');
            
            await this.createDemoUsers();
            
            console.log('✅ Database MongoDB connesso e pronto!');
        } catch (error) {
            console.error('❌ Errore dettagliato database:');
            console.error('   - Tipo errore:', error.name);
            console.error('   - Messaggio:', error.message);
            console.error('   - Codice:', error.code);
            console.log('⚠️  Continuo senza database - userò utenti demo in memoria');
            this.db = null;
            this.createDemoUsersInMemory();
        }
    }

    async createDemoUsers() {
        if (!this.db) return;
        
        const demoUsers = [
            { username: 'guest1', password: 'password', stats: { wins: 5, losses: 3, games: 8 } },
            { username: 'guest2', password: 'password', stats: { wins: 2, losses: 6, games: 8 } },
            { username: 'admin', password: 'admin123', stats: { wins: 10, losses: 2, games: 12 } }
        ];

        for (let user of demoUsers) {
            try {
                await this.db.collection('users').insertOne(user);
                console.log(`👤 Utente demo creato: ${user.username}`);
            } catch (error) {
                // Utente già esistente, ignora errore
            }
        }
    }

    createDemoUsersInMemory() {
        this.users = new Map();
        this.users.set('guest1', {
            password: 'password',
            stats: { wins: 5, losses: 3, games: 8 }
        });
        this.users.set('guest2', {
            password: 'password',
            stats: { wins: 2, losses: 6, games: 8 }
        });
        this.users.set('admin', {
            password: 'admin123',
            stats: { wins: 10, losses: 2, games: 12 }
        });
        console.log('📝 Utenti demo caricati in memoria');
    }

    initGameState() {
        return {
            ball: { 
                x: 400, 
                y: 200, 
                dx: Math.random() > 0.5 ? 5 : -5, 
                dy: (Math.random() - 0.5) * 6,
                radius: 8 
            },
            paddle1: { x: 20, y: 150, width: 15, height: 100, dy: 0 },
            paddle2: { x: 765, y: 150, width: 15, height: 100, dy: 0 },
            score1: 0,
            score2: 0,
            gameRunning: false
        };
    }

    handleRequest(req, res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        if (req.url === '/') {
            const htmlPath = path.join(__dirname, 'index.html');
            
            if (fs.existsSync(htmlPath)) {
                fs.readFile(htmlPath, (err, data) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Errore nel caricamento del gioco');
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(data);
                });
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                    <h1>🏓 Server Pong Ultimate con Database Attivo!</h1>
                    <p><strong>Database MongoDB:</strong> ${this.db ? '✅ Connesso' : '❌ Non connesso'}</p>
                    <p><strong>WebSocket server attivo!</strong></p>
                    <p><strong>URL WebSocket:</strong> <code>wss://${req.headers.host}</code></p>
                `);
            }
        } else {
            res.writeHead(404);
            res.end('Pagina non trovata');
        }
    }

    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            console.log('🎮 Nuova connessione WebSocket');
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    console.log(`📨 Messaggio ricevuto: ${message.type} da ${this.activeSessions.get(ws)?.username || 'anonimo'}`);
                    this.handlePlayerMessage(ws, message);
                } catch (error) {
                    console.error('Errore nel parsing del messaggio:', error);
                }
            });
            
            ws.on('close', () => {
                this.handleDisconnection(ws);
            });
        });
    }

    async handlePlayerMessage(ws, message) {
        const session = this.activeSessions.get(ws);

        switch (message.type) {
            case 'login':
                await this.handleLogin(ws, message);
                break;
            case 'register':
                await this.handleRegister(ws, message);
                break;
            case 'joinLobby':
                if (session) {
                    console.log(`🎯 ${session.username} richiede joinLobby (già autenticato)`);
                    this.joinLobby(ws);
                } else {
                    console.log('❌ Tentativo joinLobby senza autenticazione');
                    ws.send(JSON.stringify({ 
                        type: 'error', 
                        message: 'Devi fare login prima di entrare in lobby' 
                    }));
                }
                break;
            case 'playerReady':
                const playerData = this.players.get(ws);
                if (playerData) {
                    this.handlePlayerReady(ws, message.ready);
                }
                break;
            case 'input':
                if (this.gameRunning && this.players.has(ws)) {
                    this.handlePlayerInput(ws, message);
                }
                break;
            case 'inputStop':
                if (this.gameRunning && this.players.has(ws)) {
                    this.handleInputStop(ws);
                }
                break;
            case 'mouseInput':
                if (this.gameRunning && this.players.has(ws)) {
                    this.handleMouseInput(ws, message);
                }
                break;
            case 'getStats':
                await this.handleGetStats(ws);
                break;
            default:
                console.log(`⚠️ Messaggio non gestito: ${message.type}`);
                break;
        }
    }

    async handleLogin(ws, message) {
        const { username, password } = message;
        
        console.log(`🔑 Tentativo login: ${username}`);
        
        try {
            let user;
            if (this.db) {
                console.log('💾 Controllo nel database MongoDB...');
                user = await this.db.collection('users').findOne({ username });
            } else {
                console.log('📝 Controllo negli utenti demo in memoria...');
                user = this.users ? this.users.get(username) : null;
            }

            if (!user) {
                console.log(`❌ Utente ${username} non trovato`);
                ws.send(JSON.stringify({ 
                    type: 'loginResult', 
                    success: false, 
                    message: 'Utente non trovato' 
                }));
                return;
            }

            if (user.password !== password) {
                console.log(`❌ Password errata per ${username}`);
                ws.send(JSON.stringify({ 
                    type: 'loginResult', 
                    success: false, 
                    message: 'Password errata' 
                }));
                return;
            }

            // Controlla se l'utente è già connesso
            for (let [otherWs, otherSession] of this.activeSessions) {
                if (otherSession.username === username && otherWs !== ws) {
                    console.log(`❌ ${username} già connesso da altra sessione`);
                    ws.send(JSON.stringify({ 
                        type: 'loginResult', 
                        success: false, 
                        message: 'Utente già connesso' 
                    }));
                    return;
                }
            }

            // Login riuscito
            this.activeSessions.set(ws, { username, playerId: null, ready: false });
            
            ws.send(JSON.stringify({ 
                type: 'loginResult', 
                success: true, 
                username: username,
                stats: user.stats
            }));

            console.log(`✅ ${username} ha effettuato il login con successo`);
        } catch (error) {
            console.error('💥 Errore login:', error.message);
            ws.send(JSON.stringify({ 
                type: 'loginResult', 
                success: false, 
                message: 'Errore del server' 
            }));
        }
    }

    async handleRegister(ws, message) {
        const { username, password } = message;
        
        console.log(`📝 Tentativo registrazione: ${username}`);
        console.log(`💾 Database disponibile: ${this.db ? 'SÌ' : 'NO'}`);
        
        if (!username || !password || username.length < 3 || password.length < 3) {
            console.log('❌ Dati registrazione non validi');
            ws.send(JSON.stringify({ 
                type: 'registerResult', 
                success: false, 
                message: 'Username e password devono avere almeno 3 caratteri' 
            }));
            return;
        }

        try {
            if (this.db) {
                console.log('💾 TENTATIVO: Usando database MongoDB REALE');
                const existingUser = await this.db.collection('users').findOne({ username });
                if (existingUser) {
                    console.log(`❌ Username ${username} già esistente nel DB`);
                    ws.send(JSON.stringify({ 
                        type: 'registerResult', 
                        success: false, 
                        message: 'Username già esistente' 
                    }));
                    return;
                }

                const newUser = {
                    username: username,
                    password: password,
                    stats: { wins: 0, losses: 0, games: 0 },
                    createdAt: new Date()
                };
                
                const result = await this.db.collection('users').insertOne(newUser);
                console.log(`✅ SUCCESSO: Utente ${username} salvato nel database MongoDB con ID: ${result.insertedId}`);

                ws.send(JSON.stringify({ 
                    type: 'registerResult', 
                    success: true, 
                    message: 'Account registrato nel database MongoDB!' 
                }));
            } else {
                console.log('📝 FALLBACK: Usando memoria (database non disponibile)');
                if (this.users && this.users.has(username)) {
                    ws.send(JSON.stringify({ 
                        type: 'registerResult', 
                        success: false, 
                        message: 'Username già esistente (memoria)' 
                    }));
                    return;
                }

                if (!this.users) this.users = new Map();
                this.users.set(username, {
                    password: password,
                    stats: { wins: 0, losses: 0, games: 0 }
                });

                console.log(`✅ Utente ${username} registrato in MEMORIA TEMPORANEA`);
                ws.send(JSON.stringify({ 
                    type: 'registerResult', 
                    success: true, 
                    message: 'Account registrato (memoria temporanea - si perde al riavvio)' 
                }));
            }

            console.log(`🎉 Registrazione ${username} completata`);
        } catch (error) {
            console.error('💥 ERRORE registrazione:', error.message);
            ws.send(JSON.stringify({ 
                type: 'registerResult', 
                success: false, 
                message: 'Errore del server durante la registrazione' 
            }));
        }
    }

    async handleGetStats(ws) {
        const session = this.activeSessions.get(ws);
        if (session) {
            try {
                let user;
                if (this.db) {
                    user = await this.db.collection('users').findOne({ username: session.username });
                } else {
                    user = this.users ? this.users.get(session.username) : null;
                }

                if (user) {
                    ws.send(JSON.stringify({ 
                        type: 'userStats', 
                        username: session.username,
                        stats: user.stats 
                    }));
                }
            } catch (error) {
                console.error('Errore recupero statistiche:', error);
            }
        }
    }

    joinLobby(ws) {
        const session = this.activeSessions.get(ws);
        if (!session) {
            console.log('❌ Tentativo joinLobby senza session');
            return;
        }

        console.log(`🎯 ${session.username} vuole entrare in lobby`);
        console.log(`🎯 Stato lobby: P1=${this.lobbyState.player1Name || 'vuoto'}, P2=${this.lobbyState.player2Name || 'vuoto'}`);

        let playerId = null;
        if (!this.lobbyState.player1) {
            playerId = 1;
            this.lobbyState.player1 = ws;
            this.lobbyState.player1Name = session.username;
            console.log(`👤 ${session.username} assegnato come GIOCATORE 1`);
        } else if (!this.lobbyState.player2) {
            playerId = 2;
            this.lobbyState.player2 = ws;
            this.lobbyState.player2Name = session.username;
            console.log(`👤 ${session.username} assegnato come GIOCATORE 2`);
        } else {
            console.log(`❌ Lobby piena! P1=${this.lobbyState.player1Name}, P2=${this.lobbyState.player2Name}`);
            ws.send(JSON.stringify({ type: 'error', message: 'Lobby piena!' }));
            return;
        }
        
        this.players.set(ws, { id: playerId, ready: false, username: session.username });
        session.playerId = playerId;
        this.lobbyState.playersCount++;
        
        ws.send(JSON.stringify({ type: 'playerId', id: playerId }));
        
        console.log(`✅ ${session.username} in lobby come giocatore ${playerId} (${this.lobbyState.playersCount}/2)`);
        
        this.broadcastLobbyState();
    }

    handlePlayerReady(ws, ready) {
        const playerData = this.players.get(ws);
        if (!playerData) {
            console.log('❌ handlePlayerReady: playerData non trovato');
            return;
        }

        playerData.ready = ready;
        
        if (playerData.id === 1) {
            this.lobbyState.player1Ready = ready;
        } else {
            this.lobbyState.player2Ready = ready;
        }
        
        console.log(`🎯 Giocatore ${playerData.id} (${playerData.username}) ${ready ? 'PRONTO' : 'non pronto'}`);
        console.log(`🎯 Stato: P1=${this.lobbyState.player1Ready ? 'PRONTO' : 'non pronto'}, P2=${this.lobbyState.player2Ready ? 'PRONTO' : 'non pronto'}`);
        
        this.broadcastLobbyState();
        
        if (this.lobbyState.player1Ready && this.lobbyState.player2Ready && 
            this.lobbyState.playersCount === 2) {
            console.log('🚀 ENTRAMBI PRONTI! Iniziando il gioco in 1 secondo...');
            setTimeout(() => this.startGame(), 1000);
        } else {
            console.log(`⏳ Aspettando: P1=${this.lobbyState.player1Ready ? '✅' : '❌'}, P2=${this.lobbyState.player2Ready ? '✅' : '❌'}, Count=${this.lobbyState.playersCount}/2`);
        }
    }

    handlePlayerInput(ws, message) {
        const playerData = this.players.get(ws);
        if (!playerData || !this.gameRunning) return;
        
        const speed = 8;
        
        if (playerData.id === 1) {
            if (message.input === 'up') {
                this.gameState.paddle1.dy = -speed;
            } else if (message.input === 'down') {
                this.gameState.paddle1.dy = speed;
            }
        } else if (playerData.id === 2) {
            if (message.input === 'up') {
                this.gameState.paddle2.dy = -speed;
            } else if (message.input === 'down') {
                this.gameState.paddle2.dy = speed;
            }
        }
    }

    handleInputStop(ws) {
        const playerData = this.players.get(ws);
        if (!playerData) return;
        
        if (playerData.id === 1) {
            this.gameState.paddle1.dy = 0;
        } else if (playerData.id === 2) {
            this.gameState.paddle2.dy = 0;
        }
    }

    handleMouseInput(ws, message) {
        const playerData = this.players.get(ws);
        if (!playerData || !this.gameRunning) return;
        
        const paddleY = Math.max(0, Math.min(300, message.paddleY));
        
        if (playerData.id === 1) {
            this.gameState.paddle1.y = paddleY;
            this.gameState.paddle1.dy = 0;
        } else if (playerData.id === 2) {
            this.gameState.paddle2.y = paddleY;
            this.gameState.paddle2.dy = 0;
        }
    }

    startGame() {
        console.log('🚀 Gioco iniziato!');
        this.gameRunning = true;
        this.gameState.gameRunning = true;
        
        this.broadcast({ type: 'gameStart' });
        this.gameLoopId = setInterval(() => this.updateGame(), 1000 / 60);
    }

    stopGame() {
        this.gameRunning = false;
        this.gameState.gameRunning = false;
        if (this.gameLoopId) {
            clearInterval(this.gameLoopId);
            this.gameLoopId = null;
        }
    }

    updateGame() {
        if (!this.gameRunning) return;
        
        this.gameState.paddle1.y += this.gameState.paddle1.dy;
        this.gameState.paddle2.y += this.gameState.paddle2.dy;
        
        this.gameState.paddle1.y = Math.max(0, Math.min(300, this.gameState.paddle1.y));
        this.gameState.paddle2.y = Math.max(0, Math.min(300, this.gameState.paddle2.y));
        
        this.gameState.ball.x += this.gameState.ball.dx;
        this.gameState.ball.y += this.gameState.ball.dy;
        
        if (this.gameState.ball.y <= this.gameState.ball.radius || 
            this.gameState.ball.y >= 400 - this.gameState.ball.radius) {
            this.gameState.ball.dy = -this.gameState.ball.dy;
        }
        
        // Collisione con paddle sinistro
        if (this.gameState.ball.x <= 35 && 
            this.gameState.ball.y >= this.gameState.paddle1.y && 
            this.gameState.ball.y <= this.gameState.paddle1.y + 100) {
            this.gameState.ball.dx = Math.abs(this.gameState.ball.dx);
            const hitPos = (this.gameState.ball.y - this.gameState.paddle1.y - 50) / 50;
            this.gameState.ball.dy += hitPos * 3;
        }
        
        // Collisione con paddle destro
        if (this.gameState.ball.x >= 765 && 
            this.gameState.ball.y >= this.gameState.paddle2.y && 
            this.gameState.ball.y <= this.gameState.paddle2.y + 100) {
            this.gameState.ball.dx = -Math.abs(this.gameState.ball.dx);
            const hitPos = (this.gameState.ball.y - this.gameState.paddle2.y - 50) / 50;
            this.gameState.ball.dy += hitPos * 3;
        }
        
        // Goal detection
        if (this.gameState.ball.x < 0) {
            this.gameState.score2++;
            this.broadcast({ type: 'goal', scorer: 2 });
            this.resetBall();
        } else if (this.gameState.ball.x > 800) {
            this.gameState.score1++;
            this.broadcast({ type: 'goal', scorer: 1 });
            this.resetBall();
        }
        
        this.broadcast({ 
            type: 'gameState', 
            state: this.gameState 
        });
    }

    resetBall() {
        this.gameState.ball.x = 400;
        this.gameState.ball.y = 200;
        this.gameState.ball.dx = Math.random() > 0.5 ? 5 : -5;
        this.gameState.ball.dy = (Math.random() - 0.5) * 6;
        
        console.log(`⚽ Goal! Punteggio: ${this.gameState.score1} - ${this.gameState.score2}`);
        
        if (this.gameState.score1 >= 5 || this.gameState.score2 >= 5) {
            this.endGame();
        }
    }

    async endGame() {
        const winner = this.gameState.score1 > this.gameState.score2 ? 1 : 2;
        const finalScore = {
            player1: this.gameState.score1,
            player2: this.gameState.score2
        };

        await this.updateUserStats(winner);

        this.broadcast({
            type: 'gameEnd',
            winner: winner,
            finalScore: finalScore
        });

        console.log(`🏆 Partita terminata! Vince il giocatore ${winner} (${finalScore.player1}-${finalScore.player2})`);

        setTimeout(() => {
            this.stopGame();
            this.resetGameState();
            this.resetLobbyReadyState();
            this.broadcastLobbyState();
        }, 3000);
    }

    async updateUserStats(winner) {
        for (let [ws, playerData] of this.players) {
            const session = this.activeSessions.get(ws);
            if (session && session.username) {
                try {
                    if (this.db) {
                        const isWinner = playerData.id === winner;
                        await this.db.collection('users').updateOne(
                            { username: session.username },
                            {
                                $inc: {
                                    'stats.games': 1,
                                    'stats.wins': isWinner ? 1 : 0,
                                    'stats.losses': isWinner ? 0 : 1
                                }
                            }
                        );
                        console.log(`📊 Stats aggiornate nel DB per ${session.username}`);
                    } else if (this.users) {
                        const user = this.users.get(session.username);
                        if (user) {
                            user.stats.games++;
                            if (playerData.id === winner) {
                                user.stats.wins++;
                            } else {
                                user.stats.losses++;
                            }
                            console.log(`📊 Stats aggiornate in memoria per ${session.username}`);
                        }
                    }
                } catch (error) {
                    console.error('Errore aggiornamento statistiche:', error);
                }
            }
        }
    }

    resetGameState() {
        this.gameState = this.initGameState();
    }

    resetLobbyReadyState() {
        this.lobbyState.player1Ready = false;
        this.lobbyState.player2Ready = false;
        
        this.players.forEach((playerData) => {
            playerData.ready = false;
        });
    }

    broadcastLobbyState() {
        const lobbyUpdate = {
            type: 'lobbyUpdate',
            player1: !!this.lobbyState.player1,
            player2: !!this.lobbyState.player2,
            player1Ready: this.lobbyState.player1Ready,
            player2Ready: this.lobbyState.player2Ready,
            player1Name: this.lobbyState.player1Name,
            player2Name: this.lobbyState.player2Name,
            playersCount: this.lobbyState.playersCount
        };
        
        this.broadcast(lobbyUpdate);
    }

    handleDisconnection(ws) {
        const session = this.activeSessions.get(ws);
        const playerData = this.players.get(ws);
        
        if (session) {
            console.log(`👋 ${session.username} disconnesso`);
            this.activeSessions.delete(ws);
        }
        
        if (playerData) {
            if (playerData.id === 1) {
                this.lobbyState.player1 = null;
                this.lobbyState.player1Ready = false;
                this.lobbyState.player1Name = '';
            } else if (playerData.id === 2) {
                this.lobbyState.player2 = null;
                this.lobbyState.player2Ready = false;
                this.lobbyState.player2Name = '';
            }
            
            this.lobbyState.playersCount--;
            this.players.delete(ws);
            
            if (this.gameRunning) {
                this.stopGame();
            }
            
            this.broadcastLobbyState();
            this.broadcast({ type: 'playerLeft' });
        }
    }

    broadcast(message) {
        this.players.forEach((playerData, ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
            }
        });
    }

    async close() {
        if (this.client) {
            await this.client.close();
            console.log('📦 Connessione database chiusa');
        }
    }

    start(port = process.env.PORT || 3000) {
        this.server.listen(port, '0.0.0.0', () => {
            console.log(`🌟 Server in ascolto sulla porta ${port}`);
            console.log(`🌐 Il gioco è accessibile su tutte le reti!`);
            if (process.env.RENDER_EXTERNAL_URL) {
                console.log(`🚀 URL pubblico: ${process.env.RENDER_EXTERNAL_URL}`);
            }
        });
    }
}

// Gestione chiusura graceful
process.on('SIGINT', async () => {
    console.log('\n🛑 Arresto server in corso...');
    if (global.pongServer) {
        await global.pongServer.close();
    }
    process.exit(0);
});

// Avvia il server
global.pongServer = new PongServerDB();
global.pongServer.start();
