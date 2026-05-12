# BiliLive DMK HeartBeatConnect

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16.0.0-green?logo=nodedotjs)
![Electron](https://img.shields.io/badge/Electron-Desktop-blue?logo=electron)
![License](https://img.shields.io/badge/License-MIT-yellow)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

**一个基于 Node.js + Electron 开发的 B 站直播弹幕监听与接入工具**

实时接收弹幕、礼物、舰长、SC，提供桌面 GUI 界面与 HTTP RESTful API，可轻松对接第三方服务

</div>

---

## 目录

- [项目简介](#项目简介)
- [功能特性](#功能特性)
- [技术架构](#技术架构)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
  - [环境要求](#环境要求)
  - [安装依赖](#安装依赖)
  - [配置环境变量](#配置环境变量)
  - [启动方式](#启动方式)
- [界面说明](#界面说明)
- [API 使用](#api-使用)
- [集成示例](#集成示例)
- [注意事项](#注意事项)
- [常见问题](#常见问题)
- [License](#license)

---

## 项目简介

**BiliLive DMK HeartBeatConnect** 是一个专为 B 站直播间数据接入设计的工具，核心功能是通过 WebSocket 连接 B 站弹幕服务器，实时获取直播间内的各类互动数据，并对外提供标准化的 HTTP RESTful API 接口与 Electron IPC 接口。

### 适用场景

本项目适合需要接入 B 站直播间数据的开发者或创作者，典型用途包括：

| 场景                  | 说明                            |
| --------------------- | ------------------------------- |
| 🐺 郊狼 / VTuber 互动 | 实时响应弹幕、礼物触发互动效果  |
| 🎁 互动礼物系统       | 自定义礼物触发动作              |
| 🎮 弹幕小游戏         | 构建基于弹幕指令的互动游戏      |
| 📊 数据监控分析       | 采集直播间实时数据进行统计      |
| 🔗 第三方服务对接     | 任意需要 B 站直播间数据流的系统 |

---

## 功能特性

- **📨 实时弹幕监控** — 实时接收并展示直播间弹幕，附带发送者昵称与 UID。
- **🎁 礼物互动追踪** — 记录普通礼物与连击礼物信息，包含礼物名称、数量与金瓜子价值。
- **💬 醒目留言（SC）** — 接收 Super Chat 消息，显示内容与金额。
- **⚓ 舰长 / 提督 / 总督** — 捕获舰长购买事件，区分等级与数量。
- **📡 直播状态监听** — 实时感知主播开播与下播事件。
- **🔄 自动重连机制** — 网络波动或服务端断开后自动重试连接。
- **🏠 多房间监听** — 支持同时监听多个直播间，每个房间独立管理。
- **✉️ 弹幕发送** — 支持向直播间发送弹幕（需配置账号 Cookie）。
- **🎨 多主题切换** — 内置蓝粉白、白色、黑色三套主题，实时切换并自动保存偏好。
- **🔐 WBI 签名** — 内置 B 站最新 WBI 签名算法，确保 API 请求合法有效。
- **🌐 HTTP API 服务** — 提供 RESTful API，方便任意语言、任意平台的开发者集成调用。

---

## 技术架构

```
┌──────────────────────────────────────────────────────┐
│                   Electron 主进程                     │
│  ┌─────────────────┐    ┌──────────────────────────┐ │
│  │ BilibiliConnector│    │   HTTP API Server        │ │
│  │ (WebSocket 客户端)│    │   (Express / http)       │ │
│  │                 │    │   Port: 30081            │ │
│  └────────┬────────┘    └──────────────────────────┘ │
│           │ IPC Events                                │
└───────────┼──────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────┐
│              Electron 渲染进程 (GUI)                   │
│  ┌──────────────────┐   ┌───────────────────────────┐ │
│  │  主窗口 main.html │   │  直播间窗口 room.html      │ │
│  │  (房间输入/管理)  │   │  (弹幕/礼物/SC 展示)      │ │
│  └──────────────────┘   └───────────────────────────┘ │
└──────────────────────────────────────────────────────┘
            │
            │ HTTP RESTful API
            ▼
┌──────────────────────────────┐
│   外部服务 / 第三方工具        │
│  郊狼 / 弹幕游戏 / 自动脚本   │
└──────────────────────────────┘
```

---

## 项目结构

```
BiliLive-DMK-HeartBeatConnect/
├── Client/                     # 前端渲染进程代码
│   ├── main.html               # 主启动窗口（房间输入与管理）
│   ├── main.css                # 主窗口样式
│   ├── main.js                 # 主窗口交互逻辑
│   ├── room.html               # 直播间展示窗口
│   ├── room.css                # 直播间样式（含三套主题定义）
│   └── room.js                 # 直播间事件处理与渲染逻辑
│
├── Server/                     # 后端核心逻辑
│   ├── index.js                # BilibiliConnector 核心类 + HTTP API 服务
│   ├── events.js               # IPC 事件常量定义（避免硬编码字符串）
│   └── utils/
│       └── logger.js           # 日志工具（统一输出格式）
│
├── main.js                     # Electron 主进程入口
├── package.json                # 项目依赖与脚本配置
├── .env                        # 本地环境变量（需自行创建，不提交 Git）
├── .env.example                # 环境变量模板示例
├── .gitignore                  # Git 忽略规则
├── API.md                      # API 接口详细文档
├── LICENSE                     # MIT 开源许可证
└── README.md                   # 项目说明文档
```

---

## 快速开始

### 环境要求

| 依赖     | 版本要求                |
| -------- | ----------------------- |
| Node.js  | >= 16.0.0               |
| npm      | 随 Node.js 附带         |
| 操作系统 | Windows / macOS / Linux |

### 安装依赖

```bash
# 克隆项目
git clone https://github.com/wuxinTLH/BiliLive-DMK-HeartBeatConnect.git
cd BiliLive-DMK-HeartBeatConnect

# 安装依赖
npm install
```

### 配置环境变量

在项目根目录复制 `.env.example` 并重命名为 `.env`，然后填入你的配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```dotenv
# ===== B 站账号信息（发送弹幕时必填）=====

# B 站 Cookie 中的 SESSDATA 值
BILI_SESSDATA=你的SESSDATA值

# B 站 Cookie 中的 bili_jct 值（CSRF Token）
BILI_CSRF=你的bili_jct值

# ===== 服务器配置 =====

# HTTP API 监听端口（默认 30081）
SERVER_PORT=30081
```

> **如何获取 SESSDATA 和 bili_jct：**
>
> 1. 在浏览器中登录 [bilibili.com](https://www.bilibili.com)
> 2. 按 `F12` 打开开发者工具
> 3. 切换到 **Application（应用程序）** → **Cookies** → `https://www.bilibili.com`
> 4. 找到 `SESSDATA` 和 `bili_jct` 并复制其值
>
> ⚠️ **注意**：Cookie 具有有效期，过期后需重新获取。请勿将含有真实 Cookie 的 `.env` 文件提交至 Git 仓库。

### 启动方式

**方式一：GUI 桌面模式**（推荐普通用户使用）

```bash
npm start
```

启动后会弹出 Electron 桌面窗口，同时自动在后台启动 HTTP API 服务。

**方式二：纯 API 服务模式**（适合服务器部署 / 开发者调用）

```bash
npm run server
```

不启动 GUI，仅运行 HTTP API 服务，适合后台进程或容器化部署。

---

## 界面说明

### 主窗口

主窗口用于输入并管理直播间房间号，点击「连接」后会创建对应的直播间展示窗口。

### 直播间窗口

每个直播间独立一个窗口，展示内容包括：

- 📊 当前人气值（实时更新）
- 💬 弹幕消息流（含发送者昵称）
- 🎁 礼物记录（礼物名称 + 数量）
- ⚓ 舰长购买通知
- 💛 醒目留言（Super Chat）
- 🔴 开播 / 下播状态提示

### 主题切换

点击窗口右上角主题按钮可在三套主题间切换，主题偏好自动持久化至 `localStorage`。

| 主题      | 配色风格             |
| --------- | -------------------- |
| 🎀 蓝粉白 | 粉蓝为主色，明亮活泼 |
| ☀️ 白色   | 简洁纯白，清晰易读   |
| 🌙 黑色   | 深色背景，护眼模式   |

---

## API 使用

项目提供三种接入方式，详细文档请查阅 [API.md](./API.md)。

### HTTP RESTful API（推荐外部集成）

默认监听 `http://localhost:30081`，提供以下端点：

| 方法   | 路径              | 说明                 |
| ------ | ----------------- | -------------------- |
| `POST` | `/api/connect`    | 连接指定直播间       |
| `POST` | `/api/disconnect` | 断开指定直播间       |
| `POST` | `/api/send`       | 向直播间发送弹幕     |
| `GET`  | `/api/status`     | 查询所有房间连接状态 |

### Electron IPC API（内部 GUI 使用）

渲染进程通过 `ipcRenderer` 与主进程通信，事件前缀均为 `bili:`。

### BilibiliConnector（纯 Node.js SDK）

`BilibiliConnector` 是一个继承自 `EventEmitter` 的核心类，可在不依赖 Electron 的纯 Node.js 环境中直接使用。

---

## 集成示例

### JavaScript / Node.js

```js
// 连接直播间
fetch("http://localhost:30081/api/connect", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ roomId: "1945098" }),
})
  .then((res) => res.json())
  .then(console.log);

// 发送弹幕
fetch("http://localhost:30081/api/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ roomId: "1945098", message: "来自脚本的问候！" }),
});

// 查询连接状态
fetch("http://localhost:30081/api/status")
  .then((res) => res.json())
  .then((data) => console.log("连接状态:", data.connections));
```

### Python

```python
import requests

BASE = 'http://localhost:30081'

# 连接直播间
resp = requests.post(f'{BASE}/api/connect', json={'roomId': '1945098'})
print(resp.json())

# 查询状态
resp = requests.get(f'{BASE}/api/status')
print(resp.json())

# 断开连接
resp = requests.post(f'{BASE}/api/disconnect', json={'roomId': '1945098'})
print(resp.json())
```

### 直接使用 BilibiliConnector（Node.js SDK）

```js
const BilibiliConnector = require("./Server/index");

const connector = new BilibiliConnector();

connector.on("connected", () => console.log("✅ WebSocket 已连接"));
connector.on("authSuccess", ({ uid, roomId }) =>
  console.log(`🔐 鉴权成功 — UID: ${uid}, 房间: ${roomId}`),
);
connector.on("danmaku", ({ uname, message }) =>
  console.log(`💬 ${uname}: ${message}`),
);
connector.on("gift", ({ uname, giftName, num, totalCoin }) =>
  console.log(
    `🎁 ${uname} 送出 ${giftName} x${num}（价值 ${totalCoin} 金瓜子）`,
  ),
);
connector.on("guard", ({ uname, guardLevel }) => {
  const levels = { 1: "总督", 2: "提督", 3: "舰长" };
  console.log(`⚓ ${uname} 购买了 ${levels[guardLevel]}`);
});
connector.on("superchat", ({ uname, message, price }) =>
  console.log(`💛 [SC ¥${price}] ${uname}: ${message}`),
);
connector.on("liveStart", () => console.log("🔴 主播开播了！"));
connector.on("liveEnd", () => console.log("⚫ 主播下播了"));
connector.on("error", ({ message }) => console.error("❌ 错误:", message));

// 连接直播间
connector.connect("1945098");
```

---

## 注意事项

1. **Cookie 有效期**：`SESSDATA` 和 `bili_jct` 均有有效期，过期后发送弹幕功能会失效，需重新获取。
2. **两者须对应同一账号**：`BILI_SESSDATA` 与 `BILI_CSRF` 必须来自同一登录会话，否则弹幕发送会因鉴权失败报错。
3. **弹幕发送风控**：B 站对弹幕发送频率有限制，高频发送可能触发风控导致账号受限，请合理使用。
4. **端口冲突**：启动前请确认 `SERVER_PORT`（默认 `30081`）未被其他程序占用，如有冲突请在 `.env` 中修改。
5. **多窗口管理**：每个直播间对应一个独立 Electron 窗口，关闭窗口时会自动断开该房间的 WebSocket 连接。
6. **安全提示**：`.env` 文件包含账号敏感信息，请勿将其上传至公开代码仓库。

---

## 常见问题

**Q：启动后 API 服务无响应？**

A：确认 `SERVER_PORT` 对应端口未被占用，并检查是否以正确的命令启动（`npm start` 或 `npm run server`）。

**Q：弹幕发送失败提示鉴权错误？**

A：请检查 `.env` 中的 `BILI_SESSDATA` 和 `BILI_CSRF` 是否过期或填写有误，重新从浏览器 Cookie 中获取最新值。

**Q：连接直播间后长时间无数据？**

A：确认直播间号正确（可从直播间 URL 末尾获取），并检查网络连接。部分直播间在未开播状态下不会推送弹幕数据，这属于正常现象。

**Q：如何在 Linux 服务器上无 GUI 运行？**

A：使用 `npm run server` 命令启动纯 API 服务模式，该模式不依赖 Electron 和图形界面，可在无头服务器上运行。

---

## License

本项目基于 [MIT License](./LICENSE) 开源，欢迎 Fork 与二次开发。
