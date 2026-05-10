const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const BilibiliConnector = require('./Server/index');
const EVENTS = require('./Server/events');

let mainWindow;
const connector = new BilibiliConnector();

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            // 注意：为了演示方便，这里禁用了 nodeIntegration 和 contextIsolation 的严格限制。
            // 在生产环境中，建议使用 preload.js 来安全地暴露 API。
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // 加载前端页面
    mainWindow.loadFile(path.join(__dirname, 'Client', 'index.html'));

    // 开发时打开调试工具
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// ─── IPC 通信处理 ───────────────────────────────────────

// 监听连接请求
ipcMain.on(EVENTS.CONNECT, async (event, roomId) => {
    // 将 connector 的事件转发给渲染进程
    setupForwarding(event.sender);

    try {
        await connector.connect(roomId);
    } catch (err) {
        event.sender.send(EVENTS.ERROR, { message: err.message });
    }
});

// 监听断开请求
ipcMain.on(EVENTS.DISCONNECT, () => {
    connector.disconnect();
});

// 辅助函数：将 connector 的事件转发给渲染进程
function setupForwarding(webContents) {
    // 避免重复监听
    connector.removeAllListeners();

    connector.on('connected', () => {
        webContents.send(EVENTS.STATUS, '已连接');
    });

    connector.on('disconnected', () => {
        webContents.send(EVENTS.STATUS, '已断开');
    });

    connector.on('error', (err) => {
        webContents.send(EVENTS.ERROR, err);
    });

    connector.on('danmaku', (data) => {
        webContents.send(EVENTS.DANMAKU, data);
    });

    connector.on('gift', (data) => {
        webContents.send(EVENTS.GIFT, data);
    });

    connector.on('guard', (data) => {
        webContents.send(EVENTS.GUARD, data);
    });

    connector.on('superchat', (data) => {
        webContents.send(EVENTS.SUPERCHAT, data);
    });

    connector.on('online', (data) => {
        webContents.send(EVENTS.ONLINE, data);
    });

    connector.on('liveStart', () => {
        webContents.send(EVENTS.LIVE_START);
    });

    connector.on('liveEnd', () => {
        webContents.send(EVENTS.LIVE_END);
    });
}
