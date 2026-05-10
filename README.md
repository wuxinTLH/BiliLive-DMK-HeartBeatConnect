# BiliLive DMK HeartBeatConnect

一个基于 Node.js 和 Electron 开发的 B站直播弹幕助手。支持实时接收弹幕、礼物、舰长购买、醒目留言（SC）等信息，并提供简洁的桌面端 GUI 界面。

## 🎯 项目定位

本项目主要用于 **B站直播间追踪**，通过提供 HTTP RESTful API 和 Electron IPC 接口，可外接其他进程和服务，例如：

- **郊狼**：直播互动工具
- **互动礼物**：自定义礼物触发系统
- **弹幕游戏**：基于弹幕互动的游戏系统
- **自动化脚本**：直播间数据监控与分析
- **其他第三方服务**：任何需要接入B站直播间数据的系统

## ✨ 功能特性

- **实时弹幕监控**：实时接收并展示直播间弹幕。
- **礼物互动追踪**：记录普通礼物与连击礼物信息。
- **高级打赏支持**：醒目留言（Super Chat）与 舰长/提督/总督购买通知。
- **直播间状态**：监听开播/下播状态及当前人气值。
- **自动重连**：网络波动或服务端断开时自动尝试重连。
- **多房间监听**：支持同时监听多个直播间，每个直播间独立窗口。
- **弹幕发送**：支持发送弹幕（需配置 SESSDATA 和 CSRF）。
- **主题切换**：内置蓝粉白、白色、黑色三套主题。
- **WBI 签名**：内置 B站最新的 WBI 签名算法，确保 API 请求正常。
- **HTTP API 服务**：提供 RESTful API，方便其他开发者调用集成。

## 📦 安装与运行

### 环境要求

- Node.js >= 16.0.0
- npm 或 yarn

### 步骤

1. **克隆项目**

    ```bash
    git clone https://github.com/wuxinTLH/BiliLive-DMK-HeartBeatConnect.git
    cd BiliLive-DMK-HeartBeatConnect
    ```

2. **安装依赖**

    ```bash
    npm install
    ```

3. **配置环境变量（可选）**

    如果需要发送弹幕，请在项目根目录创建 `.env` 文件，并填入你的 B站 Cookie 信息：

    ```env
    # B站 SESSDATA，用于发送弹幕
    BILI_SESSDATA=你的SESSDATA值

    # B站 CSRF Token (bili_jct)，用于发送弹幕
    BILI_CSRF=你的bili_jct值

    # API 服务器端口（默认 30081）
    SERVER_PORT=30081
    ```

    **获取方式**：
    1. 登录 B站
    2. 打开浏览器开发者工具（F12）
    3. 进入 Application/存储 → Cookies → https://www.bilibili.com
    4. 找到 `SESSDATA` 和 `bili_jct` 的值

4. **启动应用**

    - **启动 GUI 界面**（含 HTTP API 服务）：
      ```bash
      npm start
      ```

    - **启动纯 API 服务器**（无需 GUI，适合开发者调用）：
      ```bash
      npm run server
      ```

## 📁 项目结构

```text
bili-live-tools/
├── Client/                 # 前端渲染进程
│   ├── main.html           # 主启动窗口页面
│   ├── main.css            # 主窗口样式
│   ├── main.js             # 主窗口逻辑
│   ├── room.html           # 直播间窗口页面
│   ├── room.css            # 直播间样式（含主题）
│   └── room.js             # 直播间逻辑
├── Server/                 # 后端核心逻辑
│   ├── index.js            # BilibiliConnector 核心类 + HTTP API 服务器
│   ├── events.js           # IPC 事件常量定义
│   └── utils/
│       └── logger.js       # 日志工具
├── .env                    # 环境变量配置文件（需自行创建）
├── .env.example            # 环境变量示例文件
├── .gitignore              # Git 忽略配置
├── API.md                  # API 接口文档
├── LICENSE                 # MIT 协议
├── main.js                 # Electron 主进程入口
├── package.json            # 项目配置
└── README.md               # 项目说明
```

## 🎨 主题

项目内置三套主题，可在直播间窗口右上角切换：

| 主题名称 | 说明                     |
| -------- | ------------------------ |
| 🎀 蓝粉白 | 粉色为主色调，蓝粉白配色 |
| ☀️ 白色   | 简洁白色主题             |
| 🌙 黑色   | 深色模式                 |

主题偏好会自动保存到 localStorage。

## 🌐 HTTP API 服务

项目提供 RESTful API 服务，方便其他开发者调用集成。

### 启动方式

- **GUI 模式**：`npm start` 启动时自动监听
- **纯 API 模式**：`npm run server` 仅启动 API 服务

### 端口配置

在 `.env` 文件中配置 `SERVER_PORT`，默认值为 `30081`。

### API 接口

