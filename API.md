# BiliLive DMK HeartBeatConnect — API 参考文档

> 本文档描述项目对外提供的全部接口，包括 HTTP RESTful API、Electron IPC 事件接口以及 BilibiliConnector Node.js SDK。

---

## 目录

- [通用说明](#通用说明)
- [一、HTTP RESTful API](#一http-restful-api)
  - [1.1 服务配置](#11-服务配置)
  - [1.2 统一响应格式](#12-统一响应格式)
  - [1.3 错误码说明](#13-错误码说明)
  - [POST /api/connect — 连接直播间](#post-apiconnect--连接直播间)
  - [POST /api/disconnect — 断开连接](#post-apidisconnect--断开连接)
  - [POST /api/send — 发送弹幕](#post-apisend--发送弹幕)
  - [GET /api/status — 查询连接状态](#get-apistatus--查询连接状态)
- [二、Electron IPC API](#二electron-ipc-api)
  - [2.1 控制接口（Renderer → Main）](#21-控制接口renderer--main)
  - [2.2 数据推送接口（Main → Renderer）](#22-数据推送接口main--renderer)
- [三、BilibiliConnector SDK](#三bilibiliconnector-sdk)
  - [3.1 实例方法](#31-实例方法)
  - [3.2 事件列表](#32-事件列表)
  - [3.3 环境变量](#33-环境变量)
- [四、B 站内部接口参考](#四b-站内部接口参考)

---

## 通用说明

- **Base URL**：`http://localhost:{SERVER_PORT}`（默认端口 `30081`，可通过 `.env` 配置）
- **数据格式**：请求与响应均使用 `application/json`
- **字符编码**：UTF-8
- **跨域支持**：已启用 CORS，`Access-Control-Allow-Origin: *`
- **认证**：当前版本无需 Token 认证，建议在内网或本机环境使用

---

## 一、HTTP RESTful API

### 1.1 服务配置

| 配置项             | 说明             | 默认值                 |
| ------------------ | ---------------- | ---------------------- |
| `SERVER_PORT`      | API 服务监听端口 | `30081`                |
| 启动方式（GUI）    | `npm start`      | 随 Electron 主进程启动 |
| 启动方式（纯后端） | `npm run server` | 仅启动 API，无 GUI     |

### 1.2 统一响应格式

**成功响应**

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "message": "操作描述",
  "roomId": "1945098"
}
```

**失败响应**

```json
HTTP/1.1 4xx / 5xx
Content-Type: application/json

{
  "error": "错误原因描述"
}
```

### 1.3 错误码说明

| HTTP 状态码 | 含义                                   |
| ----------- | -------------------------------------- |
| `200`       | 操作成功                               |
| `400`       | 请求参数缺失或格式错误                 |
| `404`       | 指定房间连接不存在                     |
| `500`       | 服务器内部错误（如 B 站 API 调用失败） |

---

### POST /api/connect — 连接直播间

建立与指定 B 站直播间的 WebSocket 弹幕连接。

**请求**

```
POST /api/connect
Content-Type: application/json
```

**请求体参数**

| 字段     | 类型               | 必填 | 说明                                 |
| -------- | ------------------ | ---- | ------------------------------------ |
| `roomId` | `string \| number` | ✅   | B 站直播间房间号（短号或真实号均可） |

**请求示例**

```json
{
  "roomId": "1945098"
}
```

**成功响应** `200 OK`

```json
{
  "message": "连接成功",
  "roomId": "1945098"
}
```

**失败响应**

```json
// 400 — 缺少参数
{
  "error": "缺少 roomId 参数"
}
```

**代码示例**

```js
// JavaScript (fetch)
const res = await fetch("http://localhost:30081/api/connect", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ roomId: "1945098" }),
});
const data = await res.json();
console.log(data); // { message: '连接成功', roomId: '1945098' }
```

```python
# Python (requests)
import requests
resp = requests.post('http://localhost:30081/api/connect', json={'roomId': '1945098'})
print(resp.json())
```

---

### POST /api/disconnect — 断开连接

断开指定直播间的 WebSocket 连接并释放资源。

**请求**

```
POST /api/disconnect
Content-Type: application/json
```

**请求体参数**

| 字段     | 类型               | 必填 | 说明                 |
| -------- | ------------------ | ---- | -------------------- |
| `roomId` | `string \| number` | ✅   | 要断开的直播间房间号 |

**请求示例**

```json
{
  "roomId": "1945098"
}
```

**成功响应** `200 OK`

```json
{
  "message": "已断开连接",
  "roomId": "1945098"
}
```

**失败响应**

```json
// 404 — 房间连接不存在
{
  "error": "未找到该房间的连接"
}
```

**代码示例**

```js
const res = await fetch("http://localhost:30081/api/disconnect", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ roomId: "1945098" }),
});
const data = await res.json();
console.log(data);
```

---

### POST /api/send — 发送弹幕

向指定直播间发送一条弹幕消息。

> ⚠️ **前置条件**：需在 `.env` 中配置有效的 `BILI_SESSDATA` 和 `BILI_CSRF`，且对应账号已登录 B 站。

**请求**

```
POST /api/send
Content-Type: application/json
```

**请求体参数**

| 字段      | 类型               | 必填 | 说明                                          |
| --------- | ------------------ | ---- | --------------------------------------------- |
| `roomId`  | `string \| number` | ✅   | 目标直播间房间号                              |
| `message` | `string`           | ✅   | 弹幕内容（建议 ≤ 20 字，超长可能被 B 站截断） |

**请求示例**

```json
{
  "roomId": "1945098",
  "message": "你好，主播！"
}
```

**成功响应** `200 OK`

```json
{
  "success": true,
  "message": "发送成功"
}
```

**失败响应**

```json
// 404 — 房间连接不存在
{
  "error": "未找到该房间的连接"
}

// 500 — 发送失败（如 Cookie 过期、风控拦截）
{
  "error": "发送失败：鉴权信息无效"
}
```

**代码示例**

```js
const res = await fetch("http://localhost:30081/api/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ roomId: "1945098", message: "你好，主播！" }),
});
const data = await res.json();
console.log(data); // { success: true, message: '发送成功' }
```

```python
resp = requests.post('http://localhost:30081/api/send', json={
  'roomId': '1945098',
  'message': '你好，主播！'
})
print(resp.json())
```

---

### GET /api/status — 查询连接状态

返回当前所有已管理直播间的连接状态。

**请求**

```
GET /api/status
```

**请求参数**：无

**成功响应** `200 OK`

```json
{
  "connections": {
    "1945098": true,
    "123456": false
  }
}
```

**字段说明**

| 字段          | 类型     | 说明                                                        |
| ------------- | -------- | ----------------------------------------------------------- |
| `connections` | `object` | Key 为房间号，Value 为 `true`（已连接）或 `false`（已断开） |

**代码示例**

```js
const res = await fetch("http://localhost:30081/api/status");
const data = await res.json();
// data.connections => { '1945098': true, '123456': false }
```

```python
resp = requests.get('http://localhost:30081/api/status')
print(resp.json())
```

---

## 二、Electron IPC API

前端渲染进程与 Electron 主进程通过 IPC（进程间通信）交互，所有事件名定义于 `Server/events.js`，统一使用 `bili:` 前缀。

### 2.1 控制接口（Renderer → Main）

渲染进程发送指令，主进程执行对应操作。

---

#### `bili:connect` — 连接直播间

```js
// 渲染进程
ipcRenderer.send("bili:connect", "1945098");
```

| 参数     | 类型               | 说明             |
| -------- | ------------------ | ---------------- |
| `roomId` | `string \| number` | 要连接的直播间号 |

---

#### `bili:disconnect` — 断开连接

```js
ipcRenderer.send("bili:disconnect", "1945098");
```

| 参数     | 类型               | 说明             |
| -------- | ------------------ | ---------------- |
| `roomId` | `string \| number` | 要断开的直播间号 |

---

#### `bili:sendDanmaku` — 发送弹幕

```js
ipcRenderer.send("bili:sendDanmaku", { roomId: "1945098", message: "你好" });
```

| 参数字段  | 类型               | 说明         |
| --------- | ------------------ | ------------ |
| `roomId`  | `string \| number` | 目标直播间号 |
| `message` | `string`           | 弹幕内容     |

---

### 2.2 数据推送接口（Main → Renderer）

主进程主动向渲染进程推送状态变更与实时数据，渲染进程使用 `ipcRenderer.on` 监听。

---

#### `bili:status` — 连接状态更新

```js
ipcRenderer.on("bili:status", (event, status) => {
  // status: string，如 "已连接" / "已断开" / "连接中..."
  console.log("状态：", status);
});
```

| 回调参数 | 类型     | 说明             |
| -------- | -------- | ---------------- |
| `status` | `string` | 当前连接状态描述 |

---

#### `bili:authSuccess` — 鉴权成功

```js
ipcRenderer.on("bili:authSuccess", (event, data) => {
  console.log(`鉴权成功 — UID: ${data.uid}，房间: ${data.roomId}`);
});
```

| 回调字段 | 类型     | 说明             |
| -------- | -------- | ---------------- |
| `uid`    | `number` | 已连接账号的 UID |
| `roomId` | `number` | 真实房间号       |

---

#### `bili:online` — 在线人气值更新

```js
ipcRenderer.on("bili:online", (event, data) => {
  document.querySelector("#online").textContent = data.count;
});
```

| 回调字段 | 类型     | 说明           |
| -------- | -------- | -------------- |
| `count`  | `number` | 当前在线人气值 |

---

#### `bili:error` — 错误通知

```js
ipcRenderer.on("bili:error", (event, err) => {
  console.error("发生错误：", err.message);
});
```

| 回调字段  | 类型     | 说明         |
| --------- | -------- | ------------ |
| `message` | `string` | 错误描述信息 |

---

#### `bili:danmakuSent` — 弹幕发送结果回调

```js
ipcRenderer.on("bili:danmakuSent", (event, data) => {
  if (data.success) {
    console.log("弹幕发送成功");
  } else {
    console.warn("弹幕发送失败：", data.message);
  }
});
```

| 回调字段  | 类型      | 说明             |
| --------- | --------- | ---------------- |
| `success` | `boolean` | 是否发送成功     |
| `message` | `string`  | 成功或失败的描述 |

---

#### `bili:danmaku` — 弹幕消息

```js
ipcRenderer.on("bili:danmaku", (event, data) => {
  console.log(`[弹幕] ${data.uname}（${data.uid}）：${data.message}`);
});
```

| 回调字段  | 类型     | 说明       |
| --------- | -------- | ---------- |
| `uname`   | `string` | 发送者昵称 |
| `uid`     | `number` | 发送者 UID |
| `message` | `string` | 弹幕内容   |

---

#### `bili:gift` — 礼物消息

```js
ipcRenderer.on("bili:gift", (event, data) => {
  console.log(`[礼物] ${data.uname} 送出 ${data.giftName} x${data.num}`);
});
```

| 回调字段    | 类型     | 说明                                            |
| ----------- | -------- | ----------------------------------------------- |
| `uname`     | `string` | 赠送者昵称                                      |
| `giftName`  | `string` | 礼物名称                                        |
| `giftId`    | `number` | 礼物 ID                                         |
| `num`       | `number` | 礼物数量                                        |
| `coinType`  | `string` | 货币类型（`"gold"` 金瓜子 / `"silver"` 银瓜子） |
| `totalCoin` | `number` | 总价值（金瓜子数）                              |

---

#### `bili:guard` — 舰长购买

```js
ipcRenderer.on("bili:guard", (event, data) => {
  const levels = { 1: "总督", 2: "提督", 3: "舰长" };
  console.log(
    `[舰长] ${data.uname} 购买了 ${levels[data.guardLevel]} x${data.num}`,
  );
});
```

| 回调字段     | 类型     | 说明                                 |
| ------------ | -------- | ------------------------------------ |
| `uname`      | `string` | 用户昵称                             |
| `guardLevel` | `number` | 等级：`1` 总督 / `2` 提督 / `3` 舰长 |
| `num`        | `number` | 购买数量（月数）                     |
| `price`      | `number` | 单价（金瓜子）                       |

---

#### `bili:superchat` — 醒目留言（Super Chat）

```js
ipcRenderer.on("bili:superchat", (event, data) => {
  console.log(`[SC ¥${data.price}] ${data.uname}：${data.message}`);
});
```

| 回调字段  | 类型     | 说明             |
| --------- | -------- | ---------------- |
| `uname`   | `string` | 用户昵称         |
| `message` | `string` | SC 消息内容      |
| `price`   | `number` | 金额（人民币元） |

---

#### `bili:liveStart` — 主播开播

```js
ipcRenderer.on("bili:liveStart", () => {
  console.log("主播开播了！");
});
```

无回调数据，事件触发即代表开播。

---

#### `bili:liveEnd` — 主播下播

```js
ipcRenderer.on("bili:liveEnd", () => {
  console.log("主播下播了");
});
```

无回调数据，事件触发即代表下播。

---

## 三、BilibiliConnector SDK

`BilibiliConnector` 继承自 Node.js `EventEmitter`，可脱离 Electron 在纯 Node.js 环境中独立使用。

**引入方式**

```js
const BilibiliConnector = require("./Server/index");
const connector = new BilibiliConnector();
```

### 3.1 实例方法

---

#### `connect(roomId)` — 连接直播间

| 参数     | 类型               | 必填 | 说明         |
| -------- | ------------------ | ---- | ------------ |
| `roomId` | `string \| number` | ✅   | B 站直播间号 |

**返回值**：`Promise<void>`

```js
await connector.connect("1945098");
```

---

#### `disconnect()` — 断开连接

| 参数 | 类型 | 说明 |
| ---- | ---- | ---- |
| 无   | —    | —    |

**返回值**：`void`

```js
connector.disconnect();
```

---

#### `sendDanmaku(message)` — 发送弹幕

> 需配置 `BILI_SESSDATA` 和 `BILI_CSRF` 环境变量。

| 参数      | 类型     | 必填 | 说明     |
| --------- | -------- | ---- | -------- |
| `message` | `string` | ✅   | 弹幕内容 |

**返回值**：`Promise<{ success: boolean, message: string }>`

```js
const result = await connector.sendDanmaku("你好！");
console.log(result); // { success: true, message: '你好！' }
```

---

#### `isConnected()` — 查询连接状态

| 参数 | 类型 | 说明 |
| ---- | ---- | ---- |
| 无   | —    | —    |

**返回值**：`boolean`

```js
if (connector.isConnected()) {
  console.log("当前已连接");
}
```

---

### 3.2 事件列表

通过 `connector.on(event, callback)` 监听以下事件：

| 事件名         | 回调参数                                                | 触发时机               |
| -------------- | ------------------------------------------------------- | ---------------------- |
| `connected`    | 无                                                      | WebSocket 连接成功建立 |
| `authSuccess`  | `{ uid: number, roomId: number }`                       | B 站弹幕服务器鉴权成功 |
| `disconnected` | 无                                                      | 连接断开（主动或被动） |
| `error`        | `{ message: string }`                                   | 发生错误               |
| `danmaku`      | `{ uname: string, uid: number, message: string }`       | 收到弹幕               |
| `gift`         | `{ uname, giftName, giftId, num, coinType, totalCoin }` | 收到礼物               |
| `guard`        | `{ uname, guardLevel, num, price }`                     | 有人购买舰长/提督/总督 |
| `superchat`    | `{ uname, message, price }`                             | 收到醒目留言           |
| `online`       | `{ count: number }`                                     | 人气值更新             |
| `liveStart`    | 无                                                      | 主播开播               |
| `liveEnd`      | 无                                                      | 主播下播               |

**完整使用示例**

```js
const BilibiliConnector = require("./Server/index");
const connector = new BilibiliConnector();

connector.on("connected", () => console.log("✅ 已连接"));
connector.on("authSuccess", ({ uid, roomId }) =>
  console.log(`🔐 鉴权成功 — UID: ${uid}，房间: ${roomId}`),
);
connector.on("danmaku", ({ uname, uid, message }) =>
  console.log(`💬 ${uname}（${uid}）：${message}`),
);
connector.on("gift", ({ uname, giftName, num, coinType, totalCoin }) =>
  console.log(
    `🎁 ${uname} 送出 ${giftName} x${num}（${totalCoin} ${coinType}）`,
  ),
);
connector.on("guard", ({ uname, guardLevel, num, price }) => {
  const map = { 1: "总督", 2: "提督", 3: "舰长" };
  console.log(`⚓ ${uname} 购买 ${map[guardLevel]} x${num}，价格 ${price}`);
});
connector.on("superchat", ({ uname, message, price }) =>
  console.log(`💛 [SC ¥${price}] ${uname}：${message}`),
);
connector.on("online", ({ count }) => console.log(`👥 当前人气：${count}`));
connector.on("liveStart", () => console.log("🔴 开播"));
connector.on("liveEnd", () => console.log("⚫ 下播"));
connector.on("error", ({ message }) => console.error("❌", message));
connector.on("disconnected", () => console.log("🔌 连接已断开"));

connector.connect("1945098");
```

---

### 3.3 环境变量

| 变量名          | 必填           | 默认值  | 说明                        |
| --------------- | -------------- | ------- | --------------------------- |
| `BILI_SESSDATA` | 发送弹幕时必填 | 无      | B 站 Cookie 中的 `SESSDATA` |
| `BILI_CSRF`     | 发送弹幕时必填 | 无      | B 站 Cookie 中的 `bili_jct` |
| `SERVER_PORT`   | 否             | `30081` | HTTP API 服务监听端口       |

---

## 四、B 站内部接口参考

以下为本项目内部调用的 B 站官方 API，仅供参考，开发者无需直接调用。

---

### 获取弹幕服务器信息

```
GET https://api.live.bilibili.com/room/v1/Danmu/getConf?room_id={roomId}
```

返回弹幕 WebSocket 服务器地址、端口与鉴权 Token，用于建立弹幕连接。

---

### 获取直播间信息

```
GET https://api.live.bilibili.com/room/v1/Room/get_info?room_id={roomId}
```

返回真实房间号、直播标题、主播信息、当前直播状态与人气值。

---

### 获取 WBI 签名密钥

```
GET https://api.bilibili.com/x/web-interface/nav
```

返回 WBI 签名所需的 `img_key` 和 `sub_key`，用于构造合法的 API 请求签名。

---

### 发送弹幕

```
POST https://api.live.bilibili.com/msg/send
Cookie: SESSDATA={sessdata}
Content-Type: application/x-www-form-urlencoded
```

**请求参数**

| 参数         | 类型     | 说明                        |
| ------------ | -------- | --------------------------- |
| `roomid`     | `number` | 真实房间号                  |
| `msg`        | `string` | 弹幕内容                    |
| `color`      | `number` | 弹幕颜色，白色为 `16777215` |
| `fontsize`   | `number` | 字体大小，标准为 `25`       |
| `mode`       | `number` | 弹幕模式，滚动为 `1`        |
| `rnd`        | `number` | 当前时间戳（秒）            |
| `csrf_token` | `string` | `bili_jct` 的值             |
| `csrf`       | `string` | 同 `csrf_token`             |
