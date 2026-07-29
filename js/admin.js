import {
  addDoc,
  adminEmail,
  appsCollection,
  auth,
  db,
  deleteDoc,
  deleteObject,
  doc,
  fetchApps,
  getDownloadURL,
  GoogleAuthProvider,
  isAllowedAdmin,
  isFirebaseConfigured,
  onAuthStateChanged,
  ref,
  serverTimestamp,
  signInWithPopup,
  signOut,
  storage,
  updateDoc,
  uploadBytes,
} from "./firebase.js";

const elements = {
  configHelp: document.querySelector("#config-help"),
  authCard: document.querySelector("#auth-card"),
  authError: document.querySelector("#auth-error"),
  adminContent: document.querySelector("#admin-content"),
  login: document.querySelector("#login-button"),
  logout: document.querySelector("#logout-button"),
  userEmail: document.querySelector("#user-email"),
  notice: document.querySelector("#admin-notice"),
  form: document.querySelector("#app-form"),
  formTitle: document.querySelector("#form-title"),
  name: document.querySelector("#app-name"),
  description: document.querySelector("#app-description"),
  url: document.querySelector("#app-url"),
  tagInput: document.querySelector("#tag-input"),
  addTag: document.querySelector("#add-tag-button"),
  selectedTags: document.querySelector("#selected-tags"),
  suggestions: document.querySelector("#tag-suggestions"),
  imageInput: document.querySelector("#image-input"),
  dropZone: document.querySelector("#drop-zone"),
  previews: document.querySelector("#image-previews"),
  submit: document.querySelector("#submit-button"),
  cancel: document.querySelector("#cancel-edit"),
  list: document.querySelector("#admin-list"),
};

const state = {
  apps: [],
  tags: [],
  images: [],
  editingId: null,
  originalImagePaths: [],
  busy: false,
  authError: "",
};

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

function setNotice(message, type = "success") {
  elements.notice.hidden = !message;
  elements.notice.className = `notice notice--${type}`;
  elements.notice.textContent = message;
  if (message) elements.notice.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setAuthError(message) {
  elements.authError.hidden = !message;
  elements.authError.textContent = message;
}

function setBusy(isBusy, label = "保存中...") {
  state.busy = isBusy;
  elements.submit.disabled = isBusy;
  elements.cancel.disabled = isBusy;
  elements.submit.textContent = isBusy
    ? label
    : state.editingId
      ? "変更を保存"
      : "アプリを登録";
}

function isValidHttpUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function addTag(value) {
  const tag = normalize(value).replace(/^#+/, "").slice(0, 24);
  if (!tag) return;
  if (state.tags.includes(tag)) {
    elements.tagInput.value = "";
    return;
  }
  if (state.tags.length >= 10) {
    setNotice("タグは最大10個まで登録できます。", "error");
    return;
  }
  state.tags.push(tag);
  elements.tagInput.value = "";
  renderTags();
}

function renderTags() {
  elements.selectedTags.innerHTML = state.tags
    .map(
      (tag) => `
        <button type="button" data-remove-tag="${escapeHtml(tag)}" title="クリックで削除">
          # ${escapeHtml(tag)} ×
        </button>
      `,
    )
    .join("");

  const allTags = [
    ...new Set(state.apps.flatMap((app) => app.tags || []).filter((tag) => !state.tags.includes(tag))),
  ]
    .sort((a, b) => a.localeCompare(b, "ja"))
    .slice(0, 16);

  elements.suggestions.innerHTML = allTags
    .map(
      (tag) => `
        <button type="button" data-suggest-tag="${escapeHtml(tag)}">＋ ${escapeHtml(tag)}</button>
      `,
    )
    .join("");

  elements.selectedTags.querySelectorAll("[data-remove-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      state.tags = state.tags.filter((tag) => tag !== button.dataset.removeTag);
      renderTags();
    });
  });

  elements.suggestions.querySelectorAll("[data-suggest-tag]").forEach((button) => {
    button.addEventListener("click", () => addTag(button.dataset.suggestTag));
  });
}

function releasePreview(image) {
  if (image.preview?.startsWith("blob:")) URL.revokeObjectURL(image.preview);
}

function renderImages() {
  elements.previews.innerHTML = state.images
    .map(
      (image, index) => `
        <div class="image-preview">
          <img src="${escapeHtml(image.preview || image.url)}" alt="${index + 1}枚目のプレビュー" />
          <button type="button" data-remove-image="${index}" aria-label="${index + 1}枚目を削除">×</button>
        </div>
      `,
    )
    .join("");

  elements.previews.querySelectorAll("[data-remove-image]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.removeImage);
      releasePreview(state.images[index]);
      state.images.splice(index, 1);
      renderImages();
    });
  });
}

