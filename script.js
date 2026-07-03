/**
 * 5525-DIARY — 渲染与交互逻辑
 * 读取 data.js 中的 performances 数组，渲染成票根卡片，
 * 并支持搜索与排序。
 */

(function () {
  const grid = document.getElementById("grid");
  const emptyState = document.getElementById("empty-state");
  const countText = document.getElementById("count-text");
  const searchInput = document.getElementById("search");
  const sortSelect = document.getElementById("sort");

  function formatDate(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d)) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}.${m}.${day}`;
  }

  function renderRating(rating) {
    const total = 5;
    const filled = Math.max(0, Math.min(total, rating || 0));
    let html = '<div class="rating" role="img" aria-label="评分 ' + filled + ' / ' + total + '">';
    for (let i = 0; i < total; i++) {
      html += `<span class="punch ${i < filled ? "filled" : ""}"></span>`;
    }
    html += "</div>";
    return html;
  }

  function renderSetlist(setlist) {
    if (!setlist || !setlist.length) return "";
    const items = setlist.map((song) => `<li>${escapeHtml(song)}</li>`).join("");
    return `
      <details class="setlist">
        <summary>设置单 / 曲目（${setlist.length}）</summary>
        <ol>${items}</ol>
      </details>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function ticketCard(p) {
    const photoHtml = p.photo
      ? `<img class="ticket-photo" src="${p.photo}" alt="${escapeHtml(p.artist)} 票根照片" loading="lazy">`
      : "";
    const priceHtml = p.price != null && p.price !== ""
      ? `<span class="price">¥${p.price}</span>`
      : `<span></span>`;

    return `
      <article class="ticket">
        <div class="ticket-top">
          <span class="ticket-date">${formatDate(p.date)}</span>
          <span class="stamp">ADMIT<br>ONE</span>
        </div>
        <h2 class="ticket-artist">${escapeHtml(p.artist)}</h2>
        <p class="ticket-venue">${escapeHtml(p.venue)} · ${escapeHtml(p.city)}</p>
        <div class="perforation"></div>
        ${photoHtml}
        <div class="ticket-meta-row">
          ${renderRating(p.rating)}
          ${priceHtml}
        </div>
        ${renderSetlist(p.setlist)}
        ${p.notes ? `<p class="ticket-notes">${escapeHtml(p.notes)}</p>` : ""}
      </article>
    `;
  }

  function getFilteredSorted() {
    const query = searchInput.value.trim().toLowerCase();
    const sortBy = sortSelect.value;

    let list = performances.filter((p) => {
      if (!query) return true;
      const haystack = `${p.artist} ${p.venue} ${p.city}`.toLowerCase();
      return haystack.includes(query);
    });

    list = list.slice().sort((a, b) => {
      if (sortBy === "date-asc") return a.date.localeCompare(b.date);
      if (sortBy === "rating-desc") return (b.rating || 0) - (a.rating || 0);
      // default: date-desc
      return b.date.localeCompare(a.date);
    });

    return list;
  }

  function render() {
    const list = getFilteredSorted();
    grid.innerHTML = list.map(ticketCard).join("");
    emptyState.hidden = list.length !== 0;
    countText.textContent = `共收藏 ${performances.length} 张演出票根`;
  }

  searchInput.addEventListener("input", render);
  sortSelect.addEventListener("change", render);

  render();
})();
