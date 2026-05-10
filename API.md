# BiliLive DMK HeartBeatConnect API 文档

## 概述

本文档描述了三种 API 接口：
1. **HTTP RESTful API**：外部开发者可通过 HTTP 请求调用的接口。
2. **Electron IPC API**：前端（渲染进程）与后端（主进程）之间的通信接口。
3. **BilibiliConnector API**：纯 Node.js 环境下可直接使用的核心类接口。

---

## 1. HTTP RESTful API

项目提供 HTTP RESTful API 服务，方便外部开发者调用集成。

### 1.1 服务配置

- **端口**：从 `.env` 文件读取 `SERVER_PORT`，默认值为 `30081`
- **CORS**：已启用跨域支持（`Access-Control-Allow-Origin: *`）
- **数据格式**：JSON

### 1.2 启动方式

- **GUI 模式**：`npm start` 启动 Electron 应用时自动启动 API 服务
- **纯 API 模式**：`npm run server` 仅启动 API 服务（无需 GUI）

### 1.3 接口列表

#### 连接直播间

- **URL**: `POST /api/connect`
- **请求体**:
  ```json
  {
    "roomId": "1945098"
  }
  ```
- **成功响应** (200):
  ```json
  {
    "message": "连接成功",
    "roomId": "1945098"
  }
  ```
- **错误响应** (400):
  ```json
  {
    "error": "缺少 roomId 参数"
  }
  ```
- **示例**:
  ```javascript
  fetch('http://localhost:30081/api/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: '1945098' })
  });
  ```

#### 断开连接

- **URL**: `POST /api/disconnect`
- **请求体**:
  ```json
  {
    "roomId": "1945098"
  }
  ```
- **成功响应** (200):
  ```json
  {
    "message": "已断开连接",
    "roomId": "1945098"
  }
  ```
- **错误响应** (404):
  ```json
  {
    "error": "未找到该房间的连接"
  }
  ```
- **示例**:
  ```javascript
  fetch('http://localhost:30081/api/disconnect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: '1945098' })
  });
  ```

#### 发送弹幕

- **URL**: `POST /api/send`
- **请求体**:
  ```json
  {
    "roomId": "1945098",
    "message": "你好"
  }
  ```
- **成功响应** (200):
  ```json
  {
    "success": true,
    "message": "发送成功"
  }
  ```
- **错误响应** (404):
  ```json
  {
    "error": "未找到该房间的连接"
  }
  ```
- **错误响应** (500):
  ```json
  {
    "error": "发送失败原因"
  }
  ```
- **示例**:
  ```javascript
  fetch('http://localhost:30081/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: '1945098', message: '你好' })
  });
  ```

#### 查看连接状态

- **URL**: `GET /api/status`
- **响应** (200):
  ```json
  {
    "connections": {
      "1945098": true,
      "123456": false
    }
  }
  ```
- **示例**:
  ```javascript
  fetch('http://localhost:30081/api/status')
    .then(res => res.json())
    .then(data => console.log(data));
  ```

---

## 2. Electron IPC API

通信基于 Electron 的 `ipcRenderer` 和 `ipcMain` 模块，事件前缀为 `bili:`（定义在 `Server/events.js` 中）。

### 2.1 控制接口

用于控制连接的建立与断开。

#### 连接直播间

- **Channel**: `bili:connect`
- **方向**: Renderer → Main
- **参数**: `roomId` (String | Number) - B站直播间号
- **示例**:
  ```javascript
  ipcRenderer.send("bili:connect", "1945098");
  ```

#### 断开连接

- **Channel**: `bili:disconnect`
- **方向**: Renderer → Main
- **参数**: `roomId` (String | Number) - B站直播间号
- **示例**:
  ```javascript
  ipcRenderer.send("bili:disconnect", "1945098");
  ```

#### 发送弹幕

- **Channel**: `bili:sendDanmaku`
- **方向**: Renderer → Main
- **参数**: `{ roomId: string, message: string }` - 房间号和弹幕内容
- **示例**:
  ```javascript
  ipcRenderer.send("bili:sendDanmaku", { roomId: "1945098", message: "你好" });
  ```

### 2.2 状态与数据推送接口

