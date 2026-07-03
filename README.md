# 5525-DIARY

一份复古票根风格的个人演出记录档案馆，纯 HTML / CSS / JS 静态网站，可直接部署在 GitHub Pages 上。

## 文件结构

```
5525-dairy/
├── index.html      页面结构
├── style.css        票根风格样式
├── data.js          所有演出记录（在这里添加新记录）
├── script.js         渲染 / 搜索 / 排序逻辑
└── photos/           存放票根照片
```

## 如何新增一场演出记录

打开 `data.js`，在 `performances` 数组里复制一份对象并修改内容：

```js
{
  date: "2025-01-10",
  artist: "乐队名",
  venue: "场地名",
  city: "城市",
  price: 280,
  rating: 4,
  photo: "photos/2025-01-10.jpg", // 没有照片就留空字符串 ""
  setlist: ["曲目一", "曲目二"],
  notes: "写下你的感想"
}
```

不需要改任何 HTML/CSS，保存后刷新页面即可看到新票根。

## 如何添加票根照片

把照片文件放进 `photos/` 文件夹，然后在对应记录的 `photo` 字段填相对路径，例如 `"photos/2025-01-10.jpg"`。

## 部署到 GitHub Pages

1. 在 GitHub 新建一个仓库，例如 `5525-dairy`。
2. 把这个文件夹里的所有文件上传 / push 到仓库根目录。
3. 进入仓库 Settings → Pages，Source 选择 `main` 分支、根目录 `/ (root)`，保存。
4. 等待一两分钟，访问 `https://你的用户名.github.io/5525-dairy/` 即可看到网站。

之后每次想添加新的演出记录，只需要编辑 `data.js` 并重新 push，GitHub Pages 会自动更新。

## 本地预览

不需要安装任何工具，直接用浏览器打开 `index.html` 即可预览（部分浏览器对本地图片加载有限制，建议用 VS Code 的 Live Server 插件或运行 `python3 -m http.server` 后访问 `http://localhost:8000` 预览效果更准确）。
