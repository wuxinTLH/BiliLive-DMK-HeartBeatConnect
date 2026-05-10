# BiliLive DMK HeartBeatConnect API 文档

## 概述

本文档描述了前端（渲染进程）与后端（主进程/Node.js）之间的通信接口。通信基于 Electron 的 `ipcRenderer` 和 `ipcMain` 模块。

**基础路径/命名空间**: `bili:` (定义在 `Server/events.js` 中)

---

## 1. 控制接口

用于控制连接的建立与断开。

### 1.1 连接直播间

请求前端主动发起连接。

- **Channel**: `bili:connect`
- **方向**: Renderer -> Main
- **参数**:
  - `roomId` (String | Number): B站直播间号（支持短号或长号）。
- **示例**:
  ```javascript
  ipcRenderer.send("bili:connect", "6");
  ```
- **后端行为**:
  1.  验证房间号格式。
  2.  获取 `buvid3` 和 `Wbi` 签名密钥。
  3.  请求弹幕服务器信息。
  4.  建立 WebSocket 连接并进行鉴权。
- **触发事件**:
  - `bili:status`: 状态更新为“已连接”或“已断开”。
  - `bili:error`: 如果连接过程出错。

### 1.2 断开连接

请求前端主动断开当前连接。

- **Channel**: `bili:disconnect`
- **方向**: Renderer -> Main
- **参数**: 无
- **示例**:
  ```javascript
  ipcRenderer.send("bili:disconnect");
  ```
- **后端行为**:
  1.  停止心跳包。
  2.  关闭 WebSocket 连接。
  3.  清理定时器。
- **触发事件**:
  - `bili:status`: 状态更新为“已断开”。

---

## 2. 状态与数据推送接口

后端主动向前端推送的消息。前端需要使用 `ipcRenderer.on` 监听这些事件。

### 2.1 连接状态更新

当连接状态发生改变时推送。

- **Channel**: `bili:status`
- **方向**: Main -> Renderer
- **数据格式**:
  - `status` (String): 状态描述。例如：`"已连接"`, `"已断开"`。
- **示例**:
  ```javascript
  ipcRenderer.on("bili:status", (event, status) => {
    console.log("当前状态:", status);
    if (status === "已连接") {
      // UI 更新：启用断开按钮，禁用输入框
    }
  });
  ```

### 2.2 在线人气值

定期或变化时推送直播间人气值。

- **Channel**: `bili:online`
- **方向**: Main -> Renderer
- **数据格式**:
  ```typescript
  {
    count: number; // 人气值
  }
  ```
- **示例**:
  ```javascript
  ipcRenderer.on("bili:online", (event, data) => {
    document.getElementById("online-count").innerText = data.count;
  });
  ```

### 2.3 错误通知

当发生任何错误（如网络错误、鉴权失败、API 请求失败）时推送。

- **Channel**: `bili:error`
- **方向**: Main -> Renderer
- **数据格式**:
  ```typescript
  {
    message: string; // 错误信息
  }
  ```
- **示例**:
  ```javascript
  ipcRenderer.on("bili:error", (event, err) => {
    alert(`发生错误: ${err.message}`);
  });
  ```

---

## 3. 消息事件推送

后端解析到具体的直播间消息时推送。

### 3.1 弹幕消息

- **Channel**: `bili:danmaku`
- **数据格式**:
  ```typescript
  {
      uname: string,   // 发送者昵称
      message: string  // 弹幕内容
  }
  ```
- **监听示例**:
  ```javascript
  ipcRenderer.on("bili:danmaku", (event, data) => {
    addLog(`${data.uname}: ${data.message}`);
  });
  ```

### 3.2 礼物消息

包含普通礼物和连击礼物 (`COMBO_SEND`)。

- **Channel**: `bili:gift`
- **数据格式**:
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

### 3.3 舰长购买

- **Channel**: `bili:guard`
- **数据格式**:
  ```typescript
  {
      uname: string,      // 用户昵称
      guardLevel: number, // 等级: 1-总督, 2-提督, 3-舰长
      num: number,        // 购买数量
      price: number       // 价格
  }
  ```

### 3.4 醒目留言 (Super Chat)

- **Channel**: `bili:superchat`
- **数据格式**:
  ```typescript
  {
      uname: string,   // 用户昵称
      message: string, // SC 内容
      price: number    // 价格 (RMB)
  }
  ```

### 3.5 直播状态变更

#### 3.5.1 开播

- **Channel**: `bili:liveStart`
- **数据**: 无 (仅事件触发)

#### 3.5.2 下播

- **Channel**: `bili:liveEnd`
- **数据**: 无 (仅事件触发)

---

## 4. 前端集成示例

以下是一个完整的 Vue/React 风格的伪代码示例，展示如何在组件中初始化监听和清理监听。

```javascript
const { ipcRenderer } = require("electron");

class LiveRoomClient {
  constructor() {
    this.listeners = {};
  }

  // 初始化监听
  init() {
    // 1. 监听状态
    ipcRenderer.on("bili:status", (e, status) => {
      this.updateStatus(status);
    });

    // 2. 监听弹幕
    ipcRenderer.on("bili:danmaku", (e, { uname, message }) => {
      this.appendMessage("danmaku", `${uname}: ${message}`);
    });

    // 3. 监听礼物
    ipcRenderer.on("bili:gift", (e, { uname, giftName, num }) => {
      this.appendMessage("gift", `${uname} 送出 ${giftName} x${num}`);
    });

    // 4. 监听 SC
    ipcRenderer.on("bili:superchat", (e, { uname, message, price }) => {
      this.appendMessage("sc", `¥${price} ${uname}: ${message}`);
    });

    // ... 其他事件监听
  }

  // 连接
  connect(roomId) {
    ipcRenderer.send("bili:connect", roomId);
  }

  // 断开
  disconnect() {
    ipcRenderer.send("bili:disconnect");
  }

  // 清理（组件卸载时调用，防止内存泄漏）
  destroy() {
    ipcRenderer.removeAllListeners("bili:status");
    ipcRenderer.removeAllListeners("bili:danmaku");
    ipcRenderer.removeAllListeners("bili:gift");
    // ...
  }

  // UI 更新逻辑
  updateStatus(status) {
    console.log("Status changed:", status);
  }

  appendMessage(type, text) {
    console.log(`[${type}] ${text}`);
  }
}

// 使用
const client = new LiveRoomClient();
client.init();
client.connect(6);

// 页面关闭时
// window.onbeforeunload = () => client.destroy();
```