后端主动向前端推送的消息。前端需要使用 `ipcRenderer.on` 监听这些事件。

#### 连接状态更新

- **Channel**: `bili:status`
- **方向**: Main → Renderer
- **数据**: `status` (String) - 状态描述，如 `"已连接"`, `"已断开"`
- **示例**:
  ```javascript
  ipcRenderer.on("bili:status", (event, status) => {
    console.log("当前状态:", status);
  });
  ```

#### 鉴权成功

- **Channel**: `bili:authSuccess`
- **方向**: Main → Renderer
- **数据**: `{ uid: number, roomId: number }`
- **示例**:
  ```javascript
  ipcRenderer.on("bili:authSuccess", (event, data) => {
    console.log(`鉴权成功 UID: ${data.uid}, 房间: ${data.roomId}`);
  });
  ```

#### 在线人气值

- **Channel**: `bili:online`
- **方向**: Main → Renderer
- **数据**: `{ count: number }` - 人气值
- **示例**:
  ```javascript
  ipcRenderer.on("bili:online", (event, data) => {
    document.getElementById("online-count").innerText = data.count;
  });
  ```

#### 错误通知

- **Channel**: `bili:error`
- **方向**: Main → Renderer
- **数据**: `{ message: string }` - 错误信息
- **示例**:
  ```javascript
  ipcRenderer.on("bili:error", (event, err) => {
    console.error("发生错误:", err.message);
  });
  ```

#### 弹幕发送结果

- **Channel**: `bili:danmakuSent`
- **方向**: Main → Renderer
- **数据**: `{ success: boolean, message: string }`
- **示例**:
  ```javascript
  ipcRenderer.on("bili:danmakuSent", (event, data) => {
    console.log("弹幕发送结果:", data);
  });
  ```

### 2.3 消息事件推送

#### 弹幕消息

- **Channel**: `bili:danmaku`
- **数据**:
  ```typescript
  {
    uname: string,    // 发送者昵称
    uid: number,      // 发送者UID
    message: string   // 弹幕内容
  }
  ```

#### 礼物消息

- **Channel**: `bili:gift`
- **数据**:
  ```typescript
  {
    uname: string,      // 赠送者昵称
    giftName: string,   // 礼物名称
    giftId: number,     // 礼物ID
    num: number,        // 数量
    coinType: string,   // 货币类型 (e.g., "gold")
    totalCoin: number   // 总价值
  }
  ```

#### 舰长购买

- **Channel**: `bili:guard`
- **数据**:
  ```typescript
  {
    uname: string,      // 用户昵称
    guardLevel: number, // 等级: 1-总督, 2-提督, 3-舰长
    num: number,        // 购买数量
    price: number       // 价格
  }
  ```

#### 醒目留言 (Super Chat)

- **Channel**: `bili:superchat`
- **数据**:
  ```typescript
  {
    uname: string,   // 用户昵称
    message: string, // SC 内容
    price: number    // 价格 (RMB)
  }
  ```

#### 直播状态变更

- **Channel**: `bili:liveStart` - 主播开播
- **Channel**: `bili:liveEnd` - 主播下播
- **数据**: 无（仅事件触发）

---

## 3. BilibiliConnector API

`BilibiliConnector` 是一个 EventEmitter，可在纯 Node.js 环境中独立使用，无需 Electron。

### 3.1 快速开始

```javascript
const BilibiliConnector = require('./Server/index');
const connector = new BilibiliConnector();

// 监听事件
connector.on('connected', () => console.log('已连接'));
connector.on('authSuccess', (data) => console.log(`鉴权成功 UID: ${data.uid}`));
connector.on('danmaku', (data) => console.log(`${data.uname}: ${data.message}`));
connector.on('gift', (data) => console.log(`${data.uname} 送出 ${data.giftName} x${data.num}`));
connector.on('error', (err) => console.error('错误:', err.message));

// 连接直播间
connector.connect('1945098');

// 发送弹幕（需配置 SESSDATA 和 CSRF）
// connector.sendDanmaku('你好').then(() => console.log('发送成功'));

// 断开连接
// connector.disconnect();
```

### 3.2 构造函数

```javascript
const connector = new BilibiliConnector();
```

无需参数，创建一个 BilibiliConnector 实例。

