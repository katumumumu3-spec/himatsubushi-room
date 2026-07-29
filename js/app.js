import { fetchApps, isFirebaseConfigured } from "./firebase.js";

const elements = {
  grid: document.querySelector("#app-grid"),
  status: document.querySelector("#status-card"),
  count: document.querySelector("#result-count"),
  search: document.querySelector("#search-input"),
  sort: document.querySelector("#sort-select"),
  reset: document.querySelector("#filter-reset"),
  tags: document.querySelector("#tag-filter"),
  dialog: document.querySelector("#app-dialog"),
  dialogContent: document.querySelector("#dialog-content"),
  dialogClose: document.querySelector("#dialog-close"),
};

const state = {
  apps: [],
  query: "",
  selectedTags: new Set(),
  sort: "desc",
};

document.querySelector("#current-year").textContent = new Date().getFullYear();

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/\s+/g, " ")
    .trim();
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}

function timestampToMillis(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  if (typeof value === "number") return value;
  return 0;
}

function showStatus(type, title, message) {
  const icons = { empty: "🪁", error: "🛠️", config: "⚙️" };
  elements.grid.hidden = true;
  elements.status.hidden = false;
  elements.status.innerHTML = `
    <div class="status-card__icon" aria-hidden="true">${icons[type] || "🎲"}</div>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(message)}</p>
  `;
}

function getAllTags() {
  return [...new Set(state.apps.flatMap((app) => app.tags || []))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ja"));
}

function renderTagFilters() {
  const tags = getAllTags();
  elements.tags.innerHTML = tags
    .map(
      (tag) => `
        <button
          class="tag-button${state.selectedTags.has(tag) ? " is-active" : ""}"
          type="button"
          data-tag="${escapeHtml(tag)}"
          aria-pressed="${state.selectedTags.has(tag)}"
        ># ${escapeHtml(tag)}</button>
      `,
    )
    .join("");

  elements.tags.querySelectorAll("[data-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      const tag = button.dataset.tag;
      if (state.selectedTags.has(tag)) state.selectedTags.delete(tag);
      else state.selectedTags.add(tag);
      renderTagFilters();
      renderApps();
    });
  });
}

function filteredApps() {
  const queryText = normalize(state.query);
  const selectedTags = [...state.selectedTags];

  return state.apps
    .filter((app) => {
      const searchable =
        app.searchText || normalize([app.name, app.description, ...(app.tags || [])].join(" "));
      const matchesKeyword = !queryText || searchable.includes(queryText);
      const matchesTags =
        selectedTags.length === 0 || selectedTags.some((tag) => (app.tags || []).includes(tag));
      return matchesKeyword && matchesTags;
    })
    .sort((a, b) => {
      const difference = timestampToMillis(a.createdAt) - timestampToMillis(b.createdAt);
      return state.sort === "asc" ? difference : -difference;
    });
}

function appCard(app) {
  const images = Array.isArray(app.images) ? app.images : [];
  const firstImage = images[0]?.url;
  const media = firstImage
    ? `<img src="${escapeHtml(firstImage)}" alt="${escapeHtml(app.name)}の画面" loading="lazy" />`
    : `<div class="app-card__placeholder" aria-hidden="true">🎲</div>`;
  const imageCount =
    images.length > 1
      ? `<span class="app-card__image-count">▣ ${images.length}枚</span>`
      : "";
  const tags = (app.tags || [])
    .map((tag) => `<span class="tag"># ${escapeHtml(tag)}</span>`)
    .join("");

  return `
    <article class="app-card">
      <div class="app-card__media" data-detail="${escapeHtml(app.id)}" tabindex="0" role="button">
        ${media}
        ${imageCount}
      </div>
      <div class="app-card__body">
        <h3>${escapeHtml(app.name)}</h3>
        <p class="app-card__description">${escapeHtml(app.description)}</p>
        <div class="app-card__tags">${tags}</div>
        <div class="app-card__actions">
          <button class="button button--ghost" type="button" data-detail="${escapeHtml(app.id)}">
            詳しく
          </button>
          <a
            class="button button--primary"
            href="${escapeHtml(safeUrl(app.url))}"
            target="_blank"
            rel="noopener noreferrer"
          >遊んでみる ↗</a>
        </div>
      </div>
    </article>
  `;
}

