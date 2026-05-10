const { ipcRenderer } = require('electron');
const EVENTS = require('../Server/events');

let currentRoomId = null;
let currentFilter = 'all';

const roomIdDisplay = document.getElementById('roomIdDisplay');
const statusText = document.getElementById('statusText');
const onlineCount = document.getElementById('onlineCount');
const msgContent = document.getElementById('msgContent');
const logContent = document.getElementById('logContent');
const disconnectBtn = document.getElementById('disconnectBtn');
const danmakuInput = document.getElementById('danmakuInput');
const sendBtn = document.getElementById('sendBtn');
const sendStatus = document.getElementById('sendStatus');

ipcRenderer.on('room:init', (event, { roomId }) => {
    currentRoomId = roomId;
    roomIdDisplay.textContent = roomId;
    addLog(`正在连接房间 ${roomId}...`);
});

function addLog(msg, type = '') {
    const div = document.createElement('div');
    div.className = `log-item ${type}`;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logContent.appendChild(div);
    logContent.scrollTop = logContent.scrollHeight;
}

function addMsg(type, content) {
    if (currentFilter !== 'all' && currentFilter !== type) return;
    const div = document.createElement('div');
    div.className = `msg-item msg-${type}`;
    div.innerHTML = content;
    msgContent.appendChild(div);
    msgContent.scrollTop = msgContent.scrollHeight;
}

document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.documentElement.setAttribute('data-theme', btn.dataset.theme);
        localStorage.setItem('theme', btn.dataset.theme);
    });
});

const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
}

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
    });
});

disconnectBtn.addEventListener('click', () => {
    if (currentRoomId) {
        ipcRenderer.send(EVENTS.DISCONNECT, currentRoomId);
    }
});

sendBtn.addEventListener('click', sendDanmaku);
danmakuInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendDanmaku();
});

function sendDanmaku() {
    const msg = danmakuInput.value.trim();
    if (!msg) return;
    if (!currentRoomId) {
        showSendStatus('未连接到直播间', 'error');
        return;
    }
    sendBtn.disabled = true;
    ipcRenderer.send(EVENTS.SEND_DANMAKU, { roomId: currentRoomId, message: msg });
}

function showSendStatus(msg, type) {
    sendStatus.textContent = msg;
    sendStatus.className = `send-status ${type}`;
    setTimeout(() => {
        sendStatus.textContent = '';
        sendStatus.className = 'send-status';
    }, 3000);
}

ipcRenderer.on(EVENTS.STATUS, (event, status) => {
    statusText.textContent = status;
    const isConnected = status === '已连接';
    sendBtn.disabled = !isConnected;
    if (isConnected) {
        addLog('连接成功', 'success');
    }
});

ipcRenderer.on(EVENTS.AUTH_SUCCESS, (event, data) => {
    if (data.uid && data.uid > 0) {
        addLog(`登录成功 (UID: ${data.uid})`, 'success');
    } else {
        addLog('弹幕连接成功 (游客模式，无法发送弹幕)', 'success');
    }
});

ipcRenderer.on(EVENTS.ONLINE, (event, data) => {
    onlineCount.textContent = data.count;
});

ipcRenderer.on(EVENTS.DANMAKU, (event, data) => {
    addMsg('danmaku', `<strong>${data.uname}:</strong> ${data.message}`);
});

ipcRenderer.on(EVENTS.GIFT, (event, data) => {
    addMsg('gift', `${data.uname} 送出了 ${data.giftName} x${data.num}`);
});

ipcRenderer.on(EVENTS.SUPERCHAT, (event, data) => {
    addMsg('sc', `<strong>¥${data.price}</strong> ${data.uname}: ${data.message}`);
});

ipcRenderer.on(EVENTS.GUARD, (event, data) => {
    const map = { 1: '总督', 2: '提督', 3: '舰长' };
    addMsg('guard', `${data.uname} 开通了 ${map[data.guardLevel] || '未知等级'}`);
});

ipcRenderer.on(EVENTS.LIVE_START, () => {
    addLog('开播了！', 'success');
    statusText.textContent = '直播中';
});

ipcRenderer.on(EVENTS.LIVE_END, () => {
    addLog('下播了。');
    statusText.textContent = '未开播';
});

ipcRenderer.on(EVENTS.ERROR, (event, data) => {
    addLog(`错误: ${data.message}`, 'error');
});

ipcRenderer.on(EVENTS.DANMAKU_SENT, (event, data) => {
    danmakuInput.value = '';
    sendBtn.disabled = false;
    showSendStatus('弹幕发送成功', 'success');
    addMsg('danmaku-sent', `<strong>[我]:</strong> ${data.message}`);
    addLog(`弹幕发送成功: ${data.message}`, 'success');
});
