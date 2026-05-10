const { EventEmitter } = require("events");
const WebSocket = require("ws");
const https = require("https");
const zlib = require("zlib");
const crypto = require("crypto");
const logger = require("./utils/logger");
const EVENTS = require("./events");

// ─── Wbi 签名表 ───────────────────────────────────────
const MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
    26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
    20, 34, 44, 52,
];

// ─── WS 协议常量 ──────────────────────────────────────
const HDR = 16;
const O_HB = 2; // OP: heartbeat
const O_HBR = 3; // OP: heartbeat reply
const O_MSG = 5; // OP: message
const O_AUTH = 7; // OP: auth
const O_AUTHR = 8; // OP: auth reply
const V_PLAIN = 0;
const V_INT = 1; // 心跳/鉴权用
const V_ZLIB = 2;
const V_BR = 3; // brotli（保留解析）

// ─── 缓存 ─────────────────────────────────────────────
let _buvid3 = "";
let _buvid3Ts = 0;
let _wbiKeys = null;
let _wbiTs = 0;
let _uid = 0; // 缓存真实 UID
const H6 = 6 * 3600e3,
    H1 = 3600e3;

// ─────────────────────────────────────────────────────
class BilibiliConnector extends EventEmitter {
    constructor() {
        super();
        this._ws = null;
        this._roomId = null; // 真实房间号
        this._inputRoomId = null; // 用户输入的房间号
        this._running = false;
        this._hbTimer = null;
        this._retryTimer = null;
        this._msgN = 0;
    }

    // ══ 公开 ══
    async connect(roomInput) {
        if (this._running) this.disconnect();
        const rid = String(roomInput).trim();
        if (!/^\d+$/.test(rid)) {
            this.emit("error", { message: "请输入数字直播间号" });
            return;
        }
        this._inputRoomId = parseInt(rid);
        logger.info(`[BILI] 连接直播间: ${rid}`);

        // 1. buvid3
        let buvid3 = "";
        try {
            buvid3 = await this._getBuvid3();
        } catch (e) {
            const rand = () => crypto.randomBytes(4).toString("hex");
            buvid3 = `${rand()}-${rand()}-${rand()}`;
            logger.warn(`[BILI] buvid3 获取失败，生成随机值: ${buvid3}`);
        }
        _buvid3 = buvid3;
        _buvid3Ts = Date.now();
        logger.info(`[BILI] buvid3: ${buvid3.slice(0, 12)}...`);

        // 2. 获取真实 UID
        let uid = 0;
        try {
            const keys = await this._getWbiKeys();
            uid = keys.uid || 0;
            if (uid) logger.info(`[BILI] 登录 UID: ${uid}`);
            else logger.info(`[BILI] 游客身份连接`);
        } catch (e) {
            logger.warn(`[BILI] 获取UID失败(${e.message})，将以游客身份连接`);
        }

        // 3. getDanmuInfo
        let danmu;
        try {
            danmu = await this._getDanmuInfo(rid, buvid3);
            logger.info(
                `[BILI] 服务器: ${danmu.host}:${danmu.wssPort} (真实房间号: ${danmu.realRoomId})`,
            );
        } catch (e) {
            logger.error(`[BILI] getDanmuInfo 失败: ${e.message}`);
            this.emit("error", { message: e.message });
            return;
        }

        this._roomId = danmu.realRoomId;
        this._running = true;
        this._msgN = 0;
        this._doConnect(
            `wss://${danmu.host}:${danmu.wssPort}/sub`,
            danmu.realRoomId,
            buvid3,
            danmu.token,
            0,
            uid,
        );
    }

    disconnect() {
        this._running = false;
        clearInterval(this._hbTimer);
        clearTimeout(this._retryTimer);
        this._hbTimer = null;
        this._retryTimer = null;
        if (this._ws) {
            try {
                this._ws.terminate();
            } catch { }
            this._ws = null;
        }
        this._roomId = null;
        logger.info("[BILI] 已断开");
    }

    isConnected() {
        return this._running && this._ws?.readyState === WebSocket.OPEN;
    }

    getRoomId() {
        return this._roomId;
    }