async function compressImage(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error(`${file.name} は対応していない画像形式です。`);
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error(`${file.name} は10MBを超えています。`);
  }

  const bitmap = await createImageBitmap(file);
  const maxWidth = 1080;
  const maxHeight = 1920;
  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const toWebp = (quality) =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error("画像の圧縮に失敗しました。"))),
        "image/webp",
        quality,
      );
    });

  let quality = 0.84;
  let blob = await toWebp(quality);
  while (blob.size > 2.8 * 1024 * 1024 && quality > 0.46) {
    quality -= 0.1;
    blob = await toWebp(quality);
  }
  if (blob.size > 2.8 * 1024 * 1024) {
    throw new Error(`${file.name} を3MB未満に圧縮できませんでした。別の画像をお試しください。`);
  }
  return blob;
}

async function addImages(files) {
  const fileList = [...files];
  if (state.images.length + fileList.length > 4) {
    setNotice("画像は最大4枚まで登録できます。", "error");
    return;
  }

  try {
    for (const file of fileList) {
      const blob = await compressImage(file);
      state.images.push({
        blob,
        preview: URL.createObjectURL(blob),
        originalName: file.name,
        isNew: true,
      });
    }
    renderImages();
  } catch (error) {
    setNotice(error.message, "error");
  } finally {
    elements.imageInput.value = "";
  }
}

function resetForm() {
  state.images.forEach(releasePreview);
  state.tags = [];
  state.images = [];
  state.editingId = null;
  state.originalImagePaths = [];
  elements.form.reset();
  elements.formTitle.textContent = "新しいアプリを追加";
  elements.submit.textContent = "アプリを登録";
  elements.cancel.hidden = true;
  renderTags();
  renderImages();
}

