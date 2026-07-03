/**
 * db.js
 * IndexedDB 封装：演出记录（含照片）与城市元信息（交通方式 / 距离）
 * 所有数据保存在用户本机浏览器中，不会上传到任何服务器。
 */

const DB_NAME = "diary5525";
const DB_VERSION = 1;
const STORE_SHOWS = "shows";
const STORE_CITIES = "cityMeta";

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_SHOWS)) {
        const store = db.createObjectStore(STORE_SHOWS, { keyPath: "id" });
        store.createIndex("date", "date", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_CITIES)) {
        db.createObjectStore(STORE_CITIES, { keyPath: "city" });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return _dbPromise;
}

function tx(storeName, mode) {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

const DB = {
  async getAllShows() {
    const store = await tx(STORE_SHOWS, "readonly");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async saveShow(show) {
    const store = await tx(STORE_SHOWS, "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.put(show);
      req.onsuccess = () => resolve(show);
      req.onerror = () => reject(req.error);
    });
  },

  async deleteShow(id) {
    const store = await tx(STORE_SHOWS, "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getCityMeta(city) {
    const store = await tx(STORE_CITIES, "readonly");
    return new Promise((resolve, reject) => {
      const req = store.get(city);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async saveCityMeta(meta) {
    const store = await tx(STORE_CITIES, "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.put(meta);
      req.onsuccess = () => resolve(meta);
      req.onerror = () => reject(req.error);
    });
  }
};

/** 生成一个本地唯一 id */
function makeId() {
  return "show_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

/** 将用户选择的图片文件压缩为 base64 字符串（限制最大边长，控制体积） */
function compressImageFile(file, maxSize = 1280, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round(height * (maxSize / width));
          width = maxSize;
        } else if (height >= width && height > maxSize) {
          width = Math.round(width * (maxSize / height));
          height = maxSize;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