    async sendDanmaku(message) {
        if (!this.isConnected()) {
            throw new Error("未连接到直播间");
        }
        const sess = (process.env.BILI_SESSDATA || "").trim();
        if (!sess) {
            throw new Error("未配置 SESSDATA，无法发送弹幕");
        }
        let csrf = (process.env.BILI_CSRF || "").trim();
        if (!csrf) {
            csrf = this._extractCSRF(sess);
        }
        if (!csrf || csrf.length < 5) {
            throw new Error("CSRF token 无效，请在 .env 文件中配置 BILI_CSRF（浏览器 Cookie 中的 bili_jct 值）");
        }
        if (!message || !message.trim()) {
            throw new Error("弹幕内容不能为空");
        }
        return this._sendDanmakuAPI(this._roomId, message.trim(), sess, csrf);
    }

    _extractCSRF(sess) {
        try {
            const decoded = decodeURIComponent(sess);
            const parts = decoded.split(",");
            if (parts.length >= 3) {
                const hashPart = parts[2];
                const starIdx = hashPart.indexOf("*");
                if (starIdx !== -1) {
                    return hashPart.substring(starIdx + 1);
                }
            }
        } catch { }
        return "";
    }

    _sendDanmakuAPI(roomId, msg, sess, csrf) {
        return new Promise((res, rej) => {
            const postData = new URLSearchParams({
                roomid: roomId,
                msg: msg,
                color: "16777215",
                fontsize: "25",
                mode: "1",
                rnd: String(Math.floor(Date.now() / 1000)),
                csrf_token: csrf,
                csrf: csrf,
            }).toString();
            const u = new URL("https://api.live.bilibili.com/msg/send");
            const req = https.request(
                {
                    hostname: u.hostname,
                    port: 443,
                    path: u.pathname,
                    method: "POST",
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Content-Length": Buffer.byteLength(postData),
                        Cookie: `SESSDATA=${sess}`,
                        Referer: `https://live.bilibili.com/${roomId}`,
                        Origin: "https://live.bilibili.com",
                    },
                },
                (r) => {
                    let d = "";
                    r.on("data", (c) => (d += c));
                    r.on("end", () => {
                        try {
                            const j = JSON.parse(d);
                            if (j.code === 0) {
                                logger.info(`[BILI] 弹幕发送成功: ${msg}`);
                                res({ success: true, message: msg });
                            } else {
                                rej(new Error(`发送失败: ${j.message || "未知错误"} (code=${j.code})`));
                            }
                        } catch {
                            rej(new Error(`响应解析失败: ${d.slice(0, 100)}`));
                        }
                    });
                },
            );
            req.on("error", rej);
            req.setTimeout(10000, () => {
                req.destroy();
                rej(new Error("发送超时"));
            });
            req.write(postData);
            req.end();
        });
    }

    // ══ 内部 ══
    _doConnect(wssUrl, realRoomId, buvid3, token, retry, uid) {
        this._uid = uid;
        this._currentRoomId = realRoomId;
        logger.info(`[BILI] WS 连接中 (retry=${retry})`);
        const ws = new WebSocket(wssUrl, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Origin: "https://live.bilibili.com",
                Referer: "https://live.bilibili.com/",
            },
        });
        this._ws = ws;
        ws.on("open", () => {
            logger.info("[BILI] WS 已连接，发送鉴权包");
            const auth = JSON.stringify({
                uid: uid,
                roomid: realRoomId,
                protover: 2,
                platform: "web",
                type: 2,
                key: token,
                buvid: buvid3,
            });
            this._pktSend(O_AUTH, V_INT, auth);
        });

        ws.on("message", async (data) => {
            try {
                await this._parse(Buffer.from(data));
            } catch (e) {
                logger.error(`[BILI] 解析错误: ${e.message}`);
            }
        });

        ws.on("close", (code) => {
            clearInterval(this._hbTimer);
            this._hbTimer = null;
            logger.warn(`[BILI] WS 断开 code=${code}`);
            this.emit("disconnected");
            if (this._running) {
                this._retryTimer = setTimeout(
                    async () => {
                        if (!this._running) return;
                        try {
                            const bv = await this._getBuvid3().catch(async () => {
                                const rand = () => crypto.randomBytes(4).toString("hex");
                                return `${rand()}-${rand()}-${rand()}`;
                            });
                            _buvid3 = bv;
                            _buvid3Ts = Date.now();
                            let newUid = 0;
                            try {
                                const keys = await this._getWbiKeys();
                                newUid = keys.uid || 0;
                            } catch { }
                            const dm = await this._getDanmuInfo(
                                String(this._inputRoomId),
                                bv,
                            );
                            this._roomId = dm.realRoomId;
                            this._doConnect(
                                `wss://${dm.host}:${dm.wssPort}/sub`,
                                dm.realRoomId,
                                bv,
                                dm.token,
                                retry + 1,
                                newUid,
                            );
                        } catch (err) {
                            logger.error(`[BILI] 重连获取信息失败: ${err.message}`);
                            this._doConnect(
                                wssUrl,
                                realRoomId,
                                buvid3,
                                token,
                                retry + 1,
                                uid,
                            );
                        }
                    },
                    Math.min(5000 + retry * 2000, 30000),
                );
            }
        });

        ws.on("error", (e) => {
            logger.error("[BILI] WS 错误:", e.message);
            this.emit("error", { message: e.message });
        });
    }

    _pktSend(op, ver, body = "") {
        const b = typeof body === "string" ? Buffer.from(body, "utf-8") : body;
        const buf = Buffer.alloc(HDR + b.length);
        buf.writeUInt32BE(HDR + b.length, 0);
        buf.writeUInt16BE(HDR, 4);
        buf.writeUInt16BE(ver, 6);
        buf.writeUInt32BE(op, 8);
        buf.writeUInt32BE(1, 12);
        b.copy(buf, HDR);
        if (this._ws?.readyState === WebSocket.OPEN) this._ws.send(buf);
    }

    _startHB() {
        clearInterval(this._hbTimer);
        const send = () => this._pktSend(O_HB, V_INT, "");
        this._hbTimer = setInterval(send, 30000);
        send();
    }

    async _parse(buf, depth = 0) {
        if (buf.length < HDR) return;
        let off = 0;
        while (off < buf.length) {
            if (off + HDR > buf.length) break;
            const total = buf.readUInt32BE(off);
            const hlen = buf.readUInt16BE(off + 4);
            const ver = buf.readUInt16BE(off + 6);
            const op = buf.readUInt32BE(off + 8);
            if (total < HDR || total > 10 * 1024 * 1024) {
                logger.warn(`[BILI] 非法包 total=${total}`);
                break;
            }
            const body = buf.slice(off + hlen, off + total);
            off += total;

            if (depth === 0) {
                this._msgN++;
                // 调试日志可以适当减少，避免刷屏
                // if (this._msgN <= 30) logger.info(`[BILI-PKT] #${this._msgN} op=${op} ver=${ver}`);
            }

            if (op === O_AUTHR) {
                let code = -1;
                try {
                    code = JSON.parse(body.toString()).code;
                } catch { }
                if (code === 0) {
                    logger.info("[BILI] 鉴权成功 ✓");
                    this._startHB();
                    this.emit("connected");
                    this.emit("authSuccess", { uid: this._uid, roomId: this._currentRoomId });
                } else {
                    logger.error(`[BILI] 鉴权失败 code=${code}`);
                    this.emit("error", { message: `鉴权失败 code=${code}` });
                    this._ws?.close();
                }
            } else if (op === O_HBR) {
                // 心跳回包
            } else if (op === O_MSG) {
                if (ver === V_ZLIB) {
                    try {
                        const dec = await new Promise((res, rej) =>
                            zlib.inflate(body, (e, r) => (e ? rej(e) : res(r))),
                        );
                        if (depth < 5) await this._parse(dec, depth + 1);
                    } catch {
                        try {
                            const dec = await new Promise((res, rej) =>
                                zlib.inflateRaw(body, (e, r) => (e ? rej(e) : res(r))),
                            );
                            if (depth < 5) await this._parse(dec, depth + 1);
                        } catch (e2) {
                            logger.warn(`[BILI] zlib 解压失败: ${e2.message}`);
                        }
                    }
                } else if (ver === V_BR) {
                    try {
                        const dec = await new Promise((res, rej) =>
                            zlib.brotliDecompress(body, (e, r) => (e ? rej(e) : res(r))),
                        );
                        if (depth < 5) await this._parse(dec, depth + 1);
                    } catch (e) {
                        logger.warn(`[BILI] brotli 解压失败: ${e.message}`);
                    }
                } else {
                    try {
                        const str = body.toString("utf-8");
                        const parsed = JSON.parse(str);
                        const cmd = parsed.cmd || "";
                        this._dispatch(parsed);
                    } catch (e) {
                        // logger.warn(`[BILI] JSON 解析失败: ${e.message}`);
                    }
                }
            }
        }
    }

    _dispatch(msg) {
        const cmd = msg.cmd || "";
        const ROOM_EVENTS = new Set([
            "DANMU_MSG",
            "SEND_GIFT",
            "COMBO_SEND",
            "GUARD_BUY",
            "SUPER_CHAT_MESSAGE",
            "SUPER_CHAT_MESSAGE_DELETE",
            "ONLINE_RANK_COUNT",
            "WATCHED_CHANGE",
            "LIVE",
            "PREPARING",
            "ROOM_CHANGE",
            "INTERACT_WORD",
            "ENTRY_EFFECT",
            "LIKE_INFO_V3_CLICK",
            "LIKE_INFO_V3_UPDATE",
        ]);
        if (!ROOM_EVENTS.has(cmd)) return;

        const dataRoomId = msg.data?.room_id || msg.data?.roomid;
        if (dataRoomId && this._roomId && dataRoomId !== this._roomId) return;

        switch (cmd) {
            case "DANMU_MSG": {
                try {
                    const info = msg.info;
                    const uname = info[2][1];
                    const message = info[1];
                    this.emit("danmaku", { uname, message });
                } catch (e) {
                    logger.warn(`[BILI] DANMU_MSG 解析错误: ${e.message}`);
                }
                break;
            }
            case "SEND_GIFT":
            case "COMBO_SEND": {
                try {
                    const d = msg.data;
                    this.emit("gift", {
                        uname: d.uname,
                        giftName: d.giftName,
                        giftId: d.giftId,
                        num: d.num,
                        coinType: d.coin_type,
                        totalCoin: d.total_coin,
                    });
                } catch { }
                break;
            }
            case "GUARD_BUY": {
                try {
                    const d = msg.data;
                    const N = { 1: "总督", 2: "提督", 3: "舰长" };
                    this.emit("guard", {
                        uname: d.username,
                        guardLevel: d.guard_level,
                        num: d.num,
                        price: d.price,
                    });
                } catch { }
                break;
            }
            case "SUPER_CHAT_MESSAGE": {
                try {
                    const d = msg.data;
                    this.emit("superchat", {
                        uname: d.user_info?.uname,
                        message: d.message,
                        price: d.price,
                    });
                } catch { }
                break;
            }
            case "ONLINE_RANK_COUNT":
                this.emit("online", { count: msg.data?.count || 0 });
                break;
            case "LIVE":
                this.emit("liveStart");
                break;
            case "PREPARING":
                this.emit("liveEnd");
                break;
        }
    }

    // ══ buvid3 ══
    async _getBuvid3() {
        const now = Date.now();
        if (_buvid3 && now - _buvid3Ts < H6) return _buvid3;
        const env = (process.env.BILI_BUVID3 || "").trim();
        if (env) {
            _buvid3 = env;
            _buvid3Ts = now;
            return env;
        }
        try {
            const b = await this._buvid3FromHome();
            _buvid3 = b;
            _buvid3Ts = Date.now();
            return b;
        } catch (e) {
            logger.warn(`[BILI] buvid3 方案A 失败: ${e.message}`);
        }
        const b = await this._buvid3FromSpi();
        _buvid3 = b;
        _buvid3Ts = Date.now();
        return b;
    }

    _buvid3FromHome() {
        return new Promise((res, rej) => {
            const req = https.request(
                {
                    hostname: "www.bilibili.com",
                    port: 443,
                    path: "/",
                    method: "GET",
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                        Accept: "text/html,application/xhtml+xml",
                        "Accept-Language": "zh-CN,zh;q=0.9",
                        "Accept-Encoding": "identity",
                    },
                },
                (r) => {
                    const cookies = r.headers["set-cookie"] || [];
                    r.destroy();
                    for (const c of cookies) {
                        const m = c.match(/buvid3=([^;]+)/);
                        if (m) {
                            res(m[1]);
                            return;
                        }
                    }
                    rej(new Error(`未找到 buvid3`));
                },
            );
            req.on("error", rej);
            req.setTimeout(10000, () => {
                req.destroy();
                rej(new Error("超时"));
            });
            req.end();
        });
    }

    _buvid3FromSpi() {
        return this._getJSON("https://api.bilibili.com/x/frontend/finger/spi").then(
            (j) => {
                if (j.code !== 0) throw new Error(`spi code=${j.code}`);
                const b = j.data?.b_3;
                if (!b) throw new Error("b_3 为空");
                return b;
            },
        );
    }

    // ══ Wbi 签名 ══
    async _getWbiKeys() {
        const now = Date.now();
        if (_wbiKeys && now - _wbiTs < H1) return { ..._wbiKeys, uid: _uid };
        const sess = (process.env.BILI_SESSDATA || "").trim();
        const cookieParts = [];
        if (sess) cookieParts.push(`SESSDATA=${sess}`);
        if (_buvid3) cookieParts.push(`buvid3=${_buvid3}`);
        const hdrs = cookieParts.length ? { Cookie: cookieParts.join("; ") } : {};
        const j = await this._getJSON(
            "https://api.bilibili.com/x/web-interface/nav",
            hdrs,
        );
        if (j.code !== 0 && j.code !== -101) throw new Error(`nav code=${j.code}`);
        _uid = j.data?.mid || 0;
        const wbi = j.data?.wbi_img || {};
        const ik = (wbi.img_url || "")
            .split("/")
            .pop()
            .replace(/\.\w+$/, "");
        const sk = (wbi.sub_url || "")
            .split("/")
            .pop()
            .replace(/\.\w+$/, "");
        if (!ik || ik.length < 8) throw new Error(`img_key 无效: ${ik}`);
        _wbiKeys = { ik, sk };
        _wbiTs = Date.now();
        logger.info(`[BILI] Wbi keys: ${ik.slice(0, 8)}... uid: ${_uid}`);
        return { ik, sk, uid: _uid };
    }

    _mixinKey(ik, sk) {
        const r = ik + sk;
        return MIXIN_KEY_ENC_TAB.map((n) => r[n])
            .join("")
            .slice(0, 32);
    }

    _wbiSign(params, mk) {
        const wts = Math.round(Date.now() / 1000);
        const all = { ...params, wts };
        const qs = Object.keys(all)
            .sort()
            .map(
                (k) =>
                    `${encodeURIComponent(k)}=${encodeURIComponent(String(all[k]).replace(/[!'()*]/g, ""))}`,
            )
            .join("&");
        const wrid = crypto
            .createHash("md5")
            .update(qs + mk)
            .digest("hex");
        return `${qs}&w_rid=${wrid}`;
    }

    // ══ getDanmuInfo ══
    async _getDanmuInfo(roomId, buvid3) {
        let qs;
        try {
            const { ik, sk } = await this._getWbiKeys();
            qs = this._wbiSign(
                { id: roomId, type: 0, web_location: "444.8" },
                this._mixinKey(ik, sk),
            );
        } catch (e) {
            logger.warn(`[BILI] Wbi 签名失败(${e.message})，尝试无签名`);
            qs = `id=${roomId}&type=0`;
        }
        const sess = (process.env.BILI_SESSDATA || "").trim();
        const cookieParts = [];
        if (buvid3) cookieParts.push(`buvid3=${buvid3}`);
        if (sess) cookieParts.push(`SESSDATA=${sess}`);
        const hdrs = cookieParts.length ? { Cookie: cookieParts.join("; ") } : {};
        const j = await this._getJSON(
            `https://api.live.bilibili.com/xlive/web-room/v1/index/getDanmuInfo?${qs}`,
            hdrs,
        );
        if (j.code !== 0) throw new Error(`code=${j.code} msg=${j.message}`);
        const realRoomId = j.data?.room_id || parseInt(roomId);
        const h = (j.data?.host_list || [])[0] || {
            host: "broadcastlv.chat.bilibili.com",
            wss_port: 2245,
        };
        return {
            token: j.data.token,
            host: h.host,
            wssPort: h.wss_port,
            realRoomId: realRoomId,
        };
    }

    // ══ 工具 ══
    _getJSON(url, extraHdrs = {}) {
        return new Promise((res, rej) => {
            const u = new URL(url);
            https
                .get(
                    {
                        hostname: u.hostname,
                        port: 443,
                        path: u.pathname + u.search,
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                            Referer: "https://live.bilibili.com/",
                            Origin: "https://live.bilibili.com",
                            ...extraHdrs,
                        },
                    },
                    (r) => {
                        let d = "";
                        r.on("data", (c) => (d += c));
                        r.on("end", () => {
                            try {
                                res(JSON.parse(d));
                            } catch {
                                rej(new Error(`JSON 失败: ${d.slice(0, 100)}`));
                            }
                        });
                    },
                )
                .on("error", rej)
                .setTimeout(10000, function () {
                    this.destroy();
                    rej(new Error(`超时: ${url}`));
                });
        });
    }
}