function renderAppList() {
  if (!state.apps.length) {
    elements.list.innerHTML = `
      <div class="status-card">
        <div class="status-card__icon" aria-hidden="true">🪁</div>
        <p>まだアプリが登録されていません。</p>
      </div>
    `;
    return;
  }

  elements.list.innerHTML = state.apps
    .map(
      (app) => `
        <article class="admin-app">
          <h3>${escapeHtml(app.name)}</h3>
          <p>${(app.tags || []).map((tag) => `#${escapeHtml(tag)}`).join("　") || "タグなし"}</p>
          <div class="admin-app__actions">
            <button class="button button--secondary" type="button" data-edit="${escapeHtml(app.id)}">
              編集
            </button>
            <button class="button button--danger" type="button" data-delete="${escapeHtml(app.id)}">
              削除
            </button>
          </div>
        </article>
      `,
    )
    .join("");

  elements.list.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => startEditing(button.dataset.edit));
  });
  elements.list.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => removeApp(button.dataset.delete));
  });
}

async function loadApps() {
  state.apps = await fetchApps();
  renderAppList();
  renderTags();
}

function startEditing(appId) {
  const app = state.apps.find((item) => item.id === appId);
  if (!app) return;
  resetForm();
  state.editingId = app.id;
  state.tags = [...(app.tags || [])];
  state.images = (app.images || []).map((image) => ({ ...image, isNew: false }));
  state.originalImagePaths = state.images.map((image) => image.path).filter(Boolean);
  elements.name.value = app.name || "";
  elements.description.value = app.description || "";
  elements.url.value = app.url || "";
  elements.formTitle.textContent = "アプリを編集";
  elements.submit.textContent = "変更を保存";
  elements.cancel.hidden = false;
  renderTags();
  renderImages();
  elements.formTitle.scrollIntoView({ behavior: "smooth", block: "start" });
}

function uniqueId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function uploadNewImages(appId, results) {
  for (const image of state.images) {
    if (!image.isNew) {
      results.push({ url: image.url, path: image.path });
      continue;
    }
    const path = `apps/${appId}/${uniqueId()}.webp`;
    const imageRef = ref(storage, path);
    await uploadBytes(imageRef, image.blob, {
      contentType: "image/webp",
      cacheControl: "public,max-age=31536000,immutable",
    });
    results.push({ path, url: await getDownloadURL(imageRef) });
  }
}

async function deleteStoragePaths(paths) {
  await Promise.allSettled(paths.filter(Boolean).map((path) => deleteObject(ref(storage, path))));
}

async function saveApp(event) {
  event.preventDefault();
  if (state.busy) return;
  setNotice("");

  const name = elements.name.value.trim();
  const description = elements.description.value.trim();
  const url = elements.url.value.trim();
  if (!name || !description || !url) {
    setNotice("必須項目を入力してください。", "error");
    return;
  }
  if (!isValidHttpUrl(url)) {
    setNotice("アプリURLは http:// または https:// で入力してください。", "error");
    return;
  }
  if (!state.tags.length) {
    setNotice("タグを1つ以上追加してください。", "error");
    return;
  }

  setBusy(true);
  const baseData = {
    name,
    description,
    url,
    tags: [...state.tags],
    searchText: normalize([name, description, ...state.tags].join(" ")),
    updatedAt: serverTimestamp(),
  };

  let targetId = state.editingId;
  const wasEditing = Boolean(state.editingId);
  let createdDocument = null;
  let uploadedImages = [];

  try {
    if (!targetId) {
      createdDocument = await addDoc(appsCollection(), {
        ...baseData,
        images: [],
        createdAt: serverTimestamp(),
      });
      targetId = createdDocument.id;
    }

    await uploadNewImages(targetId, uploadedImages);
    await updateDoc(doc(db, "apps", targetId), { ...baseData, images: uploadedImages });

    if (state.editingId) {
      const retainedPaths = new Set(uploadedImages.map((image) => image.path));
      const removedPaths = state.originalImagePaths.filter((path) => !retainedPaths.has(path));
      await deleteStoragePaths(removedPaths);
    }

    resetForm();
    await loadApps();
    setNotice(wasEditing ? "変更を保存しました。" : "アプリを登録しました。");
  } catch (error) {
    console.error(error);
    const newlyUploadedPaths = uploadedImages
      .filter((image) => !state.originalImagePaths.includes(image.path))
      .map((image) => image.path);
    await deleteStoragePaths(newlyUploadedPaths);
    if (createdDocument) await deleteDoc(createdDocument).catch(() => {});
    setNotice("保存に失敗しました。Firebaseの設定や権限を確認してください。", "error");
  } finally {
    setBusy(false);
  }
}

async function removeApp(appId) {
  if (state.busy) return;
  const app = state.apps.find((item) => item.id === appId);
  if (!app) return;
  if (!confirm(`「${app.name}」を削除しますか？\nこの操作は元に戻せません。`)) return;

  state.busy = true;
  setNotice("");
  try {
    await deleteDoc(doc(db, "apps", appId));
    await deleteStoragePaths((app.images || []).map((image) => image.path));
    if (state.editingId === appId) resetForm();
    await loadApps();
    setNotice("アプリを削除しました。");
  } catch (error) {
    console.error(error);
    setNotice("削除に失敗しました。Firebaseの設定や権限を確認してください。", "error");
  } finally {
    state.busy = false;
  }
}

elements.addTag.addEventListener("click", () => addTag(elements.tagInput.value));
elements.tagInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addTag(event.currentTarget.value);
  }
});
elements.imageInput.addEventListener("change", (event) => addImages(event.target.files));
elements.form.addEventListener("submit", saveApp);
elements.cancel.addEventListener("click", resetForm);

["dragenter", "dragover"].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("is-dragging");
  });
});
["dragleave", "drop"].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("is-dragging");
  });
});
elements.dropZone.addEventListener("drop", (event) => addImages(event.dataTransfer.files));

elements.login.addEventListener("click", async () => {
  state.authError = "";
  setAuthError("");
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    if (error.code !== "auth/popup-closed-by-user") {
      console.error(error);
      state.authError = "ログインできませんでした。Firebaseの認証設定を確認してください。";
      setAuthError(state.authError);
    }
  }
});

elements.logout.addEventListener("click", () => {
  state.authError = "";
  signOut(auth);
});

async function handleAuth(user) {
  elements.authCard.hidden = Boolean(user && isAllowedAdmin(user));
  elements.adminContent.hidden = true;
  setAuthError(state.authError);

  if (!user) {
    elements.authCard.hidden = false;
    return;
  }
  if (!isAllowedAdmin(user)) {
    state.authError =
      `このアカウントには管理権限がありません。設定済みの管理者（${adminEmail}）でログインしてください。`;
    await signOut(auth);
    setAuthError(state.authError);
    elements.authCard.hidden = false;
    return;
  }

  elements.userEmail.textContent = user.email;
  elements.adminContent.hidden = false;
  try {
    await loadApps();
  } catch (error) {
    console.error(error);
    setNotice("アプリ一覧を読み込めませんでした。Firestoreの設定を確認してください。", "error");
  }
}

if (!isFirebaseConfigured) {
  elements.configHelp.hidden = false;
} else {
  onAuthStateChanged(auth, handleAuth);
}
