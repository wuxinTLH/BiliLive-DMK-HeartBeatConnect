const { ipcRenderer } = require('electron');
const EVENTS = require('../Server/events');

const roomIdInput = document.getElementById('roomIdInput');
const openBtn = document.getElementById('openBtn');
const roomCount = document.getElementById('roomCount');
const quickBtns = document.getElementById('quickBtns');

const quickRooms = [
    { id: '6', name: '英雄联盟' },
    { id: '21668476', name: '热门直播' },
    { id: '1945098', name: '测试房间' }
];

quickRooms.forEach(room => {
    const btn = document.createElement('button');
    btn.className = 'quick-btn';
    btn.textContent = room.name;
    btn.addEventListener('click', () => {
        ipcRenderer.send(EVENTS.CONNECT, room.id);
    });
    quickBtns.appendChild(btn);
});

openBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (roomId) {
        ipcRenderer.send(EVENTS.CONNECT, roomId);
        roomIdInput.value = '';
    } else {
        alert('请输入房间号');
    }
});

roomIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        openBtn.click();
    }
});
