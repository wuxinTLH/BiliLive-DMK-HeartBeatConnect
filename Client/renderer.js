const { ipcRenderer } = require('electron');
const EVENTS = require('../Server/events');

// DOM 元素
const roomIdInput = document.getElementById('roomIdInput');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const statusText = document.getElementById('statusText');
const onlineCount = document.getElementById('onlineCount');
const logContent = document.getElementById('logContent');
const msgContent = document.getElementById('msgContent');

// 工具函数：添加日志
function addLog(msg) {
    const div = document.createElement('div');
    div.className = 'log-item';
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logContent.appendChild(div);
    logContent.scrollTop = logContent.scrollHeight;
}

// 工具函数：添加消息
function addMsg(type, content) {
    const div = document.createElement('div');
    div.className = `msg-item msg-${type}`;
    div.innerHTML = content;
    msgContent.appendChild(div);
    msgContent.scrollTop = msgContent.scrollHeight;
}

// 按钮事件
connectBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (roomId) {
        ipcRenderer.send(EVENTS.CONNECT, roomId);
        addLog(`正在连接房间 ${roomId}...`);
    } else {
        alert('请输入房间号');
    }
});

disconnectBtn.addEventListener('click', () => {
    ipcRenderer.send(EVENTS.DISCONNECT);
});

// 监听后端事件
ipcRenderer.on(EVENTS.STATUS, (event, status) => {
    statusText.textContent = status;
    if (status === '已连接') {
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;
        roomIdInput.disabled = true;
    } else {
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
        roomIdInput.disabled = false;
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
    addMsg('guard', `${data.uname} 开通了 ${map[data.guardLevel]}`);
});

ipcRenderer.on(EVENTS.LIVE_START, () => {
    addLog('开播了！');
    statusText.textContent = '直播中';
});

ipcRenderer.on(EVENTS.LIVE_END, () => {
    addLog('下播了。');
    statusText.textContent = '未开播';
});

ipcRenderer.on(EVENTS.ERROR, (event, data) => {
    addLog(`错误: ${data.message}`);
    alert(data.message);
});