| 接口              | 方法 | 说明         |
| ----------------- | ---- | ------------ |
| `/api/connect`    | POST | 连接直播间   |
| `/api/disconnect` | POST | 断开连接     |
| `/api/send`       | POST | 发送弹幕     |
| `/api/status`     | GET  | 查看连接状态 |

详细接口文档请参考 [API.md](./API.md)。

### 调用示例

```javascript
// 连接直播间
fetch('http://localhost:30081/api/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: '1945098' })
});

// 发送弹幕
fetch('http://localhost:30081/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: '1945098', message: '你好' })
});

// 查看连接状态
fetch('http://localhost:30081/api/status');
```

## 📡 Electron IPC 事件

前端与后端通过 Electron 的 IPC 机制通信，详细接口请参考 [API.md](./API.md)。

### 控制事件

| 事件名            | 方向            | 说明           |
| ----------------- | --------------- | -------------- |
| `bili:connect`    | Renderer → Main | 连接指定直播间 |
| `bili:disconnect` | Renderer → Main | 断开当前连接   |

### 推送事件

| 事件名           | 方向            | 说明         |
| ---------------- | --------------- | ------------ |
| `bili:status`    | Main → Renderer | 连接状态更新 |
| `bili:online`    | Main → Renderer | 在线人气值   |
| `bili:error`     | Main → Renderer | 错误通知     |
| `bili:danmaku`   | Main → Renderer | 弹幕消息     |
| `bili:gift`      | Main → Renderer | 礼物消息     |
| `bili:guard`     | Main → Renderer | 舰长购买     |
| `bili:superchat` | Main → Renderer | 醒目留言     |
| `bili:liveStart` | Main → Renderer | 主播开播     |
| `bili:liveEnd`   | Main → Renderer | 主播下播     |

## 🔧 BilibiliConnector API

`BilibiliConnector` 是一个 EventEmitter，可在纯 Node.js 环境中独立使用。

### 构造函数

```javascript
const BilibiliConnector = require('./Server/index');
const connector = new BilibiliConnector();
```

### 方法

| 方法                   | 参数                     | 返回值            | 说明       |
| ---------------------- | ------------------------ | ----------------- | ---------- |
| `connect(roomId)`      | `roomId` (String/Number) | `Promise<void>`   | 连接直播间 |
| `disconnect()`         | 无                       | `void`            | 断开连接   |
| `sendDanmaku(message)` | `message` (String)       | `Promise<Object>` | 发送弹幕   |
| `isConnected()`        | 无                       | `Boolean`         | 是否已连接 |

### 事件

| 事件名         | 回调参数                                                | 说明               |
| -------------- | ------------------------------------------------------- | ------------------ |
| `connected`    | 无                                                      | WebSocket 连接成功 |
| `authSuccess`  | `{ uid, roomId }`                                       | 鉴权成功           |
| `disconnected` | 无                                                      | 连接断开           |
| `error`        | `{ message }`                                           | 发生错误           |
| `danmaku`      | `{ uname, message }`                                    | 收到弹幕           |
| `gift`         | `{ uname, giftName, giftId, num, coinType, totalCoin }` | 收到礼物           |
| `guard`        | `{ uname, guardLevel, num, price }`                     | 舰长购买           |
| `superchat`    | `{ uname, message, price }`                             | 醒目留言           |
| `online`       | `{ count }`                                             | 人气值更新         |
| `liveStart`    | 无                                                      | 主播开播           |
| `liveEnd`      | 无                                                      | 主播下播           |

### 使用示例

```javascript
const BilibiliConnector = require('./Server/index');
const connector = new BilibiliConnector();

connector.on('connected', () => console.log('已连接'));
connector.on('authSuccess', (data) => console.log(`鉴权成功 UID: ${data.uid}`));
connector.on('danmaku', (data) => console.log(`${data.uname}: ${data.message}`));
connector.on('gift', (data) => console.log(`${data.uname} 送出 ${data.giftName} x${data.num}`));
connector.on('error', (err) => console.error('错误:', err.message));

connector.connect('1945098');

// 发送弹幕（需配置 SESSDATA 和 CSRF）
// connector.sendDanmaku('你好').then(() => console.log('发送成功'));

// 断开连接
// connector.disconnect();
```

## ⚠️ 注意事项

1. **SESSDATA 有效期**：B站 Cookie 有有效期限制，过期后需重新获取。
2. **弹幕发送限制**：发送弹幕需要登录身份，且受 B站风控策略影响。
3. **CSRF Token**：`BILI_CSRF` 必须与 `BILI_SESSDATA` 对应同一账号。
4. **多窗口管理**：每个直播间独立窗口，关闭窗口自动断开连接。
5. **端口占用**：启动前请确保 `SERVER_PORT` 配置的端口未被占用。

## 📄 License

MIT
