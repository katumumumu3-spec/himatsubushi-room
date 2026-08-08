import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";
import { appDir, loadQueue, readJson, saveQueue } from "./lib.mjs";

function getAppsBaseUrl() {
  const base = process.env.APPS_BASE_URL || "https://apps.himatsubushiroom.com";
  return base.replace(/\/$/, "");
}

function initFirebase() {
  if (admin.apps.length) return admin.app();

  const projectId = process.env.FIREBASE_PROJECT_ID || "himatubusi-7cb7d";
  const jsonInline = process.env.FIREBASE_SERVICE_ACCOUNT;
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  let credential;
  if (jsonInline) {
    credential = admin.credential.cert(JSON.parse(jsonInline));
  } else if (credPath && fs.existsSync(credPath)) {
    credential = admin.credential.cert(readJson(credPath));
  } else {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT または GOOGLE_APPLICATION_CREDENTIALS を設定してください",
    );
  }

  return admin.initializeApp({ credential, projectId });
}

export async function registerAppBySlug(slug) {
  initFirebase();
  const metaPath = path.join(appDir(slug), "meta.json");
  if (!fs.existsSync(metaPath)) {
    throw new Error(`meta.json が見つかりません: ${slug}`);
  }
  const meta = readJson(metaPath);
  const url = `${getAppsBaseUrl()}/apps/${slug}/`;
  const now = admin.firestore.FieldValue.serverTimestamp();

  const payload = {
    name: meta.name,
    description: meta.description,
    url,
    tags: meta.tags || [],
    images: [],
    searchText: meta.searchText,
    createdAt: now,
    updatedAt: now,
  };

  const db = admin.firestore();
  // Deduplicate by URL when re-running
  const existing = await db.collection("apps").where("url", "==", url).limit(1).get();
  let docRef;
  if (!existing.empty) {
    docRef = existing.docs[0].ref;
    await docRef.update({
      name: payload.name,
      description: payload.description,
      url: payload.url,
      tags: payload.tags,
      images: payload.images,
      searchText: payload.searchText,
      updatedAt: now,
    });
  } else {
    docRef = await db.collection("apps").add(payload);
  }

  const queue = loadQueue();
  const item = queue.items.find((entry) => entry.id === meta.id || entry.slug === slug);
  if (item) {
    item.status = "done";
    item.url = url;
    item.firestoreId = docRef.id;
    item.registeredAt = new Date().toISOString();
    saveQueue(queue);
  }

  return { ok: true, firestoreId: docRef.id, url, slug };
}

export async function registerGeneratedPending() {
  const queue = loadQueue();
  const item = queue.items.find((entry) => entry.status === "generated");
  if (!item) {
    return { ok: true, skipped: true, reason: "generated のアプリがありません" };
  }
  return registerAppBySlug(item.slug);
}

const isMain = path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "");
if (isMain) {
  const slug = process.argv[2];
  try {
    const result = slug ? await registerAppBySlug(slug) : await registerGeneratedPending();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}
