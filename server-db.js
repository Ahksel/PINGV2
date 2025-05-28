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
        console.log('🔍 Controllo variabili ambiente...');
        console.log('   PORT:', process.env.PORT || 'Non impostata (userò 3000)');
        console.log('   MONGODB_URL:', process.env.MONGODB_URL ? '✅ Trovata' : '❌ Non trovata');
        console.log('   RENDER:', process.env.RENDER ? '✅ Su Render' : '📍 Locale');
        
        this.mongoUrl = process.env.MONGODB_URL;
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
            console.log('📡 WebSocket server pronto');
        }).catch(error => {
            console.error('❌ Errore connessione database:', error);
            console.log('⚠️  Server avviato senza database (modalità memoria)');
            this.createDemoUsersInMemory();
            this.setupWebSocket();
        });
    }

    async initDatabase() {
        if (!this.mongoUrl) {
            console.warn('⚠️ MONGODB_URL non configurato, uso memoria locale');
            this.createDemoUsersInMemory();
            return;
        }

        try {
            console.log('🔌 Tentativo connessione MongoDB...');
            console.log('📍 URL MongoDB:', this.mongoUrl.replace(/:[^:@]*@/, ':***@'));
            
            this.client = new MongoClient(this.mongoUrl, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                connectTimeoutMS: 30000,
                serverSelectionTimeoutMS: 30000,
            });
            
            console.log('⏳ Connessione in corso...');
            await this.client.connect();
            console.log('🔗 Client connesso!');
            
            this.db = this.client.db(this.dbName);
            
            console.log('🏓 Ping al database...');
            await this.db.admin().ping();
            console.log('✅ Database raggiungibile!');
            
            // Crea collezione users se non esiste
            const collections = await this.db.listCollections().toArray();
            const userCollectionExists = collections.some(col => col.name === 'users');
            
            if (!userCollectionExists) {
                await this.db.createCollection('users');
                console.log('📁 Collezione users creata');
            }
            
            await this.db.collection('users').createIndex({ username: 1 }, { unique: true });
            console.log('📇 Indice username creato/verificato');
            
            await this.createDemoUsers();
            
            console.log('✅ Database MongoDB connesso e pronto!');
        } catch (error) {
            console.error('❌ Errore dettagliato database:');
            console.error('   - Tipo:', error.name);
            console.error('   - Messaggio:', error.message);
            console.error('   - Codice:', error.code);
            throw error;
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
                if (error.code === 11000) {
                    // Utente già esistente, ok
                } else {
                    console.error(`Errore creazione ${user.username}:`, error.message);
                }
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
        // Headers CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        // Gestione OPTIONS per CORS
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        
        // Routing base
        let filePath = '.' + req.url;
        if (filePath === './') {
            filePath = './index.html';
        }
        
        // Estensione e content type
        const extname = String(path.extname(filePath)).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.wav': 'audio/wav',
            '.mp4': 'video/mp4',
            '.woff': 'application/font-woff',
            '.ttf': 'application/font-ttf',
            '.eot': 'application/vnd.ms-fontobject',
            '.otf': 'application/font-otf',
            '.wasm': 'application/wasm'
        };

        const contentType = mimeTypes[extname] || 'application/octet-stream';
        
        // Leggi e servi il file
        fs.readFile(filePath, (error, content) => {
            if (error) {
                if (error.code === 'ENOENT') {
                    // File non trovato - prova a servire index.html per SPA
                    fs.readFile('./index.html', (err, content) => {
                        if (err) {
                            res.writeHead(404);
                            res.end('404 - File non trovato');
                        } else {
                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.end(content, 'utf-8');
                        }
                    });
                } else {
                    res.writeHead(500);
                    res.end('Errore server: ' + error.code);
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    }

    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            console.log('🎮 Nuova connessione WebSocket');
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    console.log(`📨 Messaggio ricevuto: ${message.type}`);
                    this.handlePlayerMessage(ws, message);
                } catch (error) {
                    console.error('Errore nel parsing del messaggio:', error);
                }
            });
            
            ws.on('close', () => {
                this.handleDisconnection(ws);
            });
            
            ws.on('error', (error) => {
                console.error('Errore WebSocket:', error);
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
                    console.log(`🎯 ${session.username} richiede joinLobby`);
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
            case 'launchBall':
                if (this.gameRunning && this.players.has(ws)) {
                    this.handleLaunchBall(ws);
                }
                break;
            case 'getStats':
                await this.handleGetStats(ws);
                break;
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong' }));
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
                const userData = this.users ? this.users.get(username) : null;
                if (userData) {
                    user = { username, ...userData };
                }
            }

            if (!user || user.password !== password) {
                console.log(`❌ Login fallito per ${username}`);
                ws.send(JSON.stringify({ 
                    type: 'loginResult', 
                    success: false, 
                    message: user ? 'Password errata' : 'Utente non trovato'
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
                console.log('💾 Usando database MongoDB...');
                const existingUser = await this.db.collection('users').findOne({ username });
                if (existingUser) {
                    console.log(`❌ Username ${username} già esistente`);
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
                
                await this.db.collection('users').insertOne(newUser);
                console.log(`✅ Utente ${username} registrato nel database`);

                ws.send(JSON.stringify({ 
                    type: 'registerResult', 
                    success: true, 
                    message: 'Registrazione completata! Ora puoi fare login.' 
                }));
            } else {
                console.log('📝 Usando memoria locale...');
                if (this.users && this.users.has(username)) {
                    ws.send(JSON.stringify({ 
                        type: 'registerResult', 
                        success: false, 
                        message: 'Username già esistente' 
                    }));
                    return;
                }

                if (!this.users) this.users = new Map();
                this.users.set(username, {
                    password: password,
                    stats: { wins: 0, losses: 0, games: 0 }
                });

                console.log(`✅ Utente ${username} registrato in memoria`);
                ws.send(JSON.stringify({ 
                    type: 'registerResult', 
                    success: true, 
                    message: 'Registrazione completata (memoria temporanea)' 
                }));
            }
        } catch (error) {
            console.error('💥 Errore registrazione:', error.message);
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
            console.log(`❌ Lobby piena!`);
            ws.send(JSON.stringify({ type: 'error', message: 'Lobby piena!' }));
            return;
        }
        
        this.players.set(ws, { id: playerId, ready: false, username: session.username });
        session.playerId = playerId;
        this.lobbyState.playersCount++;
        
        ws.send(JSON.stringify({ type: 'playerId', id: playerId }));
        
        console.log(`✅ ${session.username} in lobby come giocatore ${playerId}`);
        
        this.broadcastLobbyState();
    }

    handlePlayerReady(ws, ready) {
        const playerData = this.players.get(ws);
        if (!playerData) return;

        playerData.ready = ready;
        
        if (playerData.id === 1) {
            this.lobbyState.player1Ready = ready;
        } else {
            this.lobbyState.player2Ready = ready;
        }
        
        console.log(`🎯 Giocatore ${playerData.id} (${playerData.username}) ${ready ? 'PRONTO' : 'non pronto'}`);
        
        this.broadcastLobbyState();
        
        // Se entrambi pronti, inizia il gioco
        if (this.lobbyState.player1Ready && this.lobbyState.player2Ready && 
            this.lobbyState.playersCount === 2) {
            console.log('🚀 Entrambi i giocatori sono pronti! Iniziando...');
            setTimeout(() => this.startGame(), 1000);
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

    handleLaunchBall(ws) {
        const playerData = this.players.get(ws);
        if (!playerData || !this.waitingForLaunch) return;
        
        // Verifica che sia il giocatore giusto a lanciare
        if ((this.lastScorer === 1 && playerData.id === 2) ||
            (this.lastScorer === 2 && playerData.id === 1)) {
            this.launchBall();
        }
    }

    launchBall() {
        const direction = this.lastScorer === 1 ? -1 : 1;
        this.gameState.ball.dx = direction * 5;
        this.gameState.ball.dy = (Math.random() - 0.5) * 6;
        this.waitingForLaunch = false;
        
        this.broadcast({ type: 'ballLaunched' });
    }

    startGame() {
        console.log('🚀 Gioco iniziato!');
        this.gameRunning = true;
        this.gameState.gameRunning = true;
        this.waitingForLaunch = false;
        this.lastScorer = null;
        
        // Invia countdown
        let count = 3;
        const countdownInterval = setInterval(() => {
            this.broadcast({ type: 'countdown', count: count });
            count--;
            if (count < 0) {
                clearInterval(countdownInterval);
                this.broadcast({ type: 'gameStart' });
                this.gameLoopId = setInterval(() => this.updateGame(), 1000 / 60);
            }
        }, 1000);
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
        
        // Muovi le racchette
        this.gameState.paddle1.y += this.gameState.paddle1.dy;
        this.gameState.paddle2.y += this.gameState.paddle2.dy;
        
        // Limiti racchette
        this.gameState.paddle1.y = Math.max(0, Math.min(300, this.gameState.paddle1.y));
        this.gameState.paddle2.y = Math.max(0, Math.min(300, this.gameState.paddle2.y));
        
        // Muovi la palla solo se non in attesa di lancio
        if (!this.waitingForLaunch) {
            this.gameState.ball.x += this.gameState.ball.dx;
            this.gameState.ball.y += this.gameState.ball.dy;
            
            // Rimbalzo sui bordi
            if (this.gameState.ball.y <= this.gameState.ball.radius || 
                this.gameState.ball.y >= 400 - this.gameState.ball.radius) {
                this.gameState.ball.dy = -this.gameState.ball.dy;
            }
            
            // Collisioni con racchette
            this.checkPaddleCollisions();
            
            // Goal detection
            if (this.gameState.ball.x < 0) {
                this.handleGoal(2);
            } else if (this.gameState.ball.x > 800) {
                this.handleGoal(1);
            }
        }
        
        // Invia stato aggiornato
        this.broadcast({ 
            type: 'gameState', 
            state: this.gameState 
        });
    }

    checkPaddleCollisions() {
        const ball = this.gameState.ball;
        const paddle1 = this.gameState.paddle1;
        const paddle2 = this.gameState.paddle2;
        
        // Collisione con paddle sinistro
        if (ball.x <= 35 && 
            ball.y >= paddle1.y && 
            ball.y <= paddle1.y + 100) {
            ball.dx = Math.abs(ball.dx);
            const hitPos = (ball.y - paddle1.y - 50) / 50;
            ball.dy += hitPos * 3;
        }
        
        // Collisione con paddle destro
        if (ball.x >= 765 && 
            ball.y >= paddle2.y && 
            ball.y <= paddle2.y + 100) {
            ball.dx = -Math.abs(ball.dx);
            const hitPos = (ball.y - paddle2.y - 50) / 50;
            ball.dy += hitPos * 3;
        }
    }

    handleGoal(scorer) {
        if (scorer === 1) {
            this.gameState.score1++;
        } else {
            this.gameState.score2++;
        }
        
        this.lastScorer = scorer;
        this.waitingForLaunch = true;
        
        console.log(`⚽ Goal! Giocatore ${scorer} ha segnato (${this.gameState.score1}-${this.gameState.score2})`);
        
        // Reset palla al centro
        this.resetBall();
        
        // Notifica goal
        this.broadcast({ type: 'goal', scorer: scorer });
        
        // Verifica fine partita
        if (this.gameState.score1 >= 5 || this.gameState.score2 >= 5) {
            this.endGame();
        } else {
            // Aspetta il lancio dal giocatore che ha subito il goal
            this.broadcast({ 
                type: 'waitingForLaunch', 
                lastScorer: this.lastScorer 
            });
        }
    }

    resetBall() {
        this.gameState.ball.x = 400;
        this.gameState.ball.y = 200;
        this.gameState.ball.dx = 0;
        this.gameState.ball.dy = 0;
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

        console.log(`🏆 Partita terminata! Vince il giocatore ${winner}`);

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
                        console.log(`📊 Stats aggiornate per ${session.username}`);
                    } else if (this.users) {
                        const user = this.users.get(session.username);
                        if (user) {
                            user.stats.games++;
                            if (playerData.id === winner) {
                                user.stats.wins++;
                            } else {
                                user.stats.losses++;
                            }
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
        this.waitingForLaunch = false;
        this.lastScorer = null;
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
                this.resetGameState();
            }
            
            this.broadcastLobbyState();
            this.broadcast({ type: 'playerLeft' });
        }
    }

    broadcast(message) {
        const messageStr = JSON.stringify(message);
        this.players.forEach((playerData, ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(messageStr);
            }
        });
    }

    async close() {
        if (this.client) {
            await this.client.close();
            console.log('📦 Connessione database chiusa');
        }
    }

    start() {
        const port = process.env.PORT || 3000;
        console.log(`🚀 Tentativo avvio server sulla porta ${port}...`);
        
        this.server.listen(port, '0.0.0.0', () => {
            console.log(`\n✅ SERVER ATTIVO!`);
            console.log(`🌟 Porta: ${port}`);
            console.log(`🌐 URL locale: http://localhost:${port}`);
            
            if (process.env.RENDER_EXTERNAL_URL) {
                console.log(`🚀 URL pubblico: ${process.env.RENDER_EXTERNAL_URL}`);
            }
            
            console.log(`\n📊 Stato servizi:`);
            console.log(`   MongoDB: ${this.db ? '✅ Connesso' : '❌ Modalità memoria'}`);
            console.log(`   WebSocket: ✅ Pronto`);
            console.log(`   HTTP Server: ✅ Attivo`);
            console.log(`\n🎮 Il gioco è pronto all'uso!\n`);
        });
        
        this.server.on('error', (error) => {
            console.error('❌ Errore server:', error);
            if (error.code === 'EADDRINUSE') {
                console.error(`⚠️  La porta ${port} è già in uso!`);
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

process.on('SIGTERM', async () => {
    console.log('\n🛑 Arresto server richiesto (SIGTERM)...');
    if (global.pongServer) {
        await global.pongServer.close();
    }
    process.exit(0);
});

// Gestione errori non catturati
process.on('uncaughtException', (error) => {
    console.error('💥 Errore non gestito:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Promise rejection non gestita:', reason);
});

// Avvia il server
console.log('🏓 PONG ULTIMATE SERVER');
console.log('📅 Avvio:', new Date().toLocaleString());
console.log('🔧 Ambiente:', process.env.NODE_ENV || 'development');
console.log('');

global.pongServer = new PongServerDB();
global.pongServer.start();
