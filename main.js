const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
                const key = trimmed.substring(0, eqIdx).trim();
                let val = trimmed.substring(eqIdx + 1).trim();
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.substring(1, val.length - 1);
                }
                if (!process.env[key]) {
                    process.env[key] = val;
                }
            }
        }
    });
}

process.stdout.setDefaultEncoding('utf8');
process.stderr.setDefaultEncoding('utf8');

const { app, BrowserWindow, ipcMain } = require('electron');
const http = require('http');
const BilibiliConnector = require('./Server/index');
const EVENTS = require('./Server/events');

const roomWindows = new Map();
let mainWindow;
let apiServer;

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 500,
        height: 400,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    mainWindow.loadFile(path.join(__dirname, 'Client', 'main.html'));
    mainWindow.setMenu(null);
}

function createRoomWindow(roomId) {
    if (roomWindows.has(String(roomId))) {
        const existing = roomWindows.get(String(roomId));
        existing.win.focus();
        return;
    }

    const connector = new BilibiliConnector();
    const win = new BrowserWindow({
        width: 1000,
        height: 750,
        title: `直播间 ${roomId}`,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    win.loadFile(path.join(__dirname, 'Client', 'room.html'));
    win.setMenu(null);

    win.webContents.on('did-finish-load', () => {
        win.webContents.send('room:init', { roomId });
    });

    win.on('closed', () => {
        connector.disconnect();
        roomWindows.delete(String(roomId));
    });

    roomWindows.set(String(roomId), { win, connector });
    setupForwarding(connector, win.webContents, roomId);

    connector.connect(roomId).catch(err => {
        win.webContents.send(EVENTS.ERROR, { message: err.message });
    });
}

function setupForwarding(connector, webContents, roomId) {
    connector.removeAllListeners();

    const safeSend = (channel, ...args) => {
        if (webContents.isDestroyed()) return;
        webContents.send(channel, ...args);
    };

    connector.on('connected', () => {
        safeSend(EVENTS.STATUS, '已连接');
    });

    connector.on('disconnected', () => {
        safeSend(EVENTS.STATUS, '已断开');
    });

    connector.on('authSuccess', (data) => {
        safeSend(EVENTS.AUTH_SUCCESS, data);
    });

    connector.on('error', (err) => {
        safeSend(EVENTS.ERROR, err);
    });

    connector.on('danmaku', (data) => {
        safeSend(EVENTS.DANMAKU, data);
    });

    connector.on('gift', (data) => {
        safeSend(EVENTS.GIFT, data);
    });

    connector.on('guard', (data) => {
        safeSend(EVENTS.GUARD, data);
    });

    connector.on('superchat', (data) => {
        safeSend(EVENTS.SUPERCHAT, data);
    });

    connector.on('online', (data) => {
        safeSend(EVENTS.ONLINE, data);
    });

    connector.on('liveStart', () => {
        safeSend(EVENTS.LIVE_START);
    });

    connector.on('liveEnd', () => {
        safeSend(EVENTS.LIVE_END);
    });

    connector.on('danmakuSent', (data) => {
        safeSend(EVENTS.DANMAKU_SENT, data);
    });
}

function startAPIServer(port) {
    apiServer = http.createServer((req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const url = new URL(req.url, `http://localhost:${port}`);

        if (url.pathname === '/api/connect' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { roomId } = JSON.parse(body);
                    if (!roomId) {
                        res.writeHead(400);
                        res.end(JSON.stringify({ error: '缺少 roomId 参数' }));
                        return;
                    }
                    if (roomWindows.has(String(roomId))) {
                        res.writeHead(200);
                        res.end(JSON.stringify({ message: '已连接该房间', roomId }));
                        return;
                    }
                    createRoomWindow(roomId);
                    res.writeHead(200);
                    res.end(JSON.stringify({ message: '连接成功', roomId }));
                } catch (e) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: '请求格式错误' }));
                }
            });
        } else if (url.pathname === '/api/disconnect' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { roomId } = JSON.parse(body);
                    const entry = roomWindows.get(String(roomId));
                    if (!entry) {
                        res.writeHead(404);
                        res.end(JSON.stringify({ error: '未找到该房间的连接' }));
                        return;
                    }
                    entry.win.close();
                    res.writeHead(200);
                    res.end(JSON.stringify({ message: '已断开连接', roomId }));
                } catch (e) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: '请求格式错误' }));
                }
            });
        } else if (url.pathname === '/api/send' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { roomId, message } = JSON.parse(body);
                    const entry = roomWindows.get(String(roomId));
                    if (!entry) {
                        res.writeHead(404);
                        res.end(JSON.stringify({ error: '未找到该房间的连接' }));
                        return;
                    }
                    entry.connector.sendDanmaku(message).then(result => {
                        res.writeHead(200);
                        res.end(JSON.stringify(result));
                    }).catch(err => {
                        res.writeHead(500);
                        res.end(JSON.stringify({ error: err.message }));
                    });
                } catch (e) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: '请求格式错误' }));
                }
            });
        } else if (url.pathname === '/api/status' && req.method === 'GET') {
            const status = {};
            roomWindows.forEach((entry, roomId) => {
                status[roomId] = entry.connector.isConnected();
            });
            res.writeHead(200);
            res.end(JSON.stringify({ connections: status }));
        } else {
            res.writeHead(404);
            res.end(JSON.stringify({ error: '未找到该接口' }));
        }
    });

    apiServer.listen(port, () => {
        console.log(`[API Server] 已启动，监听端口 ${port}`);
    });

    apiServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`[API Server] 端口 ${port} 已被占用`);
        } else {
            console.error(`[API Server] 错误: ${err.message}`);
        }
    });
}

app.whenReady().then(() => {
    createMainWindow();

    const PORT = parseInt(process.env.SERVER_PORT || '30081', 10);
    startAPIServer(PORT);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
    if (apiServer) apiServer.close();
});

ipcMain.on(EVENTS.CONNECT, async (event, roomId) => {
    createRoomWindow(roomId);
});

ipcMain.on(EVENTS.DISCONNECT, (event, roomId) => {
    const entry = roomWindows.get(String(roomId));
    if (entry) {
        entry.win.close();
    }
});

ipcMain.on(EVENTS.SEND_DANMAKU, async (event, { roomId, message }) => {
    const entry = roomWindows.get(String(roomId));
    if (!entry) {
        event.sender.send(EVENTS.ERROR, { message: "未找到该直播间的连接" });
        return;
    }
    try {
        const result = await entry.connector.sendDanmaku(message);
        entry.connector.emit('danmakuSent', result);
    } catch (err) {
        event.sender.send(EVENTS.ERROR, { message: err.message });
    }
});