### 3.3 实例方法

#### connect(roomId)

连接指定直播间。

- **参数**: `roomId` (String | Number) - 直播间号
- **返回**: `Promise<void>`
- **示例**:
  ```javascript
  await connector.connect('1945098');
  ```

#### disconnect()

断开当前连接。

- **参数**: 无
- **返回**: `void`
- **示例**:
  ```javascript
  connector.disconnect();
  ```

#### sendDanmaku(message)

发送弹幕到直播间。

- **参数**: `message` (String) - 弹幕内容
- **返回**: `Promise<{ success: boolean, message: string }>`
- **前置条件**: 需配置 `BILI_SESSDATA` 和 `BILI_CSRF` 环境变量
- **示例**:
  ```javascript
  const result = await connector.sendDanmaku('你好');
  console.log(result); // { success: true, message: '你好' }
  ```

#### isConnected()

检查当前是否已连接。

- **参数**: 无
- **返回**: `Boolean`
- **示例**:
  ```javascript
  if (connector.isConnected()) {
    console.log('已连接');
  }
  ```

### 3.4 事件

| 事件名         | 回调参数                                                                                                | 触发时机           |
| -------------- | ------------------------------------------------------------------------------------------------------- | ------------------ |
| `connected`    | 无                                                                                                      | WebSocket 连接成功 |
| `authSuccess`  | `{ uid: number, roomId: number }`                                                                       | 鉴权成功           |
| `disconnected` | 无                                                                                                      | 连接断开           |
| `error`        | `{ message: string }`                                                                                   | 发生错误           |
| `danmaku`      | `{ uname: string, uid: number, message: string }`                                                       | 收到弹幕           |
| `gift`         | `{ uname: string, giftName: string, giftId: number, num: number, coinType: string, totalCoin: number }` | 收到礼物           |
| `guard`        | `{ uname: string, guardLevel: number, num: number, price: number }`                                     | 舰长购买           |
| `superchat`    | `{ uname: string, message: string, price: number }`                                                     | 醒目留言           |
| `online`       | `{ count: number }`                                                                                     | 人气值更新         |
| `liveStart`    | 无                                                                                                      | 主播开播           |
| `liveEnd`      | 无                                                                                                      | 主播下播           |

### 3.5 环境变量

| 变量名          | 必填           | 说明                            |
| --------------- | -------------- | ------------------------------- |
| `BILI_SESSDATA` | 发送弹幕时必填 | B站登录 Cookie 中的 SESSDATA 值 |
| `BILI_CSRF`     | 发送弹幕时必填 | B站登录 Cookie 中的 bili_jct 值 |
| `SERVER_PORT`   | 否             | API 服务器端口，默认 30081      |

### 3.6 纯命令行运行

项目支持直接运行 `Server/index.js` 启动 API 服务器：

```bash
npm run server
```

该模式无需 Electron，适合服务器部署或自动化脚本使用。启动后会监听 `SERVER_PORT` 端口（默认 30081），提供 HTTP RESTful API 服务。

---

## 4. 内部 API（B站接口）

### 4.1 弹幕服务器信息

- **URL**: `https://api.live.bilibili.com/room/v1/Danmu/getConf?room_id={roomId}`
- **用途**: 获取弹幕服务器地址、端口、token 等信息

### 4.2 房间信息

- **URL**: `https://api.live.bilibili.com/room/v1/Room/get_info?room_id={roomId}`
- **用途**: 获取真实房间号、直播状态、人气值等

### 4.3 Wbi 签名密钥

- **URL**: `https://api.bilibili.com/x/web-interface/nav`
- **用途**: 获取 Wbi 签名所需的 img_key 和 sub_key

### 4.4 弹幕发送

- **URL**: `https://api.live.bilibili.com/msg/send`
- **方法**: POST
- **参数**:
  - `roomid`: 房间号
  - `msg`: 弹幕内容
  - `color`: 弹幕颜色（16777215 = 白色）
  - `fontsize`: 字体大小（25 = 标准）
  - `mode`: 弹幕模式（1 = 滚动）
  - `rnd`: 当前时间戳
  - `csrf_token`: CSRF token
  - `csrf`: CSRF token
- **Cookie**: `SESSDATA={sessdata}`