function renderApps() {
  const apps = filteredApps();
  elements.count.textContent = `${apps.length}個のアプリ`;

  if (!apps.length) {
    showStatus(
      "empty",
      "アプリが見つかりませんでした",
      "検索キーワードや選択したタグを変えてみてください。",
    );
    return;
  }

  elements.status.hidden = true;
  elements.grid.hidden = false;
  elements.grid.innerHTML = apps.map(appCard).join("");

  elements.grid.querySelectorAll("[data-detail]").forEach((target) => {
    const open = () => openDialog(target.dataset.detail);
    target.addEventListener("click", open);
    target.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
}

function openDialog(appId) {
  const app = state.apps.find((item) => item.id === appId);
  if (!app) return;

  const images = Array.isArray(app.images) ? app.images : [];
  const gallery = images.length
    ? `
      <div class="dialog-gallery">
        <img
          class="dialog-gallery__main"
          id="dialog-main-image"
          src="${escapeHtml(images[0].url)}"
          alt="${escapeHtml(app.name)}の画面 1"
        />
        <div class="dialog-thumbs">
          ${images
            .map(
              (image, index) => `
                <button
                  class="dialog-thumb${index === 0 ? " is-active" : ""}"
                  type="button"
                  data-image="${escapeHtml(image.url)}"
                  data-alt="${index + 1}"
                  aria-label="${index + 1}枚目の画像を表示"
                >
                  <img src="${escapeHtml(image.url)}" alt="" />
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
    `
    : `
      <div class="dialog-gallery">
        <div class="app-card__placeholder" aria-hidden="true">🎲</div>
      </div>
    `;

  elements.dialogContent.innerHTML = `
    <div class="dialog-layout">
      ${gallery}
      <div class="dialog-info">
        <p class="eyebrow">LET'S PLAY</p>
        <h2>${escapeHtml(app.name)}</h2>
        <div class="app-card__tags">
          ${(app.tags || []).map((tag) => `<span class="tag"># ${escapeHtml(tag)}</span>`).join("")}
        </div>
        <p class="dialog-info__description">${escapeHtml(app.description)}</p>
        <a
          class="button button--primary button--wide"
          href="${escapeHtml(safeUrl(app.url))}"
          target="_blank"
          rel="noopener noreferrer"
        >このアプリで遊ぶ ↗</a>
      </div>
    </div>
  `;

  elements.dialogContent.querySelectorAll("[data-image]").forEach((thumb) => {
    thumb.addEventListener("click", () => {
      const main = elements.dialogContent.querySelector("#dialog-main-image");
      main.src = thumb.dataset.image;
      main.alt = `${app.name}の画面 ${thumb.dataset.alt}`;
      elements.dialogContent
        .querySelectorAll(".dialog-thumb")
        .forEach((item) => item.classList.remove("is-active"));
      thumb.classList.add("is-active");
    });
  });

  elements.dialog.showModal();
}

elements.dialogClose.addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) elements.dialog.close();
});

elements.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderApps();
});

elements.sort.addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderApps();
});

elements.reset.addEventListener("click", () => {
  state.query = "";
  state.sort = "desc";
  state.selectedTags.clear();
  elements.search.value = "";
  elements.sort.value = "desc";
  renderTagFilters();
  renderApps();
});

async function initialize() {
  if (!isFirebaseConfigured) {
    elements.count.textContent = "設定が必要です";
    showStatus(
      "config",
      "Firebaseの初期設定をしてください",
      "READMEを参考に js/firebase-config.js を設定すると、アプリ一覧が表示されます。",
    );
    return;
  }

  try {
    state.apps = await fetchApps();
    renderTagFilters();
    renderApps();
  } catch (error) {
    console.error(error);
    elements.count.textContent = "読み込みエラー";
    showStatus(
      "error",
      "アプリを読み込めませんでした",
      "Firebaseの設定とFirestoreセキュリティルールを確認してください。",
    );
  }
}

initialize();