module.exports = BilibiliConnector;

if (require.main === module) {
    const http = require('http');
    const fs = require('fs');
    const path = require('path');

    // 加载 .env 文件
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx > 0) {
                    const key = trimmed.substring(0, eqIdx).trim();
                    let val = trimmed.substring(eqIdx + 1).trim();
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.substring(1, val.length - 1);
                    }
                    if (!process.env[key]) {
                        process.env[key] = val;
                    }
                }
            }
        });
    }

    const PORT = parseInt(process.env.SERVER_PORT || '30081', 10);
    const connectors = new Map();

    const server = http.createServer((req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const url = new URL(req.url, `http://localhost:${PORT}`);

        if (url.pathname === '/api/connect' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { roomId } = JSON.parse(body);
                    if (!roomId) {
                        res.writeHead(400);
                        res.end(JSON.stringify({ error: '缺少 roomId 参数' }));
                        return;
                    }
                    if (connectors.has(String(roomId))) {
                        res.writeHead(200);
                        res.end(JSON.stringify({ message: '已连接该房间', roomId }));
                        return;
                    }
                    const connector = new BilibiliConnector();
                    connectors.set(String(roomId), connector);

                    connector.on('danmaku', data => console.log(`[弹幕] ${data.uname}: ${data.message}`));
                    connector.on('gift', data => console.log(`[礼物] ${data.uname} 送出 ${data.giftName} x${data.num}`));
                    connector.on('guard', data => console.log(`[舰长] ${data.uname} 购买了 ${data.guardLevel} 级舰长`));
                    connector.on('superchat', data => console.log(`[SC] ¥${data.price} ${data.uname}: ${data.message}`));
                    connector.on('error', err => console.error(`[错误] ${err.message}`));

                    connector.connect(roomId).then(() => {
                        res.writeHead(200);
                        res.end(JSON.stringify({ message: '连接成功', roomId }));
                    }).catch(err => {
                        res.writeHead(500);
                        res.end(JSON.stringify({ error: err.message }));
                    });
                } catch (e) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: '请求格式错误' }));
                }
            });
        } else if (url.pathname === '/api/disconnect' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { roomId } = JSON.parse(body);
                    const connector = connectors.get(String(roomId));
                    if (!connector) {
                        res.writeHead(404);
                        res.end(JSON.stringify({ error: '未找到该房间的连接' }));
                        return;
                    }
                    connector.disconnect();
                    connectors.delete(String(roomId));
                    res.writeHead(200);
                    res.end(JSON.stringify({ message: '已断开连接', roomId }));
                } catch (e) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: '请求格式错误' }));
                }
            });
        } else if (url.pathname === '/api/send' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { roomId, message } = JSON.parse(body);
                    const connector = connectors.get(String(roomId));
                    if (!connector) {
                        res.writeHead(404);
                        res.end(JSON.stringify({ error: '未找到该房间的连接' }));
                        return;
                    }
                    connector.sendDanmaku(message).then(result => {
                        res.writeHead(200);
                        res.end(JSON.stringify(result));
                    }).catch(err => {
                        res.writeHead(500);
                        res.end(JSON.stringify({ error: err.message }));
                    });
                } catch (e) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: '请求格式错误' }));
                }
            });
        } else if (url.pathname === '/api/status' && req.method === 'GET') {
            const status = {};
            connectors.forEach((connector, roomId) => {
                status[roomId] = connector.isConnected();
            });
            res.writeHead(200);
            res.end(JSON.stringify({ connections: status }));
        } else {
            res.writeHead(404);
            res.end(JSON.stringify({ error: '未找到该接口' }));
        }
    });

    server.listen(PORT, () => {
        console.log(`[Server] API 服务器已启动，监听端口 ${PORT}`);
        console.log(`[Server] 可用接口:`);
        console.log(`  POST /api/connect    - 连接直播间 (body: { "roomId": "1945098" })`);
        console.log(`  POST /api/disconnect - 断开连接 (body: { "roomId": "1945098" })`);
        console.log(`  POST /api/send       - 发送弹幕 (body: { "roomId": "1945098", "message": "你好" })`);
        console.log(`  GET  /api/status     - 查看连接状态`);
    });

    process.on('SIGINT', () => {
        console.log('\n正在关闭服务器...');
        connectors.forEach(connector => connector.disconnect());
        server.close(() => process.exit(0));
    });
}
