/**
 * sync.js — 用 GitHub 仓库本身作为免费云端存储
 * 通过 GitHub Contents API 读写仓库里的 data/shows.json、data/cities.json 和 photos/ 目录。
 * 令牌只保存在本机浏览器 localStorage，不会经过任何第三方服务器。
 */

const SYNC_CONFIG_KEY = "gh_sync_config_v1";
const SYNC_STATE_KEY = "gh_sync_state_v1";
const API_BASE = "https://api.github.com";

const GitHubSync = {

  loadConfig() {
    try {
      const raw = localStorage.getItem(SYNC_CONFIG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  saveConfig(cfg) {
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(cfg));
  },

  clearConfig() {
    localStorage.removeItem(SYNC_CONFIG_KEY);
    localStorage.removeItem(SYNC_STATE_KEY);
  },

  loadState() {
    try {
      const raw = localStorage.getItem(SYNC_STATE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  },

  saveState(state) {
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
  },

  // ---------- 底层请求 ----------

  async request(cfg, method, path, body) {
    const url = `${API_BASE}/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return res;
  },

  async getFile(cfg, path) {
    const res = await this.request(cfg, "GET", `${path}?ref=${encodeURIComponent(cfg.branch || "main")}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`读取 ${path} 失败（${res.status}）：${await this.errText(res)}`);
    const data = await res.json();
    return { sha: data.sha, content: data.content };
  },

  async putFile(cfg, path, base64Content, message) {
    const existing = await this.getFile(cfg, path).catch(() => null);
    const body = {
      message,
      content: base64Content,
      branch: cfg.branch || "main"
    };
    if (existing) body.sha = existing.sha;
    const res = await this.request(cfg, "PUT", path, body);
    if (!res.ok) throw new Error(`写入 ${path} 失败（${res.status}）：${await this.errText(res)}`);
    return res.json();
  },

  async errText(res) {
    try {
      const j = await res.json();
      return j.message || res.statusText;
    } catch (e) {
      return res.statusText;
    }
  },

  // ---------- 编码工具 ----------

  utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return btoa(binary);
  },

  base64ToUtf8(b64) {
    const clean = b64.replace(/\n/g, "");
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  },

  async shortHash(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 12);
  },

  // ---------- 推送 ----------

  /**
   * 把本机 IndexedDB 里的全部演出记录 + 城市信息推送到 GitHub 仓库。
   * onProgress(message) 用于实时展示进度日志。
   */
  async pushAll(cfg, onProgress) {
    const log = onProgress || (() => {});
    const shows = await DB.getAllShows();

    // 1. 冲突提示：如果云端 shows.json 比我们上次同步的版本更新，提醒用户
    log("检查云端是否有更新的数据…");
    const remote = await this.getFile(cfg, "data/shows.json");
    if (remote) {
      const remoteJson = JSON.parse(this.base64ToUtf8(remote.content));
      const state = this.loadState();
      if (remoteJson.updatedAt && state.lastPulledUpdatedAt && remoteJson.updatedAt !== state.lastPulledUpdatedAt) {
        const proceed = confirm(
          "云端的数据看起来比你上次同步时更新（可能是在别的设备上改过）。\n继续推送会用这台设备的数据覆盖云端，确定要继续吗？"
        );
        if (!proceed) { log("已取消推送。"); return; }
      }
    }

    // 2. 上传尚未同步的照片（本地是 data: 开头的 base64，上传后替换成仓库内相对路径）
    let uploaded = 0;
    let totalPhotos = 0;
    shows.forEach((s) => { totalPhotos += (s.photos || []).filter((p) => p.startsWith("data:")).length; });

    for (const show of shows) {
      if (!show.photos || !show.photos.length) continue;
      for (let i = 0; i < show.photos.length; i++) {
        const photo = show.photos[i];
        if (!photo.startsWith("data:")) continue; // 已经同步过，是相对路径
        uploaded++;
        log(`正在上传照片 ${uploaded}/${totalPhotos}…`);
        const commaIdx = photo.indexOf(",");
        const base64Body = photo.slice(commaIdx + 1);
        const hash = await this.shortHash(base64Body.slice(0, 200) + show.id + i);
        const path = `photos/${show.id}/${hash}.jpg`;
        await this.putFile(cfg, path, base64Body, `添加照片：${show.name}`);
        show.photos[i] = path; // 替换为相对路径
      }
      await DB.saveShow(show); // 同步保存回本地，避免重复上传，也节省本机存储空间
    }

    // 3. 推送 shows.json / cities.json
    log("正在写入演出记录数据…");
    const now = Date.now();
    const showsPayload = { updatedAt: now, shows };
    await this.putFile(
      cfg,
      "data/shows.json",
      this.utf8ToBase64(JSON.stringify(showsPayload, null, 2)),
      `更新演出记录（${new Date(now).toLocaleString("zh-CN")}）`
    );

    log("正在写入城市信息…");
    const cities = [];
    const cityNames = new Set(shows.map((s) => (s.city || "").trim()).filter(Boolean));
    for (const city of cityNames) {
      const meta = await DB.getCityMeta(city);
      if (meta) cities.push(meta);
    }
    const citiesPayload = { updatedAt: now, cities };
    await this.putFile(
      cfg,
      "data/cities.json",
      this.utf8ToBase64(JSON.stringify(citiesPayload, null, 2)),
      `更新城市信息（${new Date(now).toLocaleString("zh-CN")}）`
    );

    const state = this.loadState();
    state.lastPulledUpdatedAt = now;
    state.lastSyncedAt = now;
    this.saveState(state);

    log(`推送完成 ✓（共 ${shows.length} 条记录，${uploaded} 张新照片）`);
    return { shows: shows.length, photos: uploaded };
  },

  // ---------- 拉取 ----------

  /**
   * 从 GitHub 仓库拉取 shows.json / cities.json，覆盖本机 IndexedDB。
   */
  async pullAll(cfg, onProgress) {
    const log = onProgress || (() => {});

    log("正在读取云端数据…");
    const remoteShows = await this.getFile(cfg, "data/shows.json");
    if (!remoteShows) {
      throw new Error("云端还没有 data/shows.json，请先在某台设备上推送一次。");
    }
    const showsPayload = JSON.parse(this.base64ToUtf8(remoteShows.content));
    const remoteCities = await this.getFile(cfg, "data/cities.json");
    const citiesPayload = remoteCities ? JSON.parse(this.base64ToUtf8(remoteCities.content)) : { cities: [] };

    log(`云端共有 ${showsPayload.shows.length} 条记录，正在写入本机…`);

    // 覆盖本机 shows：先清空再逐条写入
    const localShows = await DB.getAllShows();
    for (const s of localShows) await DB.deleteShow(s.id);
    for (const s of showsPayload.shows) await DB.saveShow(s);

    for (const c of citiesPayload.cities || []) await DB.saveCityMeta(c);

    const state = this.loadState();
    state.lastPulledUpdatedAt = showsPayload.updatedAt;
    state.lastSyncedAt = Date.now();
    this.saveState(state);

    log(`拉取完成 ✓（共 ${showsPayload.shows.length} 条记录）。照片图片需要在部署好的 GitHub Pages 网址下才能正常显示。`);
    return { shows: showsPayload.shows.length };
  }
};
