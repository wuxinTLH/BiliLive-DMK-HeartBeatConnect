# BiliLive DMK HeartBeatConnect (Electron版)

一个基于 Node.js 和 Electron 开发的 B站直播弹幕助手。支持实时接收弹幕、礼物、舰长购买、醒目留言（SC）等信息，并提供简洁的桌面端 GUI 界面。

## ✨ 功能特性

- **实时弹幕监控**：实时接收并展示直播间弹幕。
- **礼物互动追踪**：记录普通礼物与连击礼物信息。
- **高级打赏支持**：醒目留言（Super Chat）与 舰长/提督/总督购买通知。
- **直播间状态**：监听开播/下播状态及当前人气值。
- **自动重连**：网络波动或服务端断开时自动尝试重连。
- **登录支持**：支持通过 `SESSDATA` 环境变量配置登录状态，以获取更稳定的连接。
- **WBI 签名**：内置 B站最新的 WBI 签名算法，确保 API 请求正常。

## 📦 安装与运行

### 环境要求

- Node.js >= 16.0.0
- npm 或 yarn

### 步骤

1.  **克隆项目**

    ```bash
    git clone https://github.com/your-username/bili-live-tools.git
    cd bili-live-tools
    ```

2.  **安装依赖**

    ```bash
    npm install
    ```

3.  **配置 (可选)**
    如果需要以登录身份连接（获取更真实的数据或避免风控），请设置环境变量 `BILI_SESSDATA`。

    _Env_

    ```env
    SESSDATA="" # 你的SESSDATA字符串
    ```

    _Windows (CMD):_

    ```cmd
    set BILI_SESSDATA=你的SESSDATA字符串
    npm start
    ```

    _Windows (PowerShell):_

    ```powershell
    $env:BILI_SESSDATA="你的SESSDATA字符串"
    npm start
    ```

    _Linux / macOS:_

    ```bash
    export BILI_SESSDATA="你的SESSDATA字符串"
    npm start
    ```

4.  **启动应用**
    ```bash
    npm start
    ```

## 📁 项目结构

```text
bili-live-tools/
├── Client/                 # 前端渲染进程
│   ├── index.html          # 主页面
│   ├── renderer.js         # 前端逻辑
│   └── style.css           # 样式文件
├── Server/                 # 后端主进程
│   ├── index.js            # BilibiliConnector 核心逻辑
│   ├── events.js           # IPC 事件定义
│   └── utils/
│       └── logger.js       # 日志工具
├── .env.example            # 环境变量示例文件
├── main.js                 # Electron 主进程入口
├── package.json            # 项目配置
├── .gitignore              # Git 忽略配置
├── README.md               # 项目说明
└── LICENSE                 # MIT 协议
```
