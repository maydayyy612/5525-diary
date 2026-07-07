/**
 * app.js — 5525-DIARY 主逻辑
 */

(function () {
  "use strict";

  let shows = [];               // 全部演出记录（内存缓存，来源于 IndexedDB）
  let formSetlist = [];         // 编辑表单中的歌单
  let formPhotos = [];          // 编辑表单中的照片（base64 数组）
  let editingId = null;         // 当前编辑中的记录 id，新增时为 null
  let currentView = "home";
  let searchFilter = "all";

  // ---------- 工具函数 ----------

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d)) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}.${m}.${day}`;
  }

  function sortedShows(list) {
    return list.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }

  // ---------- 开屏 ----------

  function initSplash() {
    const splash = $("#splash");
    const dismiss = () => {
      if (splash.classList.contains("hide")) return;
      splash.classList.add("hide");
      setTimeout(() => {
        splash.hidden = true;
        $("#app").hidden = false;
      }, 650);
    };
    splash.addEventListener("click", dismiss);
    splash.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") dismiss();
    });
    splash.tabIndex = 0;
    splash.focus();
  }

  // ---------- 视图切换 ----------

  const VIEW_TITLES = { home: "首页", wall: "照片墙", map: "人生地图", search: "搜索" };

  function switchView(view) {
    currentView = view;
    $all(".view").forEach((el) => { el.hidden = el.id !== `view-${view}`; });
    $all(".nav-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === view));
    $("#topbar-title").textContent = VIEW_TITLES[view] || "";
    if (view === "map") renderMap();
    if (view === "wall") renderPhotoWall();
    if (view === "search") $("#search-input").focus();
  }

  function initNav() {
    $all(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.dataset.view));
    });
    $("#btn-search-icon").addEventListener("click", () => switchView("search"));
    $("#btn-add").addEventListener("click", () => openRecordForm(null));
    $("#btn-sync-icon").addEventListener("click", () => openSyncModal());
  }

  // ---------- 弹层通用 ----------

  function openModal(id) {
    const modal = document.getElementById(id);
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add("show"));
    document.body.style.overflow = "hidden";
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove("show");
    document.body.style.overflow = "";
    setTimeout(() => { modal.hidden = true; }, 220);
  }

  function initModals() {
    $all("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.close));
    });
    $all(".modal").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal(modal.id);
      });
    });
  }

  // ---------- 票根卡片渲染 ----------

  function renderRatingHtml(rating, size) {
    const total = 5;
    const filled = Math.max(0, Math.min(total, rating || 0));
    if (!filled) return "";
    let html = `<div class="rating ${size || ""}">`;
    for (let i = 0; i < total; i++) {
      html += `<span class="punch ${i < filled ? "filled" : ""}"></span>`;
    }
    html += "</div>";
    return html;
  }

  function ticketCardHtml(show) {
    const photoCount = (show.photos || []).length;
    const coverPhoto = photoCount ? show.photos[0] : null;
    return `
      <article class="ticket" data-id="${show.id}" tabindex="0">
        ${coverPhoto ? `<div class="ticket-cover" style="background-image:url('${coverPhoto}')"></div>` : ""}
        <div class="ticket-body">
          <div class="ticket-top">
            <span class="ticket-date">${formatDate(show.date)}</span>
            <span class="stamp">5525</span>
          </div>
          <h3 class="ticket-name">${escapeHtml(show.name)}</h3>
          <p class="ticket-venue">${escapeHtml(show.city || "")}${show.venue ? " · " + escapeHtml(show.venue) : ""}</p>
          <div class="perforation"></div>
          <div class="ticket-meta-row">
            ${renderRatingHtml(show.rating, "sm")}
            <span class="ticket-tags">
              ${show.price != null && show.price !== "" ? `<span class="price">¥${escapeHtml(show.price)}</span>` : ""}
              ${photoCount ? `<span class="photo-count">🖼 ${photoCount}</span>` : ""}
            </span>
          </div>
        </div>
      </article>
    `;
  }

  function attachTicketClicks(container) {
    container.addEventListener("click", (e) => {
      const card = e.target.closest(".ticket");
      if (!card) return;
      openDetail(card.dataset.id);
    });
    container.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const card = e.target.closest(".ticket");
      if (!card) return;
      openDetail(card.dataset.id);
    });
  }

  // ---------- 首页时间轴 ----------

  function renderTimeline() {
    const list = sortedShows(shows);
    const container = $("#timeline");
    container.innerHTML = list.map(ticketCardHtml).join("");
    $("#home-empty").hidden = list.length !== 0;
  }

  // ---------- 详情 ----------

  function openDetail(id) {
    const show = shows.find((s) => s.id === id);
    if (!show) return;
    const body = $("#detail-body");
    const photosHtml = (show.photos || [])
      .map((p) => `<img src="${p}" alt="${escapeHtml(show.name)} 现场照片" class="detail-photo">`)
      .join("");
    const setlistHtml = (show.setlist || [])
      .map((s, i) => `<li>${i + 1}. ${escapeHtml(s)}</li>`)
      .join("");

    body.innerHTML = `
      <div class="detail-hero">
        <span class="detail-date">${formatDate(show.date)}</span>
        <h2 class="detail-name">${escapeHtml(show.name)}</h2>
        <p class="detail-venue">${escapeHtml(show.city || "")}${show.venue ? " · " + escapeHtml(show.venue) : ""}</p>
        ${renderRatingHtml(show.rating, "")}
      </div>
      <dl class="detail-facts">
        ${show.price != null && show.price !== "" ? `<div><dt>票价</dt><dd>¥${escapeHtml(show.price)}</dd></div>` : ""}
        ${show.seat ? `<div><dt>座位</dt><dd>${escapeHtml(show.seat)}</dd></div>` : ""}
      </dl>
      ${show.notes ? `<div class="detail-block"><h4>演出记忆点</h4><p class="detail-notes">${escapeHtml(show.notes)}</p></div>` : ""}
      ${setlistHtml ? `<div class="detail-block"><h4>歌单 / 设置单（${show.setlist.length}）</h4><ol class="detail-setlist">${setlistHtml}</ol></div>` : ""}
      ${photosHtml ? `<div class="detail-block"><h4>演出照片</h4><div class="detail-photos">${photosHtml}</div></div>` : ""}
    `;

    $("#btn-edit-record").onclick = () => {
      closeModal("modal-detail");
      setTimeout(() => openRecordForm(show), 240);
    };

    openModal("modal-detail");
  }

  // ---------- 新增 / 编辑 表单 ----------

  function renderFormSetlist() {
    const ol = $("#f-setlist");
    ol.innerHTML = formSetlist
      .map(
        (song, i) => `
        <li>
          <span>${i + 1}. ${escapeHtml(song)}</span>
          <button type="button" class="chip-remove" data-i="${i}" aria-label="删除">✕</button>
        </li>`
      )
      .join("");
    ol.querySelectorAll(".chip-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        formSetlist.splice(Number(btn.dataset.i), 1);
        renderFormSetlist();
      });
    });
  }

  function renderFormPhotoPreview() {
    const wrap = $("#f-photo-preview");
    wrap.innerHTML = formPhotos
      .map(
        (p, i) => `
        <div class="preview-thumb" style="background-image:url('${p}')">
          <button type="button" class="thumb-remove" data-i="${i}" aria-label="删除照片">✕</button>
        </div>`
      )
      .join("");
    wrap.querySelectorAll(".thumb-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        formPhotos.splice(Number(btn.dataset.i), 1);
        renderFormPhotoPreview();
      });
    });
  }

  function setFormRating(value) {
    const ratingEl = $("#f-rating");
    ratingEl.dataset.value = value;
    $all(".punch", ratingEl).forEach((el) => {
      el.classList.toggle("filled", Number(el.dataset.v) <= value);
    });
  }

  function openRecordForm(show) {
    editingId = show ? show.id : null;
    $("#record-modal-title").textContent = show ? "编辑演出" : "新增演出";
    $("#btn-delete-record").hidden = !show;
    $("#f-id").value = show ? show.id : "";
    $("#f-name").value = show ? show.name || "" : "";
    $("#f-date").value = show ? show.date || "" : "";
    $("#f-price").value = show && show.price != null ? show.price : "";
    $("#f-city").value = show ? show.city || "" : "";
    $("#f-venue").value = show ? show.venue || "" : "";
    $("#f-seat").value = show ? show.seat || "" : "";
    $("#f-notes").value = show ? show.notes || "" : "";
    $("#f-photos").value = "";
    formSetlist = show && show.setlist ? show.setlist.slice() : [];
    formPhotos = show && show.photos ? show.photos.slice() : [];
    renderFormSetlist();
    renderFormPhotoPreview();
    setFormRating(show ? show.rating || 0 : 0);
    openModal("modal-record");
  }

  function initRecordForm() {
    $("#f-rating").addEventListener("click", (e) => {
      const punch = e.target.closest(".punch");
      if (!punch) return;
      const current = Number($("#f-rating").dataset.value);
      const v = Number(punch.dataset.v);
      setFormRating(v === current ? 0 : v);
    });

    const addSong = () => {
      const input = $("#f-song-input");
      const val = input.value.trim();
      if (!val) return;
      formSetlist.push(val);
      input.value = "";
      renderFormSetlist();
      input.focus();
    };
    $("#btn-add-song").addEventListener("click", addSong);
    $("#f-song-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addSong(); }
    });

    $("#f-photos").addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        try {
          const dataUrl = await compressImageFile(file);
          formPhotos.push(dataUrl);
        } catch (err) {
          console.error("图片处理失败", err);
        }
      }
      renderFormPhotoPreview();
      e.target.value = "";
    });

    $("#btn-save-record").addEventListener("click", async () => {
      const name = $("#f-name").value.trim();
      const date = $("#f-date").value;
      const city = $("#f-city").value.trim();
      if (!name || !date || !city) {
        alert("请填写演出名称、时间和城市 —— 这三项是必填的。");
        return;
      }
      const show = {
        id: editingId || makeId(),
        name,
        date,
        price: $("#f-price").value === "" ? null : Number($("#f-price").value),
        city,
        venue: $("#f-venue").value.trim(),
        seat: $("#f-seat").value.trim(),
        rating: Number($("#f-rating").dataset.value) || 0,
        setlist: formSetlist.slice(),
        notes: $("#f-notes").value.trim(),
        photos: formPhotos.slice(),
        createdAt: editingId
          ? (shows.find((s) => s.id === editingId) || {}).createdAt || Date.now()
          : Date.now()
      };
      await DB.saveShow(show);
      await ensureCityMeta(city);
      await reloadShows();
      closeModal("modal-record");
      renderCurrentView();
    });

    $("#btn-delete-record").addEventListener("click", async () => {
      if (!editingId) return;
      if (!confirm("确定要删除这场演出记录吗？此操作无法撤销。")) return;
      await DB.deleteShow(editingId);
      await reloadShows();
      closeModal("modal-record");
      renderCurrentView();
    });
  }

  // ---------- 照片墙 ----------

  function renderPhotoWall() {
    const items = [];
    sortedShows(shows).forEach((show) => {
      (show.photos || []).forEach((photo) => {
        items.push({ photo, show });
      });
    });
    const wall = $("#photo-wall");
    wall.innerHTML = items
      .map(
        (item) => `
        <button class="wall-tile" style="background-image:url('${item.photo}')" data-id="${item.show.id}" aria-label="${escapeHtml(item.show.name)}">
          <span class="wall-tile-tag">${formatDate(item.show.date)} · ${escapeHtml(item.show.city || "")}</span>
        </button>`
      )
      .join("");
    $("#wall-empty").hidden = items.length !== 0;
    wall.querySelectorAll(".wall-tile").forEach((tile) => {
      tile.addEventListener("click", () => openDetail(tile.dataset.id));
    });
  }

  // ---------- 人生地图 ----------

  async function ensureCityMeta(city) {
    if (!city) return;
    const existing = await DB.getCityMeta(city);
    if (existing) return;
    await DB.saveCityMeta({ city, transport: "", distance: null });
  }

  function uniqueCities() {
    const set = new Set();
    shows.forEach((s) => { if (s.city) set.add(s.city.trim()); });
    return Array.from(set);
  }

  async function renderMap() {
    const cities = uniqueCities();
    const svg = $("#china-map");
    let dotsHtml = "";
    cities.forEach((city) => {
      const coord = getCityCoord(city);
      if (!coord) return;
      const [x, y] = project(coord[0], coord[1]);
      dotsHtml += `
        <g class="city-dot" data-city="${escapeHtml(city)}" tabindex="0">
          <circle cx="${x}" cy="${y}" r="10" class="dot-glow"></circle>
          <circle cx="${x}" cy="${y}" r="4.2" class="dot-core"></circle>
        </g>`;
    });

    svg.innerHTML = `
      <defs>
        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="blur"></feGaussianBlur>
          <feMerge>
            <feMergeNode in="blur"></feMergeNode>
            <feMergeNode in="SourceGraphic"></feMergeNode>
          </feMerge>
        </filter>
      </defs>
      <path d="${CHINA_OUTLINE_PATH}" class="map-outline"></path>
      <ellipse cx="${HAINAN.cx}" cy="${HAINAN.cy}" rx="${HAINAN.rx}" ry="${HAINAN.ry}" class="map-outline"></ellipse>
      <ellipse cx="${TAIWAN.cx}" cy="${TAIWAN.cy}" rx="${TAIWAN.rx}" ry="${TAIWAN.ry}" class="map-outline"></ellipse>
      <g filter="url(#glow)">${dotsHtml}</g>
    `;

    svg.querySelectorAll(".city-dot").forEach((dot) => {
      dot.addEventListener("click", () => openCityModal(dot.dataset.city));
      dot.addEventListener("keydown", (e) => {
        if (e.key === "Enter") openCityModal(dot.dataset.city);
      });
    });

    await renderCityList(cities);
  }

  async function renderCityList(cities) {
    const ul = $("#city-list");
    const rows = await Promise.all(
      cities.map(async (city) => {
        const meta = (await DB.getCityMeta(city)) || {};
        const auto = distanceFromBeijing(city);
        const distance = meta.distance != null ? meta.distance : auto;
        const count = shows.filter((s) => (s.city || "").trim() === city).length;
        return { city, transport: meta.transport || "", distance, count };
      })
    );
    rows.sort((a, b) => a.city.localeCompare(b.city, "zh"));
    ul.innerHTML = rows
      .map(
        (r) => `
        <li class="city-row" data-city="${escapeHtml(r.city)}" tabindex="0">
          <span class="city-row-name">${escapeHtml(r.city)}<span class="city-row-count">× ${r.count}</span></span>
          <span class="city-row-meta">
            ${r.transport ? escapeHtml(r.transport) : "点击设置交通方式"}
            ${r.distance != null ? ` · 距北京 ${r.distance} 公里` : ""}
          </span>
        </li>`
      )
      .join("");
    ul.querySelectorAll(".city-row").forEach((row) => {
      row.addEventListener("click", () => openCityModal(row.dataset.city));
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter") openCityModal(row.dataset.city);
      });
    });
  }

  async function openCityModal(city) {
    const meta = (await DB.getCityMeta(city)) || { city, transport: "", distance: null };
    const auto = distanceFromBeijing(city);
    $("#city-modal-title").textContent = city;
    $("#c-name").value = city;
    $("#c-transport").value = meta.transport || "";
    $("#c-distance").value = meta.distance != null ? meta.distance : (auto != null ? auto : "");
    $("#c-auto-distance").textContent =
      auto != null ? `直线距离自动计算约 ${auto} 公里，你可以手动修改为实际交通距离。` : "该城市暂未收录经纬度，无法自动计算距离，可手动填写。";
    openModal("modal-city");
  }

  function initCityModal() {
    $("#btn-save-city").addEventListener("click", async () => {
      const city = $("#c-name").value;
      const transport = $("#c-transport").value.trim();
      const distanceVal = $("#c-distance").value;
      await DB.saveCityMeta({
        city,
        transport,
        distance: distanceVal === "" ? null : Number(distanceVal)
      });
      closeModal("modal-city");
      renderMap();
    });
  }

  // ---------- 搜索 / 筛选 ----------

  function initSearch() {
    $all(".search-filter .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        searchFilter = chip.dataset.filter;
        $all(".search-filter .chip").forEach((c) => c.classList.toggle("active", c === chip));
        renderSearch();
      });
    });
    $("#search-input").addEventListener("input", renderSearch);
  }

  function renderSearch() {
    const q = $("#search-input").value.trim().toLowerCase();
    let list = sortedShows(shows);
    if (q) {
      list = list.filter((s) => {
        if (searchFilter === "song") {
          return (s.setlist || []).some((song) => song.toLowerCase().includes(q));
        }
        if (searchFilter === "city") {
          return (s.city || "").toLowerCase().includes(q);
        }
        const haystack = [s.name, s.city, s.venue, s.notes, ...(s.setlist || [])]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }
    const container = $("#search-results");
    container.innerHTML = list.map(ticketCardHtml).join("");
    $("#search-empty").hidden = list.length !== 0 || q === "";
  }

  // ---------- 数据加载 ----------

  async function reloadShows() {
    shows = await DB.getAllShows();
  }

  function renderCurrentView() {
    renderTimeline();
    if (currentView === "wall") renderPhotoWall();
    if (currentView === "map") renderMap();
    if (currentView === "search") renderSearch();
  }

  // ---------- 云同步 ----------

  function currentSyncConfig() {
    return {
      owner: $("#s-owner").value.trim(),
      repo: $("#s-repo").value.trim(),
      branch: $("#s-branch").value.trim() || "main",
      token: $("#s-token").value.trim()
    };
  }

  function syncLog(msg) {
    const el = $("#sync-log");
    el.textContent += (el.textContent ? "\n" : "") + msg;
    el.scrollTop = el.scrollHeight;
  }

  function updateSyncStatusText() {
    const state = GitHubSync.loadState();
    $("#sync-status").textContent = state.lastSyncedAt
      ? `上次同步：${new Date(state.lastSyncedAt).toLocaleString("zh-CN")}`
      : "尚未同步过。";
  }

  function openSyncModal() {
    const cfg = GitHubSync.loadConfig();
    if (cfg) {
      $("#s-owner").value = cfg.owner || "";
      $("#s-repo").value = cfg.repo || "";
      $("#s-branch").value = cfg.branch || "main";
      $("#s-token").value = cfg.token || "";
    }
    $("#sync-log").textContent = "";
    updateSyncStatusText();
    openModal("modal-sync");
  }

  function initSyncModal() {
    $("#btn-toggle-token").addEventListener("click", () => {
      const input = $("#s-token");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      $("#btn-toggle-token").textContent = show ? "隐藏" : "显示";
    });

    $("#btn-save-sync-config").addEventListener("click", () => {
      const cfg = currentSyncConfig();
      if (!cfg.owner || !cfg.repo || !cfg.token) {
        alert("请完整填写 GitHub 用户名、仓库名和令牌。");
        return;
      }
      GitHubSync.saveConfig(cfg);
      syncLog("设置已保存在本机浏览器。");
    });

    $("#btn-clear-sync-config").addEventListener("click", () => {
      if (!confirm("确定要清除本机保存的令牌和同步设置吗？")) return;
      GitHubSync.clearConfig();
      $("#s-owner").value = "";
      $("#s-repo").value = "";
      $("#s-token").value = "";
      $("#s-branch").value = "main";
      syncLog("已清除本机令牌与同步设置。");
      updateSyncStatusText();
    });

    $("#btn-sync-push").addEventListener("click", async () => {
      const cfg = currentSyncConfig();
      if (!cfg.owner || !cfg.repo || !cfg.token) {
        alert("请先填写并保存 GitHub 设置。");
        return;
      }
      GitHubSync.saveConfig(cfg);
      $("#btn-sync-push").disabled = true;
      $("#btn-sync-pull").disabled = true;
      try {
        await GitHubSync.pushAll(cfg, syncLog);
        updateSyncStatusText();
      } catch (err) {
        console.error(err);
        syncLog("推送失败：" + err.message);
      } finally {
        $("#btn-sync-push").disabled = false;
        $("#btn-sync-pull").disabled = false;
      }
    });

    $("#btn-sync-pull").addEventListener("click", async () => {
      const cfg = currentSyncConfig();
      if (!cfg.owner || !cfg.repo || !cfg.token) {
        alert("请先填写并保存 GitHub 设置。");
        return;
      }
      if (!confirm("从云端拉取会覆盖这台设备本地未同步的修改，确定要继续吗？")) return;
      GitHubSync.saveConfig(cfg);
      $("#btn-sync-push").disabled = true;
      $("#btn-sync-pull").disabled = true;
      try {
        await GitHubSync.pullAll(cfg, syncLog);
        await reloadShows();
        renderCurrentView();
        updateSyncStatusText();
      } catch (err) {
        console.error(err);
        syncLog("拉取失败：" + err.message);
      } finally {
        $("#btn-sync-push").disabled = false;
        $("#btn-sync-pull").disabled = false;
      }
    });
  }

  // ---------- 初始化 ----------

  async function init() {
    initSplash();
    initNav();
    initModals();
    initRecordForm();
    initCityModal();
    initSearch();
    initSyncModal();
    attachTicketClicks($("#timeline"));
    attachTicketClicks($("#search-results"));

    await reloadShows();
    renderTimeline();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
